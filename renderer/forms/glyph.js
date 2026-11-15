// Form: the Glyph — Claude Code's spinner star (· ✢ ✳ ✶ ✻ ✽), morphing petal by petal.
BB.forms.glyph = {
  label: 'Glyph',
  build(root) {
    const MAX = 8;
    // n petals, length L, half-width w (teardrop belly), core radius
    const V = {
      dot:   { n: 8, L: 15, w: 4,   core: 14.5 }, // ·  (curled up into a seed)
      four:  { n: 4, L: 42, w: 10,  core: 11 },   // ✢
      eight: { n: 8, L: 41, w: 3.4, core: 11 },   // ✳
      six:   { n: 6, L: 41, w: 12,  core: 11 },   // ✶
      tear:  { n: 8, L: 39, w: 7.6, core: 11 },   // ✻
      heavy: { n: 8, L: 37, w: 10.5, core: 12 },  // ✽
    };
    const SPIN_SEQ = ['dot', 'four', 'eight', 'six', 'tear', 'heavy', 'tear', 'six', 'eight', 'four'];

    const petalsG = BB.el('g', {}, root);
    const petals = [];
    for (let i = 0; i < MAX; i++) {
      petals.push({ el: BB.el('path', { class: 'c-main' }, petalsG), ang: (i * 360) / MAX, L: 40, w: 7 });
    }
    const core = BB.el('circle', { r: 11, class: 'c-main' }, root);
    const face = BB.makeFace(root, { spacing: 4.9, scale: 0.92 });
    let coreR = 11;
    let rot = 0;
    let seqI = 0, seqT = 0;

    function targetsFor(name, flare) {
      const v = V[name];
      return petals.map((p, i) => {
        if (i < v.n) return { ang: (i * 360) / v.n, L: v.L * (1 + flare), w: v.w };
        // extra petals tuck into a neighbour and shrink away
        return { ang: ((i % v.n) * 360) / v.n, L: 0, w: 0 };
      });
    }

    return {
      update(f) {
        const c = f.cur;
        let variant = 'tear';
        if (f.state === 'working') {
          seqT += f.dt;
          if (seqT > 0.13) { seqT = 0; seqI = (seqI + 1) % SPIN_SEQ.length; }
          variant = SPIN_SEQ[seqI];
        } else if (f.state === 'waiting') variant = 'six';
        else if (f.state === 'done') variant = 'heavy';
        else if (c.sleep > 0.5) variant = 'dot';
        if (f.act && (f.act.name === 'shake' || f.act.name === 'sneeze')) variant = 'eight';
        if (f.act && f.act.name === 'stretch') variant = 'four';

        const flare = c.flare + c.breath * Math.sin(f.t * 1.7);
        const tg = targetsFor(variant, flare);
        const k = Math.min(1, f.dt * (f.state === 'working' ? 22 : 7));
        for (let i = 0; i < MAX; i++) {
          const p = petals[i], t = tg[i];
          // shortest-path angle lerp
          let d = ((t.ang - p.ang + 540) % 360) - 180;
          p.ang += d * k;
          p.L = BB.lerp(p.L, t.L, k);
          p.w = BB.lerp(p.w, t.w, k);
          const L = Math.max(0.01, p.L), w = p.w;
          p.el.setAttribute('d', `M0,0 C${BB.fx2(w)},${BB.fx2(-L * 0.28)} ${BB.fx2(w * 0.72)},${BB.fx2(-L * 0.82)} 0,${BB.fx2(-L)} C${BB.fx2(-w * 0.72)},${BB.fx2(-L * 0.82)} ${BB.fx2(-w)},${BB.fx2(-L * 0.28)} 0,0Z`);
          p.el.setAttribute('transform', `rotate(${BB.fx2(p.ang)})`);
        }
        coreR = BB.lerp(coreR, V[variant].core, k);
        core.setAttribute('r', BB.fx2(coreR));

        rot += (c.spin * 0.35 + 0.1 * (1 - c.sleep)) * f.dt * 57.3;
        let burst = f.doneK >= 0 ? 360 * BB.easeOutBack(f.doneK) : 0;
        petalsG.setAttribute('transform', `rotate(${BB.fx2(rot + burst + Math.sin(f.t * 0.6) * 3 * c.sway)})`);
        face.update(f);
      },
    };
  },
};
