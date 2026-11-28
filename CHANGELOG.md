# Changelog

## Unreleased

- Much lighter on the machine. Animation is now capped by what is on screen (60 fps for tricks, 30 while Claude works, 20 when idle, 15 asleep) instead of running at the display's refresh rate, which on a 165 Hz laptop made a working Clawdkin use about 60% of a CPU core. The bubble wiggle, sleeping z's and party colours moved from endless CSS animations onto the same capped loop, and sparkles no longer run their own animation loops. On Windows it also draws without the GPU process, which is cheaper for a window this small and doesn't wake a laptop's discrete GPU (`CLAWDKIN_GPU=1` turns it back on). Measured on Windows: working went from 60% to 10% of a core, waiting from 77% to 12%, idle from 13% to about 9%, and memory from about 250 MB to 120 MB.
- `dev/bench.ps1` measures CPU and memory per state on a separate test copy.
- Code sprint: its typing words no longer pile up.

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
