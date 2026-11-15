// Reactions: tricks that happen because of something (a failed test, a copied snippet, a file to eat…).
// `hidden` keeps them out of the random idle rotation.
(() => {
  const { seg, easeOut, easeInOut, easeOutBack } = BB;
  const S = Math.sin, PI = Math.PI;
  Object.assign(BB.antics, {
    flop: { // tests failed: keel over, lie there, get back up
      label: 'Flop over', dur: 3, hidden: true,
      run(k, f, o, fx) {
        const down = seg(k, 0, 0.14), up = seg(k, 0.68, 0.86);
        const lay = k < 0.68 ? easeOut(down) : 1 - easeInOut(up);
        o.rot = 90 * lay; o.dy = 14 * lay; o.dx = 8 * lay;
        o.expr = k < 0.14 ? 'wide' : k < 0.68 ? 'dizzy' : 'squint';
        if (k > 0.14) fx.once('oof', () => { fx.word('oof', 22, -30, { size: 10 }); BB.sfx.play('fail'); });
        if (k > 0.86) { o.sy = 1 - 0.08 * S(seg(k, 0.86, 1) * PI); o.expr = 'open'; }
      },
    },
    lean: { // you copied something: lean in for a look
      label: 'Lean in', dur: 1.9, hidden: true,
      run(k, f, o, fx) {
        const e = S(Math.min(1, k * 1.25) * PI);
        const dir = f.cursorDx < 0 ? -1 : 1;
        o.rot = 15 * e * dir; o.dx = 6 * e * dir; o.expr = 'wide';
        o.look = { x: 2.6 * dir, y: 0.6 };
        if (k > 0.18) fx.once('q', () => fx.word('ooh?', 26 * dir, -44, { size: 10 }));
      },
    },
    eat: { // a file was dropped on it
      label: 'Eat', dur: 2.6, hidden: true,
      run(k, f, o, fx) {
        if (k < 0.62) {
          const c = S(k / 0.62 * PI * 4);
          o.sy = 1 - 0.13 * Math.abs(c); o.sx = 1 + 0.1 * Math.abs(c); o.expr = c > 0 ? 'squint' : 'closed';
          fx.every('nom', 0.42, () => { fx.word('nom', BB.rand(-26, 26), -42, { size: 9 }); BB.sfx.play('eat'); });
        } else {
          const b = seg(k, 0.62, 1);
          o.sy = 1 + 0.1 * S(b * PI); o.dy = -6 * S(b * PI); o.expr = 'happy';
          if (b > 0.3) fx.once('burp', () => fx.word('*burp*', 24, -44, { size: 9 }));
        }
      },
    },
    land: { // after being thrown or knocked off a window
      label: 'Dizzy landing', dur: 2.2, hidden: true,
      run(k, f, o, fx) {
        const sq = seg(k, 0, 0.14);
        if (k < 0.14) { o.sy = 1 - 0.22 * S(sq * PI); o.sx = 1 + 0.2 * S(sq * PI); fx.once('thud', () => BB.sfx.play('land')); }
        o.rot = S(f.t * 9) * 13 * (1 - k); o.dx = S(f.t * 6) * 4 * (1 - k);
        o.expr = k < 0.8 ? 'dizzy' : 'open';
      },
    },
    welcome: { // you came back (unlocked the PC)
      label: 'Welcome back', dur: 2.6, hidden: true,
      run(k, f, o, fx) {
        o.dy = -Math.abs(S(k * PI * 3)) * 9 * (1 - k); o.expr = 'happy';
        if (k > 0.05) fx.once('hi', () => { fx.word('welcome back!', 0, -50, { size: 10, bold: true, life: 2000 }); BB.sfx.play('hello'); });
      },
    },
    morning: {
      label: 'Good morning', dur: 3.2, hidden: true,
      run(k, f, o, fx) {
        BB.antics.stretch.run(k, f, o, { ...fx, once: (id, fn) => fx.once(id, id === 'yawn' ? () => fx.word('morning!', 22, -48, { size: 10 }) : fn) });
      },
    },
    dustoff: { // first activity after days away
      label: 'Shake off the dust', dur: 1.8, hidden: true,
      run(k, f, o, fx) {
        const env = S(k * PI);
        o.dx = S(f.t * 46) * 4 * env; o.rot = S(f.t * 46 + 0.6) * 13 * env; o.expr = 'squint';
        fx.every('puff', 0.25, () => fx.sparkles(BB.rand(-20, 20), BB.rand(-20, 10), 2, { dist: 30, r0: 4, size: 0.5 }));
      },
    },
  });
  BB.ANTIC_NAMES = Object.keys(BB.antics).filter((n) => !BB.antics[n].hidden);
})();
