// Form: Origami — a folded-paper star. Facets catch the light; it folds flat to nap.
BB.forms.origami = {
  label: 'Origami', voice: 'paper', hat: { x: 0, y: -11 },
  radius: BB.lobesR([41, 30, 41, 30, 41, 30, 41, 30], 14, 0.4),
  build(root) {
    const N = 8, VAL = 14;
    const LEN = [41, 30, 41, 30, 41, 30, 41, 30];
    const g = BB.el('g', {}, root);
    const pts = [];
    for (let i = 0; i < N; i++) {
      pts.push({ l: BB.el('path', { class: 'o-a' }, g), r: BB.el('path', { class: 'o-b' }, g), a: (i * 2 * Math.PI) / N });
    }
    BB.el('circle', { r: 10.5, class: 'c-main' }, root);
    const face = BB.makeFace(root, { spacing: 4.4, scale: 0.85 });
    const P = (a, r) => `${BB.fx2(Math.sin(a) * r)},${BB.fx2(-Math.cos(a) * r)}`;
    let rot = 0;

    return {
      update(f) {
        const c = f.cur;
        const half = Math.PI / N;
        for (let i = 0; i < N; i++) {
          const p = pts[i];
          let L = LEN[i] * (1 + c.flare + c.breath * Math.sin(f.t * 1.7 + i * 0.5));
          // while working, a crease of light runs round the star
          const lit = c.wave > 0.05 ? Math.pow(Math.max(0, Math.cos(f.t * 3.4 - p.a)), 6) : 0;
          L += lit * 4 * c.wave;
          p.l.setAttribute('d', `M0,0 L${P(p.a - half, VAL)} L${P(p.a, L)}Z`);
          p.r.setAttribute('d', `M0,0 L${P(p.a, L)} L${P(p.a + half, VAL)}Z`);
          p.l.style.opacity = BB.fx2(0.82 + 0.18 * lit);
          p.r.style.opacity = BB.fx2(1 - 0.25 * lit);
        }
        rot += c.spin * 0.45 * f.dt * 57.3;
        const burst = f.doneK >= 0 ? 360 * BB.easeOutBack(f.doneK) : 0;
        const fold = 1 - 0.5 * c.sleep; // folds flat when asleep
        g.setAttribute('transform', `translate(0,${BB.fx2(10 * c.sleep)}) scale(1,${BB.fx2(fold)}) rotate(${BB.fx2(rot + burst + Math.sin(f.t * 0.6) * 5 * c.sway)})`);
        face.update(f);
      },
    };
  },
};
