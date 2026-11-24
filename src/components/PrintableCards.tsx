import { useEffect, useState } from "react";
import { generateBingoCards } from "../services/bingoCardService";
import {
    getSavedBingoCards,
    saveBingoCards
} from "../services/bingoCardStorage";
import type { SavedBingoCard } from "../services/bingoCardStorage";
import type { BingoCard, BingoLetter } from "../types/bingoTypes";

interface PrintableCardsProps {
    onBack: () => void;
}

const LETTERS: BingoLetter[] = ["B", "I", "N", "G", "O"];
type View = "generate" | "saved" | "preview";

function BingoCardView({ card }: { card: BingoCard }) {
    return (
        <div className="printable-bingo-card">
            <div className="printable-card-title">54321-BINGO!</div>
            <div className="printable-card-grid">
                {LETTERS.map(letter => (
                    <div key={letter} className="printable-card-letter">{letter}</div>
                ))}
                {Array.from({ length: 5 }, (_, row) =>
                    LETTERS.map(letter => {
                        const number = card.columns[letter][row];
                        return (
                            <div
                                key={`${letter}-${row}`}
                                className={number === null
                                    ? "printable-card-cell free"
                                    : "printable-card-cell"}
                            >
                                {number === null ? "FREE" : number}
                            </div>
                        );
                    })
                )}
            </div>
            <div className="printable-card-id">Card ID: {card.id}</div>
        </div>
    );
}

