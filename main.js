// Clawdkin — main process.
// A tiny always-on-top transparent window that shows a Claude motif and mirrors what Claude Code
// sessions are doing (~/.clawdkin/state, written by hook.js). It also keeps Clawdkin's memory, lets it
// wander, be thrown and fed, and hosts the settings, diary and quick-reply windows.
const { app, BrowserWindow, ipcMain, screen, shell, Menu, clipboard, powerMonitor } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn, execFile } = require('child_process');

const P = require('./paths');
const ROOT = __dirname;                 // the app's own files
const STATE_DIR = P.STATE;              // everything it writes lives in ~/.clawdkin
const REQ_DIR = P.REQUESTS;
const CONFIG_FILE = P.CONFIG;
const MEM_FILE = P.MEMORY;
const LOG_FILE = P.LOG;
const LOG_TMP = path.join(P.HOME, 'events.processing');
const IS_WIN = process.platform === 'win32', IS_MAC = process.platform === 'darwin';
const DEBUG = process.env.CLAWDKIN_DEBUG || '';
const TRACE = (...a) => { if (process.env.CLAWDKIN_TRACE) try { fs.appendFileSync(path.join(P.HOME, 'trace.log'), Date.now() + ' ' + a.join(' ') + '\n'); } catch {} };

fs.mkdirSync(P.HOME, { recursive: true });
// A separate data folder (CLAWDKIN_HOME) is a separate Clawdkin: give it its own Electron profile, which also
// gives it its own single-instance lock (tests and self-checks can run beside your everyday Clawdkin).
if (process.env.CLAWDKIN_HOME) app.setPath('userData', path.join(P.HOME, 'electron'));
// Errors go to ~/.clawdkin/errors.log (capped), so a bug report can include them; `npm run doctor` shows recent ones.
function logError(where, msg) {
  const line = `${new Date().toISOString()} [${where}] ${String(msg).replace(/\s+/g, ' ').slice(0, 600)}\n`;
  if (DEBUG) process.stdout.write('[clawdkin] ERROR ' + line);
  try { if ((fs.statSync(P.ERRORS, { throwIfNoEntry: false })?.size || 0) > 200e3) fs.renameSync(P.ERRORS, P.ERRORS + '.old'); fs.appendFileSync(P.ERRORS, line); } catch {}
}
process.on('uncaughtException', (e) => logError('main', e && e.stack || e));
process.on('unhandledRejection', (e) => logError('main', e && e.stack || e));
if (process.platform === 'linux') app.commandLine.appendSwitch('enable-transparent-visuals'); // transparent windows on Linux

const BASE_W = 150, BASE_H = 170, GROUND_Y = 164, CENTER_Y = 112; // window size, and where the feet / middle sit inside it (viewBox units)
let groundDrop = 12; // how far the renderer lowered the body so its feet touch the ground (viewBox units; updated by the renderer)
const MIN_SCALE = 0.5, MAX_SCALE = 2;

const BASE_FORMS = ['spark', 'glyph', 'doodle', 'clawd'];
const FORMS = [
  ['spark', 'Spark'], ['glyph', 'Glyph  (the ✻ spinner)'], ['doodle', 'Doodle'], ['clawd', 'Clawd'],
  ['prompt', 'Prompt'], ['origami', 'Origami'], ['blocks', 'Blocky'], ['glass', 'Stained glass'], ['moon', 'Night'],
];
const ANTICS = [
  ['spin', 'Spin till dizzy'], ['flip', 'Backflip'], ['peek', 'Hide and peek'], ['stretch', 'Big stretch'],
  ['shake', 'Wet-dog shake'], ['juggle', 'Juggle'], ['sneeze', 'Sneeze'], ['roll', 'Roll around'],
  ['wave', 'Wave hello'], ['sing', 'Sing a little'], ['hiccup', 'Hiccups'],
];
const THEMES = [['terracotta', 'Terracotta'], ['ember', 'Ember'], ['sand', 'Sand'], ['ivory', 'Ivory'], ['charcoal', 'Charcoal'], ['lavender', 'Lavender'], ['party', 'Party (shifts colour)']];
const HATS = [['auto', 'Seasonal'], ['none', 'None'], ['party', 'Party hat'], ['top', 'Top hat'], ['beanie', 'Beanie'], ['crown', 'Crown'], ['cap', 'Propeller cap'], ['santa', 'Santa hat']];
const ROAMS = [['off', 'Stay put'], ['wander', 'Wander along the taskbar'], ['perch', 'Perch on the active window']].filter(([k]) => IS_WIN || k !== 'perch');
const SILLY = ['Calm (no tricks)', 'A little silly', 'Silly', 'Chaotic'];

const DEFAULTS = {
  scale: 1, opacity: 1,
  form: 'auto', currentForm: 'spark', evolveMinutes: 15, unlockAll: false,
  silliness: 2, theme: 'terracotta', hat: 'auto', birthday: '',
  followMouse: true, sleep: true, sleepMinutes: 8, showLabel: true,
  sfx: true, volume: 0.4,
  roam: 'wander', taskbarTricks: true, pokeUI: true, reactCopy: true, showProps: true, showTrail: true,
  quickReply: false, quickReplyWait: 20,
  bestCatch: 0,
};

const WORKING_TTL = 12 * 60 * 1000;
const WAITING_TTL = 3 * 60 * 60 * 1000;
const DONE_TTL = 3500;
const PRUNE_AGE = 24 * 60 * 60 * 1000;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);
const readJson = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };

let win = null, settingsWin = null, diaryWin = null, replyWin = null;
let cfg = loadConfig();
let preview = null;
let lastSent = '';
let hiddenUntil = 0;
let current = { state: 'idle' }; // last computed state
let debugAsk = null;
const START = Date.now();


function loadConfig() {
  const c = readJson(CONFIG_FILE) || {};
  if (c.size) { c.scale = { small: 0.75, medium: 1, large: 1.3 }[c.size] || 1; delete c.size; }
  delete c.sound; delete c.nightLamp;
  if (!IS_WIN && c.roam === 'perch') c.roam = 'wander';
  return { ...DEFAULTS, ...c };
}
let saveTimer = null;
function saveConfig() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { try { fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2)); } catch {} }, 200);
}

function scale() { return clamp(+cfg.scale || 1, MIN_SCALE, MAX_SCALE); }
function winSize(s = scale()) { return { width: Math.round(BASE_W * s), height: Math.round(BASE_H * s) }; }
function workAreaOf(b) { return screen.getDisplayMatching(b).workArea; }

function cornerPos(corner, display) {
  const wa = (display || screen.getPrimaryDisplay()).workArea;
  const { width, height } = winSize();
  const right = wa.x + wa.width - width, bottom = wa.y + wa.height - height;
  switch (corner) {
    case 'top-left': return { x: wa.x, y: wa.y };
    case 'top-right': return { x: right, y: wa.y };
    case 'bottom-left': return { x: wa.x, y: bottom };
    default: return { x: right, y: bottom };
  }
}
function validPos(x, y) {
  const { width, height } = winSize();
  return screen.getAllDisplays().some(d => {
    const wa = d.workArea;
    return x + width / 2 >= wa.x && x + width / 2 <= wa.x + wa.width && y + height / 2 >= wa.y && y + height / 2 <= wa.y + wa.height;
  });
}
function send(w, ch, data) { if (w && !w.isDestroyed()) w.webContents.send(ch, data); }
function broadcastConfig() { for (const w of [win, settingsWin, diaryWin]) send(w, 'config', cfg); }
function trigger(tr) { send(win, 'trigger', tr); }
function moveWin(x, y) { const { width, height } = winSize(); win.setBounds({ x: Math.round(x), y: Math.round(y), width, height }); }

function createWindow() {
  const { width, height } = winSize();
  const pos = (typeof cfg.x === 'number' && validPos(cfg.x, cfg.y)) ? { x: cfg.x, y: cfg.y } : cornerPos('bottom-right');
  win = new BrowserWindow({
    width, height, x: pos.x, y: pos.y,
    frame: false, transparent: true, backgroundColor: '#00000000',
    resizable: false, maximizable: false, minimizable: false, fullscreenable: false,
    alwaysOnTop: true, skipTaskbar: true, hasShadow: false,
    focusable: false, show: false,
    webPreferences: { preload: path.join(ROOT, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false },
  });
  win.setAlwaysOnTop(true, 'screen-saver');
  if (!IS_WIN) win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: false });
  win.setIgnoreMouseEvents(true, { forward: true });
  win.loadFile(path.join(ROOT, 'renderer', 'index.html'));
  win.webContents.on('did-finish-load', () => {
    win.webContents.setZoomFactor(scale());
    win.webContents.setVisualZoomLevelLimits(1, 1);
    lastSent = '';
    pushState();
    broadcastConfig();
    win.showInactive();
    // a new transparent window can come out a few pixels too big on scaled displays; setting it again is exact
    moveWin(pos.x, pos.y);
    if (DEBUG) debugSelfCheck();
  });
  setInterval(() => { if (win && !win.isDestroyed() && win.isVisible()) win.setAlwaysOnTop(true, 'screen-saver'); }, 30000);
}

