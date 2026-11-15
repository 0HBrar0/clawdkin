#!/usr/bin/env node
// Claude Code hook: tells Clawdkin what this session is doing.
//  - writes ~/.clawdkin/state/<session>.json (state, current tool, edits this turn, failures, pending question)
//  - appends one line per event to ~/.clawdkin/events.log (Clawdkin's memory and diary are built from it)
//  - `node hook.js sync` (PermissionRequest / AskUserQuestion only): if Quick reply is on and Clawdkin is
//    running, waits for you to answer on Clawdkin and returns that answer to Claude.
// Everything stays on this computer. It never blocks or fails Claude: any error or timeout falls
// through to Claude's normal flow.
const fs = require('fs');
const path = require('path');

const P = require('./paths');
const DIR = P.STATE;
const REQ = P.REQUESTS;
const LOG = P.LOG;
const SYNC = process.argv[2] === 'sync';
const ASK_TOOLS = { AskUserQuestion: 'question', ExitPlanMode: 'plan' };
const EDIT_TOOLS = new Set(['Edit', 'Write', 'NotebookEdit', 'MultiEdit']);
const TEST_RE = /\b(npm (run )?test|pnpm test|yarn test|pytest|jest|vitest|mocha|cargo test|go test|dotnet test|phpunit|rspec|unittest)\b/i;

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (d) => { raw += d; });
process.stdin.on('end', async () => {
  try {
    const h = JSON.parse(raw || '{}');
    if (SYNC) await quickReply(h); else handle(h);
  } catch {}
  process.exit(0);
});
if (!SYNC) setTimeout(() => process.exit(0), 4000).unref();

