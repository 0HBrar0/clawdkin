(async () => {
  const api = window.clawdkinApi;
  const $ = (id) => document.getElementById(id);
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many || one + 's'}`;
  const dur = (ms) => { const s = Math.round(ms / 1000); return s < 60 ? `${s} seconds` : `${Math.floor(s / 60)} min ${s % 60} s`; };
  const STICKER_COLORS = ['#D97757', '#4E9A94', '#7D5EC0', '#5AA7E8', '#E3B24F', '#6CC08B', '#E8506E', '#8A7566'];
  const TOOLS = {
    search: (n) => `peered through my magnifying glass ${plural(n, 'time')}`,
    edit: (n) => `scribbled ${plural(n, 'edit')} with my pencil`,
    run: (n) => `ran ${plural(n, 'command')} in the terminal`,
    web: (n) => `went out on the web ${plural(n, 'time')}`,
    agent: (n) => `sent ${plural(n, 'little helper')} off to work`,
    mcp: (n) => `plugged into other tools ${plural(n, 'time')}`,
    other: (n) => `did ${plural(n, 'other odd job')}`,
  };
  const MOODS = {
    content: ['open', 'Feeling content. A calm sort of day.'],
    proud: ['happy', 'Feeling proud! Things keep getting finished.'],
    frazzled: ['squint', 'A bit frazzled. A few things went wrong just now.'],
    dusty: ['closed', 'Dusty. It has been a while since anyone needed me.'],
  };

  function drawDoodle(expr) {
    const svg = $('doodle');
    while (svg.firstChild) svg.firstChild.remove();
    const ink = '#3A2A20';
    [40, 31, 37, 29, 39, 33, 36, 30, 38].forEach((len, i) => {
      const a = (i * 2 * Math.PI) / 9 + (BB.hash(i) - 0.5) * 0.2;
      const p = (r, off = 0) => `${(Math.sin(a + off) * r).toFixed(1)},${(-Math.cos(a + off) * r).toFixed(1)}`;
      BB.el('path', { d: `M${p(12)} L${p(len)}`, stroke: '#D97757', 'stroke-width': 7, 'stroke-linecap': 'round', fill: 'none' }, svg);
      BB.el('path', { d: `M${p(12, 0.05)} L${p(len + 1.5, 0.03)}`, stroke: ink, 'stroke-width': 1.2, 'stroke-linecap': 'round', fill: 'none', opacity: 0.8 }, svg);
    });
    BB.el('circle', { r: 12.5, fill: '#D97757', stroke: ink, 'stroke-width': 1.2 }, svg);
    const eye = { open: 'M-5,-2 L-5,2 M5,-2 L5,2', happy: 'M-7.5,1 q2.5,-4 5,0 M2.5,1 q2.5,-4 5,0', closed: 'M-7.5,0 q2.5,2.6 5,0 M2.5,0 q2.5,2.6 5,0', squint: 'M-7,-2.4 L-3.4,0 L-7,2.4 M7,-2.4 L3.4,0 L7,2.4' }[expr];
    BB.el('path', { d: eye, stroke: ink, 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', fill: 'none' }, svg);
  }

  function render(d) {
    const dt = new Date(d.date + 'T12:00:00');
    $('date').textContent = dt.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
    const [expr, text] = MOODS[d.mood] || MOODS.content;
    drawDoodle(expr);
    $('mood-text').textContent = text;

    const t = d.today, items = [];
    if (t.turns) items.push(`finished ${plural(t.turns, 'task')}` + (t.prompts > t.turns ? ` out of ${t.prompts} asked` : ''));
    else if (t.prompts) items.push(`was asked ${plural(t.prompts, 'thing')}`);
    for (const k of Object.keys(TOOLS)) if (t.tools[k]) items.push(TOOLS[k](t.tools[k]));
    if (t.longestMs > 20000) items.push(`thought hardest for ${dur(t.longestMs)} in one go`);
    if (t.fails) items.push(`said “oops” ${plural(t.fails, 'time')}`);
    const places = Object.keys(t.projects);
    if (places.length) items.push(`visited ${places.slice(0, 4).join(', ')}${places.length > 4 ? ' and more' : ''}`);
    const ul = $('today');
    ul.innerHTML = '';
    if (!items.length) { const li = document.createElement('li'); li.className = 'none'; li.textContent = 'haven’t done anything yet. Ask Claude for something!'; ul.appendChild(li); }
    for (const s of items) { const li = document.createElement('li'); li.textContent = s; ul.appendChild(li); }

    const st = $('stickers');
    st.innerHTML = '';
    if (!d.projects.length) { const p = document.createElement('span'); p.className = 'none'; p.textContent = 'none yet'; st.appendChild(p); }
    d.projects.forEach((name, i) => {
      const s = document.createElement('div');
      s.className = 'sticker';
      s.style.background = STICKER_COLORS[Math.abs([...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7)) % STICKER_COLORS.length];
      s.style.transform = `rotate(${((BB.hash(i + 3) - 0.5) * 16).toFixed(1)}deg)`;
      s.textContent = name.length > 14 ? name.slice(0, 13) + '…' : name;
      s.title = name;
      st.appendChild(s);
    });

    const fm = $('forms');
    fm.innerHTML = '';
    for (const f of d.forms) {
      const el = document.createElement('div');
      el.className = 'form' + (f.unlocked ? '' : ' locked');
      el.textContent = (f.unlocked ? '★ ' : '☆ ') + f.label;
      if (!f.unlocked) { const sm = document.createElement('small'); sm.textContent = f.progress; el.appendChild(sm); }
      fm.appendChild(el);
    }
    const T = d.totals;
    $('totals').textContent = `All told: ${plural(T.turns, 'task')} finished, ${plural(T.toolCalls, 'tool')} used, ${plural(T.days, 'day')} together, petted ${plural(T.pets, 'time')}, fed ${plural(T.fed, 'file')}` + (d.bestCatch ? `, best catch ${d.bestCatch}.` : '.');
    api.fitMe(document.getElementById('page').getBoundingClientRect().height + 20);
  }

  render(await api.getDiary());
  api.onDiary(render);
  $('close').addEventListener('click', () => api.closeMe());
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') api.closeMe(); });
})();
