// Taskbar tricks: the buddy hops down in front of the taskbar to hide one of your apps, swims through it
// like a shark, plays hopscotch on the app icons, pushes Start, naps on the clock, guards Claude.
// Main hands in what it needs; this file only moves the window and cues the renderer's poses.
const { execFile } = require('child_process');
const path = require('path');

module.exports = function createTaskbarTricks(ctx) {
  const { screen, getWin, scale, winSize, moveWin, walkTo, stopWalk, trigger } = ctx;
  const idleSec = ctx.idleSec || (() => 999), allowPoke = ctx.allowPoke || (() => false);
  const CX = 75; // buddy's centre column inside the window (viewBox units)
  let run = null; // { cancelled, timers:Set, inFront, name }

  // ---------- reading the taskbar ----------
  let lastLayout = null, lastAt = 0;
  async function readLayout() {
    for (let i = 0; i < 2; i++) {
      const L = await readOnce();
      if (L && L.fullscreen) return L;
      if (L) { lastLayout = L; lastAt = Date.now(); return L; }
    }
    return lastLayout && Date.now() - lastAt < 10 * 60000 ? lastLayout : null;
  }
  function readOnce() {
    return new Promise((resolve) => {
      execFile('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'tools', 'taskbar.ps1')],
        { windowsHide: true, timeout: 8000 }, (err, stdout) => {
          try {
            const j = JSON.parse(String(stdout).trim());
            if (!j.ok) return resolve(j.fullscreen ? { fullscreen: true } : null);
            const dip = (r) => (r ? screen.screenToDipRect(null, { x: r.x, y: r.y, width: r.w, height: r.h }) : null);
            const apps = (j.apps || []).map((a) => ({ running: /running/i.test(a.name), claude: /^claude\b/i.test(a.name), r: dip(a.r) }))
              .filter((a) => a.r && a.r.width > 0);
            resolve({ bar: dip(j.bar), start: dip(j.start), clock: dip(j.clock), chevron: dip(j.chevron), apps });
          } catch { resolve(null); }
        });
    });
  }

  // ---------- where things are ----------
  function geo() {
    const win = getWin(), b = win.getBounds(), d = screen.getDisplayMatching(b);
    const { width, height } = winSize(), s = scale();
    const top = d.workArea.y + d.workArea.height - height;   // standing on top of the taskbar
    const front = d.bounds.y + d.bounds.height - height;     // standing in front of it, feet on the screen edge
    const xFor = (cx) => Math.round(cx - CX * s);              // window x that puts the buddy's middle at cx
    const midX = () => win.getBounds().x + CX * s;
    return { b, d, s, width, height, top, front, xFor, midX, barAtBottom: d.workArea.y + d.workArea.height < d.bounds.y + d.bounds.height - 4 };
  }

  // ---------- cancellable steps ----------
  const CANCEL = Symbol('cancel');
  function step(fn) { return new Promise((res, rej) => { if (!run || run.cancelled) return rej(CANCEL); fn(res, rej); }); }
  function pause(ms) { return step((res) => { const t = setTimeout(() => { run && run.timers.delete(t); res(); }, ms); run.timers.add(t); }); }
  function walk(x, speed) { return step((res, rej) => walkTo(Math.round(x), speed, res, () => rej(CANCEL))); }
  function antic(name, arg) { trigger({ type: 'antic', name, byUser: false, arg }); }
  // hop along an arc to (x, y)
  function hop(x, y, ms = 480, arc = 26, arg) {
    return step((res) => {
      const win = getWin(), a = win.getBounds(), t0 = Date.now();
      antic('tb-hop', arg);
      const t = setInterval(() => {
        const k = Math.min(1, (Date.now() - t0) / ms), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        moveWin(a.x + (x - a.x) * e, a.y + (y - a.y) * e - arc * Math.sin(k * Math.PI));
        if (k >= 1) { clearInterval(t); run && run.timers.delete(t); res(); }
      }, 16);
      run.timers.add(t);
    });
  }
  // slide at a constant height (the shark)
  function glide(x, ms) {
    return step((res) => {
      const win = getWin(), a = win.getBounds(), t0 = Date.now();
      const t = setInterval(() => {
        const k = Math.min(1, (Date.now() - t0) / ms), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        moveWin(a.x + (x - a.x) * e, a.y);
        if (k >= 1) { clearInterval(t); run && run.timers.delete(t); res(); }
      }, 16);
      run.timers.add(t);
    });
  }
  function raise() { const w = getWin(); if (w && !w.isDestroyed()) { w.setAlwaysOnTop(true, 'screen-saver'); w.moveTop(); } }
  function keepRaised(on) {
    if (run.raiser) { clearInterval(run.raiser); run.timers.delete(run.raiser); run.raiser = null; }
    if (on) { raise(); run.raiser = setInterval(raise, 350); run.timers.add(run.raiser); }
  }
  async function downInFront(cx, g) { keepRaised(true); await hop(g.xFor(cx), g.front, 520, 22); run.inFront = true; }
  async function backOnTop(g) { run.inFront = false; await hop(getWin().getBounds().x, g.top, 420, 30); keepRaised(false); }
  async function home(g, homeX, speed = 160) { await walk(homeX, speed); }

  // ---------- pressing real buttons ----------
  function pokeRaw(action) {
    return new Promise((resolve) => execFile('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'tools', 'poke.ps1'), action],
      { windowsHide: true, timeout: 8000 }, (err, out) => resolve(String(out || '').trim() || 'error')));
  }
  async function openThing(what) { // 'start' | 'tray'
    const res = await pokeRaw(what + '-open');
    if (process.env.CLAWDKIN_DEBUG) console.log('[clawdkin] pressed', what + '-open', '->', res);
    if (res === 'done' && run && !run.cancelled && run.name !== 'escape') run.opened = what;
    else if (res === 'done') pokeRaw(what + '-close'); // cancelled meanwhile: undo at once
    return res === 'done';
  }
  async function closeThing(r) { const what = r && r.opened; if (!what) return; r.opened = null; const res = await pokeRaw(what + '-close'); if (process.env.CLAWDKIN_DEBUG) console.log('[clawdkin] pressed', what + '-close', '->', res); }
  // on its own it only presses buttons when you have been away from the keyboard a while
  const mayPoke = (manual) => allowPoke() && (manual || idleSec() >= 30);

  // ---------- the tricks ----------
  const pickApp = (L, pred) => { const xs = L.apps.filter(pred); return xs.length ? xs[Math.floor(Math.random() * xs.length)] : null; };
  const centre = (r) => r.x + r.width / 2;

  const TRICKS = {
    async oops(L, g, homeX, manual) { // leans on Start a bit too hard: the Start menu pops open. Oops. Closes it, whistling.
      if (!L.start || !mayPoke(manual)) return false;
      const dir = centre(L.start) < g.midX() ? -1 : 1;
      const cx = dir < 0 ? L.start.x + L.start.width + 20 * g.s : L.start.x - 20 * g.s;
      await walk(g.xFor(cx), 170);
      await downInFront(cx, g);
      antic('tb-oops', { dir });
      await pause(350);
      const opened = await step((res) => openThing('start').then(res));
      if (opened) { await pause(2100); const r = run; await step((res) => closeThing(r).then(res)); }
      antic('tb-innocent', { dir }); await pause(1900);
      await backOnTop(g); await home(g, homeX);
      return true;
    },
    async peek(L, g, homeX, manual) { // tugs the hidden-icons flyout open, has a look, tucks it away again
      if (!L.chevron || !mayPoke(manual)) return false;
      const cx = centre(L.chevron);
      await walk(g.xFor(cx), 150);
      await downInFront(cx, g);
      antic('tb-tug'); await pause(500);
      const opened = await step((res) => openThing('tray').then(res));
      antic('tb-peek'); await pause(2300);
      if (opened) { const r = run; await step((res) => closeThing(r).then(res)); }
      antic('tb-shh'); await pause(1500);
      await backOnTop(g); await home(g, homeX);
      return true;
    },
    async hide(L, g, homeX) { // hide one of your apps, then reveal it
      const app = pickApp(L, (a) => a.running && !a.claude) || pickApp(L, () => true);
      if (!app) return false;
      const cx = centre(app.r);
      await walk(g.xFor(cx), 170);
      await downInFront(cx, g);
      antic('tb-hide'); await pause(5000);
      const dir = cx < g.d.bounds.x + g.d.bounds.width / 2 ? 1 : -1; // step aside towards the middle of the screen
      await hop(g.xFor(cx + dir * (app.r.width * 0.5 + 34 * g.s)), g.front, 380, 16);
      antic('tb-tada', { dir }); await pause(1400);
      await backOnTop(g); await home(g, homeX);
      return true;
    },
    async shark(L, g, homeX) { // dive in, glide along with only a fin showing, pop up somewhere else
      const app = pickApp(L, () => true);
      if (!app) return false;
      const cx = centre(app.r), dir = cx > g.midX() ? 1 : -1;
      keepRaised(true);
      antic('tb-sink'); await pause(750);
      antic('tb-fin', { dir });
      await glide(g.xFor(cx), Math.min(2700, Math.max(1200, Math.abs(cx - g.midX()) * 4)));
      antic('tb-pop'); await pause(1400); keepRaised(false);
      await home(g, homeX, 170);
      return true;
    },
    async hopscotch(L, g, homeX) { // hop along the app icons, counting
      if (L.apps.length < 2) return false;
      const xs = L.apps.map((a) => centre(a.r)).sort((p, q) => p - q);
      const near = Math.abs(xs[0] - g.midX()) < Math.abs(xs[xs.length - 1] - g.midX());
      const order = (near ? xs : xs.reverse()).slice(0, 7);
      await walk(g.xFor(order[0]) + (near ? -1 : 1) * 40 * g.s, 110);
      keepRaised(true);
      for (let i = 0; i < order.length; i++) { await hop(g.xFor(order[i]), g.top, 380, 30, { n: i + 1 }); await pause(120); }
      antic('tb-tada', { dir: near ? 1 : -1 }); await pause(1300); keepRaised(false);
      await home(g, homeX, 170);
      return true;
    },
    async push(L, g, homeX) { // lean on the Start button
      if (!L.start) return false;
      const dir = centre(L.start) < g.midX() ? -1 : 1; // which way Start is
      const cx = dir < 0 ? L.start.x + L.start.width + 22 * g.s : L.start.x - 22 * g.s;
      await walk(g.xFor(cx), 170);
      await downInFront(cx, g);
      antic('tb-push', { dir }); await pause(3500);
      await backOnTop(g); await home(g, homeX, 170);
      return true;
    },
    async nap(L, g, homeX) { // curl up in front of the clock
      if (!L.clock) return false;
      const cx = Math.min(centre(L.clock), g.d.bounds.x + g.d.bounds.width - 30 * g.s);
      await walk(g.xFor(cx), 140);
      await downInFront(cx, g);
      antic('tb-nap'); await pause(6100);
      await backOnTop(g); await home(g, homeX);
      return true;
    },
    async guard(L, g, homeX) { // stand guard in front of Claude
      const app = L.apps.find((a) => a.claude);
      if (!app) return false;
      const cx = centre(app.r);
      await walk(g.xFor(cx), 170);
      await downInFront(cx, g);
      antic('tb-guard'); await pause(3700);
      await backOnTop(g); await home(g, homeX);
      return true;
    },
  };
  const NAMES = [['oops', 'Oops, opens Start'], ['peek', 'Peek at the hidden icons'], ['hide', 'Hide one of my apps'], ['shark', 'Taskbar shark'], ['hopscotch', 'Hopscotch on the icons'], ['push', 'Push the Start button'], ['nap', 'Nap on the clock'], ['guard', 'Guard Claude']];

  // ---------- running one ----------
  async function start(name, homeX, onEnd) {
    if (run) return false;
    const g0 = geo();
    if (!g0.barAtBottom) return 'no-bar';
    if (Math.abs(g0.b.y - g0.top) > 6) return 'not-on-bar';
    run = { cancelled: false, timers: new Set(), inFront: false, name };
    const me = run;
    trigger({ type: 'tb', on: true });
    let ok = false, result = null;
    try {
      const L = await readLayout();
      if (L && L.fullscreen) { result = 'fullscreen'; throw CANCEL; }
      if (!L || me.cancelled) throw CANCEL;
      const names = name ? [name] : NAMES.map(([k]) => k).sort(() => Math.random() - 0.5);
      for (const n of names) { if (await TRICKS[n](L, geo(), homeX, !!name)) { ok = true; break; } }
    } catch (e) { if (e !== CANCEL) console.error('[clawdkin] taskbar trick', e); }
    closeThing(me);
    if (run === me) { run = null; trigger({ type: 'tb', on: false }); }
    if (onEnd) onEnd(ok);
    return result || ok;
  }
  // stop: clear everything; if it is in front of the taskbar, get back on top first
  function cancel(goHome, homeX, startled) {
    if (!run) return false;
    const me = run, wasFront = me.inFront;
    me.cancelled = true;
    closeThing(me);
    for (const t of me.timers) { clearTimeout(t); clearInterval(t); }
    stopWalk();
    run = null;
    if (!goHome) { trigger({ type: 'tb', on: false }); if (wasFront) { const g = geo(); moveWin(g.b.x, g.top); } return true; }
    // run a tiny escape sequence of its own
    run = { cancelled: false, timers: new Set(), inFront: wasFront, name: 'escape' };
    const esc = run;
    (async () => {
      try {
        const g = geo();
        if (startled) { antic('tb-eep'); await pause(250); }
        if (esc.inFront) await backOnTop(g);
        await walk(homeX, startled ? 260 : 200);
      } catch {}
      if (run === esc) { run = null; trigger({ type: 'tb', on: false }); }
    })();
    return true;
  }
  // called with the cursor position: flee if the mouse comes near while it is hiding something
  function onCursor(p) {
    if (!run || !run.inFront || run.name === 'escape') return false;
    const g = geo(), b = g.b;
    const dx = p.x - (b.x + CX * g.s), dy = p.y - (b.y + b.height * 0.75);
    return Math.hypot(dx, dy) < 95 * g.s;
  }
  return { start, cancel, onCursor, active: () => !!run, opened: () => !!(run && run.opened), NAMES, readLayout };
};
