import fs from 'node:fs';
const R = JSON.parse(fs.readFileSync(new URL('../data/routes.json', import.meta.url)));
for (const id of process.argv.slice(2)) {
  const c = R[id].coords; const seen = new Map(); const out = [];
  for (let i = 1; i < c.length; i++) { const a = c[i-1].map(v => v.toFixed(4)).join(), b = c[i].map(v => v.toFixed(4)).join(); if (a === b) continue; const k = a < b ? a+'|'+b : b+'|'+a; if (seen.has(k)) out.push(c[i].join(',')); else seen.set(k, 1); }
  console.log(id, out.length ? out.filter((_, i) => i % 3 === 0).join('  ') : 'aucun');
}
