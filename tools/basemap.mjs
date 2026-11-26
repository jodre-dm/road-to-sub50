// Convertit un export Overpass (out geom) en fond de carte vectoriel compact.
// Usage : node tools/basemap.mjs <raw.json>
import fs from 'node:fs';

const raw = JSON.parse(fs.readFileSync(process.argv[2]));
const Q = 1e5; // ~1 m

function simplify(pts, tol) { // Douglas-Peucker sur [lat,lon]
  if (pts.length < 3) return pts;
  const kx = Math.cos(48.6 * Math.PI / 180);
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let max = 0, idx = -1;
    const ax = pts[a][1] * kx, ay = pts[a][0], bx = pts[b][1] * kx, by = pts[b][0];
    const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy || 1e-18;
    for (let i = a + 1; i < b; i++) {
      const px = pts[i][1] * kx, py = pts[i][0];
      let t = ((px - ax) * dx + (py - ay) * dy) / L; t = Math.max(0, Math.min(1, t));
      const d = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
      if (d > max) { max = d; idx = i; }
    }
    if (max > tol && idx > 0) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
const M = 1 / 111320; // degrés par mètre
function enc(pts, tolM) {
  const s = simplify(pts, tolM * M);
  let pl = 0, pn = 0; const out = [];
  for (const [la, lo] of s) { const a = Math.round(la * Q), b = Math.round(lo * Q); out.push(a - pl, b - pn); pl = a; pn = b; }
  return out;
}
const g2p = g => g.map(p => [p.lat, p.lon]);

function joinRings(ways) { // assemble les membres « outer » d'un multipolygone
  const segs = ways.map(w => w.slice()); const rings = [];
  while (segs.length) {
    let ring = segs.shift();
    let guard = 0;
    while (guard++ < 5000) {
      const first = ring[0], last = ring[ring.length - 1];
      if (first[0] === last[0] && first[1] === last[1]) break;
      const k = segs.findIndex(s => (s[0][0] === last[0] && s[0][1] === last[1]) || (s[s.length - 1][0] === last[0] && s[s.length - 1][1] === last[1]));
      if (k < 0) break;
      let s = segs.splice(k, 1)[0];
      if (!(s[0][0] === last[0] && s[0][1] === last[1])) s = s.reverse();
      ring = ring.concat(s.slice(1));
    }
    rings.push(ring);
  }
  return rings;
}

const L = { water: [], wood: [], grass: [], pitch: [], resid: [], farm: [], bld: [], motorway: [], major: [], minor: [], path: [], river: [], rail: [] };
const labels = [];
const roadNames = [];

function classify(t) {
  if (t.natural === 'water' || t.water || t.landuse === 'reservoir' || t.landuse === 'basin') return 'water';
  if (t.natural === 'wood' || t.landuse === 'forest') return 'wood';
  if (t.natural === 'scrub' || t.natural === 'wetland') return 'grass';
  if (t.leisure === 'park' || t.leisure === 'garden' || t.landuse === 'grass' || t.landuse === 'meadow' || t.landuse === 'recreation_ground' || t.natural === 'grassland') return 'grass';
  if (t.leisure === 'pitch' || t.leisure === 'stadium' || t.leisure === 'sports_centre') return 'pitch';
  if (t.landuse === 'residential') return 'resid';
  if (t.landuse === 'farmland') return 'farm';
  if (t.building) return 'bld';
  const h = t.highway;
  if (h) {
    if (/^(motorway|trunk)/.test(h)) return 'motorway';
    if (/^(primary|secondary|tertiary)/.test(h)) return 'major';
    if (/^(footway|path|cycleway|pedestrian|track|steps|bridleway)$/.test(h)) return 'path';
    if (/^(residential|unclassified|living_street|service|road)$/.test(h)) return 'minor';
    return null;
  }
  if (t.waterway) return /^(river|canal|stream|ditch|drain)$/.test(t.waterway) ? 'river' : null;
  if (t.railway === 'rail') return 'rail';
  return null;
}
const TOL = { water: 1.5, wood: 3, grass: 2, pitch: 1.5, resid: 3, farm: 4, bld: 1, motorway: 1, major: 1, minor: 1, path: 1, river: 1.5, rail: 2 };

function centroid(pts) { let a = 0, b = 0; for (const p of pts) { a += p[0]; b += p[1]; } return [a / pts.length, b / pts.length]; }
function area(pts) { let s = 0; const kx = Math.cos(48.6 * Math.PI / 180); for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) s += (pts[j][1] * kx) * pts[i][0] - (pts[i][1] * kx) * pts[j][0]; return Math.abs(s / 2) * 111320 * 111320; }

for (const e of raw.elements) {
  const t = e.tags || {};
  const c = classify(t);
  if (!c) continue;
  if (e.type === 'way' && e.geometry) {
    const pts = g2p(e.geometry);
    if (c === 'path' || c === 'minor' || c === 'major' || c === 'motorway') {
      const item = enc(pts, TOL[c]);
      L[c].push(item);
      if (t.name && pts.length > 1) roadNames.push([t.name, c, ...pts[Math.floor(pts.length / 2)].map(v => +v.toFixed(5))]);
    } else L[c].push(enc(pts, TOL[c]));
    if ((c === 'water' || c === 'wood' || c === 'grass' || c === 'pitch') && t.name && pts.length > 3) {
      const ar = area(pts);
      if (ar > 3000 || c === 'pitch') labels.push([t.name, c, ...centroid(pts).map(v => +v.toFixed(5)), Math.round(ar)]);
    }
  } else if (e.type === 'relation' && e.members) {
    const outers = e.members.filter(m => m.type === 'way' && m.geometry && m.role !== 'inner').map(m => g2p(m.geometry));
    const rings = joinRings(outers);
    for (const r of rings) L[c].push(enc(r, TOL[c]));
    if (t.name && rings.length) { const big = rings.sort((a, b) => b.length - a.length)[0]; labels.push([t.name, c, ...centroid(big).map(v => +v.toFixed(5)), Math.round(area(big))]); }
  }
}
// dédoublonnage des libellés de rue (un par nom et par ~300 m)
const seen = []; const roads = [];
for (const r of roadNames) {
  if (seen.some(s => s[0] === r[0] && Math.hypot(s[2] - r[2], (s[3] - r[3]) * 0.66) < 0.003)) continue;
  seen.push(r); roads.push(r);
}
const out = { q: Q, layers: L, labels, roads, attribution: '© contributeurs OpenStreetMap (ODbL)', bbox: [48.568, 2.505, 48.618, 2.605], generated: new Date().toISOString().slice(0, 10) };
fs.writeFileSync(new URL('../data/basemap.json', import.meta.url), JSON.stringify(out));
for (const k in L) console.log(k, L[k].length);
console.log('labels', labels.length, 'roads', roads.length, 'size', fs.statSync(new URL('../data/basemap.json', import.meta.url)).size);
