const ENVELOPE_VERSION = 1;
const BACKUP_ITERATIONS = 600_000;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export type E2EEPublicKey = JsonWebKey & { kty: "EC"; crv: "P-256"; x: string; y: string };
export type E2EEBackup = { version: 1; salt: string; iv: string; ciphertext: string };
export type E2EEIdentity = { publicKey: E2EEPublicKey; privateKey: CryptoKey };
export type E2EERecipient = { userId: string; publicKey: E2EEPublicKey | null };
export type E2EEEnvelope = {
  version: 1;
  ephemeralPublicKey: E2EEPublicKey;
  salt: string;
  iv: string;
  ciphertext: string;
};
export type E2EEAttachmentMetadata = {
  position: number;
  name: string;
  mimeType: string;
  size: number;
  iv: string;
};
export type E2EEMessagePayload = {
  version: 1;
  contextId: string;
  iv: string;
  ciphertext: string;
};
export type E2EEDecryptedMessage = {
  content: string;
  attachments: E2EEAttachmentMetadata[];
  key: CryptoKey;
  contextId: string;
};

function randomBytes(length: number) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

function toArrayBuffer(bytes: Uint8Array) {
  return Uint8Array.from(bytes).buffer;
}

function encodeBytes(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

function decodeBytes(value: string) {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function assertPassphrase(passphrase: string) {
  if (passphrase.length < 14 || passphrase.length > 256) {
    throw new Error("PASSPHRASE_LENGTH");
  }
}

export async function fingerprintE2EEKey(publicKey: E2EEPublicKey) {
  const canonicalKey = JSON.stringify({
    kty: publicKey.kty,
    crv: publicKey.crv,
    x: publicKey.x,
    y: publicKey.y,
  });
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(canonicalKey)));
  return Array.from(digest.slice(0, 16), (byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .match(/.{1,4}/g)
    ?.join(" ") ?? "";
}

async function deriveBackupKey(passphrase: string, salt: Uint8Array) {
  const material = await crypto.subtle.importKey("raw", encoder.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: toArrayBuffer(salt), iterations: BACKUP_ITERATIONS },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function createE2EEIdentity(passphrase: string): Promise<{ identity: E2EEIdentity; backup: E2EEBackup }> {
  assertPassphrase(passphrase);
  const pair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  ) as CryptoKeyPair;
  const publicKey = await crypto.subtle.exportKey("jwk", pair.publicKey) as E2EEPublicKey;
  const privateJwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const backupKey = await deriveBackupKey(passphrase, salt);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    backupKey,
    encoder.encode(JSON.stringify(privateJwk)),
  );
  const privateKey = await crypto.subtle.importKey(
    "jwk",
    privateJwk,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    ["deriveBits"],
  );

  return {
    identity: { publicKey, privateKey },
    backup: { version: 1, salt: encodeBytes(salt), iv: encodeBytes(iv), ciphertext: encodeBytes(new Uint8Array(ciphertext)) },
  };
}

export async function unlockE2EEIdentity(publicKey: E2EEPublicKey, backup: E2EEBackup, passphrase: string): Promise<E2EEIdentity> {
  assertPassphrase(passphrase);
  if (backup.version !== 1) throw new Error("BACKUP_VERSION");
  const backupKey = await deriveBackupKey(passphrase, decodeBytes(backup.salt));
  const privateJwkBytes = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: decodeBytes(backup.iv) },
    backupKey,
    decodeBytes(backup.ciphertext),
  );
  const privateJwk = JSON.parse(decoder.decode(privateJwkBytes)) as JsonWebKey;
  if (
    privateJwk.kty !== publicKey.kty ||
    privateJwk.crv !== publicKey.crv ||
    privateJwk.x !== publicKey.x ||
    privateJwk.y !== publicKey.y ||
    typeof privateJwk.d !== "string"
  ) {
    throw new Error("E2EE_KEYPAIR_MISMATCH");
  }
  const privateKey = await crypto.subtle.importKey(
    "jwk",
    privateJwk,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    ["deriveBits"],
  );
  await crypto.subtle.importKey(
    "jwk",
    publicKey,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  return { publicKey, privateKey };
}

async function deriveEnvelopeKey(privateKey: CryptoKey, publicKey: CryptoKey, salt: Uint8Array, info: string) {
  const sharedSecret = await crypto.subtle.deriveBits({ name: "ECDH", public: publicKey }, privateKey, 256);
  const material = await crypto.subtle.importKey("raw", sharedSecret, "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: toArrayBuffer(salt), info: encoder.encode(info) },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function wrapMessageKey(
  messageKey: CryptoKey,
  recipient: E2EERecipient,
  conversationId: string,
  contextId: string,
): Promise<E2EEEnvelope> {
  if (!recipient.publicKey) throw new Error("RECIPIENT_E2EE_NOT_READY");
  const recipientKey = await crypto.subtle.importKey(
    "jwk",
    recipient.publicKey,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  const ephemeral = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  ) as CryptoKeyPair;
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const wrappingKey = await deriveEnvelopeKey(
    ephemeral.privateKey,
    recipientKey,
    salt,
    `lynoralink-e2ee-envelope-v1:${conversationId}:${contextId}:${recipient.userId}`,
  );
  const rawMessageKey = await crypto.subtle.exportKey("raw", messageKey);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: encoder.encode(`${conversationId}:${contextId}:${recipient.userId}`) },
    wrappingKey,
    rawMessageKey,
  );
  return {
    version: ENVELOPE_VERSION,
    ephemeralPublicKey: await crypto.subtle.exportKey("jwk", ephemeral.publicKey) as E2EEPublicKey,
    salt: encodeBytes(salt),
    iv: encodeBytes(iv),
    ciphertext: encodeBytes(new Uint8Array(ciphertext)),
  };
}

