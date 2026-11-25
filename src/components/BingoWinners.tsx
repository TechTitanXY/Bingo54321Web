import type { BingoWinner } from "../types/bingoTypes";

interface BingoWinnersProps {
    winners: readonly BingoWinner[];
    celebratingIds: readonly string[];
    registeredCount: number;
}

export default function BingoWinners({ winners, celebratingIds, registeredCount }: BingoWinnersProps) {
    const celebrating = new Set(celebratingIds);
    return (
        <aside className="bingo-winners-panel" aria-label="Winning Bingo cards" aria-live="polite">
            <h2>🏆 Winners</h2>
            <p className="bingo-winners-count">{winners.length} winning card{winners.length === 1 ? "" : "s"}</p>
            {winners.length === 0 ? (
                <p className="bingo-winners-empty">
                    {registeredCount === 0 ? "Register cards to detect winners automatically." : "No winners yet."}
                </p>
            ) : (
                <ol className="bingo-winners-list">
                    {winners.map(winner => (
                        <li key={winner.cardId} className={celebrating.has(winner.cardId) ? "bingo-winner-celebrating" : ""}>
                            <strong>{winner.cardId}</strong>
                            <span>Won on {winner.winningCall}</span>
                        </li>
                    ))}
                </ol>
            )}
        </aside>
    );
}
