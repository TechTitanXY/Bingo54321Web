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


// Phase 7: portable, versioned card-library backups. The file contains no
// account data; it contains the exact printed card arrangements and ID counter.
const BACKUP_FORMAT = "54321-bingo-card-library";
const BACKUP_VERSION = 1;

export interface BingoCardBackup {
    format: typeof BACKUP_FORMAT;
    version: typeof BACKUP_VERSION;
    exportedAt: string;
    lastAssignedSequence: number;
    cards: SavedBingoCard[];
}

export interface RestoreCardsResult {
    added: number;
    alreadyPresent: number;
    total: number;
}

export async function createBingoCardBackup(): Promise<BingoCardBackup> {
    const database = await openDatabase();
    try {
        return await new Promise<BingoCardBackup>((resolve, reject) => {
            const transaction = database.transaction([CARD_STORE, SETTINGS_STORE], "readonly");
            const cardsRequest = transaction.objectStore(CARD_STORE).getAll();
            const lastRequest = transaction.objectStore(SETTINGS_STORE).get(LAST_ASSIGNED_KEY);
            transaction.oncomplete = () => {
                const cards = (cardsRequest.result as SavedBingoCard[])
                    .sort((a, b) => sequenceFromCardId(a.id) - sequenceFromCardId(b.id));
                const highest = cards.reduce((max, card) => Math.max(max, sequenceFromCardId(card.id)), 0);
                const storedLast = lastRequest.result;
                resolve({
                    format: BACKUP_FORMAT,
                    version: BACKUP_VERSION,
                    exportedAt: new Date().toISOString(),
                    lastAssignedSequence: Math.max(
                        highest, Number.isSafeInteger(storedLast) ? storedLast as number : 0
                    ),
                    cards
                });
            };
            transaction.onerror = () => reject(transaction.error ?? new Error("Could not back up Bingo cards."));
            transaction.onabort = () => reject(transaction.error ?? new Error("Card backup was interrupted."));
        });
    } finally {
        database.close();
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateBackup(value: unknown): BingoCardBackup {
    if (!isRecord(value) || value.format !== BACKUP_FORMAT || value.version !== BACKUP_VERSION) {
        throw new Error("This isn't a supported 54321-BINGO! card backup (version 1). No cards were changed.");
    }
    if (!Array.isArray(value.cards) || value.cards.length > MAX_CARD_SEQUENCE ||
        typeof value.exportedAt !== "string" || !Number.isFinite(Date.parse(value.exportedAt)) ||
        !Number.isSafeInteger(value.lastAssignedSequence) ||
        (value.lastAssignedSequence as number) < 0 || (value.lastAssignedSequence as number) > MAX_CARD_SEQUENCE) {
        throw new Error("The backup file has invalid metadata. No cards were changed.");
    }

    const ids = new Set<string>();
    const checked: SavedBingoCard[] = [];
    let highest = 0;
    const letters = ["B", "I", "N", "G", "O"] as const;

    for (const item of value.cards) {
        if (!isRecord(item) || typeof item.id !== "string" ||
            !CARD_ID_PATTERN.test(item.id) || ids.has(item.id) ||
            typeof item.createdAt !== "string" || !Number.isFinite(Date.parse(item.createdAt)) ||
            !isRecord(item.columns)) {
            throw new Error("The backup contains an invalid or duplicate Card ID. No cards were changed.");
        }
        ids.add(item.id);
        highest = Math.max(highest, sequenceFromCardId(item.id));

        const columns: SavedBingoCard["columns"] = { B: [], I: [], N: [], G: [], O: [] };
        for (const [index, letter] of letters.entries()) {
            const numbers = item.columns[letter];
            if (!Array.isArray(numbers) || numbers.length !== 5) {
                throw new Error(`Card ${item.id} has an invalid ${letter} column. No cards were changed.`);
            }
            const used = new Set<number>();
            for (const [row, number] of numbers.entries()) {
                if (letter === "N" && row === 2 && number === null) {
                    columns[letter].push(null);
                } else if (typeof number === "number" && Number.isInteger(number) &&
                    number >= index * 15 + 1 && number <= index * 15 + 15 && !used.has(number) &&
                    !(letter === "N" && row === 2)) {
                    used.add(number);
                    columns[letter].push(number);
                } else {
                    throw new Error(`Card ${item.id} contains an invalid or repeated number. No cards were changed.`);
                }
            }
        }
        const card: SavedBingoCard = { id: item.id, createdAt: item.createdAt, columns };
        if (typeof item.legacyId === "string") card.legacyId = item.legacyId;
        checked.push(card);
    }
    if ((value.lastAssignedSequence as number) < highest) {
        throw new Error("The backup's card numbering counter is invalid. No cards were changed.");
    }
    return {
        format: BACKUP_FORMAT, version: BACKUP_VERSION,
        exportedAt: value.exportedAt as string,
        lastAssignedSequence: value.lastAssignedSequence as number,
        cards: checked
    };
}

function sameCardLayout(first: SavedBingoCard, second: SavedBingoCard): boolean {
    return (["B", "I", "N", "G", "O"] as const).every(letter =>
        first.columns[letter].every((value, index) => value === second.columns[letter][index])
    );
}

// Every imported card and the sequence counter are committed in ONE IndexedDB
// transaction. A conflicting ID aborts the entire operation; no overwrites.
export async function restoreBingoCardBackup(untrustedBackup: unknown): Promise<RestoreCardsResult> {
    const backup = validateBackup(untrustedBackup);
    const database = await openDatabase();
    try {
        return await new Promise<RestoreCardsResult>((resolve, reject) => {
            const transaction = database.transaction([CARD_STORE, SETTINGS_STORE], "readwrite");
            const cards = transaction.objectStore(CARD_STORE);
            const settings = transaction.objectStore(SETTINGS_STORE);
            const existingRequest = cards.getAll();
            const lastRequest = settings.get(LAST_ASSIGNED_KEY);
            let added = 0;
            let alreadyPresent = 0;
            let failure: Error | null = null;
            let ready = 0;
            const merge = () => {
                if (++ready !== 2) return;
                const existing = existingRequest.result as SavedBingoCard[];
                const byId = new Map(existing.map(card => [card.id, card]));
                for (const card of backup.cards) {
                    const found = byId.get(card.id);
                    if (found) {
                        if (!sameCardLayout(found, card)) {
                            failure = new Error(`Card ${card.id} already exists with different numbers. Nothing was restored.`);
                            transaction.abort();
                            return;
                        }
                        alreadyPresent++;
                    } else {
                        cards.add(card);
                        added++;
                    }
                }
                const highestExisting = existing.reduce((max, card) => Math.max(max, sequenceFromCardId(card.id)), 0);
                const storedLast = lastRequest.result;
                const last = Number.isSafeInteger(storedLast) ? storedLast as number : 0;
                settings.put(Math.max(last, highestExisting, backup.lastAssignedSequence), LAST_ASSIGNED_KEY);
            };
            existingRequest.onsuccess = merge;
            lastRequest.onsuccess = merge;
            transaction.oncomplete = () => resolve({
                added, alreadyPresent, total: added + alreadyPresent
            });
            transaction.onabort = () => reject(failure ?? transaction.error ?? new Error("Restore failed; no cards were changed."));
            transaction.onerror = () => {
                // onabort reports the transaction's final result.
            };
        });
    } finally {
        database.close();
    }
}
