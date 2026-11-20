import { useEffect, useState } from "react";
import BingoBoard from "./components/BingoBoard";
import { callNextNumber } from "./services/bingoService";
import type { BingoCall } from "./types/bingoTypes";
import "./styles/bingo.css";

const STORAGE_KEY = "54321-bingo-called-numbers";

function loadSavedNumbers(): BingoCall[] {
    try {
        const saved = sessionStorage.getItem(STORAGE_KEY);

        if (!saved) {
            return [];
        }

        const parsed: unknown = JSON.parse(saved);

        if (
            !Array.isArray(parsed) ||
            parsed.length > 75
        ) {
            return [];
        }

        const seen = new Set<number>();

        for (const call of parsed) {
            if (
                typeof call !== "object" ||
                call === null ||
                !("number" in call) ||
                !("letter" in call) ||
                !("display" in call) ||
                typeof call.number !== "number" ||
                !Number.isInteger(call.number) ||
                call.number < 1 ||
                call.number > 75 ||
                typeof call.letter !== "string" ||
                typeof call.display !== "string" ||
                seen.has(call.number)
            ) {
                return [];
            }

            const expectedLetter =
                "BINGO"[Math.floor((call.number - 1) / 15)];

            if (
                call.letter !== expectedLetter ||
                call.display !== `${expectedLetter}-${call.number}`
            ) {
                return [];
            }

            seen.add(call.number);
        }

        return parsed as BingoCall[];
    } catch {
        return [];
    }
}

function App() {
    const [calledNumbers, setCalledNumbers] =
        useState<BingoCall[]>(loadSavedNumbers);

    useEffect(() => {
        try {
            sessionStorage.setItem(
                STORAGE_KEY,
                JSON.stringify(calledNumbers)
            );
        } catch {
            // Continue playing if browser storage is unavailable.
        }
    }, [calledNumbers]);

    const currentCall =
        calledNumbers.length > 0
            ? calledNumbers[calledNumbers.length - 1]
            : null;

    const isGameComplete = calledNumbers.length === 75;

    function handleNextNumber() {
        const nextCall = callNextNumber(calledNumbers);

        if (nextCall !== null) {
            setCalledNumbers(previous => [
                ...previous,
                nextCall
            ]);
        }
    }

    function handleNewGame() {
        if (
            calledNumbers.length > 0 &&
            !window.confirm(
                "Start a new game? All previously called numbers will be cleared."
            )
        ) {
            return;
        }

        setCalledNumbers([]);
    }

    return (
        <main className="bingo-app">
            <header className="bingo-header">
                <h1>54321-BINGO!</h1>
                <p>Turn Your TV Into a Bingo Hall!</p>
            </header>

            <section className="current-call-panel">
                <h2>Current Number</h2>

                <div className="current-call-number">
                    {currentCall ? currentCall.display : "READY!"}
                </div>

                <p>
                    {isGameComplete
                        ? "All 75 numbers have been called!"
                        : `${calledNumbers.length} of 75 numbers called`}
                </p>
            </section>

            <section className="bingo-controls">
                <button
                    type="button"
                    onClick={handleNextNumber}
                    disabled={isGameComplete}
                >
                    Call Next Number
                </button>

                <button
                    type="button"
                    className="new-game-button"
                    onClick={handleNewGame}
                >
                    New Game
                </button>
            </section>

            <section aria-label="Bingo number board">
                <BingoBoard calledNumbers={calledNumbers} />
            </section>
        </main>
    );
}

export default App;