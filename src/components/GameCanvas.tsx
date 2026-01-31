import React, { useEffect, useRef, useState } from 'react';
import { usePitchDetector } from '../audio/PitchDetection';
import { type Song, type GameNote } from '../game/Types';
import { Capacitor } from '@capacitor/core';
import { KeepAwake } from '@capacitor-community/keep-awake';
import './GameCanvas.css';

interface GameCanvasProps {
    onExit: () => void;
    song: Song;
    onComplete: (stats: any) => void;
    perfectionistMode?: boolean;
}

const WINDOW_PERFECT = 0.12;
const WINDOW_GOOD = 0.35;
const WINDOW_BAD = 0.55; // New BAD window
const LOOKAHEAD = 3.0; // Seconds of notes to render

interface HitAnimation {
    x: number;
    y: number;
    color: string;
    text: string;
    fontSize: number;
    startTime: number;
}

const GameCanvas: React.FC<GameCanvasProps> = ({ onExit, song, onComplete: _onComplete, perfectionistMode = false }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const requestRef = useRef<number | null>(null);

    // Time Keeping (Delta Time approach for Variable Speed)
    const lastFrameTimeRef = useRef<number | null>(null);
    const audioTimeRef = useRef<number>(0);

    const scoreRef = useRef<number>(0);
    const [, setScore] = useState(0); // Score used for logic/stats, but not displayed in this simplified HUD
    const [streak, setStreak] = useState(0); // Visual streak state
    const [gameState] = useState<'playing' | 'finished'>('playing');

    // UI State for adjustments
    const [adjustingLabel, setAdjustingLabel] = useState<string | null>(null);
    const adjustingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Controls
    // Dynamic Zoom Calculation
    const calculateInitialZoom = (s: Song) => {
        // Use BPM if available for much better accuracy
        if (s.bpm && s.bpm > 0) {
            // Heuristic for good note spacing: 
            // 60 BPM -> 300 zoom
            // 120 BPM -> 500 zoom
            // 180 BPM -> 700 zoom
            // formula: 100 + BPM * 3.3
            const bpmZoom = 100 + (s.bpm * 3.3);
            return Math.max(250, Math.min(800, Math.round(bpmZoom)));
        }

        if (!s.notes || s.notes.length === 0) return 300;
        const first = s.notes[0].time;
        const last = s.notes[s.notes.length - 1].time;
        const duration = last - first;
        if (duration <= 0) return 300;

        const nps = s.notes.length / duration;
        // Heuristic fallback: Base 300 for ~5 NPS. Scale up.
        let target = nps * 60;
        return Math.max(250, Math.min(700, Math.round(target)));
    };

    const [zoomLevel, setZoomLevel] = useState(() => calculateInitialZoom(song));
    const zoomLevelRef = useRef(calculateInitialZoom(song));

    const [playbackSpeed, setPlaybackSpeed] = useState(1.0); // Time Scale
    const playbackSpeedRef = useRef(1.0);

    const handleZoomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseInt(e.target.value);
        setZoomLevel(val);
        zoomLevelRef.current = val;

        // "Zoom perc%"
        setAdjustingLabel(`Zoom ${Math.round(val / 30 * 10)}%`);
        if (adjustingTimeoutRef.current) clearTimeout(adjustingTimeoutRef.current);
        adjustingTimeoutRef.current = setTimeout(() => setAdjustingLabel(null), 1000);
    };

    const handleSpeedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseFloat(e.target.value);
        setPlaybackSpeed(val);
        playbackSpeedRef.current = val;

        // "Speed x num"
        setAdjustingLabel(`Speed x ${val.toFixed(2)}`);
        if (adjustingTimeoutRef.current) clearTimeout(adjustingTimeoutRef.current);
        adjustingTimeoutRef.current = setTimeout(() => setAdjustingLabel(null), 1000);
    };

    // Helper to stop propagation for sliders so game doesn't steal input
    const handleSliderTouch = (e: React.TouchEvent | React.MouseEvent) => {
        e.stopPropagation();
    };

    const resetGame = () => {
        lastFrameTimeRef.current = null;
        audioTimeRef.current = 0;
        scoreRef.current = 0;
        setScore(0);
        setStreak(0);
        statsRef.current = { perfect: 0, good: 0, bad: 0, missed: 0, streak: 0, maxStreak: 0 };
        hitAnimationsRef.current = [];
        activeHitLockRef.current = null;
        silenceStartRef.current = 0;
        lastNoteRef.current = null;
        maxRmsSinceLastHitRef.current = 0;

        // Render Optimization Index Reset
        renderStartIndexRef.current = 0;

        // Reset Notes
        songRef.current.notes.forEach(n => { n.hit = false; n.missed = false; });
        console.log("Game Reset!");
    };

    // Animation effects
    const hitAnimationsRef = useRef<HitAnimation[]>([]);

    // optimization: track start index for rendering
    const renderStartIndexRef = useRef(0);

    // Audio / Pitch Tracking
    // Disable Hz reporting to save performance!
    const { startListening, stopListening, currentNote, rms } = usePitchDetector({ reportHz: false });

    // Track current and PREVIOUS note to detect fresh attacks
    const currentNoteRef = useRef<any>(null);
    const prevNoteRef = useRef<any>(null);

    // Smooth Input Refs
    const activeHitLockRef = useRef<{ hole: number; type: string } | null>(null);
    const silenceStartRef = useRef<number>(0);
    const lastNoteRef = useRef<any>(null);
    const maxRmsSinceLastHitRef = useRef<number>(0);

    // Stats Ref
    const statsRef = useRef({ perfect: 0, good: 0, bad: 0, missed: 0, streak: 0, maxStreak: 0 });

    useEffect(() => {
        prevNoteRef.current = currentNoteRef.current;
        currentNoteRef.current = currentNote;
    }, [currentNote]);

    // Game State Mutable Refs
    const songRef = useRef<Song>((() => {
        const s = JSON.parse(JSON.stringify(song));
        const START_DELAY = 2.0; // 2 Seconds gap
        s.notes.forEach((n: any) => n.time += START_DELAY);
        return s;
    })());

    useEffect(() => {
        console.log("GameCanvas: Mounting...");
        if (!songRef.current) console.error("GameCanvas: NO SONG LOADED!");
        else console.log("GameCanvas: Song loaded", songRef.current.title, "Zoom:", zoomLevelRef.current);

        try {
            startListening();

        } catch (e) {
            console.error("GameCanvas: Error starting listener", e);
        }

        // Keep Screen On
        const keepScreenOn = async () => {
            try {
                await KeepAwake.keepAwake();
            } catch (err) {
                console.warn("KeepAwake not supported/failed", err);
            }
        };
        keepScreenOn();

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

        // Resize Handling (DPI Aware for Sharpness)
        const handleResize = () => {
            if (canvasRef.current) {
                const parent = canvasRef.current.parentElement;
                if (parent) {
                    const dpr = window.devicePixelRatio || 1;
                    const parentRect = parent.getBoundingClientRect();

                    // Respect CSS max-width: 600px ONLY on Desktop/Web (heuristic)
                    // On Android/Mobile, we MUST take full width.
                    const isAndroid = Capacitor.getPlatform() === 'android';
                    const displayWidth = isAndroid ? parentRect.width : Math.min(parentRect.width, 600);
                    const displayHeight = parentRect.height;

                    // Set actual render resolution to physical pixels
                    canvasRef.current.width = displayWidth * dpr;
                    canvasRef.current.height = displayHeight * dpr;

                    // Ensure internal drawing matches Scale
                    const ctx = canvasRef.current.getContext('2d');
                    if (ctx) {
                        ctx.resetTransform();
                        ctx.scale(dpr, dpr);
                    }
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

            // Allow sleep again
            KeepAwake.allowSleep().catch(() => { });
        };
    }, []);

    const update = (time: number) => {
        try {
            // Delta Time Calculation
            if (lastFrameTimeRef.current === null) {
                lastFrameTimeRef.current = time;
            }
            const deltaTime = (time - lastFrameTimeRef.current) / 1000; // seconds
            lastFrameTimeRef.current = time;

            // Advance Game Clock
            // Cap delta time to avoid huge jumps if tab was inactive (max 100ms jump)
            const safeDelta = Math.min(deltaTime, 0.1);
            audioTimeRef.current += safeDelta * playbackSpeedRef.current;
            const audioTime = audioTimeRef.current;

            const notes = songRef.current.notes;
            const lastNote = notes[notes.length - 1];
            if (lastNote && audioTime > lastNote.time + 3.0) {
                console.log("GameCanvas: Song Complete!");

                // Finish Game
                if (gameState === 'playing') {
                    // Pass stats to parent
                    _onComplete({
                        score: scoreRef.current,
                        ...statsRef.current
                    });
                }
                return; // Stop Loop
            }

            const detected = currentNoteRef.current;

            // Track Peak Amplitude since last hit to detect dips
            if (rms > maxRmsSinceLastHitRef.current) {
                maxRmsSinceLastHitRef.current = rms;
            }

            // DEBOUNCE LOGIC for "Fresh Attack":
            let isFreshAttack = false;

            if (detected) {
                // Check if we are locked on this note
                let isLocked = activeHitLockRef.current &&
                    activeHitLockRef.current.hole === detected.hole &&
                    activeHitLockRef.current.type === detected.type;

                // VOLUME DIP DETECTION (Gap detection between same notes)
                // If the current volume is less than 75% (was 60%) of the peak volume since the last hit,
                // we treat it as a breath gap and break the lock.
                // High sensitivity required for fast repetitions.
                if (isLocked && rms < maxRmsSinceLastHitRef.current * 0.9) {
                    isLocked = false;
                    activeHitLockRef.current = null;
                }

                if (!isLocked) {
                    isFreshAttack = true;
                    activeHitLockRef.current = detected; // Lock it!
                    maxRmsSinceLastHitRef.current = rms; // Reset peak for next dip check
                } else {
                    // We are locked. Reset silence timer to keep lock alive.
                    silenceStartRef.current = 0;
                }
            } else {
                // No note detected.
                if (silenceStartRef.current === 0) silenceStartRef.current = time;

                // SHORTENED TIMEOUT: 50ms -> 10ms
                // If PitchDetection (which is already smoothed) says "silence" for >10ms,
                // we should trust it and break the lock. 50ms was bridging legitimate gaps.
                if (time - silenceStartRef.current > 1) {
                    // Sustained silence! Clear the lock.
                    activeHitLockRef.current = null;
                }
            }

            // -------------------------------------------------------------------------
            // HIT DETECTION LOGIC (Modified for Legato/Consecutive Forgiveness)
            // -------------------------------------------------------------------------

            // Allow checking for hits if ANY note is detected (Fresh OR Locked/Held)
            if (detected) {
                // Find best note match
                let bestNote: GameNote | null = null;
                let minDiff = Infinity;

                // 1. Check for CORRECT HIT (Hole + Type match)
                for (const note of songRef.current.notes) {
                    if (note.hit || note.missed) continue;

                    if (detected.hole === note.hole && detected.type === note.type) {
                        const diffToStart = Math.abs(audioTime - note.time);
                        const isInsideNote = audioTime >= note.time && audioTime <= (note.time + note.duration);

                        // Condition A: Inside Early BAD Window (or Good/Perfect)
                        // Condition B: Inside the note body

                        // TIMING LOGIC REFINEMENT:
                        // If Fresh Attack: Allow hitting early (BAD window)
                        // If Held/Legato: wait until it is PERFECT to auto-snap!
                        let hitThreshold = isFreshAttack ? WINDOW_BAD : WINDOW_PERFECT;

                        if (diffToStart <= hitThreshold || (isFreshAttack && isInsideNote)) {
                            if (diffToStart < minDiff) {
                                minDiff = diffToStart;
                                bestNote = note;
                            }
                        }
                    }
                }

                // 2. Check for WRONG HIT (Penalty) - ONLY ON FRESH ATTACK
                // prevent punishment for holding a wrong note
                if (!bestNote && isFreshAttack) {
                    for (const note of songRef.current.notes) {
                        if (note.hit || note.missed) continue;

                        // Right Hole, Wrong Breath
                        if (detected.hole === note.hole && detected.type !== note.type) {
                            const diffToStart = Math.abs(audioTime - note.time);
                            // If we are somewhat close to a note (within BAD window), allow registering as WRONG
                            // Use WINDOW_BAD * 1.5 to be generous with "intent"
                            if (diffToStart <= WINDOW_BAD * 1.5) {
                                // WRONG!
                                statsRef.current.bad++;
                                statsRef.current.streak = 0;
                                setStreak(0);

                                // Visual Feedback
                                hitAnimationsRef.current.push({
                                    x: note.hole - 1,
                                    y: 0,
                                    color: '#d32f2f', // Red
                                    text: "WRONG",
                                    fontSize: 40,
                                    startTime: time
                                });

                                if (perfectionistMode) {
                                    resetGame();
                                    hitAnimationsRef.current.push({
                                        x: 4,
                                        y: 300,
                                        color: '#d32f2f',
                                        text: "💀 FAIL",
                                        fontSize: 80,
                                        startTime: time
                                    });
                                    // RESTART LOOP BEFORE RETURNING
                                    if (gameState === 'playing') requestRef.current = requestAnimationFrame(update);
                                    return; // STOP EXECUTION IMMEDIATELY
                                }
                                // Only triggered once per fresh attack
                                break;
                            }
                        }
                    }
                }


                if (bestNote) {
                    const note = bestNote as GameNote;
                    let diff = Math.abs(audioTime - note.time);

                    // FORCE PERFECT FOR LEGATO/HELD NOTES ("Lean towards perfect")
                    if (!isFreshAttack) {
                        diff = 0;
                    }

                    let points = 0;
                    let ratingText = "";
                    let fontSize = 40;

                    if (diff <= WINDOW_PERFECT) {
                        points = 1;
                        ratingText = "PERFECT!";
                        fontSize = 80;
                        statsRef.current.perfect++;
                        statsRef.current.streak++;
                    } else if (diff <= WINDOW_GOOD) {
                        points = 1;
                        ratingText = "GOOD";
                        fontSize = 50;
                        statsRef.current.good++;
                        statsRef.current.streak++;
                    } else {
                        // BAD HIT
                        points = 0;
                        ratingText = "BAD";
                        fontSize = 40;
                        statsRef.current.bad++;
                        statsRef.current.streak = 0;
                        setStreak(0);
                    }

                    if (diff <= WINDOW_GOOD) {
                        if (statsRef.current.streak > statsRef.current.maxStreak) {
                            statsRef.current.maxStreak = statsRef.current.streak;
                        }
                        setStreak(statsRef.current.streak);
                    }

                    note.hit = true;
                    scoreRef.current += points;
                    setScore(scoreRef.current);

                    // Dynamic Color Logic
                    // BAD = Off-White (#bdbdbd)
                    // Blow = Orange
                    // Draw = Black
                    let animColor = ratingText === "BAD" ? '#bdbdbd' : (note.type === 'blow' ? '#E65100' : '#2a2a2a');

                    hitAnimationsRef.current.push({
                        x: note.hole - 1,
                        y: 0,
                        color: animColor,
                        text: ratingText,
                        fontSize: fontSize,
                        startTime: time
                    });
                }
            }

            // Miss Logic
            // Use for...of to allow breaking early
            for (const note of songRef.current.notes) {
                // If we are past the note end + buffer, it's a miss
                if (!note.hit && !note.missed && audioTime > note.time + note.duration + 0.1) {
                    note.missed = true;
                    statsRef.current.missed++;
                    statsRef.current.bad++;
                    statsRef.current.streak = 0;
                    setStreak(0);

                    if (perfectionistMode) {
                        resetGame();
                        hitAnimationsRef.current.push({
                            x: 4,
                            y: 300,
                            color: '#d32f2f',
                            text: "💀 FAIL",
                            fontSize: 80,
                            startTime: time
                        });
                        // RESTART LOOP BEFORE RETURNING
                        if (gameState === 'playing') requestRef.current = requestAnimationFrame(update);
                        return; // KEY FIX: Stop processing misses if we reset!
                    }
                }
            }

            render(audioTime, time);
            if (gameState === 'playing') requestRef.current = requestAnimationFrame(update);

        } catch (err) { console.error(err); }
    };

    const render = (audioTime: number, sysTime: number) => {
        const detected = currentNoteRef.current;
        const canvas = canvasRef.current;
        if (!canvas || !canvas.getContext('2d')) return;
        const ctx = canvas.getContext('2d')!;

        // Use logical width/height (CSS pixels) for calculation since we applied Scale(dpr, dpr)
        const width = canvas.width / (window.devicePixelRatio || 1);
        const height = canvas.height / (window.devicePixelRatio || 1);
        const laneWidth = width / 10;
        const targetY = height - 100;

        // Dynamic Lookahead: Ensure we render enough notes to fill the screen
        const zoom = zoomLevelRef.current;
        const visibleSeconds = (targetY / zoom) + 1.0; // +1s buffer off-screen top
        const effectiveLookahead = Math.max(LOOKAHEAD, visibleSeconds);

        // Clear - Gray Background
        // Paranoid Clear for Android Glitches
        ctx.clearRect(0, 0, width, height);
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


        // LAYER 1: Hit Text (Behind notes)
        hitAnimationsRef.current = hitAnimationsRef.current.filter(anim => {
            const age = sysTime - anim.startTime;
            if (age > 600) return false; // Shorter life (snappier)

            const x = anim.x * laneWidth + laneWidth / 2;
            const floatY = targetY + 20 - (age / 600) * 80;
            const alpha = 1 - (age / 600);

            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.fillStyle = anim.color;
            ctx.textAlign = "center";
            ctx.font = `bold ${anim.fontSize}px Outfit, sans-serif`;
            // ctx.fillText(anim.text, x, floatY + 50); // Old
            ctx.fillText(anim.text, x, floatY);
            ctx.restore();

            return true;
        });

        // LAYER 2: Notes
        // OPTIMIZATION: Use Start Index to avoid O(N) iteration
        const notes = songRef.current.notes;
        let startI = renderStartIndexRef.current;

        // Safety check if notes array reset or something
        if (startI >= notes.length) startI = 0;

        // Adjust start index forward if notes are way past
        while (startI < notes.length && (notes[startI].time - audioTime) < -2.0) {
            startI++;
        }
        renderStartIndexRef.current = startI;

        // Iterate from startI
        for (let i = startI; i < notes.length; i++) {
            const note = notes[i];
            const secondsUntilHit = note.time - audioTime;

            // Break early if beyond lookahead
            if (secondsUntilHit > effectiveLookahead) break;

            // Should be handled by startI, but safety check for off-screen top
            if (secondsUntilHit < -2.0) continue;

            const y = targetY - (secondsUntilHit * zoom);
            const noteHeight = note.duration * zoom;
            const laneIndex = note.hole - 1;
            const x = laneIndex * laneWidth;
            const noteTop = y - noteHeight;

            // COMET SHAPE & GRADIENT
            // 1. Gradient: Opaque at bottom (Start), Transparent at top (Tail)
            // Note: noteTop is the TOP (Tail), y is the BOTTOM (Head). Y increases downwards.
            // So Gradient from y (bottom) to noteTop (top).

            const gradient = ctx.createLinearGradient(0, y, 0, noteTop);

            // Convert Hex to RGBA for gradient
            const baseColor = note.type === 'blow' ? '230, 81, 0' : '42, 42, 42';

            gradient.addColorStop(0, `rgba(${baseColor}, 1)`);    // Head (Bottom) - Solid
            gradient.addColorStop(0.4, `rgba(${baseColor}, 0.9)`); // Body - Mostly Solid
            gradient.addColorStop(1, `rgba(${baseColor}, 0)`);    // Tail - Fade out

            ctx.fillStyle = gradient;
            ctx.strokeStyle = '#f5f5f5'; // Halo Color
            ctx.lineWidth = 4;

            // MANUAL CLIPPING (Optimization & Bug Fix)
            // Instead of ctx.clip(), we simply clamp the bottom Y coordinate to targetY
            // if the note is hit. This prevents drawing below the line.

            let drawBottom = y;
            if (note.hit) {
                drawBottom = Math.min(y, targetY);
                // If the entire note has passed (tail below target), skip
                // Note: Top is physically "above" bottom (smaller Y value)
                // But noteTop is calculated as y - height.
                if (noteTop > targetY) continue;
            }

            // Path Construction
            // Bottom: Rounded Rectangle style (corner radius)
            // Top: Tapers to a point at center

            const radius = 10;
            const left = x + 4;
            const right = x + laneWidth - 4;
            // Use clamped bottom
            const bottom = drawBottom;
            const top = noteTop; // The point
            const centerX = (left + right) / 2;

            ctx.beginPath();

            // Start at Bottom-Left side (just above corner)
            // If we are squashed (bottom near top), reduce radius effectively
            const effRadius = Math.min(radius, Math.abs(bottom - top) / 2);

            ctx.moveTo(left, bottom - effRadius);

            // Bottom Left Corner
            ctx.quadraticCurveTo(left, bottom, left + effRadius, bottom);

            // Bottom Edge
            ctx.lineTo(right - effRadius, bottom);

            // Bottom Right Corner
            ctx.quadraticCurveTo(right, bottom, right, bottom - effRadius);

            // Right Side -> Taper to Top Center
            ctx.quadraticCurveTo(right, (bottom + top) / 2, centerX, top);

            // Left Side -> From Top Center back to Bottom Left
            ctx.quadraticCurveTo(left, (bottom + top) / 2, left, bottom - effRadius);

            ctx.closePath();

            ctx.stroke(); // Halo
            ctx.fill();   // Body

            ctx.restore();
        }

        // Debug: Draw Current Pitch Indicator
        if (detected) {
            const laneIndex = detected.hole - 1;
            const x = laneIndex * laneWidth;

            ctx.fillStyle = detected.type === 'blow' ? '#E65100' : '#2a2a2a';

            // Glow effect optimization: Remove shadowBlur for playback as well
            // Or keep it just for this one single circle (less expensive than N notes)
            // But let's be safe and remove it.

            ctx.beginPath();
            ctx.arc(x + laneWidth / 2, targetY, 15, 0, Math.PI * 2);
            ctx.fill();

            // Outline
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();
        }

    };

    // Android Back Button Handler
    useEffect(() => {
        const isAndroid = Capacitor.getPlatform() === 'android';
        if (isAndroid) {
            import('@capacitor/app').then(({ App }) => {
                App.addListener('backButton', () => {
                    onExit(); // Trigger exit when hardware back is pressed
                });
            });
        }

        return () => {
            if (isAndroid) {
                import('@capacitor/app').then(({ App }) => {
                    App.removeAllListeners();
                });
            }
        };
    }, [onExit]);

    // Bottom Controls Interaction Logic
    const [controlsVisible, setControlsVisible] = useState(true);
    const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const showControls = () => {
        setControlsVisible(true);
        if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);

        // Hide after 3 seconds
        controlsTimeoutRef.current = setTimeout(() => {
            setControlsVisible(false);
        }, 3000);
    };

    // Show controls on mount
    useEffect(() => {
        showControls();
        return () => {
            if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
        };
    }, []);

    const handleInteraction = () => {
        showControls();
    };

    const isAndroid = Capacitor.getPlatform() === 'android';

    return (
        <div
            className="game-container"
            onTouchStart={handleInteraction}
            onMouseDown={handleInteraction}
            onClick={handleInteraction}
        >
            <div className="game-hud">
                <div className="hud-top-bar" style={{
                    display: 'flex',
                    justifyContent: 'center', // Center everything
                    alignItems: 'center',
                    width: '100%',
                    position: 'relative', // For absolute positioning of Back button
                    padding: '15px 0'
                }}>

                    {/* LEFT GROUP: Legend */}
                    <div style={{ position: 'absolute', left: '20px', display: 'flex', flexDirection: 'column', gap: '5px', opacity: 0.8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '15px', height: '15px', background: '#E65100', borderRadius: '4px' }}></div>
                            <span style={{ color: '#fff', fontSize: '1rem', fontFamily: 'Outfit, sans-serif' }}>Blow</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '15px', height: '15px', background: '#2a2a2a', border: '1px solid #666', borderRadius: '4px' }}></div>
                            <span style={{ color: '#fff', fontSize: '1rem', fontFamily: 'Outfit, sans-serif' }}>Draw</span>
                        </div>
                    </div>

                    {/* CENTER GROUP: Combo & Retry */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>

                        {/* Combo Counter (Main Focus) */}
                        <div className="streak-display" style={{
                            fontSize: '3rem',
                            fontWeight: '800',
                            color: streak > 0 ? '#fff' : '#666',
                            textShadow: streak > 0 ? '0 0 20px #E65100' : 'none',
                            minWidth: '60px',
                            textAlign: 'center',
                            fontFamily: 'Outfit, sans-serif'
                        }}>
                            {streak}
                        </div>

                        {/* Reset Button */}
                        <button
                            className="hud-btn icon-only retry-btn"
                            onClick={resetGame}
                            title="Retry"
                            style={{ width: '40px', height: '40px', fontSize: '1.2rem' }}
                        >
                            ↻
                        </button>
                    </div>

                    {/* Back Button (Absolute Right) */}
                    {!isAndroid && (
                        <div style={{ position: 'absolute', right: '20px' }}>
                            <button className="hud-btn icon-only back-btn" onClick={onExit} title="Back">
                                ✕
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Central Adjustment Display */}
            {adjustingLabel && (
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    zIndex: 100,
                    pointerEvents: 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    <div style={{
                        color: '#E65100',
                        fontSize: '3.2rem',
                        fontWeight: '800',
                        fontFamily: 'Outfit, sans-serif',
                        textShadow: '0 0 20px rgba(255, 255, 255, 0.8), 2px 2px 0px white',
                        whiteSpace: 'nowrap',
                        fontVariantNumeric: 'tabular-nums',
                        minWidth: '300px',
                        textAlign: 'center'
                    }}>
                        {adjustingLabel}
                    </div>
                </div>
            )}

            {/* Bottom Controls - Fade Out */}
            <div
                className="hud-bottom-controls"
                style={{
                    opacity: controlsVisible ? 1 : 0,
                    transition: 'opacity 0.5s ease-in-out',
                    pointerEvents: controlsVisible ? 'auto' : 'none'
                }}
            >
                <div className="speed-control">
                    <label>Zoom: {Math.round(zoomLevel / 30 * 10)}%</label>
                    <input
                        type="range"
                        min="100"
                        max="900"
                        step="50"
                        value={zoomLevel}
                        onChange={handleZoomChange}
                        onMouseDown={(e) => e.stopPropagation()}
                        onTouchStart={(e) => e.stopPropagation()}
                    />
                </div>

                <div className="speed-control">
                    <label>Speed: {playbackSpeed}x</label>
                    <input
                        type="range"
                        min="0.25"
                        max="3.0"
                        step="0.05"
                        value={playbackSpeed}
                        onChange={handleSpeedChange}
                        onMouseDown={handleSliderTouch}
                        onTouchStart={handleSliderTouch}
                    // Default browser behavior usually handles "sliding away" correctly for range inputs
                    // but stopping propagation ensures the game canvas listeners don't interfere.
                    />
                </div>
            </div>

            <canvas
                ref={canvasRef}
                className="game-canvas"
            />
        </div>
    );
};

export default GameCanvas;
