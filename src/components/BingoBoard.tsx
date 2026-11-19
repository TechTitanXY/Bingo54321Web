import type { BingoCall, BingoLetter } from "../types/bingoTypes";
import "../styles/bingo.css";

interface BingoBoardProps {
    calledNumbers: BingoCall[];
}

const columns: BingoLetter[] = ["B", "I", "N", "G", "O"];

export default function BingoBoard({
    calledNumbers,
}: BingoBoardProps) {
    const calledSet = new Set(calledNumbers.map(call => call.number));

    const latestNumber = calledNumbers.length > 0
        ? calledNumbers[calledNumbers.length - 1].number
        : null;

    return (
        <div className="bingo-board">
            {columns.map((letter, columnIndex) => (
                <div className="bingo-column" key={letter}>
                    <div className="bingo-column-header">
                        {letter}
                    </div>

                    {Array.from({ length: 15 }, (_, index) => {
                        const number =
                            columnIndex * 15 + index + 1;

                        const isCalled = calledSet.has(number);
                        const isLatest = number === latestNumber;

                        return (
                            <div
                                key={number}
                                className={`bingo-number ${isLatest ? "latest" : isCalled ? "called" : ""}`}
                            >
                                {number}
                            </div>
                        );
                    })}
                </div>
            ))}
        </div>
    );
}