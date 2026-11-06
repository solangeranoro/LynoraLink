'use client'

import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useIdeStore } from '@/store/ide-store'

export type WorkspaceItemType = 'file' | 'folder'

interface WorkspaceItemDialogProps {
  type: WorkspaceItemType | null
  parentPath?: string
  onOpenChange: (open: boolean) => void
}

export function WorkspaceItemDialog({
  type,
  parentPath = '',
  onOpenChange,
}: WorkspaceItemDialogProps) {
  const createFile = useIdeStore((state) => state.createFile)
  const [name, setName] = useState('')

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName || !type) return
    void createFile(parentPath, trimmedName, type === 'folder')
    setName('')
    onOpenChange(false)
  }

  return (
    <Dialog
      open={type !== null}
      onOpenChange={(open) => {
        if (!open) {
          setName('')
          onOpenChange(false)
        }
      }}
    >
      <DialogContent
        style={{
          backgroundColor: 'var(--coding-background)',
          color: 'var(--coding-foreground)',
        }}
      >
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>New {type === 'folder' ? 'Folder' : 'File'}</DialogTitle>
            <DialogDescription>
              Enter a name for the new {type ?? 'file'}.
            </DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            aria-label={`${type === 'folder' ? 'Folder' : 'File'} name`}
            className="mt-4"
            onChange={(event) => setName(event.target.value)}
            placeholder={type === 'folder' ? 'Folder name' : 'File name (e.g. utils.ts)'}
            required
            value={name}
          />
          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Create</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
