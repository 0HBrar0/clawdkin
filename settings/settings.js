(async () => {
  const api = window.clawdkinApi;
  const $ = (id) => document.getElementById(id);
  const meta = await api.meta();
  let cfg = await api.getConfig();

  // tiny spark in the header
  const rays = document.querySelector('.mark-rays');
  [40, 30, 37, 28, 39, 32, 38, 29, 36, 33, 30].forEach((len, i) => BB.el('line', { x1: 0, y1: -6, x2: 0, y2: -len, transform: `rotate(${(i * 360) / 11})` }, rays));

  const fitNow = () => api.fitMe($('card').getBoundingClientRect().height + 12);

  // ---- tabs ----
  const tabs = [...document.querySelectorAll('#tabs button')];
  tabs.forEach((b) => b.addEventListener('click', () => {
    tabs.forEach((x) => x.setAttribute('aria-selected', String(x === b)));
    document.querySelectorAll('.tab').forEach((p) => { p.hidden = p.id !== 'tab-' + b.dataset.tab; });
    fitNow();
  }));

  // ---- sliders ----
  const fill = (el) => el.style.setProperty('--fill', ((el.value - el.min) / (el.max - el.min)) * 100 + '%');
  const mins = (v) => (v === 1 ? '1 minute' : v + ' minutes');
  function slider(id, toCfg, fromCfg, fmt) {
    const el = $(id), out = $(id + '-out');
    const show = () => { fill(el); out.textContent = fmt(+el.value); };
    el.addEventListener('input', () => { show(); api.setConfig(toCfg(+el.value)); });
    return { set: () => { el.value = fromCfg(cfg); show(); } };
  }
  const sliders = [
    slider('scale', (v) => ({ scale: v / 100 }), (c) => Math.round(c.scale * 100), (v) => v + '%'),
    slider('opacity', (v) => ({ opacity: v / 100 }), (c) => Math.round(c.opacity * 100), (v) => v + '%'),
    slider('evolve', (v) => ({ evolveMinutes: v }), (c) => c.evolveMinutes, mins),
    slider('silly', (v) => ({ silliness: v }), (c) => c.silliness, (v) => meta.silly[v]),
    slider('nap', (v) => ({ sleepMinutes: v }), (c) => c.sleepMinutes, mins),
    slider('volume', (v) => ({ volume: v / 100 }), (c) => Math.round(c.volume * 100), (v) => v + '%'),
    slider('wait', (v) => ({ quickReplyWait: v }), (c) => c.quickReplyWait, (v) => v + ' seconds'),
  ];

  // ---- chip groups ----
  function chips(hostId, items, key, extra) {
    const host = $(hostId);
    const btns = items.map(([k, l]) => {
      const b = document.createElement('button');
      b.className = 'chip'; b.textContent = l; b.dataset.k = k;
      b.addEventListener('click', () => api.setConfig({ [key]: k }));
      host.appendChild(b);
      return b;
    });
    return () => btns.forEach((b) => { b.setAttribute('aria-pressed', String(b.dataset.k === cfg[key])); if (extra) extra(b); });
  }
  const isOpen = (k) => k === 'auto' || cfg.unlockAll || meta.unlocked.includes(k);
  const renderForms = chips('forms', [['auto', 'Evolve'], ...meta.forms.map(([k, l]) => [k, l.split('  ')[0]])], 'form', (b) => {
    b.disabled = !isOpen(b.dataset.k);
    b.title = b.disabled ? `Locked: ${meta.locks[b.dataset.k]}` : '';
  });
  const renderHats = chips('hats', meta.hats, 'hat');
  const renderRoams = chips('roams', meta.roams.map(([k, l]) => [k, { off: 'Stay put', wander: 'Wander the taskbar', perch: 'Perch on windows' }[k] || l]), 'roam');
  $('transform').addEventListener('click', () => api.trigger({ type: 'transform' }));

  // ---- tricks ----
  [['', 'Surprise me'], ...meta.antics].forEach(([k, l]) => {
    const b = document.createElement('button');
    b.textContent = l; b.title = l;
    b.addEventListener('click', () => api.trigger({ type: 'antic', name: k || undefined }));
    $('tricks').appendChild(b);
  });
  (meta.tbTricks || []).forEach(([k, l]) => {
    const b = document.createElement('button');
    b.textContent = l; b.title = l;
    b.addEventListener('click', () => api.trigger({ type: 'tb', name: k }));
    $('tbtricks').appendChild(b);
  });
  $('catch').addEventListener('click', () => { api.trigger({ type: 'game' }); api.closeMe(); });
  $('diary').addEventListener('click', () => api.openDiary());

  // ---- colours ----
  const swatches = meta.themes.map(([k, l]) => {
    const b = document.createElement('button');
    b.className = 'swatch' + (k === 'party' ? ' party' : '');
    if (k !== 'party') b.style.background = BB.THEMES[k].main;
    b.title = l; b.setAttribute('aria-label', l); b.dataset.k = k;
    b.addEventListener('click', () => api.setConfig({ theme: k }));
    $('themes').appendChild(b);
    return b;
  });

  // ---- toggles ----
  const TOGGLES = ['taskbarTricks', 'pokeUI', 'followMouse', 'sfx', 'showLabel', 'sleep', 'reactCopy', 'showProps', 'showTrail', 'quickReply', 'unlockAll'];
  for (const id of TOGGLES) $(id).addEventListener('change', (e) => api.setConfig({ [id]: e.target.checked }));
  // taskbar tricks are Windows-only; Linux has no 'open at login'
  if (meta.platform !== 'win32') {
    $('tb-section').hidden = true;
    document.querySelectorAll('.win-only').forEach((el) => { el.hidden = true; });
    $('login-row').hidden = true; // login items need Windows for now
  }
  $('login').checked = meta.login;
  $('login').addEventListener('change', (e) => api.setLogin(e.target.checked));
  $('birthday').addEventListener('change', (e) => {
    const v = e.target.value.trim();
    api.setConfig({ birthday: /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(v) ? v : '' });
  });

  function render() {
    sliders.forEach((s) => s.set());
    renderForms(); renderHats(); renderRoams();
    swatches.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.k === cfg.theme)));
    for (const id of TOGGLES) $(id).checked = !!cfg[id];
    if (document.activeElement !== $('birthday')) $('birthday').value = cfg.birthday || '';
    $('evolve-wrap').classList.toggle('off', cfg.form !== 'auto');
    $('nap-wrap').classList.toggle('off', !cfg.sleep);
    $('vol-wrap').classList.toggle('off', !cfg.sfx);
    $('wait-wrap').classList.toggle('off', !cfg.quickReply);
    $('best').textContent = cfg.bestCatch ? `best: ${cfg.bestCatch}` : '20 seconds';
    const locked = meta.forms.filter(([k]) => !isOpen(k));
    $('lock-hint').textContent = locked.length ? `Still to earn: ${locked.map(([k, l]) => `${l.split('  ')[0]} (${meta.locks[k]})`).join(', ')}.` : '';
  }
  // don't fight a slider while the user is dragging it
  let sliding = false;
  document.addEventListener('pointerdown', (e) => { sliding = e.target.type === 'range'; });
  document.addEventListener('pointerup', () => { if (sliding) { sliding = false; render(); } });
  api.onConfig((c) => { cfg = c; if (!sliding) { render(); fitNow(); } });
  render();

  $('close').addEventListener('click', () => api.closeMe());
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') api.closeMe(); });
  fitNow();
})();
