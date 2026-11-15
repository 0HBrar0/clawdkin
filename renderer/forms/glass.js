// Form: Stained glass — a little rose window. Light sweeps across the panes while it works.
BB.forms.glass = {
  label: 'Stained glass', voice: 'glass', hat: { x: 0, y: -35 }, radius: BB.circR(37),
  build(root) {
    const N = 10, R0 = 13.5, R1 = 34;
    const g = BB.el('g', {}, root);
    const P = (a, r) => `${BB.fx2(Math.sin(a) * r)},${BB.fx2(-Math.cos(a) * r)}`;
    const panes = [];
    for (let i = 0; i < N; i++) {
      const a0 = (i * 2 * Math.PI) / N, a1 = ((i + 1) * 2 * Math.PI) / N, am = (a0 + a1) / 2;
      // each wedge is split into an inner and an outer pane
      const mid = 24;
      panes.push({ el: BB.el('path', { class: 'g-pane g' + (i % 4), d: `M${P(a0, R0)} L${P(a0, mid)} L${P(am, mid + 2.5)} L${P(a1, mid)} L${P(a1, R0)} A${R0},${R0} 0 0 0 ${P(a0, R0)}Z` }, g), a: am });
      panes.push({ el: BB.el('path', { class: 'g-pane g' + ((i + 2) % 4), d: `M${P(a0, mid)} L${P(a0, R1)} A${R1},${R1} 0 0 1 ${P(a1, R1)} L${P(a1, mid)} L${P(am, mid + 2.5)}Z` }, g), a: am });
    }
    BB.el('circle', { r: R1 + 1.2, class: 'g-rim' }, g);
    BB.el('circle', { r: R0, class: 'c-main g-lead' }, root);
    const face = BB.makeFace(root, { spacing: 4.8, scale: 0.9 });
    let rot = 0;

    return {
      update(f) {
        const c = f.cur;
        const together = f.state === 'waiting' ? 0.5 + 0.5 * Math.sin(f.t * 5) : 0;
        panes.forEach((p, i) => {
          let b = 0.72 + 0.1 * Math.sin(f.t * 0.9 + i * 1.7);
          if (c.wave > 0.05) b = 0.5 + 0.5 * Math.pow(Math.max(0, Math.cos(f.t * 3 - p.a)), 3) * c.wave + 0.25 * (1 - c.wave);
          if (f.state === 'waiting') b = 0.55 + 0.45 * together;
          if (f.state === 'done') b = 1;
          p.el.style.opacity = BB.fx2(b * (1 - 0.45 * c.sleep));
        });
        rot += c.spin * 0.25 * f.dt * 57.3;
        const burst = f.doneK >= 0 ? 360 * BB.easeOutBack(f.doneK) : 0;
        g.setAttribute('transform', `rotate(${BB.fx2(rot + burst + Math.sin(f.t * 0.6) * 3 * c.sway)}) scale(${BB.fx2(1 + c.flare * 0.5 + c.breath * Math.sin(f.t * 1.7))})`);
        face.update(f);
      },
    };
  },
};
