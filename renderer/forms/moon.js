// Form: Night — a crescent moon with a few stars. Earned by working late.
BB.forms.moon = {
  label: 'Night', voice: 'moon', hat: { x: -13, y: -26 }, radius: BB.circR(30),
  build(root) {
    const g = BB.el('g', { class: 'ink-dark' }, root);
    BB.el('path', { class: 'm-moon', d: 'M10,-29 A31,31 0 1 0 10,29 A38,38 0 0 1 10,-29Z' }, g);
    const faceG = BB.el('g', { transform: 'translate(-12.5,2)' }, g);
    const face = BB.makeFace(faceG, { spacing: 3.7, y: 0, scale: 0.72 });
    const STAR = 'M0,-4.4 L1.1,-1.1 L4.4,0 L1.1,1.1 L0,4.4 L-1.1,1.1 L-4.4,0 L-1.1,-1.1Z';
    const HOME = [[15, -13], [27, 5], [12, 17]];
    const stars = HOME.map(() => BB.el('path', { class: 'm-star', d: STAR }, root));
    const pos = HOME.map((h) => ({ x: h[0], y: h[1] }));

    return {
      update(f) {
        const c = f.cur;
        const rock = Math.sin(f.t * 0.7) * 5 * (c.sway + c.sleep * 0.6) + (f.state === 'waiting' ? Math.sin(f.t * 6) * 7 : 0)
          + (f.doneK >= 0 ? 360 * BB.easeOutBack(f.doneK) : 0);
        g.setAttribute('transform', `rotate(${BB.fx2(rock)}) scale(${BB.fx2(1 + c.flare * 0.6 + c.breath * Math.sin(f.t * 1.7))})`);
        stars.forEach((s, i) => {
          let tx = HOME[i][0], ty = HOME[i][1];
          if (c.wave > 0.05) { // stars orbit while working
            const a = f.t * 2.2 + (i * 2 * Math.PI) / 3;
            tx = BB.lerp(tx, Math.cos(a) * 36, c.wave); ty = BB.lerp(ty, Math.sin(a) * 30, c.wave);
          }
          const k = Math.min(1, f.dt * 6);
          pos[i].x = BB.lerp(pos[i].x, tx, k); pos[i].y = BB.lerp(pos[i].y, ty, k);
          const tw = f.state === 'waiting' ? 1.1 + 0.5 * Math.sin(f.t * 9 + i * 2) : 0.75 + 0.3 * Math.sin(f.t * 2.2 + i * 2.1);
          s.setAttribute('transform', `translate(${BB.fx2(pos[i].x)},${BB.fx2(pos[i].y)}) scale(${BB.fx2(tw * (1 - 0.4 * c.sleep))}) rotate(${BB.fx2(f.t * 30 + i * 40)})`);
        });
        face.update(f);
      },
    };
  },
};
