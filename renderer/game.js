// Pocket mini-game: catch falling sparks for 20 seconds. The buddy slides under your mouse.
BB.Game = function (layer, fx) {
  const { el, fx2, clamp, lerp } = BB;
  const DUR = 20;
  let g = null, hud = null, bar = null, sparks = [], t0 = 0, score = 0, x = 0, nextSpawn = 0, active = false, best = 0;

  function end(onEnd) {
    active = false;
    sparks.forEach((s) => s.el.remove()); sparks = [];
    if (g) { g.remove(); g = null; }
    const record = score > best;
    fx.word(record ? `${score}! new best` : `${score} caught`, 0, -40, { size: 12, bold: true, life: 2200 });
    if (record) fx.sparkles(0, 0, 10, { dist: 58 });
    BB.sfx.play(record ? 'unlock' : 'done');
    onEnd(score, record);
  }

  return {
    get active() { return active; },
    start(bestSoFar) {
      if (active) return;
      active = true; score = 0; x = 0; best = bestSoFar | 0; t0 = performance.now(); nextSpawn = 0.5;
      g = el('g', {}, layer);
      el('rect', { x: -70, y: -90, width: 140, height: 4, rx: 2, fill: 'rgba(255,255,255,.18)' }, g);
      bar = el('rect', { x: -70, y: -90, width: 140, height: 4, rx: 2, class: 'c-main' }, g);
      hud = el('text', { class: 'word', x: 0, y: -74, 'text-anchor': 'middle', 'font-size': 17, 'font-weight': 800 }, g);
      hud.textContent = '0';
    },
    // returns { x, look } while playing; calls onEnd(score, record) when the time is up
    update(dt, now, cursorDx, onEnd) {
      const el2 = (now - t0) / 1000;
      if (el2 >= DUR) { end(onEnd); return null; }
      bar.setAttribute('width', fx2(140 * (1 - el2 / DUR)));
      x = lerp(x, clamp(cursorDx, -50, 50), Math.min(1, dt * 14));
      nextSpawn -= dt;
      if (nextSpawn <= 0) {
        nextSpawn = BB.rand(0.35, 0.8) * (1 - 0.35 * (el2 / DUR));
        sparks.push({ el: el('path', { class: 'f-light', d: 'M0,-5 L1.4,-1.4 L5,0 L1.4,1.4 L0,5 L-1.4,1.4 L-5,0 L-1.4,-1.4Z' }, g), x: BB.rand(-56, 56), y: -84, v: BB.rand(70, 105) + el2 * 3, r: BB.rand(0, 90) });
      }
      let nearest = null;
      sparks = sparks.filter((s) => {
        s.y += s.v * dt; s.r += dt * 200;
        s.el.setAttribute('transform', `translate(${fx2(s.x)},${fx2(s.y)}) rotate(${fx2(s.r)})`);
        if (s.y > -30 && s.y < 22 && Math.abs(s.x - x) < 24) {
          score++; hud.textContent = String(score);
          fx.sparkles(s.x, s.y, 3, { dist: 16, r0: 2, size: 0.6 });
          BB.sfx.play('catch');
          s.el.remove(); return false;
        }
        if (s.y > 56) { s.el.remove(); return false; }
        if (!nearest || s.y > nearest.y) nearest = s;
        return true;
      });
      return { x, look: nearest ? { x: clamp((nearest.x - x) / 12, -2.6, 2.6), y: -1.6 } : { x: 0, y: -1.2 } };
    },
    cancel() { if (active) { active = false; sparks.forEach((s) => s.el.remove()); sparks = []; if (g) g.remove(); g = null; } },
  };
};
