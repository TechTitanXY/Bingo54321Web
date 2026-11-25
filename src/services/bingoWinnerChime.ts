const BELL_AUDIO_URL =
    `${import.meta.env.BASE_URL}audio/Winner_Dings_for_54321-Bingo.mp3`;

let winnerAudio: HTMLAudioElement | null = null;

function getWinnerAudio(): HTMLAudioElement | null {
    if (typeof window === "undefined") {
        return null;
    }

    if (!winnerAudio) {
        winnerAudio = new Audio(BELL_AUDIO_URL);
        winnerAudio.preload = "auto";
        winnerAudio.volume = 1.0;
    }

    return winnerAudio;
}

export function unlockWinnerChime(): void {
    try {
        const audio = getWinnerAudio();
        audio?.load();
    } catch {
        // Audio is optional and must not interfere with gameplay.
    }
}

export function stopWinnerChime(): void {
    try {
        if (!winnerAudio) {
            return;
        }

        winnerAudio.pause();
        winnerAudio.currentTime = 0;
    } catch {
        // Stopping the bell must not interfere with gameplay.
    }
}

export function playWinnerChime(): void {
    try {
        const audio = getWinnerAudio();

        if (!audio) {
            return;
        }

        stopWinnerChime();

        void audio.play().catch(() => {
            // Browser audio restrictions must not interrupt gameplay.
        });
    } catch {
        // Winner detection continues even if audio playback fails.
    }
}