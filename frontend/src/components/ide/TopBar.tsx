'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useIdeStore } from '@/store/ide-store'
import { signOut, useSession } from 'next-auth/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faComments } from '@fortawesome/free-solid-svg-icons'
import {
  Sun, Moon, PanelLeft, Sparkles, PanelBottom, Command, ChevronDown, LogIn, LogOut, Settings,
} from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { MenuBar } from './MenuBar'

export function TopBar() {
  const {
    theme, settings, toggleTheme, toggleSidebar, toggleAssistantSidebar, toggleTerminal,
    assistantSidebarVisible, assistantUnreadResponses,
    projectName, setCommandPaletteOpen,
  } = useIdeStore()
  const { data: session } = useSession()

  return (
    <>
      <div className="coding-topbar flex items-center h-9 bg-background border-b px-2 gap-1 flex-shrink-0">
        <Link
          href="/dashboard"
          className="flex items-center justify-center gap-0 p-1.5 hover:bg-accent rounded text-muted-foreground hover:text-foreground"
          title="Back to LynoraLink"
          aria-label="Back to LynoraLink"
        >
          <Image
            src="/logo_lynoracoding.svg"
            alt="LynoraCoding"
            width={20}
            height={20}
            className="h-5 w-5 object-contain"
          />
        </Link>

        <button
          className="coding-left-sidebar-toggle p-1.5 hover:bg-accent rounded text-muted-foreground hover:text-foreground"
          onClick={toggleSidebar}
          title={`Toggle Sidebar (${settings.shortcuts.toggleSidebar})`}
          aria-label={`Toggle left sidebar (${settings.shortcuts.toggleSidebar})`}
        >
          <PanelLeft className="h-4 w-4" />
        </button>

        <MenuBar />

        <div className="coding-project-name flex items-center gap-2 text-xs px-2">
          <span className="font-medium truncate">{projectName}</span>
        </div>

        <div className="flex-1" />

        {/* Center: Command palette shortcut */}
        <button
          className="coding-command-button flex items-center gap-1.5 px-3 py-1 rounded border bg-background hover:bg-accent text-xs text-muted-foreground"
          onClick={() => setCommandPaletteOpen(true)}
          aria-label="Search files and commands"
        >
          <Command className="h-3 w-3" />
          <span className="coding-project-search-title">{projectName}</span>
          <kbd className="coding-command-shortcut text-[10px] bg-muted px-1 rounded ml-2">
            {settings.shortcuts.commandPalette}
          </kbd>
        </button>

        <div className="flex-1" />

        {/* Right side: theme + git link + account */}
        <button
          className="coding-desktop-only p-1.5 hover:bg-accent rounded text-muted-foreground hover:text-foreground"
          onClick={toggleTheme}
          title="Toggle Theme"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        <button
          className="coding-terminal-button p-1.5 hover:bg-accent rounded text-muted-foreground hover:text-foreground"
          onClick={toggleTerminal}
          title={`Toggle Terminal (${settings.shortcuts.toggleTerminal})`}
        >
          <PanelBottom className="h-4 w-4" />
        </button>

        <button
          className={`coding-right-panel-toggle p-1.5 hover:bg-accent rounded ${assistantSidebarVisible ? 'text-foreground bg-accent/60' : 'text-muted-foreground hover:text-foreground'}`}
          onClick={toggleAssistantSidebar}
          title={assistantSidebarVisible ? 'Close LynoAI chat' : 'Open LynoAI chat'}
          aria-label={assistantSidebarVisible ? 'Close LynoAI chat' : 'Open LynoAI chat'}
          aria-pressed={assistantSidebarVisible}
        >
          <span className="relative inline-flex h-5 w-5 items-center justify-center">
            <FontAwesomeIcon icon={faComments} className="h-[19px] w-[19px]" aria-hidden="true" />
            <Sparkles className="absolute -right-1 -top-1 h-2.5 w-2.5 fill-background text-emerald-500" aria-hidden="true" />
            {assistantUnreadResponses > 0 && (
              <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-600 px-1 text-[9px] font-bold text-white">
                {assistantUnreadResponses > 9 ? '9+' : assistantUnreadResponses}
              </span>
            )}
          </span>
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="coding-account-button ml-1 flex items-center gap-1 p-0.5 rounded hover:bg-accent">
              {session?.user ? (
                <>
                  <Avatar className="h-6 w-6 text-[10px]">
                    <AvatarFallback className="bg-emerald-500 text-white">
                      {(session.user.name ?? session.user.email ?? 'U')
                        .split(/\s+/).map((word) => word[0]).join('').slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                </>
              ) : (
                <div className="flex items-center gap-1 px-2 py-1 rounded text-xs">
                  <LogIn className="h-3.5 w-3.5" />
                  <span className="coding-sign-in-label">Sign in</span>
                </div>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {session?.user ? (
              <>
                <DropdownMenuLabel>
                  <div className="flex flex-col gap-0.5">
                    <span>{session.user.name ?? 'LynoraLink member'}</span>
                    <span className="text-xs text-muted-foreground font-normal">{session.user.email}</span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/settings">
                    <Settings className="h-3.5 w-3.5 mr-2" /> Account settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => void signOut({ callbackUrl: '/login' })}>
                  <LogOut className="h-3.5 w-3.5 mr-2" /> Sign out
                </DropdownMenuItem>
              </>
            ) : (
              <>
                <DropdownMenuLabel>Sign in to LynoraCoding</DropdownMenuLabel>
                <DropdownMenuItem asChild>
                  <Link href="/login">
                    <LogIn className="h-3.5 w-3.5 mr-2" /> Sign in / Sign up
                  </Link>
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  )
}
