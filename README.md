# MenstruAI Bénin — Frontend (React 19 · TypeScript · Vite · PWA)

```bash
cp .env.example .env     # VITE_API_BASE_URL, VITE_ENABLE_CYCLE, VITE_QUICK_EXIT_URL
npm ci
npm run dev              # développement : http://localhost:5173
npm test                 # 14 tests (Vitest)
npm run build            # vérification de types + build de production dans dist/
npm audit --omit=dev     # dépendances de production
```

- **Routes** (hash) : `#/`, `#/assistant`, `#/infos`, `#/centres`, `#/cycle`, `#/confidentialite`, `#/admin`.
- **Confidentialité** : le jeton administrateur reste en mémoire (jamais dans `localStorage`) ; le suivi du cycle est stocké uniquement sur l'appareil, avec bouton d'effacement ; aucune clé API ni outil de mesure tiers.
- **Sortie rapide** : bouton « Quitter » (ou Échap deux fois) vers `VITE_QUICK_EXIT_URL`.
- **PWA** : `public/sw.js` v2 (pages « réseau d'abord », API publique lisible hors ligne ; assistant, signalements et administration jamais en cache), manifeste et icônes issus du logo.
- **Production** : servir `dist/` en HTTPS avec repli vers `index.html` ; `sw.js` et `manifest.webmanifest` à la racine.
- **Droits** : logo, icônes et avatar à confirmer par écrit avant publication CC BY (voir `../LICENSE-CONTENT.md`).

Référence complète : [`../README-MenstruAI-Benin.md`](../README-MenstruAI-Benin.md).
