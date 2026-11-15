#!/usr/bin/env node
// `npm run doctor`: checks that Clawdkin can work on this machine and says what to fix if not.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync, spawnSync } = require('child_process');
const P = require('./paths');
const { isOurs } = require('./install-hooks');

let problems = 0;
const ok = (msg) => console.log(`  ok    ${msg}`);
const warn = (msg, fix) => console.log(`  note  ${msg}${fix ? `\n        ${fix}` : ''}`);
const bad = (msg, fix) => { problems++; console.log(`  FAIL  ${msg}${fix ? `\n        -> ${fix}` : ''}`); };

console.log(`Clawdkin doctor (${process.platform}, Node ${process.version})\n`);

// Node
const [maj, min] = process.versions.node.split('.').map(Number);
if (maj > 22 || (maj === 22 && min >= 12)) ok(`Node ${process.version}`);
else bad(`Node ${process.version} is too old (Electron needs 22.12 or newer)`, 'Install the current LTS from https://nodejs.org, then run: npm run setup');

// Electron

// (checked by hand: require('electron') would start a 100 MB download if the binary is missing)
const eDir = path.join(__dirname, 'node_modules', 'electron');
if (!fs.existsSync(path.join(eDir, 'package.json'))) bad('Electron is not installed', 'Run: npm install');
else {
  let bin = '';
  try { bin = fs.readFileSync(path.join(eDir, 'path.txt'), 'utf8').trim(); } catch {}
  if (bin && fs.existsSync(path.join(eDir, 'dist', bin))) ok('Electron is installed');
  else warn('Electron will download itself (about 100 MB) the first time you run npm start');
}

// hooks
const settingsFile = path.join(os.homedir(), '.claude', 'settings.json');
let ours = [];
try {
  const s = JSON.parse(fs.readFileSync(settingsFile, 'utf8').replace(/^\uFEFF/, ''));
  for (const [ev, groups] of Object.entries(s.hooks || {})) for (const g of groups || []) for (const h of g.hooks || []) if (isOurs(h.command)) ours.push({ ev, cmd: h.command });
} catch (e) {
  if (e.code !== 'ENOENT') bad(`Could not read ${settingsFile} (${e.message})`, 'Fix the JSON in that file, then run: npm run setup');
}
if (ours.length) ok(`Hooks installed in ${settingsFile} (${new Set(ours.map((h) => h.ev)).size} events)`);
else warn(`No Clawdkin hooks in ${settingsFile}`, 'Run: npm run setup   (or `node install-hooks.js --project <dir>` for one project only)');

// do the installed hooks point at files that exist, and does the hook actually run?
if (ours.length) {
  const cmd = ours.find((h) => !/ sync$/.test(h.cmd)).cmd;
  const parts = [...cmd.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  const missing = parts.filter((p) => !fs.existsSync(p));
  if (missing.length) bad(`The hook command points at something that is gone: ${missing.join(', ')}`, 'Run: npm run setup   (this happens after moving the folder, or reinstalling or switching Node with nvm/fnm/volta)');
  else {
    const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'clawdkin-doctor-'));
    const r = spawnSync(cmd, {
      shell: true, input: JSON.stringify({ hook_event_name: 'SessionStart', session_id: 'doctor', cwd: process.cwd() }),
      env: { ...process.env, CLAWDKIN_HOME: tmpHome }, timeout: 15000, encoding: 'utf8',
    });
    const wrote = fs.existsSync(path.join(tmpHome, 'state', 'doctor.json'));
    if (r.status === 0 && wrote) ok('The hook runs and writes state');
    else bad(`The hook did not run cleanly (exit ${r.status}${r.error ? ', ' + r.error.message : ''})`, String(r.stderr || '').trim().split('\n').slice(-3).join(' ') || 'Run: npm run setup');
    fs.rmSync(tmpHome, { recursive: true, force: true });
  }
}

// data folder
try {
  fs.mkdirSync(P.HOME, { recursive: true });
  const probe = path.join(P.HOME, '.doctor-probe');
  fs.writeFileSync(probe, 'x'); fs.unlinkSync(probe);
  ok(`Data folder is writable: ${P.HOME}`);
} catch (e) { bad(`Cannot write to ${P.HOME} (${e.code || e.message})`, 'Check its permissions, or set CLAWDKIN_HOME to a folder you can write to'); }

// has Claude Code talked to it?
let latest = 0;
try { for (const f of fs.readdirSync(P.STATE)) if (f.endsWith('.json')) latest = Math.max(latest, fs.statSync(path.join(P.STATE, f)).mtimeMs); } catch {}
if (latest) ok(`Last Claude Code event: ${Math.round((Date.now() - latest) / 60000)} min ago`);
else if (ours.length) warn('No Claude Code events seen yet', 'Start a new Claude Code session (hooks only load in sessions started after setup)');

// is it running?
let alive = null;
try { alive = JSON.parse(fs.readFileSync(P.ALIVE, 'utf8')); } catch {}
if (alive && Date.now() - alive.ts < 6000) ok('Clawdkin is running');
else warn('Clawdkin is not running right now', 'Start it with: npm start');

// platform notes
if (process.platform === 'win32') {
  try {
    const id = execSync('powershell -NoProfile -Command "(Get-StartApps | Where-Object { $_.Name -eq \'Claude\' } | Select-Object -First 1).AppID"', { encoding: 'utf8', timeout: 20000, windowsHide: true }).trim();
    if (id) ok('Found the Claude desktop app (clicking Clawdkin opens it)');
    else warn('Claude desktop app not found', 'Clicking Clawdkin will open claude.ai in your browser instead');
  } catch { warn('Could not look for the Claude desktop app', 'Clicking Clawdkin may open claude.ai instead'); }
} else {
  warn(`Taskbar tricks and perching are Windows-only; everything else works on ${process.platform === 'darwin' ? 'macOS' : 'Linux'}`);
}

console.log(problems ? `\n${problems} problem${problems > 1 ? 's' : ''} found.` : '\nAll good.');
process.exitCode = problems ? 1 : 0;
