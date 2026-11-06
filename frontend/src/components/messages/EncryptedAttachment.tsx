"use client";

import { useEffect, useState } from "react";
import { FileText, LoaderCircle } from "@/components/FontAwesomeIcons";
import { decryptE2EEAttachment, type E2EEAttachmentMetadata, type E2EEDecryptedMessage } from "@/lib/e2ee";

export function EncryptedAttachment({
  conversationId,
  messageId,
  attachmentId,
  metadata,
  decryptedMessage,
  isFrench,
}: {
  conversationId: string;
  messageId: string;
  attachmentId: string;
  metadata?: E2EEAttachmentMetadata;
  decryptedMessage?: E2EEDecryptedMessage;
  isFrench: boolean;
}) {
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    setDownloadUrl(null);
    setFailed(false);
    if (!metadata || !decryptedMessage) return () => { active = false; };

    void fetch(`/api/conversations/${conversationId}/messages/${messageId}/attachments/${attachmentId}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("ATTACHMENT_DOWNLOAD_FAILED");
        const ciphertext = await response.arrayBuffer();
        const plaintext = await decryptE2EEAttachment(ciphertext, metadata, decryptedMessage);
        objectUrl = URL.createObjectURL(new Blob([plaintext], { type: metadata.mimeType }));
        if (active) setDownloadUrl(objectUrl);
        else URL.revokeObjectURL(objectUrl);
      })
      .catch(() => {
        if (active) setFailed(true);
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachmentId, conversationId, decryptedMessage, messageId, metadata]);

  const name = metadata?.name ?? (isFrench ? "Pièce jointe" : "Attachment");
  if (metadata?.mimeType.startsWith("image/") && downloadUrl) {
    return (
      <a href={downloadUrl} target="_blank" rel="noreferrer" className="mt-2 block overflow-hidden rounded-lg border border-midnight-border/70">
        <img src={downloadUrl} alt={name} loading="lazy" className="max-h-72 w-full object-contain" />
      </a>
    );
  }

  return (
    <a
      href={downloadUrl ?? undefined}
      download={name}
      aria-disabled={!downloadUrl}
      className="mt-2 flex min-h-10 items-center gap-2 rounded-lg border border-midnight-border/70 px-3 py-2 text-xs transition hover:bg-midnight-card/70 aria-disabled:pointer-events-none aria-disabled:opacity-70"
    >
      {!downloadUrl && !failed
        ? <LoaderCircle size={14} className="shrink-0 animate-spin text-gold-soft" aria-hidden="true" />
        : <FileText size={14} className="shrink-0 text-gold-soft" aria-hidden="true" />}
      <span className="min-w-0 flex-1 truncate">{failed ? (isFrench ? "Impossible d’ouvrir ce fichier" : "Unable to open this file") : name}</span>
      {metadata && <span className="shrink-0 text-[10px] text-ink-muted">{metadata.size < 1024 * 1024 ? `${Math.max(1, Math.ceil(metadata.size / 1024))} KB` : `${(metadata.size / (1024 * 1024)).toFixed(1)} MB`}</span>}
    </a>
  );
}
