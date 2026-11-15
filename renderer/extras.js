// Everything drawn around the buddy that isn't the buddy itself:
// tool props, the paper trail, sweat, session satellites, hats, mood marks.
(() => {
  const { el, fx2, clamp, lerp, hash } = BB;

  // ---------- hats ----------
  const HATS = {
    party(g) {
      el('path', { d: 'M-8,0 L0,-21 L8,0Z', fill: '#E8506E' }, g);
      el('path', { d: 'M-5.4,-7 L5.4,-7 L4,-10.6 L-4,-10.6Z M-2.7,-14 L2.7,-14 L1.4,-17.4 L-1.4,-17.4Z', fill: '#FFE08A' }, g);
      el('circle', { cy: -22, r: 3, fill: '#FFF8F2' }, g);
    },
    top(g) {
      el('rect', { x: -12, y: -3, width: 24, height: 3.4, rx: 1.6, fill: '#231C18' }, g);
      el('rect', { x: -7.5, y: -18, width: 15, height: 15.5, rx: 1.5, fill: '#231C18' }, g);
      el('rect', { x: -7.5, y: -7.5, width: 15, height: 3.2, fill: '#D97757' }, g);
    },
    beanie(g) {
      el('path', { d: 'M-10,-2 C-10,-17 10,-17 10,-2Z', fill: '#4E9A94' }, g);
      el('rect', { x: -11, y: -4.5, width: 22, height: 5, rx: 2.5, fill: '#FFF8F2' }, g);
      el('circle', { cy: -15.5, r: 3.2, fill: '#FFF8F2' }, g);
    },
    crown(g) {
      el('path', { d: 'M-10,0 L-10,-11 L-5,-5.5 L0,-13.5 L5,-5.5 L10,-11 L10,0Z', fill: '#E9B949' }, g);
      for (const x of [-10, 0, 10]) el('circle', { cx: x, cy: x ? -11.5 : -14, r: 1.7, fill: '#FFF2B8' }, g);
      el('circle', { cy: -3.6, r: 1.8, fill: '#E8506E' }, g);
    },
    cap(g) {
      el('path', { d: 'M-9,-1 C-9,-13 9,-13 9,-1Z', fill: '#5AA7E8' }, g);
      el('path', { d: 'M0,-1 C0,-13 9,-13 9,-1Z', fill: '#E8506E' }, g);
      el('rect', { x: 6, y: -3, width: 10, height: 3, rx: 1.5, fill: '#E9B949' }, g);
      el('rect', { x: -0.8, y: -14.5, width: 1.6, height: 4, fill: '#231C18' }, g);
      return el('rect', { x: -8, y: -16.4, width: 16, height: 2.4, rx: 1.2, fill: '#FFE08A' }, g); // propeller
    },
    santa(g) {
      el('path', { d: 'M-9,-2 C-8,-14 0,-20 11,-13 C6,-13 8,-6 9,-2Z', fill: '#D6383C' }, g);
      el('rect', { x: -11, y: -5, width: 22, height: 5.4, rx: 2.7, fill: '#FFF8F2' }, g);
      el('circle', { cx: 12, cy: -12, r: 3.3, fill: '#FFF8F2' }, g);
    },
  };
  BB.HAT_NAMES = [['auto', 'Seasonal'], ['none', 'None'], ['party', 'Party hat'], ['top', 'Top hat'], ['beanie', 'Beanie'], ['crown', 'Crown'], ['cap', 'Propeller cap'], ['santa', 'Santa hat']];
  BB.resolveHat = (cfg, date = new Date()) => {
    if (cfg.hat && cfg.hat !== 'auto') return cfg.hat;
    const m = date.getMonth() + 1, d = date.getDate();
    const md = String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
    if (cfg.birthday && cfg.birthday === md) return 'party';
    if (m === 12 && d >= 15) return 'santa';
    if (m === 12 || m <= 2) return 'beanie';
    return 'none';
  };

  // ---------- tool props ----------
  const PROPS = {
    search(g) {
      const m = el('g', {}, g);
      el('circle', { r: 6.2, class: 'prop glassy' }, m);
      el('path', { d: 'M4.6,4.6 L10.5,10.5', class: 'prop thick' }, m);
      return (t) => m.setAttribute('transform', `translate(${fx2(Math.sin(t * 2.4) * 5)},${fx2(Math.cos(t * 1.7) * 2)}) rotate(${fx2(Math.sin(t * 2.4) * 10)})`);
    },
    edit(g) {
      const sq = el('path', { class: 'prop thin', d: '' }, g);
      const p = el('g', {}, g);
      el('path', { d: 'M-2.2,-14 L2.2,-14 L2.2,-1 L0,3.6 L-2.2,-1Z', class: 'prop-fill' }, p);
      el('path', { d: 'M-1,1.4 L0,3.6 L1,1.4Z', fill: '#2A140B' }, p);
      return (t) => {
        const k = (t * 0.9) % 1;
        const x = -8 + 16 * k;
        let d = 'M-8,8';
        for (let i = 1; i <= Math.floor(k * 8); i++) d += ` L${fx2(-8 + i * 2)},${fx2(8 + (i % 2 ? -2.2 : 2.2))}`;
        sq.setAttribute('d', d);
        p.setAttribute('transform', `translate(${fx2(x)},${fx2(4 + Math.sin(t * 22) * 1.2)}) rotate(24)`);
      };
    },
    run(g) {
      el('rect', { x: -10.5, y: -8, width: 21, height: 16, rx: 3.2, class: 'prop-term' }, g);
      el('path', { d: 'M-6.4,-3 L-2.6,0 L-6.4,3', class: 'prop thin' }, g);
      const u = el('rect', { x: -0.5, y: 2, width: 5.6, height: 1.8, rx: 0.9, class: 'prop-fill' }, g);
      return (t) => { u.style.opacity = Math.floor(t * 3) % 2; };
    },
    web(g) {
      el('circle', { r: 7.6, class: 'prop glassy' }, g);
      el('path', { d: 'M-7.6,0 L7.6,0', class: 'prop thin' }, g);
      const mer = el('ellipse', { rx: 3.4, ry: 7.6, class: 'prop thin' }, g);
      return (t) => mer.setAttribute('rx', fx2(Math.abs(Math.cos(t * 1.4)) * 7.2 + 0.3));
    },
    agent(g) {
      const m = el('g', {}, g);
      for (let i = 0; i < 7; i++) el('path', { d: 'M0,-3 L0,-9', class: 'prop-ray', transform: `rotate(${(i * 360) / 7})` }, m);
      el('circle', { r: 4, class: 'c-main' }, m);
      el('circle', { cx: -1.5, cy: -0.3, r: 0.8, class: 'f-ink' }, m);
      el('circle', { cx: 1.5, cy: -0.3, r: 0.8, class: 'f-ink' }, m);
      return (t) => m.setAttribute('transform', `translate(0,${fx2(-Math.abs(Math.sin(t * 4)) * 4)}) rotate(${fx2(Math.sin(t * 2) * 14)})`);
    },
    mcp(g) {
      el('rect', { x: -5, y: -3, width: 10, height: 9, rx: 2.4, class: 'prop-fill' }, g);
      el('path', { d: 'M-2.4,-3 L-2.4,-8 M2.4,-3 L2.4,-8', class: 'prop thick' }, g);
      const cord = el('path', { class: 'prop thin', d: '' }, g);
      return (t) => cord.setAttribute('d', `M0,6 Q${fx2(Math.sin(t * 3) * 3)},11 -5,13`);
    },
  };

  BB.Extras = function (layers, fx) {
    const { under, over, hat: hatG, floor } = layers;
    // paper trail
    const scrapsG = el('g', {}, floor || under); // on the ground, not on the buddy
    let scraps = [], sweeping = null;
    // prop
    const propG = el('g', { transform: 'translate(40,28)', opacity: 0 }, over);
    let propName = '', propTick = null, propO = 0, propPop = 0;
    // satellites
    const satG = el('g', {}, over);
    let sats = [];
    // mood marks
    const frazz = el('path', { class: 'mood-line', opacity: 0 }, over);
    const dustG = el('g', { opacity: 0 }, over);
    el('path', { class: 'mood-web', d: 'M-48,-58 L-22,-34 M-48,-40 L-30,-58 M-44,-50 Q-36,-47 -34,-54 M-40,-44 Q-30,-41 -27,-50' }, dustG);
    const motes = [0, 1, 2, 3].map(() => el('circle', { r: 1.6, fill: '#D8CEC2', opacity: 0.7 }, dustG));
    let frazzTick = -1, lastTwinkle = 0, lastDrop = 0;
    // hat
    let hatName = '', hatSpin = null, hatO = 0;

    function setHat(name) {
      if (name === hatName) return;
      hatName = name;
      while (hatG.firstChild) hatG.firstChild.remove();
      hatSpin = HATS[name] ? HATS[name](hatG) || null : null;
    }
    function setProp(name) {
      if (name === propName) return;
      propName = name;
      while (propG.firstChild) propG.firstChild.remove();
      propTick = PROPS[name] ? PROPS[name](propG) || (() => {}) : null;
      propPop = 1;
    }

    return {
      // c: { t, dt, now, state, cur, st (state from main), cfg, form, morphing, hop }
      update(c) {
        const { t, dt, st, cfg } = c;
        const working = c.state === 'working';

        // --- prop ---
        const cat = working ? BB.toolCat(st.tool) : '';
        if (cat) setProp(cat);
        propO = lerp(propO, cat && cfg.showProps !== false ? 1 : 0, Math.min(1, dt * 8));
        propPop = Math.max(0, propPop - dt * 4);
        propG.setAttribute('opacity', fx2(propO));
        propG.setAttribute('transform', `translate(40,${fx2(28 + Math.sin(t * 3) * 1.5)}) scale(${fx2(1 + 0.35 * Math.sin(propPop * Math.PI))})`);
        if (propTick && propO > 0.02) propTick(t);

        // --- paper trail: one scrap per file edited this turn ---
        const want = cfg.showTrail === false ? 0 : Math.min(st.edits | 0, 8);
        if (!sweeping && scraps.length && (c.state === 'done' || want < scraps.length)) sweeping = { t0: c.now };
        if (sweeping) {
          const k = (c.now - sweeping.t0) / 650;
          scraps.forEach((s, i) => {
            const kk = clamp(k * 1.4 - i * 0.05, 0, 1);
            s.el.setAttribute('transform', `translate(${fx2(s.x - 46 * kk * kk)},${fx2(s.y - 10 * Math.sin(kk * Math.PI))}) rotate(${fx2(s.r - 200 * kk)})`);
            s.el.setAttribute('opacity', fx2(1 - kk));
          });
          if (k >= 1.1) { scraps.forEach((s) => s.el.remove()); scraps = []; sweeping = null; }
        } else {
          while (scraps.length < want) {
            const i = scraps.length;
            const g = el('g', {}, scrapsG);
            el('rect', { x: -4.5, y: -5.5, width: 9, height: 11, rx: 1, fill: '#FBF6EF', stroke: 'rgba(60,30,15,.35)', 'stroke-width': 0.6 }, g);
            el('path', { d: 'M-2.4,-2 L2.4,-2 M-2.4,0.6 L1.2,0.6', stroke: '#D97757', 'stroke-width': 0.9, 'stroke-linecap': 'round' }, g);
            scraps.push({ el: g, x: -52 + (i % 4) * 5.5 + hash(i) * 3, y: 53.5 - Math.floor(i / 4) * 2.4 - (i % 2) * 1.2, r: (hash(i + 9) - 0.5) * 70, born: c.now });
          }
          scraps.forEach((s) => {
            const k = clamp((c.now - s.born) / 700, 0, 1), e = 1 - Math.pow(1 - k, 3);
            s.el.setAttribute('transform', `translate(${fx2(s.x + (1 - e) * 26 + Math.sin(k * 9) * 5 * (1 - k))},${fx2(s.y - (1 - e) * 44)}) rotate(${fx2(s.r + (1 - e) * 160)})`);
            s.el.setAttribute('opacity', fx2(Math.min(1, k * 4)));
          });
        }

        // --- sweat on long turns ---
        const turnSec = working && st.turnStart ? (Date.now() - st.turnStart) / 1000 : 0;
        if (turnSec > (cfg.sweatAfterSec || 180) && t - lastDrop > (turnSec > 600 ? 0.5 : 1.1)) { lastDrop = t; fx.drop(BB.rand(14, 22), -24 + (c.bodyY || 0)); }

        // --- satellites: one per extra active session ---
        const active = (st.sessions || []).filter((s) => s.state === 'working' || s.state === 'waiting');
        const n = active.length >= 2 ? Math.min(active.length, 6) : 0;
        while (sats.length < n) sats.push(el('circle', { class: 'sat' }, satG));
        while (sats.length > n) sats.pop().remove();
        sats.forEach((s, i) => {
          const a = t * 0.9 + (i * 2 * Math.PI) / n;
          const waiting = active[i].state === 'waiting';
          const depth = 0.8 + 0.2 * Math.sin(a);
          s.setAttribute('cx', fx2(Math.cos(a) * 60));
          s.setAttribute('cy', fx2(-2 + Math.sin(a) * 13));
          s.setAttribute('r', fx2((waiting ? 3.8 : 2.6) * depth));
          s.setAttribute('fill', waiting ? '#FFE08A' : 'var(--light)');
          s.setAttribute('opacity', fx2(waiting ? 0.55 + 0.45 * Math.sin(t * 9) : 0.85 * depth));
        });

        // --- mood marks (only while idle) ---
        const idle = c.state === 'idle';
        const fz = idle && st.mood === 'frazzled';
        frazz.setAttribute('opacity', fx2(lerp(+frazz.getAttribute('opacity'), fz ? 0.9 : 0, Math.min(1, dt * 5))));
        if (fz && Math.floor(t / 0.13) !== frazzTick) {
          frazzTick = Math.floor(t / 0.13);
          let d = '';
          for (let i = 0; i <= 9; i++) d += (i ? 'L' : 'M') + fx2(-12 + i * 2.7 + (hash(frazzTick + i) - 0.5) * 3) + ',' + fx2(-52 + (i % 2 ? -4 : 4) * hash(frazzTick * 3 + i) - (c.bodyY ? 0 : 0));
          frazz.setAttribute('d', d);
        }
        const dusty = st.mood === 'dusty' && c.state !== 'working';
        dustG.setAttribute('opacity', fx2(lerp(+dustG.getAttribute('opacity'), dusty ? 1 : 0, Math.min(1, dt * 3))));
        if (dusty) motes.forEach((m, i) => { m.setAttribute('cx', fx2(Math.sin(t * 0.5 + i * 2) * 34)); m.setAttribute('cy', fx2(-20 + Math.cos(t * 0.37 + i * 1.6) * 26)); });
        if (idle && st.mood === 'proud' && t - lastTwinkle > 2.6) { lastTwinkle = t; fx.sparkles(BB.rand(-30, 30), BB.rand(-40, -18), 1, { dist: 8, r0: 0, size: 0.8 }); }

        // --- hat ---
        const hn = BB.resolveHat(cfg);
        setHat(hn);
        const F = BB.forms[c.form] || {};
        const hp = F.hat || { x: 0, y: -12 };
        hatO = lerp(hatO, HATS[hn] && !c.morphing ? 1 : 0, Math.min(1, dt * 8));
        hatG.setAttribute('opacity', fx2(hatO));
        hatG.setAttribute('transform', `translate(${hp.x},${hp.y}) rotate(${fx2(Math.sin(t * 1.3) * 3)})`);
        if (hatSpin) hatSpin.setAttribute('transform', `translate(0,-15.2) scale(${fx2(Math.cos(t * (working ? 22 : 3)))},1) translate(0,15.2)`);
      },
    };
  };
})();
