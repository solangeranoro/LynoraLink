import { createHash, randomUUID } from "node:crypto";
import { v2 as cloudinary } from "cloudinary";

export type CloudinaryAsset = {
  publicId: string;
  resourceType: "image" | "video" | "raw";
  format: string;
};

export function isCloudinaryResourceType(value: string): value is CloudinaryAsset["resourceType"] {
  return value === "image" || value === "video" || value === "raw";
}

export class CloudinaryStorageError extends Error {
  constructor(
    message: string,
    readonly code: "not_configured" | "upload_failed" | "download_failed",
  ) {
    super(message);
  }
}

export class CloudinaryImageUploadError extends Error {
  constructor(
    message: string,
    readonly code: "not_configured" | "unreachable" | "service_unavailable" | "rejected",
  ) {
    super(message);
  }
}

export async function uploadCloudinaryImage(file: File, folder: string, publicId: string) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    throw new CloudinaryImageUploadError("Cloudinary is not configured.", "not_configured");
  }

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const parameters = { folder, overwrite: "false", public_id: publicId, timestamp };
  const signatureInput = Object.entries(parameters)
    .sort(([first], [second]) => first < second ? -1 : first > second ? 1 : 0)
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  const signature = createHash("sha1").update(`${signatureInput}${apiSecret}`).digest("hex");

  for (let attempt = 0; attempt < 2; attempt++) {
    const form = new FormData();
    form.set("file", file, file.name);
    form.set("api_key", apiKey);
    form.set("signature", signature);
    Object.entries(parameters).forEach(([key, value]) => form.set(key, value));

    let response: Response;
    try {
      response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`, {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(30_000),
      });
    } catch (error) {
      if (attempt === 0) continue;
      const message = error instanceof Error && error.name === "TimeoutError"
        ? "Cloudinary upload timed out."
        : "Cloudinary could not be reached.";
      throw new CloudinaryImageUploadError(message, "unreachable");
    }

    let responseText: string;
    try {
      responseText = await response.text();
    } catch {
      if (attempt === 0) continue;
      throw new CloudinaryImageUploadError("Cloudinary upload response could not be read.", "unreachable");
    }
    type UploadResponse = { secure_url?: string; error?: { message?: string } };
    let result: UploadResponse | null = null;
    try {
      result = JSON.parse(responseText) as UploadResponse;
    } catch {
      if (response.status >= 500 && attempt === 0) continue;
    }

    if (response.ok && result?.secure_url) return result.secure_url;
    if (response.status >= 500) {
      if (attempt === 0) continue;
      throw new CloudinaryImageUploadError(`Cloudinary returned HTTP ${response.status}.`, "service_unavailable");
    }

    const detail = result?.error?.message ?? `Cloudinary returned HTTP ${response.status}.`;
    const safeDetail = [apiKey, apiSecret].filter(Boolean).reduce(
      (message, credential) => message.replaceAll(credential!, "[redacted]"),
      detail,
    );
    throw new CloudinaryImageUploadError(safeDetail, "rejected");
  }

  throw new CloudinaryImageUploadError("Cloudinary could not be reached.", "unreachable");
}

function configureCloudinary() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    throw new CloudinaryStorageError("Cloudinary is not configured.", "not_configured");
  }

  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });
}

function sanitizedCloudinaryError(error: unknown) {
  const message = error instanceof Error ? error.message : "Cloudinary request failed.";
  return [process.env.CLOUDINARY_API_KEY, process.env.CLOUDINARY_API_SECRET]
    .filter((credential): credential is string => Boolean(credential))
    .reduce((safeMessage, credential) => safeMessage.replaceAll(credential, "[redacted]"), message);
}

export async function uploadCloudinaryAsset(
  data: Buffer,
  folder: string,
  fileName: string,
  mimeType: string,
): Promise<CloudinaryAsset> {
  configureCloudinary();
  const extension = fileName.includes(".") ? fileName.slice(fileName.lastIndexOf(".")).toLowerCase() : "";
  const resourceType = mimeType.startsWith("image/") ? "image" : mimeType.startsWith("video/") ? "video" : "raw";
  const rawExtension = extension || ".bin";
  const publicId = randomUUID() + (resourceType === "raw" ? rawExtension : "");
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({
      resource_type: resourceType,
      type: "authenticated",
      folder,
      public_id: publicId,
      overwrite: false,
    }, (error, result) => {
      if (error || !result) {
        reject(new CloudinaryStorageError(
          sanitizedCloudinaryError(error ?? new Error("Cloudinary upload failed.")),
          "upload_failed",
        ));
        return;
      }
      if (!isCloudinaryResourceType(result.resource_type)) {
        reject(new CloudinaryStorageError("Cloudinary returned an unsupported resource type.", "upload_failed"));
        return;
      }
      resolve({
        publicId: result.public_id,
        resourceType: result.resource_type,
        format: result.format || rawExtension.replace(/^\./, ""),
      });
    });
    stream.end(data);
  });
}

export async function getCloudinaryAssetResponse(asset: CloudinaryAsset): Promise<Response> {
  configureCloudinary();
  const url = cloudinary.utils.private_download_url(asset.publicId, asset.format, {
    resource_type: asset.resourceType,
    type: "authenticated",
    expires_at: Math.floor(Date.now() / 1000) + 60,
    attachment: false,
  });

  let response: Response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  } catch {
    throw new CloudinaryStorageError("Cloudinary download failed.", "download_failed");
  }
  if (!response.ok || !response.body) {
    await response.body?.cancel();
    throw new CloudinaryStorageError(`Cloudinary download returned HTTP ${response.status}.`, "download_failed");
  }
  return response;
}

export async function deleteCloudinaryAsset(asset: CloudinaryAsset) {
  configureCloudinary();
  try {
    await cloudinary.uploader.destroy(asset.publicId, {
      resource_type: asset.resourceType,
      type: "authenticated",
      invalidate: true,
    });
  } catch (error) {
    throw new CloudinaryStorageError(sanitizedCloudinaryError(error), "upload_failed");
  }
}
