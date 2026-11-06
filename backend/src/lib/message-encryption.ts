import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const MESSAGE_ENCRYPTION_VERSION = 2;
const AES_GCM_IV_BYTES = 12;
const AES_GCM_TAG_BYTES = 16;
const ATTACHMENT_MAGIC = Buffer.from("LMA2");
const ATTACHMENT_PADDING_BLOCK_BYTES = 64 * 1024;
const METADATA_PLAINTEXT_BYTES = 4096;

type EncryptedValue = {
  version: 2;
  iv: string;
  ciphertext: string;
  tag: string;
};

export type MessageAttachmentMetadata = {
  name: string;
  mimeType: string;
  size: number;
};

export class MessageEncryptionError extends Error {
  constructor(
    message: string,
    readonly code: "missing_key" | "invalid_key" | "decryption_failed",
  ) {
    super(message);
    this.name = "MessageEncryptionError";
  }
}

function getEncryptionKey() {
  const encoded = process.env.MESSAGE_ENCRYPTION_KEY;
  if (!encoded) {
    throw new MessageEncryptionError("MESSAGE_ENCRYPTION_KEY is required.", "missing_key");
  }

  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32 || key.toString("base64") !== encoded) {
    throw new MessageEncryptionError(
      "MESSAGE_ENCRYPTION_KEY must be a base64-encoded 32-byte key.",
      "invalid_key",
    );
  }
  return key;
}

