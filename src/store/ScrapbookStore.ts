export interface ScrapbookPage {
    id: string;
    imageBase64: string;
    caption: string;
    characterPrompt: string;
    timestamp: number;
}

const DATABASE_NAME = "BarbieStorybook";
const DATABASE_VERSION = 1;
const STORE_NAME = "pages";

let databasePromise: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
    if (databasePromise) return databasePromise;

    databasePromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: "id" });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("Failed to open IndexedDB."));
    });

    return databasePromise;
}

function withStore<T>(
    mode: IDBTransactionMode,
    action: (store: IDBObjectStore, resolve: (value: T) => void, reject: (reason?: unknown) => void) => void
): Promise<T> {
    return openDatabase().then(db => new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, mode);
        const store = transaction.objectStore(STORE_NAME);

        transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed."));
        action(store, resolve, reject);
    }));
}

export async function init(): Promise<void> {
    await openDatabase();
}

export async function savePage(page: ScrapbookPage): Promise<void> {
    return withStore<void>("readwrite", (store, resolve, reject) => {
        const request = store.put(page);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error ?? new Error("Failed to save scrapbook page."));
    });
}

export async function getAllPages(): Promise<ScrapbookPage[]> {
    return withStore<ScrapbookPage[]>("readonly", (store, resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => {
            const pages = (request.result as ScrapbookPage[]).sort((a, b) => b.timestamp - a.timestamp);
            resolve(pages);
        };
        request.onerror = () => reject(request.error ?? new Error("Failed to load scrapbook pages."));
    });
}

export async function deletePage(id: string): Promise<void> {
    return withStore<void>("readwrite", (store, resolve, reject) => {
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error ?? new Error("Failed to delete scrapbook page."));
    });
}
