import assert from "node:assert/strict";
import test from "node:test";
import { isCodingTerminalDockerUnavailable } from "./coding-terminal-docker";

test("recognizes Docker connection failures, including write EOF", () => {
  assert.equal(isCodingTerminalDockerUnavailable(new Error("write EOF")), true);
  assert.equal(isCodingTerminalDockerUnavailable(new Error("Cannot connect to the Docker daemon")), true);
  const missingDocker = Object.assign(new Error("spawn docker ENOENT"), { code: "ENOENT" });
  assert.equal(isCodingTerminalDockerUnavailable(missingDocker), true);
});

test("does not classify unrelated terminal errors as Docker downtime", () => {
  assert.equal(isCodingTerminalDockerUnavailable(new Error("Invalid workspace file path.")), false);
});
