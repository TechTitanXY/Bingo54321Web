export type BingoLetter = "B" | "I" | "N" | "G" | "O";

export interface BingoCall {
    number: number;
    letter: BingoLetter;
    display: string;
}

export interface BingoCard {
    id: string;
    columns: Record<BingoLetter, (number | null)[]>;
}
/** One result per winning card, even if it completes multiple lines. */
export interface BingoWinner {
    cardId: string;
    /** Zero-based position of the call that completed the first winning line. */
    callIndex: number;
    winningCall: string;
}