export default function PrintableCards({ onBack }: PrintableCardsProps) {
    const [view, setView] = useState<View>("generate");
    const [cardCount, setCardCount] = useState(10);
    const [cards, setCards] = useState<BingoCard[]>([]);
    const [savedCards, setSavedCards] = useState<SavedBingoCard[]>([]);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [search, setSearch] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [storageMessage, setStorageMessage] = useState("");
    const [storageError, setStorageError] = useState("");

    async function reloadLibrary() {
        const loaded = await getSavedBingoCards();
        // Newest first; the ID breaks ties from a single generated batch.
        loaded.sort((a, b) => a.id.localeCompare(b.id));
        setSavedCards(loaded);
    }

    useEffect(() => {
        let canceled = false;
        getSavedBingoCards()
            .then(loaded => {
                if (canceled) return;
                loaded.sort((a, b) => a.id.localeCompare(b.id));
                setSavedCards(loaded);
            })
            .catch(error => {
                if (!canceled) {
                    setStorageError(error instanceof Error ? error.message : "Could not open saved cards.");
                }
            })
            .finally(() => {
                if (!canceled) setIsLoading(false);
            });
        return () => { canceled = true; };
    }, []);

    const filteredCards = savedCards.filter(card =>
        card.id.toLowerCase().includes(search.trim().toLowerCase())
    );
    const selectedSet = new Set(selectedIds);
    const selectedCards = savedCards.filter(card => selectedSet.has(card.id));
    const pages: BingoCard[][] = [];
    for (let i = 0; i < cards.length; i += 2) {
        pages.push(cards.slice(i, i + 2));
    }

    async function handleGenerate() {
        if (isSaving) return;
        setIsSaving(true);
        setStorageMessage("");
        setStorageError("");
        try {
            const generatedCards = generateBingoCards(cardCount);
            const saved = await saveBingoCards(generatedCards);
            await reloadLibrary();
            setCards(saved);
            setView("preview");
            setStorageMessage(`${generatedCards.length} new cards saved to this browser's card library.`);
        } catch (error) {
            setStorageError(error instanceof Error
                ? `Cards could not be saved: ${error.message}`
                : "Cards could not be saved. Check your browser storage settings.");
        } finally {
            setIsSaving(false);
        }
    }

    function openPreview(previewCards: BingoCard[]) {
        if (previewCards.length === 0) return;
        setCards(previewCards);
        setStorageMessage("");
        setStorageError("");
        setView("preview");
    }

    function toggleSelection(id: string) {
        setSelectedIds(previous => previous.includes(id)
            ? previous.filter(value => value !== id)
            : [...previous, id]);
    }

    function showSavedCards() {
        setStorageMessage("");
        setStorageError("");
        setView("saved");
    }

    return (
        <section className="bingo-print-view">
            <div className="bingo-print-toolbar">
                <h2>{view === "saved" ? "Saved Bingo Cards" : view === "preview" ? "Bingo Card Preview" : "Print Bingo Cards"}</h2>

                <div className="bingo-library-navigation">
                    <button type="button" onClick={() => setView("generate")} disabled={isSaving}>
                        Generate New Cards
                    </button>
                    <button type="button" onClick={showSavedCards} disabled={isSaving}>
                        Saved Cards ({savedCards.length})
                    </button>
                    <button type="button" onClick={onBack} disabled={isSaving} className="print-back-button">
                        Back to Game
                    </button>
                </div>

                {view === "generate" && (
                    <>
                        <p>Generate randomized Bingo cards. Two cards print per US letter-size sheet.</p>
                        <div className="bingo-print-actions">
                            <label htmlFor="bingo-card-count">Number of cards</label>
                            <input
                                id="bingo-card-count"
                                type="number"
                                min={1}
                                max={100}
                                value={cardCount}
                                onChange={event => setCardCount(Math.min(100, Math.max(1, Number(event.target.value) || 1)))}
                            />
                            <button type="button" onClick={() => void handleGenerate()} disabled={isSaving || isLoading}>
                                {isSaving ? "Saving Cards..." : "Generate Cards"}
                            </button>
                        </div>
                    </>
                )}

                {view === "saved" && (
                    <>
                        <p>{isLoading ? "Loading saved cards..." : `${savedCards.length} saved card(s) in this browser.`}</p>
                        <div className="bingo-library-actions">
                            <label htmlFor="bingo-card-search">Find Card ID</label>
                            <input
                                id="bingo-card-search"
                                type="search"
                                value={search}
                                onChange={event => setSearch(event.target.value)}
                                placeholder="Search Card ID"
                            />
                            <button type="button" onClick={() => setSelectedIds(filteredCards.map(card => card.id))}
                                disabled={filteredCards.length === 0}>Select Results</button>
                            <button type="button" onClick={() => setSelectedIds([])}
                                disabled={selectedIds.length === 0}>Clear Selection</button>
                            <button type="button" onClick={() => openPreview(selectedCards)}
                                disabled={selectedCards.length === 0}>Print Selected ({selectedCards.length})</button>
                        </div>
                        <div className="bingo-library-list" aria-label="Saved Bingo cards">
                            {filteredCards.map(card => (
                                <div className="bingo-library-card-row" key={card.id}>
                                    <label>
                                        <input type="checkbox" checked={selectedSet.has(card.id)}
                                            onChange={() => toggleSelection(card.id)} />
                                        <span className="bingo-library-card-id">{card.id}</span>
                                    </label>
                                    <span className="bingo-library-date">{new Date(card.createdAt).toLocaleDateString()}</span>
                                    <button type="button" onClick={() => openPreview([card])}>Print</button>
                                </div>
                            ))}
                            {!isLoading && filteredCards.length === 0 && (
                                <p>{savedCards.length === 0 ? "No cards saved yet. Generate a batch to get started." : "No matching Card IDs."}</p>
                            )}
                        </div>
                    </>
                )}

                {view === "preview" && (
                    <>
                        <p>{cards.length} card(s) ready across {pages.length} letter-size sheet(s).</p>
                        <div className="bingo-print-actions">
                            <button type="button" onClick={() => window.print()} disabled={cards.length === 0}>
                                Print Cards
                            </button>
                            <button type="button" onClick={showSavedCards}>Back to Saved Cards</button>
                        </div>
                    </>
                )}

                {storageMessage && <p role="status" className="print-card-count">{storageMessage}</p>}
                {storageError && <p role="alert" className="bingo-storage-error">{storageError}</p>}
            </div>

            {view === "preview" && (
                <div className="bingo-print-pages">
                    {pages.map((page, pageIndex) => (
                        <div className="bingo-print-page" key={pageIndex}>
                            {page.map(card => (
                                <div className="bingo-print-slot" key={card.id}>
                                    <BingoCardView card={card} />
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}
