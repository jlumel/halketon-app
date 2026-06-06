// Service worker — Registro de campo (Pequeños Pasos)
// 1. Cachea el shell del flujo del promotor para que abra sin red.
// 2. Background Sync (tag 'upload-audio') reintenta los audios pendientes
//    guardados en IndexedDB.

const CACHE = "registro-shell-v1";
const SHELL = ["/", "/programa", "/registro", "/grabar", "/manifest.json", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

// Estrategia: network-first para navegación (para tener datos frescos online),
// fallback a cache cuando no hay red. No interceptamos POST ni /api.
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(request).then((r) => r || caches.match("/"))),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request)),
  );
});

// ---------- Background Sync ----------

self.addEventListener("sync", (event) => {
  if (event.tag === "upload-audio") {
    event.waitUntil(flushPending());
  }
});

const IDB_NAME = "registro-offline";
const IDB_VERSION = 1;
const STORE = "pending_audios";

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function getAll(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function remove(db, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const req = tx.objectStore(STORE).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function flushPending() {
  const db = await openDb();
  const items = await getAll(db);
  for (const item of items) {
    try {
      const form = new FormData();
      form.append("audio", item.audio, "audio.webm");
      form.append("promotor", item.promotor);
      form.append("programa", item.programa);
      form.append("beneficiario", item.beneficiario);
      const res = await fetch("/api/audio", { method: "POST", body: form });
      if (res.ok) await remove(db, item.id);
    } catch {
      // sin red todavía: queda para el próximo sync
    }
  }
}
