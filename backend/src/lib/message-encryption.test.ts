import assert from "node:assert/strict";
import test from "node:test";
import {
  decryptMessageAttachment,
  decryptMessageAttachmentMetadata,
  decryptMessageContent,
  encryptMessageAttachment,
  encryptMessageAttachmentMetadata,
  encryptMessageContent,
  MessageEncryptionError,
} from "./message-encryption";

const originalKey = process.env.MESSAGE_ENCRYPTION_KEY;

test.beforeEach(() => {
  process.env.MESSAGE_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
});

test.after(() => {
  if (originalKey === undefined) delete process.env.MESSAGE_ENCRYPTION_KEY;
  else process.env.MESSAGE_ENCRYPTION_KEY = originalKey;
});

test("round-trips message content, attachment bytes, and encrypted metadata", () => {
  const content = "A confidential message";
  const messageEnvelope = encryptMessageContent(content, "conversation:message");
  assert.notEqual(messageEnvelope, content);
  assert.equal(decryptMessageContent(messageEnvelope, "conversation:message"), content);

  const bytes = Buffer.from([0, 1, 2, 255]);
  const encryptedBytes = encryptMessageAttachment(bytes, "attachment:id");
  assert.notDeepEqual(encryptedBytes, bytes);
  assert.deepEqual(decryptMessageAttachment(encryptedBytes, "attachment:id", bytes.length), bytes);

  const metadata = { name: "private-name.txt", mimeType: "text/plain", size: bytes.length };
  const encryptedMetadata = encryptMessageAttachmentMetadata(metadata, "attachment-id");
  assert.equal(encryptedMetadata.includes(metadata.name), false);
  assert.deepEqual(decryptMessageAttachmentMetadata(encryptedMetadata, "attachment-id"), metadata);
});

test("rejects tampered ciphertext and mismatched encryption context", () => {
  const envelope = JSON.parse(encryptMessageContent("secret", "message-a")) as {
    version: number;
    iv: string;
    ciphertext: string;
    tag: string;
  };
  const tampered = Buffer.from(envelope.ciphertext, "base64");
  tampered[0] ^= 1;
  envelope.ciphertext = tampered.toString("base64");
  assert.throws(
    () => decryptMessageContent(JSON.stringify(envelope), "message-a"),
    (error: unknown) => error instanceof MessageEncryptionError && error.code === "decryption_failed",
  );
  assert.throws(
    () => decryptMessageContent(encryptMessageContent("secret", "message-a"), "message-b"),
    (error: unknown) => error instanceof MessageEncryptionError && error.code === "decryption_failed",
  );

  const attachment = encryptMessageAttachment(Buffer.from("secret"), "attachment-a");
  attachment[attachment.length - 1] ^= 1;
  assert.throws(
    () => decryptMessageAttachment(attachment, "attachment-a", 6),
    (error: unknown) => error instanceof MessageEncryptionError && error.code === "decryption_failed",
  );
});

test("fails explicitly when the dedicated key is missing or malformed", () => {
  const envelope = encryptMessageContent("secret", "context");
  delete process.env.MESSAGE_ENCRYPTION_KEY;
  assert.throws(
    () => encryptMessageContent("secret", "context"),
    (error: unknown) => error instanceof MessageEncryptionError && error.code === "missing_key",
  );
  assert.throws(
    () => decryptMessageContent(envelope, "context"),
    (error: unknown) => error instanceof MessageEncryptionError && error.code === "missing_key",
  );

  process.env.MESSAGE_ENCRYPTION_KEY = "not-a-valid-key";
  assert.throws(
    () => encryptMessageContent("secret", "context"),
    (error: unknown) => error instanceof MessageEncryptionError && error.code === "invalid_key",
  );
  assert.throws(
    () => decryptMessageContent(envelope, "context"),
    (error: unknown) => error instanceof MessageEncryptionError && error.code === "invalid_key",
  );
});
