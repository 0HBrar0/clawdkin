// Extra facts about the four original forms: silhouette (for morphing), where a hat sits, and its sound voice.
Object.assign(BB.forms.spark, {
  voice: 'chime', hat: { x: 0, y: -12 },
  radius: BB.lobesR([42, 31, 38, 28.5, 41, 33, 39, 29.5, 40, 34.5, 30.5], 13, 0.17, [-3, 4, -2, 5, -4, 2, -3, 4, -1, 3, -2]),
});
Object.assign(BB.forms.glyph, {
  voice: 'chime', hat: { x: 0, y: -10 },
  radius: BB.lobesR([39, 39, 39, 39, 39, 39, 39, 39], 11, 0.3),
});
Object.assign(BB.forms.doodle, {
  voice: 'pencil', hat: { x: 0, y: -12 },
  radius: BB.lobesR([41, 32, 38, 30, 40, 33, 37, 31, 39], 12.5, 0.16),
});
Object.assign(BB.forms.clawd, {
  voice: 'pixel', hat: { x: 0, y: -10 }, cy: 14,
  radius: BB.rectR(40, 21),
});

// Order the buddy evolves through. The first four are always available; the rest are earned.
BB.FORM_ORDER = ['spark', 'glyph', 'doodle', 'clawd', 'prompt', 'origami', 'blocks', 'glass', 'moon'];
