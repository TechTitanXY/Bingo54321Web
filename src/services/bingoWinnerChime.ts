// Five clear bell strikes over about three seconds, generated with Web Audio.
// Calling and winner detection remain available if audio is unavailable.
let audioContext: AudioContext | null = null;
const activeStrikes = new Set<OscillatorNode>();

export function unlockWinnerChime(): void {
    try {
        if (typeof window === "undefined") return;
        const Context = window.AudioContext;
        if (!Context) return;
        audioContext ??= new Context();
        if (audioContext.state === "suspended") {
            void audioContext.resume().catch(() => { /* Audio is optional. */ });
        }
    } catch {
        // Do not prevent gameplay when audio is unavailable.
    }
}

export function stopWinnerChime(): void {
    for (const oscillator of activeStrikes) {
        try {
            oscillator.stop();
        } catch {
            // A strike may already have finished.
        }
    }
    activeStrikes.clear();
}

export function playWinnerChime(): void {
    try {
        if (!audioContext || audioContext.state !== "running") return;
        stopWinnerChime();
        const context = audioContext;
        const now = context.currentTime;

        // Five evenly spaced strikes, with a short tail on the fifth.
        for (let index = 0; index < 5; index++) {
            const start = now + index * 0.55;
            const end = start + 0.53;
            const oscillator = context.createOscillator();
            const gain = context.createGain();

            oscillator.type = "sine";
            oscillator.frequency.setValueAtTime(880, start);
            oscillator.frequency.exponentialRampToValueAtTime(660, end);
            gain.gain.setValueAtTime(0.0001, start);
            gain.gain.exponentialRampToValueAtTime(0.28, start + 0.012);
            gain.gain.exponentialRampToValueAtTime(0.0001, end);

            oscillator.connect(gain);
            gain.connect(context.destination);
            activeStrikes.add(oscillator);
            oscillator.onended = () => {
                activeStrikes.delete(oscillator);
                oscillator.disconnect();
                gain.disconnect();
            };
            oscillator.start(start);
            oscillator.stop(end);
        }
    } catch {
        // A failed chime must not interfere with winner detection.
    }
}