// ---------- config ----------

function setConfig(partial) {
  const prev = { ...cfg };
  for (const [k, v] of Object.entries(partial || {})) if (k in DEFAULTS || k === 'claudeAppId') cfg[k] = v;
  cfg.scale = clamp(+cfg.scale || 1, MIN_SCALE, MAX_SCALE);
  cfg.opacity = clamp(+cfg.opacity || 1, 0.3, 1);
  cfg.volume = clamp(+cfg.volume || 0, 0, 1);
  cfg.silliness = clamp(Math.round(+cfg.silliness), 0, 3);
  cfg.evolveMinutes = clamp(+cfg.evolveMinutes || 15, 1, 120);
  cfg.sleepMinutes = clamp(+cfg.sleepMinutes || 8, 1, 60);
  cfg.quickReplyWait = clamp(Math.round(+cfg.quickReplyWait || 20), 5, 120);
  if (!/^\d\d-\d\d$/.test(cfg.birthday || '')) cfg.birthday = '';
  if (cfg.scale !== prev.scale) applyScale(prev.scale);
  if (cfg.roam !== prev.roam) { stopRoam(true); if (cfg.roam === 'perch') startFgHelper(); else stopFgHelper(); }
  saveConfig();
  broadcastConfig();
  if (cfg.unlockAll !== prev.unlockAll) { lastSent = ''; pushState(); }
}

function applyScale(prevScale) {
  if (!win) return;
  stopRoam(false);
  const b = { ...win.getBounds(), ...winSize(prevScale) };
  const wa = workAreaOf(b);
  const { width, height } = winSize();
  const hugR = Math.abs(wa.x + wa.width - (b.x + b.width)) < 10, hugB = Math.abs(wa.y + wa.height - (b.y + b.height)) < 10;
  const hugL = Math.abs(b.x - wa.x) < 10, hugT = Math.abs(b.y - wa.y) < 10;
  let x = hugR ? wa.x + wa.width - width : hugL ? wa.x : Math.round(b.x + b.width / 2 - width / 2);
  let y = hugB ? wa.y + wa.height - height : hugT ? wa.y : Math.round(b.y + b.height / 2 - height / 2);
  x = clamp(x, wa.x, wa.x + wa.width - width);
  y = clamp(y, wa.y, wa.y + wa.height - height);
  win.setBounds({ x, y, width, height });
  win.webContents.setZoomFactor(scale());
  cfg.x = x; cfg.y = y;
}

// ---------- memory: what the buddy has lived through ----------

function toolCat(name) {
  name = String(name || '');
  if (/^(Read|Grep|Glob|LS|ToolSearch|NotebookRead)$/.test(name)) return 'search';
  if (/^(Edit|Write|NotebookEdit|MultiEdit)$/.test(name)) return 'edit';
  if (/^(Bash|PowerShell|BashOutput|KillShell|Monitor)$/.test(name)) return 'run';
  if (/^(WebFetch|WebSearch)$/.test(name) || /browser|chrome|navigate/i.test(name)) return 'web';
  if (/^(Agent|Task)$/.test(name)) return 'agent';
  if (/^mcp__/.test(name)) return 'mcp';
  return 'other';
}
const dayKey = (ts) => { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

let mem = { toolCalls: 0, turns: 0, failures: 0, pets: 0, fed: 0, projects: {}, days: {}, unlocked: [], lastSeen: 0, nightOwl: false, lastMorning: '', ...(readJson(MEM_FILE) || {}) };
let dusty = !!mem.lastSeen && Date.now() - mem.lastSeen > 3 * 24 * 3600 * 1000;
const recent = [];
const turnStarts = {};
let memTimer = null;
function saveMem() { clearTimeout(memTimer); memTimer = setTimeout(() => { try { fs.writeFileSync(MEM_FILE, JSON.stringify(mem)); } catch {} }, 500); }

const UNLOCKS = {
  prompt:  { test: (m) => m.toolCalls >= 30, prog: (m) => `${Math.min(m.toolCalls, 30)}/30 tool calls` },
  origami: { test: (m) => m.turns >= 5, prog: (m) => `${Math.min(m.turns, 5)}/5 finished tasks` },
  blocks:  { test: (m) => Object.keys(m.projects).length >= 3, prog: (m) => `${Math.min(Object.keys(m.projects).length, 3)}/3 different projects` },
  glass:   { test: (m) => Object.keys(m.days).length >= 3, prog: (m) => `${Math.min(Object.keys(m.days).length, 3)}/3 days together` },
  moon:    { test: (m) => m.nightOwl, prog: () => 'work with Claude after 10pm' },
};
const unlockedForms = () => [...BASE_FORMS, ...mem.unlocked.filter((f) => UNLOCKS[f])];
const formAvailable = (f) => cfg.unlockAll || unlockedForms().includes(f);
const unlockQueue = [];
function checkUnlocks(live) {
  for (const f of Object.keys(UNLOCKS)) {
    if (!mem.unlocked.includes(f) && UNLOCKS[f].test(mem)) { mem.unlocked.push(f); if (live) unlockQueue.push(f); }
  }
}
setInterval(() => {
  if (unlockQueue.length && current.state !== 'waiting' && win && win.isVisible()) {
    const f = unlockQueue.shift();
    lastSent = ''; pushState();
    trigger({ type: 'unlock', form: f });
  }
}, 7000);

function ingest(e, live) {
  if (!e || !e.ts) return;
  const key = dayKey(e.ts);
  const day = mem.days[key] || (mem.days[key] = { turns: 0, prompts: 0, tools: {}, fails: 0, projects: {}, longestMs: 0 });
  mem.lastSeen = Math.max(mem.lastSeen, e.ts);
  if (e.project) { mem.projects[e.project] = (mem.projects[e.project] || 0) + 1; day.projects[e.project] = (day.projects[e.project] || 0) + 1; }
  const hr = new Date(e.ts).getHours();
  if (hr >= 22 || hr < 5) mem.nightOwl = true;
  if (e.ev === 'UserPromptSubmit') { day.prompts++; turnStarts[e.sid] = e.ts; }
  if (e.ev === 'PostToolUse' || e.ev === 'PostToolUseFailure') { mem.toolCalls++; const c = toolCat(e.tool); day.tools[c] = (day.tools[c] || 0) + 1; }
  if (e.fail) { mem.failures++; day.fails++; }
  if (e.ev === 'Stop') {
    mem.turns++; day.turns++;
    if (turnStarts[e.sid]) { day.longestMs = Math.max(day.longestMs, e.ts - turnStarts[e.sid]); delete turnStarts[e.sid]; }
  }
  recent.push({ ts: e.ts, ev: e.ev, fail: !!e.fail });
  if (live) {
    if (dusty) { dusty = false; trigger({ type: 'antic', name: 'dustoff', byUser: false }); }
    if (hr >= 5 && hr < 11 && mem.lastMorning !== key) { mem.lastMorning = key; setTimeout(() => trigger({ type: 'antic', name: 'morning', byUser: false }), 1500); }
  }
}
function pumpLog() {
  try {
    if (!fs.existsSync(LOG_TMP)) { if (!fs.existsSync(LOG_FILE)) return; fs.renameSync(LOG_FILE, LOG_TMP); }
    const lines = fs.readFileSync(LOG_TMP, 'utf8').split('\n');
    fs.unlinkSync(LOG_TMP);
    for (const ln of lines) { if (!ln.trim()) continue; let e = null; try { e = JSON.parse(ln); } catch {} if (e) ingest(e, e.ts > START - 5000); }
    while (recent.length && Date.now() - recent[0].ts > 3600 * 1000) recent.shift();
    const keys = Object.keys(mem.days).sort();
    while (keys.length > 60) delete mem.days[keys.shift()];
    checkUnlocks(true);
    saveMem();
    send(diaryWin, 'diary', diaryData());
  } catch {}
}
function mood() {
  if (dusty) return 'dusty';
  const now = Date.now();
  const fails = recent.filter((r) => r.fail && now - r.ts < 10 * 60000).length;
  const stops = recent.filter((r) => r.ev === 'Stop' && now - r.ts < 20 * 60000).length;
  if (fails >= 3) return 'frazzled';
  if (stops >= 3 && fails === 0) return 'proud';
  return 'content';
}
function diaryData() {
  const key = dayKey(Date.now());
  return {
    date: key, today: mem.days[key] || { turns: 0, prompts: 0, tools: {}, fails: 0, projects: {}, longestMs: 0 },
    totals: { toolCalls: mem.toolCalls, turns: mem.turns, failures: mem.failures, pets: mem.pets, fed: mem.fed, days: Object.keys(mem.days).length },
    projects: Object.entries(mem.projects).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([n]) => n),
    forms: FORMS.map(([k, l]) => ({ key: k, label: l.split('  ')[0], unlocked: unlockedForms().includes(k), progress: UNLOCKS[k] ? UNLOCKS[k].prog(mem) : '' })),
    mood: mood(), bestCatch: cfg.bestCatch, theme: cfg.theme,
  };
}

