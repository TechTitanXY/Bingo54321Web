import type { BingoCard, BingoLetter } from "../types/bingoTypes";

const LETTERS: BingoLetter[] = ["B", "I", "N", "G", "O"];

function randomIndex(length: number): number {
    const range = 0x100000000;
    const limit = Math.floor(range / length) * length;
    const values = new Uint32Array(1);

    let value: number;

    do {
        crypto.getRandomValues(values);
        value = values[0];
    } while (value >= limit);

    return value % length;
}

function shuffledNumbers(start: number): number[] {
    const numbers = Array.from(
        { length: 15 },
        (_, index) => start + index
    );

    for (let i = numbers.length - 1; i > 0; i--) {
        const j = randomIndex(i + 1);

        [numbers[i], numbers[j]] =
            [numbers[j], numbers[i]];
    }

    return numbers.slice(0, 5);
}

function createCardId(): string {
    const values = new Uint32Array(2);
    crypto.getRandomValues(values);

    const identifier = Array.from(
        values,
        value => value.toString(16).padStart(8, "0")
    ).join("");

    // Temporary generation identifier; storage assigns the permanent A001–Z999 ID.
    return identifier.slice(0, 10).toUpperCase();
}

function generateCard(): BingoCard {
    const columns = {} as BingoCard["columns"];

    LETTERS.forEach((letter, index) => {
        const start = index * 15 + 1;
        columns[letter] = shuffledNumbers(start);
    });

    columns.N[2] = null;

    return {
        id: createCardId(),
        columns
    };
}

export function generateBingoCards(count: number): BingoCard[] {
    if (!Number.isInteger(count) || count < 1 || count > 100) {
        throw new RangeError(
            "Generate between 1 and 100 Bingo cards."
        );
    }

    const cards: BingoCard[] = [];
    const signatures = new Set<string>();

    while (cards.length < count) {
        const card = generateCard();

        const signature = LETTERS
            .flatMap(letter => card.columns[letter])
            .join(",");

        if (signatures.has(signature)) {
            continue;
        }

        signatures.add(signature);
        cards.push(card);
    }

    return cards;
}