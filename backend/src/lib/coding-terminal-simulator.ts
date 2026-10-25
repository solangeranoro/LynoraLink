import path from "node:path";

export type SimulatedWorkspaceEntry = {
  path: string;
  isDirectory: boolean;
  content: string;
};

export type SimulatedCommandResult = {
  output: string;
  cwd: string;
  exitCode: number;
};

function tokenize(command: string): string[] {
  const tokens: string[] = [];
  const pattern = /"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|(\S+)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(command)) !== null) {
    tokens.push((match[1] ?? match[2] ?? match[3]).replace(/\\(["'\\])/g, "$1"));
  }
  return tokens;
}

function safeCwd(cwd: string): string {
  const resolved = path.posix.normalize(cwd);
  return resolved === "/workspace" || resolved.startsWith("/workspace/")
    ? resolved
    : "/workspace";
}

function resolvePath(value: string, cwd: string): string | null {
  const resolved = path.posix.resolve(cwd, value || cwd);
  return resolved === "/workspace" || resolved.startsWith("/workspace/")
    ? resolved
    : null;
}

export async function runSimulatedTerminalCommand(
  command: string,
  cwd: string,
  entries: SimulatedWorkspaceEntry[],
  emit?: (output: string) => void,
): Promise<SimulatedCommandResult> {
  const currentCwd = safeCwd(cwd);
  const tokens = tokenize(command.trim());
  const [program, ...args] = tokens;
  if (!program) return { output: "", cwd: currentCwd, exitCode: 0 };

  const files = new Map(entries.map((entry) => [
    path.posix.join("/workspace", entry.path),
    entry,
  ]));
  const directories = new Set(["/workspace"]);
  for (const [filePath, entry] of files) {
    let parent = path.posix.dirname(filePath);
    while (parent === "/workspace" || parent.startsWith("/workspace/")) {
      directories.add(parent);
      if (parent === "/workspace") break;
      parent = path.posix.dirname(parent);
    }
    if (entry.isDirectory) directories.add(filePath);
  }

  if (program === "pwd") return { output: currentCwd, cwd: currentCwd, exitCode: 0 };
  if (program === "help") {
    return {
      output: [
        "Simulated terminal commands:",
        "  ls [-la] [path]   List workspace files",
        "  cd [path]         Change directory",
        "  echo [text]       Print text",
        "  cat <file>        Read a workspace file",
        "  pwd, git status, npm run dev, python <file>, clear",
      ].join("\r\n"),
      cwd: currentCwd,
      exitCode: 0,
    };
  }
  if (program === "clear") return { output: "\x1b[2J\x1b[H", cwd: currentCwd, exitCode: 0 };
  if (program === "cd") {
    const target = resolvePath(args[0] ?? "/workspace", currentCwd);
    if (!target) {
      return { output: "cd: path is outside the project workspace.", cwd: currentCwd, exitCode: 1 };
    }
    if (!directories.has(target)) {
      return { output: `cd: ${args[0] ?? "/workspace"}: no such directory`, cwd: currentCwd, exitCode: 1 };
    }
    return { output: "", cwd: target, exitCode: 0 };
  }
  if (program === "ls") {
    const targetArg = args.find((arg) => !arg.startsWith("-")) ?? ".";
    const target = resolvePath(targetArg, currentCwd);
    if (!target) return { output: `ls: ${targetArg}: path is outside the project workspace.`, cwd: currentCwd, exitCode: 1 };
    if (!directories.has(target)) {
      const entry = files.get(target);
      return entry && !entry.isDirectory
        ? { output: path.posix.basename(target), cwd: currentCwd, exitCode: 0 }
        : { output: `ls: cannot access '${targetArg}': No such file or directory`, cwd: currentCwd, exitCode: 2 };
    }
    const showHidden = args.some((arg) => arg.startsWith("-") && arg.includes("a"));
    const children = new Map<string, boolean>();
    for (const directory of directories) {
      if (directory === target || path.posix.dirname(directory) !== target) continue;
      children.set(path.posix.basename(directory), true);
    }
    for (const [filePath, entry] of files) {
      if (path.posix.dirname(filePath) !== target || entry.isDirectory) continue;
      children.set(path.posix.basename(filePath), false);
    }
    const names = [...children.entries()]
      .filter(([name]) => showHidden || !name.startsWith("."))
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, isDirectory]) => isDirectory ? `\x1b[34m${name}/\x1b[0m` : name);
    return { output: names.join("  "), cwd: currentCwd, exitCode: 0 };
  }
  if (program === "echo") {
    return { output: args.join(" "), cwd: currentCwd, exitCode: 0 };
  }
  if (program === "cat") {
    if (!args.length) return { output: "cat: missing file operand", cwd: currentCwd, exitCode: 1 };
    const output: string[] = [];
    for (const argument of args) {
      const target = resolvePath(argument, currentCwd);
      const entry = target ? files.get(target) : undefined;
      if (!target || !entry || entry.isDirectory) {
        output.push(`cat: ${argument}: No such file or directory`);
        continue;
      }
      output.push(entry.content);
    }
    const failed = output.some((line) => line.startsWith("cat: "));
    return { output: output.join("\r\n"), cwd: currentCwd, exitCode: failed ? 1 : 0 };
  }
  if (program === "git" && args[0] === "status") {
    return {
      output: "fatal: not a git repository (or any of the parent directories): .git",
      cwd: currentCwd,
      exitCode: 128,
    };
  }
  if (program === "npm" && args[0] === "run" && args[1] === "dev") {
    const logs = [
      "\x1b[33m[simulated] Starting development server...\x1b[0m",
      "\x1b[36m> lynora-workspace@1.0.0 dev\x1b[0m",
      "\x1b[32m✓ Ready in 1.2s\x1b[0m",
      "  Local: http://localhost:3000",
      "\x1b[90mSimulation only: no server process was started.\x1b[0m",
    ];
    if (emit) {
      for (const line of logs) {
        emit(`${line}\r\n`);
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      return { output: "", cwd: currentCwd, exitCode: 0 };
    }
    return { output: logs.join("\r\n"), cwd: currentCwd, exitCode: 0 };
  }
  if (program === "python" || program === "python3") {
    const script = args[0] ? resolvePath(args[0], currentCwd) : null;
    const entry = script ? files.get(script) : undefined;
    if (!entry || entry.isDirectory) {
      return { output: `python: can't open file '${args[0] ?? ""}': [Errno 2] No such file or directory`, cwd: currentCwd, exitCode: 2 };
    }
    if (/ZeroDivisionError|\/\s*0(?:\.0*)?(?:\D|$)/.test(entry.content)) {
      return {
        output: `Traceback (most recent call last):\r\n  File "${args[0]}", line 1, in <module>\r\n    result = 1 / 0\r\n             ~~^~~\r\nZeroDivisionError: division by zero`,
        cwd: currentCwd,
        exitCode: 1,
      };
    }
    return {
      output: `\x1b[33m[simulated] Python execution is limited to basic examples (${args[0]}).\x1b[0m`,
      cwd: currentCwd,
      exitCode: 0,
    };
  }
  if (program === "node" || program === "nodejs") {
    return {
      output: "\x1b[33m[simulated] Node.js programs are not executed in fallback mode.\x1b[0m",
      cwd: currentCwd,
      exitCode: 0,
    };
  }
  return {
    output: `\x1b[31m${program}: command not available in simulated mode. Type "help" for supported commands.\x1b[0m`,
    cwd: currentCwd,
    exitCode: 127,
  };
}

export function createSimulatedTerminal(
  cwd: string,
  entries: SimulatedWorkspaceEntry[],
  onOutput: (output: string) => void,
  onCwdChange: (cwd: string) => void,
): { write: (data: string) => void; get cwd(): string } {
  let currentCwd = safeCwd(cwd);
  let input = "";
  let runningCommand = false;

  const prompt = () => `\x1b[32mlynora@workspace\x1b[0m:\x1b[36m${currentCwd}\x1b[0m $ `;
  onOutput("\x1b[33m⚙ Docker API indisponible — mode simulé activé\x1b[0m\r\nType \"help\" to see supported commands.\r\n");
  onOutput(prompt());

  const runLine = async (line: string) => {
    runningCommand = true;
    const result = await runSimulatedTerminalCommand(line, currentCwd, entries, onOutput);
    currentCwd = result.cwd;
    onCwdChange(currentCwd);
    if (result.output) onOutput(`${result.output.replace(/\r?\n/g, "\r\n")}\r\n`);
    runningCommand = false;
    onOutput(prompt());
  };

  return {
    get cwd() {
      return currentCwd;
    },
    write(data) {
      for (const character of data) {
        if (character === "\u0003") {
          input = "";
          runningCommand = false;
          onOutput("^C\r\n");
          onOutput(prompt());
        } else if (character === "\u000c") {
          input = "";
          onOutput("\x1b[2J\x1b[H");
          onOutput(prompt());
        } else if (character === "\r" || character === "\n") {
          if (runningCommand) continue;
          const line = input;
          input = "";
          onOutput(`${line}\r\n`);
          void runLine(line);
        } else if (character === "\u007f" || character === "\b") {
          if (input.length) {
            input = input.slice(0, -1);
            onOutput("\b \b");
          }
        } else if (character >= " ") {
          input += character;
          onOutput(character);
        }
      }
    },
  };
}
