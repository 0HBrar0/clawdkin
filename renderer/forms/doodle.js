// Form: the Doodle — a hand-drawn spark. Ink lines "boil" like a sketch,
// and while working the ink re-traces each ray as if being drawn.
BB.forms.doodle = {
  label: 'Doodle',
  build(root) {
    const LENS = [41, 32, 38, 30, 40, 33, 37, 31, 39];
    const N = LENS.length;
    const INNER = 9;
    const raysG = BB.el('g', {}, root);
    const rays = LENS.map((len, i) => {
      const ang = (i * 360) / N + (BB.hash(i) - 0.5) * 10;
      const g = BB.el('g', { transform: `rotate(${ang})` }, raysG);
      const color = BB.el('path', { class: 'doodle-color' }, g);
      const ink = BB.el('path', { class: 'doodle-ink', pathLength: 1 }, g);
      return { g, color, ink, len, ang };
    });
    const core = BB.el('circle', { r: 12.5, class: 'c-main' }, root);
    const coreInk = BB.el('path', { class: 'doodle-ink' }, root);
    const face = BB.makeFace(root);
    const marks = BB.el('g', { class: 'doodle-marks' }, root); // "!" motion ticks when it needs you
    const markPaths = [-28, 0, 28].map(() => BB.el('path', { class: 'doodle-ink thick' }, marks));
    let tick = -1, rot = 0;

    const wob = (seed, amt) => (BB.hash(seed) - 0.5) * 2 * amt;

    function redraw(tk, c) {
      rays.forEach((r, i) => {
        const L = r.len * (1 + c.flare - 0.07 * c.sleep);
        const s0 = i * 31 + tk * 7.13;
        const cx = wob(s0 + 1, 2.6), tipx = wob(s0 + 2, 1.6);
        r.color.setAttribute('d', `M${BB.fx2(wob(s0 + 3, 1))},${-INNER} Q${BB.fx2(cx)},${BB.fx2(-(INNER + L) / 2)} ${BB.fx2(tipx)},${BB.fx2(-L)}`);
        const ix = wob(s0 + 4, 1.4);
        r.ink.setAttribute('d', `M${BB.fx2(ix + 0.8)},${-INNER + 1} Q${BB.fx2(cx + wob(s0 + 5, 2) + 1.2)},${BB.fx2(-(INNER + L) / 2)} ${BB.fx2(tipx + wob(s0 + 6, 1.4) + 0.6)},${BB.fx2(-L - 1.5)}`);
      });
      // two sketchy loops around the core
      let d = '';
      for (let loop = 0; loop < 2; loop++) {
        for (let j = 0; j <= 12; j++) {
          const a = (j / 12) * Math.PI * 2 + loop * 0.4;
          const rr = 12.8 + wob(tk * 3.1 + loop * 50 + j, 0.9);
          d += (j ? 'L' : 'M') + BB.fx2(Math.cos(a) * rr + 0.6) + ',' + BB.fx2(Math.sin(a) * rr + 0.4);
        }
      }
      coreInk.setAttribute('d', d);
      markPaths.forEach((p, i) => {
        const a = ((i - 1) * 28 - 90) * Math.PI / 180;
        const r1 = 50 + wob(tk + i * 9, 2), r2 = 60 + wob(tk + i * 9 + 3, 2);
        p.setAttribute('d', `M${BB.fx2(Math.cos(a) * r1)},${BB.fx2(Math.sin(a) * r1)} L${BB.fx2(Math.cos(a) * r2 + wob(tk + i, 1.5))},${BB.fx2(Math.sin(a) * r2)}`);
      });
    }

    return {
      update(f) {
        const c = f.cur;
        const boil = f.state === 'working' ? 0.09 : c.sleep > 0.5 ? 0.6 : 0.16;
        const tk = Math.floor(f.t / boil);
        if (tk !== tick) { tick = tk; redraw(tk, c); }

        // ink re-tracing while working
        rays.forEach((r, i) => {
          if (c.wave > 0.05) {
            const p = (((f.t * 0.85 - i / N) % 1) + 1) % 1;
            r.ink.style.strokeDasharray = '1 1';
            r.ink.style.strokeDashoffset = BB.fx2(1 - BB.clamp(p * 2.4, 0, 1));
          } else {
            r.ink.style.strokeDasharray = '';
            r.ink.style.strokeDashoffset = '';
          }
          if (f.act && f.act.name === 'wave' && i === 1) {
            const env = Math.sin(f.act.k * Math.PI);
            r.g.setAttribute('transform', `rotate(${BB.fx2(r.ang + Math.sin(f.act.k * Math.PI * 7) * 26 * env)})`);
          } else r.g.setAttribute('transform', `rotate(${BB.fx2(r.ang)})`);
        });

        rot += c.spin * 0.6 * f.dt * 57.3;
        const burst = f.doneK >= 0 ? 360 * BB.easeOutBack(f.doneK) : 0;
        raysG.setAttribute('transform', `rotate(${BB.fx2(rot + burst + Math.sin(f.t * 0.6) * 4 * c.sway)})`);
        marks.style.opacity = BB.fx2(c.hop * (0.6 + 0.4 * Math.sin(f.t * 8)));
        face.update(f);
      },
    };
  },
};
