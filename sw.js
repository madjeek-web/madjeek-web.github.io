/* 
 * Service Worker FC84 - Strategie de Cache de Dominance
 * Ce script permet le fonctionnement hors-ligne et accelere le chargement .
 */

const CACHE_NAME = 'fc84-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  'https://googleapis.com'
];

// Installation du Service Worker et mise en cache des ressources critiques
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// Strategie "Network First" : On cherche sur le web , sinon on prend le cache
// C'est la meilleure strategie pour un portfolio mis a jour regulierement .
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});
