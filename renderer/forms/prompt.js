// Form: Prompt — the claude.ai message box, with a blinking cursor and a send button.
BB.forms.prompt = {
  label: 'Prompt', voice: 'key', hat: { x: -14, y: -23 }, radius: BB.rectR(46, 23),
  build(root) {
    const g = BB.el('g', { class: 'ink-dark' }, root);
    BB.el('rect', { x: -46, y: -22, width: 92, height: 46, rx: 12, class: 'p-box' }, g);
    const lines = [0, 1].map((i) => BB.el('rect', { x: -36, y: -14 + i * 7.5, width: 0, height: 3, rx: 1.5, class: 'p-text' }, g));
    const cursor = BB.el('rect', { x: -36, y: -16, width: 2.2, height: 7, rx: 1, class: 'c-main' }, g);
    const send = BB.el('g', {}, g);
    BB.el('circle', { r: 8.5, class: 'c-main' }, send);
    const arrow = BB.el('path', { d: 'M0,3.8 L0,-3.6 M-3.3,-0.5 L0,-3.8 L3.3,-0.5', class: 'p-arrow' }, send);
    const check = BB.el('path', { d: 'M-3.8,0.2 L-1.1,3 L4,-2.8', class: 'p-arrow' }, send);
    const faceG = BB.el('g', { transform: 'translate(-10,9)' }, g);
    const face = BB.makeFace(faceG, { spacing: 5.4, y: 0, scale: 0.95 });
    const W = [54, 36];

    return {
      update(f) {
        const c = f.cur;
        let p0 = 0, p1 = 0, blink = Math.floor(f.t * 1.7) % 2;
        if (f.state === 'working') {
          const p = (f.t * 0.75) % 1.35;
          p0 = BB.clamp(p * 2.2, 0, 1); p1 = BB.clamp(p * 2.2 - 1, 0, 1);
          blink = 1;
        } else if (f.state === 'waiting') { p0 = 1; p1 = 0.5; blink = Math.floor(f.t * 4) % 2; }
        else if (f.state === 'done') { p0 = 1; p1 = 1; }
        lines[0].setAttribute('width', BB.fx2(W[0] * p0));
        lines[1].setAttribute('width', BB.fx2(W[1] * p1));
        const onLine = p0 >= 1 && p1 > 0 ? 1 : 0;
        cursor.setAttribute('x', BB.fx2(-36 + (onLine ? W[1] * p1 : W[0] * p0) + (p0 > 0 ? 2 : 0)));
        cursor.setAttribute('y', -16 + onLine * 7.5);
        cursor.style.opacity = c.sleep > 0.5 || f.state === 'done' ? 0 : blink;
        const pulse = f.state === 'waiting' ? 1 + 0.16 * Math.sin(f.t * 8) : 1 + 0.5 * (f.doneK >= 0 ? Math.sin(f.doneK * Math.PI) : 0);
        send.setAttribute('transform', `translate(32,10) scale(${BB.fx2(pulse)})`);
        arrow.style.opacity = f.state === 'done' ? 0 : 1;
        check.style.opacity = f.state === 'done' ? 1 : 0;
        g.style.opacity = 1 - 0.18 * c.sleep;
        const tilt = Math.sin(f.t * 0.6) * 2 * c.sway + (f.doneK >= 0 ? Math.sin(f.doneK * Math.PI * 2) * 8 : 0);
        g.setAttribute('transform', `rotate(${BB.fx2(tilt)}) scale(${BB.fx2(1 + c.breath * Math.sin(f.t * 1.7) + c.flare * 0.5)})`);
        face.update(f);
      },
    };
  },
};
