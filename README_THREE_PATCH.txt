# Thug Life Engine - Three.js Foundation Patch

Dateien zum Ersetzen/Hinzufügen:

- `index.html` ersetzen
- `css/style.css` ersetzen
- `js/app.js` ersetzen
- `js/three-scene.js` neu hinzufügen

Hinweis:
`three-scene.js` lädt Three.js aktuell über jsDelivr:
`https://cdn.jsdelivr.net/npm/three@0.184.0/build/three.module.min.js`

Für eine komplett offline-fähige Wallpaper-Engine-Version sollte `three.module.min.js` später lokal unter `lib/three/` abgelegt und der Import angepasst werden.
