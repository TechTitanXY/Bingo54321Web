import { useState } from "react";
import BingoBoard from "./components/BingoBoard";
import { callNextNumber } from "./services/bingoService";
import type { BingoCall } from "./types/bingoTypes";
import "./styles/bingo.css";

function App() {
    const [calledNumbers, setCalledNumbers] =
        useState<BingoCall[]>([]);

    const currentCall =
        calledNumbers.length > 0
            ? calledNumbers[calledNumbers.length - 1]
            : null;

    const isGameComplete = calledNumbers.length === 75;

    function handleNextNumber() {
        const nextCall = callNextNumber(calledNumbers);

        if (nextCall !== null) {
            setCalledNumbers([...calledNumbers, nextCall]);
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
                    {currentCall
                        ? currentCall.display
                        : "READY!"}
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