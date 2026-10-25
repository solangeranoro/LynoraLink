import { loadPyodide, type PyodideInterface } from 'pyodide'
import { newQuickJSWASMModule, type QuickJSContext, type QuickJSRuntime } from 'quickjs-emscripten'

type WorkspaceEntry = {
  path: string
  isDirectory: boolean
  content: string
}

type WorkerRequest =
  | { type: 'initialize'; files: WorkspaceEntry[] }
  | { type: 'command'; command: string; cwd: string }
  | { type: 'reset' }

type WorkerResponse =
  | { type: 'ready' }
  | { type: 'output'; stream: 'stdout' | 'stderr'; text: string }
  | { type: 'result'; cwd: string; exitCode: number }
  | { type: 'error'; message: string }
  | { type: 'reset' }

const MAX_FILE_BYTES = 32 * 1024 * 1024
const IGNORED_DIRECTORIES = new Set([
  '.git', '.next', '.turbo', '.vercel', '.cache', 'node_modules',
  'dist', 'build', 'coverage',
])

const files = new Map<string, WorkspaceEntry>()
let quickJsPromise: ReturnType<typeof newQuickJSWASMModule> | null = null
let quickJsRuntime: QuickJSRuntime | null = null
let quickJsContext: QuickJSContext | null = null
let pyodidePromise: Promise<PyodideInterface> | null = null
let currentCwd = '/workspace'
let pythonRunDeadline = 0

function post(message: WorkerResponse) {
  self.postMessage(message)
}

function validRelativePath(value: string): boolean {
  return Boolean(value) &&
    !value.includes('\\') &&
    !value.includes('\0') &&
    value.split('/').every((segment) =>
      segment.length > 0 &&
      segment !== '.' &&
      segment !== '..' &&
      !IGNORED_DIRECTORIES.has(segment.toLowerCase()),
    )
}

function resolveWorkspacePath(value: string, cwd = currentCwd): string | null {
  const segments = value.startsWith('/')
    ? value.split('/')
    : `${cwd}/${value}`.split('/')
  const normalized: string[] = []
  for (const segment of segments) {
    if (!segment || segment === '.') continue
    if (segment === '..') {
      if (!normalized.length) return null
      normalized.pop()
    } else {
      normalized.push(segment)
    }
  }
  return normalized.length ? `/${normalized.join('/')}` : '/workspace'
}

function relativeWorkspacePath(absolutePath: string): string | null {
  if (!absolutePath.startsWith('/workspace/')) return null
  const relative = absolutePath.slice('/workspace/'.length)
  return validRelativePath(relative) ? relative : null
}

