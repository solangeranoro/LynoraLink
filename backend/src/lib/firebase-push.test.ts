import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import test from "node:test";
import { FirebasePushConfigurationError, validateFirebasePushConfiguration } from "./firebase-push";

const originalServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

test.after(() => {
  if (originalServiceAccount === undefined) delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  else process.env.FIREBASE_SERVICE_ACCOUNT_JSON = originalServiceAccount;
});

test("accepts valid Firebase service-account credentials with escaped newlines", () => {
  const { privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });
  process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify({
    project_id: "lynoralink-test",
    client_email: "firebase-test@example.com",
    private_key: privateKey.replace(/\n/g, "\\n"),
  });

  assert.doesNotThrow(validateFirebasePushConfiguration);
});

test("reports missing or malformed Firebase service-account credentials", () => {
  delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  assert.throws(
    validateFirebasePushConfiguration,
    (error: unknown) => error instanceof FirebasePushConfigurationError && error.code === "not_configured",
  );

  process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify({
    project_id: "lynoralink-test",
    client_email: "firebase-test@example.com",
    private_key: "not-a-private-key",
  });
  assert.throws(
    validateFirebasePushConfiguration,
    (error: unknown) => error instanceof FirebasePushConfigurationError && error.code === "invalid_private_key",
  );
});
