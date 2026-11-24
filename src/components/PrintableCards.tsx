import { useState } from "react";
import { generateBingoCards } from "../services/bingoCardService";
import { saveBingoCards } from "../services/bingoCardStorage";
import type {
    BingoCard,
    BingoLetter
} from "../types/bingoTypes";

interface PrintableCardsProps {
    onBack: () => void;
}

const LETTERS: BingoLetter[] = ["B", "I", "N", "G", "O"];

function BingoCardView({ card }: { card: BingoCard }) {
    return (
        <div className="printable-bingo-card">
            <div className="printable-card-title">
                54321-BINGO!
            </div>

            <div className="printable-card-grid">
                {LETTERS.map(letter => (
                    <div
                        key={letter}
                        className="printable-card-letter"
                    >
                        {letter}
                    </div>
                ))}

                {Array.from({ length: 5 }, (_, row) =>
                    LETTERS.map(letter => {
                        const number = card.columns[letter][row];

                        return (
                            <div
                                key={`${letter}-${row}`}
                                className={
                                    number === null
                                        ? "printable-card-cell free"
                                        : "printable-card-cell"
                                }
                            >
                                {number === null ? "FREE" : number}
                            </div>
                        );
                    })
                )}
            </div>

            <div className="printable-card-id">
                Card ID: {card.id}
            </div>
        </div>
    );
}

export default function PrintableCards({
    onBack
}: PrintableCardsProps) {
    const [cardCount, setCardCount] = useState(10);
    const [cards, setCards] = useState<BingoCard[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [storageMessage, setStorageMessage] = useState("");
    const [storageError, setStorageError] = useState("");

    const pages: BingoCard[][] = [];

    for (let i = 0; i < cards.length; i += 2) {
        pages.push(cards.slice(i, i + 2));
    }

    async function handleGenerate() {
        if (isSaving) {
            return;
        }

        setIsSaving(true);
        setStorageMessage("");
        setStorageError("");

        try {
            const generatedCards = generateBingoCards(cardCount);
            await saveBingoCards(generatedCards);
            setCards(generatedCards);
            setStorageMessage(
                `${generatedCards.length} new cards saved to this browser's card library.`
            );
        } catch (error) {
            setStorageError(
                error instanceof Error
                    ? `Cards could not be saved: ${error.message}`
                    : "Cards could not be saved. Check your browser storage settings."
            );
        } finally {
            setIsSaving(false);
        }
    }

    return (
        <section className="bingo-print-view">
            <div className="bingo-print-toolbar">
                <h2>Print Bingo Cards</h2>

                <p>
                    Generate randomized Bingo cards.
                    Two cards print per US letter-size sheet.
                </p>

                <div className="bingo-print-actions">
                    <label htmlFor="bingo-card-count">
                        Number of cards
                    </label>

                    <input
                        id="bingo-card-count"
                        type="number"
                        min={1}
                        max={100}
                        value={cardCount}
                        onChange={event =>
                            setCardCount(
                                Math.min(
                                    100,
                                    Math.max(
                                        1,
                                        Number(event.target.value) || 1
                                    )
                                )
                            )
                        }
                    />

                    <button
                        type="button"
                        onClick={() => void handleGenerate()}
                        disabled={isSaving}
                    >
                        {isSaving ? "Saving Cards..." : "Generate Cards"}
                    </button>

                    <button
                        type="button"
                        onClick={() => window.print()}
                        disabled={cards.length === 0 || isSaving}
                    >
                        Print Cards
                    </button>

                    <button
                        type="button"
                        onClick={onBack}
                        disabled={isSaving}
                        className="print-back-button"
                    >
                        Back to Game
                    </button>
                </div>

                {storageMessage && (
                    <p role="status" className="print-card-count">
                        {storageMessage}
                    </p>
                )}

                {storageError && (
                    <p role="alert" style={{ color: "#b91c1c", fontWeight: 600 }}>
                        {storageError}
                    </p>
                )}

                {cards.length > 0 && (
                    <p className="print-card-count">
                        {cards.length} cards generated across{" "}
                        {pages.length} sheet(s).
                    </p>
                )}
            </div>

            <div className="bingo-print-pages">
                {pages.map((page, pageIndex) => (
                    <div
                        className="bingo-print-page"
                        key={pageIndex}
                    >
                        {page.map(card => (
                            <div
                                className="bingo-print-slot"
                                key={card.id}
                            >
                                <BingoCardView card={card} />
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        </section>
    );
}