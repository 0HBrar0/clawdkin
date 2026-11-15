// Records the README media: renders Clawdkin off-screen in demo mode and saves frames as PNGs.
//   npx electron dev/record.js <scene> <out-dir>      scenes: hero, tricks, forms
// dev/make-media.ps1 runs this for every scene and turns the frames into the GIFs in docs/.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const [scene = 'hero', outDir = path.join(__dirname, 'frames')] = process.argv.slice(2).filter((a) => !a.startsWith('--') && !a.endsWith('record.js') && a !== '.');
const ZOOM = 2, FPS = 25;
const PAGE = path.join(__dirname, '..', 'renderer', 'index.html');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// each step: [at seconds, js to run in the page]
const hoverOn = "window.dispatchEvent(new MouseEvent('mousemove', { clientX: 75, clientY: 128 }))";
const hoverOff = "document.dispatchEvent(new MouseEvent('mouseleave'))";
const SCENES = {
  hero: { form: 'spark', secs: 13.5, steps: [
    [0.0, "__buddy.state('idle')"],
    [1.2, "__buddy.set({ state: 'working', detail: 'Edit', tool: 'Edit', target: 'login.ts', task: 'fix the login bug and add a test', project: 'my-app', edits: 3, turnStart: Date.now() - 4 * 60000 })"],
    [2.6, hoverOn],
    [5.6, hoverOff],
    [6.0, "__buddy.set({ state: 'waiting', detail: 'permission', target: 'npm test', hasAsk: false })"],
    [8.6, "__buddy.set({ state: 'done', detail: '' })"],
    [10.2, "__buddy.set({ state: 'idle', task: '', target: '', tool: '' })"],
    [10.4, "__buddy.antic('sneeze')"],
    [12.3, "__buddy.form('clawd')"],
  ] },
  tricks: { form: 'clawd', secs: 15.5, steps: [
    [0.2, "__buddy.antic('juggle')"],
    [4.3, "__buddy.antic('flip')"],
    [6.6, "__buddy.form('glyph')"],
    [8.4, "__buddy.antic('sing')"],
    [11.6, "__buddy.form('prompt')"],
    [13.2, "__buddy.antic('wave')"],
  ] },
};

async function record(name) {
  const sc = SCENES[name];
  const W = 150 * ZOOM, H = 170 * ZOOM;
  const w = new BrowserWindow({ width: W, height: H, show: false, transparent: true, backgroundColor: '#00000000', webPreferences: { offscreen: true, zoomFactor: ZOOM } });
  w.webContents.setFrameRate(60);
  await w.loadFile(PAGE, { query: { calm: '1', form: sc.form, bg: 'transparent' } });
  await w.webContents.executeJavaScript('__buddy.cfg({ sfx: false })');
  await wait(1200);
  fs.mkdirSync(outDir, { recursive: true });
  let latest = null;
  w.webContents.on('paint', (_e, _dirty, image) => { latest = image; });
  w.webContents.invalidate();
  const t0 = Date.now();
  let n = 0, si = 0;
  while ((Date.now() - t0) / 1000 < sc.secs) {
    const t = (Date.now() - t0) / 1000;
    while (si < sc.steps.length && sc.steps[si][0] <= t) await w.webContents.executeJavaScript(sc.steps[si++][1]);
    if (latest) fs.writeFileSync(path.join(outDir, `f${String(n).padStart(4, '0')}.png`), latest.toPNG());
    n++;
    const next = t0 + (n * 1000) / FPS;
    await wait(Math.max(0, next - Date.now()));
  }
  console.log(`${name}: ${n} frames at ${FPS} fps -> ${outDir}`);
  w.destroy();
}

// all nine forms side by side, for a still image
async function forms() {
  const names = ['spark', 'glyph', 'doodle', 'clawd', 'prompt', 'origami', 'blocks', 'glass', 'moon'];
  fs.mkdirSync(outDir, { recursive: true });
  const w = new BrowserWindow({ width: 150 * ZOOM, height: 170 * ZOOM, show: false, transparent: true, backgroundColor: '#00000000', webPreferences: { offscreen: true, zoomFactor: ZOOM } });
  let latest = null;
  w.webContents.on('paint', (_e, _d, image) => { latest = image; });
  await w.loadFile(PAGE, { query: { calm: '1', form: names[0], bg: 'transparent' } });
  await w.webContents.executeJavaScript('__buddy.cfg({ sfx: false })');
  for (const f of names) {
    await w.webContents.executeJavaScript(`__buddy.snap('${f}')`);
    await wait(1600);
    fs.writeFileSync(path.join(outDir, `${f}.png`), latest.toPNG());
  }
  w.destroy();
  console.log(`forms -> ${outDir}`);
}

app.whenReady().then(async () => {
  try { if (scene === 'forms') await forms(); else await record(scene); } catch (e) { console.error(e); process.exitCode = 1; }
  app.quit();
});
