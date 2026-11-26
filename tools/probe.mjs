import fs from 'node:fs';
const raw = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const name = process.argv[3]; const R = +process.argv[4] || 40;
const pond = raw.elements.find(e => e.tags?.name === name && e.geometry);
const P = pond.geometry.map(p => [p.lat, p.lon]);
const d = (a, b) => Math.hypot((a[0] - b[0]) * 111320, (a[1] - b[1]) * 111320 * 0.661);
const c = P.reduce((s, p) => [s[0] + p[0] / P.length, s[1] + p[1] / P.length], [0, 0]);
console.log('centre', c.map(v => v.toFixed(5)).join(','));
for (const e of raw.elements) {
  const h = e.tags?.highway; if (!h || !e.geometry) continue;
  const pts = e.geometry.map(p => [p.lat, p.lon]);
  const near = pts.filter(p => P.some(q => d(p, q) < R));
  if (near.length < 2) continue;
  const m = near[Math.floor(near.length / 2)];
  const side = (m[0] > c[0] ? 'N' : 'S') + (m[1] > c[1] ? 'E' : 'W');
  console.log(h.padEnd(12), side, (e.tags.name || '-').padEnd(30), 'mid', m.map(v => v.toFixed(5)).join(','), 'n', near.length);
}
