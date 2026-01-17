import React, { useEffect, useRef, useState } from 'react';
import { usePitchDetector } from '../audio/PitchDetection';
import { type Song, type GameNote } from '../game/Types';
import { TEST_SONG } from '../game/Songs';
import './GameCanvas.css';

interface GameCanvasProps {
    onExit: () => void;
}

const NOTE_SPEED = 300; // Faster scroll for better precision
const WINDOW_PERFECT = 0.08;
const WINDOW_GOOD = 0.20;
const LOOKAHEAD = 3.0; // Seconds of notes to render
const VERSION = "v0.11.5"; // 1-Frame Debounce

interface HitAnimation {
    x: number;
    y: number;
    color: string;
    text: string;
    fontSize: number;
    startTime: number;
}

const GameCanvas: React.FC<GameCanvasProps> = ({ onExit }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const requestRef = useRef<number | null>(null);
    const startTimeRef = useRef<number | null>(null);
    const scoreRef = useRef<number>(0);
    const [score, setScore] = useState(0);
    const [streak, setStreak] = useState(0); // Visual streak state
    const [gameState] = useState<'playing' | 'finished'>('playing');

    // Animation effects
    const hitAnimationsRef = useRef<HitAnimation[]>([]);

    // Audio / Pitch Tracking
    // Disable Hz reporting to save performance!
    const { startListening, stopListening, currentNote } = usePitchDetector({ reportHz: false });

    // Track current and PREVIOUS note to detect fresh attacks
    const currentNoteRef = useRef<any>(null);
    const prevNoteRef = useRef<any>(null);

    // Smooth Input Refs
    const activeHitLockRef = useRef<{ hole: number; type: string } | null>(null);
    const silenceStartRef = useRef<number>(0);
    const lastNoteRef = useRef<any>(null);

    useEffect(() => {
        prevNoteRef.current = currentNoteRef.current;
        currentNoteRef.current = currentNote;
    }, [currentNote]);

    // Game State Mutable Refs
    const songRef = useRef<Song>(JSON.parse(JSON.stringify(TEST_SONG)));

    useEffect(() => {
        console.log("GameCanvas: Mounting...");
        if (!TEST_SONG) console.error("GameCanvas: TEST_SONG is undefined!");
        else console.log("GameCanvas: Song loaded", TEST_SONG.title);

        try {
            startListening();
        } catch (e) {
            console.error("GameCanvas: Error starting listener", e);
        }

        // DEBUG: Keyboard Input for Browser Testing
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.repeat) return;
            if (e.key === '4') {
                currentNoteRef.current = { hole: 4, type: 'blow', note: 'C', frequency: 523 };
            }
        };
        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key === '4') {
                currentNoteRef.current = null;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        // Resize Handling
        const handleResize = () => {
            if (canvasRef.current) {
                const parent = canvasRef.current.parentElement;
                if (parent) {
                    canvasRef.current.width = canvasRef.current.clientWidth;
                    canvasRef.current.height = canvasRef.current.clientHeight;
                }
            }
        };

        window.addEventListener('resize', handleResize);
        handleResize(); // Init

        requestRef.current = requestAnimationFrame(update);
        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            stopListening();
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, []);

    const update = (time: number) => {
        try {
            if (!startTimeRef.current) startTimeRef.current = time;
            const audioTime = (time - startTimeRef.current) / 1000;

            const notes = songRef.current.notes;
            const lastNote = notes[notes.length - 1];
            if (lastNote && audioTime > lastNote.time + 3.0) {
                console.log("GameCanvas: Looping Song!");
                startTimeRef.current = time;
                scoreRef.current = 0;
                setScore(0);
                songRef.current.notes.forEach(n => { n.hit = false; n.missed = false; });

                // CRITICAL LOOP FIX: Must return here to prevent processing the frame
                // with the OLD (high) audioTime, which would instantly fail all notes.
                if (gameState === 'playing') requestRef.current = requestAnimationFrame(update);
                return;
            }

            const detected = currentNoteRef.current;
            const prevDetected = prevNoteRef.current; // Raw previous frame (still useful for immediate transitions)

            // DEBOUNCE LOGIC for "Fresh Attack":
            // To prevent mic flickering (Note -> Null -> Note) from registering as a double hit,
            // we only consider the note "released" if we've had sustained silence.

            // 1. If we have a note, update the 'Last Known Note' and reset silence timer
            if (detected) {
                lastNoteRef.current = detected;
                silenceStartRef.current = 0;
            } else {
                // 2. If no note, start silence timer if not started
                if (silenceStartRef.current === 0) silenceStartRef.current = time;
            }

            // 3. Determine "Effective" Previous Note State
            // If silence has persisted < 16ms (1 frame), we "pretend" we are still holding the last note.
            // This filters ONLY single-frame dropouts.
            const minSilenceDuration = 16; // ms (User requested 1 frame)
            const effectivelyHolding = lastNoteRef.current && (detected || (time - silenceStartRef.current < minSilenceDuration));

            // 4. Fresh Attack Check
            // A. Must have a detected note NOW.
            // B. Must NOT have been "effectively holding" the SAME note previously.
            //    (i.e., either we were effectively holding nothing, OR we were effectively holding a DIFFERENT note)

            let isFreshAttack = false;

            if (detected) {
                if (!effectivelyHolding) {
                    isFreshAttack = true; // Clean attack after real silence
                } else if (lastNoteRef.current && (lastNoteRef.current.hole !== detected.hole || lastNoteRef.current.type !== detected.type)) {
                    isFreshAttack = true; // Clean transition to NEW note (instant switch)
                }
                // If effectivelyHolding SAME note, isFreshAttack remains false.
            }
            // Logic patch: 'effectivelyHolding' uses 'lastNoteRef' which is 'detected' from this frame if detected is true.
            // We need the *previous* effective state. 
            // Actually, we can just use the 'debounce' concept:
            // "You can only hit a note if the previous *stabilized* state was different."

            // Let's simplify:
            // We only 'reset' our ability to hit a note if we see DIFFERENT note OR sustained silence.
            // We use 'activeHitLock' ref to track if the current 'sound' has already consumed a note.

            // Ref: activeHitLockRef = { hole, type } | null
            // If detected != activeHitLock, we clear lock.
            // If detected == activeHitLock, we ignore.
            // BUT, if detected == null, we only clear lock if null persists > 100ms.

            if (detected) {
                // Check if we are locked on this note
                const isLocked = activeHitLockRef.current &&
                    activeHitLockRef.current.hole === detected.hole &&
                    activeHitLockRef.current.type === detected.type;

                // Check if this is a "Same Note" continuation despite a brief gap (Debounce Phase)
                // If we are NOT locked, but we are in "Debounce Grace Period" of the SAME note, re-lock?
                // No, lock is cleared by silence.

                // Let's basically not clear the lock until silence > 100ms.

                if (!isLocked) {
                    // Check against "Last Stable Note" to allow instant trills?
                    // If we switched notes directly (4->5), lock should be cleared instantly.
                    // The logic below handles that:
                    // If detected changes, it won't match isLocked, so we proceed to HIT.

                    isFreshAttack = true;
                    activeHitLockRef.current = detected; // Lock it!
                } else {
                    // We are locked. Reset silence timer to keep lock alive.
                    silenceStartRef.current = 0;
                }
            } else {
                // No note detected.
                if (silenceStartRef.current === 0) silenceStartRef.current = time;

                if (time - silenceStartRef.current > 100) {
                    // Sustained silence! Clear the lock.
                    activeHitLockRef.current = null;
                }
            }

            // Override: If we switched notes directly (e.g. 4 -> 5), the lock (4) wouldn't match detected (5).
            // effectively allowing the new note. But we must set the NEW lock.
            // My logic above: if (!isLocked) -> isFreshAttack=true, lock=detected.
            // Perfect.
            // Problem: If I have lock (4), and play (5). !isLocked(5) is true. Fresh attack 5. Lock becomes 5.
            // Perfect.
            // Problem: Mic Glitch. Lock (4). Silence (0ms). Silence (50ms). Lock (4) persists.
            // Note (4). isLocked(4) is true. No attack.
            // Perfect.

            // ACTUAL CODE IMPLEMENTATION:

            if (isFreshAttack) {
                // Find best note match
                let bestNote: GameNote | null = null;
                let minDiff = Infinity;

                songRef.current.notes.forEach(note => {
                    if (note.hit || note.missed) return;

                    if (detected.hole === note.hole && detected.type === note.type) {
                        const diff = Math.abs(audioTime - note.time);

                        // Widest window is GOOD (0.20s)
                        if (diff <= WINDOW_GOOD && diff < minDiff) {
                            minDiff = diff;
                            bestNote = note;
                        }
                    }
                });

                if (bestNote) {
                    const note = bestNote as GameNote;
                    const diff = Math.abs(audioTime - note.time);

                    let points = 0;
                    let ratingText = "";
                    let fontSize = 40;

                    if (diff <= WINDOW_PERFECT) {
                        points = 300;
                        ratingText = "PERFECT!";
                        fontSize = 80; // Super Huge!
                    } else {
                        points = 100;
                        ratingText = "GOOD";
                        fontSize = 40; // Medium
                    }

                    note.hit = true;
                    scoreRef.current += points;
                    setScore(scoreRef.current);

                    hitAnimationsRef.current.push({
                        x: note.hole - 1,
                        y: 0,
                        color: '#E65100', // Deep Orange
                        text: ratingText,
                        fontSize: fontSize,
                        startTime: time
                    });
                }
            }

            // Miss Logic
            songRef.current.notes.forEach(note => {
                // Use widest window (GOOD) + buffer for misses
                if (!note.hit && !note.missed && audioTime > note.time + WINDOW_GOOD + 0.1) {
                    note.missed = true;
                }
            });

            render(audioTime, time);
            if (gameState === 'playing') requestRef.current = requestAnimationFrame(update);

        } catch (err) { console.error(err); }
    };

    const render = (audioTime: number, sysTime: number) => {
        const detected = currentNoteRef.current;
        const canvas = canvasRef.current;
        if (!canvas || !canvas.getContext('2d')) return;
        const ctx = canvas.getContext('2d')!;

        const width = canvas.width;
        const height = canvas.height;
        const laneWidth = width / 10;
        const targetY = height - 100;

        // Clear - Gray Background
        ctx.fillStyle = '#f5f5f5';
        ctx.fillRect(0, 0, width, height);

        // Draw Highway
        ctx.lineWidth = 1;
        ctx.font = 'bold 16px Outfit, sans-serif';
        ctx.textAlign = 'center';

        for (let i = 0; i < 10; i++) {
            const x = i * laneWidth;

            // Line Color #2a2a2a
            ctx.strokeStyle = 'rgba(42, 42, 42, 0.1)';
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();

            // Highlight Lane if active
            const isActive = detected && detected.hole === i + 1;

            if (isActive) {
                ctx.fillStyle = 'rgba(230, 81, 0, 0.1)'; // Orange tint
                ctx.fillRect(x, 0, laneWidth, height);

                ctx.fillStyle = '#E65100';
                ctx.fillRect(x, height - 30, laneWidth, 30);

                ctx.fillStyle = '#fff';
                ctx.font = 'bold 20px Outfit, sans-serif';
            } else {
                ctx.fillStyle = '#2a2a2a';
                ctx.font = '16px Outfit, sans-serif';
            }

            // UI: Lane Numbers Top (Moved down to accommodate HUD bar)
            ctx.fillText((i + 1).toString(), x + laneWidth / 2, 120);
        }

        // Draw Target Line
        ctx.strokeStyle = '#2a2a2a';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(0, targetY);
        ctx.lineTo(width, targetY);
        ctx.stroke();

        // Draw Notes
        songRef.current.notes.forEach(note => {
            // 1. MISS LOGIC: If missed, DO NOT RENDER (User Request: "immediately disappear")
            if (note.missed) return;

            const secondsUntilHit = note.time - audioTime;
            // Standard LoA check
            if (secondsUntilHit > LOOKAHEAD || secondsUntilHit < -1) return;

            // Calculate Position
            // y = Visual 'bottom' of the note (closest to target) because it flows down
            const y = targetY - (secondsUntilHit * NOTE_SPEED);
            const noteHeight = note.duration * NOTE_SPEED;
            const laneIndex = note.hole - 1;
            const x = laneIndex * laneWidth;

            // Note Top Y
            const noteTop = y - noteHeight;

            // 2. HIT LOGIC: "Clip" Effect
            // Keep rendering the note, but hide any part that is below the target line.
            // AND hide the note head if it crosses the line?
            // "make the notes that were hit to stay but cover the notes after the bar"
            // -> Just use a screen clip region for HIT notes.

            const color = note.type === 'blow' ? '#E65100' : '#2a2a2a';
            ctx.fillStyle = color;

            if (note.hit) {
                // CLIP REGION: Define a rectangle from 0 to targetY (inclusive)
                // Draw everything inside it. Anything below targetY is hidden.
                ctx.save();
                ctx.beginPath();
                ctx.rect(0, 0, width, targetY);
                ctx.clip();

                // Draw Body
                ctx.fillRect(x + 4, noteTop, laneWidth - 8, noteHeight);

                // Draw Head
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 2;
                ctx.strokeRect(x + 4, y - 10, laneWidth - 8, 20);
                ctx.fillRect(x + 4, y - 10, laneWidth - 8, 20);

                ctx.restore();
            } else {
                // NORMAL RENDER (Not hit yet)
                // Render fully, even if overlapping line (standard gameplay)
                ctx.fillRect(x + 4, noteTop, laneWidth - 8, noteHeight);

                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 2;
                ctx.strokeRect(x + 4, y - 10, laneWidth - 8, 20);
                ctx.fillRect(x + 4, y - 10, laneWidth - 8, 20);
            }
        });

        // Debug: Draw Current Pitch Indicator
        if (detected) {
            const laneIndex = detected.hole - 1;
            const x = laneIndex * laneWidth;

            ctx.fillStyle = detected.type === 'blow' ? '#E65100' : '#2a2a2a';

            // Glow effect
            const glow = (Math.sin(sysTime / 100) + 1) * 5;
            ctx.shadowBlur = 10 + glow;
            ctx.shadowColor = ctx.fillStyle;

            ctx.beginPath();
            ctx.arc(x + laneWidth / 2, targetY, 15, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
        }

        // Draw Hit Animations
        hitAnimationsRef.current = hitAnimationsRef.current.filter(anim => {
            const age = sysTime - anim.startTime;
            if (age > 500) return false;

            const x = anim.x * laneWidth + laneWidth / 2;
            const radius = (age / 500) * 80;
            const alpha = 1 - (age / 500);

            ctx.strokeStyle = anim.color;
            ctx.lineWidth = 4;
            ctx.globalAlpha = alpha;
            ctx.beginPath();
            ctx.arc(x, targetY, radius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha = 1.0;

            ctx.fillStyle = "#fff";
            ctx.textAlign = "center";
            ctx.font = `bold ${anim.fontSize}px Outfit, sans-serif`;

            ctx.globalAlpha = alpha;
            ctx.fillText(anim.text, x, targetY - radius - 10);
            ctx.globalAlpha = 1.0;

            return true;
        });
    };

    return (
        <div className="game-container">
            <div className="game-hud">
                <div className="hud-top-bar">
                    <div className="top-left-stats">
                        <div className="score">Score: {score}</div>
                        {streak > 5 && (
                            <div className="streak-hud">
                                <span className="streak-count">{streak}</span>
                                <span className="streak-label">COMBO</span>
                            </div>
                        )}
                    </div>
                    <button className="exit-btn" onClick={onExit}>Exit</button>
                </div>
            </div>
            <canvas
                ref={canvasRef}
                className="game-canvas"
            />
            <div style={{
                position: 'absolute',
                bottom: '10px',
                right: '10px',
                color: '#666',
                fontFamily: 'Outfit, sans-serif',
                fontSize: '12px',
                opacity: 0.5,
                pointerEvents: 'none'
            }}>
                {VERSION}
            </div>
        </div>
    );
};

export default GameCanvas;
