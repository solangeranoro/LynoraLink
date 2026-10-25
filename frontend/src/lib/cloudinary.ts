const MAX_AVATAR_BYTES = 8 * 1024 * 1024;

type CloudinaryUploadResponse = {
  image?: string;
  error?: string;
  details?: string;
};

export function getUploadErrorCode(error: unknown) {
  if (!(error instanceof Error)) return "";
  const separator = error.message.indexOf(":");
  return separator >= 0 ? error.message.slice(0, separator) : error.message;
}

export function getUploadErrorDetails(error: unknown) {
  if (!(error instanceof Error)) return "";
  const separator = error.message.indexOf(":");
  return separator >= 0 ? error.message.slice(separator + 1).trim() : "";
}

function parseCloudinaryResponse(value: unknown): CloudinaryUploadResponse | null {
  if (typeof value !== "object" || value === null) return null;
  const response = value as Record<string, unknown>;
  return {
    image: typeof response.image === "string" ? response.image : undefined,
    error: typeof response.error === "string" ? response.error : undefined,
    details: typeof response.details === "string" ? response.details : undefined,
  };
}

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("image_encode_failed"));
    }, type, quality);
  });
}

export async function uploadAvatarImage(
  file: File,
  onProgress?: (progress: number) => void,
  onTransferComplete?: () => void,
) {
  return uploadImage(file, "/api/profile/avatar", onProgress, undefined, undefined, onTransferComplete);
}

export async function uploadTeamLogoImage(
  file: File,
  onProgress?: (progress: number) => void,
  teamId?: string,
  onTransferComplete?: () => void,
) {
  return uploadImage(file, "/api/teams/logo", onProgress, teamId, undefined, onTransferComplete);
}

export async function uploadProjectImage(file: File, onProgress?: (progress: number) => void, purpose: "logo" | "cover" = "cover") {
  return uploadImage(file, "/api/projects/media", onProgress, undefined, purpose);
}

async function uploadImage(
  file: File,
  endpoint: string,
  onProgress?: (progress: number) => void,
  teamId?: string,
  purpose?: "logo" | "cover",
  onTransferComplete?: () => void,
) {
  if (!file.type.startsWith("image/") || file.size > MAX_AVATAR_BYTES) {
    throw new Error("invalid_avatar_file");
  }

  let uploadFile: Blob = file;
  try {
    const bitmap = await createImageBitmap(file);
    try {
      const maxDimension = purpose === "cover" ? 1600 : 512;
      const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("canvas_unavailable");
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

      let blob = await canvasBlob(canvas, "image/jpeg", 0.82);
      if (blob.size > 580_000) blob = await canvasBlob(canvas, "image/jpeg", 0.65);
      if (blob.size <= (purpose === "cover" ? 1_500_000 : 600_000)) uploadFile = blob;
    } finally {
      bitmap.close();
    }
  } catch {
    // Upload the original image when this browser cannot decode or resize it.
  }

  const formData = new FormData();
  formData.set("file", uploadFile, uploadFile === file ? file.name : "avatar.jpg");
  if (teamId) formData.set("teamId", teamId);
  if (purpose) formData.set("purpose", purpose);
  return new Promise<string>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", endpoint);
    request.responseType = "text";
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        onProgress?.(Math.min(90, Math.round((event.loaded / event.total) * 90)));
      }
    });
    request.upload.addEventListener("load", () => {
      onProgress?.(90);
      onTransferComplete?.();
    });

    request.addEventListener("load", () => {
      let result: CloudinaryUploadResponse | null = null;
      try {
        result = parseCloudinaryResponse(JSON.parse(request.responseText) as unknown);
      } catch {
        // Non-JSON gateway responses are reported with their HTTP status below.
      }
      if (request.status < 200 || request.status >= 300 || !result?.image) {
        if (result?.error) {
          reject(new Error(`${result.error}${result.details ? `: ${result.details}` : ""}`));
        } else if (request.status < 200 || request.status >= 300) {
          reject(new Error(`upload_server_error:HTTP ${request.status}`));
        } else {
          reject(new Error("cloudinary_upload_failed"));
        }
        return;
      }
      onProgress?.(100);
      resolve(result.image);
    });
    request.addEventListener("error", () => reject(new Error("cloudinary_unreachable")));
    request.addEventListener("abort", () => reject(new Error("cloudinary_unreachable")));
    request.send(formData);
  });
}