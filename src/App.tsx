import { useCallback, useEffect, useMemo, useState } from "react";
import BingoBoard from "./components/BingoBoard";
import { callNextNumber } from "./services/bingoService";
import type { BingoCall } from "./types/bingoTypes";
import type { SavedBingoCard } from "./services/bingoCardStorage";
import { getSavedBingoCards } from "./services/bingoCardStorage";
import { findBingoWinners } from "./services/bingoWinnerService";
import BingoWinners from "./components/BingoWinners";
import { playWinnerChime, stopWinnerChime, unlockWinnerChime } from "./services/bingoWinnerChime";
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
const WINNER_BELL_KEY = "54321-bingo-winner-bell-enabled";

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

function loadWinnerBellPreference(): boolean {
    try {
        return localStorage.getItem(WINNER_BELL_KEY) !== "false";
    } catch {
        return true;
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
    const [cardLibrary, setCardLibrary] = useState<SavedBingoCard[]>([]);
    const [libraryLoading, setLibraryLoading] = useState(true);
    const [libraryError, setLibraryError] = useState("");
    const [winnerNotice, setWinnerNotice] = useState("");
    const [celebratingIds, setCelebratingIds] = useState<string[]>([]);
    const [winnerBellEnabled, setWinnerBellEnabled] = useState(loadWinnerBellPreference);

    useEffect(() => {
        try {
            localStorage.setItem(WINNER_BELL_KEY, String(winnerBellEnabled));
        } catch {
            // A bell preference can still work for the current page without storage.
        }
    }, [winnerBellEnabled]);

    const reloadCardLibrary = useCallback(async () => {
        try {
            const saved = await getSavedBingoCards();

            setCardLibrary(saved);
            setLibraryError("");
        } catch (error) {
            setLibraryError(
                error instanceof Error
                    ? error.message
                    : "Could not load saved Bingo cards."
            );
        } finally {
            setLibraryLoading(false);
        }
    }, []);

    useEffect(() => {
        let canceled = false;

        getSavedBingoCards()
            .then(saved => {
                if (canceled) return;

                setCardLibrary(saved);
                setLibraryError("");
            })
            .catch(error => {
                if (canceled) return;

                setLibraryError(
                    error instanceof Error
                        ? error.message
                        : "Could not load saved Bingo cards."
                );
            })
            .finally(() => {
                if (!canceled) {
                    setLibraryLoading(false);
                }
            });

        return () => {
            canceled = true;
        };
    }, []);

    const registeredCards = useMemo(() => {
        const active = new Set(activeCardIds);
        return cardLibrary.filter(card => active.has(card.id));
    }, [activeCardIds, cardLibrary]);
    const missingRegistration = registeredCards.length !== activeCardIds.length;
    // Don't call when a registration cannot be checked: it could hide a legitimate winner.
    const cardsUnavailable = activeCardIds.length > 0 &&
        (libraryLoading || Boolean(libraryError) || missingRegistration);
    const winners = useMemo(
        () => findBingoWinners(registeredCards, calledNumbers),
        [registeredCards, calledNumbers]
    );

    useEffect(() => {
        try {
            localStorage.setItem(ACTIVE_CARDS_STORAGE_KEY, JSON.stringify(activeCardIds));
        } catch {
            // Keep registration active in memory when local storage is unavailable.
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

    // A game also ends when every registered card has already won.
    // Keep registrations intact so New Game can use the same cards again.
    const allRegisteredCardsWon = activeCardIds.length > 0 &&
        !cardsUnavailable && winners.length === registeredCards.length;
    const isGameComplete = calledNumbers.length === 75 || allRegisteredCardsWon;

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


    // Check for newly completed lines synchronously with every manual/auto call.
    // The automatic timer is canceled immediately when any new card wins.
    const applyCall = useCallback((nextCall: BingoCall): boolean => {
        const existingWinners = new Set(
            findBingoWinners(registeredCards, calledNumbers).map(winner => winner.cardId)
        );
        const newlyWinning = findBingoWinners(registeredCards, [...calledNumbers, nextCall])
            .filter(winner => !existingWinners.has(winner.cardId));

        setCalledNumbers(previous => [...previous, nextCall]);
        if (voiceEnabled) announceBingoCall(nextCall);

        if (calledNumbers.length === 74) {
            setCompletionPhase("final-number");
            setAutoRunning(false);
        }
        if (newlyWinning.length > 0) {
            setCelebratingIds(newlyWinning.map(winner => winner.cardId));
            if (winnerBellEnabled) playWinnerChime();
            setWinnerNotice(`BINGO! ${newlyWinning.map(winner => winner.cardId).join(", ")}`);
            setAutoRunning(false);
            return true;
        }
        return false;
    }, [registeredCards, calledNumbers, voiceEnabled, winnerBellEnabled]);

    // Schedule one automatic call at a time.
    // A change to the game or interval resets the timer.
    useEffect(() => {
        if (!autoRunning || isGameComplete || cardsUnavailable) {
            return;
        }

        const timerId = window.setTimeout(() => {
            const nextCall = callNextNumber(calledNumbers);

            if (nextCall === null) {
                setAutoRunning(false);
                return;
            }

            applyCall(nextCall);
        }, intervalSeconds * 1000);

        return () => {
            window.clearTimeout(timerId);
        };
    }, [
        autoRunning,
        calledNumbers,
        intervalSeconds,
        isGameComplete,
        cardsUnavailable,
        applyCall
    ]);

    function handleNextNumber() {
        if (autoRunning || isGameComplete || cardsUnavailable) {
            return;
        }

        unlockWinnerChime();
        stopWinnerChime();
        setCelebratingIds([]);
        setWinnerNotice("");
        const nextCall = callNextNumber(calledNumbers);

        if (nextCall !== null) applyCall(nextCall);
    }

    function handleAutomaticToggle() {
        if (autoRunning) {
            setAutoRunning(false);
            return;
        }

        if (isGameComplete || cardsUnavailable) {
            return;
        }

        unlockWinnerChime();
        stopWinnerChime();
        setCelebratingIds([]);
        setWinnerNotice("");
        if (!autoHasStarted) {
            setAutoHasStarted(true);

            // Make the first automatic call immediately.
            const nextCall = callNextNumber(calledNumbers);

            if (nextCall !== null) {
                const won = applyCall(nextCall);
                if (won || calledNumbers.length === 74) return;
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
        stopWinnerChime();
        setCalledNumbers([]);
        setWinnerNotice("");
        setCelebratingIds([]);
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
                    onSave={ids => {
                        setActiveCardIds(ids);
                        void reloadCardLibrary();
                    }}
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
                            {calledNumbers.length === 75
                                ? "All 75 numbers have been called!"
                                : `${calledNumbers.length} of 75 numbers called`}
                        </p>
                    </section>

                    {libraryError && activeCardIds.length > 0 && (
                        <p className="bingo-storage-error" role="alert">Winner detection unavailable: {libraryError}</p>
                    )}
                    {!libraryLoading && !libraryError && missingRegistration && (
                        <p className="bingo-storage-error" role="alert">
                            Some registered cards are missing from this browser's library. Restore them before calling numbers.
                        </p>
                    )}
                    {winnerNotice && calledNumbers.length > 0 && (
                        <p className="bingo-winner-notice" role="status">{winnerNotice}</p>
                    )}
                    {allRegisteredCardsWon && (
                        <p className="bingo-game-complete-notice" role="status">
                            All registered cards have won! Game complete.
                        </p>
                    )}
                    <section className="bingo-controls">
                        <button
                            type="button"
                            onClick={handleNextNumber}
                            disabled={isGameComplete || autoRunning || cardsUnavailable}
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
                            className="bingo-bell-button"
                            onClick={() => {
                                unlockWinnerChime();
                                if (winnerBellEnabled) stopWinnerChime();
                                setWinnerBellEnabled(enabled => !enabled);
                            }}
                            aria-pressed={winnerBellEnabled}
                        >
                            Bell: {winnerBellEnabled ? "On" : "Off"}
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
                            disabled={isGameComplete || cardsUnavailable}
                            aria-pressed={autoRunning}
                        >
                            {automaticButtonText}
                        </button>
                    </section>

                    <section className="bingo-game-layout" aria-label="Bingo board and winners">
                        <div className="bingo-board-container">
                            <BingoBoard calledNumbers={calledNumbers} />
                        </div>
                        <BingoWinners
                            winners={winners}
                            celebratingIds={celebratingIds}
                            registeredCount={activeCardIds.length}
                        />
                    </section>
                </>
            )}
        </main>
    );
}

export default App;