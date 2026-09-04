import type { Answers, Rubric } from "./types";

type DraftPayload = {
  date: string;
  answers: Answers;
  rubric: Rubric;
  updatedAt: string;
};

type MutationPayload = {
  id: string;
  type: "save-draft" | "complete-record" | "update-history";
  payload: unknown;
  createdAt: string;
};

const databaseName = "zenlenz-log-local";
const databaseVersion = 1;

function openDatabase(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, databaseVersion);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("drafts", { keyPath: "date" });
      request.result.createObjectStore("mutations", { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveLocalDraft(payload: DraftPayload): Promise<void> {
  const db = await openDatabase();
  if (!db) return;
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction("drafts", "readwrite").objectStore("drafts").put(payload);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function readLocalDraft(date: string): Promise<DraftPayload | null> {
  const db = await openDatabase();
  if (!db) return null;
  return new Promise((resolve, reject) => {
    const request = db.transaction("drafts", "readonly").objectStore("drafts").get(date);
    request.onsuccess = () => resolve((request.result as DraftPayload | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });
}

export async function enqueueMutation(payload: MutationPayload): Promise<void> {
  const db = await openDatabase();
  if (!db) return;
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction("mutations", "readwrite").objectStore("mutations").put(payload);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function readMutationQueue(): Promise<MutationPayload[]> {
  const db = await openDatabase();
  if (!db) return [];
  return new Promise((resolve, reject) => {
    const request = db.transaction("mutations", "readonly").objectStore("mutations").getAll();
    request.onsuccess = () => resolve((request.result as MutationPayload[]) ?? []);
    request.onerror = () => reject(request.error);
  });
}

export async function removeMutation(id: string): Promise<void> {
  const db = await openDatabase();
  if (!db) return;
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction("mutations", "readwrite").objectStore("mutations").delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