export async function encryptE2EEMessage(options: {
  conversationId: string;
  contextId: string;
  identity: E2EEIdentity;
  recipients: E2EERecipient[];
  content: string;
  attachments: File[];
}) {
  const { conversationId, contextId, identity, recipients } = options;
  if (!recipients.some((recipient) => recipient.publicKey
    && recipient.publicKey.x === identity.publicKey.x
    && recipient.publicKey.y === identity.publicKey.y)) {
    throw new Error("OWN_E2EE_KEY_MISSING");
  }
  if (recipients.some((recipient) => !recipient.publicKey)) throw new Error("RECIPIENT_E2EE_NOT_READY");

  const messageKey = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
  const encryptedFiles: File[] = [];
  const metadata: E2EEAttachmentMetadata[] = [];
  for (let position = 0; position < options.attachments.length; position += 1) {
    const file = options.attachments[position];
    const iv = randomBytes(12);
    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv, additionalData: encoder.encode(`${contextId}:attachment:${position}`) },
      messageKey,
      await file.arrayBuffer(),
    );
    encryptedFiles.push(new File([ciphertext], `encrypted-${position}.bin`, { type: "application/octet-stream" }));
    metadata.push({
      position,
      name: file.name,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      iv: encodeBytes(iv),
    });
  }

  const payload = {
    content: options.content,
    attachments: metadata,
  };
  const iv = randomBytes(12);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: encoder.encode(`lynoralink-e2ee-message-v1:${conversationId}:${contextId}`) },
    messageKey,
    encoder.encode(JSON.stringify(payload)),
  );

  const keyEnvelopes = Object.fromEntries(await Promise.all(recipients.map(async (recipient) => [
    recipient.userId,
    await wrapMessageKey(messageKey, recipient, conversationId, contextId),
  ] as const)));

  return {
    content: JSON.stringify({ version: ENVELOPE_VERSION, contextId, iv: encodeBytes(iv), ciphertext: encodeBytes(new Uint8Array(ciphertext)) } satisfies E2EEMessagePayload),
    keyEnvelopes,
    encryptedFiles,
  };
}

export async function decryptE2EEMessage(options: {
  conversationId: string;
  userId: string;
  identity: E2EEIdentity;
  content: string;
  keyEnvelopes: Record<string, E2EEEnvelope>;
}): Promise<E2EEDecryptedMessage> {
  const envelope = options.keyEnvelopes[options.userId];
  if (!envelope || envelope.version !== ENVELOPE_VERSION) throw new Error("MESSAGE_KEY_UNAVAILABLE");
  const payload = JSON.parse(options.content) as E2EEMessagePayload;
  if (payload.version !== ENVELOPE_VERSION || !payload.contextId) throw new Error("MESSAGE_CIPHERTEXT_INVALID");
  const ephemeralPublicKey = await crypto.subtle.importKey(
    "jwk",
    envelope.ephemeralPublicKey,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  const wrappingKey = await deriveEnvelopeKey(
    options.identity.privateKey,
    ephemeralPublicKey,
    decodeBytes(envelope.salt),
    `lynoralink-e2ee-envelope-v1:${options.conversationId}:${payload.contextId}:${options.userId}`,
  );
  const rawMessageKey = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: decodeBytes(envelope.iv), additionalData: encoder.encode(`${options.conversationId}:${payload.contextId}:${options.userId}`) },
    wrappingKey,
    decodeBytes(envelope.ciphertext),
  );
  const key = await crypto.subtle.importKey("raw", rawMessageKey, { name: "AES-GCM" }, false, ["decrypt"]);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: decodeBytes(payload.iv), additionalData: encoder.encode(`lynoralink-e2ee-message-v1:${options.conversationId}:${payload.contextId}`) },
    key,
    decodeBytes(payload.ciphertext),
  );
  const result = JSON.parse(decoder.decode(plaintext)) as { content: string; attachments: E2EEAttachmentMetadata[] };
  if (typeof result.content !== "string" || !Array.isArray(result.attachments)) throw new Error("MESSAGE_CIPHERTEXT_INVALID");
  return { content: result.content, attachments: result.attachments, key, contextId: payload.contextId };
}

export async function decryptE2EEAttachment(
  ciphertext: ArrayBuffer,
  metadata: E2EEAttachmentMetadata,
  decryptedMessage: E2EEDecryptedMessage,
) {
  return crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: decodeBytes(metadata.iv),
      additionalData: encoder.encode(`${decryptedMessage.contextId}:attachment:${metadata.position}`),
    },
    decryptedMessage.key,
    ciphertext,
  );
}
