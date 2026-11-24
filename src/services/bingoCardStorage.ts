import type { BingoCard } from "../types/bingoTypes";

// Browser-local persistent card library. No server or additional dependency required.
// Cards are stored by their original IDs so a later phase can reprint exact copies.
const DATABASE_NAME = "54321-bingo-cards";
const DATABASE_VERSION = 1;
const CARD_STORE = "cards";

export interface SavedBingoCard extends BingoCard {
    createdAt: string;
}

function openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        if (typeof indexedDB === "undefined") {
            reject(new Error("IndexedDB is unavailable in this browser."));
            return;
        }

        const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

        request.onupgradeneeded = () => {
            const database = request.result;
            if (!database.objectStoreNames.contains(CARD_STORE)) {
                database.createObjectStore(CARD_STORE, { keyPath: "id" });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("Could not open card storage."));
        request.onblocked = () => reject(new Error("Card storage is blocked by another open tab. Close other Bingo tabs and try again."));
    });
}

/**
 * Save one generated batch atomically. add() (not put()) prevents overwriting
 * an existing card if a randomly generated ID ever happens to collide.
 */
export async function saveBingoCards(cards: BingoCard[]): Promise<void> {
    if (cards.length === 0) {
        return;
    }

    const database = await openDatabase();

    try {
        await new Promise<void>((resolve, reject) => {
            const transaction = database.transaction(CARD_STORE, "readwrite");
            const store = transaction.objectStore(CARD_STORE);
            const createdAt = new Date().toISOString();

            for (const card of cards) {
                store.add({ ...card, createdAt } satisfies SavedBingoCard);
            }

            transaction.oncomplete = () => resolve();
            transaction.onabort = () => reject(transaction.error ?? new Error("Card saving was canceled."));
            transaction.onerror = () => reject(transaction.error ?? new Error("Could not save Bingo cards."));
        });
    } finally {
        database.close();
    }
}

/** Read the card library for the upcoming card-management screen. */
export async function getSavedBingoCards(): Promise<SavedBingoCard[]> {
    const database = await openDatabase();
    try {
        return await new Promise<SavedBingoCard[]>((resolve, reject) => {
            const transaction = database.transaction(CARD_STORE, "readonly");
            const request = transaction.objectStore(CARD_STORE).getAll();
            request.onsuccess = () => resolve(request.result as SavedBingoCard[]);
            request.onerror = () => reject(request.error ?? new Error("Could not load Bingo cards."));
        });
    } finally {
        database.close();
    }
}

/** Retrieve one exact saved layout by Card ID for future reprinting. */
export async function getSavedBingoCard(id: string): Promise<SavedBingoCard | undefined> {
    const database = await openDatabase();
    try {
        return await new Promise<SavedBingoCard | undefined>((resolve, reject) => {
            const transaction = database.transaction(CARD_STORE, "readonly");
            const request = transaction.objectStore(CARD_STORE).get(id);
            request.onsuccess = () => resolve(request.result as SavedBingoCard | undefined);
            request.onerror = () => reject(request.error ?? new Error("Could not load the Bingo card."));
        });
    } finally {
        database.close();
    }
}
