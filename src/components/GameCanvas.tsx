import React, { useEffect, useRef, useState } from 'react';
import { usePitchDetector } from '../audio/PitchDetection';
import { type Song, type GameNote } from '../game/Types';
import { Capacitor } from '@capacitor/core';
import { KeepAwake } from '@capacitor-community/keep-awake';
import { App as CapacitorApp } from '@capacitor/app';
import './GameCanvas.css';

interface GameCanvasProps {
    onExit: () => void;
    song: Song;
    onComplete: (stats: any) => void;
    perfectionistMode?: boolean;
}

const WINDOW_PERFECT = 0.12;
const WINDOW_GOOD = 0.35;
const WINDOW_BAD = 0.55;
const LOOKAHEAD = 3.0;

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

    const lastFrameTimeRef = useRef<number | null>(null);
    const audioTimeRef = useRef<number>(0);

    const scoreRef = useRef<number>(0);
    const [, setScore] = useState(0);
    const [streak, setStreak] = useState(0);
    const [gameState] = useState<'playing' | 'finished'>('playing');

    const [adjustingLabel, setAdjustingLabel] = useState<string | null>(null);
    const adjustingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const calculateInitialZoom = (s: Song) => {
        if (s.bpm && s.bpm > 0) {
            const bpmZoom = 100 + (s.bpm * 3.3);
            return Math.max(250, Math.min(800, Math.round(bpmZoom)));
        }

        if (!s.notes || s.notes.length === 0) return 300;
        const first = s.notes[0].time;
        const last = s.notes[s.notes.length - 1].time;
        const duration = last - first;
        if (duration <= 0) return 300;

        const nps = s.notes.length / duration;
        let target = nps * 60;
        return Math.max(250, Math.min(700, Math.round(target)));
    };

    const [zoomLevel, setZoomLevel] = useState(() => calculateInitialZoom(song));
    const zoomLevelRef = useRef(calculateInitialZoom(song));

    const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
    const playbackSpeedRef = useRef(1.0);

    const handleZoomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseInt(e.target.value);
        setZoomLevel(val);
        zoomLevelRef.current = val;

        setAdjustingLabel(`Zoom ${Math.round(val / 30 * 10)}%`);
        if (adjustingTimeoutRef.current) clearTimeout(adjustingTimeoutRef.current);
        adjustingTimeoutRef.current = setTimeout(() => setAdjustingLabel(null), 1000);
    };

    const handleSpeedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseFloat(e.target.value);
        setPlaybackSpeed(val);
        playbackSpeedRef.current = val;

        setAdjustingLabel(`Speed x${val.toFixed(2)}`);
        if (adjustingTimeoutRef.current) clearTimeout(adjustingTimeoutRef.current);
        adjustingTimeoutRef.current = setTimeout(() => setAdjustingLabel(null), 1000);
    };

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
        renderStartIndexRef.current = 0;
        songRef.current.notes.forEach(n => { n.hit = false; n.missed = false; });
    };

    const hitAnimationsRef = useRef<HitAnimation[]>([]);
    const renderStartIndexRef = useRef(0);

    const { startListening, stopListening, currentNote, rms } = usePitchDetector({ reportHz: false });

    const currentNoteRef = useRef<any>(null);
    const prevNoteRef = useRef<any>(null);

    const activeHitLockRef = useRef<{ hole: number; type: string } | null>(null);
    const silenceStartRef = useRef<number>(0);
    const lastNoteRef = useRef<any>(null);
    const maxRmsSinceLastHitRef = useRef<number>(0);

    const statsRef = useRef({ perfect: 0, good: 0, bad: 0, missed: 0, streak: 0, maxStreak: 0 });

    useEffect(() => {
        prevNoteRef.current = currentNoteRef.current;
        currentNoteRef.current = currentNote;
    }, [currentNote]);

    const songRef = useRef<Song>((() => {
        const s = JSON.parse(JSON.stringify(song));
        const START_DELAY = 2.0;
        s.notes.forEach((n: any) => n.time += START_DELAY);
        return s;
    })());

    useEffect(() => {
        try {
            startListening();
        } catch (e) {
            console.error("GameCanvas: Error starting listener", e);
        }

        const keepScreenOn = async () => {
            try {
                await KeepAwake.keepAwake();
            } catch (err) {
                console.warn("KeepAwake not supported/failed", err);
            }
        };
        keepScreenOn();

        // APP STATE HANDLING (Background/Resume)
        const handleAppState = (state: any) => {
            if (!state.isActive) {
                console.log("App paused, stopping microphone...");
                stopListening();
            } else {
                console.log("App resumed, starting microphone...");
                startListening();
            }
        };

        CapacitorApp.addListener('appStateChange', handleAppState);

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

        const handleResize = () => {
            if (canvasRef.current) {
                const parent = canvasRef.current.parentElement;
                if (parent) {
                    const dpr = window.devicePixelRatio || 1;
                    const parentRect = parent.getBoundingClientRect();
                    const isAndroid = Capacitor.getPlatform() === 'android';
                    const displayWidth = isAndroid ? parentRect.width : Math.min(parentRect.width, 600);
                    const displayHeight = parentRect.height;

                    canvasRef.current.width = displayWidth * dpr;
                    canvasRef.current.height = displayHeight * dpr;

                    const ctx = canvasRef.current.getContext('2d');
                    if (ctx) {
                        ctx.resetTransform();
                        ctx.scale(dpr, dpr);
                    }
                }
            }
        };

        window.addEventListener('resize', handleResize);
        handleResize();

        requestRef.current = requestAnimationFrame(update);
        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            CapacitorApp.removeAllListeners(); // Remove AppState listener
            stopListening();
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
            KeepAwake.allowSleep().catch(() => { });
        };
    }, []);

    const update = (time: number) => {
        try {
            if (lastFrameTimeRef.current === null) {
                lastFrameTimeRef.current = time;
            }
            const deltaTime = (time - lastFrameTimeRef.current) / 1000;
            lastFrameTimeRef.current = time;

            const safeDelta = Math.min(deltaTime, 0.1);
            audioTimeRef.current += safeDelta * playbackSpeedRef.current;
            const audioTime = audioTimeRef.current;

            const notes = songRef.current.notes;
            const lastNote = notes[notes.length - 1];
            if (lastNote && audioTime > lastNote.time + 3.0) {
                if (gameState === 'playing') {
                    _onComplete({
                        score: scoreRef.current,
                        ...statsRef.current
                    });
                }
                return;
            }

            const detected = currentNoteRef.current;

            if (rms > maxRmsSinceLastHitRef.current) {
                maxRmsSinceLastHitRef.current = rms;
            }

            let isFreshAttack = false;

            if (detected) {
                let isLocked = activeHitLockRef.current &&
                    activeHitLockRef.current.hole === detected.hole &&
                    activeHitLockRef.current.type === detected.type;

                if (isLocked && rms < maxRmsSinceLastHitRef.current * 0.9) {
                    isLocked = false;
                    activeHitLockRef.current = null;
                }

                if (!isLocked) {
                    isFreshAttack = true;
                    activeHitLockRef.current = detected;
                    maxRmsSinceLastHitRef.current = rms;
                } else {
                    silenceStartRef.current = 0;
                }
            } else {
                if (silenceStartRef.current === 0) silenceStartRef.current = time;
                if (time - silenceStartRef.current > 1) {
                    activeHitLockRef.current = null;
                }
            }

            if (detected) {
                let bestNote: GameNote | null = null;
                let minDiff = Infinity;

                for (const note of songRef.current.notes) {
                    if (note.hit || note.missed) continue;

                    if (detected.hole === note.hole && detected.type === note.type) {
                        const diffToStart = Math.abs(audioTime - note.time);
                        const isInsideNote = audioTime >= note.time && audioTime <= (note.time + note.duration);

                        let hitThreshold = isFreshAttack ? WINDOW_BAD : WINDOW_PERFECT;

                        if (diffToStart <= hitThreshold || (isFreshAttack && isInsideNote)) {
                            if (diffToStart < minDiff) {
                                minDiff = diffToStart;
                                bestNote = note;
                            }
                        }
                    }
                }

                if (!bestNote && isFreshAttack) {
                    for (const note of songRef.current.notes) {
                        if (note.hit || note.missed) continue;
                        if (detected.hole === note.hole && detected.type !== note.type) {
                            const diffToStart = Math.abs(audioTime - note.time);
                            if (diffToStart <= WINDOW_BAD * 1.5) {
                                statsRef.current.bad++;
                                statsRef.current.streak = 0;
                                setStreak(0);
                                hitAnimationsRef.current.push({
                                    x: note.hole - 1,
                                    y: 0,
                                    color: '#d32f2f',
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
                                    if (gameState === 'playing') requestRef.current = requestAnimationFrame(update);
                                    return;
                                }
                                break;
                            }
                        }
                    }
                }

                if (bestNote) {
                    const note = bestNote as GameNote;
                    let diff = Math.abs(audioTime - note.time);
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

            for (const note of songRef.current.notes) {
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
                        if (gameState === 'playing') requestRef.current = requestAnimationFrame(update);
                        return;
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

        const width = canvas.width / (window.devicePixelRatio || 1);
        const height = canvas.height / (window.devicePixelRatio || 1);
        const laneWidth = width / 10;
        const targetY = height - 100;

        const zoom = zoomLevelRef.current;
        const visibleSeconds = (targetY / zoom) + 1.0;
        const effectiveLookahead = Math.max(LOOKAHEAD, visibleSeconds);

        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = '#f5f5f5';
        ctx.fillRect(0, 0, width, height);

        ctx.lineWidth = 1;
        ctx.font = 'bold 16px Outfit, sans-serif';
        ctx.textAlign = 'center';

        for (let i = 0; i < 10; i++) {
            const x = i * laneWidth;
            ctx.strokeStyle = 'rgba(42, 42, 42, 0.1)';
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();

            const isActive = detected && detected.hole === i + 1;

            if (isActive) {
                ctx.fillStyle = 'rgba(230, 81, 0, 0.1)';
                ctx.fillRect(x, 0, laneWidth, height);

                ctx.fillStyle = '#E65100';
                ctx.fillRect(x, height - 30, laneWidth, 30);

                ctx.fillStyle = '#fff';
                ctx.font = 'bold 20px Outfit, sans-serif';
            } else {
                ctx.fillStyle = '#2a2a2a';
                ctx.font = '16px Outfit, sans-serif';
            }
            ctx.fillText((i + 1).toString(), x + laneWidth / 2, 120);
        }

        ctx.strokeStyle = '#2a2a2a';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(0, targetY);
        ctx.lineTo(width, targetY);
        ctx.stroke();

        hitAnimationsRef.current = hitAnimationsRef.current.filter(anim => {
            const age = sysTime - anim.startTime;
            if (age > 600) return false;

            const x = anim.x * laneWidth + laneWidth / 2;
            const floatY = targetY + 20 - (age / 600) * 80;
            const alpha = 1 - (age / 600);

            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.fillStyle = anim.color;
            ctx.textAlign = "center";
            ctx.font = `bold ${anim.fontSize}px Outfit, sans-serif`;
            ctx.fillText(anim.text, x, floatY);
            ctx.restore();

            return true;
        });

        const notes = songRef.current.notes;
        let startI = renderStartIndexRef.current;

        if (startI >= notes.length) startI = 0;
        while (startI < notes.length && (notes[startI].time - audioTime) < -2.0) {
            startI++;
        }
        renderStartIndexRef.current = startI;

        for (let i = startI; i < notes.length; i++) {
            const note = notes[i];
            const secondsUntilHit = note.time - audioTime;

            if (secondsUntilHit > effectiveLookahead) break;
            if (secondsUntilHit < -2.0) continue;

            const y = targetY - (secondsUntilHit * zoom);
            const noteHeight = note.duration * zoom;
            const laneIndex = note.hole - 1;
            const x = laneIndex * laneWidth;
            const noteTop = y - noteHeight;

            const gradient = ctx.createLinearGradient(0, y, 0, noteTop);
            const baseColor = note.type === 'blow' ? '230, 81, 0' : '42, 42, 42';

            gradient.addColorStop(0, `rgba(${baseColor}, 1)`);
            gradient.addColorStop(0.4, `rgba(${baseColor}, 0.9)`);
            gradient.addColorStop(1, `rgba(${baseColor}, 0)`);

            ctx.fillStyle = gradient;
            ctx.strokeStyle = '#f5f5f5';
            ctx.lineWidth = 4;

            let drawBottom = y;
            if (note.hit) {
                drawBottom = Math.min(y, targetY);
                if (noteTop > targetY) continue;
            }

            const radius = 10;
            const left = x + 4;
            const right = x + laneWidth - 4;
            const bottom = drawBottom;
            const top = noteTop;
            const centerX = (left + right) / 2;

            ctx.beginPath();
            const effRadius = Math.min(radius, Math.abs(bottom - top) / 2);
            ctx.moveTo(left, bottom - effRadius);
            ctx.quadraticCurveTo(left, bottom, left + effRadius, bottom);
            ctx.lineTo(right - effRadius, bottom);
            ctx.quadraticCurveTo(right, bottom, right, bottom - effRadius);
            ctx.quadraticCurveTo(right, (bottom + top) / 2, centerX, top);
            ctx.quadraticCurveTo(left, (bottom + top) / 2, left, bottom - effRadius);
            ctx.closePath();
            ctx.stroke();
            ctx.fill();
            ctx.restore();
        }

        if (detected) {
            const laneIndex = detected.hole - 1;
            const x = laneIndex * laneWidth;
            ctx.fillStyle = detected.type === 'blow' ? '#E65100' : '#2a2a2a';
            ctx.beginPath();
            ctx.arc(x + laneWidth / 2, targetY, 15, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    };

    useEffect(() => {
        const isAndroid = Capacitor.getPlatform() === 'android';
        if (isAndroid) {
            import('@capacitor/app').then(({ App }) => {
                App.addListener('backButton', () => {
                    onExit();
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

    const [controlsVisible, setControlsVisible] = useState(true);
    const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const showControls = () => {
        setControlsVisible(true);
        if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
        controlsTimeoutRef.current = setTimeout(() => {
            setControlsVisible(false);
        }, 3000);
    };

    useEffect(() => {
        showControls();
        return () => {
            if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
        };
    }, []);

    const handleInteraction = () => {
        showControls();
    };

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
                    justifyContent: 'center',
                    alignItems: 'center',
                    width: '100%',
                    position: 'relative',
                    padding: '15px 0'
                }}>
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

                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <div className="streak-display" style={{
                            fontSize: '2.5rem',
                            fontWeight: '900',
                            color: streak > 10 ? '#E65100' : '#fff',
                            textShadow: '0 0 10px rgba(0,0,0,0.5)',
                            fontFamily: 'Outfit, sans-serif'
                        }}>
                            {streak}
                        </div>
                    </div>

                    <div style={{ position: 'absolute', right: '20px' }}>
                        <button className="hud-btn back-btn" onClick={onExit} style={{ display: 'flex', gap: '5px', borderRadius: '20px', padding: '5px 15px', height: 'auto' }}>
                            ❌ <span style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>Quit</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* OVERLAY FOR ADJUSTING TEXT */}
            {adjustingLabel && (
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    zIndex: 100,
                    pointerEvents: 'none'
                }}>
                    <div style={{
                        background: 'rgba(0,0,0,0.7)',
                        padding: '20px 40px',
                        borderRadius: '15px',
                        color: 'white',
                        fontSize: '2.5rem',
                        fontWeight: 'bold',
                        textAlign: 'center',
                        textShadow: '0 2px 10px rgba(0,0,0,0.5)',
                        border: '2px solid rgba(255,255,255,0.2)',
                        backdropFilter: 'blur(5px)'
                    }}>
                        {adjustingLabel}
                    </div>
                </div>
            )}

            <div className="hud-bottom-controls" style={{
                opacity: controlsVisible ? 1 : 0,
                transition: 'opacity 0.3s',
                pointerEvents: controlsVisible ? 'auto' : 'none'
            }}>
                <div className="speed-control">
                    <span style={{ fontSize: '1.05rem', fontWeight: 'bold' }}>Zoom</span>
                    <input
                        type="range"
                        min="200"
                        max="800"
                        step="15"
                        value={zoomLevel}
                        onChange={handleZoomChange}
                        onTouchStart={handleSliderTouch}
                        onMouseDown={handleSliderTouch}
                    />
                </div>
                <div className="speed-control">
                    <span style={{ fontSize: '1.05rem', fontWeight: 'bold' }}>Speed</span>
                    <input
                        type="range"
                        min="0.5"
                        max="1.5"
                        step="0.05"
                        value={playbackSpeed}
                        onChange={handleSpeedChange}
                        onTouchStart={handleSliderTouch}
                        onMouseDown={handleSliderTouch}
                    />
                </div>
            </div>

            <canvas ref={canvasRef} className="game-canvas" />
        </div>
    );
};

export default GameCanvas;
