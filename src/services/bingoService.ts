import type { BingoCall, BingoLetter } from "../types/bingoTypes";

const TOTAL_BINGO_NUMBERS = 75;

export function getBingoLetter(number: number): BingoLetter {
    if (!Number.isInteger(number) || number < 1 || number > 75) {
        throw new RangeError("Bingo numbers must be between 1 and 75.");
    }

    if (number <= 15) return "B";
    if (number <= 30) return "I";
    if (number <= 45) return "N";
    if (number <= 60) return "G";

    return "O";
}

export function createBingoCall(number: number): BingoCall {
    const letter = getBingoLetter(number);

    return {
        number,
        letter,
        display: `${letter}-${number}`,
    };
}

export function getAvailableNumbers(
    calledNumbers: BingoCall[]
): number[] {
    const called = new Set(
        calledNumbers.map(call => call.number)
    );

    const available: number[] = [];

    for (let number = 1; number <= TOTAL_BINGO_NUMBERS; number++) {
        if (!called.has(number)) {
            available.push(number);
        }
    }

    return available;
}

function getRandomIndex(length: number): number {
    if (!Number.isSafeInteger(length) || length <= 0) {
        throw new RangeError("A positive number of choices is required.");
    }

    const range = 0x100000000;
    const limit = Math.floor(range / length) * length;
    const values = new Uint32Array(1);

    let randomValue: number;

    do {
        crypto.getRandomValues(values);
        randomValue = values[0];
    } while (randomValue >= limit);

    return randomValue % length;
}

export function callNextNumber(
    calledNumbers: BingoCall[]
): BingoCall | null {
    const available = getAvailableNumbers(calledNumbers);

    if (available.length === 0) {
        return null;
    }

    const randomIndex = getRandomIndex(available.length);
    const selectedNumber = available[randomIndex];

    return createBingoCall(selectedNumber);
}