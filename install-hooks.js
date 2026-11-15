#!/usr/bin/env node
// Adds (or removes) Clawdkin's hooks in a Claude Code settings file. It merges with whatever is already
// there, leaves every other hook alone, can be run again safely, and backs the file up the first time.
//
//   node install-hooks.js                     every Claude Code session (~/.claude/settings.json)
//   node install-hooks.js --project <dir>     only sessions started in <dir> (<dir>/.claude/settings.local.json)
//   node install-hooks.js --settings <file>   a specific settings file
//   add --uninstall to remove them again.
const fs = require('fs');
const path = require('path');
const os = require('os');

const EVENTS = [
  'SessionStart', 'SessionEnd', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'PostToolUseFailure',
  'PermissionRequest', 'PermissionDenied', 'Notification', 'Elicitation', 'Stop', 'StopFailure',
  'SubagentStart', 'PreCompact',
];

function parseArgs(argv) {
  const o = { uninstall: false, target: null, quiet: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--uninstall') o.uninstall = true;
    else if (a === '--quiet') o.quiet = true;
    else if (a === '--global') o.target = null;
    else if (a === '--project') o.target = path.join(path.resolve(argv[++i] || '.'), '.claude', 'settings.local.json');
    else if (a === '--settings') o.target = path.resolve(argv[++i] || '');
    else if (a === '-h' || a === '--help') o.help = true;
    else throw new Error(`Unknown option: ${a}`);
  }
  o.target = o.target || path.join(os.homedir(), '.claude', 'settings.json');
  // a dotfiles setup may symlink settings.json: write through to the real file, keeping the link
  try { o.target = fs.realpathSync(o.target); } catch {}
  return o;
}

// Forward slashes work in every shell Claude Code may run hooks with (cmd, PowerShell, Git Bash, sh).
const slash = (p) => p.replace(/\\/g, '/');
function hookCommand() {
  // the absolute path of the Node running this script: Claude Code may not have node on its PATH
  return `"${slash(process.execPath)}" "${slash(path.join(__dirname, 'hook.js'))}"`;
}
// one of ours? (also matches an older install of this copy, wherever node lived)
function isOurs(cmd) {
  cmd = slash(String(cmd || ''));
  return cmd.includes(slash(path.join(__dirname, 'hook.js'))) || /clawdkin[^"]*\/hook\.js/i.test(cmd);
}

function apply(settings, uninstall) {
  settings = settings && typeof settings === 'object' ? settings : {};
  const hooks = settings.hooks && typeof settings.hooks === 'object' ? settings.hooks : {};
  // remove our old entries first, so running this twice never doubles them
  for (const ev of Object.keys(hooks)) {
    if (!Array.isArray(hooks[ev])) continue;
    hooks[ev] = hooks[ev]
      .map((g) => ({ ...g, hooks: (g.hooks || []).filter((h) => !isOurs(h.command)) }))
      .filter((g) => g.hooks.length);
    if (!hooks[ev].length) delete hooks[ev];
  }
  if (!uninstall) {
    const command = hookCommand();
    for (const ev of EVENTS) (hooks[ev] = hooks[ev] || []).push({ hooks: [{ type: 'command', command, async: true, timeout: 10 }] });
    // Quick reply: these two may wait for an answer from Clawdkin, so they are not async. They return
    // at once unless Quick reply is switched on in Clawdkin's settings and Clawdkin is running.
    const sync = { type: 'command', command: command + ' sync', timeout: 130 };
    hooks.PermissionRequest.push({ hooks: [sync] });
    hooks.PreToolUse.push({ matcher: 'AskUserQuestion', hooks: [sync] });
  }
  if (Object.keys(hooks).length) settings.hooks = hooks; else delete settings.hooks;
  return settings;
}

function run(argv) {
  const o = parseArgs(argv);
  if (o.help) { console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(1, 9).map((l) => l.replace(/^\/\/ ?/, '')).join('\n')); return 0; }
  let settings = {};
  if (fs.existsSync(o.target)) {
    const text = fs.readFileSync(o.target, 'utf8').replace(/^\uFEFF/, ''); // some editors add a BOM
    if (text.trim()) {
      try { settings = JSON.parse(text); } catch (e) {
        console.error(`Could not read ${o.target}: it is not valid JSON (${e.message}).\nFix or remove it, then run this again. Nothing was changed.`);
        return 1;
      }
    }
    const backup = o.target + '.clawdkin-backup';
    if (!fs.existsSync(backup)) fs.writeFileSync(backup, text);
  } else if (o.uninstall) {
    if (!o.quiet) console.log(`Nothing to remove: ${o.target} does not exist.`);
    return 0;
  }
  const out = apply(settings, o.uninstall);
  fs.mkdirSync(path.dirname(o.target), { recursive: true });
  const tmp = o.target + '.clawdkin-tmp';
  fs.writeFileSync(tmp, JSON.stringify(out, null, 2) + '\n');
  fs.renameSync(tmp, o.target);
  if (!o.quiet) {
    console.log(o.uninstall ? `Removed Clawdkin's hooks from ${o.target}\n(The copy saved before the first install is still at ${o.target}.clawdkin-backup.)` : `Installed Clawdkin's hooks in ${o.target}`);
    if (!o.uninstall) console.log('Claude Code picks them up in sessions started from now on.');
  }
  return 0;
}

if (require.main === module) {
  try { process.exitCode = run(process.argv.slice(2)); } catch (e) { console.error(e.message); process.exitCode = 1; }
}
module.exports = { apply, isOurs, hookCommand, EVENTS };
