(async () => {
  const api = window.clawdkinApi;
  const $ = (id) => document.getElementById(id);
  const ask = await api.getAsk();
  const rays = document.querySelector('.mark-rays');
  [40, 30, 37, 28, 39, 32, 38, 29, 36, 33, 30].forEach((len, i) => BB.el('line', { x1: 0, y1: -6, x2: 0, y2: -len, transform: `rotate(${(i * 360) / 11})` }, rays));

  const add = (parent, tag, text, cls) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; parent.appendChild(e); return e; };
  const button = (label, cls, fn) => { const b = add($('actions'), 'button', label, 'btn' + (cls ? ' ' + cls : '')); b.addEventListener('click', fn); return b; };
  const answer = (a) => api.answer({ ...a, reqId: ask.reqId }); // tied to the request shown here
  const openClaude = () => { answer({ pass: true }); api.openClaude(); };

  if (!ask) { api.closeMe(); return; }
  $('who').textContent = ask.project ? `from ${ask.project}` : '';
  const canAnswer = ask.live && ask.quickReply;

  if (ask.kind === 'permission') {
    $('title').textContent = 'Claude wants to use a tool';
    add($('body'), 'h2', `Allow ${ask.tool || 'this tool'}?`);
    if (ask.summary) add($('body'), 'pre', ask.summary);
    if (canAnswer) {
      // Allow only what is shown in full; file edits need Claude's own prompt to see the diff
      if (ask.full) button('Allow once', 'primary', () => answer({ behavior: 'allow' }));
      button('Deny', '', () => answer({ behavior: 'deny' }));
    }
    button('Open Claude', canAnswer && ask.full ? '' : 'primary', openClaude);
    if (canAnswer && !ask.full) $('note').textContent = 'Open Claude to see the full change before allowing it.';
  } else {
    $('title').textContent = 'Claude has a question';
    const picks = {};
    let send = null;
    const refresh = () => { if (send) send.disabled = !ask.questions.every((q) => (picks[q.question] || []).length); };
    for (const q of ask.questions) {
      add($('body'), 'h2', q.question);
      const btns = [];
      for (const o of q.options) {
        const b = add($('body'), 'button', o.label, 'opt');
        if (o.description) add(b, 'small', o.description);
        b.setAttribute('aria-pressed', 'false');
        btns.push(b);
        if (!canAnswer) { b.disabled = true; continue; }
        b.addEventListener('click', () => {
          const cur = picks[q.question] || [];
          if (q.multi) picks[q.question] = cur.includes(o.label) ? cur.filter((x) => x !== o.label) : [...cur, o.label];
          else picks[q.question] = [o.label];
          q.options.forEach((oo, i) => btns[i].setAttribute('aria-pressed', String(picks[q.question].includes(oo.label))));
          refresh();
        });
      }
    }
    if (canAnswer) {
      send = button('Send answer', 'primary', () => answer({ answers: Object.fromEntries(Object.entries(picks).map(([k, v]) => [k, v.join(', ')])) }));
      send.id = 'send';
      refresh();
    }
    button('Open Claude', canAnswer ? '' : 'primary', openClaude);
  }
  if (!canAnswer) {
    $('note').textContent = ask.quickReply
      ? 'Claude is no longer waiting on Clawdkin for this one. Answer it in Claude.'
      : 'To answer from here, turn on Quick reply in Clawdkin’s settings (Advanced).';
  }

  $('close').addEventListener('click', () => api.closeMe());
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') api.closeMe(); });
  api.fitMe($('card').getBoundingClientRect().height + 12);
})();
