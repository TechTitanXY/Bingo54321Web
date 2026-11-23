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