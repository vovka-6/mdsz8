/* Офлайн-режим: все файлы приложения хранятся на телефоне.
   После любого изменения файлов на GitHub увеличьте VERSION —
   телефоны скачают обновление при следующем выходе в интернет. */
const VERSION = "toir-v2";
const FILES = [
  "./", "./index.html", "./app.js", "./xlsx-lite.js", "./equipment.js",
  "./qrcode.js", "./jsQR.js", "./manifest.webmanifest",
  "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png", "./apple-touch-icon.png"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", e => { if (e.data === "skipWaiting") self.skipWaiting(); });

/* Сначала из памяти телефона — работает без сети и открывается мгновенно */
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(hit => {
      if (hit) return hit;
      if (e.request.mode === "navigate") return caches.match("./index.html");
      return fetch(e.request);
    })
  );
});
