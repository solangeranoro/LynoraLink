'use client'

import {
  Braces, Coffee, Code2, Container, Database, FileArchive, FileAudio,
  FileCode2, FileCog, FileImage, FileJson, FileSpreadsheet,
  FileTerminal, FileText, FileType, FileVideo, GitBranch, Hash,
  LockKeyhole, Package, Palette, Settings2, Workflow,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import {
  faCss3Alt, faDocker, faGitAlt, faGolang, faHtml5, faJava,
  faJs, faMarkdown, faPhp, faPython, faReact, faReadme,
  faRust, faSass, faVuejs,
} from '@fortawesome/free-brands-svg-icons'
import type { FileType as ProjectFileType, ProjectFile } from '@/types/ide'

interface FileIconProps {
  file: ProjectFile
  className?: string
}

type IconStyle = {
  icon: LucideIcon
  color: string
}

const iconByExtension: Partial<Record<ProjectFileType, IconStyle>> = {
  js: { icon: Code2, color: 'text-yellow-400' },
  jsx: { icon: Code2, color: 'text-cyan-400' },
  ts: { icon: Braces, color: 'text-blue-400' },
  tsx: { icon: Braces, color: 'text-sky-400' },
  py: { icon: Code2, color: 'text-blue-300' },
  java: { icon: Coffee, color: 'text-orange-400' },
  cs: { icon: Hash, color: 'text-violet-400' },
  go: { icon: Code2, color: 'text-cyan-300' },
  rust: { icon: FileCode2, color: 'text-orange-300' },
  c: { icon: Code2, color: 'text-blue-500' },
  cpp: { icon: Code2, color: 'text-blue-400' },
  json: { icon: FileJson, color: 'text-yellow-300' },
  md: { icon: FileText, color: 'text-sky-300' },
  html: { icon: Code2, color: 'text-orange-400' },
  css: { icon: Palette, color: 'text-pink-400' },
  scss: { icon: Palette, color: 'text-pink-300' },
  yml: { icon: FileCog, color: 'text-purple-300' },
  yaml: { icon: FileCog, color: 'text-purple-300' },
  sh: { icon: FileTerminal, color: 'text-emerald-400' },
  sql: { icon: Database, color: 'text-indigo-300' },
  xml: { icon: FileCode2, color: 'text-orange-300' },
  txt: { icon: FileText, color: 'text-slate-300' },
  env: { icon: FileCog, color: 'text-yellow-300' },
  prisma: { icon: Database, color: 'text-teal-300' },
  toml: { icon: Settings2, color: 'text-slate-300' },
  dockerfile: { icon: Container, color: 'text-sky-400' },
}

const specialFiles: Record<string, IconStyle> = {
  '.editorconfig': { icon: FileCog, color: 'text-slate-300' },
  '.gitignore': { icon: GitBranch, color: 'text-orange-300' },
  '.gitattributes': { icon: GitBranch, color: 'text-orange-300' },
  '.gitmodules': { icon: GitBranch, color: 'text-orange-300' },
  '.gitkeep': { icon: GitBranch, color: 'text-orange-300' },
  '.npmrc': { icon: FileCog, color: 'text-red-300' },
  '.prettierrc': { icon: FileCog, color: 'text-cyan-300' },
  '.eslintrc': { icon: FileCog, color: 'text-violet-300' },
  '.dockerignore': { icon: Container, color: 'text-sky-400' },
  '.browserslistrc': { icon: FileCog, color: 'text-slate-300' },
  '.nvmrc': { icon: FileCog, color: 'text-green-300' },
  'dockerfile': { icon: Container, color: 'text-sky-400' },
  'license': { icon: FileText, color: 'text-amber-300' },
  'package-lock.json': { icon: LockKeyhole, color: 'text-red-300' },
  'pnpm-lock.yaml': { icon: LockKeyhole, color: 'text-orange-300' },
  'bun.lock': { icon: LockKeyhole, color: 'text-orange-200' },
  'yarn.lock': { icon: LockKeyhole, color: 'text-sky-300' },
  'readme.md': { icon: FileText, color: 'text-blue-300' },
  'tsconfig.json': { icon: Braces, color: 'text-blue-400' },
  'package.json': { icon: Package, color: 'text-green-400' },
  'vite.config.ts': { icon: Workflow, color: 'text-violet-300' },
  'next.config.js': { icon: Workflow, color: 'text-white' },
  'next.config.ts': { icon: Workflow, color: 'text-white' },
  'next.config.mjs': { icon: Workflow, color: 'text-white' },
}

const brandByExtension: Record<string, IconDefinition> = {
  css: faCss3Alt,
  dockerfile: faDocker,
  go: faGolang,
  html: faHtml5,
  java: faJava,
  js: faJs,
  jsx: faReact,
  md: faMarkdown,
  mjs: faJs,
  cjs: faJs,
  php: faPhp,
  py: faPython,
  rs: faRust,
  sass: faSass,
  scss: faSass,
  tsx: faReact,
  vue: faVuejs,
}

const brandByName: Record<string, IconDefinition> = {
  '.gitignore': faGitAlt,
  '.gitattributes': faGitAlt,
  '.gitmodules': faGitAlt,
  '.gitkeep': faGitAlt,
  'readme': faReadme,
  'readme.md': faReadme,
}

const iconByRawExtension: Record<string, IconStyle> = {
  avif: { icon: FileImage, color: 'text-violet-300' },
  bmp: { icon: FileImage, color: 'text-violet-300' },
  gif: { icon: FileImage, color: 'text-violet-300' },
  jpeg: { icon: FileImage, color: 'text-violet-300' },
  jpg: { icon: FileImage, color: 'text-violet-300' },
  png: { icon: FileImage, color: 'text-violet-300' },
  svg: { icon: FileImage, color: 'text-orange-300' },
  webp: { icon: FileImage, color: 'text-violet-300' },
  mp3: { icon: FileAudio, color: 'text-pink-300' },
  wav: { icon: FileAudio, color: 'text-pink-300' },
  mp4: { icon: FileVideo, color: 'text-pink-300' },
  webm: { icon: FileVideo, color: 'text-pink-300' },
  pdf: { icon: FileText, color: 'text-red-400' },
  zip: { icon: FileArchive, color: 'text-amber-300' },
  gz: { icon: FileArchive, color: 'text-amber-300' },
  lock: { icon: LockKeyhole, color: 'text-slate-300' },
  php: { icon: FileCode2, color: 'text-indigo-300' },
  rb: { icon: Code2, color: 'text-red-300' },
  vue: { icon: Code2, color: 'text-emerald-300' },
  svelte: { icon: Code2, color: 'text-orange-300' },
  graphql: { icon: Workflow, color: 'text-pink-300' },
  gql: { icon: Workflow, color: 'text-pink-300' },
  wasm: { icon: FileCode2, color: 'text-purple-300' },
  ipynb: { icon: FileCode2, color: 'text-orange-300' },
  csv: { icon: FileSpreadsheet, color: 'text-emerald-300' },
  xlsx: { icon: FileSpreadsheet, color: 'text-emerald-300' },
}

export function FileIconBadge({ file, className }: FileIconProps) {
  const name = file.name.toLowerCase()
  const extension = name.split('.').pop() ?? ''
  const iconClassName = className ?? 'h-4 w-4'
  const brandIcon = brandByName[name] ?? brandByExtension[extension]
  if (brandIcon) {
    const color = extension === 'css' ? 'text-blue-400'
      : extension === 'html' ? 'text-orange-500'
        : ['js', 'mjs', 'cjs'].includes(extension) ? 'text-yellow-400'
          : extension === 'md' || name.startsWith('readme') ? 'text-sky-300'
            : ['tsx', 'jsx'].includes(extension) ? 'text-cyan-400'
              : extension === 'py' ? 'text-blue-300'
                : extension === 'java' ? 'text-orange-400'
                  : extension === 'go' ? 'text-cyan-300'
                    : extension === 'rs' ? 'text-orange-300'
                      : extension === 'php' ? 'text-indigo-300'
                        : extension === 'scss' || extension === 'sass' ? 'text-pink-300'
                          : extension === 'vue' ? 'text-emerald-300'
                            : extension === 'dockerfile' ? 'text-sky-400'
                              : ['.gitignore', '.gitattributes', '.gitmodules', '.gitkeep'].includes(name)
                                ? 'text-orange-300'
                                : 'text-muted-foreground'
    if (extension === 'tsx') {
      return (
        <span className={`${iconClassName} relative inline-flex items-center justify-center`} aria-hidden="true">
          <FontAwesomeIcon icon={brandIcon} className={`h-full w-full ${color}`} />
          <span className="absolute -bottom-0.5 -right-1 rounded-[1px] bg-[#3178c6] px-[2px] text-[6px] font-bold leading-[8px] text-white">
            TS
          </span>
        </span>
      )
    }
    return <FontAwesomeIcon icon={brandIcon} className={`${iconClassName} ${color}`} aria-hidden="true" />
  }

  if (['ts', 'mts', 'cts'].includes(extension)) {
    return (
      <span
        className={`${iconClassName} inline-flex items-end justify-end rounded-[2px] bg-[#3178c6] p-[2px] text-[8px] font-bold leading-none text-white`}
        aria-hidden="true"
      >
        TS
      </span>
    )
  }

  const specialName = Object.keys(specialFiles).find((specialName) =>
    name === specialName || (specialName.startsWith('.') && name.startsWith(`${specialName}.`)),
  )
  const style = (name === '.env' || name.startsWith('.env.')
    ? { icon: FileCog, color: 'text-yellow-300' }
    : specialName ? specialFiles[specialName] : undefined)
    ?? iconByExtension[file.type]
    ?? iconByRawExtension[extension]
    ?? (name.startsWith('.')
      ? { icon: FileCog, color: 'text-slate-400' }
      : { icon: FileType, color: 'text-muted-foreground' })
  const Icon = style.icon

  return <Icon className={`${iconClassName} ${style.color}`} aria-hidden="true" />
}
