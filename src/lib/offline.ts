"use client";

// Helpers de IndexedDB para guardar audios cuando no hay conexión.
// El service worker (public/sw.js) lee la misma base para el Background Sync.

const DB_NAME = "registro-offline";
const DB_VERSION = 1;
const STORE = "pending_audios";

export interface PendingMetadata {
  promotor: string;
  programa: string;
  beneficiario: string; // JSON string
}

export interface PendingItem extends PendingMetadata {
  id: number;
  audio: Blob;
  creado_en: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
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

export async function savePending(
  audioBlob: Blob,
  metadata: PendingMetadata,
): Promise<number> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const req = store.add({
      audio: audioBlob,
      creado_en: Date.now(),
      ...metadata,
    });
    req.onsuccess = () => resolve(req.result as number);
    req.onerror = () => reject(req.error);
  });
}

export async function getPending(): Promise<PendingItem[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result as PendingItem[]);
    req.onerror = () => reject(req.error);
  });
}

export async function deletePending(id: number): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const req = tx.objectStore(STORE).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function countPending(): Promise<number> {
  const items = await getPending();
  return items.length;
}

/** Reintenta enviar todos los pendientes. Devuelve cuántos se enviaron. */
export async function flushPending(): Promise<number> {
  const items = await getPending();
  let enviados = 0;
  for (const item of items) {
    try {
      const form = new FormData();
      form.append("audio", item.audio, "audio.webm");
      form.append("promotor", item.promotor);
      form.append("programa", item.programa);
      form.append("beneficiario", item.beneficiario);
      const pcUrl = process.env.NEXT_PUBLIC_PC_URL ?? "";
      const res = await fetch(`${pcUrl}/api/audio`, { method: "POST", body: form });
      if (res.ok) {
        await deletePending(item.id);
        enviados++;
      }
    } catch {
      // Sin red todavía: lo dejamos en la cola.
    }
  }
  return enviados;
}

/** Registra un Background Sync si el navegador lo soporta. */
export async function registerSync(): Promise<boolean> {
  if (!("serviceWorker" in navigator)) return false;
  try {
    const reg = (await navigator.serviceWorker.ready) as ServiceWorkerRegistration & {
      sync?: { register: (tag: string) => Promise<void> };
    };
    if (reg.sync) {
      await reg.sync.register("upload-audio");
      return true;
    }
  } catch {
    // ignorar
  }
  return false;
}
