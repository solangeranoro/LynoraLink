export type GitProvider = 'github' | 'gitlab'

let sessionAccessToken = ''

export function getGitSessionToken(): string {
  return sessionAccessToken
}

export function setGitSessionToken(token: string): void {
  sessionAccessToken = token
}

export interface GitBranch {
  name: string
  commit: string
  protected: boolean
}

export interface GitCommit {
  sha: string
  message: string
  author: string
  date: string
}

export interface GitTextFile {
  path: string
  content: string
}

interface GitHubTreeItem {
  path: string
  mode: string
  type: string
  sha: string
}

interface GitLabTreeItem {
  path: string
  type: string
  mode: string
}

function validateRepository(provider: GitProvider, repository: string): string {
  const value = repository.trim().replace(/^\/+|\/+$/g, '')
  const parts = value.split('/')
  const validSegment = (segment: string) => /^[A-Za-z0-9_.-]+$/.test(segment) && segment !== '.' && segment !== '..'
  if (provider === 'github' && (parts.length !== 2 || !parts.every(validSegment))) {
    throw new Error('Enter a GitHub repository as owner/name.')
  }
  if (provider === 'gitlab' && (!parts.length || parts.some((part) => !validSegment(part)))) {
    throw new Error('Enter a GitLab project path as group/project.')
  }
  return value
}

function validateBranch(branch: string): string {
  const value = branch.trim()
  if (!value || value.length > 255 || value.startsWith('-') || value.endsWith('/') ||
    value === '@' || value.includes('@{') || value.includes('..') || value.includes('//') ||
    /[\s~^:?*\[\]\\]/.test(value) || value.split('/').some((segment) =>
      !segment || segment.startsWith('.') || segment.endsWith('.') || segment.endsWith('.lock'))) {
    throw new Error('The branch name is invalid.')
  }
  return value
}

function apiRoot(provider: GitProvider): string {
  return provider === 'github' ? 'https://api.github.com' : 'https://gitlab.com/api/v4'
}

function encodeRef(ref: string): string {
  return ref.split('/').map(encodeURIComponent).join('/')
}

async function request<T>(
  provider: GitProvider,
  token: string,
  path: string,
  init: RequestInit = {},
): Promise<{ data: T; headers: Headers }> {
  if (!token.trim()) throw new Error('Enter an access token first.')
  if (token.length > 8192) throw new Error('The access token is too long.')
  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/json')
  if (provider === 'github') {
    headers.set('Authorization', `Bearer ${token}`)
    headers.set('X-GitHub-Api-Version', '2022-11-28')
  } else {
    headers.set('PRIVATE-TOKEN', token)
  }
  if (init.body) headers.set('Content-Type', 'application/json')
  let response: Response
  try {
    response = await fetch(`${apiRoot(provider)}${path}`, {
      ...init,
      headers,
      redirect: 'error',
    })
  } catch {
    throw new Error(`Unable to reach ${provider === 'github' ? 'GitHub' : 'GitLab'}; check your network and CORS access.`)
  }
  const text = await response.text()
  let data: unknown = null
  if (text) {
    try { data = JSON.parse(text) } catch { throw new Error('The Git provider returned an invalid response.') }
  }
  if (!response.ok) {
    const message = data && typeof data === 'object' && 'message' in data &&
      typeof data.message === 'string'
      ? data.message.slice(0, 300)
      : `HTTP ${response.status}`
    throw new Error(`${provider === 'github' ? 'GitHub' : 'GitLab'}: ${message}`)
  }
  return { data: data as T, headers: response.headers }
}

function repoPath(provider: GitProvider, repository: string): string {
  const value = validateRepository(provider, repository)
  return provider === 'github'
    ? `/repos/${value.split('/').map(encodeURIComponent).join('/')}`
    : `/projects/${encodeURIComponent(value)}`
}

function textFromBase64(value: string): string {
  const binary = atob(value.replace(/\s/g, ''))
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
}

function validateWorkspaceFiles(files: GitTextFile[]): GitTextFile[] {
  if (files.length > 1000) throw new Error('Git sync is limited to 1,000 text files per operation.')
  let totalBytes = 0
  return files.map((file) => {
    if (!file.path || file.path.length > 512 || file.path.startsWith('/') ||
      file.path.includes('\\') || file.path.split('/').some((part) => !part || part === '.' || part === '..')) {
      throw new Error(`The workspace contains an invalid path: ${file.path}`)
    }
    totalBytes += new TextEncoder().encode(file.content).length
    if (file.content.length > 2_000_000 || totalBytes > 20_000_000) {
      throw new Error('Git sync is limited to 20 MB of text per operation.')
    }
    return file
  })
}

