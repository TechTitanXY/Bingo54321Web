import type { BingoCall } from "../types/bingoTypes";

export function isVoiceSupported(): boolean {
    return (
        typeof window !== "undefined" &&
        "speechSynthesis" in window &&
        "SpeechSynthesisUtterance" in window
    );
}

export function announceBingoCall(call: BingoCall): void {
    if (!isVoiceSupported()) {
        return;
    }

    try {
        window.speechSynthesis.cancel();

        const announcement = new SpeechSynthesisUtterance(
            `${call.letter}, ${call.number}`
        );

        announcement.lang = "en-US";
        announcement.rate = 0.85;
        announcement.pitch = 1;
        announcement.volume = 1;

        window.speechSynthesis.speak(announcement);
    } catch (error) {
        console.warn("Bingo voice announcement failed:", error);
    }
}

export function stopBingoAnnouncement(): void {
    if (isVoiceSupported()) {
        window.speechSynthesis.cancel();
    }
}