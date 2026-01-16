import type { GameNote } from './Types';

interface TabParserOptions {
    bpm: number;
    defaultDuration?: number; // in beats
}

export class TabParser {
    /**
     * Parses a string of harmonica tabs into GameNotes.
     * Format: "4 4 -4 5"  (Positive = Blow, Negative = Draw)
     * Supports simple duration syntax: "4:2" means hole 4 for 2 beats.
     * "r" or "rest" means rest.
     */
    static parse(title: string, tabString: string, options: TabParserOptions): GameNote[] {
        const { bpm } = options;
        const secondsPerBeat = 60 / bpm;
        const defaultDuration = options.defaultDuration || 1;

        const tokens = tabString.trim().split(/\s+/);
        const notes: GameNote[] = [];
        let currentTime = 2.0; // Start with 2s padding

        tokens.forEach((token, index) => {
            if (!token) return;

            let durationBeats = defaultDuration;
            let noteStr = token;

            // Check for duration: "4:2" or "4/2"
            if (token.includes(':')) {
                const parts = token.split(':');
                noteStr = parts[0];
                durationBeats = parseFloat(parts[1]);
            }

            const durationSec = durationBeats * secondsPerBeat;

            // Handle Rests
            if (noteStr.toLowerCase() === 'r' || noteStr.toLowerCase() === 'rest') {
                currentTime += durationSec;
                return;
            }

            // Parse Hole and Type
            // -4 or (4) usually means draw. 4 means blow.
            let type: 'blow' | 'draw' = 'blow';
            let holeStr = noteStr;

            if (noteStr.startsWith('-') || noteStr.startsWith('(')) {
                type = 'draw';
                holeStr = noteStr.replace(/[-()]/g, '');
            } else if (noteStr.endsWith('d')) { // 4d notation
                type = 'draw';
                holeStr = noteStr.replace('d', '');
            }

            const hole = parseInt(holeStr, 10);

            if (!isNaN(hole)) {
                // Adjust note length to be slightly staccato for better playability visuals?
                // Or full legato? Let's do 90% of duration.
                notes.push({
                    id: `${title}-${index}`,
                    time: currentTime,
                    hole: hole,
                    type: type,
                    duration: durationSec * 0.9
                });
            }

            currentTime += durationSec;
        });

        return notes;
    }
}
