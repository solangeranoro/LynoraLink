const MIME_BY_EXTENSION: Record<string, string> = {
  ".avif": "image/avif",
  ".c": "text/x-c",
  ".cc": "text/x-c",
  ".cpp": "text/x-c++",
  ".cs": "text/plain",
  ".css": "text/css",
  ".csv": "text/csv",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".gif": "image/gif",
  ".go": "text/x-go",
  ".h": "text/x-c",
  ".hpp": "text/x-c++",
  ".html": "text/html",
  ".java": "text/x-java",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript",
  ".json": "application/json",
  ".jsx": "text/javascript",
  ".md": "text/markdown",
  ".pdf": "application/pdf",
  ".php": "text/x-php",
  ".png": "image/png",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".py": "text/x-python",
  ".rb": "text/x-ruby",
  ".rs": "text/x-rust",
  ".sh": "text/x-shellscript",
  ".sql": "application/sql",
  ".toml": "application/toml",
  ".ts": "text/typescript",
  ".tsx": "text/typescript",
  ".txt": "text/plain",
  ".webp": "image/webp",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".xml": "application/xml",
  ".yaml": "application/yaml",
  ".yml": "application/yaml",
  ".zip": "application/zip",
};

export function getAttachmentMimeType(file: File) {
  if (file.size === 0) return null;
  const extension = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
  const mimeType = MIME_BY_EXTENSION[extension];
  if (!mimeType) return null;
  const declaredType = file.type.toLowerCase();
  return !declaredType
    || declaredType === "application/octet-stream"
    || declaredType === mimeType
    || (mimeType === "application/zip" && declaredType === "application/x-zip-compressed")
    || (mimeType.startsWith("text/") && declaredType.startsWith("text/"))
    ? mimeType
    : null;
}

export function safeAttachmentFileName(name: string) {
  return name.replace(/[\\/\r\n\0]/g, "_").trim().slice(0, 255) || "attachment";
}
