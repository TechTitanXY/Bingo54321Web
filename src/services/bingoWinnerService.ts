import type { BingoCall, BingoCard, BingoLetter, BingoWinner } from "../types/bingoTypes";

const LETTERS: BingoLetter[] = ["B", "I", "N", "G", "O"];

type Square = { letter: BingoLetter; row: number };

// Five rows, five columns and the two diagonals: 12 standard Bingo lines.
const WINNING_LINES: Square[][] = [
    ...Array.from({ length: 5 }, (_, row) =>
        LETTERS.map(letter => ({ letter, row }))),
    ...LETTERS.map(letter =>
        Array.from({ length: 5 }, (_, row) => ({ letter, row }))),
    Array.from({ length: 5 }, (_, row) => ({ letter: LETTERS[row], row })),
    Array.from({ length: 5 }, (_, row) => ({ letter: LETTERS[4 - row], row }))
];

/** Return every winning registered card, exactly once, in the order it first won. */
export function findBingoWinners(cards: readonly BingoCard[], calls: readonly BingoCall[]): BingoWinner[] {
    const callIndex = new Map(calls.map((call, index) => [call.number, index]));
    const winners: BingoWinner[] = [];
    const seenIds = new Set<string>();

    for (const card of cards) {
        if (seenIds.has(card.id)) continue;
        seenIds.add(card.id);

        let earliestWin = Number.POSITIVE_INFINITY;
        for (const line of WINNING_LINES) {
            let completedAt = -1;
            for (const { letter, row } of line) {
                const number = card.columns[letter][row];
                // The center FREE square is considered marked from the beginning.
                const calledAt = number === null ? -1 : callIndex.get(number);
                if (calledAt === undefined) {
                    completedAt = Number.POSITIVE_INFINITY;
                    break;
                }
                completedAt = Math.max(completedAt, calledAt);
            }
            earliestWin = Math.min(earliestWin, completedAt);
        }

        if (Number.isFinite(earliestWin) && earliestWin >= 0) {
            winners.push({
                cardId: card.id,
                callIndex: earliestWin,
                winningCall: calls[earliestWin].display
            });
        }
    }

    return winners.sort((a, b) => a.callIndex - b.callIndex || a.cardId.localeCompare(b.cardId));
}