function parseArguments(command: string): string[] {
  const tokens: string[] = []
  const pattern = /"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|(\S+)/g
  let match: RegExpExecArray | null
  while ((match = pattern.exec(command)) !== null) {
    tokens.push((match[1] ?? match[2] ?? match[3]).replace(/\\(["'\\])/g, '$1'))
  }
  return tokens
}

function listDirectory(directory: string, showHidden: boolean): string[] {
  const children = new Map<string, boolean>()
  for (const [absolutePath, entry] of files) {
    const parent = absolutePath.slice(0, absolutePath.lastIndexOf('/')) || '/'
    if (parent === directory) {
      children.set(absolutePath.slice(absolutePath.lastIndexOf('/') + 1), entry.isDirectory)
    }
    if (!entry.isDirectory || !absolutePath.startsWith(`${directory}/`)) continue
    const remainder = absolutePath.slice(directory.length + 1)
    if (!remainder.includes('/')) children.set(remainder, true)
  }
  return [...children.entries()]
    .filter(([name]) => showHidden || !name.startsWith('.'))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, isDirectory]) => isDirectory ? `${name}/` : name)
}

function ensureQuickJs(): Promise<QuickJSRuntime> {
  if (!quickJsPromise) quickJsPromise = newQuickJSWASMModule()
  if (!quickJsRuntime) {
    quickJsRuntime = null
    return quickJsPromise.then((module) => {
      if (!quickJsRuntime) {
        quickJsRuntime = module.newRuntime({
          memoryLimitBytes: 32 * 1024 * 1024,
          maxStackSizeBytes: 512 * 1024,
        })
        quickJsContext = quickJsRuntime.newContext()
        const consoleHandle = quickJsContext.newObject()
        const logHandle = quickJsContext.newFunction('log', (...args) => {
          const values = args.map((value) => {
            const dumped = quickJsContext?.dump(value)
            return typeof dumped === 'string' ? dumped : JSON.stringify(dumped)
          })
          post({ type: 'output', stream: 'stdout', text: `${values.join(' ')}\r\n` })
          return quickJsContext?.undefined ?? 0
        })
        quickJsContext.setProp(consoleHandle, 'log', logHandle)
        quickJsContext.setProp(quickJsContext.global, 'console', consoleHandle)
        logHandle.dispose()
        consoleHandle.dispose()
      }
      return quickJsRuntime
    })
  }
  return Promise.resolve(quickJsRuntime)
}

function runJavaScript(source: string, filename: string): number {
  if (!quickJsRuntime || !quickJsContext) throw new Error('JavaScript runtime is not ready.')
  const deadline = Date.now() + 5_000
  quickJsRuntime.setInterruptHandler(() => Date.now() >= deadline)
  const result = quickJsContext.evalCode(source, filename)
  try {
    if (result.error) {
      const error = quickJsContext.dump(result.error)
      post({ type: 'output', stream: 'stderr', text: `${String(error)}\r\n` })
      return 1
    }
    const value = quickJsContext.dump(result.value)
    if (value !== undefined) {
      post({ type: 'output', stream: 'stdout', text: `${String(value)}\r\n` })
    }
    return 0
  } finally {
    result.error?.dispose()
    result.value?.dispose()
  }
}

async function ensurePyodide(): Promise<PyodideInterface> {
  if (!pyodidePromise) {
    pyodidePromise = loadPyodide({
      jsglobals: {},
      stdout: (text) => post({ type: 'output', stream: 'stdout', text: `${text}\r\n` }),
      stderr: (text) => post({ type: 'output', stream: 'stderr', text: `${text}\r\n` }),
    }).then((pyodide) => {
      pyodide.FS.mkdirTree('/workspace')
      for (const [absolutePath, entry] of files) {
        const relative = relativeWorkspacePath(absolutePath)
        if (!relative) continue
        const target = `/workspace/${relative}`
        if (entry.isDirectory) pyodide.FS.mkdirTree(target)
        else {
          pyodide.FS.mkdirTree(target.slice(0, target.lastIndexOf('/')))
          pyodide.FS.writeFile(target, entry.content)
        }
      }
      return pyodide
    })
  }
  return pyodidePromise
}

function emitResult(cwd: string, exitCode: number) {
  post({ type: 'result', cwd, exitCode })
}

async function execute(command: string, cwd: string): Promise<void> {
  currentCwd = resolveWorkspacePath(cwd) ?? '/workspace'
  const args = parseArguments(command.trim())
  const [program, ...parameters] = args
  if (!program) {
    emitResult(currentCwd, 0)
    return
  }

  if (program === 'pwd') {
    post({ type: 'output', stream: 'stdout', text: `${currentCwd}\r\n` })
    emitResult(currentCwd, 0)
    return
  }
  if (program === 'clear') {
    post({ type: 'output', stream: 'stdout', text: '\x1b[2J\x1b[H' })
    emitResult(currentCwd, 0)
    return
  }
  if (program === 'help') {
    post({
      type: 'output',
      stream: 'stdout',
      text: [
        'Browser sandbox commands:',
        '  ls [-a] [path]       List workspace files',
        '  cd [path]             Change directory',
        '  pwd, echo, cat, clear',
        '  node <file.js>        Run JavaScript in QuickJS WebAssembly',
        '  python <file.py>      Run Python in Pyodide WebAssembly',
        '  npm run <name>        Run JS-only package scripts',
        'Native commands, network access, npm install and system packages are unavailable.\r\n',
      ].join('\r\n'),
    })
    emitResult(currentCwd, 0)
    return
  }
  if (program === 'echo') {
    post({ type: 'output', stream: 'stdout', text: `${parameters.join(' ')}\r\n` })
    emitResult(currentCwd, 0)
    return
  }
  if (program === 'cd') {
    const target = resolveWorkspacePath(parameters[0] ?? '/workspace')
    if (!target) {
      post({ type: 'output', stream: 'stderr', text: 'cd: path is outside /workspace\r\n' })
      emitResult(currentCwd, 1)
      return
    }
    if (target !== '/workspace' && ![...files.keys()].some((path) =>
      path === target || path.startsWith(`${target}/`),
    )) {
      post({ type: 'output', stream: 'stderr', text: `cd: no such directory: ${parameters[0] ?? target}\r\n` })
      emitResult(currentCwd, 1)
      return
    }
    currentCwd = target
    emitResult(currentCwd, 0)
    return
  }
  if (program === 'ls') {
    const targetArgument = parameters.find((argument) => !argument.startsWith('-')) ?? '.'
    const target = resolveWorkspacePath(targetArgument)
    if (!target) {
      post({ type: 'output', stream: 'stderr', text: 'ls: path is outside /workspace\r\n' })
      emitResult(currentCwd, 1)
      return
    }
    const showHidden = parameters.some((argument) => argument.includes('a'))
    const names = listDirectory(target, showHidden)
    if (target !== '/workspace' && !names.length &&
      ![...files.keys()].some((path) => path === target || path.startsWith(`${target}/`))) {
      post({ type: 'output', stream: 'stderr', text: `ls: cannot access '${targetArgument}'\r\n` })
      emitResult(currentCwd, 2)
      return
    }
    post({ type: 'output', stream: 'stdout', text: `${names.join('  ')}\r\n` })
    emitResult(currentCwd, 0)
    return
  }
  if (program === 'cat') {
    if (!parameters.length) {
      post({ type: 'output', stream: 'stderr', text: 'cat: missing file operand\r\n' })
      emitResult(currentCwd, 1)
      return
    }
    let failed = false
    for (const parameter of parameters) {
      const target = resolveWorkspacePath(parameter)
      const entry = target ? files.get(target) : undefined
      if (!entry || entry.isDirectory) {
        post({ type: 'output', stream: 'stderr', text: `cat: ${parameter}: no such file\r\n` })
        failed = true
      } else {
        post({ type: 'output', stream: 'stdout', text: `${entry.content}\r\n` })
      }
    }
    emitResult(currentCwd, failed ? 1 : 0)
    return
  }

  let sourcePath: string | null = null
  let source = ''
  let isPython = program === 'python' || program === 'python3'
  if ((program === 'node' || program === 'nodejs' || isPython) && parameters[0] === '-e' && parameters[1]) {
    source = parameters.slice(1).join(' ')
    sourcePath = `<${program}-eval>`
  } else if (program === 'npm' && parameters[0] === 'run' && parameters[1]) {
    const packagePath = resolveWorkspacePath('package.json')
    const packageFile = packagePath ? files.get(packagePath) : undefined
    try {
      const packageJson = JSON.parse(packageFile?.content ?? '{}') as {
        scripts?: Record<string, string>
      }
      const script = packageJson.scripts?.[parameters[1]]
      if (!script || !/^node\s+[^;&|]+\.m?js$/.test(script.trim())) {
        throw new Error('Only npm scripts containing a single "node <file.js>" command are supported.')
      }
      const sourceRelativePath = script.trim().replace(/^node\s+/, '')
      sourcePath = resolveWorkspacePath(sourceRelativePath)
      const entry = sourcePath ? files.get(sourcePath) : undefined
      if (!entry || entry.isDirectory) throw new Error(`Script file not found: ${sourceRelativePath}`)
      source = entry.content
      post({ type: 'output', stream: 'stdout', text: `> npm run ${parameters[1]}\r\n> ${script}\r\n` })
    } catch (error) {
      post({
        type: 'output',
        stream: 'stderr',
        text: `${error instanceof Error ? error.message : 'Invalid package.json'}\r\n`,
      })
      emitResult(currentCwd, 1)
      return
    }
  } else if (program === 'node' || program === 'nodejs' || isPython) {
    const scriptArgument = parameters[0]
    sourcePath = scriptArgument ? resolveWorkspacePath(scriptArgument) : null
    const entry = sourcePath ? files.get(sourcePath) : undefined
    if (!entry || entry.isDirectory) {
      post({ type: 'output', stream: 'stderr', text: `${program}: script not found: ${scriptArgument ?? ''}\r\n` })
      emitResult(currentCwd, 2)
      return
    }
    source = entry.content
  } else {
    const programMessage = program === 'npm'
      ? 'npm install and arbitrary npm scripts are not available in the browser runtime.'
      : `Command "${program}" is not available in the browser sandbox. Type "help" for supported commands.`
    post({ type: 'output', stream: 'stderr', text: `${programMessage}\r\n` })
    emitResult(currentCwd, 127)
    return
  }

  if (source.length > MAX_FILE_BYTES) {
    post({ type: 'output', stream: 'stderr', text: 'Script exceeds the 32 MB runtime limit.\r\n' })
    emitResult(currentCwd, 1)
    return
  }

  if (isPython) {
    try {
      const pyodide = await ensurePyodide()
      pythonRunDeadline = Date.now() + 10_000
      const interruptBuffer = new SharedArrayBuffer(1)
      const interruptView = new Uint8Array(interruptBuffer)
      pyodide.setInterruptBuffer(interruptBuffer)
      const timer = setTimeout(() => {
        Atomics.store(interruptView, 0, 2)
        post({ type: 'output', stream: 'stderr', text: 'Python execution time limit reached.\r\n' })
      }, 10_000)
      try {
        const result = await pyodide.runPythonAsync(source, { filename: sourcePath ?? '<python>' })
        if (result !== undefined && result !== null) {
          post({ type: 'output', stream: 'stdout', text: `${String(result)}\r\n` })
        }
        emitResult(currentCwd, Date.now() > pythonRunDeadline ? 124 : 0)
      } finally {
        clearTimeout(timer)
        pyodide.setInterruptBuffer(null)
      }
    } catch (error) {
      post({
        type: 'output',
        stream: 'stderr',
        text: `${error instanceof Error ? error.message : String(error)}\r\n`,
      })
      emitResult(currentCwd, 1)
    }
  } else {
    try {
      await ensureQuickJs()
      emitResult(currentCwd, runJavaScript(source, sourcePath ?? '<node>'))
    } catch (error) {
      post({
        type: 'output',
        stream: 'stderr',
        text: `${error instanceof Error ? error.message : String(error)}\r\n`,
      })
      emitResult(currentCwd, 1)
    }
  }
}

self.addEventListener('message', (event: MessageEvent<WorkerRequest>) => {
  const request = event.data
  if (request.type === 'initialize') {
    const totalBytes = request.files.reduce((total, file) =>
      total + new TextEncoder().encode(file.content).byteLength, 0)
    if (totalBytes > MAX_FILE_BYTES) {
      post({ type: 'error', message: 'Workspace exceeds the 32 MB browser terminal limit.' })
      return
    }
    for (const file of request.files) {
      if (!validRelativePath(file.path)) continue
      const absolutePath = `/workspace/${file.path}`
      files.set(absolutePath, { ...file })
    }
    void ensureQuickJs()
      .then(() => post({ type: 'ready' }))
      .catch((error: unknown) => post({
        type: 'error',
        message: error instanceof Error ? error.message : 'Could not load the browser JavaScript runtime.',
      }))
    return
  }
  if (request.type === 'reset') {
    files.clear()
    quickJsContext?.dispose()
    quickJsRuntime?.dispose()
    quickJsContext = null
    quickJsRuntime = null
    quickJsPromise = null
    pyodidePromise = null
    currentCwd = '/workspace'
    post({ type: 'reset' })
    return
  }
  void execute(request.command, request.cwd)
})
