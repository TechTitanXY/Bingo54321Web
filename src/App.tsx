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

const STORAGE_KEY = "54321-bingo-called-numbers";

const VOICE_STORAGE_KEY = "54321-bingo-voice-enabled";

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

    const automaticButtonText = autoRunning
        ? "Pause Auto"
        : autoHasStarted
            ? "Resume Auto"
            : "Start Auto";

    return (
        <main className="bingo-app">
            <header className="bingo-header">
                <h1>54321-BINGO!</h1>
                <p>Turn Your TV Into a Bingo Hall!</p>
            </header>

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
        </main>
    );
}

export default App;