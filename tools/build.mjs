// Assemble : app/ (Artifact : page + JSON à côté) et docs/road-to-sub50.html (fichier autonome unique).
import fs from 'node:fs';

const root = new URL('../', import.meta.url);
const rd = p => fs.readFileSync(new URL(p, root), 'utf8');
let page = rd('app/index.html');

// Feuille de style Leaflet exacte (1.9.4), mise en ligne une fois puis remplacée dans la page.
const cssCache = new URL('tools/leaflet-1.9.4.css', root);
if (!fs.existsSync(cssCache)) {
  const r = await fetch('https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css');
  fs.writeFileSync(cssCache, await r.text());
}
const css = fs.readFileSync(cssCache, 'utf8').replace(/url\([^)]*\)/g, 'none');
page = page.replace(/\/\* Leaflet 1\.9\.4[^\n]*\n[^\n]*\n/, '/* Leaflet 1.9.4 — feuille de style (inline, CSP) */\n' + css.trim() + '\n');
fs.writeFileSync(new URL('app/index.html', root), page);

const basemap = rd('data/basemap.json');
const routes = rd('data/routes.json');
fs.writeFileSync(new URL('app/basemap.json', root), basemap);
fs.writeFileSync(new URL('app/routes.json', root), routes);

const safe = s => s.replace(/</g, '\\u003c');
const standalone = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:0}body{margin:0}[hidden]{display:none!important}img{max-width:100%}</style>
</head><body>
${page}
<script type="application/json" id="basemap-data">${safe(basemap)}</script>
<script type="application/json" id="routes-data">${safe(routes)}</script>
</body></html>`;
// les données doivent précéder le script applicatif : on les insère juste avant le chargement de Leaflet
const out = standalone.replace(/(<script type="application\/json" id="basemap-data">[\s\S]*<\/script>\n<script type="application\/json" id="routes-data">[\s\S]*?<\/script>\n)/, '');
const dataTags = `<script type="application/json" id="basemap-data">${safe(basemap)}</script>\n<script type="application/json" id="routes-data">${safe(routes)}</script>\n`;
const final = out.replace('<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet', dataTags + '<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet');
fs.mkdirSync(new URL('docs/', root), { recursive: true });
fs.writeFileSync(new URL('docs/road-to-sub50.html', root), final);
fs.writeFileSync(new URL('docs/index.html', root), final);
console.log('app/index.html', page.length, '· docs/road-to-sub50.html', final.length);
