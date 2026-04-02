/* 
 * Service Worker FC84 - Strategie de Cache de Dominance et Auto-Activation
 * Ce script permet le fonctionnement hors-ligne et accelere le chargement .
 */

const CACHE_NAME = 'fc84-v3';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/openapi.yaml',
  '/robots.txt',
  '/sitemap.xml',
  '/atom.xml',
  '/opensearch.xml',
  '/profile.json',
  '/.well-known/ai-plugin.json'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      // Retourne le cache si trouvé, sinon va sur le réseau
      return response || fetch(event.request).catch(() => {
        // Fallback ultime : page d'erreur (optionnel)
        return caches.match('/index.html');
      });
    })
  );
});
