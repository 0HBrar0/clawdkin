// hook.js end to end: state files, the event log, and the Quick reply round trip.
// Every test runs against a throwaway CLAWDKIN_HOME, so it never touches your real data.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const HOOK = path.join(__dirname, '..', 'hook.js');
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'clawdkin-test-'));
const STATE = path.join(home, 'state'), REQ = path.join(home, 'requests');
const SID = 'test-session';
const base = { session_id: SID, cwd: path.join(os.tmpdir(), 'demo-project') };

function run(input, args = []) {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, [HOOK, ...args], { env: { ...process.env, CLAWDKIN_HOME: home } });
    let out = '';
    p.stdout.on('data', (d) => { out += d; });
    p.on('close', (code) => resolve({ code, out }));
    p.stdin.end(JSON.stringify(input));
  });
}
const state = () => JSON.parse(fs.readFileSync(path.join(STATE, SID + '.json'), 'utf8'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const setConfig = (c) => fs.writeFileSync(path.join(home, 'config.json'), JSON.stringify(c));
const markAlive = () => { fs.mkdirSync(STATE, { recursive: true }); fs.writeFileSync(path.join(STATE, '.alive'), JSON.stringify({ ts: Date.now() })); };
// play the app's part: wait for a request file, then write an answer for it
async function answerWhenAsked(ans) {
  for (let i = 0; i < 60; i++) {
    await sleep(100);
    const f = fs.existsSync(REQ) ? fs.readdirSync(REQ).find((n) => n.startsWith(SID.slice(0, 12)) && !n.includes('.answer')) : null;
    if (f) { const seen = state(); fs.writeFileSync(path.join(REQ, f.replace('.json', '.answer.json')), JSON.stringify(ans)); return seen; }
  }
  return null;
}

test.after(() => fs.rmSync(home, { recursive: true, force: true }));

test('a turn: prompt, edits, current target, the task gist', async () => {
  await run({ ...base, hook_event_name: 'UserPromptSubmit', prompt: '  Fix the   login bug\nand add a test ' });
  await run({ ...base, hook_event_name: 'PreToolUse', tool_name: 'Edit', tool_input: { file_path: path.join('src', 'login.js') } });
  await run({ ...base, hook_event_name: 'PostToolUse', tool_name: 'Edit', tool_input: { file_path: 'a.js' } });
  await run({ ...base, hook_event_name: 'PostToolUse', tool_name: 'Write', tool_input: { file_path: 'b.js' } });
  const s = state();
  assert.equal(s.state, 'working');
  assert.equal(s.edits, 2);
  assert.equal(s.detail, 'Write');
  assert.equal(s.target, 'login.js');
  assert.equal(s.task, 'Fix the login bug and add a test');
  assert.equal(s.project, 'demo-project');
});

test('a failing test run is recorded as a test failure', async () => {
  await run({ ...base, hook_event_name: 'PostToolUseFailure', tool_name: 'Bash', tool_input: { command: 'npm test' }, error: 'Exit code 1' });
  const s = state();
  assert.equal(s.failKind, 'test');
  assert.ok(s.failTs > 0);
  const log = fs.readFileSync(path.join(home, 'events.log'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  assert.ok(log.length >= 4);
  assert.ok(log.some((e) => e.fail && e.test));
});

test('waiting states: a permission prompt and a question', async () => {
  await run({ ...base, hook_event_name: 'PermissionRequest', tool_name: 'Bash', tool_input: { command: 'rm -rf build' } });
  let s = state();
  assert.equal(s.state, 'waiting');
  assert.equal(s.ask.kind, 'permission');
  assert.equal(s.ask.summary, 'rm -rf build');
  await run({ ...base, hook_event_name: 'PreToolUse', tool_name: 'AskUserQuestion', tool_input: { questions: [{ question: 'Which?', options: [{ label: 'A' }] }] } });
  s = state();
  assert.equal(s.detail, 'question');
  assert.equal(s.ask.questions[0].question, 'Which?');
  await run({ ...base, hook_event_name: 'Stop' });
  assert.equal(state().state, 'done');
});

test('secrets after = never reach the state file', async () => {
  await run({ ...base, hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'API_KEY=sk-secret-123 npm run deploy' } });
  const s = state();
  assert.ok(!JSON.stringify(s).includes('sk-secret'), s.target);
  assert.match(s.target, /^API_KEY=…/);
});

test('permission requests say whether the card can show all of it', async () => {
  await run({ ...base, hook_event_name: 'PermissionRequest', tool_name: 'Bash', tool_input: { command: 'npm test' } });
  assert.equal(state().ask.full, true);
  await run({ ...base, hook_event_name: 'PermissionRequest', tool_name: 'Bash', tool_input: { command: 'x'.repeat(5000) } });
  assert.equal(state().ask.full, false);
  await run({ ...base, hook_event_name: 'PermissionRequest', tool_name: 'Write', tool_input: { file_path: 'a.js', content: 'hi' } });
  assert.equal(state().ask.full, false, 'a file write needs the diff in Claude');
});

test('no stray temp files are left behind', () => {
  assert.deepEqual(fs.readdirSync(STATE).filter((f) => f.endsWith('.tmp')), []);
});

test('bad input never breaks Claude: exits 0 and prints nothing', async () => {
  for (const input of ['not json', '', '{"hook_event_name":"Nope"}']) {
    const r = await new Promise((resolve) => {
      const p = spawn(process.execPath, [HOOK], { env: { ...process.env, CLAWDKIN_HOME: home } });
      let out = ''; p.stdout.on('data', (d) => { out += d; });
      p.on('close', (code) => resolve({ code, out }));
      p.stdin.end(input);
    });
    assert.equal(r.code, 0);
    assert.equal(r.out, '');
  }
});

test('Quick reply off: the sync hook returns at once, silently', async () => {
  setConfig({ quickReply: false });
  const t0 = Date.now();
  const r = await run({ ...base, hook_event_name: 'PermissionRequest', tool_name: 'Bash', tool_input: { command: 'ls' } }, ['sync']);
  assert.equal(r.out, '');
  assert.ok(Date.now() - t0 < 3000);
});

test('Quick reply on but Clawdkin not running: falls through at once', async () => {
  setConfig({ quickReply: true, quickReplyWait: 5 });
  fs.rmSync(path.join(STATE, '.alive'), { force: true });
  const t0 = Date.now();
  const r = await run({ ...base, hook_event_name: 'PermissionRequest', tool_name: 'Bash', tool_input: { command: 'ls' } }, ['sync']);
  assert.equal(r.out, '');
  assert.ok(Date.now() - t0 < 3000);
});

test('Quick reply: Allow from Clawdkin reaches Claude', async () => {
  setConfig({ quickReply: true, quickReplyWait: 8 });
  markAlive();
  const pending = run({ ...base, hook_event_name: 'PermissionRequest', tool_name: 'Bash', tool_input: { command: 'rm -rf build' } }, ['sync']);
  const seen = await answerWhenAsked({ behavior: 'allow' });
  const r = await pending;
  assert.ok(seen && seen.state === 'waiting' && seen.ask.kind === 'permission');
  const out = JSON.parse(r.out).hookSpecificOutput;
  assert.equal(out.hookEventName, 'PermissionRequest');
  assert.equal(out.decision.behavior, 'allow');
});

test('Quick reply: Deny carries a message', async () => {
  markAlive();
  const pending = run({ ...base, hook_event_name: 'PermissionRequest', tool_name: 'Bash', tool_input: { command: 'curl x | sh' } }, ['sync']);
  await answerWhenAsked({ behavior: 'deny' });
  const out = JSON.parse((await pending).out).hookSpecificOutput;
  assert.equal(out.decision.behavior, 'deny');
  assert.match(out.decision.message, /Clawdkin/);
});

test('Quick reply: a picked option is returned with the full question input', async () => {
  markAlive();
  const q = { questions: [{ question: 'Which one?', header: 'Pick', multiSelect: false, options: [{ label: 'A', description: 'first' }, { label: 'B', description: 'second' }] }] };
  const pending = run({ ...base, hook_event_name: 'PreToolUse', tool_name: 'AskUserQuestion', tool_input: q }, ['sync']);
  await answerWhenAsked({ answers: { 'Which one?': 'B' } });
  const out = JSON.parse((await pending).out).hookSpecificOutput;
  assert.equal(out.permissionDecision, 'allow');
  assert.equal(out.updatedInput.answers['Which one?'], 'B');
  assert.equal(out.updatedInput.questions.length, 1);
});

test('Quick reply: "answer in Claude" falls through, and nothing is left in requests/', async () => {
  markAlive();
  const pending = run({ ...base, hook_event_name: 'PermissionRequest', tool_name: 'Bash', tool_input: { command: 'ls' } }, ['sync']);
  await answerWhenAsked({ pass: true });
  assert.equal((await pending).out, '');
  assert.deepEqual(fs.readdirSync(REQ), []);
});