const clip = (s, n) => { s = String(s ?? ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
const readJson = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
const sidOf = (h) => String(h.session_id || 'unknown').replace(/[^\w.-]/g, '').slice(0, 80) || 'unknown';

const FULL = 4000; // longest command a Quick reply popup will show in full
function summarize(h) {
  const i = h.tool_input || {};
  if (i.command) return clip(i.command, FULL);
  if (i.file_path) return clip(i.file_path, 300);
  if (i.url) return clip(i.url, 300);
  if (i.pattern) return clip(i.pattern, 200);
  try { return clip(JSON.stringify(i), 300); } catch { return ''; }
}
// Can the user see everything they would approve? Only a command or address shown in full counts;
// file edits need Claude's own prompt, which shows the diff.
function fullyShown(h) {
  const i = h.tool_input || {};
  if (typeof i.command === 'string') return i.command.length <= FULL;
  if (typeof i.url === 'string') return Object.keys(i).every((k) => k === 'url' || k === 'prompt');
  return false;
}
// a few words on what a tool is working on: a file name, a command's description, a site
function targetOf(h) {
  const i = h.tool_input || {};
  const one = (s, n) => clip(String(s || '').replace(/\s+/g, ' ').trim(), n);
  if (i.file_path || i.notebook_path) return path.basename(String(i.file_path || i.notebook_path));
  if (i.description) return one(i.description, 48);
  if (i.command) return one(String(i.command).split(/[|;&\n]/)[0].replace(/=\S*/g, '=…'), 40);
  if (i.url) { try { return new URL(i.url).hostname.replace(/^www\./, ''); } catch { return ''; } }
  if (i.query) return one(i.query, 40);
  if (i.pattern) return one(i.pattern, 32);
  if (i.skill) return one(i.skill, 32);
  return '';
}
function gist(prompt) { return clip(String(prompt || '').replace(/\s+/g, ' ').trim(), 90); }
function questionsOf(h) {
  const qs = (h.tool_input && h.tool_input.questions) || [];
  return qs.slice(0, 4).map((q) => ({
    question: clip(q.question, 300),
    header: clip(q.header || '', 40),
    multi: !!q.multiSelect,
    options: (q.options || []).slice(0, 6).map((o) => ({ label: clip(o.label, 80), description: clip(o.description || '', 160) })),
  }));
}

function handle(h) {
  const ev = h.hook_event_name || '';
  const sid = sidOf(h);
  const file = path.join(DIR, sid + '.json');
  const now = Date.now();
  const prev = readJson(file);
  const cwd = h.cwd || (prev && prev.cwd) || '';
  const project = path.basename(cwd) || 'Claude';
  const tool = h.tool_name || '';

  // memory / diary feed
  const isFail = ev === 'PostToolUseFailure' && !h.is_interrupt;
  const isTest = isFail && TEST_RE.test(String((h.tool_input && h.tool_input.command) || ''));
  if (['UserPromptSubmit', 'PostToolUse', 'PostToolUseFailure', 'Stop', 'SessionStart'].includes(ev)) {
    try { fs.mkdirSync(P.HOME, { recursive: true }); if (fs.statSync(LOG, { throwIfNoEntry: false })?.size > 5e6) fs.renameSync(LOG, LOG + '.old'); fs.appendFileSync(LOG, JSON.stringify({ ts: now, ev, sid, project, tool, fail: isFail || undefined, test: isTest || undefined }) + '\n'); } catch {}
  }

  if (ev === 'SessionEnd') { try { fs.unlinkSync(file); } catch {} return; }

  let state = null, detail = '', ask = null;
  switch (ev) {
    case 'SessionStart': state = 'idle'; break;
    case 'UserPromptSubmit': case 'SubagentStart': case 'PreCompact':
    case 'PostToolUse': case 'PostToolUseFailure': case 'PermissionDenied':
      state = 'working'; detail = tool; break;
    case 'PreToolUse':
      if (ASK_TOOLS[tool]) {
        state = 'waiting'; detail = ASK_TOOLS[tool];
        if (tool === 'AskUserQuestion') ask = { kind: 'question', questions: questionsOf(h) };
      } else { state = 'working'; detail = tool; }
      break;
    case 'PermissionRequest':
      state = 'waiting'; detail = 'permission';
      ask = { kind: 'permission', tool, summary: summarize(h), full: fullyShown(h) };
      break;
    case 'Elicitation': state = 'waiting'; detail = 'question'; break;
    case 'Notification': {
      const type = h.notification_type || '';
      const msg = String(h.message || '').toLowerCase();
      if (type === 'permission_prompt' || (!type && msg.includes('permission'))) { state = 'waiting'; detail = 'permission'; }
      else if (type === 'elicitation_dialog' || type === 'agent_needs_input') { state = 'waiting'; detail = 'question'; }
      else return;
      break;
    }
    case 'Stop': state = 'done'; break;
    case 'StopFailure': state = 'idle'; detail = 'error'; break;
    default: return;
  }

  if (prev && prev.ts > now) return; // async hooks can finish out of order
  if (ev === 'Notification' && prev && (prev.state === 'done' || prev.state === 'idle')) return;

  const rec = { state, detail, event: ev, project, cwd, ts: now };
  // things that persist across a turn
  rec.turnStart = ev === 'UserPromptSubmit' ? now : (prev && prev.turnStart) || now;
  rec.edits = ev === 'UserPromptSubmit' ? 0 : (prev && prev.edits) || 0;
  rec.task = ev === 'UserPromptSubmit' ? gist(h.prompt) : (prev && prev.task) || '';
  rec.target = ev === 'UserPromptSubmit' ? '' : ev === 'PreToolUse' ? targetOf(h) : (prev && prev.target) || '';
  if (ev === 'PostToolUse' && EDIT_TOOLS.has(tool)) rec.edits++;
  rec.failTs = (prev && prev.failTs) || 0;
  rec.failKind = (prev && prev.failKind) || '';
  if (isFail) { rec.failTs = now; rec.failKind = isTest ? 'test' : 'tool'; }
  if (state === 'waiting') {
    rec.ask = ask || (prev && prev.state === 'waiting' ? prev.ask : null) || null;
    if (rec.ask && prev && prev.ask && prev.ask.reqId && !rec.ask.reqId && prev.ask.kind === rec.ask.kind) rec.ask.reqId = prev.ask.reqId;
  }
  write(file, rec);
}

// write atomically (temp file + rename). On Windows the rename can briefly fail while the app is
// reading the file, so retry a few times, and never leave the temp file behind.
function write(file, rec) {
  fs.mkdirSync(DIR, { recursive: true });
  const tmp = file + '.' + process.pid + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(rec));
  for (let i = 0; ; i++) {
    try { fs.renameSync(tmp, file); return; } catch (e) {
      if (i >= 8) { try { fs.unlinkSync(tmp); } catch {} throw e; }
      const until = Date.now() + 15 * (i + 1); while (Date.now() < until) { /* brief wait */ }
    }
  }
}

// ---- Quick reply: let the user answer on the buddy ----
async function quickReply(h) {
  const cfg = readJson(P.CONFIG) || {};
  if (!cfg.quickReply) return;
  const alive = readJson(P.ALIVE);
  if (!alive || Date.now() - alive.ts > 6000) return; // Clawdkin isn't running
  const ev = h.hook_event_name;
  const isQuestion = ev === 'PreToolUse' && h.tool_name === 'AskUserQuestion';
  if (!isQuestion && ev !== 'PermissionRequest') return;

  const sid = sidOf(h);
  const reqId = sid.slice(0, 12) + '-' + Date.now().toString(36) + '-' + process.pid;
  const reqFile = path.join(REQ, reqId + '.json');
  const resFile = path.join(REQ, reqId + '.answer.json');
  const cwd = h.cwd || '';
  const ask = isQuestion
    ? { kind: 'question', questions: questionsOf(h), reqId }
    : { kind: 'permission', tool: h.tool_name || '', summary: summarize(h), full: fullyShown(h), reqId };
  fs.mkdirSync(REQ, { recursive: true });
  fs.writeFileSync(reqFile, JSON.stringify({ ...ask, sid, project: path.basename(cwd) || 'Claude', ts: Date.now() }));
  const stateFile = path.join(DIR, sid + '.json');
  const prev = readJson(stateFile) || {};
  write(stateFile, { ...prev, state: 'waiting', detail: isQuestion ? 'question' : 'permission', event: ev, project: path.basename(cwd) || prev.project || 'Claude', cwd, ts: Date.now(), ask });

  const waitMs = Math.max(5, Math.min(120, +cfg.quickReplyWait || 20)) * 1000;
  const t0 = Date.now();
  let answer = null;
  while (Date.now() - t0 < waitMs) {
    await new Promise((r) => setTimeout(r, 150));
    answer = readJson(resFile);
    if (answer) break;
  }
  try { fs.unlinkSync(reqFile); } catch {}
  try { fs.unlinkSync(resFile); } catch {}
  if (!answer || answer.pass) return; // fall through to Claude's own prompt

  if (isQuestion) {
    if (!answer.answers) return;
    process.stdout.write(JSON.stringify({ hookSpecificOutput: {
      hookEventName: 'PreToolUse', permissionDecision: 'allow',
      updatedInput: { ...(h.tool_input || {}), answers: answer.answers },
    } }));
  } else if (answer.behavior === 'allow') {
    process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PermissionRequest', decision: { behavior: 'allow' } } }));
  } else if (answer.behavior === 'deny') {
    process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PermissionRequest', decision: { behavior: 'deny', message: 'Denied by the user from Clawdkin.' } } }));
  }
}
