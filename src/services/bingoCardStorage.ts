import type { BingoCard } from "../types/bingoTypes";

// Browser-local persistent library; IDs are allocated in one IndexedDB transaction.
const DATABASE_NAME = "54321-bingo-cards";
const DATABASE_VERSION = 2;
const CARD_STORE = "cards";
const SETTINGS_STORE = "settings";
const LAST_ASSIGNED_KEY = "lastAssignedSequence";
const MAX_CARD_SEQUENCE = 26 * 999;
const CARD_ID_PATTERN = /^[A-Z](?:00[1-9]|0[1-9]\d|[1-9]\d{2})$/;

export interface SavedBingoCard extends BingoCard {
    createdAt: string;
    // The original ID is retained as a reference during the one-time migration.
    legacyId?: string;
}

function cardIdFromSequence(sequence: number): string {
    if (!Number.isInteger(sequence) || sequence < 1 || sequence > MAX_CARD_SEQUENCE) {
        throw new RangeError("All A001–Z999 Card IDs have been assigned.");
    }
    const letter = String.fromCharCode(65 + Math.floor((sequence - 1) / 999));
    const number = ((sequence - 1) % 999) + 1;
    return `${letter}${String(number).padStart(3, "0")}`;
}

function sequenceFromCardId(id: string): number {
    if (!CARD_ID_PATTERN.test(id)) return 0;
    return (id.charCodeAt(0) - 65) * 999 + Number(id.slice(1));
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
            const transaction = request.transaction;
            if (!transaction) return;

            const cards = database.objectStoreNames.contains(CARD_STORE)
                ? transaction.objectStore(CARD_STORE)
                : database.createObjectStore(CARD_STORE, { keyPath: "id" });
            const settings = database.objectStoreNames.contains(SETTINGS_STORE)
                ? transaction.objectStore(SETTINGS_STORE)
                : database.createObjectStore(SETTINGS_STORE);

            // Existing hexadecimal IDs are migrated atomically, in creation order.
            // An aborted upgrade leaves the entire original v1 database untouched.
            const allRequest = cards.getAll();
            allRequest.onsuccess = () => {
                const existing = (allRequest.result as SavedBingoCard[]).sort((a, b) =>
                    (a.createdAt ?? "").localeCompare(b.createdAt ?? "") || a.id.localeCompare(b.id)
                );
                const preserved = existing.filter(card => sequenceFromCardId(card.id) > 0);
                const legacy = existing.filter(card => sequenceFromCardId(card.id) === 0);
                const allocated = new Set(preserved.map(card => sequenceFromCardId(card.id)));
                let next = allocated.size ? Math.max(...allocated) : 0;
                const migrated: SavedBingoCard[] = [];

                for (const card of legacy) {
                    do { next++; } while (allocated.has(next) && next <= MAX_CARD_SEQUENCE);
                    if (next > MAX_CARD_SEQUENCE) {
                        transaction.abort();
                        return;
                    }
                    allocated.add(next);
                    migrated.push({ ...card, legacyId: card.legacyId ?? card.id, id: cardIdFromSequence(next) });
                }

                for (const card of migrated) {
                    cards.delete(card.legacyId!);
                    cards.add(card);
                }
                settings.put(Math.max(next, ...allocated, 0), LAST_ASSIGNED_KEY);
            };
        };

        request.onsuccess = () => {
            const database = request.result;
            database.onversionchange = () => database.close();
            resolve(database);
        };
        request.onerror = () => reject(request.error ?? new Error("Could not open card storage."));
        request.onblocked = () => reject(new Error(
            "Card storage upgrade is blocked by another open Bingo tab. Close other Bingo tabs and try again."
        ));
    });
}

/**
 * Save a generated batch atomically and assign permanent sequential IDs.
 * A single readwrite transaction prevents two open tabs from assigning the same ID.
 * Returns the actual saved cards, including their new Card IDs.
 */
export async function saveBingoCards(cards: BingoCard[]): Promise<SavedBingoCard[]> {
    if (cards.length === 0) return [];
    const database = await openDatabase();
    try {
        return await new Promise<SavedBingoCard[]>((resolve, reject) => {
            const transaction = database.transaction([CARD_STORE, SETTINGS_STORE], "readwrite");
            const cardStore = transaction.objectStore(CARD_STORE);
            const settings = transaction.objectStore(SETTINGS_STORE);
            const lastRequest = settings.get(LAST_ASSIGNED_KEY);
            const saved: SavedBingoCard[] = [];

            lastRequest.onsuccess = () => {
                const last = typeof lastRequest.result === "number" ? lastRequest.result : 0;
                if (last + cards.length > MAX_CARD_SEQUENCE) {
                    transaction.abort();
                    return;
                }
                const createdAt = new Date().toISOString();
                cards.forEach((card, index) => {
                    const savedCard: SavedBingoCard = {
                        id: cardIdFromSequence(last + index + 1),
                        columns: card.columns,
                        createdAt
                    };
                    cardStore.add(savedCard); // Never overwrite a saved card.
                    saved.push(savedCard);
                });
                settings.put(last + cards.length, LAST_ASSIGNED_KEY);
            };
            transaction.oncomplete = () => resolve(saved);
            transaction.onabort = () => reject(transaction.error ?? new Error(
                "Card saving was canceled. The card library may have reached the A001–Z999 limit."
            ));
            transaction.onerror = () => reject(transaction.error ?? new Error("Could not save Bingo cards."));
        });
    } finally {
        database.close();
    }
}

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
