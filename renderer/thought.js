// The thought cloud: rises from the buddy's head when you hover, and says what Claude is up to.
// Drawn in the SVG so it scales with the buddy and always fits the window.
(() => {
  const MAX_W = 136, PAD_X = 9, PAD_Y = 6;
  const SIZES = [10.5, 9, 7.8];   // line 1 (doing), line 2 (the task), line 3 (details)
  const GAP = 2.5;

  BB.Thought = function (layer) {
    const root = BB.el('g', { class: 'th' }, layer);
    const pos = BB.el('g', {}, root);
    const pop = BB.el('g', { class: 'th-pop' }, pos);
    const edge = BB.el('g', { class: 'th-edge' }, pop);
    const body = BB.el('g', { class: 'th-body' }, pop);
    const texts = SIZES.map((s, i) => BB.el('text', { class: 'th-t th-' + (i + 1), 'font-size': s, 'text-anchor': 'middle' }, pop));
    const trail = [BB.el('circle', { class: 'th-dot', r: 1.7 }, root), BB.el('circle', { class: 'th-dot', r: 2.6 }, root)];
    let key = '', w = 0, h = 0, shown = false;

    // fit a line into the cloud, cutting it with an ellipsis if needed
    function fit(el, str) {
      el.textContent = str;
      if (!str) return 0;
      let len = el.getComputedTextLength();
      if (len <= MAX_W - PAD_X * 2) return len;
      let s = str;
      while (s.length > 3 && len > MAX_W - PAD_X * 2) { s = s.slice(0, -2); el.textContent = s.trimEnd() + '…'; len = el.getComputedTextLength(); }
      return len;
    }
    // a cloud: a rounded box with bumps along the top and bottom, drawn twice (outline, then fill)
    function cloud(W, H) {
      for (const g of [edge, body]) while (g.firstChild) g.firstChild.remove();
      const bumps = [];
      const n = Math.max(2, Math.round(W / 17));
      for (let i = 0; i < n; i++) {
        const x = -W / 2 + 8 + (i * (W - 16)) / (n - 1);
        bumps.push([x, -H / 2 + 1, 7.5 + (i % 2) * 1.5]);
        if (i > 0 && i < n - 1) bumps.push([x + 4, H / 2 - 1, 5.5 + ((i + 1) % 2) * 1.2]);
      }
      for (const [g, grow] of [[edge, 1.1], [body, 0]]) {
        BB.el('rect', { x: -W / 2 - grow, y: -H / 2 - grow, width: W + grow * 2, height: H + grow * 2, rx: 9 + grow }, g);
        for (const [x, y, r] of bumps) BB.el('circle', { cx: x, cy: y, r: r + grow }, g);
      }
    }

    // lines: [doing, task, details]; at: { x, headTop } in viewBox units
    function update(on, lines, at) {
      if (on !== shown) { shown = on; root.classList.toggle('show', on); }
      if (!on) return;
      const k = lines.join('\u0001');
      if (k !== key) {
        key = k;
        const widths = lines.map((l, i) => fit(texts[i], l || ''));
        const used = lines.map((l) => !!l);
        let y = 0; const ys = [];
        used.forEach((u, i) => { if (u) { ys[i] = y + SIZES[i] * 0.8; y += SIZES[i] + GAP; } });
        const textH = y - GAP;
        w = Math.min(MAX_W, Math.max(44, ...widths) + PAD_X * 2);
        h = textH + PAD_Y * 2;
        texts.forEach((t, i) => { t.setAttribute('y', used[i] ? (ys[i] - textH / 2).toFixed(1) : -999); t.setAttribute('x', 0); });
        cloud(w, h);
      }
      // sit above the head, inside the window (x -75..75, top at -112)
      const bottom = at.headTop - 13;
      const cy = Math.max(-110 + h / 2 + 7.5, bottom - h / 2);
      const cx = BB.clamp(at.x, -75 + w / 2 + 2, 75 - w / 2 - 2);
      pos.setAttribute('transform', `translate(${cx.toFixed(1)},${cy.toFixed(1)})`);
      pop.style.transformOrigin = `${(at.x + 8 - cx).toFixed(1)}px ${(h / 2).toFixed(1)}px`;
      // the little trail of bubbles from the head up to the cloud
      const tx = at.x + 9, gapTop = cy + h / 2 + 2, gapBot = at.headTop - 2;
      trail[0].setAttribute('cx', tx.toFixed(1)); trail[0].setAttribute('cy', Math.max(gapTop, gapBot - 2).toFixed(1));
      trail[1].setAttribute('cx', (tx + 3).toFixed(1)); trail[1].setAttribute('cy', Math.max(gapTop, (gapTop + gapBot) / 2 - 1).toFixed(1));
      trail.forEach((d) => d.style.display = gapBot - gapTop > 5 ? '' : 'none');
    }
    return { update };
  };
})();
