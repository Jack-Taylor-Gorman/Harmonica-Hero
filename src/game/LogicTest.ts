
import { type GameNote } from './Types';

// MOCK CONSTANTS
const WINDOW_PERFECT = 0.08;

// MOCK STATE
let score = 0;
let hitAnimations: any[] = [];
let songNotes: GameNote[] = [
    { time: 1.0, hole: 4, type: 'blow', duration: 1, id: "0", hit: false, missed: false }
];

// RE-IMPLEMENTATION OF LOGIC FOR TEST (Must match GameCanvas.tsx exactly)
function update(time: number, detected: any, prevDetected: any) {
    const audioTime = time; // Simplified for test

    // STRICT MODE: Logic Overhaul
    // "Fresh Attack": Note this frame is different from last frame, OR last frame was null.
    const isFreshAttack = detected && (!prevDetected || prevDetected.hole !== detected.hole || prevDetected.type !== detected.type);

    if (isFreshAttack) {
        // Find best note match
        let bestNote: GameNote | null = null;
        let minDiff = Infinity;

        songNotes.forEach(note => {
            if (note.hit || note.missed) return;

            if (detected.hole === note.hole && detected.type === note.type) {
                const diff = Math.abs(audioTime - note.time);

                // ONLY consider hits within the PERFECT window (0.08s)
                if (diff <= WINDOW_PERFECT && diff < minDiff) {
                    minDiff = diff;
                    bestNote = note;
                }
            }
        });

        if (bestNote) {
            const note = bestNote as GameNote;

            const points = 300;
            const ratingText = "PERFECT!";
            const fontSize = 48;

            note.hit = true;
            score += points;

            hitAnimations.push({
                text: ratingText,
                fontSize: fontSize,
                startTime: time
            });
            return "HIT";
        } else {
            return "MISS_WINDOW";
        }
    } else if (detected) {
        return "HELD_NOTE";
    }
    return "NO_INPUT";
}

// TEST SUITE
console.log("=== STARTING LOGIC VERIFICATION ===");

// Scenario 1: Perfect Hit
// Note is at 1.0s. We play at 1.0s.
console.log("\nScenario 1: Perfect Hit");
score = 0;
hitAnimations = [];
songNotes[0].hit = false;
let result = update(1.0, { hole: 4, type: 'blow' }, null); // Fresh attack
console.log(`Input: 1.0s (Target 1.0s). Result: ${result}`);
if (result === "HIT" && hitAnimations[0]?.text === "PERFECT!" && score === 300) {
    console.log("PASS: Hit registered, Score updated, Rating is PERFECT!");
} else {
    console.error("FAIL: " + JSON.stringify(hitAnimations));
}

// Scenario 2: Holding Note (No Double Hit)
// We are still blowing at 1.01s.
console.log("\nScenario 2: Holding Note");
result = update(1.01, { hole: 4, type: 'blow' }, { hole: 4, type: 'blow' }); // Prev was same
console.log(`Input: 1.01s (Held). Result: ${result}`);
if (result === "HELD_NOTE" && score === 300) { // Score shouldn't increase
    console.log("PASS: Held note did not trigger new hit.");
} else {
    console.error("FAIL: Score increased or logic wrong.");
}

// Scenario 3: Early Miss (Strict Window)
// Note at 1.0s. We play at 0.8s (Diff 0.2s > 0.08s).
console.log("\nScenario 3: Early Miss");
songNotes[0].hit = false;
score = 0;
hitAnimations = [];
result = update(0.8, { hole: 4, type: 'blow' }, null);
console.log(`Input: 0.8s (Target 1.0s). Result: ${result}`);
if (result === "MISS_WINDOW" && score === 0) {
    console.log("PASS: Early input missed the window.");
} else {
    console.error("FAIL: Loose window allowed hit.");
}

// Scenario 4: Re-articulation after Miss
// We missed at 0.8s. We stop and blow again at 1.0s.
console.log("\nScenario 4: Re-articulation for Hit");
result = update(1.0, { hole: 4, type: 'blow' }, null); // Fresh again (assume silence in between)
console.log(`Input: 1.0s (Fresh). Result: ${result}`);
if (result === "HIT" && score === 300) {
    console.log("PASS: Re-articulation succeeded.");
} else {
    console.error("FAIL: Should have hit.");
}

console.log("\n=== VERIFICATION COMPLETE ===");
