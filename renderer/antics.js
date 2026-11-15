// Silly antics. Each one runs for `dur` seconds; run(k, f, o, fx) gets progress k (0..1)
// and fills `o` with body offsets (dx, dy, rot, sx, sy), an expression, a look target,
// and `hole` (0..1) for the hole it can sink into. `fx` spawns little effects.
(() => {
  const { seg, easeIn, easeOut, easeInOut, easeOutBack } = BB;
  const S = Math.sin, PI = Math.PI;

  BB.antics = {
    spin: {
      label: 'Spin till dizzy', dur: 2.6,
      run(k, f, o) {
        const a = seg(k, 0, 0.42);
        o.rot = easeInOut(a) * 720;
        if (k < 0.42) { o.sy = 1 - 0.08 * S(a * PI); o.expr = 'happy'; }
        else {
          const b = seg(k, 0.42, 1);
          o.expr = b < 0.75 ? 'dizzy' : null;
          o.rot += S(f.t * 11) * 11 * (1 - b);
          o.dx = S(f.t * 7) * 3.5 * (1 - b);
        }
      },
    },
    flip: {
      label: 'Backflip', dur: 1.6,
      run(k, f, o, fx) {
        const a = seg(k, 0, 0.16), u = seg(k, 0.16, 0.8), l = seg(k, 0.8, 1);
        if (k < 0.16) { o.sy = 1 - 0.16 * S(a * PI); o.sx = 1 + 0.08 * S(a * PI); o.expr = 'squint'; }
        else if (k < 0.8) { o.dy = -S(u * PI) * 36; o.rot = -easeInOut(u) * 360; o.expr = 'wide'; }
        else {
          o.sy = 1 - 0.14 * S(l * PI); o.sx = 1 + 0.12 * S(l * PI); o.expr = 'happy';
          fx.once('land', () => fx.sparkles(0, 46, 6, { spread: PI * 0.9, dir: -PI / 2, dist: 22, size: 0.6 }));
        }
      },
    },
    peek: {
      label: 'Hide and peek', dur: 5.2,
      run(k, f, o) {
        const down = seg(k, 0, 0.16), rise = seg(k, 0.5, 0.62), pop = seg(k, 0.84, 1);
        if (k < 0.5) { o.dy = easeIn(down) * 80; o.hole = Math.min(1, down * 3); o.expr = down < 0.5 ? 'wide' : 'closed'; }
        else if (k < 0.84) {
          o.dy = 80 - easeOut(rise) * 48; o.hole = 1; o.expr = 'wide';
          if (k > 0.62) o.look = { x: S((k - 0.62) * 34) * 2.4, y: -0.6 };
        } else { o.dy = 32 * (1 - easeOutBack(pop, 2.4)); o.hole = 1 - pop; o.expr = 'happy'; }
      },
    },
    stretch: {
      label: 'Big stretch', dur: 3.2,
      run(k, f, o, fx) {
        const up = seg(k, 0, 0.35), down = seg(k, 0.62, 0.8), settle = seg(k, 0.8, 1);
        if (k < 0.62) {
          o.sy = 1 + 0.25 * easeInOut(up); o.sx = 1 - 0.1 * easeInOut(up); o.expr = 'closed';
          if (k > 0.35) o.dx = S(f.t * 50) * 0.8;
          fx.once('yawn', () => fx.word('yawn~', 24, -48, { size: 9 }));
        } else if (k < 0.8) { o.sy = 1 + 0.25 * (1 - easeInOut(down)); o.sx = 1 - 0.1 * (1 - easeInOut(down)); o.expr = 'closed'; }
        else { o.sy = 1 - 0.07 * S(settle * PI * 2) * (1 - settle); o.expr = 'happy'; }
      },
    },
    shake: {
      label: 'Wet-dog shake', dur: 1.5,
      run(k, f, o, fx) {
        const env = S(k * PI);
        o.dx = S(f.t * 46) * 4 * env;
        o.rot = S(f.t * 46 + 0.6) * 13 * env;
        o.expr = 'squint';
        if (k > 0.7) fx.once('spray', () => { fx.sparkles(0, 0, 5, { dir: 0, spread: 0.9, dist: 46, size: 0.5 }); fx.sparkles(0, 0, 5, { dir: PI, spread: 0.9, dist: 46, size: 0.5 }); });
      },
    },
    juggle: {
      label: 'Juggle', dur: 4.8,
      run(k, f, o, fx) {
        const fade = Math.min(seg(k, 0, 0.08), 1 - seg(k, 0.9, 1));
        let lookX = 0;
        for (let j = 0; j < 3; j++) {
          const ball = fx.persist('ball' + j, (layer) => BB.el('path', { class: 'f-light', d: 'M0,-4.2 L1.2,-1.2 L4.2,0 L1.2,1.2 L0,4.2 L-1.2,1.2 L-4.2,0 L-1.2,-1.2Z' }, layer));
          const ph = ((f.t * 1.25 + j / 3) % 1) * PI * 2;
          const x = 24 * Math.cos(ph), y = -52 - 20 * Math.max(0, S(ph)) + 4 * Math.max(0, -S(ph));
          ball.setAttribute('transform', `translate(${BB.fx2(x)},${BB.fx2(y + o.dy)}) rotate(${BB.fx2(f.t * 300 + j * 40)})`);
          ball.style.opacity = BB.fx2(fade);
          if (j === 0) lookX = x / 10;
        }
        o.look = { x: lookX, y: -1.6 };
        o.dy = -Math.abs(S(f.t * 7.8)) * 2;
      },
    },
    sneeze: {
      label: 'Sneeze', dur: 2.5,
      run(k, f, o, fx) {
        const a = seg(k, 0, 0.45), b = seg(k, 0.45, 0.55), c = seg(k, 0.55, 1);
        if (k < 0.45) {
          o.sy = 1 + 0.12 * easeIn(a); o.sx = 1 - 0.04 * a; o.rot = -9 * a;
          o.expr = a < 0.55 ? 'wide' : 'squint';
          if (k > 0.12) fx.once('ah', () => fx.word('ah…', -26, -44, { size: 9 }));
        } else if (k < 0.55) {
          o.rot = -9 + 24 * easeOut(b); o.sx = 1 + 0.2 * S(b * PI); o.sy = 1 - 0.18 * S(b * PI); o.dx = 5 * b;
          o.expr = 'squint';
          fx.once('choo', () => { fx.word('CHOO!', 30, -40, { size: 11, bold: true }); fx.sparkles(14, -4, 8, { dir: -0.2, spread: 0.8, dist: 52, size: 0.7 }); });
        } else {
          o.rot = 15 * (1 - c) * Math.cos(c * 12); o.dx = 5 * (1 - c);
          o.expr = c < 0.45 ? 'dizzy' : 'happy';
        }
      },
    },
    roll: {
      label: 'Roll around', dur: 2.8,
      run(k, f, o) {
        const out = seg(k, 0, 0.42), back = seg(k, 0.56, 1);
        o.dx = k < 0.56 ? -24 * easeInOut(out) : -24 * (1 - easeInOut(back));
        o.rot = (o.dx / 40) * 57.3;
        o.expr = k > 0.42 && k < 0.56 ? 'happy' : 'wide';
      },
    },
    wave: {
      label: 'Wave hello', dur: 2.4,
      run(k, f, o, fx) {
        o.rot = S(k * PI * 4) * 5 * S(k * PI);
        o.expr = 'happy';
        if (k > 0.08) fx.once('hi', () => fx.word('hi!', 30, -46, { size: 11, bold: true }));
      },
    },
    sing: {
      label: 'Sing a little', dur: 5,
      run(k, f, o, fx) {
        const env = Math.min(seg(k, 0, 0.1), 1 - seg(k, 0.9, 1));
        o.rot = S(f.t * 5) * 8 * env;
        o.dy = -Math.abs(S(f.t * 5)) * 3 * env;
        o.expr = 'happy';
        if (k < 0.88) fx.every('note', 0.55, () => fx.word(BB.pick(['♪', '♫', '♬']), BB.rand(10, 30), -38, { size: BB.rand(11, 15), rise: 34 }));
      },
    },
    hiccup: {
      label: 'Hiccups', dur: 3.4,
      run(k, f, o, fx) {
        o.expr = 'wide';
        for (const [h, id] of [[0.1, 'a'], [0.42, 'b'], [0.76, 'c']]) {
          const p = seg(k, h, h + 0.08);
          if (p > 0 && p < 1) { o.dy = -11 * S(p * PI); o.sy = 1 + 0.08 * S(p * PI); o.expr = 'squint'; fx.once(id, () => fx.word('hic', BB.rand(-30, 30), -46, { size: 9 })); }
        }
      },
    },
  };
  BB.ANTIC_NAMES = Object.keys(BB.antics);
})();
