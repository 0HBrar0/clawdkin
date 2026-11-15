// Form: Clawd — the little pixel crab from Claude Code. Moves in crisp pixel steps.
BB.forms.clawd = {
  label: 'Clawd',
  build(root) {
    const u = 5;        // body pixel
    const p = u / 2;    // eye pixel
    const crab = BB.el('g', { transform: 'translate(0,15)', 'shape-rendering': 'crispEdges' }, root);
    const legs = [-6, -4, 3, 5].map((x) => BB.el('rect', { x: x * u, y: 3 * u, width: u, height: 2 * u, class: 'c-main' }, crab));
    const upper = BB.el('g', {}, crab);
    const body = BB.el('rect', { x: -7 * u, y: -5 * u, width: 14 * u, height: 8 * u, class: 'c-main' }, upper);
    const armL = BB.el('rect', { x: -9 * u, y: -2 * u, width: 2 * u + 0.5, height: 2 * u, class: 'c-main' }, upper);
    const armR = BB.el('rect', { x: 7 * u - 0.5, y: -2 * u, width: 2 * u + 0.5, height: 2 * u, class: 'c-main' }, upper);
    const eyeG = [BB.el('g', {}, upper), BB.el('g', {}, upper)];
    const EYE_X = [-2.5 * u - p, 2.5 * u - p];
    const EYE_Y = -3.5 * u;

    const S = {
      open:   [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2], [1, 2], [0, 3], [1, 3]],
      wide:   [[0, -1], [1, -1], [0, 0], [1, 0], [0, 1], [1, 1], [0, 2], [1, 2], [0, 3], [1, 3]],
      closed: [[-1, 2], [0, 2], [1, 2], [2, 2]],
      happy:  [[-1, 2], [0, 1], [1, 1], [2, 2]],
      squintL: [[-1, 0], [0, 1], [1, 2], [0, 3], [-1, 4]],
      squintR: [[2, 0], [1, 1], [0, 2], [1, 3], [2, 4]],
      dizzy:  [[-1, 0], [2, 0], [0, 1], [1, 1], [0, 2], [1, 2], [-1, 3], [2, 3]],
      heart:  [[-1, 0], [0, 0], [2, 0], [3, 0], [-1, 1], [0, 1], [1, 1], [2, 1], [3, 1], [0, 2], [1, 2], [2, 2], [1, 3]],
    };
    const shown = ['', ''];
    function setEye(i, key) {
      if (shown[i] === key) return;
      shown[i] = key;
      const g = eyeG[i];
      while (g.firstChild) g.firstChild.remove();
      const cls = key === 'heart' ? 'f-heart' : 'f-ink';
      for (const [cx, cy] of S[key]) BB.el('rect', { x: cx * p, y: cy * p, width: p + 0.3, height: p + 0.3, class: cls }, g);
    }

    function arm(rect, side, raised) {
      // raised: 0 = resting at the side, 1 = up by the head
      const y = raised ? -7 * u : -2 * u;
      rect.setAttribute('y', y);
      rect.setAttribute('height', raised ? 2.5 * u : 2 * u);
      rect.setAttribute('x', side < 0 ? (raised ? -8 * u : -9 * u) : (raised ? 6 * u : 7 * u - 0.5));
    }

    return {
      update(f) {
        const c = f.cur;
        const st = Math.floor(f.t * 8);
        const act = f.act && f.act.name;
        let bob = 0, dx = 0, sink = 0;
        let aL = 0, aR = 0;
        let legLift = [0, 0, 0, 0];
        let typing = -1;

        if (f.state === 'working') {
          const ph = st % 2;
          legLift = ph ? [1, 0, 1, 0] : [0, 1, 0, 1];
          typing = Math.floor(f.t * 7) % 2; // arms tap alternately, like typing
          dx = Math.round(Math.sin(f.t * 1.8) * 3) * p; // scuttles sideways
          bob = (Math.floor(f.t * 6) % 2) * 0.5 * p;
        } else if (f.state === 'waiting') {
          const w = Math.floor(f.t * 4) % 2;
          aL = w; aR = 1 - w;
        } else if (f.state === 'done') {
          aL = 1; aR = 1;
        } else if (c.sleep > 0.5) {
          sink = 2 * u;
        } else {
          bob = (Math.floor(f.t * 1.6) % 2) * p * 0.5;
        }
        if (act === 'wave') { aR = Math.floor(f.t * 6) % 2 ? 1 : 0.999; aL = 0; }
        if (act === 'juggle' || act === 'sing') { const w = Math.floor(f.t * 5) % 2; aL = w; aR = 1 - w; }
        if (act === 'stretch') { const up = f.act.k > 0.1 && f.act.k < 0.8; aL = aR = up ? 1 : 0; }
        if (f.doneK >= 0) { aL = aR = 1; bob = -Math.round(Math.sin(f.doneK * Math.PI) * 3) * p; }

        arm(armL, -1, aL >= 0.5);
        arm(armR, 1, aR >= 0.5);
        if (typing >= 0 && !act) {
          armL.setAttribute('y', -2 * u + (typing ? p : 0));
          armR.setAttribute('y', -2 * u + (typing ? 0 : p));
        }
        if (act === 'wave') armR.setAttribute('x', (Math.floor(f.t * 6) % 2 ? 6 : 6.6) * u);

        legs.forEach((lg, i) => {
          const h = Math.max(0, 2 * u - sink - legLift[i] * p);
          lg.setAttribute('height', h);
          lg.setAttribute('y', 3 * u - legLift[i] * p);
        });
        upper.setAttribute('transform', `translate(0,${bob + sink})`);
        crab.setAttribute('transform', `translate(${dx},15)`);

        // eyes
        let key = f.expr;
        if ((key === 'open' || key === 'wide') && f.lid < 0.45) key = 'closed';
        const lx = Math.round(f.look.x * 0.6) * p;
        const ly = Math.round(f.look.y * 0.5) * p;
        for (let i = 0; i < 2; i++) {
          setEye(i, key === 'squint' ? (i ? 'squintR' : 'squintL') : S[key] ? key : 'open');
          eyeG[i].setAttribute('transform', `translate(${EYE_X[i] + lx},${EYE_Y + ly})`);
        }
      },
    };
  },
};
