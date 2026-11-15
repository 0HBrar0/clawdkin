// Clawdkin — the engine. One rAF loop blends motion toward the current state, runs tricks
// and reactions, morphs between forms, and drives everything drawn around the buddy.
(() => {
  const api = window.clawdkinApi || null; // null in a plain browser (demo mode)
  const $ = (id) => document.getElementById(id);
  const formG = $('form'), morphG = $('morph'), blobG = $('blob'), bodyG = $('body'), fxG = $('fx');
  const shadow = $('shadow'), hole = $('hole'), zzz = $('zzz');
  const bubble = $('bubble'), bubbleText = $('bubble-text'), stage = $('stage');
  const thought = BB.Thought($('thoughtLayer'));
  let thoughtOn = false, thoughtLines = ['', '', ''], thoughtAt = 0;
  const liftG = $('lift'), groundRect = $('groundRect');
  // Lowest point of each form (measured), so it can stand on its shadow. GROUND is where the feet go.
  const FOOT = { spark: 40.5, glyph: 42, doodle: 42, clawd: 40, prompt: 25.5, origami: 42.5, blocks: 31.5, glass: 36.5, moon: 31 };
  const GROUND = 56.5;
  const footOf = (n) => FOOT[n] != null ? FOOT[n] : 40;
  const HEIGHT = { spark: 82, glyph: 84, doodle: 87, clawd: 50, prompt: 50, origami: 85, blocks: 64, glass: 73, moon: 62 };
  let sink = null, sentSink = null;
  const { lerp, clamp, seg, easeInOut, easeOutBack, fx2 } = BB;

  let cfg = {
    form: 'auto', currentForm: 'spark', evolveMinutes: 15, silliness: 2, theme: 'terracotta',
    followMouse: true, sfx: true, volume: 0.4, sleep: true, sleepMinutes: 8, showLabel: true, opacity: 1, scale: 1,
    hat: 'auto', birthday: '', unlockAll: false, showProps: true, showTrail: true, nightLamp: true, bestCatch: 0,
  };
  // latest facts from the main process
  let st = { state: 'idle', detail: '', label: 'Idle — click to open Claude', sessions: [], tool: '', edits: 0, turnStart: 0, failTs: 0, failKind: '', mood: 'content', hasAsk: false, unlocked: ['spark', 'glyph', 'doodle', 'clawd'] };

  const TARGETS = {
    idle:    { spin: 0,    wave: 0, breath: 0.035, flare: 0,     hop: 0, glow: 0,    sway: 1,   sleep: 0, eyeRy: 3.3 },
    working: { spin: 1.25, wave: 1, breath: 0.01,  flare: -0.02, hop: 0, glow: 0.28, sway: 0,   sleep: 0, eyeRy: 2.7 },
    waiting: { spin: 0,    wave: 0, breath: 0.02,  flare: 0.13,  hop: 1, glow: 1,    sway: 0,   sleep: 0, eyeRy: 3.6 },
    done:    { spin: 0,    wave: 0, breath: 0.03,  flare: 0.08,  hop: 0, glow: 0.55, sway: 0,   sleep: 0, eyeRy: 3.3 },
    sleep:   { spin: 0,    wave: 0, breath: 0.05,  flare: -0.1,  hop: 0, glow: 0,    sway: 0.4, sleep: 1, eyeRy: 3.3 },
  };
  const cur = { ...TARGETS.idle };

  let shown = 'idle';
  let lastActive = performance.now();
  let hovering = false, dragging = false;
  let t = 0, last = performance.now(), lastDraw = 0;
  let userIdle = false; // the person has been away from the computer for a while

  // ---------- forms & smooth morphing ----------
  let formName = null, formInst = null, morph = null;
  let nextEvolveAt = performance.now() + cfg.evolveMinutes * 60000;
  let flash = null;
  const blobPath = BB.el('path', {}, blobG);
  const blobFace = BB.makeFace(blobG, { scale: 0.95 });
  const OUT_N = 144;
  const outline = (name) => {
    const fn = (BB.forms[name] && BB.forms[name].radius) || BB.circR(22);
    const a = new Float32Array(OUT_N);
    for (let i = 0; i < OUT_N; i++) a[i] = fn((i / OUT_N) * Math.PI * 2);
    return a;
  };

  const available = () => (cfg.unlockAll ? BB.FORM_ORDER : BB.FORM_ORDER.filter((f) => (st.unlocked || []).includes(f)));
  const wantedForm = () => {
    const w = cfg.form === 'auto' ? cfg.currentForm || 'spark' : cfg.form;
    return available().includes(w) ? w : 'spark';
  };
  function mountForm(name) {
    if (!BB.forms[name]) name = 'spark';
    while (formG.firstChild) formG.firstChild.remove();
    formName = name;
    formInst = BB.forms[name].build(formG);
    BB.sfx.voice = BB.forms[name].voice || 'chime';
  }
  function requestForm(name, announce) {
    if (!BB.forms[name]) return;
    if (!formInst) { mountForm(name); return; }
    if (morph) { if (!morph.swapped) { morph.toName = name; morph.to = outline(name); morph.announce = announce; } return; }
    if (name === formName) return;
    if (antic) endAntic();
    morph = { fromName: formName, from: outline(formName), to: outline(name), fromCy: BB.forms[formName].cy || 0, toCy: BB.forms[name].cy || 0, toName: name, t0: performance.now(), swapped: false, announce };
    BB.sfx.play('morph');
  }
  function nextFormName() {
    const order = available();
    return order[(order.indexOf(formName) + 1) % order.length] || 'spark';
  }
  function transformNow() {
    const next = nextFormName();
    if (cfg.form === 'auto') { cfg.currentForm = next; if (api) api.setConfig({ currentForm: next }); }
    else { cfg.form = next; if (api) api.setConfig({ form: next }); }
    requestForm(next, true);
    nextEvolveAt = performance.now() + cfg.evolveMinutes * 60000;
  }

  // ---------- effects ----------
  function particle(node, life, step) {
    const t0 = performance.now();
    const tick = (now) => { const k = clamp((now - t0) / life, 0, 1); step(k); if (k < 1) requestAnimationFrame(tick); else node.remove(); };
    requestAnimationFrame(tick);
  }
  function sparkles(x, y, count, o = {}) {
    const dir = o.dir ?? 0, spread = o.spread ?? Math.PI * 2, dist = o.dist ?? 52, size = o.size ?? 1, r0 = o.r0 ?? 16;
    for (let i = 0; i < count; i++) {
      const p = BB.el('path', { d: 'M0,-3.6 L1,-1 L3.6,0 L1,1 L0,3.6 L-1,1 L-3.6,0 L-1,-1 Z', opacity: 0 }, fxG);
      const a = dir + (spread >= Math.PI * 2 ? (i / count) * spread : (i / Math.max(1, count - 1) - 0.5) * spread) + BB.rand(-0.2, 0.2);
      const d = dist * BB.rand(0.85, 1.15);
      setTimeout(() => particle(p, BB.rand(800, 1050), (k) => {
        const r = r0 + (d - r0) * (1 - Math.pow(1 - k, 3));
        const s = k < 0.3 ? k / 0.3 : 1 - (k - 0.3) / 0.7;
        p.setAttribute('transform', `translate(${fx2(x + Math.cos(a) * r)},${fx2(y + Math.sin(a) * r)}) rotate(${fx2(k * 120)}) scale(${fx2((0.4 + s) * size)})`);
        p.setAttribute('opacity', fx2(s));
      }), i * 22);
    }
  }
  function word(text, x, y, o = {}) {
    const size = Math.round((o.size || 10) * 1.75);
    const el = BB.el('text', { class: 'word', x, y, 'text-anchor': 'middle', 'font-size': size, 'font-weight': 800 }, fxG);
    el.textContent = text;
    // keep the whole word inside the window
    const half = Math.min(72, (el.getComputedTextLength ? el.getComputedTextLength() : text.length * size * 0.55) / 2 + 3);
    el.setAttribute('x', clamp(x, -73 + half, 73 - half));
    const rise = o.rise ?? 18, drift = BB.rand(-4, 4);
    particle(el, (o.life || 1300) * 1.35, (k) => {
      el.setAttribute('transform', `translate(${fx2(drift * k)},${fx2(-rise * BB.easeOut(k))}) scale(${fx2(k < 0.15 ? 0.5 + k / 0.3 : 1)})`);
      el.setAttribute('opacity', fx2(k < 0.15 ? k / 0.15 : 1 - seg(k, 0.6, 1)));
    });
  }
  function heart(x, y) {
    const el = BB.el('path', { class: 'heart', d: 'M0,3 C-4.4,-0.3 -2.8,-4.4 0,-1.8 C2.8,-4.4 4.4,-0.3 0,3Z' }, fxG);
    const dx = BB.rand(-10, 10);
    particle(el, 1200, (k) => {
      el.setAttribute('transform', `translate(${fx2(x + dx * k + Math.sin(k * 9) * 2)},${fx2(y - 30 * BB.easeOut(k))}) scale(${fx2(0.6 + 0.6 * Math.min(1, k * 4))})`);
      el.setAttribute('opacity', fx2(1 - seg(k, 0.55, 1)));
    });
  }
  function drop(x, y) {
    const el = BB.el('path', { class: 'drop', d: 'M0,-3.4 C2.6,0 2,3 0,3 C-2,3 -2.6,0 0,-3.4Z' }, fxG);
    particle(el, 800, (k) => {
      el.setAttribute('transform', `translate(${fx2(x + 9 * k)},${fx2(y + 30 * k * k)})`);
      el.setAttribute('opacity', fx2(k < 0.2 ? k * 5 : 1 - seg(k, 0.7, 1)));
    });
  }
  const fxBase = { sparkles, word, heart, drop };

  // ---------- tricks ----------
  let antic = null;
  let nextAnticAt = performance.now() + 20000;
  const ANTIC_GAP = [null, [50, 100], [20, 45], [7, 16]];
  function scheduleAntic() {
    const gap = ANTIC_GAP[cfg.silliness | 0];
    nextAnticAt = gap ? performance.now() + BB.rand(gap[0], gap[1]) * 1000 : Infinity;
  }
  function startAntic(name, byUser, arg) {
    if (game.active || air) return;
    if (morph && !String(name).startsWith('tb-')) return;
    if (!BB.antics[name]) name = BB.pick(BB.ANTIC_NAMES.filter((n) => !antic || n !== antic.name));
    endAntic();
    antic = { name, def: BB.antics[name], t0: performance.now(), fired: new Set(), every: {}, persist: {}, arg: arg || null };
    if (byUser) BB.sfx.play('pop');
  }
  function endAntic() {
    if (!antic) return;
    for (const k in antic.persist) antic.persist[k].remove();
    antic = null;
    scheduleAntic();
  }
  const fx = {
    ...fxBase,
    once(id, fn) { if (!antic.fired.has(id)) { antic.fired.add(id); fn(); } },
    every(id, sec, fn) { const lt = antic.every[id] ?? -1e9; if (t - lt >= sec) { antic.every[id] = t; fn(); } },
    persist(id, create) { return antic.persist[id] || (antic.persist[id] = create(fxG)); },
  };

  // ---------- extras, game, physical states ----------
  const extras = BB.Extras({ under: $('under'), over: $('over'), hat: $('hat'), floor: $('floor') }, fxBase);
  const game = BB.Game($('gameLayer'), fxBase);
  let gameX = 0;
  let tbBusy = false;  // a taskbar trick is running (main is moving the window)
  let walking = null;   // { dir } while the main process walks the window along the taskbar
  let air = null;       // { vx, rot } while thrown or falling
  let feedHoverAt = -1e9;
  let winceUntil = 0, twitchUntil = 0, nextTwitch = 0, lastFailTs = null;

  // ---------- petting ----------
  let petUntil = 0, lastPetHeart = 0, petFlips = [], petDir = 0, lastMX = null, lastPetSfx = 0;

  // ---------- eyes ----------
  let nextBlink = 2, blinkT = -1, doubleBlink = false;
  const look = { x: 0, y: 0 };
  let glance = { x: 0, y: 0 }, nextGlance = 3;
  let cursor = { dx: 0, dy: 0, at: -1e9 };

  let doneT0 = -1e9, boop = null, hopClock = 0;

  function effectiveState(now) {
    if (st.state === 'idle' && cfg.sleep && (userIdle || now - lastActive > cfg.sleepMinutes * 60000)) return 'sleep';
    return st.state;
  }
  function enterState(s, now) {
    if (s === shown) return;
    const prev = shown;
    shown = s;
    if (s === 'done') { doneT0 = now; sparkles(0, 0, 7, { dist: 56, r0: 22 }); BB.sfx.play('done'); }
    if (s === 'waiting') { hopClock = 0; if (antic) endAntic(); BB.sfx.play('need'); }
    if (s === 'working' && antic && !antic.def.hidden) endAntic();
    if (s === 'idle' && prev === 'sleep') blinkT = 0;
    if (s !== 'idle' && game.active) game.cancel();
    bubble.classList.toggle('show', s === 'waiting');
    zzz.classList.toggle('on', s === 'sleep');
    updateLabel();
  }
  const VERBS = [
    [/^(Edit|MultiEdit|Write|NotebookEdit)$/, 'editing'], [/^Read$/, 'reading'], [/^(Grep|Glob)$/, 'searching for'],
    [/^(Bash|PowerShell|BashOutput)$/, 'running'], [/^WebFetch$/, 'reading'], [/^WebSearch$/, 'searching the web for'],
    [/^(Task|Agent)$/, 'sending a helper:'], [/(TodoWrite|update_plan)$/, 'planning'], [/^Skill$/, 'using the skill'],
    [/^ToolSearch$/, 'looking for tools'], [/^mcp__/, 'using a connector'],
  ];
  function doing() {
    const tool = st.tool || '';
    if (!tool) return 'thinking…';
    // commands and helpers come with their own description ("Run the tests"): say it as is
    if (/^(Bash|PowerShell|Task|Agent)$/.test(tool) && /^[A-Z][a-z'-]+ /.test(st.target || '')) return st.target[0].toLowerCase() + st.target.slice(1);
    const v = VERBS.find(([re]) => re.test(tool));
    const verb = v ? v[1] : 'using ' + tool;
    return st.target && !/connector|tools$|planning/.test(verb) ? `${verb} ${st.target}` : verb;
  }
  function details() {
    const bits = [];
    if (st.project) bits.push(st.project);
    if ((shown === 'working' || shown === 'waiting') && st.turnStart) { const m = Math.floor((Date.now() - st.turnStart) / 60000); bits.push(m < 1 ? 'just started' : m + ' min'); }
    if (st.edits) bits.push(st.edits + (st.edits === 1 ? ' edit' : ' edits'));
    if (st.others) bits.push('+' + st.others + ' more');
    return bits.join(' · ');
  }
  function updateLabel() {
    const now = performance.now();
    const task = st.task ? `“${st.task}”` : '';
    let lines;
    if (flash && now < flash.until) lines = [flash.text, '', ''];
    else if (shown === 'working') lines = [doing(), task, details()];
    else if (shown === 'waiting') lines = [st.detail === 'question' ? 'has a question for you' : st.detail === 'plan' ? 'has a plan for you' : 'needs your OK' + (st.target ? ` for ${st.target}` : ''), task, st.hasAsk ? 'click to answer' : details()];
    else if (shown === 'done') lines = ['all done!', task, details()];
    else if (shown === 'sleep') lines = ['zzz… napping', '', 'click to open Claude'];
    else lines = [{ proud: 'feeling proud', frazzled: 'a bit frazzled', dusty: 'dusty… it has been a while' }[st.mood] || 'free right now', '', 'click to open Claude'];
    thoughtLines = lines; thoughtAt = now;
    thoughtOn = (hovering && cfg.showLabel && !dragging && !tbBusy) || !!(flash && now < flash.until);
    bubble.style.visibility = thoughtOn ? 'hidden' : '';
    bubbleText.textContent = st.detail === 'question' ? '?' : st.detail === 'plan' ? '✓' : '!';
  }
  function setFlash(text, ms = 2600) { flash = { text, until: performance.now() + ms }; updateLabel(); }

  // ---------- main loop ----------
  function frame(now) {
    requestAnimationFrame(frame);
    const busy = antic || morph || walking || air || tbBusy || game.active || shown === 'working' || shown === 'waiting'
      || now < petUntil || now - doneT0 < 1200 || hovering || now - feedHoverAt < 400 || now < winceUntil;
    if (!busy && now - lastDraw < 31) return; // ~30 fps when calm
    lastDraw = now;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    t += dt;

    if (st.state !== 'idle') lastActive = now;
    enterState(effectiveState(now), now);

    const tgt = TARGETS[shown];
    const k = Math.min(1, dt * 3.2);
    for (const key in tgt) cur[key] = lerp(cur[key], tgt[key], key === 'eyeRy' ? Math.min(1, dt * 8) : k);
    if (shown === 'idle' && st.mood === 'proud') cur.breath = lerp(cur.breath, 0.06, k);

    const calm = !morph && !antic && !game.active && !walking && !air && !dragging && !tbBusy;
    if (cfg.form === 'auto' && now > nextEvolveAt && calm && (shown === 'idle' || shown === 'working')) transformNow();
    if (calm && shown === 'idle' && now > nextAnticAt) startAntic();

    // a tool just failed: wince (or keel over if it was the tests)
    if (lastFailTs === null) lastFailTs = st.failTs;
    else if (st.failTs !== lastFailTs) {
      lastFailTs = st.failTs;
      if (st.failKind === 'test') startAntic('flop'); else { winceUntil = now + 650; BB.sfx.play('fail'); }
    }
    // frazzled: the occasional eye twitch
    if (shown === 'idle' && st.mood === 'frazzled' && now > nextTwitch) { twitchUntil = now + 150; nextTwitch = now + BB.rand(1800, 4200); }

    // current trick
    const o = { dx: 0, dy: 0, rot: 0, waddle: 0, sx: 1, sy: 1, expr: null, look: null, hole: 0 };
    let act = null;
    if (antic) {
      const ak = (now - antic.t0) / (antic.def.dur * 1000);
      if (ak >= 1) endAntic();
      else { antic.def.run(ak, { t, dt, cursorDx: cursor.dx, arg: antic.arg, h: HEIGHT[formName] || 70 }, o, fx); act = { name: antic.name, k: ak }; }
    }
    // mini-game
    if (game.active) {
      const g = game.update(dt, now, cursor.dx, (score, record) => {
        if (record) { cfg.bestCatch = score; if (api) api.setConfig({ bestCatch: score }); }
        if (api) api.trigger({ type: 'game-over' });
      });
      if (g) { gameX = g.x; o.look = g.look; o.expr = 'wide'; }
    } else gameX = lerp(gameX, 0, Math.min(1, dt * 6));
    o.dx += gameX;
    // walking along the taskbar
    if (walking) {
      o.waddle = Math.sin(t * 9) * 4; o.dy -= Math.abs(Math.sin(t * 9)) * 0.6;
      o.look = { x: 2.2 * walking.dir, y: 0.2 };
    }
    // thrown / falling
    if (air) { air.rot += clamp(air.vx, -1800, 1800) * dt * 0.45; o.rot += air.rot; o.expr = 'wide'; o.sy *= 1.06; o.sx *= 0.96; }
    // a file is being dragged over it
    const feeding = now - feedHoverAt < 250;
    stage.classList.toggle('feeding', feeding);
    if (feeding && !antic) { o.expr = 'wide'; o.sy *= 1.08; o.dy -= 3; o.look = { x: 0, y: -1.5 }; }
    if (now < winceUntil) { o.expr = 'squint'; o.dx += Math.sin(t * 60) * 2.2; }
    if (now < twitchUntil) o.expr = 'squint';

    // ---- morph: the silhouette flows from one form into the next ----
    let formO = 1, morphing = false;
    if (morph) {
      morphing = true;
      const q = (now - morph.t0) / 1150;
      const a = seg(q, 0, 0.16), m = easeInOut(seg(q, 0.14, 0.8)), z = seg(q, 0.8, 1);
      if (!morph.swapped && q >= 0.8) {
        morph.swapped = true;
        mountForm(morph.toName);
        sparkles(0, 0, 9, { dist: 54, r0: 10 });
        if (morph.announce) setFlash(`✦ became ${BB.forms[formName].label}`);
      }
      formO = morph.swapped ? z : 1 - a;
      const wob = Math.sin(m * Math.PI);
      let d = '';
      for (let i = 0; i < OUT_N; i++) {
        const th = (i / OUT_N) * Math.PI * 2 + wob * 0.5;
        const r = lerp(morph.from[i], morph.to[i], m) * (1 + 0.06 * wob * Math.sin(i * 0.52 + t * 9));
        d += (i ? 'L' : 'M') + fx2(Math.sin(th) * r) + ',' + fx2(-Math.cos(th) * r);
      }
      blobPath.setAttribute('d', d + 'Z');
      blobG.setAttribute('opacity', fx2(morph.swapped ? 1 - z : a));
      blobG.setAttribute('transform', `translate(0,${fx2(lerp(morph.fromCy, morph.toCy, m))})`);
      formG.setAttribute('transform', morph.swapped ? `scale(${fx2(0.8 + 0.2 * easeOutBack(z, 2.4))})` : '');
      if (q >= 1) { morph = null; blobG.setAttribute('opacity', 0); formG.setAttribute('transform', ''); formO = 1; }
    }
    formG.style.opacity = formO;

    // ---- body transform ----
    let y = 0, sx = 1, sy = 1, h = 0;
    if (cur.hop > 0.01) {
      hopClock += dt;
      const hp = hopClock % 1.9;
      if (hp < 1.0) {
        h = Math.abs(Math.sin(hp * Math.PI * 2));
        const sq = Math.pow(1 - h, 10);
        sx += (0.11 * sq - 0.04 * h) * cur.hop;
        sy += (0.05 * h - 0.11 * sq) * cur.hop;
      }
      y = -h * 13 * cur.hop;
    }
    if (cur.sleep > 0.01) { const b = Math.sin(t * 1.1); y += 3 * cur.sleep; sx *= 1 + 0.02 * b * cur.sleep; sy *= 1 - 0.02 * b * cur.sleep; }
    if (boop) {
      const bk = (now - boop) / 380;
      if (bk >= 1) boop = null; else { const w = Math.sin(bk * Math.PI) * (1 - bk); sx *= 1 + 0.16 * w; sy *= 1 - 0.18 * w; }
    }
    const petting = now < petUntil;
    let rot = o.rot;
    if (petting) {
      rot += Math.sin(t * 14) * 4;
      if (now - lastPetHeart > 300) { lastPetHeart = now; heart(BB.rand(-16, 16), -36); }
      if (now - lastPetSfx > 900) { lastPetSfx = now; BB.sfx.play('pet'); }
    }
    const X = o.dx, Y = y + o.dy;
    sx *= o.sx; sy *= o.sy;
    let foot = footOf(formName);
    if (morph) foot = lerp(footOf(morph.fromName), footOf(morph.toName), easeInOut(seg((now - morph.t0) / 1150, 0.14, 0.8)));
    const want = GROUND - foot;
    sink = want; // (the morph already blends one foot line into the next)
    liftG.setAttribute('transform', `translate(0,${fx2(sink)})`);
    groundRect.setAttribute('height', fx2(187.5 - sink));
    bubble.style.top = (21 + sink).toFixed(1) + 'px';
    if (api && (sentSink === null || Math.abs(sink - sentSink) > 0.5)) { sentSink = sink; api.trigger({ type: 'ground', drop: Math.round(sink * 10) / 10 }); }
    bodyG.setAttribute('transform', `translate(${fx2(X)},${fx2(Y)}) rotate(${fx2(rot)}) translate(0,${fx2(foot)}) rotate(${fx2(o.waddle)}) scale(${fx2(sx)},${fx2(sy)}) translate(0,${fx2(-foot)})`);

    const airborne = Math.max(h * cur.hop, clamp(-o.dy / 36, 0, 1), air ? 1 : 0);
    const hk = BB.easeOut(o.hole);
    shadow.setAttribute('cx', fx2(X));
    shadow.setAttribute('rx', fx2(24 * (1 - 0.32 * airborne)));
    shadow.setAttribute('opacity', fx2(0.18 * (1 - 0.45 * airborne) * (1 - hk) * (air ? 0 : 1)));
    hole.setAttribute('rx', fx2(31 * hk));
    hole.setAttribute('ry', fx2(6 * hk));
    hole.setAttribute('opacity', fx2(0.85 * hk));
    // the thought cloud follows the head
    if (thoughtOn && now - thoughtAt > 1000) updateLabel();
    thought.update(thoughtOn, thoughtLines, { x: X, headTop: GROUND - (HEIGHT[formName] || 70) + Y });

    // ---- eyes ----
    const recentCursor = cfg.followMouse && now - cursor.at < 6000;
    let lt;
    if (o.look) lt = o.look;
    else if (shown === 'working') lt = { x: Math.sin(t * 1.5) * 2.0, y: 1.3 };
    else if (hovering) lt = { x: 0, y: -0.2 };
    else if (recentCursor && shown !== 'sleep') lt = { x: clamp(cursor.dx / 160, -1, 1) * 2.6, y: clamp(cursor.dy / 160, -1, 1) * 1.6 };
    else if (shown === 'waiting') lt = { x: 0, y: -0.4 };
    else {
      if (t > nextGlance) {
        glance = Math.random() < 0.4 ? { x: 0, y: 0 } : { x: BB.rand(-2.4, 2.4), y: BB.rand(-1.4, 1.4) };
        nextGlance = t + BB.rand(1.8, 5.3);
      }
      lt = glance;
    }
    const lk = Math.min(1, dt * 10);
    look.x = lerp(look.x, lt.x, lk);
    look.y = lerp(look.y, lt.y, lk);

    let expr = shown === 'done' ? 'happy' : shown === 'sleep' ? 'closed' : shown === 'waiting' ? 'wide' : 'open';
    if (petting) expr = 'heart';
    if (o.expr) expr = o.expr;

    let lid = 1;
    if (blinkT < 0 && t > nextBlink && shown !== 'sleep') { blinkT = 0; doubleBlink = Math.random() < 0.2; }
    if (blinkT >= 0) {
      blinkT += dt;
      const d = 0.15;
      if (blinkT < d) lid = 1 - Math.sin((blinkT / d) * Math.PI) * 0.92;
      else if (doubleBlink && blinkT > d * 1.2 && blinkT < d * 2.2) lid = 1 - Math.sin(((blinkT - d * 1.2) / d) * Math.PI) * 0.92;
      else if (blinkT >= (doubleBlink ? d * 2.2 : d)) { blinkT = -1; nextBlink = t + BB.rand(2.4, 6.4); }
    }

    const doneK = now - doneT0 < 950 ? (now - doneT0) / 950 : -1;
    const f = { t, dt, now, state: shown, cur, look, lid, expr, eyeRy: cur.eyeRy, doneK, act };
    if (formInst) formInst.update(f);
    if (morphing) blobFace.update(f);
    extras.update({ t, dt, now, state: shown, cur, st, cfg, form: formName, morphing, bodyY: Y });

    if (flash && now > flash.until) { flash = null; updateLabel(); }
  }

  // ---------- config & state from main ----------
  function applyConfig(c) {
    const prev = cfg;
    cfg = { ...cfg, ...c };
    BB.applyTheme(cfg.theme);
    BB.sfx.on = !!cfg.sfx; BB.sfx.volume = +cfg.volume || 0;
    stage.style.opacity = cfg.opacity;
    if (prev.evolveMinutes !== cfg.evolveMinutes || prev.form !== cfg.form) nextEvolveAt = performance.now() + cfg.evolveMinutes * 60000;
    if (prev.silliness !== cfg.silliness) scheduleAntic();
    requestForm(wantedForm(), !!formInst && wantedForm() !== formName);
    updateLabel();
  }
  function applyState(s) {
    st = { ...st, ...s };
    if (st.state !== 'idle') lastActive = performance.now();
    if (formInst && wantedForm() !== formName && !morph) requestForm(wantedForm(), false);
    updateLabel();
  }
  function onTrigger(tr) {
    switch (tr.type) {
      case 'antic': startAntic(tr.name, tr.byUser !== false, tr.arg); break;
      case 'tb': tbBusy = !!tr.on; $('over').style.opacity = tbBusy ? 0 : ''; break;
      case 'transform': transformNow(); break;
      case 'wake': lastActive = performance.now(); userIdle = false; break;
      case 'user-idle': userIdle = !!tr.on; if (!tr.on) lastActive = performance.now(); break;
      case 'walk': walking = tr.on ? { dir: tr.dir || 1 } : null; break;
      case 'air': if (tr.on) { if (antic) endAntic(); air = { vx: tr.vx || 0, rot: 0 }; } else { air = null; if (tr.land) startAntic('land'); } break;
      case 'game': if (antic) endAntic(); lastActive = performance.now(); game.start(cfg.bestCatch); break;
      case 'flash': setFlash(tr.text, tr.ms); break;
      case 'unlock':
        setFlash(`✦ unlocked a new form: ${BB.forms[tr.form] ? BB.forms[tr.form].label : tr.form}!`, 5000);
        BB.sfx.play('unlock'); sparkles(0, 0, 12, { dist: 60 });
        if (cfg.form === 'auto') { cfg.currentForm = tr.form; if (api) api.setConfig({ currentForm: tr.form }); st.unlocked = [...new Set([...(st.unlocked || []), tr.form])]; requestForm(tr.form, false); }
        break;
    }
  }

  mountForm(wantedForm());
  BB.applyTheme(cfg.theme);
  scheduleAntic();
  requestAnimationFrame(frame);

  if (api) {
    api.getConfig().then(applyConfig);
    api.onConfig(applyConfig);
    api.onState(applyState);
    api.onCursor((c) => { cursor = { dx: c.dx, dy: c.dy, at: performance.now() }; });
    api.onTrigger(onTrigger);
  }

  // ---------- mouse ----------
  const CX = 75, CY = 112, HIT_R = 50;
  let interactive = false, down = null;

  function overBuddy(e) {
    const cy = CY + (sink || 0);
    const dx = e.clientX - CX, dy = e.clientY - cy;
    if (dx * dx + dy * dy < HIT_R * HIT_R) return true;
    if (shown === 'waiting' && e.clientY > 16 + (sink || 0) && e.clientY < 50 + (sink || 0) && Math.abs(dx) < 20) return true;
    return false;
  }
  function setInteractive(v) {
    if (v === interactive) return;
    interactive = v;
    hovering = v;
    if (api) api.setIgnore(!v);
    if (!v) { petFlips = []; lastMX = null; }
    updateLabel();
  }

  window.addEventListener('mousemove', (e) => {
    if (down) return;
    setInteractive(overBuddy(e));
    if (hovering && lastMX !== null) { // petting: rub back and forth
      const d = e.clientX - lastMX;
      if (Math.abs(d) > 2) {
        const dir = Math.sign(d), now = performance.now();
        if (dir !== petDir) { petDir = dir; petFlips.push(now); }
        petFlips = petFlips.filter((x) => now - x < 1400);
        if (petFlips.length >= 4) {
          if (now > petUntil && api) api.trigger({ type: 'petted' });
          petUntil = now + 1500;
          lastActive = now; userIdle = false;
        }
      }
    }
    lastMX = e.clientX;
  });
  document.addEventListener('mouseleave', () => { if (!down) setInteractive(false); });

  stage.addEventListener('pointerdown', (e) => {
    if (!overBuddy(e)) return;
    if (e.button === 1) { e.preventDefault(); startAntic(undefined, true); return; }
    if (e.button !== 0) return;
    down = { x: e.screenX, y: e.screenY };
    dragging = false;
    stage.setPointerCapture(e.pointerId);
  });
  stage.addEventListener('pointermove', (e) => {
    if (!down || dragging) return;
    if (Math.hypot(e.screenX - down.x, e.screenY - down.y) > 4) {
      dragging = true;
      if (game.active) game.cancel();
      updateLabel();
      if (api) api.dragStart();
    }
  });
  stage.addEventListener('pointerup', (e) => {
    if (!down) return;
    if (dragging) { if (api) api.dragEnd(); }
    else {
      boop = performance.now();
      BB.sfx.play('pop');
      if (api) { if (shown === 'waiting' && st.hasAsk) api.openReply(); else api.openClaude(); }
    }
    down = null;
    dragging = false;
    updateLabel();
    try { stage.releasePointerCapture(e.pointerId); } catch {}
  });
  stage.addEventListener('pointercancel', () => { if (dragging && api) api.dragEnd(); down = null; dragging = false; });
  window.addEventListener('contextmenu', (e) => { e.preventDefault(); if (api) api.menu(); });
  window.addEventListener('wheel', (e) => {
    if (!e.ctrlKey || !interactive) return;
    e.preventDefault();
    const next = clamp(Math.round((cfg.scale + (e.deltaY < 0 ? 0.05 : -0.05)) * 100) / 100, 0.5, 2);
    cfg.scale = next;
    if (api) api.setConfig({ scale: next });
  }, { passive: false });

  // feeding: drop a file on it
  window.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; feedHoverAt = performance.now(); lastActive = feedHoverAt; });
  window.addEventListener('drop', (e) => {
    e.preventDefault();
    feedHoverAt = -1e9;
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (!file) return;
    startAntic('eat');
    if (api) api.fileDropped(file);
  });

  // ---------- demo mode (plain browser) ----------
  if (!api) {
    window.__buddy = {
      state(s, detail) {
        if (s === 'sleep') { st.state = 'idle'; lastActive = -1e12; }
        else applyState({ state: s, detail: detail || '', label: `Demo: ${s}` });
      },
      set: (o) => applyState(o),
      cfg: (o) => applyConfig(o),
      antic: (n) => startAntic(n, true),
      trigger: onTrigger,
      form(name) { cfg.unlockAll = true; cfg.form = name; requestForm(name, true); },
      snap(name) { cfg.unlockAll = true; cfg.form = name; mountForm(name); morph = null; },
    };
    const keys = { 1: 'idle', 2: 'working', 3: 'waiting', 4: 'done', 5: 'sleep' };
    window.addEventListener('keydown', (e) => {
      if (keys[e.key]) window.__buddy.state(keys[e.key], 'permission');
      if (e.key === 'a') startAntic(undefined, true);
      if (e.key === 't') { cfg.unlockAll = true; transformNow(); }
      if (e.key === 'g') onTrigger({ type: 'game' });
    });
    window.addEventListener('mousemove', (e) => { cursor = { dx: e.clientX - CX, dy: e.clientY - CY - (sink || 0), at: performance.now() }; });
    const q = new URLSearchParams(location.search);
    document.body.style.background = q.get('bg') || '#3b4a5a';
    const c = { unlockAll: true, sfx: false, hat: q.get('hat') || 'none' };
    if (q.get('theme')) c.theme = q.get('theme');
    if (q.get('calm') || q.get('antic')) c.silliness = 0;
    applyConfig(c);
    nextAnticAt = c.silliness === 0 ? Infinity : nextAnticAt;
    if (q.get('form')) window.__buddy.snap(q.get('form'));
    if (q.get('state')) window.__buddy.state(q.get('state'), q.get('detail') || 'permission');
    const extra = {};
    if (q.get('tool')) extra.tool = q.get('tool');
    if (q.get('edits')) extra.edits = +q.get('edits');
    if (q.get('mood')) extra.mood = q.get('mood');
    if (q.get('sweat')) extra.turnStart = Date.now() - 400000;
    if (q.get('sessions')) extra.sessions = Array.from({ length: +q.get('sessions') }, (_, i) => ({ state: i === 1 ? 'waiting' : 'working' }));
    if (Object.keys(extra).length) applyState(extra);
    if (q.get('antic')) { const go = () => { startAntic(q.get('antic')); setTimeout(go, BB.antics[q.get('antic')].dur * 1000 + 600); }; setTimeout(go, 300); }
    if (q.get('morph')) { const seq = q.get('morph').split(','); let i = 0; setInterval(() => { requestForm(seq[i++ % seq.length], false); }, 1900); }
    if (q.get('game')) setTimeout(() => onTrigger({ type: 'game' }), 400);
  }
})();
