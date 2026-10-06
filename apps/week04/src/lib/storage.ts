const DB_NAME = "week04-patchouli-lab-v1";
export async function openStorage(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("state");
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}
export function loadState(storage: IDBDatabase): Promise<any> {
  return new Promise((resolve, reject) => {
    const request = storage
      .transaction("state")
      .objectStore("state")
      .get("library");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export function saveState(storage: IDBDatabase, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = storage.transaction("state", "readwrite");
    tx.objectStore("state").put(value, "library");
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error || new Error("Browser storage aborted"));
    tx.onerror = () => reject(tx.error);
  });
}