// ---------- Claude state ----------

function readSessions() {
  let files = [];
  let all = [];
  try { all = fs.readdirSync(STATE_DIR); } catch { return []; }
  files = all.filter(f => f.endsWith('.json'));
  const now = Date.now();
  for (const f of all) if (f.endsWith('.tmp')) { try { const p = path.join(STATE_DIR, f); if (now - fs.statSync(p).mtimeMs > 60000) fs.unlinkSync(p); } catch {} }
  const out = [];
  for (const f of files) {
    const p = path.join(STATE_DIR, f);
    const s = readJson(p);
    if (!s) continue;
    const age = now - (s.ts || 0);
    if (age > PRUNE_AGE) { try { fs.unlinkSync(p); } catch {} continue; }
    let eff = 'idle';
    if (s.state === 'waiting' && age < WAITING_TTL) eff = 'waiting';
    else if (s.state === 'working' && age < WORKING_TTL) eff = 'working';
    else if (s.state === 'done' && age < DONE_TTL) eff = 'done';
    out.push({ ...s, sid: f.slice(0, -5), eff, age });
  }
  return out;
}
const PRIORITY = { waiting: 3, working: 2, done: 1, idle: 0 };

function computeState() {
  const sessions = readSessions();
  let top = 'idle';
  for (const s of sessions) if (PRIORITY[s.eff] > PRIORITY[top]) top = s.eff;
  const focus = sessions.filter(s => s.eff === top).sort((a, b) => b.ts - a.ts)[0];
  let label = 'Idle — click to open Claude', detail = '', ask = null;
  if (focus) {
    const proj = focus.project || 'Claude';
    detail = focus.detail || '';
    if (top === 'waiting') {
      label = detail === 'question' ? `${proj} has a question for you` : detail === 'plan' ? `${proj}: plan ready for review` : `${proj} needs your OK`;
      if (focus.ask) ask = { ...focus.ask, project: proj, sid: focus.sid };
    } else if (top === 'working') {
      const n = sessions.filter(s => s.eff === 'working').length;
      label = `Working on ${proj}` + (n > 1 ? ` (+${n - 1} more)` : '');
    } else if (top === 'done') label = `${proj} is done`;
  }
  if (debugAsk) ask = debugAsk;
  const lastFail = sessions.reduce((a, s) => ((s.failTs || 0) > (a.failTs || 0) ? s : a), {});
  return {
    state: top, detail, label, ask,
    hasAsk: !!ask && (ask.kind !== 'question' || (ask.questions || []).length > 0),
    tool: top === 'working' && focus ? focus.detail : '',
    task: focus ? focus.task || '' : '', target: focus ? focus.target || '' : '', project: focus ? focus.project || '' : '',
    others: Math.max(0, sessions.filter((s) => s.eff === 'working' || s.eff === 'waiting').length - 1),
    edits: focus && (top === 'working' || top === 'waiting' || top === 'done') ? focus.edits || 0 : 0,
    turnStart: focus ? focus.turnStart || 0 : 0,
    failTs: lastFail.failTs || 0, failKind: lastFail.failKind || '',
    mood: mood(), unlocked: unlockedForms(),
    sessions: sessions.map(s => ({ project: s.project, state: s.eff, detail: s.detail })),
  };
}

function pushState() {
  if (!win || win.isDestroyed()) return;
  let st = computeState();
  current = st;
  if (hiddenUntil && (Date.now() > hiddenUntil || st.state === 'waiting')) { hiddenUntil = 0; win.showInactive(); }
  if (preview) {
    if (Date.now() < preview.until) st = { ...st, ...preview.st, label: `Preview: ${preview.st.state}` };
    else preview = null;
  }
  if (replyWin && !DEBUG && (st.state !== 'waiting' || (replyWin.reqId && !fs.existsSync(reqFile(replyWin.reqId))))) replyWin.close();
  const { ask, ...slim } = st;
  const key = JSON.stringify(slim);
  if (key === lastSent) return;
  lastSent = key;
  send(win, 'state', slim);
  if (st.state !== 'idle') stopRoam(true);
}

function watchState() {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  try { for (const f of fs.readdirSync(REQ_DIR)) { const p = path.join(REQ_DIR, f); if (Date.now() - fs.statSync(p).mtimeMs > 3 * 60000) fs.unlinkSync(p); } } catch {}
  let t = null;
  try { fs.watch(STATE_DIR, () => { clearTimeout(t); t = setTimeout(pushState, 40); }); } catch {}
  setInterval(pushState, 1000);
  setInterval(pumpLog, 1500);
  const alive = () => { try { fs.writeFileSync(path.join(STATE_DIR, '.alive'), JSON.stringify({ ts: Date.now(), pid: process.pid })); } catch {} };
  alive(); setInterval(alive, 2000);
  pumpLog();
}

// ---------- the mouse: eyes follow it, and the window wakes up under it ----------

let gameUntil = 0;
function watchCursor() {
  let lx = null, ly = null, inside = false;
  const tick = () => {
    setTimeout(tick, Date.now() < gameUntil ? 30 : 80);
    if (!win || win.isDestroyed() || !win.isVisible() || drag) return;
    const p = screen.getCursorScreenPoint();
    if (p.x === lx && p.y === ly) return;
    lx = p.x; ly = p.y;
    if (tb.onCursor(p)) startleTrick();
    const b = win.getBounds(), s = scale();
    const dx = (p.x - (b.x + 75 * s)) / s, dy = (p.y - (b.y + (CENTER_Y + groundDrop) * s)) / s;
    // Make the window catch the mouse as soon as the cursor is over the buddy. (A click-through
    // window can't see a file being dragged onto it, so this is what makes feeding work.)
    const now = dx * dx + dy * dy < 50 * 50 || (Math.abs(dx) < 22 && dy > -96 && dy < -62 && current.state === 'waiting');
    if (now !== inside) { TRACE('cursor-inside', now, p.x, p.y, JSON.stringify(b)); inside = now; win.setIgnoreMouseEvents(!now, { forward: true }); }
    if (cfg.followMouse || Date.now() < gameUntil) send(win, 'cursor', { dx, dy });
  };
  tick();
}

// ---------- opening the Claude app ----------

function resolveAppId() {
  if (!IS_WIN) return;
  execFile('powershell.exe', ['-NoProfile', '-Command', "(Get-StartApps | Where-Object { $_.Name -eq 'Claude' } | Select-Object -First 1).AppID"],
    { windowsHide: true, timeout: 15000 }, (err, stdout) => {
      const id = String(stdout || '').trim();
      if (!err && id && id !== cfg.claudeAppId) { cfg.claudeAppId = id; saveConfig(); }
    });
}
// The Claude desktop app if it is installed, otherwise claude.ai in the browser.
const WEB = 'https://claude.ai/';
function openClaude() {
  if (DEBUG) { console.log('[clawdkin] open-claude', cfg.claudeAppId || '(web)'); return; }
  const web = () => shell.openExternal(WEB).catch(() => {});
  try {
    if (IS_WIN && cfg.claudeAppId) {
      const child = spawn('explorer.exe', [`shell:AppsFolder\\${cfg.claudeAppId}`], { detached: true, stdio: 'ignore', windowsHide: true });
      child.on('error', web);
      child.unref();
    } else if (IS_MAC) {
      execFile('open', ['-a', 'Claude'], (err) => { if (err) web(); });
    } else web();
  } catch { web(); }
}

// ---------- dragging and throwing ----------

