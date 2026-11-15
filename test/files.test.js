// Cheap whole-project checks: every script parses, and every file an HTML page loads exists.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git'].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}
const files = walk(ROOT);

test('every JavaScript file parses', () => {
  for (const f of files.filter((f) => f.endsWith('.js'))) {
    const r = spawnSync(process.execPath, ['--check', f], { encoding: 'utf8' });
    assert.equal(r.status, 0, `${path.relative(ROOT, f)}\n${r.stderr}`);
  }
});

test('every script and stylesheet an HTML page loads exists', () => {
  for (const f of files.filter((f) => f.endsWith('.html'))) {
    const html = fs.readFileSync(f, 'utf8');
    for (const [, ref] of html.matchAll(/(?:src|href)="([^"#?:]+\.(?:js|css))"/g)) {
      assert.ok(fs.existsSync(path.join(path.dirname(f), ref)), `${path.relative(ROOT, f)} loads ${ref}, which does not exist`);
    }
  }
});

test('no personal paths or old names are left in the source', () => {
  for (const f of files.filter((f) => /\.(js|html|css|ps1|vbs|json|md)$/.test(f) && !f.endsWith('package-lock.json') && f !== __filename)) {
    const s = fs.readFileSync(f, 'utf8');
    assert.ok(!/[A-Z]:\\\\void|[A-Z]:\/void|claudeBuddyApi|Claude Buddy/.test(s), `${path.relative(ROOT, f)} still mentions an old path or name`);
  }
});
