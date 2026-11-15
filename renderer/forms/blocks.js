// Form: Blocky — a chunky 3D cube. While working it stacks little cubes on its head.
BB.forms.blocks = {
  label: 'Blocky', voice: 'block', hat: { x: 5, y: -24 }, cy: 2, radius: BB.rectR(27, 27),
  build(root) {
    function cube(parent, s, d) {
      const g = BB.el('g', {}, parent);
      BB.el('path', { class: 'b-top', d: `M${-s},${-s} L${s},${-s} L${s + d},${-s - d} L${-s + d},${-s - d}Z` }, g);
      BB.el('path', { class: 'b-side', d: `M${s},${-s} L${s + d},${-s - d} L${s + d},${s - d} L${s},${s}Z` }, g);
      BB.el('rect', { class: 'c-main', x: -s, y: -s, width: 2 * s, height: 2 * s }, g);
      return g;
    }
    const all = BB.el('g', {}, root);
    const minis = [0, 1, 2].map(() => cube(all, 6, 3.5));
    const big = cube(all, 22, 11);
    const face = BB.makeFace(big, { spacing: 6, y: 1, scale: 1.05 });

    return {
      update(f) {
        const c = f.cur;
        // stack: cubes drop in one by one, then the stack clears and starts again
        const cyc = (f.t * 1.6) % 4.6;
        minis.forEach((m, j) => {
          let o = 0, y = -34 - j * 13, x = 6;
          if (c.wave > 0.05) {
            const local = cyc - j;
            if (local > 0 && cyc < 4) { o = 1; y -= 22 * Math.pow(1 - BB.clamp(local * 2.2, 0, 1), 2); }
            else if (cyc >= 4) { o = 1 - (cyc - 4) / 0.6; x += (j - 1) * 30 * (cyc - 4); y -= 14 * (cyc - 4); }
          } else if (f.state === 'done') { o = 1; }
          m.style.opacity = BB.fx2(BB.clamp(o, 0, 1) * Math.max(c.wave, f.state === 'done' ? 1 : 0));
          m.setAttribute('transform', `translate(${BB.fx2(x)},${BB.fx2(y)})`);
        });
        const rock = Math.sin(f.t * 0.6) * 3 * c.sway + (f.doneK >= 0 ? Math.sin(f.doneK * Math.PI * 2) * 12 : 0);
        const sq = 1 - 0.14 * c.sleep + c.breath * Math.sin(f.t * 1.7);
        all.setAttribute('transform', `translate(-5,${BB.fx2(8 + 3 * c.sleep)}) rotate(${BB.fx2(rock)}) translate(0,22) scale(${BB.fx2(1 + c.flare * 0.6)},${BB.fx2(sq)}) translate(0,-22)`);
        face.update(f);
      },
    };
  },
};