let drag = null, phys = null;
function startDrag() {
  if (!win || drag) return;
  stopRoam(false); stopPhysics();
  const c = screen.getCursorScreenPoint();
  const [x, y] = win.getPosition();
  drag = { cx: c.x, cy: c.y, x, y, samples: [] };
  drag.timer = setInterval(() => {
    const p = screen.getCursorScreenPoint();
    drag.samples.push({ t: Date.now(), x: p.x, y: p.y });
    if (drag.samples.length > 12) drag.samples.shift();
    moveWin(drag.x + p.x - drag.cx, drag.y + p.y - drag.cy);
  }, 8);
}
function endDrag() {
  if (!drag) return;
  clearInterval(drag.timer);
  const s = drag.samples;
  drag = null;
  // flung? (fast release) -> let it fly
  if (s.length >= 3) {
    const b = s[s.length - 1];
    const a = s.find((q) => b.t - q.t <= 90) || s[0];
    const dt = Math.max(0.016, (b.t - a.t) / 1000);
    const vx = (b.x - a.x) / dt, vy = (b.y - a.y) / dt;
    if (Math.hypot(vx, vy) > 1100) { startPhysics(clamp(vx, -4500, 4500), clamp(vy, -4500, 4500), { thenHome: false }); return; }
  }
  snapToEdges();
}

// Simple bouncing-ball physics for a thrown (or knocked-off) buddy.
function startPhysics(vx, vy, opts = {}) {
  stopPhysics();
  const b = win.getBounds();
  const wa = workAreaOf(b);
  const { width, height } = winSize();
  phys = { x: b.x, y: b.y, vx, vy, last: Date.now(), rest: 0 };
  trigger({ type: 'air', on: true, vx });
  phys.timer = setInterval(() => {
    const now = Date.now(), dt = Math.min(0.04, (now - phys.last) / 1000);
    phys.last = now;
    phys.vy += 2800 * dt;
    phys.x += phys.vx * dt; phys.y += phys.vy * dt;
    const minX = wa.x, maxX = wa.x + wa.width - width, floor = wa.y + wa.height - height;
    if (phys.x < minX) { phys.x = minX; phys.vx = Math.abs(phys.vx) * 0.62; }
    if (phys.x > maxX) { phys.x = maxX; phys.vx = -Math.abs(phys.vx) * 0.62; }
    if (phys.y < wa.y) { phys.y = wa.y; phys.vy = Math.abs(phys.vy) * 0.5; }
    if (phys.y >= floor) {
      phys.y = floor;
      if (Math.abs(phys.vy) > 260) { phys.vy = -phys.vy * 0.48; phys.vx *= 0.8; }
      else { phys.vy = 0; phys.vx *= Math.pow(0.02, dt); phys.rest += dt; }
    } else phys.rest = 0;
    moveWin(phys.x, phys.y);
    if (phys.rest > 0.12 && Math.abs(phys.vx) < 40) {
      stopPhysics(true);
      setTimeout(() => {
        if (drag || phys) return;
        if (opts.thenHome && typeof cfg.x === 'number') walkTo(cfg.x, 150, () => moveWin(cfg.x, cfg.y));
        else snapToEdges();
      }, 2300);
    }
  }, 16);
}
function stopPhysics(landed) {
  if (!phys) return;
  clearInterval(phys.timer);
  phys = null;
  trigger({ type: 'air', on: false, land: !!landed });
}

function snapToEdges() {
  const b = { ...win.getBounds(), ...winSize() };
  const wa = workAreaOf(b);
  const SNAP = 48;
  let { x, y } = b;
  x = clamp(x, wa.x, wa.x + wa.width - b.width);
  y = clamp(y, wa.y, wa.y + wa.height - b.height);
  if (x - wa.x < SNAP) x = wa.x;
  if (wa.x + wa.width - (x + b.width) < SNAP) x = wa.x + wa.width - b.width;
  if (y - wa.y < SNAP) y = wa.y;
  if (wa.y + wa.height - (y + b.height) < SNAP) y = wa.y + wa.height - b.height;
  win.setBounds({ x, y, width: b.width, height: b.height });
  cfg.x = x; cfg.y = y; saveConfig();
  perch = null;
}
function moveToCorner(corner) {
  stopRoam(false); stopPhysics();
  const p = cornerPos(corner, screen.getDisplayMatching(win.getBounds()));
  win.setBounds({ ...p, ...winSize() });
  cfg.x = p.x; cfg.y = p.y; saveConfig();
}

// ---------- roaming: wander along the taskbar, or perch on the active window ----------

let roam = null, walk = null, nextRoamAt = Date.now() + rand(40, 90) * 1000;
let perch = null, fgProc = null, fgLast = null, fgStableTimer = null;

function walkTo(targetX, speed, done, onAbort) {
  if (walk) { clearInterval(walk.timer); const a = walk.onAbort; walk = null; if (a) a(); }
  const b = win.getBounds();
  let x = b.x; const y = b.y;
  const dir = targetX >= x ? 1 : -1;
  if (Math.abs(targetX - x) < 3) { if (done) done(); return; }
  trigger({ type: 'walk', on: true, dir });
  let last = Date.now();
  walk = { onAbort, timer: setInterval(() => {
    const now = Date.now(), dt = Math.min(0.05, (now - last) / 1000); last = now;
    x += dir * speed * dt;
    const arrived = dir > 0 ? x >= targetX : x <= targetX;
    moveWin(arrived ? targetX : x, y);
    if (arrived) { clearInterval(walk.timer); walk = null; trigger({ type: 'walk', on: false }); if (done) done(); }
  }, 16) };
}
function stopWalk() { if (walk) { clearInterval(walk.timer); const a = walk.onAbort; walk = null; trigger({ type: 'walk', on: false }); if (a) a(); } }

// ---------- taskbar tricks (taskbar.js) ----------
const tb = require('./taskbar')({ idleSec: () => { try { return powerMonitor.getSystemIdleTime(); } catch { return 0; } }, allowPoke: () => !!cfg.pokeUI, screen, getWin: () => win, scale: () => scale(), winSize: () => winSize(), moveWin: (x, y) => moveWin(x, y), walkTo: (x, v, d, a) => walkTo(x, v, d, a), stopWalk: () => stopWalk(), trigger: (t) => trigger(t) });
const TB_CHANCE = [0, 0.3, 0.5, 0.7]; // per wander, by silliness
function startTrick(name) {
  if (!IS_WIN) { if (name) trigger({ type: 'flash', text: 'Taskbar tricks only work on Windows (for now)', ms: 3000 }); return; }
  if (tb.active() || drag || phys) return;
  stopRoam(false);
  const r = { timer: null, tb: true, manual: !!name, cancel: (goHome) => tb.cancel(goHome, cfg.x) };
  roam = r;
  tb.start(name || null, cfg.x, () => { if (roam === r) roam = null; nextRoamAt = Date.now() + rand(70, 180) * 1000; }).then((res) => {
    if (roam === r && typeof res === 'string') roam = null;
    if (DEBUG) console.log('[clawdkin] trick', name || 'random', '->', res);
    if (name && res === 'not-on-bar') trigger({ type: 'flash', text: 'Put me on the taskbar first', ms: 2600 });
    if (name && res === 'no-bar') trigger({ type: 'flash', text: 'Taskbar tricks need the taskbar at the bottom', ms: 3000 });
    if (name && res === 'fullscreen') trigger({ type: 'flash', text: 'Not while something is full screen', ms: 2600 });
  });
}
function startleTrick() { // the mouse came near while it was hiding something
  if (!roam || !roam.tb) return;
  roam = null; nextRoamAt = Date.now() + rand(90, 200) * 1000;
  tb.cancel(true, cfg.x, true);
}

// goHome: true -> hurry back to its spot; false -> just stop where it is
function stopRoam(goHome) {
  if (roam && roam.manual && goHome) return;
  if (!roam && tb.active()) { if (!goHome) tb.cancel(false); return; }
  if (roam) {
    const r = roam; clearTimeout(r.timer); roam = null; nextRoamAt = Date.now() + rand(60, 150) * 1000;
    if (r.cancel && r.cancel(goHome)) return; // a taskbar trick finds its own way home
  }
  const away = win && typeof cfg.x === 'number' && (Math.abs(win.getBounds().x - cfg.x) > 3 || Math.abs(win.getBounds().y - cfg.y) > 3);
  if (goHome && away && !phys && !drag) {
    if (perch) { perch = null; startPhysics(rand(-120, 120), -200, { thenHome: true }); }
    else walkTo(cfg.x, 240, () => moveWin(cfg.x, cfg.y));
  } else if (!goHome) { stopWalk(); perch = null; }
}
function canRoam() {
  return win && win.isVisible() && !drag && !phys && !walk && !roam && !settingsWin && !replyWin && current.state === 'idle' && Date.now() > gameUntil && !preview;
}
function tickWander() {
  if (cfg.roam !== 'wander' || !canRoam() || Date.now() < nextRoamAt || typeof cfg.x !== 'number') return;
  const b = win.getBounds();
  const wa = workAreaOf(b);
  if (Math.abs(wa.y + wa.height - (b.y + b.height)) > 10) { nextRoamAt = Date.now() + 60000; return; } // only when it lives on the taskbar
  if (IS_WIN && cfg.taskbarTricks && Math.random() < (TB_CHANCE[cfg.silliness | 0] || 0)) { startTrick(null); return; }
  let target = cfg.x + (Math.random() < 0.5 ? -1 : 1) * rand(140, 420);
  target = clamp(target, wa.x, wa.x + wa.width - b.width);
  if (Math.abs(target - cfg.x) < 100) target = clamp(cfg.x - Math.sign(target - cfg.x || 1) * 260, wa.x, wa.x + wa.width - b.width);
  roam = { timer: null };
  walkTo(target, 55, () => {
    if (!roam) return;
    roam.timer = setTimeout(() => { if (!roam) return; walkTo(cfg.x, 55, () => { roam = null; nextRoamAt = Date.now() + rand(70, 180) * 1000; }); }, rand(8, 22) * 1000);
  });
}

