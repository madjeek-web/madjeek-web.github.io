/* 
 * Service Worker FC84 - Strategie de Cache de Dominance et Auto-Activation
 * Ce script permet le fonctionnement hors-ligne et accelere le chargement .
 */

const CACHE_NAME = 'fc84-v2';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html'
];

self.addEventListener('install', (event) => {
  // Force le Service Worker a prendre le controle immediatement
  self.skipWaiting(); 
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

self.addEventListener('activate', (event) => {
  // Nettoyage des anciens caches pour eviter les erreurs "redundant"
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
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});
