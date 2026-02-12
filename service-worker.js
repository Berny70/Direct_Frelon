/* ==========================
   SERVICE WORKER – Chrono Frelon
   ========================== */

const APP_VERSION = "10.6";
const CACHE_NAME = "chrono-frelon-v10.6";

/* ⚠️ Liste STRICTE des fichiers à mettre en cache
   (éviter "./" qui peut matcher trop large) */
const FILES_TO_CACHE = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./version.js",
  "./manifest.json",
  "./icon_4_chrono_2.png",

  // JS
  "./js/i18n.js",
  "./js/help.js",

  // I18N
  "./i18n/fr.json",
  "./i18n/en.json",
  "./i18n/de.json",
  "./i18n/it.json"
];

/* ==========================
   INSTALL
   ========================== */
self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(FILES_TO_CACHE);
    })
  );
});

/* ==========================
   ACTIVATE
   ========================== */
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)
          .map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

/* ==========================
   FETCH (SÉCURISÉ)
   ========================== */
self.addEventListener("fetch", event => {
  const req = event.request;

  /* 🔒 Ne jamais intercepter :
     - requêtes externes
     - requêtes non GET */
  if (
    req.method !== "GET" ||
    !req.url.startsWith(self.location.origin)
  ) {
    return;
  }

  event.respondWith(
    caches.match(req).then(cacheRes => {
      return (
        cacheRes ||
        fetch(req).catch(() => {
          // fallback minimal si réseau KO
          if (req.destination === "document") {
            return caches.match("/Chrono_Frelon/index.html");
          }
        })
      );
    })
  );
});

/* ==========================
   MESSAGE (DEBUG / VERSION)
   ========================== */
self.addEventListener("message", event => {
  if (event.data === "GET_VERSION") {
    event.source.postMessage({
      version: APP_VERSION
    });
  }
});










































