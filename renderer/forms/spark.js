// Form: the Spark — the Claude starburst with a face.
BB.forms.spark = {
  label: 'Spark',
  build(root) {
    const LENS = [42, 31, 38, 28.5, 41, 33, 39, 29.5, 40, 34.5, 30.5];
    const JIT = [-3, 4, -2, 5, -4, 2, -3, 4, -1, 3, -2];
    const N = LENS.length;
    const INNER = 7;
    const raysG = BB.el('g', {}, root);
    const rays = LENS.map((len, i) => {
      const ang = (i * 360) / N + JIT[i];
      const g = BB.el('g', { transform: `rotate(${ang})` }, raysG);
      const ln = BB.el('line', { x1: 0, y1: -INNER, x2: 0, y2: -len, class: 'ray s-main' }, g);
      return { g, ln, len, ang, phase: i / N };
    });
    BB.el('circle', { r: 13, class: 'c-main' }, root);
    const face = BB.makeFace(root);
    const WAVER = 2; // the ray that waves hello (upper right)
    let rot = 0;

    return {
      update(f) {
        const c = f.cur;
        rot += c.spin * f.dt * 57.3;
        let burst = 0;
        if (f.doneK >= 0) burst = 360 * BB.easeOutBack(f.doneK);
        const sway = Math.sin(f.t * 0.6) * 4 * c.sway;
        raysG.setAttribute('transform', `rotate(${BB.fx2(rot + burst + sway)})`);

        const breathe = Math.sin(f.t * (c.sleep > 0.5 ? 1.1 : 1.7));
        const actName = f.act && f.act.name;
        for (let i = 0; i < N; i++) {
          const r = rays[i];
          let s = 1 + c.flare + c.breath * breathe - 0.06 * c.sleep;
          if (c.wave > 0.001) {
            const pulse = Math.pow(Math.max(0, Math.cos(f.t * 4.2 - r.phase * Math.PI * 2)), 3);
            s += c.wave * (0.34 * pulse - 0.09);
          }
          if (c.hop > 0.01) s += c.hop * 0.05 * Math.sin(f.t * 9 + i * 1.3);
          if (actName === 'sneeze') s += 0.16 * Math.sin(BB.seg(f.act.k, 0.45, 0.6) * Math.PI);
          if (actName === 'stretch') s += 0.12 * Math.sin(BB.seg(f.act.k, 0, 0.8) * Math.PI);
          let ang = r.ang;
          if (actName === 'wave' && i === WAVER) {
            const env = Math.sin(f.act.k * Math.PI);
            ang += Math.sin(f.act.k * Math.PI * 7) * 28 * env;
            s += 0.18 * env;
          }
          r.g.setAttribute('transform', `rotate(${BB.fx2(ang)})`);
          r.ln.setAttribute('y2', BB.fx2(-(INNER + (r.len - INNER) * s)));
        }
        face.update(f);
      },
    };
  },
};