async function githubBranches(token: string, repository: string): Promise<GitBranch[]> {
  const branches: GitBranch[] = []
  for (let page = 1; page <= 100; page += 1) {
    const { data, headers } = await request<Array<{
      name: string
      protected: boolean
      commit: { sha: string }
    }>>('github', token, `${repoPath('github', repository)}/branches?per_page=100&page=${page}`)
    branches.push(...data.map((item) => ({
      name: item.name,
      protected: item.protected,
      commit: item.commit.sha,
    })))
    if (!/\brel="next"/.test(headers.get('link') ?? '')) return branches
  }
  throw new Error('The repository has more than 10,000 branches.')
}

async function gitlabBranches(token: string, repository: string): Promise<GitBranch[]> {
  const branches: GitBranch[] = []
  for (let page = 1; page <= 100; page += 1) {
    const { data, headers } = await request<Array<{
      name: string
      protected: boolean
      commit: { id: string }
    }>>('gitlab', token, `${repoPath('gitlab', repository)}/repository/branches?per_page=100&page=${page}`)
    branches.push(...data.map((item) => ({
      name: item.name,
      protected: item.protected,
      commit: item.commit.id,
    })))
    const nextPage = headers.get('x-next-page')
    if (!nextPage) return branches
    if (!/^\d+$/.test(nextPage)) throw new Error('GitLab returned an invalid pagination response.')
  }
  throw new Error('The repository has more than 10,000 branches.')
}

async function githubCommits(token: string, repository: string, branch: string): Promise<GitCommit[]> {
  const { data } = await request<Array<{
    sha: string
    commit: { message: string; author: { name: string; date: string } | null }
  }>>('github', token, `${repoPath('github', repository)}/commits?sha=${encodeURIComponent(branch)}&per_page=30`)
  return data.map((item) => ({
    sha: item.sha,
    message: item.commit.message,
    author: item.commit.author?.name ?? 'Unknown',
    date: item.commit.author?.date ?? '',
  }))
}

async function gitlabCommits(token: string, repository: string, branch: string): Promise<GitCommit[]> {
  const { data } = await request<Array<{
    id: string
    message: string
    author_name: string
    authored_date: string
  }>>('gitlab', token,
  `${repoPath('gitlab', repository)}/repository/commits?ref_name=${encodeURIComponent(branch)}&per_page=30`)
  return data.map((item) => ({
    sha: item.id,
    message: item.message,
    author: item.author_name,
    date: item.authored_date,
  }))
}

export async function connectGit(
  provider: GitProvider,
  token: string,
  repository: string,
): Promise<{ branches: GitBranch[]; defaultBranch: string }> {
  const path = repoPath(provider, repository)
  if (provider === 'github') {
    const { data } = await request<{ default_branch: string }>(provider, token, path)
    const branches = await githubBranches(token, repository)
    return { branches, defaultBranch: data.default_branch }
  }
  const { data } = await request<{ default_branch: string }>(provider, token, path)
  const branches = await gitlabBranches(token, repository)
  return { branches, defaultBranch: data.default_branch }
}

export async function listGitBranches(
  provider: GitProvider,
  token: string,
  repository: string,
): Promise<GitBranch[]> {
  return provider === 'github'
    ? githubBranches(token, repository)
    : gitlabBranches(token, repository)
}

export async function listGitCommits(
  provider: GitProvider,
  token: string,
  repository: string,
  branch: string,
): Promise<GitCommit[]> {
  const ref = validateBranch(branch)
  return provider === 'github'
    ? githubCommits(token, repository, ref)
    : gitlabCommits(token, repository, ref)
}

export async function createGitBranch(
  provider: GitProvider,
  token: string,
  repository: string,
  branch: string,
  base: string,
): Promise<void> {
  const newBranch = validateBranch(branch)
  const baseBranch = validateBranch(base)
  if (provider === 'github') {
    const { data } = await request<{ object: { sha: string } }>(
      provider, token, `${repoPath(provider, repository)}/git/ref/heads/${encodeRef(baseBranch)}`,
    )
    await request(provider, token, `${repoPath(provider, repository)}/git/refs`, {
      method: 'POST',
      body: JSON.stringify({ ref: `refs/heads/${newBranch}`, sha: data.object.sha }),
    })
  } else {
    const query = new URLSearchParams({ branch: newBranch, ref: baseBranch })
    await request(provider, token, `${repoPath(provider, repository)}/repository/branches?${query}`, {
      method: 'POST',
    })
  }
}

