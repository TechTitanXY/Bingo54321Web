import { useEffect, useState } from "react";
import { getSavedBingoCards } from "../services/bingoCardStorage";
import type { SavedBingoCard } from "../services/bingoCardStorage";

interface ActiveCardsProps {
    activeIds: string[];
    onSave: (ids: string[]) => void;
    onBack: () => void;
}

// Card IDs are sequential from A001 to Z999, with no zero-number IDs.
function cardSequence(id: string): number | null {
    if (!/^[A-Z](?:00[1-9]|0[1-9]\d|[1-9]\d{2})$/.test(id)) return null;
    return (id.charCodeAt(0) - 65) * 999 + Number(id.slice(1));
}

export default function ActiveCards({ activeIds, onSave, onBack }: ActiveCardsProps) {
    const [library, setLibrary] = useState<SavedBingoCard[]>([]);
    const [selectedIds, setSelectedIds] = useState<string[]>(activeIds);
    const [search, setSearch] = useState("");
    const [rangeStart, setRangeStart] = useState("");
    const [rangeEnd, setRangeEnd] = useState("");
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let canceled = false;
        getSavedBingoCards()
            .then(cards => {
                if (canceled) return;
                setLibrary(cards.sort((a, b) => a.id.localeCompare(b.id)));
            })
            .catch(reason => {
                if (!canceled) setError(reason instanceof Error ? reason.message : "Could not load saved cards.");
            })
            .finally(() => {
                if (!canceled) setLoading(false);
            });
        return () => { canceled = true; };
    }, []);

    const validIds = new Set(library.map(card => card.id));
    const selectedSet = new Set(selectedIds.filter(id => validIds.has(id)));
    const filteredCards = library.filter(card => card.id.toLowerCase().includes(search.trim().toLowerCase()));
    const activeCount = activeIds.filter(id => validIds.has(id)).length;
    const dirty = selectedSet.size !== activeCount ||
        activeIds.some(id => validIds.has(id) && !selectedSet.has(id));

    function toggle(id: string) {
        setMessage("");
        setSelectedIds(previous => previous.includes(id)
            ? previous.filter(item => item !== id)
            : [...previous, id]);
    }

    function selectResults() {
        setSelectedIds(previous => [...new Set([...previous, ...filteredCards.map(card => card.id)])]);
        setMessage("");
    }

    function addRange() {
        const first = cardSequence(rangeStart.trim().toUpperCase());
        const last = cardSequence(rangeEnd.trim().toUpperCase());
        if (first === null || last === null || first > last) {
            setError("Enter a valid ascending range, such as A001 through A025.");
            return;
        }
        const inRange = library.filter(card => {
            const sequence = cardSequence(card.id);
            return sequence !== null && sequence >= first && sequence <= last;
        });
        setSelectedIds(previous => [...new Set([...previous, ...inRange.map(card => card.id)])]);
        setError("");
        setMessage(`${inRange.length} saved card(s) found within the range. Review and save registration.`);
    }

    function save() {
        const sortedIds = library.filter(card => selectedSet.has(card.id)).map(card => card.id);
        onSave(sortedIds);
        onBack();
    }

    function clear() {
        if (!window.confirm("Clear all active-card registrations for the current game? Saved and printed cards will NOT be deleted.")) return;
        setSelectedIds([]);
        setError("");
        setMessage("Registration cleared in the editor. Click Save Registration to apply.");
    }

    function goBack() {
        if (dirty && !window.confirm("Discard unsaved registration changes?")) return;
        onBack();
    }

    return (
        <section className="bingo-active-view">
            <h2>Register Active Bingo Cards</h2>
            <p>Choose which permanent saved cards are participating in this game. Printing cards does not register them.</p>
            <p className="bingo-active-count"><strong>{selectedSet.size} selected</strong> · {library.length} saved cards</p>
            <div className="bingo-active-actions">
                <label htmlFor="active-search">Find Card ID</label>
                <input id="active-search" type="search" value={search}
                    onChange={event => setSearch(event.target.value)} placeholder="Search Card ID" />
                <button type="button" onClick={selectResults} disabled={loading || filteredCards.length === 0}>Select Results</button>
                <button type="button" onClick={() => setSelectedIds([])} disabled={selectedSet.size === 0}>Clear Selection</button>
            </div>
            <div className="bingo-active-actions">
                <label htmlFor="active-range-start">Card ID range</label>
                <input id="active-range-start" className="bingo-active-range" value={rangeStart} maxLength={4}
                    onChange={event => setRangeStart(event.target.value.toUpperCase())} placeholder="A001" />
                <span>through</span>
                <input aria-label="Ending Card ID" className="bingo-active-range" value={rangeEnd} maxLength={4}
                    onChange={event => setRangeEnd(event.target.value.toUpperCase())} placeholder="A025" />
                <button type="button" onClick={addRange} disabled={loading}>Select Range</button>
            </div>
            {error && <p role="alert" className="bingo-storage-error">{error}</p>}
            {message && <p role="status">{message}</p>}
            <div className="bingo-library-list" aria-label="Cards available for registration">
                {loading ? <p>Loading saved cards...</p> : filteredCards.length === 0
                    ? <p>{library.length === 0 ? "No saved cards. Generate and save cards before registering them." : "No matching Card IDs."}</p>
                    : filteredCards.map(card => (
                        <div className="bingo-library-card-row" key={card.id}>
                            <label>
                                <input type="checkbox" checked={selectedSet.has(card.id)} onChange={() => toggle(card.id)} />
                                <span className="bingo-library-card-id">{card.id}</span>
                            </label>
                            <span className="bingo-library-date">{new Date(card.createdAt).toLocaleDateString()}</span>
                        </div>
                    ))}
            </div>
            <div className="bingo-active-actions">
                <button type="button" className="bingo-active-save" onClick={save} disabled={loading}>
                    Save Registration ({selectedSet.size})
                </button>
                <button type="button" onClick={clear} disabled={selectedSet.size === 0}>Clear Registration</button>
                <button type="button" onClick={goBack}>Back to Game</button>
            </div>
        </section>
    );
}