function startFgHelper() {
  if (fgProc || !IS_WIN) return;
  try {
    fgProc = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(ROOT, 'tools', 'fgwin.ps1')], { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
    let buf = '';
    fgProc.stdout.on('data', (d) => { buf += d; const lines = buf.split(/\r?\n/); buf = lines.pop(); for (const ln of lines) onForeground(ln.trim()); });
    fgProc.on('exit', () => { fgProc = null; });
  } catch { fgProc = null; }
}
function stopFgHelper() { if (fgProc) { try { fgProc.kill(); } catch {} fgProc = null; } clearTimeout(fgStableTimer); }
function onForeground(line) {
  const m = line.split(' ');
  if (m.length < 7) return;
  const info = { h: m[0], zoomed: m[5] === '1', pid: +m[6], raw: line };
  try { info.rect = screen.screenToDipRect(null, { x: +m[1], y: +m[2], width: +m[3] - +m[1], height: +m[4] - +m[2] }); } catch { return; }
  fgLast = info;
  if (cfg.roam !== 'perch') return;
  // the window it was sitting on moved or lost focus: it gets knocked off
  if (perch && perch.raw !== line && !phys && !drag) { perch = null; startPhysics(rand(-160, 160), -260, { thenHome: true }); }
  clearTimeout(fgStableTimer);
  fgStableTimer = setTimeout(tryPerch, 2500);
}
function tryPerch() {
  if (cfg.roam !== 'perch' || perch || !fgLast || !canRoam()) return;
  const f = fgLast, r = f.rect, s = scale(), { width, height } = winSize();
  if (f.zoomed || f.pid === process.pid || r.width < 260 || r.height < 120) return;
  const wa = workAreaOf(r);
  const y = Math.round(r.y - GROUND_Y * s + 3 * s);
  if (y < wa.y || r.y > wa.y + wa.height - 60) return; // no room above its title bar
  const x = clamp(Math.round(r.x + r.width - width - 40), Math.max(wa.x, r.x), wa.x + wa.width - width);
  // hop over in an arc
  const from = win.getBounds(), t0 = Date.now(), D = 620;
  roam = { timer: null };
  trigger({ type: 'air', on: true, vx: (x - from.x) * 0.6 });
  const timer = setInterval(() => {
    const k = clamp((Date.now() - t0) / D, 0, 1);
    moveWin(from.x + (x - from.x) * k, from.y + (y - from.y) * k - Math.sin(k * Math.PI) * 120);
    if (k >= 1) { clearInterval(timer); roam = null; trigger({ type: 'air', on: false }); perch = { raw: f.raw }; }
  }, 16);
}

// ---------- reacting to the desktop ----------

function watchDesktop() {
  // copying something: it leans in for a look (only a fingerprint of the clipboard is kept, never the text)
  let clipSig = null;
  const sig = () => { try { const t = clipboard.readText(); let h = t.length; for (let i = 0; i < Math.min(t.length, 400); i++) h = (h * 31 + t.charCodeAt(i)) | 0; return h; } catch { return 0; } };
  setInterval(() => {
    if (!cfg.reactCopy) { clipSig = null; return; }
    const s = sig();
    if (clipSig !== null && s !== clipSig && current.state === 'idle' && Date.now() > clipQuietUntil && win.isVisible()) trigger({ type: 'antic', name: 'lean', byUser: false });
    clipSig = s;
  }, 1200);
  // coming back to the computer
  const back = () => setTimeout(() => { trigger({ type: 'wake' }); if (current.state === 'idle') trigger({ type: 'antic', name: 'welcome', byUser: false }); }, 900);
  powerMonitor.on('unlock-screen', back);
  powerMonitor.on('resume', back);
  // away from the keyboard for a while: it dozes off
  let away = false;
  setInterval(() => {
    let idle = 0;
    try { idle = powerMonitor.getSystemIdleTime(); } catch {}
    const now = idle > 300;
    if (now !== away) { away = now; trigger({ type: 'user-idle', on: away }); }
  }, 5000);
  setInterval(tickWander, 2000);
  if (cfg.roam === 'perch') startFgHelper();
}
let clipQuietUntil = 0;

function fileDropped(p) {
  if (!p) return;
  mem.fed = (mem.fed || 0) + 1; saveMem();
  clipQuietUntil = Date.now() + 4000;
  try { clipboard.writeText(p); } catch {}
  setTimeout(() => trigger({ type: 'flash', text: 'Yum! Path copied — paste it into Claude', ms: 5000 }), 1700);
  setTimeout(openClaude, 2600);
}

// ---------- extra windows: settings, diary, quick reply ----------

