// install-hooks.js: merges into an existing settings file, never duplicates, removes cleanly.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { isOurs, EVENTS } = require('../install-hooks');

const SCRIPT = path.join(__dirname, '..', 'install-hooks.js');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'clawdkin-settings-'));
const file = path.join(dir, 'settings.json');
const run = (...args) => spawnSync(process.execPath, [SCRIPT, '--settings', file, '--quiet', ...args], { encoding: 'utf8' });
const read = () => JSON.parse(fs.readFileSync(file, 'utf8'));
const countOurs = (s) => Object.values(s.hooks || {}).flat().flatMap((g) => g.hooks).filter((h) => isOurs(h.command)).length;

// someone else's hook and other settings that must survive
const theirs = { model: 'opus', hooks: { Stop: [{ hooks: [{ type: 'command', command: 'say done' }] }] } };

test.after(() => fs.rmSync(dir, { recursive: true, force: true }));

test('installs into an existing file and keeps what was there', () => {
  fs.writeFileSync(file, JSON.stringify(theirs, null, 2));
  assert.equal(run().status, 0);
  const s = read();
  assert.equal(s.model, 'opus');
  assert.ok(s.hooks.Stop.some((g) => g.hooks.some((h) => h.command === 'say done')));
  assert.equal(countOurs(s), EVENTS.length + 2); // one async hook per event, plus two Quick reply hooks
  assert.ok(fs.existsSync(file + '.clawdkin-backup'));
});

test('the command uses an absolute node path and forward slashes', () => {
  const cmd = read().hooks.SessionStart.flatMap((g) => g.hooks).find((h) => isOurs(h.command)).command;
  assert.match(cmd, /^"[^"]*node(\.exe)?" "[^"]*\/hook\.js"$/i);
  assert.ok(!cmd.includes('\\'));
  const sync = read().hooks.PermissionRequest.flatMap((g) => g.hooks).find((h) => / sync$/.test(h.command));
  assert.ok(sync && !sync.async, 'the Quick reply hook must not be async');
});

test('running it again does not add duplicates', () => {
  run(); run();
  assert.equal(countOurs(read()), EVENTS.length + 2);
});

test('uninstall removes only our hooks', () => {
  assert.equal(run('--uninstall').status, 0);
  const s = read();
  assert.equal(countOurs(s), 0);
  assert.deepEqual(s, theirs);
});

test('refuses to touch a settings file that is not valid JSON', () => {
  fs.writeFileSync(file, '{ "hooks": ');
  const r = run();
  assert.equal(r.status, 1);
  assert.equal(fs.readFileSync(file, 'utf8'), '{ "hooks": ');
});

test('accepts a settings file saved with a byte-order mark', () => {
  fs.writeFileSync(file, '\uFEFF' + JSON.stringify(theirs));
  assert.equal(run().status, 0);
  assert.equal(read().model, 'opus');
});

test('writes through a symlinked settings file and keeps the link', (t) => {
  const real = path.join(dir, 'real-settings.json'), link = path.join(dir, 'linked.json');
  fs.writeFileSync(real, JSON.stringify(theirs));
  try { fs.symlinkSync(real, link); } catch { t.skip('cannot create symlinks here'); return; }
  const r = spawnSync(process.execPath, [SCRIPT, '--settings', link, '--quiet'], { encoding: 'utf8' });
  assert.equal(r.status, 0);
  assert.ok(fs.lstatSync(link).isSymbolicLink(), 'the link is still a link');
  assert.equal(countOurs(JSON.parse(fs.readFileSync(real, 'utf8'))), EVENTS.length + 2);
});

test('creates the settings file if there is none', () => {
  fs.rmSync(file);
  assert.equal(run().status, 0);
  assert.equal(countOurs(read()), EVENTS.length + 2);
});
