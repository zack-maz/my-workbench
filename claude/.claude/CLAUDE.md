# Global rules

## Working inside herdr

These apply only when `HERDR_ENV=1` — this Claude is running in a herdr pane.
Outside herdr, ignore this section.

**Subagents and background shells already get their own tab.** Hooks in
`~/.claude/hooks/herdr-agent-tab.py` open a `--no-focus` tab in the current
workspace for every Agent-tool subagent and every `run_in_background` shell,
render its work live, and close it when the task ends. Nothing to do.

**Heavyweight subtasks get a real agent in a real tab.** For a subtask that is
long-running or that the user may want to talk to directly — a full
implementation pass, a review of a large diff, anything expected to take more
than a few minutes — do not use the in-process Agent tool. Dispatch a real
`claude` in its own tab and drive it through herdr:

```bash
created=$(herdr tab create --workspace "$HERDR_WORKSPACE_ID" --no-focus --cwd "$PWD" --label "<short task name>")
pane=$(printf '%s' "$created" | jq -r .result.root_pane.pane_id)
sleep 1   # the new tab's shell needs a moment to reach its prompt
herdr agent start <name> --kind claude --pane "$pane"
herdr agent prompt <name> "<the task, self-contained>" --wait --timeout 900000
herdr agent read <name> --source recent-unwrapped --lines 200
```

- `<name>` must match `[a-z][a-z0-9_-]{0,31}` and be unique among live agents.
- Keep the user's focus where it is: always `--no-focus`.
- If `--wait` returns `blocked`, run `herdr agent get <name>` and
  `herdr agent read <name>` before deciding what to send.
- Close only tabs you created, and only when the user is done with them.