function popup(file, W, H, opts = {}) {
  const b = win.getBounds();
  const wa = workAreaOf(b);
  let x = b.x - W - 4;
  if (x < wa.x) x = b.x + b.width + 4;
  x = clamp(x, wa.x, wa.x + wa.width - W);
  const y = clamp(b.y + b.height - H, wa.y, wa.y + wa.height - H);
  const w = new BrowserWindow({
    width: W, height: H, x, y,
    frame: false, transparent: true, backgroundColor: '#00000000',
    resizable: false, maximizable: false, minimizable: false, fullscreenable: false,
    alwaysOnTop: true, skipTaskbar: true, hasShadow: false, show: false,
    webPreferences: { preload: path.join(ROOT, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  w.setAlwaysOnTop(true, 'screen-saver');
  w.loadFile(path.join(ROOT, file));
  w.once('ready-to-show', () => { w.show(); w.focus(); });
  if (!opts.sticky) w.on('blur', () => { if (!w.isDestroyed() && !DEBUG) w.close(); });
  return w;
}
function openSettings() {
  if (settingsWin) { settingsWin.show(); settingsWin.focus(); return; }
  stopRoam(true);
  settingsWin = popup('settings/index.html', 330, 520);
  settingsWin.on('closed', () => { settingsWin = null; });
}
function openDiary() {
  if (diaryWin) { diaryWin.show(); diaryWin.focus(); return; }
  diaryWin = popup('diary/index.html', 380, 560);
  diaryWin.on('closed', () => { diaryWin = null; });
}
function openReply() {
  if (!current.ask) { openClaude(); return; }
  if (replyWin) { replyWin.show(); replyWin.focus(); return; }
  replyWin = popup('reply/index.html', 340, 300, { sticky: true });
  const shown = askData();
  replyWin.reqId = shown && shown.live ? shown.reqId : null;
  replyWin.on('closed', () => { replyWin = null; });
}
const reqFile = (id) => path.join(REQ_DIR, String(id).replace(/[^\w.-]/g, '') + '.json');
// the pending Quick reply request for this ask: by its id, or (if the state file missed the id) by session
function liveRequest(a) {
  if (a.reqId) { const r = readJson(reqFile(a.reqId)); if (r) return r; }
  const pre = String(a.sid || '').slice(0, 12) + '-';
  if (pre.length < 2) return null;
  try {
    const f = fs.readdirSync(REQ_DIR).filter((n) => n.startsWith(pre) && !n.includes('.answer')).sort().pop();
    return f ? readJson(path.join(REQ_DIR, f)) : null;
  } catch { return null; }
}
function askData() {
  const a = current.ask;
  if (!a) return null;
  const req = liveRequest(a);
  // show exactly what would be approved: the request the hook is waiting on
  return req ? { ...req, project: req.project || a.project, live: true, quickReply: cfg.quickReply } : { ...a, live: false, quickReply: cfg.quickReply };
}
function answer(ans) {
  // only ever answer the request the popup was showing, and only while the hook still waits on it
  if (ans && ans.reqId && fs.existsSync(reqFile(ans.reqId))) {
    const { reqId, ...rest } = ans;
    try { fs.writeFileSync(reqFile(reqId).replace(/\.json$/, '.answer.json'), JSON.stringify(rest)); } catch {}
  }
  if (replyWin && !replyWin.isDestroyed()) replyWin.close();
}
function fit(w, h) {
  if (!w || w.isDestroyed()) return;
  const b = w.getBounds();
  const wa = workAreaOf(b);
  const height = clamp(Math.ceil(h), 160, wa.height);
  w.setBounds({ x: b.x, y: clamp(b.y + b.height - height, wa.y, wa.y + wa.height - height), width: b.width, height });
}

// ---------- menu ----------

function loginEnabled() { return IS_WIN && app.getLoginItemSettings({ path: process.execPath, args: [ROOT] }).openAtLogin; }
function setLogin(on) { if (!IS_WIN) return; app.setLoginItemSettings({ openAtLogin: !!on, path: process.execPath, args: [ROOT] }); broadcastConfig(); }
function playCatch() { stopRoam(true); gameUntil = Date.now() + 23000; setTimeout(() => trigger({ type: 'game' }), walk ? 1500 : 0); }
function setPreview(state) {
  const extra = { idle: {}, working: { tool: 'Edit', edits: 4, turnStart: Date.now() }, waiting: { detail: 'permission' }, done: { edits: 4 } }[state] || {};
  preview = { st: { state, detail: '', ...extra }, until: Date.now() + 8000 }; pushState();
}

function showMenu() {
  const st = computeState();
  const sessionItems = st.sessions.filter(s => s.state !== 'idle').slice(0, 8).map(s => ({
    label: `${s.state === 'waiting' ? '●' : s.state === 'working' ? '◐' : '○'}  ${s.project || 'session'} — ${s.state === 'waiting' ? 'needs you' : s.state}`, enabled: false,
  }));
  const pct = Math.round(scale() * 100);
  const check = (key, label) => ({ label, type: 'checkbox', checked: !!cfg[key], click: (i) => setConfig({ [key]: i.checked }) });
  const tpl = [
    { label: 'Open Claude', click: openClaude },
    ...(st.hasAsk ? [{ label: st.detail === 'question' ? 'Answer Claude’s question…' : 'Answer the permission request…', click: openReply }] : []),
    { type: 'separator' },
    ...(sessionItems.length ? sessionItems : [{ label: 'No active Claude Code sessions', enabled: false }]),
    { type: 'separator' },
    { label: 'Play catch (20 seconds)', click: playCatch },
    { label: 'Do something silly', submenu: [
      { label: 'Surprise me', click: () => trigger({ type: 'antic' }) },
      { type: 'separator' },
      ...ANTICS.map(([k, l]) => ({ label: l, click: () => trigger({ type: 'antic', name: k }) })),
    ] },
    { label: 'Claude’s diary…', click: openDiary },
    { type: 'separator' },
    { label: 'Form', submenu: [
      { label: 'Evolve over time', type: 'radio', checked: cfg.form === 'auto', click: () => setConfig({ form: 'auto' }) },
      { type: 'separator' },
      ...FORMS.map(([k, l]) => formAvailable(k)
        ? { label: l, type: 'radio', checked: cfg.form === k, click: () => setConfig({ form: k }) }
        : { label: `${l.split('  ')[0]}  (locked: ${UNLOCKS[k].prog(mem)})`, enabled: false }),
      { type: 'separator' },
      { label: 'Transform now', click: () => trigger({ type: 'transform' }) },
      { label: 'Evolve every', submenu: [2, 5, 15, 30, 60].map(m => ({ label: `${m} minutes`, type: 'radio', checked: cfg.evolveMinutes === m, click: () => setConfig({ evolveMinutes: m, form: 'auto' }) })) },
      check('unlockAll', 'Unlock every form now'),
    ] },
    { label: 'Hat', submenu: HATS.map(([k, l]) => ({ label: l, type: 'radio', checked: cfg.hat === k, click: () => setConfig({ hat: k }) })) },
    { label: 'Colour', submenu: THEMES.map(([k, l]) => ({ label: l, type: 'radio', checked: cfg.theme === k, click: () => setConfig({ theme: k }) })) },
    { label: `Size (${pct}%)`, submenu: [
      { label: 'Bigger', click: () => setConfig({ scale: Math.round((scale() + 0.1) * 100) / 100 }) },
      { label: 'Smaller', click: () => setConfig({ scale: Math.round((scale() - 0.1) * 100) / 100 }) },
      { label: 'Reset to 100%', click: () => setConfig({ scale: 1 }) },
      { type: 'separator' },
      { label: 'Size slider…', click: openSettings },
      { label: 'Tip: Ctrl + scroll on Clawdkin', enabled: false },
    ] },
    { type: 'separator' },
    { label: 'Silliness', submenu: SILLY.map((l, i) => ({ label: l, type: 'radio', checked: cfg.silliness === i, click: () => setConfig({ silliness: i }) })) },
    { label: 'Roaming', submenu: [
      ...ROAMS.map(([k, l]) => ({ label: l, type: 'radio', checked: cfg.roam === k, click: () => setConfig({ roam: k }) })),
      ...(IS_WIN ? [
        { type: 'separator' },
        check('taskbarTricks', 'Taskbar tricks while wandering'),
        check('pokeUI', 'Let it press Start and the hidden icons'),
        { label: 'Do a taskbar trick', submenu: [{ label: 'Surprise me', click: () => startTrick(null) }, { type: 'separator' }, ...tb.NAMES.map(([k, l]) => ({ label: l, click: () => startTrick(k) }))] },
      ] : []),
    ] },
    { label: 'Behaviour', submenu: [
      check('sfx', 'Sounds'),
      check('followMouse', 'Eyes follow the mouse'),
      check('reactCopy', 'Lean in when I copy something'),
      check('showProps', 'Hold a prop for the tool in use'),
      check('showTrail', 'Leave a paper trail of edited files'),
      check('sleep', 'Nap when nothing is happening'),
      check('showLabel', 'Show what Claude is doing on hover'),
      { type: 'separator' },
      check('quickReply', 'Quick reply: answer Claude from Clawdkin (experimental)'),
    ] },
    { label: 'Move to corner', submenu: [
      { label: 'Bottom right', click: () => moveToCorner('bottom-right') },
      { label: 'Bottom left', click: () => moveToCorner('bottom-left') },
      { label: 'Top right', click: () => moveToCorner('top-right') },
      { label: 'Top left', click: () => moveToCorner('top-left') },
    ] },
    { label: 'Preview a state', submenu: [['idle', 'Idle'], ['working', 'Working'], ['waiting', 'Needs input'], ['done', 'Done']].map(([s, l]) => ({ label: l, click: () => setPreview(s) })) },
    { type: 'separator' },
    { label: 'Settings…', click: openSettings },
    { label: 'Hide for 30 minutes', click: () => { stopRoam(false); hiddenUntil = Date.now() + 30 * 60 * 1000; win.hide(); } },
    ...(IS_WIN ? [{ label: 'Start with Windows', type: 'checkbox', checked: loginEnabled(), click: (i) => setLogin(i.checked) }] : []),
    { label: 'Quit Clawdkin', click: () => app.quit() },
  ];
  Menu.buildFromTemplate(tpl).popup({ window: win });
}

// ---------- debug ----------

async function debugSelfCheck() {
  const out = P.DEBUG;
  fs.mkdirSync(out, { recursive: true });
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  const shot = async (w, name) => fs.writeFileSync(path.join(out, name + '.png'), (await w.webContents.capturePage()).toPNG());
  await wait(1500);
  console.log('[clawdkin] bounds', JSON.stringify(win.getBounds()), 'visible', win.isVisible());
  console.log('[clawdkin] state', JSON.stringify({ ...current, sessions: current.sessions.length }));
  console.log('[clawdkin] memory', JSON.stringify({ toolCalls: mem.toolCalls, turns: mem.turns, unlocked: mem.unlocked, mood: mood() }));
  if (DEBUG === 'windows') {
    openSettings(); await wait(1400); await shot(settingsWin, 'settings');
    console.log('[clawdkin] settings bounds', JSON.stringify(settingsWin.getBounds()));
    settingsWin.close(); await wait(300);
    openDiary(); await wait(1400); await shot(diaryWin, 'diary'); diaryWin.close(); await wait(300);
    debugAsk = current.ask = { kind: 'permission', tool: 'Bash', summary: 'npm run build && npm test -- --watch=false', full: true, project: 'my-project', reqId: 'debug-1' };
    fs.mkdirSync(REQ_DIR, { recursive: true }); fs.writeFileSync(path.join(REQ_DIR, 'debug-1.json'), JSON.stringify(debugAsk));
    cfg.quickReply = true;
    openReply(); await wait(1200); await shot(replyWin, 'reply-permission'); replyWin.close(); await wait(300);
    debugAsk = current.ask = { kind: 'question', project: 'my-project', reqId: 'debug-1', questions: [{ question: 'Which corner should Clawdkin live in by default?', header: 'Corner', multi: false, options: [{ label: 'Bottom right', description: 'Next to the clock' }, { label: 'Bottom left', description: 'By the Start button' }, { label: 'Top right', description: 'Under the window buttons' }] }] };
    fs.writeFileSync(path.join(REQ_DIR, 'debug-1.json'), JSON.stringify(debugAsk));
    openReply(); await wait(1200); await shot(replyWin, 'reply-question');
    replyWin.webContents.executeJavaScript("document.querySelector('.opt').click(); document.getElementById('send').click();");
    await wait(600);
    console.log('[clawdkin] answer file', fs.existsSync(path.join(REQ_DIR, 'debug-1.answer.json')) ? fs.readFileSync(path.join(REQ_DIR, 'debug-1.answer.json'), 'utf8') : 'MISSING');
    for (const f of ['debug-1.json', 'debug-1.answer.json']) try { fs.unlinkSync(path.join(REQ_DIR, f)); } catch {}
    cfg.quickReply = false; debugAsk = current.ask = null;
  }
  if (DEBUG === 'motion') {
    const home = { ...win.getBounds() };
    startPhysics(-1600, -1400, { thenHome: false });
    let maxUp = 0, minX = home.x;
    const poll = setInterval(() => { const b = win.getBounds(); maxUp = Math.max(maxUp, home.y - b.y); minX = Math.min(minX, b.x); }, 30);
    await wait(4200); clearInterval(poll);
    console.log('[clawdkin] throw: rose', maxUp, 'px, travelled left to x=', minX, ', resting at', JSON.stringify(win.getBounds()), 'phys', !!phys);
    await wait(2600);
    console.log('[clawdkin] after snap', JSON.stringify(win.getBounds()), 'home', cfg.x, cfg.y);
    nextRoamAt = 0; current = { ...current, state: 'idle' }; tickWander(); // (forced: it normally only wanders while Claude is idle)
    await wait(2500);
    console.log('[clawdkin] wandering:', !!walk, 'x now', win.getBounds().x, 'home x', cfg.x);
    stopRoam(true); await wait(3500);
    console.log('[clawdkin] back home:', win.getBounds().x === cfg.x);
    moveWin(home.x, home.y); cfg.x = home.x; cfg.y = home.y; saveConfig();
  }
  if (DEBUG === 'thought') {
    // hover the buddy (a synthetic mousemove inside the page) and capture the thought cloud at several sizes and forms
    const keep = { scale: cfg.scale, form: cfg.form };
    const hover = "(() => { const r = document.getElementById('form').getBoundingClientRect(); window.dispatchEvent(new MouseEvent('mousemove', { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 })); const th = document.querySelector('.th'), p = document.querySelector('.th-pop').getBoundingClientRect(); return 'shown=' + th.classList.contains('show') + ' lines=' + [...document.querySelectorAll('.th-t')].map((t) => t.textContent).join(' | ') + ' cloud x ' + Math.round(p.left) + '..' + Math.round(p.right) + ' y ' + Math.round(p.top) + '..' + Math.round(p.bottom) + ' of ' + window.innerWidth + 'x' + window.innerHeight + '; glow ' + !!document.getElementById('glow'); })()";
    for (const [sc, form] of [[1.2, 'clawd'], [1.2, 'spark'], [0.6, 'prompt'], [2, 'glass']]) {
      setConfig({ scale: sc, form }); await wait(2400);
      await win.webContents.executeJavaScript(hover); await wait(500);
      console.log('[clawdkin] thought ' + sc + ' ' + form + ': ' + await win.webContents.executeJavaScript(hover));
      await shot(win, 'thought-' + form + '-' + sc);
    }
    setConfig(keep); await wait(500); moveToCorner('bottom-right');
  }
  if (DEBUG === 'poke') {
    if (process.env.CLAWDKIN_POKE_CANCEL) { // interrupt while Start is open: it must still get closed
      const pk = (act) => new Promise((r) => require('child_process').execFile('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(ROOT, 'tools', 'poke.ps1'), act], { windowsHide: true }, (e, o) => r(String(o).trim())));
      startTrick('oops'); const t0 = Date.now(); while (!tb.opened() && Date.now() - t0 < 20000) await wait(50);
      console.log('[clawdkin] start opened:', tb.opened()); await wait(400); startleTrick(); await wait(2500);
      console.log('[clawdkin] after interrupt: start still open:', (await pk('start-close')) === 'done', ', trick active:', tb.active()); await wait(3000);
      console.log('[clawdkin] debug done'); return;
    }
    // run the two button-pressing tricks; afterwards Start and the hidden icons must both be closed
    const pk = (act) => new Promise((r) => require('child_process').execFile('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(ROOT, 'tools', 'poke.ps1'), act], { windowsHide: true }, (e, o) => r(String(o).trim())));
    for (const name of ['oops', 'peek']) {
      const t0 = Date.now(); startTrick(name); await wait(700);
      while (tb.active() && Date.now() - t0 < 30000) await wait(200);
      await wait(600);
      console.log('[clawdkin] poke ' + name + ': ' + ((Date.now() - t0) / 1000).toFixed(1) + 's, ended at ' + JSON.stringify(win.getBounds()) + ', start still open: ' + ((await pk('start-close')) === 'done') + ', hidden icons still open: ' + ((await pk('tray-close')) === 'done'));
      await wait(1000);
    }
  }
  if (DEBUG === 'tb') {
    setPreview('idle'); await wait(500);
    const L = await tb.readLayout();
    console.log('[clawdkin] layout:', L ? `start ${!!L.start}, clock ${!!L.clock}, ${L.apps.length} apps (${L.apps.filter((a) => a.running).length} running, claude ${L.apps.some((a) => a.claude)})` : 'none');
    for (const [name] of tb.NAMES) {
      const home = win.getBounds(), d = screen.getDisplayMatching(home);
      const ys = [], xs = [], t0 = Date.now();
      startTrick(name); let shots = 0, frontAt = 0;
      while (Date.now() - t0 < 25000) {
        await wait(100); const b = win.getBounds(); ys.push(b.y); xs.push(b.x);
        if (!frontAt && b.y > d.workArea.y + d.workArea.height - home.height + 20) frontAt = Date.now();
        if ((shots === 0 && Date.now() - t0 > 2000) || (shots === 1 && frontAt && Date.now() - frontAt > 1600)) {
          const n = shots++;
          const dd = screen.getDisplayMatching(win.getBounds()), sf = dd.scaleFactor;
          const src = (await require('electron').desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: Math.round(dd.bounds.width * sf), height: Math.round(dd.bounds.height * sf) } }))[0];
          if (src) { const wb = win.getBounds(); const x = Math.max(0, Math.round((wb.x - 220 - dd.bounds.x) * sf)); const y = Math.round((dd.bounds.height - 150) * sf); fs.writeFileSync(path.join(out, 'tb-' + name + '-' + n + '.png'), src.thumbnail.crop({ x, y, width: Math.min(Math.round(620 * sf), Math.round(dd.bounds.width * sf) - x), height: Math.round(150 * sf) }).toPNG()); }
        }
        if (!tb.active() && Date.now() - t0 > 600) break;
      }
      const end = win.getBounds();
      console.log(`[clawdkin] trick ${name}: ${((Date.now() - t0) / 1000).toFixed(1)}s, x ${Math.min(...xs)}..${Math.max(...xs)}, y ${Math.min(...ys)}..${Math.max(...ys)} (top ${d.workArea.y + d.workArea.height - home.height}, front ${d.bounds.y + d.bounds.height - home.height}), ended at ${end.x},${end.y} home ${home.x},${home.y}`);
      await wait(800);
    }
    // flee: start hiding, then put the mouse on it
    startTrick('hide'); let fled = false;
    for (let i = 0; i < 120 && !fled; i++) { await wait(100); const b = win.getBounds(); if (b.y > screen.getDisplayMatching(b).workArea.y + screen.getDisplayMatching(b).workArea.height - b.height + 10) { await wait(900); const t1 = Date.now(); tb.onCursor && startleTrick(); fled = true; console.log('[clawdkin] startled while hiding; back on top after', await (async () => { while (win.getBounds().y > screen.getDisplayMatching(win.getBounds()).workArea.y + screen.getDisplayMatching(win.getBounds()).workArea.height - win.getBounds().height + 1 && Date.now() - t1 < 3000) await wait(30); return Date.now() - t1; })(), 'ms'); } }
    await wait(4000); console.log('[clawdkin] after flee at', JSON.stringify(win.getBounds()), 'home', cfg.x, cfg.y, 'active', tb.active());
  }
  if (DEBUG === 'walk') {
    // Walk at every size and check the feet stay on the taskbar: window bottom vs work area, and the
    // lowest painted point of the buddy vs the window bottom, sampled through the walk.
    const keep = cfg.scale;
    const feetJs = "(() => { const r = document.getElementById('form').getBoundingClientRect(); return window.innerHeight - r.bottom; })()";
    for (const sc of [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]) {
      setConfig({ scale: sc }); await wait(400);
      moveToCorner('bottom-right'); await wait(1600);
      const home = win.getBounds(), wa = workAreaOf(home);
      const gaps = [], feet = [], hs = [];
      walkTo(home.x - 160, 120);
      for (let i = 0; i < 24; i++) {
        await wait(50);
        const b2 = win.getBounds();
        gaps.push(wa.y + wa.height - (b2.y + b2.height)); hs.push(b2.height);
        feet.push(await win.webContents.executeJavaScript(feetJs));
      }
      stopWalk();
      const r = (xs) => Math.min(...xs).toFixed(1) + '..' + Math.max(...xs).toFixed(1);
      console.log('[clawdkin] scale ' + sc + ': window-to-taskbar gap ' + r(gaps) + ' px, window height ' + r(hs) + ', feet above window bottom ' + r(feet) + ' css px (x' + sc + ' = ' + (Math.min(...feet) * sc).toFixed(1) + '..' + (Math.max(...feet) * sc).toFixed(1) + ' screen px)');
    }
    setConfig({ scale: keep }); await wait(300); moveToCorner('bottom-right');
    const keepForm = cfg.form;
    for (const name of ['spark', 'glyph', 'doodle', 'clawd', 'prompt', 'origami', 'blocks', 'glass', 'moon']) {
      setConfig({ form: name }); await wait(2200);
      const fs2 = [];
      for (let i = 0; i < 8; i++) {
        // lowest solid pixel row (alpha > 120 ignores the faint shadow), in viewBox units above the window bottom
        const img = await win.webContents.capturePage(); const { width: W, height: H } = img.getSize(); const px = img.toBitmap();
        let row = -1;
        for (let y = H - 1; y >= 0 && row < 0; y--) for (let x = Math.round(W * 0.27); x < Math.round(W * 0.73); x++) if (px[(y * W + x) * 4 + 3] > 120) { row = y; break; }
        fs2.push((H - 1 - row) * 170 / H); await wait(120);
      }
      await shot(win, 'stand-' + name);
      console.log('[clawdkin] standing ' + name + ': solid pixels end ' + Math.min(...fs2).toFixed(1) + '..' + Math.max(...fs2).toFixed(1) + ' units above the window bottom');
    }
    setConfig({ form: keepForm });
  }
  if (DEBUG === 'look') {
    setPreview('idle'); await wait(600);
    const b = win.getBounds(), wa = workAreaOf(b);
    const feet = await win.webContents.executeJavaScript("(() => { const r = document.getElementById('shadow').getBoundingClientRect(); return Math.round(window.innerHeight - r.bottom); })()");
    console.log('[clawdkin] window bottom to taskbar gap:', wa.y + wa.height - (b.y + b.height), 'px; shadow to window bottom:', feet, 'px');
    const measure = "(() => [...document.querySelectorAll('#fx text')].map((t) => { const r = t.getBoundingClientRect(); return t.textContent + ': ' + Math.round(r.height) + 'px tall, x ' + Math.round(r.left) + '..' + Math.round(r.right) + ' of ' + window.innerWidth + ', y ' + Math.round(r.top); }).join(' | '))()";
    trigger({ type: 'antic', name: 'sneeze' }); await wait(1500); await shot(win, 'word-sneeze');
    console.log('[clawdkin] sneeze text:', await win.webContents.executeJavaScript(measure));
    trigger({ type: 'antic', name: 'welcome' }); await wait(700); await shot(win, 'word-welcome');
    console.log('[clawdkin] welcome text:', await win.webContents.executeJavaScript(measure));
    setPreview('waiting'); await wait(900);
    win.webContents.sendInputEvent({ type: 'mouseMove', x: Math.round(75 * scale()), y: Math.round(CENTER_Y * scale()) }); await wait(500);
    await shot(win, 'label-top');
  }
  if (DEBUG === 'game') {
    setPreview('idle'); await wait(500);
    playCatch(); await wait(1200);
    // sweep a fake cursor left and right so some sparks get caught
    const sweep = setInterval(() => send(win, 'cursor', { dx: Math.sin(Date.now() / 400) * 50, dy: 0 }), 30);
    await wait(5000);
    const r = await win.webContents.executeJavaScript("document.querySelectorAll('#gameLayer path').length + ' sparks falling, score ' + document.querySelector('#gameLayer text').textContent");
    console.log('[clawdkin] game after 6s:', r);
    await shot(win, 'game'); clearInterval(sweep);
  }
  console.log('[clawdkin] debug done');
}

// ---------- IPC ----------

ipcMain.handle('get-config', () => cfg);
ipcMain.handle('meta', () => ({ platform: process.platform, tbTricks: tb.NAMES, forms: FORMS, antics: ANTICS, themes: THEMES, hats: HATS, roams: ROAMS, silly: SILLY, login: loginEnabled(), unlocked: unlockedForms(), locks: Object.fromEntries(Object.keys(UNLOCKS).map((k) => [k, UNLOCKS[k].prog(mem)])) }));
ipcMain.handle('get-diary', () => diaryData());
ipcMain.handle('get-ask', () => askData());
ipcMain.on('set-config', (_e, partial) => setConfig(partial));
ipcMain.on('trigger', (_e, tr) => {
  if (!tr) return;
  if (tr.type === 'petted') { mem.pets = (mem.pets || 0) + 1; saveMem(); if (dusty) { dusty = false; lastSent = ''; pushState(); trigger({ type: 'antic', name: 'dustoff', byUser: false }); } return; }
  if (tr.type === 'game-over') { gameUntil = 0; return; }
  if (tr.type === 'tb') { startTrick(tr.name); return; }
  if (tr.type === 'ground') { groundDrop = Number(tr.drop) || 0; return; }
  if (tr.type === 'game') { playCatch(); return; }
  trigger(tr);
});
ipcMain.on('set-ignore', (_e, ignore) => { TRACE('set-ignore', ignore, !!drag); if (win && !drag) win.setIgnoreMouseEvents(!!ignore, { forward: true }); });
ipcMain.on('drag-start', () => { TRACE('drag-start'); startDrag(); });
ipcMain.on('drag-end', () => { TRACE('drag-end', JSON.stringify(win.getBounds())); endDrag(); });
ipcMain.on('open-claude', openClaude);
ipcMain.on('open-reply', openReply);
ipcMain.on('open-diary', openDiary);
ipcMain.on('answer', (_e, ans) => answer(ans));
ipcMain.on('file-dropped', (_e, p) => fileDropped(p));
ipcMain.on('menu', showMenu);
ipcMain.on('close-me', (e) => { const w = BrowserWindow.fromWebContents(e.sender); if (w && w !== win) w.close(); });
ipcMain.on('fit-me', (e, h) => { const w = BrowserWindow.fromWebContents(e.sender); if (w && w !== win) fit(w, h); });
ipcMain.on('set-login', (_e, on) => setLogin(on));

// ---------- app ----------

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => { if (win) { hiddenUntil = 0; win.showInactive(); } });
  if (IS_MAC && app.dock) app.dock.hide();
  app.on('web-contents-created', (_e, wc) => {
    const page = () => { try { return path.basename(new URL(wc.getURL()).pathname, '.html') === 'index' ? path.basename(path.dirname(new URL(wc.getURL()).pathname)) : path.basename(new URL(wc.getURL()).pathname); } catch { return 'page'; } };
    wc.on('console-message', (ev) => { if (ev.level === 'error') logError(page(), `${ev.message} (${path.basename(String(ev.sourceId || ''))}:${ev.lineNumber})`); });
    wc.on('render-process-gone', (_ev, d) => logError(page(), 'window crashed: ' + d.reason));
    wc.on('preload-error', (_ev, p, err) => logError(page(), 'preload: ' + (err && err.message)));
    wc.on('will-navigate', (ev) => ev.preventDefault());
    wc.setWindowOpenHandler(() => ({ action: 'deny' }));
  });
  app.whenReady().then(() => {
    checkUnlocks(false);
    createWindow();
    watchState();
    watchCursor();
    watchDesktop();
    resolveAppId();
    screen.on('display-removed', () => { if (!validPos(...win.getPosition())) moveToCorner('bottom-right'); });
  });
  app.on('before-quit', () => { stopFgHelper(); try { fs.unlinkSync(path.join(STATE_DIR, '.alive')); } catch {} try { fs.writeFileSync(MEM_FILE, JSON.stringify(mem)); if (!DEBUG) fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2)); } catch {} });
  app.on('window-all-closed', () => app.quit());
}
