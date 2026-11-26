# Road to Sub 50 – Paris 2027

Mini-application de course à pied : 4 boucles autour de l'avenue Zéphirin Camélinat (Savigny-le-Temple), calculateur d'allure, journal des sorties.

## Fichiers

| Fichier | Rôle |
|---|---|
| `docs/road-to-sub50.html` (= `docs/index.html`) | **Version autonome**, un seul fichier (carte + tracés intégrés). C'est celle à mettre sur l'iPhone. |
| `app/index.html` + `app/*.json` | Version publiée en Artifact claude.ai |
| `tools/routes.def.json` | Points de passage des boucles (modifiables) |
| `tools/route.mjs` | Recalcule les boucles via Valhalla (OSM, mode piéton) : distance, D+, nature du terrain |
| `tools/basemap.mjs` | Construit le fond de carte vectoriel à partir d'un export Overpass |
| `tools/build.mjs` | Régénère `app/` et `docs/` |

## Installer sur l'iPhone

Version en ligne : **https://jodre-dm.github.io/road-to-sub50/** (GitHub Pages, dossier `docs/` de la branche `main`).

1. Ouvre cette adresse dans Safari sur l'iPhone.
2. Partager › **Sur l'écran d'accueil** : l'app s'ouvre alors en plein écran, comme une app native.
3. Au premier appui sur le bouton de localisation, autorise l'accès à ta position.

Pour mettre à jour le site : `node tools/build.mjs`, puis commit et push de `docs/`.

Les données (journal, favoris, parcours perso, point de départ) restent dans le stockage local de Safari sur le téléphone. Pense à exporter le journal de temps en temps (onglet Journal).

## Recalculer les boucles

```
node tools/route.mjs          # toutes les boucles
node tools/route.mjs orange   # une seule
node tools/build.mjs
```

Données © contributeurs OpenStreetMap (ODbL), extrait du 25/11/2026. Itinéraires : Valhalla (serveur FOSSGIS). Altitudes : modèle numérique de terrain via Valhalla.
