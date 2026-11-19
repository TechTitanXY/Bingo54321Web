export type BingoLetter = "B" | "I" | "N" | "G" | "O";

export interface BingoCall {
    number: number;
    letter: BingoLetter;
    display: string;
}