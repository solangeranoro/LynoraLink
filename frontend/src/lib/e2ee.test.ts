import assert from "node:assert/strict";
import test from "node:test";
import {
  createE2EEIdentity,
  decryptE2EEAttachment,
  decryptE2EEMessage,
  encryptE2EEMessage,
  unlockE2EEIdentity,
} from "./e2ee";

test("encrypts messages and attachments for conversation members only", async () => {
  const alice = await createE2EEIdentity("correct horse battery staple 2026");
  const bob = await createE2EEIdentity("another secure recovery phrase 2026");
  const file = new File(["private attachment content"], "private.txt", { type: "text/plain" });
  const encrypted = await encryptE2EEMessage({
    conversationId: "conversation-1",
    contextId: crypto.randomUUID(),
    identity: alice.identity,
    recipients: [
      { userId: "alice", publicKey: alice.identity.publicKey },
      { userId: "bob", publicKey: bob.identity.publicKey },
    ],
    content: "private message text",
    attachments: [file],
  });

  assert.equal(encrypted.content.includes("private message text"), false);
  assert.equal(encrypted.encryptedFiles[0].name, "encrypted-0.bin");
  assert.equal(await encrypted.encryptedFiles[0].text().then((value) => value.includes("private attachment content")), false);

  const restoredBob = await unlockE2EEIdentity(bob.identity.publicKey, bob.backup, "another secure recovery phrase 2026");
  const decrypted = await decryptE2EEMessage({
    conversationId: "conversation-1",
    userId: "bob",
    identity: restoredBob,
    content: encrypted.content,
    keyEnvelopes: encrypted.keyEnvelopes,
  });
  assert.equal(decrypted.content, "private message text");
  const attachmentBytes = await decryptE2EEAttachment(
    await encrypted.encryptedFiles[0].arrayBuffer(),
    decrypted.attachments[0],
    decrypted,
  );
  assert.equal(new TextDecoder().decode(attachmentBytes), "private attachment content");
});

test("rejects wrong recovery passphrases and ciphertext modified in transit", async () => {
  const identity = await createE2EEIdentity("a sufficiently long recovery phrase");
  const unrelatedIdentity = await createE2EEIdentity("another sufficiently long passphrase");
  await assert.rejects(
    unlockE2EEIdentity(identity.identity.publicKey, identity.backup, "not the recovery phrase"),
  );
  await assert.rejects(
    unlockE2EEIdentity(unrelatedIdentity.identity.publicKey, identity.backup, "a sufficiently long recovery phrase"),
  );
  const encrypted = await encryptE2EEMessage({
    conversationId: "conversation-2",
    contextId: crypto.randomUUID(),
    identity: identity.identity,
    recipients: [{ userId: "user-1", publicKey: identity.identity.publicKey }],
    content: "authenticated",
    attachments: [],
  });
  const payload = JSON.parse(encrypted.content) as { ciphertext: string };
  payload.ciphertext = `${payload.ciphertext.slice(0, -1)}A`;
  await assert.rejects(decryptE2EEMessage({
    conversationId: "conversation-2",
    userId: "user-1",
    identity: identity.identity,
    content: JSON.stringify(payload),
    keyEnvelopes: encrypted.keyEnvelopes,
  }));
});
