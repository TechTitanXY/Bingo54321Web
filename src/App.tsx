import { useEffect, useState } from "react";
import BingoBoard from "./components/BingoBoard";
import { callNextNumber } from "./services/bingoService";
import type { BingoCall } from "./types/bingoTypes";
import {
    announceBingoCall,
    isVoiceSupported,
    stopBingoAnnouncement
} from "./services/bingoSpeechService";
import "./styles/bingo.css";
import PrintableCards from "./components/PrintableCards";
import ActiveCards from "./components/ActiveCards";

const STORAGE_KEY = "54321-bingo-called-numbers";
const VOICE_STORAGE_KEY = "54321-bingo-voice-enabled";
const ACTIVE_CARDS_STORAGE_KEY = "54321-bingo-active-card-ids";

function loadActiveCardIds(): string[] {
    try {
        const value: unknown = JSON.parse(localStorage.getItem(ACTIVE_CARDS_STORAGE_KEY) ?? "[]");
        return Array.isArray(value) ? [...new Set(value.filter(
            (id): id is string => typeof id === "string" && /^[A-Z](?:00[1-9]|0[1-9]\d|[1-9]\d{2})$/.test(id)
        ))] : [];
    } catch {
        return [];
    }
}

function loadVoicePreference(): boolean {
    const supported = isVoiceSupported();

    if (!supported) {
        return false;
    }

    try {
        const saved = sessionStorage.getItem(VOICE_STORAGE_KEY);

        return saved === null ? true : saved !== "false";
    } catch {
        return true;
    }
}

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
    const [showCardPrinter, setShowCardPrinter] = useState(false);
    const [showActiveCards, setShowActiveCards] = useState(false);
    const [activeCardIds, setActiveCardIds] = useState<string[]>(loadActiveCardIds);

    useEffect(() => {
        try {
            localStorage.setItem(ACTIVE_CARDS_STORAGE_KEY, JSON.stringify(activeCardIds));
        } catch {
            // Keep registration active in memory when session storage is unavailable.
        }
    }, [activeCardIds]);

    const voiceSupported = isVoiceSupported();

    const [voiceEnabled, setVoiceEnabled] =
        useState<boolean>(loadVoicePreference);

    useEffect(() => {
        try {
            sessionStorage.setItem(
                VOICE_STORAGE_KEY,
                String(voiceEnabled)
            );
        } catch {
            // Continue if browser storage is unavailable.
        }
    }, [voiceEnabled]);

    const [autoRunning, setAutoRunning] = useState(false);
    const [autoHasStarted, setAutoHasStarted] = useState(false);
    const [intervalSeconds, setIntervalSeconds] = useState(10);
    const [completionPhase, setCompletionPhase] = useState<"idle" | "final-number" | "message">("idle");


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

    useEffect(() => {
        if (completionPhase === "idle") {
            return;
        }

        const timerId = window.setTimeout(() => {
            if (completionPhase === "final-number") {
                setCompletionPhase("message");
            } else {
                setCompletionPhase("idle");
            }
        }, 5000);

        return () => {
            window.clearTimeout(timerId);
        };
    }, [completionPhase]);


    // Schedule one automatic call at a time.
    // A change to the game or interval resets the timer.
    useEffect(() => {
        if (!autoRunning || isGameComplete) {
            return;
        }

        const timerId = window.setTimeout(() => {
            const nextCall = callNextNumber(calledNumbers);

            if (nextCall === null) {
                setAutoRunning(false);
                return;
            }

            setCalledNumbers(previous => [
                ...previous,
                nextCall
            ]);

            if (voiceEnabled) {
                announceBingoCall(nextCall);
            }

            if (calledNumbers.length === 74) {
                setCompletionPhase("final-number");
                setAutoRunning(false);
            }

        }, intervalSeconds * 1000);

        return () => {
            window.clearTimeout(timerId);
        };
    }, [
        autoRunning,
        calledNumbers,
        intervalSeconds,
        voiceEnabled,
        isGameComplete
    ]);

    function handleNextNumber() {
        if (autoRunning || isGameComplete) {
            return;
        }

        const nextCall = callNextNumber(calledNumbers);

        if (nextCall !== null) {
            setCalledNumbers(previous => [
                ...previous,
                nextCall
            ]);

            if (voiceEnabled) {
                announceBingoCall(nextCall);
            }

            if (calledNumbers.length === 74) {
                setCompletionPhase("final-number");
            }
        }
    }

    function handleAutomaticToggle() {
        if (autoRunning) {
            setAutoRunning(false);
            return;
        }

        if (isGameComplete) {
            return;
        }

        if (!autoHasStarted) {
            setAutoHasStarted(true);

            // Make the first automatic call immediately.
            const nextCall = callNextNumber(calledNumbers);

            if (nextCall !== null) {
                setCalledNumbers(previous => [
                    ...previous,
                    nextCall
                ]);

                if (voiceEnabled) {
                    announceBingoCall(nextCall);
                }

                if (calledNumbers.length === 74) {
                    setCompletionPhase("final-number");
                    return;
                }
            }
        }

        setAutoRunning(true);
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

        setAutoRunning(false);
        setAutoHasStarted(false);
        setCompletionPhase("idle");
        stopBingoAnnouncement();
        setCalledNumbers([]);
    }

    function handleToggleVoice() {
        if (voiceEnabled) {
            stopBingoAnnouncement();
        }

        setVoiceEnabled(!voiceEnabled);
    }

    function handlePrintCards() {
        if (calledNumbers.length !== 0 || autoRunning) {
            return;
        }

        setShowCardPrinter(true);
    }

    const automaticButtonText = autoRunning
        ? "Pause Auto"
        : autoHasStarted
            ? "Resume Auto"
            : "Start Auto";


    return (
        <main className="bingo-app">
            {showActiveCards ? (
                <ActiveCards
                    activeIds={activeCardIds}
                    onSave={setActiveCardIds}
                    onBack={() => setShowActiveCards(false)}
                />
            ) : showCardPrinter ? (
                <PrintableCards
                    onBack={() => setShowCardPrinter(false)}
                />
            ) : (
                <>
                    <header className="bingo-header">
                        <h1>54321-BINGO!</h1>
                        <p>Turn Your TV Into a Bingo Hall!</p>

                        {calledNumbers.length === 0 && (
                            <div className="bingo-header-actions">
                            <button
                                type="button"
                                className="print-cards-button"
                                onClick={handlePrintCards}
                            >
                                Print Bingo Cards
                            </button>
                            <button type="button" className="register-cards-button"
                                onClick={() => setShowActiveCards(true)}>
                                Register Active Cards
                            </button>
                            </div>
                        )}
                    </header>

                    <p className="bingo-active-status" role="status">
                        Active cards registered: <strong>{activeCardIds.length}</strong>
                        {calledNumbers.length > 0 ? " (registration locked during this game)" : ""}
                    </p>
                    <section className="current-call-panel">
                        <h2>Current Number</h2>

                        <div className="current-call-number">
                            {completionPhase === "message"
                                ? "GAME COMPLETE!"
                                : currentCall
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
                            disabled={isGameComplete || autoRunning}
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

                        <button
                            type="button"
                            className="voice-button"
                            onClick={handleToggleVoice}
                            disabled={!voiceSupported}
                            aria-pressed={voiceEnabled}
                        >
                            {voiceSupported
                                ? `Voice: ${voiceEnabled ? "On" : "Off"}`
                                : "Voice Unavailable"}
                        </button>

                        <label className="bingo-interval-label">
                            Every
                            <select
                                value={intervalSeconds}
                                onChange={event =>
                                    setIntervalSeconds(
                                        Number(event.target.value)
                                    )
                                }
                                aria-label="Automatic calling interval"
                            >
                                <option value={5}>5 sec</option>
                                <option value={10}>10 sec</option>
                                <option value={15}>15 sec</option>
                                <option value={20}>20 sec</option>
                            </select>
                        </label>

                        <button
                            type="button"
                            className="auto-button"
                            onClick={handleAutomaticToggle}
                            disabled={isGameComplete}
                            aria-pressed={autoRunning}
                        >
                            {automaticButtonText}
                        </button>
                    </section>

                    <section aria-label="Bingo number board">
                        <BingoBoard calledNumbers={calledNumbers} />
                    </section>
                </>
            )}
        </main>
    );
}

export default App;