function encryptBuffer(plaintext: Buffer, context: string): EncryptedValue {
  const iv = randomBytes(AES_GCM_IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  cipher.setAAD(Buffer.from(context, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return {
    version: MESSAGE_ENCRYPTION_VERSION,
    iv: iv.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
  };
}

function decryptBuffer(value: EncryptedValue, context: string): Buffer {
  try {
    const iv = decodeBase64(value.iv, AES_GCM_IV_BYTES);
    const tag = decodeBase64(value.tag, AES_GCM_TAG_BYTES);
    const ciphertext = decodeBase64(value.ciphertext);
    const decipher = createDecipheriv("aes-256-gcm", getEncryptionKey(), iv);
    decipher.setAAD(Buffer.from(context, "utf8"));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch (error) {
    if (error instanceof MessageEncryptionError && error.code !== "decryption_failed") throw error;
    throw new MessageEncryptionError("Encrypted message data failed authentication.", "decryption_failed");
  }
}

function decodeBase64(value: string, expectedLength?: number) {
  const decoded = Buffer.from(value, "base64");
  if (
    (value.length === 0 && expectedLength !== undefined) ||
    decoded.toString("base64") !== value ||
    (expectedLength !== undefined && decoded.length !== expectedLength)
  ) {
    throw new MessageEncryptionError("Encrypted message data is malformed.", "decryption_failed");
  }
  return decoded;
}

export function encryptMessageContent(content: string, context: string) {
  return JSON.stringify(encryptBuffer(Buffer.from(content, "utf8"), context));
}

export function decryptMessageContent(content: string, context: string) {
  try {
    const parsed: unknown = JSON.parse(content);
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !("version" in parsed) ||
      parsed.version !== MESSAGE_ENCRYPTION_VERSION ||
      !("iv" in parsed) ||
      typeof parsed.iv !== "string" ||
      !("ciphertext" in parsed) ||
      typeof parsed.ciphertext !== "string" ||
      !("tag" in parsed) ||
      typeof parsed.tag !== "string"
    ) {
      throw new MessageEncryptionError("Encrypted message data is malformed.", "decryption_failed");
    }
    return decryptBuffer(parsed as EncryptedValue, context).toString("utf8");
  } catch (error) {
    if (error instanceof MessageEncryptionError) throw error;
    throw new MessageEncryptionError("Encrypted message data is malformed.", "decryption_failed");
  }
}

export function encryptMessageAttachment(data: Buffer, context: string) {
  const paddingBytes = ATTACHMENT_PADDING_BLOCK_BYTES - (data.length % ATTACHMENT_PADDING_BLOCK_BYTES);
  const paddedData = Buffer.concat([data, randomBytes(paddingBytes)]);
  const value = encryptBuffer(paddedData, context);
  const iv = decodeBase64(value.iv, AES_GCM_IV_BYTES);
  const tag = decodeBase64(value.tag, AES_GCM_TAG_BYTES);
  const ciphertext = decodeBase64(value.ciphertext);
  return Buffer.concat([ATTACHMENT_MAGIC, iv, tag, ciphertext]);
}

export function decryptMessageAttachment(data: Buffer, context: string, plaintextSize: number) {
  if (data.length < ATTACHMENT_MAGIC.length + AES_GCM_IV_BYTES + AES_GCM_TAG_BYTES
    || !data.subarray(0, ATTACHMENT_MAGIC.length).equals(ATTACHMENT_MAGIC)) {
    throw new MessageEncryptionError("Encrypted attachment is malformed.", "decryption_failed");
  }

  const iv = data.subarray(ATTACHMENT_MAGIC.length, ATTACHMENT_MAGIC.length + AES_GCM_IV_BYTES);
  const tag = data.subarray(
    ATTACHMENT_MAGIC.length + AES_GCM_IV_BYTES,
    ATTACHMENT_MAGIC.length + AES_GCM_IV_BYTES + AES_GCM_TAG_BYTES,
  );
  const ciphertext = data.subarray(ATTACHMENT_MAGIC.length + AES_GCM_IV_BYTES + AES_GCM_TAG_BYTES);
  const decipher = createDecipheriv("aes-256-gcm", getEncryptionKey(), iv);
  decipher.setAAD(Buffer.from(context, "utf8"));
  decipher.setAuthTag(tag);
  try {
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    if (!Number.isSafeInteger(plaintextSize) || plaintextSize < 0 || plaintextSize > plaintext.length) {
      throw new MessageEncryptionError("Encrypted attachment size is invalid.", "decryption_failed");
    }
    return plaintext.subarray(0, plaintextSize);
  } catch {
    throw new MessageEncryptionError("Encrypted attachment failed authentication.", "decryption_failed");
  }
}

export function encryptMessageAttachmentMetadata(metadata: MessageAttachmentMetadata, attachmentId: string) {
  const plaintext = Buffer.from(JSON.stringify(metadata), "utf8");
  if (plaintext.length > METADATA_PLAINTEXT_BYTES) {
    throw new MessageEncryptionError("Attachment metadata is too large.", "decryption_failed");
  }
  const padded = Buffer.concat([
    plaintext,
    Buffer.alloc(METADATA_PLAINTEXT_BYTES - plaintext.length, 0x20),
  ]);
  return encryptMessageContent(padded.toString("utf8"), `message-attachment-metadata:${attachmentId}`);
}

export function decryptMessageAttachmentMetadata(value: string, attachmentId: string): MessageAttachmentMetadata {
  let parsed: unknown;
  try {
    parsed = JSON.parse(decryptMessageContent(value, `message-attachment-metadata:${attachmentId}`));
  } catch (error) {
    if (error instanceof MessageEncryptionError) throw error;
    throw new MessageEncryptionError("Attachment metadata is malformed.", "decryption_failed");
  }
  if (
    !parsed ||
    typeof parsed !== "object" ||
    !("name" in parsed) ||
    typeof parsed.name !== "string" ||
    !("mimeType" in parsed) ||
    typeof parsed.mimeType !== "string" ||
    !("size" in parsed) ||
    typeof parsed.size !== "number" ||
    !Number.isSafeInteger(parsed.size) ||
    parsed.size < 0
  ) {
    throw new MessageEncryptionError("Attachment metadata is malformed.", "decryption_failed");
  }
  return parsed as MessageAttachmentMetadata;
}
