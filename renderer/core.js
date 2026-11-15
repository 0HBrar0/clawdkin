// Shared helpers for Clawdkin forms and antics.
(() => {
  const SVGNS = 'http://www.w3.org/2000/svg';
  const BB = (window.BB = { SVGNS, forms: {}, antics: {}, FORM_ORDER: ['spark', 'glyph', 'doodle', 'clawd'] });

  BB.el = (tag, attrs = {}, parent) => {
    const e = document.createElementNS(SVGNS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };
  BB.lerp = (a, b, k) => a + (b - a) * k;
  BB.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  BB.seg = (k, a, b) => BB.clamp((k - a) / (b - a), 0, 1);
  BB.easeIn = (x) => x * x * x;
  BB.easeOut = (x) => 1 - Math.pow(1 - x, 3);
  BB.easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  BB.easeOutBack = (x, s = 1.9) => 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2);
  BB.fx2 = (n) => (Math.round(n * 100) / 100).toString();
  BB.rand = (a, b) => a + Math.random() * (b - a);
  BB.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  // ---------- silhouettes (used for smooth shape morphs) ----------
  // A silhouette is r(theta): theta in radians, 0 = up, clockwise.
  BB.lobesR = (lens, base, width, jit = []) => (th) => {
    const n = lens.length;
    let best = base;
    for (let i = 0; i < n; i++) {
      const a = (i * 2 * Math.PI) / n + ((jit[i] || 0) * Math.PI) / 180;
      const d = Math.abs(Math.atan2(Math.sin(th - a), Math.cos(th - a)));
      if (d < width) best = Math.max(best, base + (lens[i] - base) * Math.pow(1 - d / width, 0.6));
    }
    return best;
  };
  BB.rectR = (hw, hh) => (th) => {
    const s = Math.abs(Math.sin(th)), c = Math.abs(Math.cos(th));
    return Math.min(s > 1e-6 ? hw / s : 1e9, c > 1e-6 ? hh / c : 1e9);
  };
  BB.circR = (r) => () => r;

  // Which little prop goes with which tool.
  BB.toolCat = (name) => {
    name = String(name || '');
    if (/^(Read|Grep|Glob|LS|ToolSearch|NotebookRead)$/.test(name)) return 'search';
    if (/^(Edit|Write|NotebookEdit|MultiEdit)$/.test(name)) return 'edit';
    if (/^(Bash|PowerShell|BashOutput|KillShell|Monitor)$/.test(name)) return 'run';
    if (/^(WebFetch|WebSearch)$/.test(name) || /browser|chrome|navigate/i.test(name)) return 'web';
    if (/^(Agent|Task)$/.test(name)) return 'agent';
    if (/^mcp__/.test(name)) return 'mcp';
    return '';
  };

  // Small deterministic noise for hand-drawn wobble.
  BB.hash = (n) => {
    const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
  };

  // ---------- A shared face: two eyes plus expressions, crossfaded ----------
  // Expressions: open, wide, happy, closed, squint, dizzy, heart
  BB.makeFace = (parent, o = {}) => {
    const sp = o.spacing ?? 5.2;
    const y = o.y ?? -0.5;
    const s = o.scale ?? 1;
    const g = BB.el('g', { class: 'face' }, parent);
    const eyesG = BB.el('g', {}, g);
    const L = BB.el('ellipse', { cx: -sp, cy: y, rx: 2.1 * s, ry: 3.3 * s, class: 'f-ink' }, eyesG);
    const R = BB.el('ellipse', { cx: sp, cy: y, rx: 2.1 * s, ry: 3.3 * s, class: 'f-ink' }, eyesG);
    const w = 2.8 * s;
    const pair = (fn) => fn(-sp) + ' ' + fn(sp);
    const ex = {
      happy: BB.el('path', { class: 'line', d: pair((x) => `M${x - w},${y + 1.6} q${w},${-4.6 * s} ${2 * w},0`) }, g),
      closed: BB.el('path', { class: 'line', d: pair((x) => `M${x - w},${y} q${w},${2.8 * s} ${2 * w},0`) }, g),
      squint: BB.el('path', {
        class: 'line',
        d: `M${-sp - 2.4 * s},${y - 2.6 * s} L${-sp + 1.8 * s},${y} L${-sp - 2.4 * s},${y + 2.6 * s} ` +
           `M${sp + 2.4 * s},${y - 2.6 * s} L${sp - 1.8 * s},${y} L${sp + 2.4 * s},${y + 2.6 * s}`,
      }, g),
      dizzy: BB.el('g', {}, g),
      heart: BB.el('g', {}, g),
    };
    const spiral = 'M0,0 a0.7,0.7 0 1 1 1.4,0 a1.4,1.4 0 1 1 -2.8,0 a2.1,2.1 0 1 1 4.2,0';
    const dz = [-sp, sp].map((x) => {
      const gg = BB.el('g', { transform: `translate(${x},${y})` }, ex.dizzy);
      const p = BB.el('path', { class: 'line thin', d: spiral, transform: `scale(${s})` }, gg);
      return p;
    });
    [-sp, sp].forEach((x) => BB.el('path', {
      class: 'f-heart',
      d: 'M0,2.4 C-3.4,-0.2 -2.2,-3.4 0,-1.4 C2.2,-3.4 3.4,-0.2 0,2.4Z',
      transform: `translate(${x},${y}) scale(${s})`,
    }, ex.heart));

    const weights = { open: 1, happy: 0, closed: 0, squint: 0, dizzy: 0, heart: 0 };
    let spin = 0;
    return {
      g,
      update(f) {
        const want = f.expr === 'wide' ? 'open' : f.expr;
        const k = Math.min(1, f.dt * 12);
        for (const key in weights) weights[key] = BB.lerp(weights[key], key === want ? 1 : 0, k);
        const wide = f.expr === 'wide' ? 1.22 : 1;
        const ry = Math.max(0.25, f.eyeRy * f.lid * wide) * s;
        const rx = 2.1 * s * (f.expr === 'wide' ? 1.12 : 1);
        for (const e of [L, R]) { e.setAttribute('ry', BB.fx2(ry)); e.setAttribute('rx', BB.fx2(rx)); }
        eyesG.style.opacity = weights.open;
        for (const key in ex) ex[key].style.opacity = weights[key];
        if (weights.dizzy > 0.01) {
          spin += f.dt * 600;
          dz.forEach((p, i) => p.setAttribute('transform', `scale(${s}) rotate(${i ? -spin : spin})`));
        }
        g.setAttribute('transform', `translate(${BB.fx2(f.look.x * 0.55)},${BB.fx2(f.look.y * 0.5)})`);
        eyesG.setAttribute('transform', `translate(${BB.fx2(f.look.x * 0.45)},${BB.fx2(f.look.y * 0.45)})`);
      },
    };
  };

  // ---------- themes ----------
  BB.THEMES = {
    terracotta: { label: 'Terracotta', main: '#D97757', deep: '#B9583A', ink: '#2A140B', glow: '#F2A882', light: '#F6C9A8' },
    ember:      { label: 'Ember',      main: '#EB6A3F', deep: '#B8401F', ink: '#2B0F06', glow: '#FF9466', light: '#FFC4A3' },
    sand:       { label: 'Sand',       main: '#D4A27F', deep: '#A97C5B', ink: '#33200F', glow: '#EBC6A5', light: '#F4E0CC' },
    ivory:      { label: 'Ivory',      main: '#F0EEE6', deep: '#C9C3B1', ink: '#3D3929', glow: '#FFF6E8', light: '#FFFFFF' },
    charcoal:   { label: 'Charcoal',   main: '#45403A', deep: '#24211E', ink: '#F3EEE4', glow: '#B4A99A', light: '#D8CFC2' },
    lavender:   { label: 'Lavender',   main: '#A98BE0', deep: '#7D5EC0', ink: '#1F1433', glow: '#CDB8FF', light: '#E6DBFF' },
    party:      { label: 'Party (shifts colour)', main: '#D97757', deep: '#B9583A', ink: '#2A140B', glow: '#F2A882', light: '#F6C9A8' },
  };
  BB.applyTheme = (name) => {
    const th = BB.THEMES[name] || BB.THEMES.terracotta;
    const r = document.documentElement.style;
    for (const k of ['main', 'deep', 'ink', 'glow', 'light']) r.setProperty('--' + k, th[k]);
    document.documentElement.classList.toggle('party', name === 'party');
  };

  // ---------- a soft two-note chime (no audio files) ----------
  let actx = null;
  BB.chime = (notes = [784, 1047]) => {
    try {
      actx = actx || new AudioContext();
      const now = actx.currentTime;
      notes.forEach((freq, i) => {
        const o = actx.createOscillator();
        const g = actx.createGain();
        o.type = 'sine';
        o.frequency.value = freq;
        const t0 = now + i * 0.13;
        g.gain.setValueAtTime(0, t0);
        g.gain.linearRampToValueAtTime(0.12, t0 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0008, t0 + 0.6);
        o.connect(g).connect(actx.destination);
        o.start(t0);
        o.stop(t0 + 0.65);
      });
    } catch {}
  };
})();
