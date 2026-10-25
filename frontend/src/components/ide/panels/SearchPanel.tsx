'use client'

import { useIdeStore } from '@/store/ide-store'
import {
  Search, Replace, CaseSensitive, Regex, WholeWord,
  ChevronDown, ChevronRight, FileText, X,
} from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export function SearchPanel() {
  const {
    searchQuery, searchReplaceValue, searchCaseSensitive,
    searchRegex, searchWholeWord, searchResults,
    setSearchQuery, setSearchReplace, toggleSearchOption,
    runSearch, replaceAll, openFile,
  } = useIdeStore()

  const [showReplace, setShowReplace] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const files = useIdeStore((s) => s.files)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const t = setTimeout(runSearch, 250)
    return () => clearTimeout(t)
  }, [searchQuery, searchCaseSensitive, searchRegex, searchWholeWord, runSearch])

  const findFile = (path: string) => {
    const find = (arr: any[]): any => {
      for (const f of arr) {
        if (f.path === path) return f
        if (f.children) {
          const r = find(f.children)
          if (r) return r
        }
      }
    }
    return find(files)
  }

  const totalMatches = searchResults.reduce((sum, r) => sum + r.matches.length, 0)

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <div className="shrink-0 border-b px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Search
        </span>
      </div>
      <div className="shrink-0 space-y-2 border-b p-2">
        <div className="flex items-center gap-1">
          <button
            className="p-0.5 hover:bg-accent rounded text-muted-foreground"
            onClick={() => setShowReplace(!showReplace)}
            title="Toggle Replace"
          >
            {showReplace ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
          <div className="flex-1 relative">
            <Input
              ref={inputRef}
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-7 pr-20 text-xs"
              onKeyDown={(e) => {
                if (e.key === 'Enter') runSearch()
              }}
            />
            <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
              <button
                className={cn('p-1 rounded hover:bg-accent', searchCaseSensitive && 'bg-accent text-foreground')}
                onClick={() => toggleSearchOption('caseSensitive')}
                title="Match Case"
              >
                <CaseSensitive className="h-3.5 w-3.5" />
              </button>
              <button
                className={cn('p-1 rounded hover:bg-accent', searchWholeWord && 'bg-accent text-foreground')}
                onClick={() => toggleSearchOption('wholeWord')}
                title="Match Whole Word"
              >
                <WholeWord className="h-3.5 w-3.5" />
              </button>
              <button
                className={cn('p-1 rounded hover:bg-accent', searchRegex && 'bg-accent text-foreground')}
                onClick={() => toggleSearchOption('regex')}
                title="Use Regular Expression"
              >
                <Regex className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
        {showReplace && (
          <div className="flex items-center gap-1 pl-5">
            <div className="flex-1 relative">
              <Input
                placeholder="Replace"
                value={searchReplaceValue}
                onChange={(e) => setSearchReplace(e.target.value)}
                className="h-7 pr-8 text-xs"
              />
              <button
                className="absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-accent"
                onClick={replaceAll}
                title="Replace in Open Files"
              >
                <Replace className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="shrink-0 border-b px-3 py-1 text-xs text-muted-foreground">
        {searchQuery
          ? `${totalMatches} results in ${searchResults.length} files`
          : 'Type to search across all files'}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {searchResults.map((result) => (
          <div key={result.fileId} className="border-b last:border-0">
            <div className="flex items-center gap-1 px-2 py-1 bg-muted/30 hover:bg-muted/50 cursor-default">
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium truncate">{result.fileName}</span>
              <span className="text-xs text-muted-foreground truncate">{result.filePath}</span>
              <span className="ml-auto text-xs bg-secondary text-secondary-foreground px-1.5 rounded-full">
                {result.matches.length}
              </span>
            </div>
            {result.matches.slice(0, 20).map((match, idx) => (
              <button
                key={idx}
                className="w-full text-left flex items-start gap-2 px-3 py-1 hover:bg-accent/50 text-xs"
                onClick={() => {
                  const file = findFile(result.filePath)
                  if (file) openFile(file)
                }}
              >
                <span className="text-muted-foreground flex-shrink-0 w-8 text-right">{match.line}</span>
                <span className="truncate font-mono">
                  {match.text.slice(0, Math.max(0, match.column - 1))}
                  <mark className="bg-yellow-300/40 text-foreground px-0.5 rounded-sm">
                    {searchQuery}
                  </mark>
                  {match.text.slice(Math.max(0, match.column - 1) + searchQuery.length)}
                </span>
              </button>
            ))}
            {result.matches.length > 20 && (
              <div className="px-3 py-1 text-xs text-muted-foreground">
                + {result.matches.length - 20} more matches
              </div>
            )}
          </div>
        ))}
        {searchQuery && searchResults.length === 0 && (
          <div className="px-3 py-6 text-center text-xs text-muted-foreground">
            No results found
          </div>
        )}
      </div>
    </div>
  )
}
