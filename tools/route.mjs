// Calcule les boucles via Valhalla (FOSSGIS, OSM) en mode piéton.
// Usage : node tools/route.mjs <id>   (ou sans argument pour tout recalculer)
import fs from 'node:fs';

const VALHALLA = 'https://valhalla1.openstreetmap.de';
const UA = { 'User-Agent': 'running-route-planner/1.0', 'Content-Type': 'application/json' };
const defs = JSON.parse(fs.readFileSync(new URL('./routes.def.json', import.meta.url)));

function decode(str, precision = 6) {
  let i = 0, lat = 0, lng = 0, out = [];
  const f = Math.pow(10, precision);
  while (i < str.length) {
    for (const k of [0, 1]) {
      let b, shift = 0, res = 0;
      do { b = str.charCodeAt(i++) - 63; res |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
      const d = (res & 1) ? ~(res >> 1) : (res >> 1);
      if (k === 0) lat += d; else lng += d;
    }
    out.push([lat / f, lng / f]);
  }
  return out;
}

async function post(path, body) {
  const r = await fetch(VALHALLA + path, { method: 'POST', headers: UA, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(path + ' ' + r.status + ' ' + await r.text());
  return r.json();
}

const costing_options = { pedestrian: { walkway_factor: 0.6, sidewalk_factor: 0.9, use_living_streets: 0.6, use_tracks: 0.8, use_hills: 0.5, alley_factor: 2, driveway_factor: 5, service_factor: 1.5 } };

async function routeOne(def) {
  // Valhalla limite à 10 points par requête : découpage en tronçons qui se chevauchent d'un point
  let coords = [], km = 0;
  for (let s = 0; s < def.points.length - 1; s += 9) {
    const chunk = def.points.slice(s, s + 10);
    const locations = chunk.map((p, i) => ({ lat: p[0], lon: p[1], type: (i === 0 || i === chunk.length - 1) ? 'break' : 'through' }));
    const res = await post('/route', { locations, exclude_locations: (def.exclude || []).map(([lat, lon]) => ({ lat, lon })), costing: 'pedestrian', costing_options, language: 'fr-FR', units: 'kilometers', directions_type: 'none' });
    km += res.trip.summary.length;
    for (const l of res.trip.legs) { const c = decode(l.shape); coords = coords.concat(coords.length ? c.slice(1) : c); }
  }
  const res = { trip: { summary: { length: km } } };
  coords = coords.map(([a, b]) => [+a.toFixed(6), +b.toFixed(6)]);
  // Altitudes (DEM via Valhalla /height)
  let gain = null, elev = null, prof = null;
  try {
    const step = Math.max(1, Math.floor(coords.length / 400));
    const sample = coords.filter((_, i) => i % step === 0 || i === coords.length - 1);
    const h = await post('/height', { range: false, shape: sample.map(([lat, lon]) => ({ lat, lon })) });
    elev = h.height;
    gain = 0; let ref = elev[0];
    for (const z of elev) { if (z == null) continue; if (z - ref > 3) { gain += z - ref; ref = z; } else if (z < ref) ref = z; }
    gain = Math.round(gain);
    // profil : distance cumulée (km) / altitude
    let d = 0; prof = [[0, elev[0]]];
    for (let i = 1; i < sample.length; i++) { const [a, b] = sample[i - 1], [c, e2] = sample[i]; const kx = Math.cos(a * Math.PI / 180); d += Math.hypot((c - a) * 111.32, (e2 - b) * 111.32 * kx); prof.push([+d.toFixed(3), elev[i]]); }
    const st = Math.max(1, Math.floor(prof.length / 120)); prof = prof.filter((_, i) => i % st === 0 || i === prof.length - 1);
  } catch (e) { console.warn('height failed', e.message); }
  // Nature du terrain : attributs des tronçons OSM (Valhalla trace_attributes)
  let terrain = null, streets = [];
  try {
    const ta = await post('/trace_attributes', { shape: coords.map(([lat, lon]) => ({ lat, lon })), costing: 'pedestrian', shape_match: 'map_snap', filters: { attributes: ['edge.use', 'edge.surface', 'edge.length', 'edge.names', 'edge.road_class', 'edge.sidewalk_left', 'edge.sidewalk_right'], action: 'include' } });
    const acc = {}; const names = [];
    for (const e of ta.edges) {
      const u = e.use || 'road';
      let k = /footway|path|pedestrian|steps|cycleway|bridleway|living_street|track|pedestrian_crossing|sidewalk/.test(u) ? (u === 'track' ? 'track' : 'path') : 'road';
      acc[k] = (acc[k] || 0) + (e.length || 0);
      if (e.surface) acc['s_' + e.surface] = (acc['s_' + e.surface] || 0) + (e.length || 0);
      if (e.names) for (const n of e.names) { const last = names[names.length - 1]; if (!last || last[0] !== n) names.push([n, e.length]); else last[1] += e.length; }
    }
    terrain = acc;
    const tot = {}; for (const [n, l] of names) tot[n] = (tot[n] || 0) + l;
    streets = Object.entries(tot).sort((a, b) => b[1] - a[1]).map(([n, l]) => [n, +l.toFixed(2)]);
  } catch (e) { console.warn('trace failed', e.message); }
  // Part du tracé parcourue deux fois (aller-retour)
  const seen = new Map(); let dup = 0;
  for (let i = 1; i < coords.length; i++) {
    const a = coords[i - 1].map(v => v.toFixed(4)).join(), b = coords[i].map(v => v.toFixed(4)).join(); if (a === b) continue;
    const k = a < b ? a + '|' + b : b + '|' + a; const L = Math.hypot((coords[i][0] - coords[i - 1][0]) * 111.32, (coords[i][1] - coords[i - 1][1]) * 73.6);
    if (seen.has(k)) dup += L; else seen.set(k, 1);
  }
  const overlap = +dup.toFixed(2);
  return { overlap, prof, terrain, streets, id: def.id, km: +res.trip.summary.length.toFixed(3), gain, elevMin: elev ? Math.round(Math.min(...elev.filter(x => x != null))) : null, elevMax: elev ? Math.round(Math.max(...elev.filter(x => x != null))) : null, points: def.points, exclude: def.exclude || [], coords };
}

const only = process.argv[2];
const outPath = new URL('../data/routes.json', import.meta.url);
let out = {};
try { out = JSON.parse(fs.readFileSync(outPath)); } catch {}
for (const def of defs) {
  if (only && def.id !== only) continue;
  const r = await routeOne(def);
  out[def.id] = r;
  console.log(def.id, r.km, 'km', 'D+', r.gain, 'aller-retour', r.overlap, 'km', 'chemins', r.terrain && ((r.terrain.path||0)+(r.terrain.track||0)).toFixed(2));
  await new Promise(r => setTimeout(r, 1200));
}
fs.mkdirSync(new URL('../data/', import.meta.url), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(out));
