# herdr-bobshell (installed plugin)

Agent state detection and session restore for IBM Bob Shell (`bob`, `bob2`),
reported into herdr as agent `bobshell`.

This directory is the **installed copy**. Full documentation, the installer,
the uninstaller, and the diagnostic script live in the source repo:

- `README.md` — install, sidebar config, troubleshooting, known gaps
- `docs/PROTOCOL.md` — the herdr socket API this daemon uses
- `doctor.sh` — diagnose a broken install

## Files here

| file | purpose |
|---|---|
| `bobshell-state.py` | the daemon: detects Bob panes, classifies state, reports to herdr, restores sessions |
| `herdr-plugin.toml` | plugin manifest; its `[[startup]]` entry launches the daemon with the herdr server |
| `test-rules.py` | runs the classifier over `fixtures/` |
| `fixtures/*.txt` | captured Bob screens, named `<expected-state>-<what>.txt` |

## Quick commands

```bash
python3 test-rules.py        # check the rules against every fixture
python3 bobshell-state.py    # run in foreground; takes over the running daemon

# capture a new fixture when Bob grows a screen the rules miss
herdr pane read <pane_id> --source detection > fixtures/blocked-file-write.txt
```

Logs: `~/.config/herdr/bobshell-state.log`.
Session records: `~/.local/state/herdr/bobshell-sessions.json`.

Editing files here works, but they are overwritten on the next `install.sh`.
Make changes in the source repo and re-run the installer.