export async function mergeGitBranch(
  provider: GitProvider,
  token: string,
  repository: string,
  source: string,
  target: string,
): Promise<string> {
  const head = validateBranch(source)
  const base = validateBranch(target)
  if (provider === 'github') {
    const { data } = await request<{ sha: string }>(provider, token, `${repoPath(provider, repository)}/merges`, {
      method: 'POST',
      body: JSON.stringify({
        base,
        head,
        commit_message: `Merge ${head} into ${base}`,
      }),
    })
    return data.sha
  }
  const project = repoPath(provider, repository)
  const { data: mergeRequest } = await request<{ iid: number }>(
    provider, token, `${project}/merge_requests`, { method: 'POST', body: JSON.stringify({
      source_branch: head,
      target_branch: base,
      title: `Merge ${head} into ${base}`,
    }) },
  )
  const { data } = await request<{ merge_commit_sha: string | null }>(
    provider, token, `${project}/merge_requests/${mergeRequest.iid}/merge`,
    { method: 'PUT', body: JSON.stringify({}) },
  )
  return data.merge_commit_sha ?? 'Merged'
}

async function getGithubTree(
  token: string,
  repository: string,
  branch: string,
): Promise<{ head: string; tree: GitHubTreeItem[] }> {
  const { data: ref } = await request<{ object: { sha: string } }>(
    'github', token, `${repoPath('github', repository)}/git/ref/heads/${encodeRef(branch)}`,
  )
  const { data: commit } = await request<{ tree: { sha: string } }>(
    'github', token, `${repoPath('github', repository)}/git/commits/${ref.object.sha}`,
  )
  const { data: tree } = await request<{ truncated: boolean; tree: GitHubTreeItem[] }>(
    'github', token, `${repoPath('github', repository)}/git/trees/${commit.tree.sha}?recursive=1`,
  )
  if (tree.truncated) throw new Error('The remote repository is too large to safely synchronize.')
  return { head: ref.object.sha, tree: tree.tree.filter((item) => item.type === 'blob') }
}

async function getGitlabTree(
  token: string,
  repository: string,
  branch: string,
): Promise<GitLabTreeItem[]> {
  const result: GitLabTreeItem[] = []
  let page = 1
  while (page <= 100) {
    const { data, headers } = await request<GitLabTreeItem[]>(
      'gitlab',
      token,
      `${repoPath('gitlab', repository)}/repository/tree?recursive=true&per_page=100&page=${page}&ref=${encodeURIComponent(branch)}`,
    )
    result.push(...data)
    const nextPage = headers.get('x-next-page')
    if (!nextPage) return result.filter((item) => item.type === 'blob')
    page = Number(nextPage)
    if (!Number.isInteger(page) || page < 1) throw new Error('GitLab returned an invalid pagination response.')
  }
  throw new Error('The remote repository has more than 10,000 tree entries.')
}

async function getGithubFiles(token: string, repository: string, branch: string): Promise<GitTextFile[]> {
  const { tree } = await getGithubTree(token, repository, branch)
  if (tree.length > 500) throw new Error('Pull is limited to 500 text files at a time.')
  const files: GitTextFile[] = []
  for (const item of tree) {
    if (item.mode !== '100644' && item.mode !== '100755') {
      throw new Error(`The remote path ${item.path} is not a regular text file.`)
    }
    const { data } = await request<{ content: string; encoding: string }>(
      'github', token, `${repoPath('github', repository)}/git/blobs/${item.sha}`,
    )
    if (data.encoding !== 'base64') throw new Error(`Unsupported encoding in ${item.path}.`)
    try {
      files.push({ path: item.path, content: textFromBase64(data.content) })
    } catch {
      throw new Error(`The remote file ${item.path} is not valid UTF-8 text.`)
    }
  }
  return files
}

async function getGitlabFiles(token: string, repository: string, branch: string): Promise<GitTextFile[]> {
  const tree = await getGitlabTree(token, repository, branch)
  if (tree.length > 500) throw new Error('Pull is limited to 500 text files at a time.')
  const files: GitTextFile[] = []
  for (const item of tree) {
    if (item.mode !== '100644' && item.mode !== '100755') {
      throw new Error(`The remote path ${item.path} is not a regular text file.`)
    }
    const path = `${repoPath('gitlab', repository)}/repository/files/${encodeURIComponent(item.path)}?ref=${encodeURIComponent(branch)}`
    const { data } = await request<{ content: string; encoding: string }>('gitlab', token, path)
    if (data.encoding !== 'base64') throw new Error(`Unsupported encoding in ${item.path}.`)
    try {
      files.push({ path: item.path, content: textFromBase64(data.content) })
    } catch {
      throw new Error(`The remote file ${item.path} is not valid UTF-8 text.`)
    }
  }
  return files
}

