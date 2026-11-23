# Changelog

## 0.1.2

- Right-click now opens one card instead of a plain menu. Its Home tab shows what Claude is doing, an Open Claude button (and Answer when Claude is waiting on you), and tiles for a trick, catch, the diary, a new form, a taskbar trick and hiding for 30 minutes. Corner moves and state previews moved to More. Keys 1 to 5 switch tabs.
- Six new tricks: Celebrate (confetti, ta-da), Think it over, Moonwalk, Bounce bounce, Send some love and Code sprint.
- New `docs/party.gif`, and a `menu` self-check (`CLAWDKIN_DEBUG=menu`).
- Fixed the Start with Windows switch drawing twice.

## 0.1.1

- Errors from the app and its windows are written to `~/.clawdkin/errors.log` (capped), and `npm run doctor` shows recent ones.
- A Clawdkin with its own `CLAWDKIN_HOME` gets its own Electron profile, so tests and self-checks can run beside your everyday one.
- Removed leftover code from earlier versions.

## 0.1.0

First public release.

- Mirrors Claude Code's state (idle, working, waiting for you, done, napping) through Claude Code hooks, with a thought cloud on hover that says what Claude is doing and on which task.
- Nine forms that evolve over time, five of them earned by using Claude.
- Tricks, petting, throwing, feeding files, a catch game, a diary, hats, colours and moods.
- Taskbar tricks on Windows, including two that press Start and the hidden-icons tray (only when you are away, and they always close what they open).
- Quick reply (experimental, off by default): answer permission requests and questions from Clawdkin.
- `npm run setup`, `npm run doctor` and `npm run uninstall-hooks`; data lives in `~/.clawdkin`.
