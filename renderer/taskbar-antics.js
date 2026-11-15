// Taskbar tricks: the poses and gags. Main moves the window around the taskbar; these play on top.
// All hidden (they only make sense where main puts the buddy). `f.arg` is whatever main sent along.
(() => {
  const { seg, easeOut, easeInOut, easeOutBack } = BB;
  const S = Math.sin, PI = Math.PI;
  const dirOf = (f) => (f.arg && f.arg.dir) || 1;

  Object.assign(BB.antics, {
    'tb-hide': { // standing in front of one of your apps, acting like nothing is going on
      label: 'Hide an app', dur: 5, hidden: true,
      run(k, f, o, fx) {
        const side = S(f.t * 2.2);
        o.look = { x: 2.4 * Math.sign(side) * Math.min(1, Math.abs(side) * 3), y: -0.4 };
        o.expr = 'happy';
        o.sx = 1.06; o.sy = 1.04; // make itself as big as possible
        o.dy = -1.5 * Math.abs(S(f.t * 4));
        fx.every('whistle', 0.9, () => fx.word(BB.pick(['♪', '♫', '~♪']), BB.rand(14, 30), -46, { size: 10 }));
        if (k > 0.12) fx.once('what', () => fx.word('what app?', 0, -54, { size: 9, life: 1600 }));
        if (k > 0.55 && k < 0.8) { // peek to see if you noticed
          const p = S(seg(k, 0.55, 0.8) * PI);
          o.rot = -14 * p; o.dx = -9 * p; o.expr = 'squint'; o.look = { x: -2.6, y: 0.4 };
          fx.once('peek', () => fx.word('…', -30, -40, { size: 11 }));
        }
      },
    },
    'tb-tada': { // steps aside: there it was all along
      label: 'Ta-da', dur: 1.3, hidden: true,
      run(k, f, o, fx) {
        const b = easeOutBack(Math.min(1, k * 2.2), 2);
        o.sy = 1 + 0.12 * S(Math.min(1, k * 1.6) * PI); o.sx = 1 - 0.05 * S(Math.min(1, k * 1.6) * PI);
        o.rot = 8 * dirOf(f) * (1 - b) ; o.expr = 'happy';
        fx.once('tada', () => { fx.word('ta-da!', 0, -50, { size: 11, bold: true }); fx.sparkles(-24 * dirOf(f), -6, 9, { dist: 30, size: 0.8 }); BB.sfx.play('hello'); });
      },
    },
    'tb-hop': { // one hop (main moves the window along an arc meanwhile)
      label: 'Hop', dur: 0.45, hidden: true,
      run(k, f, o, fx) {
        const up = S(k * PI);
        o.sy = k < 0.15 ? 1 - 0.18 * S(k / 0.15 * PI) : 1 + 0.1 * up; o.sx = 2 - o.sy;
        o.expr = 'open';
        if (f.arg && f.arg.n) fx.once('n', () => fx.word(f.arg.n + '!', 0, -48, { size: 10, bold: true }));
      },
    },
    'tb-sink': { // dives into the taskbar
      label: 'Dive', dur: 0.7, hidden: true,
      run(k, f, o, fx) {
        const d = k < 0.25 ? -8 * S(k / 0.25 * PI) : (f.h + 8) * easeInOut(seg(k, 0.25, 1));
        o.dy = d; o.sy = k < 0.25 ? 1.08 : 1.12; o.sx = 2 - o.sy; o.expr = 'closed';
        if (k > 0.3) fx.once('splash', () => { fx.sparkles(0, 52, 8, { dist: 22, size: 0.7, dir: -PI / 2, spread: 1.2 }); BB.sfx.play('land'); });
      },
    },
    'tb-fin': { // only the top of its head shows, gliding along like a shark fin
      label: 'Shark', dur: 3, hidden: true,
      run(k, f, o, fx) {
        const rise = Math.min(1, k * 6) * (1 - seg(k, 0.9, 1));
        o.dy = f.h + 8 - (24 + 8) * rise + 1.5 * S(f.t * 10); // only the top ~24 units show o.rot = 9 * dirOf(f); o.expr = 'squint'; o.look = { x: 2.6 * dirOf(f), y: 0 };
        fx.every('ripple', 0.12, () => fx.sparkles(-14 * dirOf(f), 54, 1, { dist: 8, size: 0.45, dir: -PI / 2 - 0.6 * dirOf(f), spread: 0.4 }));
        if (k > 0.3) fx.once('dun', () => fx.word('dun dun…', -18 * dirOf(f), -14, { size: 9 }));
      },
    },
    'tb-pop': { // pops back up out of the taskbar
      label: 'Pop up', dur: 1, hidden: true,
      run(k, f, o, fx) {
        const u = seg(k, 0, 0.45), l = seg(k, 0.45, 1);
        o.dy = k < 0.45 ? (f.h + 8) - (f.h + 24) * easeOut(u) : -16 * (1 - easeOutBack(l, 2.6));
        o.sy = k < 0.45 ? 1.14 : 1 - 0.1 * S(l * PI); o.sx = 2 - o.sy; o.expr = 'wide';
        if (k > 0.2) fx.once('boo', () => { fx.word('boo!', 0, -52, { size: 11, bold: true }); BB.sfx.play('pop'); });
      },
    },
    'tb-push': { // tries to push the Start button
      label: 'Push Start', dur: 3.4, hidden: true,
      run(k, f, o, fx) {
        const d = dirOf(f), lean = easeOut(seg(k, 0, 0.15)) * (1 - easeInOut(seg(k, 0.8, 1)));
        const strain = k > 0.15 && k < 0.8 ? S(f.t * 38) * 1.3 : 0;
        o.rot = 16 * d * lean; o.dx = 7 * d * lean + strain; o.sx = 1 - 0.07 * lean; o.sy = 1 + 0.03 * lean;
        o.expr = k < 0.8 ? 'squint' : 'closed'; o.look = { x: 2.6 * d, y: 0.6 };
        if (k > 0.2) fx.once('hn', () => fx.word('hnnngh!', 18 * d, -44, { size: 10, bold: true }));
        fx.every('sweat', 0.5, () => { if (k > 0.2 && k < 0.8) fx.sparkles(-16 * d, -26, 1, { dist: 10, size: 0.5, dir: -PI / 2 - d * 0.8 }); });
        if (k > 0.82) fx.once('nope', () => fx.word('…nope.', -10 * d, -46, { size: 9 }));
      },
    },
    'tb-nap': { // curls up in front of the clock
      label: 'Clock nap', dur: 6, hidden: true,
      run(k, f, o, fx) {
        const lie = easeOut(seg(k, 0, 0.12)) * (1 - easeOut(seg(k, 0.9, 1)));
        const br = S(f.t * 1.4);
        o.sy = 1 - 0.14 * lie + 0.025 * br * lie; o.sx = 1 + 0.08 * lie; o.rot = -6 * lie;
        o.expr = k < 0.9 ? 'closed' : 'wide';
        if (k > 0.12) fx.once('time', () => fx.word('no time today', 0, -46, { size: 9, life: 1800 }));
        fx.every('z', 0.85, () => { if (k > 0.25 && k < 0.88) fx.word('z', BB.rand(10, 24), -32, { size: 9 }); });
        if (k > 0.9) fx.once('wake', () => { fx.word('!', 18, -44, { size: 12, bold: true }); BB.sfx.play('pop'); });
      },
    },
    'tb-guard': { // stands guard in front of Claude
      label: 'Guard Claude', dur: 3.6, hidden: true,
      run(k, f, o, fx) {
        const puff = easeOutBack(Math.min(1, k * 4), 2) * (1 - easeInOut(seg(k, 0.85, 1)));
        o.sx = 1 + 0.12 * puff; o.sy = 1 + 0.08 * puff; o.expr = 'squint'; o.look = { x: 0, y: 0.6 };
        if (k > 0.15) fx.once('mine', () => fx.word('mine.', 0, -52, { size: 11, bold: true }));
        if (k > 0.55) fx.once('g', () => fx.word('(guarding)', 0, -40, { size: 8 }));
      },
    },
    'tb-oops': { // leans on Start… it opens. !!
      label: 'Oops', dur: 3.2, hidden: true,
      run(k, f, o, fx) {
        const d = dirOf(f);
        if (k < 0.3) { const l = easeOut(k / 0.3); o.rot = 12 * d * l; o.dx = 5 * d * l; o.expr = 'squint'; o.look = { x: 2.4 * d, y: 0.5 }; }
        else {
          const j = seg(k, 0.3, 0.42);
          o.dy = -12 * S(j * PI); o.sy = 1 + 0.12 * S(j * PI); o.sx = 2 - o.sy; o.expr = 'wide';
          o.look = { x: 1.2 * d, y: -2.4 }; o.rot = -4 * d * S(f.t * 9) * (1 - seg(k, 0.5, 1));
          fx.once('bang', () => { fx.word('!!', 18 * d, -50, { size: 12, bold: true }); BB.sfx.play('pop'); });
          if (k > 0.5) fx.once('oops', () => fx.word('oops', -14 * d, -44, { size: 10, bold: true }));
        }
      },
    },
    'tb-innocent': { // nobody saw that
      label: 'Innocent', dur: 1.8, hidden: true,
      run(k, f, o, fx) {
        o.expr = 'happy'; o.look = { x: -2.4 * dirOf(f), y: -0.8 }; o.rot = -5 * dirOf(f) * S(Math.min(1, k * 2) * PI / 2);
        fx.once('w', () => fx.word('♪', 20, -44, { size: 11 }));
        if (k > 0.25) fx.once('saw', () => fx.word('nobody saw that', 0, -54, { size: 9, life: 1700 }));
      },
    },
    'tb-tug': { // grabs the little arrow and pulls
      label: 'Tug', dur: 1.3, hidden: true,
      run(k, f, o, fx) {
        const st = S(Math.min(1, k * 1.4) * PI);
        o.sy = 1 + 0.16 * st; o.sx = 1 - 0.1 * st; o.dy = -3 * st + S(f.t * 40) * 0.8 * st; o.expr = 'squint'; o.look = { x: 0, y: -2.4 };
        fx.once('hup', () => fx.word('hup!', 16, -52, { size: 10, bold: true }));
      },
    },
    'tb-peek': { // looks into the hidden icons
      label: 'Peek', dur: 2.3, hidden: true,
      run(k, f, o, fx) {
        o.expr = 'wide'; o.look = { x: 1.4 * S(f.t * 2.5), y: -2.6 }; o.sy = 1.04; o.dy = -1.5;
        if (k > 0.1) fx.once('ooh', () => fx.word('ooh… secrets', 0, -54, { size: 9, life: 1800 }));
        fx.every('sp', 0.6, () => fx.sparkles(BB.rand(-10, 10), -40, 1, { dist: 12, size: 0.5, dir: -PI / 2 }));
      },
    },
    'tb-shh': { // tucks them away again
      label: 'Tuck away', dur: 1.5, hidden: true,
      run(k, f, o, fx) {
        const p = S(Math.min(1, k * 2.5) * PI);
        o.sy = 1 - 0.1 * p; o.sx = 1 + 0.06 * p; o.expr = k < 0.4 ? 'closed' : 'happy';
        fx.once('back', () => fx.word('back you go', 0, -50, { size: 9 }));
      },
    },
    'tb-eep': { // you came near: startled
      label: 'Eep', dur: 0.8, hidden: true,
      run(k, f, o, fx) {
        o.dy = -14 * S(Math.min(1, k * 1.8) * PI); o.sy = 1 + 0.12 * S(Math.min(1, k * 1.8) * PI); o.sx = 2 - o.sy; o.expr = 'wide';
        fx.once('eep', () => { fx.word('eep!', 0, -52, { size: 11, bold: true }); BB.sfx.play('fail'); });
      },
    },
  });
  BB.ANTIC_NAMES = Object.keys(BB.antics).filter((n) => !BB.antics[n].hidden);
})();
