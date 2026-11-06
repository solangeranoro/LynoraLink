import assert from "node:assert/strict";
import test from "node:test";
import {
  createSimulatedTerminal,
  runSimulatedTerminalCommand,
  type SimulatedWorkspaceEntry,
} from "./coding-terminal-simulator";

const workspace: SimulatedWorkspaceEntry[] = [
  { path: "src", isDirectory: true, content: "" },
  { path: "src/main.py", isDirectory: false, content: "result = 1 / 0" },
  { path: "README.md", isDirectory: false, content: "hello workspace" },
];

test("simulates workspace navigation, listing, echo, and file reads", async () => {
  const listing = await runSimulatedTerminalCommand("ls -la", "/workspace", workspace);
  const changedDirectory = await runSimulatedTerminalCommand("cd src", "/workspace", workspace);
  const echoed = await runSimulatedTerminalCommand("echo hello", changedDirectory.cwd, workspace);
  const file = await runSimulatedTerminalCommand("cat main.py", changedDirectory.cwd, workspace);

  assert.match(listing.output, /README\.md/);
  assert.equal(changedDirectory.cwd, "/workspace/src");
  assert.equal(echoed.output, "hello");
  assert.equal(file.output, "result = 1 / 0");
});

test("returns helpful simulated npm and Python output without inventing a Git repository", async () => {
  const npm = await runSimulatedTerminalCommand("npm run dev", "/workspace", workspace);
  const python = await runSimulatedTerminalCommand("python src/main.py", "/workspace", workspace);
  const git = await runSimulatedTerminalCommand("git status", "/workspace", workspace);
  const unsupported = await runSimulatedTerminalCommand("rm -rf src", "/workspace", workspace);

  assert.match(npm.output, /Ready in/);
  assert.match(python.output, /ZeroDivisionError/);
  assert.match(git.output, /not a git repository/);
  assert.equal(git.exitCode, 128);
  assert.equal(unsupported.exitCode, 127);
});

test("keeps the interactive simulator inside the workspace and echoes terminal input", async () => {
  const output: string[] = [];
  let cwd = "/workspace";
  const terminal = createSimulatedTerminal(
    cwd,
    workspace,
    (value) => output.push(value),
    (nextCwd) => { cwd = nextCwd; },
  );

  terminal.write("cd src\r");
  await new Promise((resolve) => setImmediate(resolve));
  terminal.write("echo ready\r");
  await new Promise((resolve) => setImmediate(resolve));
  terminal.write("cd ../../outside\r");
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(cwd, "/workspace/src");
  assert.match(output.join(""), /Docker API indisponible/);
  assert.match(output.join(""), /ready/);
  assert.match(output.join(""), /outside the project workspace/);
});
