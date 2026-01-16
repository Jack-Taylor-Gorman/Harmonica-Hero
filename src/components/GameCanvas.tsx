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
const VERSION = "v0.9.0"; // Bad Rating Added + Strict Hold Logic

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
    const [gameState] = useState<'playing' | 'finished'>('playing');

    // Animation effects
    const hitAnimationsRef = useRef<HitAnimation[]>([]);

    // Audio / Pitch Tracking
    // Disable Hz reporting to save performance!
    const { startListening, stopListening, currentNote } = usePitchDetector({ reportHz: false });

    // Track current and PREVIOUS note to detect fresh attacks
    const currentNoteRef = useRef<any>(null);
    const prevNoteRef = useRef<any>(null);

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
            const prevDetected = prevNoteRef.current;

            // STRICT MODE: Logic Overhaul
            // "Fresh Attack": Note this frame is different from last frame, OR last frame was null.
            const isFreshAttack = detected && (!prevDetected || prevDetected.hole !== detected.hole || prevDetected.type !== detected.type);

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

            // UI: Lane Numbers Top (y=30)
            ctx.fillText((i + 1).toString(), x + laneWidth / 2, 30);
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
            if (note.hit) return;

            const secondsUntilHit = note.time - audioTime;
            if (secondsUntilHit > LOOKAHEAD || secondsUntilHit < -1) return;

            const y = targetY - (secondsUntilHit * NOTE_SPEED);
            const noteHeight = note.duration * NOTE_SPEED;
            const laneIndex = note.hole - 1;
            const x = laneIndex * laneWidth;

            // Note Body
            const color = note.type === 'blow' ? '#E65100' : '#2a2a2a';

            ctx.fillStyle = color;
            ctx.fillRect(x + 4, y - noteHeight, laneWidth - 8, noteHeight);

            // Note Head
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.strokeRect(x + 4, y - 10, laneWidth - 8, 20);
            ctx.fillRect(x + 4, y - 10, laneWidth - 8, 20);
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
                <div className="score">Score: {score}</div>
                <div className="debug-note">
                    Detected: <span style={{ color: currentNote ? '#0f0' : '#888' }}>
                        {currentNote ? `${currentNote.hole} ${currentNote.type.toUpperCase()} (${currentNote.note})` : '--'}
                    </span>
                    <span style={{ fontSize: '0.8em', color: '#666', marginLeft: '10px' }}>
                        (Win: {WINDOW_GOOD}s)
                    </span>
                </div>
                <button className="exit-btn" onClick={onExit}>Exit</button>
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
