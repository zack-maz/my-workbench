#!/usr/bin/env node
// herdr-bobshell — connect IBM Bob Shell to herdr.

// node:sqlite prints an ExperimentalWarning on some Node lines; this CLI's
// output is a terminal UI and Bob hook plumbing, so keep it quiet.
const emitWarning = process.emitWarning;
process.emitWarning = (warning, ...rest) => {
  const text = typeof warning === "string" ? warning : warning?.message;
  if (/SQLite/i.test(text || "")) return;
  return emitWarning.call(process, warning, ...rest);
};

const USAGE = `usage: herdr-bobshell <command>

  install            add Bob hooks, link the herdr plugin, start the daemon
  uninstall [--purge]  undo install (--purge also deletes state and logs)
  status             check every piece and list tracked panes and tabs

  daemon             run the sidebar + subagent-tab daemon (herdr starts this)
  hook               Bob hook entry point (reads hook JSON on stdin)
  mirror <id>        render a Bob subagent live (runs inside its tab)
`;

const [command, ...args] = process.argv.slice(2);

switch (command) {
  case "hook": {
    const { runHook } = await import("../src/hook.js");
    await runHook();
    process.exit(0);
  }
  case "daemon": {
    const { runDaemon } = await import("../src/daemon.js");
    await runDaemon();
    break;
  }
  case "mirror": {
    if (!args[0]) {
      console.error("usage: herdr-bobshell mirror <subagent-task-id>");
      process.exit(2);
    }
    const { runMirror } = await import("../src/mirror.js");
    await runMirror(args[0]);
    break;
  }
  case "install":
    await (await import("../src/install.js")).install();
    break;
  case "uninstall":
    await (await import("../src/install.js")).uninstall({ purge: args.includes("--purge") });
    break;
  case "status":
    await (await import("../src/install.js")).status();
    break;
  case "-h":
  case "--help":
  case undefined:
    process.stdout.write(USAGE);
    break;
  default:
    process.stderr.write(`unknown command: ${command}\n\n${USAGE}`);
    process.exit(2);
}
