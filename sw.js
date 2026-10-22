/* Офлайн-режим: все файлы приложения хранятся на телефоне.
   После любого изменения файлов на GitHub увеличьте VERSION —
   телефоны скачают обновление при следующем выходе в интернет. */
const VERSION = "mdsz8-v9";
const FILES = [
  "./", "./index.html", "./app.js", "./data.js", "./xlsx-lite.js", "./jsQR.js", "./manifest.webmanifest",
  "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png", "./apple-touch-icon.png",
  "./fonts/OpenSans-Regular.woff", "./fonts/OpenSans-Bold.woff", "./fonts/OpenSans-ExtraBold.woff"
];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES.map(f => new Request(f, { cache: "reload" })))));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("message", e => { if (e.data === "skipWaiting") self.skipWaiting(); });
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(hit => hit || (e.request.mode === "navigate" ? caches.match("./index.html") : fetch(e.request))));
});
