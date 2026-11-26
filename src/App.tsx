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
import AboutBingo from "./components/AboutBingo";

const STORAGE_KEY = "54321-bingo-called-numbers";
const VOICE_STORAGE_KEY = "54321-bingo-voice-enabled";
const ACTIVE_CARDS_STORAGE_KEY = "54321-bingo-active-card-ids";
const WINNER_BELL_KEY = "54321-bingo-winner-bell-enabled";
const WINNER_LIMIT_ENABLED_KEY = "54321-bingo-winner-limit-enabled";
const WINNER_LIMIT_COUNT_KEY = "54321-bingo-winner-limit-count";
const MAX_CARD_COUNT = 25974;

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

function loadWinnerLimitEnabled(): boolean {
    try {
        return localStorage.getItem(WINNER_LIMIT_ENABLED_KEY) === "true";
    } catch {
        return false;
    }
}

function loadWinnerLimitCount(): number {
    try {
        const value = localStorage.getItem(WINNER_LIMIT_COUNT_KEY);
        if (value !== null) {
            const count = Number(value);
            if (Number.isSafeInteger(count) && count >= 1 && count <= MAX_CARD_COUNT) {
                return count;
            }
        }
    } catch {
        // The default is still usable without local storage.
    }
    return 5;
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

// Browser history tracks Bingo screens without changing the hosting path.
// Keeping routing in the hash also works when Vite is hosted in a subdirectory.
type BingoPage =
    | "game" | "options" | "about-game" | "about-options"
    | "cards-generate" | "cards-saved" | "cards-preview" | "register";

type BingoHistoryEntry = {
    bingo54321: true;
    page: BingoPage;
    trail: BingoPage[];
};

const ROUTE_HASH: Record<BingoPage, string> = {
    game: "", options: "options", "about-game": "how-to-play",
    "about-options": "options/how-to-play", "cards-generate": "options/cards",
    "cards-saved": "options/cards/saved", "cards-preview": "options/cards/preview",
    register: "options/register"
};

function isBingoPage(value: unknown): value is BingoPage {
    return typeof value === "string" && Object.hasOwn(ROUTE_HASH, value);
}

function currentBingoHistory(): BingoHistoryEntry | null {
    const value: unknown = window.history.state;
    if (!value || typeof value !== "object" || !("bingo54321" in value) ||
        value.bingo54321 !== true || !("page" in value) ||
        !isBingoPage(value.page) || !("trail" in value) ||
        !Array.isArray(value.trail) || value.trail.length === 0 || !value.trail.every(isBingoPage)) {
        return null;
    }
    return value as BingoHistoryEntry;
}

function pageFromLocation(): BingoPage {
    const hash = decodeURIComponent(window.location.hash.slice(1));
    return (Object.keys(ROUTE_HASH) as BingoPage[])
        .find(page => ROUTE_HASH[page] === hash) ?? "game";
}

function pageUrl(page: BingoPage): string {
    const { pathname, search } = window.location;
    return `${pathname}${search}${ROUTE_HASH[page] ? `#${ROUTE_HASH[page]}` : ""}`;
}

function App() {
    const [calledNumbers, setCalledNumbers] =
        useState<BingoCall[]>(loadSavedNumbers);
    const [page, setPage] = useState<BingoPage>(pageFromLocation);
    const isCardPage = page.startsWith("cards-");
    const isGamePage = page === "game";
    const [activeCardIds, setActiveCardIds] = useState<string[]>(loadActiveCardIds);
    const [cardLibrary, setCardLibrary] = useState<SavedBingoCard[]>([]);
    const [libraryLoading, setLibraryLoading] = useState(true);
    const [libraryError, setLibraryError] = useState("");
    const [winnerNotice, setWinnerNotice] = useState("");
    const [celebratingIds, setCelebratingIds] = useState<string[]>([]);
    const [winnerBellEnabled, setWinnerBellEnabled] = useState(loadWinnerBellPreference);
    const [winnerLimitEnabled, setWinnerLimitEnabled] = useState(loadWinnerLimitEnabled);
    const [winnerLimitCount, setWinnerLimitCount] = useState(loadWinnerLimitCount);

    useEffect(() => {
        try {
            localStorage.setItem(WINNER_BELL_KEY, String(winnerBellEnabled));
        } catch {
            // A bell preference can still work for the current page without storage.
        }
    }, [winnerBellEnabled]);

    useEffect(() => {
        try {
            localStorage.setItem(WINNER_LIMIT_ENABLED_KEY, String(winnerLimitEnabled));
            localStorage.setItem(WINNER_LIMIT_COUNT_KEY, String(winnerLimitCount));
        } catch {
            // The settings still work for the current page without storage.
        }
    }, [winnerLimitEnabled, winnerLimitCount]);

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
    // A simultaneous winning call may legitimately exceed the chosen limit.
    // Count distinct winning cards, not the number of completed Bingo lines.
    const winnerLimitReached = winnerLimitEnabled &&
        winners.length >= winnerLimitCount;
    const isGameComplete = calledNumbers.length === 75 ||
        allRegisteredCardsWon || winnerLimitReached;
    const effectiveWinnerLimit = Math.min(winnerLimitCount, activeCardIds.length);
    const remainingWinners = Math.max(0, effectiveWinnerLimit - winners.length);

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

    // Add one history entry per screen. Browser Back/Forward restores that screen.
    // A backward navigation through the app's own buttons reuses existing entries.
    function navigate(pageToOpen: BingoPage) {
        if (pageToOpen === page) return;
        const historyEntry = currentBingoHistory();
        const trail = historyEntry?.trail ?? [page];
        const nextEntry: BingoHistoryEntry = {
            bingo54321: true, page: pageToOpen, trail: [...trail, pageToOpen]
        };
        window.history.pushState(nextEntry, "", pageUrl(pageToOpen));
        setPage(pageToOpen);
        if (pageToOpen !== "game") {
            setAutoRunning(false);
            stopBingoAnnouncement();
        }
    }

    function navigateBackTo(destination: BingoPage) {
        const trail = currentBingoHistory()?.trail ?? [];
        const previousIndex = trail.lastIndexOf(destination, trail.length - 2);
        if (previousIndex >= 0) {
            window.history.go(previousIndex - (trail.length - 1));
        } else {
            // Direct links and refreshed pages may have no app navigation history.
            navigate(destination);
        }
    }

    useEffect(() => {
        const initialPage = pageFromLocation();
        if (!currentBingoHistory()) {
            window.history.replaceState(
                { bingo54321: true, page: initialPage, trail: [initialPage] } satisfies BingoHistoryEntry,
                "", pageUrl(initialPage)
            );
        }
    }, []);

    useEffect(() => {
        function onPopState() {
            const entry = currentBingoHistory();
            const requestedPage = entry?.page ?? pageFromLocation();
            // A history shortcut must not reopen pregame editors after calling starts.
            const nextPage = calledNumbers.length > 0 &&
                (requestedPage === "register" || requestedPage.startsWith("cards-"))
                ? "options" : requestedPage;
            if (nextPage !== requestedPage) {
                window.history.replaceState(
                    { bingo54321: true, page: nextPage,
                        trail: [...(entry?.trail.slice(0, -1) ?? []), nextPage] } satisfies BingoHistoryEntry,
                    "", pageUrl(nextPage)
                );
            }
            setPage(nextPage);
            // Never resume an automatic timer when returning via browser history.
            setAutoRunning(false);
            stopBingoAnnouncement();
        }
        window.addEventListener("popstate", onPopState);
        return () => window.removeEventListener("popstate", onPopState);
    }, [calledNumbers.length]);

    function handleOpenOptions() {
        // Avoid calling numbers while the host is reviewing the settings.
        if (autoRunning) {
            setAutoRunning(false);
            stopBingoAnnouncement();
        }
        navigate("options");
    }

    function handleOpenAbout(returnToOptions: boolean) {
        // The host should not miss a call while reading instructions.
        if (autoRunning) {
            setAutoRunning(false);
            stopBingoAnnouncement();
        }
        navigate(returnToOptions ? "about-options" : "about-game");
    }

    function handleCloseAbout() {
        navigateBackTo(page === "about-options" ? "options" : "game");
    }

    function handlePrintCards() {
        if (calledNumbers.length !== 0 || autoRunning) {
            return;
        }

        navigate("cards-generate");
    }

    const automaticButtonText = autoRunning
        ? "Pause Auto"
        : autoHasStarted
            ? "Resume Auto"
            : "Start Auto";


    return (
        <main className={`bingo-app${isGamePage ? " bingo-game-screen" : ""}`}>
            <nav className="bingo-site-nav" aria-label="Phil's Handy Apps navigation">
                <a href="https://philshandyapps.phillipgaley.com/" aria-label="Phil's Handy Apps Home">
                    <img src={`${import.meta.env.BASE_URL}pha-home-icon.png`} alt="" />
                    <span>Phil's Handy Apps</span>
                </a>
            </nav>
            {/* Stay mounted so Back/Forward preserves an unsaved card selection or preview. */}
            <div hidden={!isCardPage}>
                <PrintableCards
                    onBack={() => navigateBackTo("options")}
                    view={page === "cards-saved" ? "saved" : page === "cards-preview" ? "preview" : "generate"}
                    onViewChange={nextView => navigate(`cards-${nextView}`)}
                />
            </div>
            {page === "register" ? (
                <ActiveCards
                    activeIds={activeCardIds}
                    onSave={ids => {
                        setActiveCardIds(ids);
                        void reloadCardLibrary();
                    }}
                    onBack={() => navigateBackTo("options")}
                />
            ) : isCardPage ? null : page === "about-game" || page === "about-options" ? (
                <AboutBingo onBack={handleCloseAbout} backLabel={page === "about-options" ? "Back to Options" : "Return to Game"} />
            ) : page === "options" ? (
                <section className="bingo-options-view" aria-label="Bingo game options">
                    <header className="bingo-options-header">
                        <h1>54321-BINGO! — Options</h1>
                        <p>Set up your cards and winner limit before calling begins.</p>
                    </header>
                    <div className="bingo-options-actions">
                        <button type="button" className="bingo-help-button" onClick={() => handleOpenAbout(true)}>
                            About &amp; How to Play
                        </button>
                        <button
                            type="button"
                            className="print-cards-button"
                            onClick={handlePrintCards}
                            disabled={calledNumbers.length > 0}
                        >
                            Print Bingo Cards
                        </button>
                        <button
                            type="button"
                            className="register-cards-button"
                            onClick={() => navigate("register")}
                            disabled={calledNumbers.length > 0}
                        >
                            Register Active Cards
                        </button>
                    </div>
                    {calledNumbers.length > 0 && (
                        <p className="bingo-options-locked" role="status">
                            Pregame options are locked after the first number is called.
                            Return to Game to continue, or start a New Game to change them.
                        </p>
                    )}
                    <div className="bingo-options-card">
                        <h2>Winner Limit</h2>
                        <div className="bingo-winner-limit-settings" role="group" aria-label="Winner limit settings">
                            <label className="bingo-winner-limit-toggle">
                                <input
                                    type="checkbox"
                                    checked={winnerLimitEnabled}
                                    disabled={calledNumbers.length > 0}
                                    onChange={event => setWinnerLimitEnabled(event.target.checked)}
                                />
                                Limit the number of winners
                            </label>
                            <label className="bingo-winner-limit-count-label">
                                Maximum winners
                                <input
                                    type="number"
                                    min={1}
                                    max={MAX_CARD_COUNT}
                                    step={1}
                                    value={winnerLimitCount}
                                    disabled={!winnerLimitEnabled || calledNumbers.length > 0}
                                    onChange={event => {
                                        const next = Number(event.target.value);
                                        if (Number.isSafeInteger(next) && next >= 1 && next <= MAX_CARD_COUNT) {
                                            setWinnerLimitCount(next);
                                        }
                                    }}
                                />
                            </label>
                            {!winnerLimitEnabled && (
                                <span className="bingo-winner-limit-off">No winner limit</span>
                            )}
                        </div>
                    </div>
                    <p className="bingo-options-registered">Active Cards: <strong>{activeCardIds.length}</strong></p>
                    <button
                        type="button"
                        className="bingo-return-button"
                        onClick={() => navigateBackTo("game")}
                    >
                        Return to Game
                    </button>
                    <footer className="bingo-info-footer">
                        <nav aria-label="Information links">
                            <button type="button" onClick={() => handleOpenAbout(true)}>About &amp; How to Play</button>
                            <span aria-hidden="true">|</span>
                            <a href="https://phillipgaley.com/contact-us">Contact Us</a>
                            <span aria-hidden="true">|</span>
                            <a href="https://phillipgaley.com/privacy-policy">Privacy Policy</a>
                        </nav>
                    </footer>
                </section>
            ) : (
                <>
                    <header className="bingo-header">
                        <h1>54321-BINGO!</h1>
                        <p>Turn Your TV Into a Bingo Hall!</p>
                        <div className="bingo-game-header-actions">
                            <button type="button" className="bingo-options-button" onClick={handleOpenOptions}>
                                Options
                            </button>
                            <button type="button" className="bingo-options-button bingo-about-shortcut" onClick={() => handleOpenAbout(false)}>
                                How to Play
                            </button>
                        </div>
                    </header>
                    <p className="bingo-active-status" role="status">
                        <span>Active Cards: <strong>{activeCardIds.length}</strong></span>
                        {winnerLimitEnabled && (
                            <span>Remaining Winners: <strong>{remainingWinners} of {effectiveWinnerLimit}</strong></span>
                        )}
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
                    {allRegisteredCardsWon ? (
                        <p className="bingo-game-complete-notice" role="status">
                            All registered cards have won! Game complete.
                        </p>
                    ) : winnerLimitReached ? (
                        <p className="bingo-game-complete-notice" role="status">
                            Winner limit of {winnerLimitCount} reached!
                            {winners.length > winnerLimitCount &&
                                ` ${winners.length} cards won because of simultaneous Bingo wins.`}
                            {" "}Game complete.
                        </p>
                    ) : null}


                    <section className="bingo-game-layout" aria-label="Bingo board and host controls">
                        <div className="bingo-board-container">
                            <BingoBoard calledNumbers={calledNumbers} />
                        </div>
                        <div className="bingo-host-panel">
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
                            <BingoWinners
                                winners={winners}
                                celebratingIds={celebratingIds}
                                registeredCount={activeCardIds.length}
                            />
                        </div>
                    </section>
                </>
            )}
        </main>
    );
}

export default App;