export async function pullGitWorkspace(
  provider: GitProvider,
  token: string,
  repository: string,
  branch: string,
): Promise<GitTextFile[]> {
  const ref = validateBranch(branch)
  const files = provider === 'github'
    ? await getGithubFiles(token, repository, ref)
    : await getGitlabFiles(token, repository, ref)
  return validateWorkspaceFiles(files)
}

async function pushGithubWorkspace(
  token: string,
  repository: string,
  branch: string,
  message: string,
  files: GitTextFile[],
  allowDeletes: boolean,
): Promise<string> {
  const { head, tree } = await getGithubTree(token, repository, branch)
  const workspacePaths = new Set(files.map((file) => file.path))
  const deletions = tree.filter((item) => !workspacePaths.has(item.path))
  if (deletions.length && !allowDeletes) {
    throw new Error('Push would delete remote files absent from the workspace; confirm a full sync to continue.')
  }
  const changes = [
    ...files.map((file) => ({
      path: file.path,
      mode: '100644',
      type: 'blob',
      content: file.content,
    })),
    ...deletions.map((item) => ({
      path: item.path,
      mode: item.mode,
      type: 'blob',
      sha: null,
    })),
  ]
  if (!changes.length) throw new Error('There are no workspace files to commit.')
  const { data: parent } = await request<{ tree: { sha: string } }>(
    'github', token, `${repoPath('github', repository)}/git/commits/${head}`,
  )
  const { data: createdTree } = await request<{ sha: string }>(
    'github', token, `${repoPath('github', repository)}/git/trees`,
    { method: 'POST', body: JSON.stringify({ base_tree: parent.tree.sha, tree: changes }) },
  )
  const { data: commit } = await request<{ sha: string }>(
    'github', token, `${repoPath('github', repository)}/git/commits`,
    { method: 'POST', body: JSON.stringify({ message, tree: createdTree.sha, parents: [head] }) },
  )
  await request('github', token, `${repoPath('github', repository)}/git/refs/heads/${encodeRef(branch)}`, {
    method: 'PATCH',
    body: JSON.stringify({ sha: commit.sha, force: false }),
  })
  return commit.sha
}

async function pushGitlabWorkspace(
  token: string,
  repository: string,
  branch: string,
  message: string,
  files: GitTextFile[],
  allowDeletes: boolean,
): Promise<string> {
  const remoteTree = await getGitlabTree(token, repository, branch)
  const remotePaths = new Set(remoteTree.map((item) => item.path))
  const localPaths = new Set(files.map((file) => file.path))
  const deletions = [...remotePaths].filter((path) => !localPaths.has(path))
  if (deletions.length && !allowDeletes) {
    throw new Error('Push would delete remote files absent from the workspace; confirm a full sync to continue.')
  }
  const actions = [
    ...files.map((file) => ({
      action: remotePaths.has(file.path) ? 'update' : 'create',
      file_path: file.path,
      content: file.content,
    })),
    ...deletions.map((path) => ({ action: 'delete', file_path: path })),
  ]
  if (!actions.length) throw new Error('There are no workspace files to commit.')
  if (actions.length > 100) throw new Error('GitLab limits one commit to 100 file actions; split this sync into smaller commits.')
  const { data } = await request<{ id: string }>(
    'gitlab', token, `${repoPath('gitlab', repository)}/repository/commits`,
    {
      method: 'POST',
      body: JSON.stringify({ branch, commit_message: message, actions }),
    },
  )
  return data.id
}

export async function pushGitWorkspace(
  provider: GitProvider,
  token: string,
  repository: string,
  branch: string,
  message: string,
  workspaceFiles: GitTextFile[],
  allowDeletes: boolean,
): Promise<string> {
  const ref = validateBranch(branch)
  const cleanMessage = message.trim()
  if (!cleanMessage || cleanMessage.length > 500) throw new Error('Enter a commit message (maximum 500 characters).')
  const files = validateWorkspaceFiles(workspaceFiles)
  return provider === 'github'
    ? pushGithubWorkspace(token, repository, ref, cleanMessage, files, allowDeletes)
    : pushGitlabWorkspace(token, repository, ref, cleanMessage, files, allowDeletes)
}
