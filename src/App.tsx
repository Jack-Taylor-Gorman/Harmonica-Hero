import { useState, useEffect, useRef } from 'react';
import './App.css';
import GameCanvas from './components/GameCanvas';
import PDMXLocalJudge from './components/PDMXLocalJudge';
import { songManager } from './game/SongManager';
import { processFile } from './utils/SongImporter';
import type { Song } from './game/Types';

import { Capacitor } from '@capacitor/core';

interface ExtendedSong extends Song {
    source?: 'pdmx' | 'file' | 'app';
}

function App() {
    const [view, setView] = useState<'menu' | 'game' | 'results' | 'judge'>('menu');
    const [selectedSong, setSelectedSong] = useState<Song | null>(null);
    const [songs, setSongs] = useState<ExtendedSong[]>([]);
    const [customSongs, setCustomSongs] = useState<ExtendedSong[]>([]);
    const [lastStats, setLastStats] = useState<any>(null);
    const [savedData, setSavedData] = useState<any>({ stars: {}, highScores: {} });
    const [isPerfectionist, setIsPerfectionist] = useState(false);
    const [favorites, setFavorites] = useState<Set<string>>(new Set());
    const touchStartPos = useRef<{ x: number, y: number } | null>(null);

    const [pdmxFolderOpen, setPdmxFolderOpen] = useState(false);
    const logoTapCount = useRef(0);
    const logoTapTimer = useRef<NodeJS.Timeout | null>(null);

    const isAndroid = Capacitor.getPlatform() === 'android';

    // Auth State
    const [user, setUser] = useState<{ username: string } | null>(null);
    const [showLogin, setShowLogin] = useState(false);
    const [usernameInput, setUsernameInput] = useState("");
    const [passwordInput, setPasswordInput] = useState("");

    // Load Songs & User on Mount
    useEffect(() => {
        const init = async () => {
            await songManager.init();
            const allSongs = await songManager.getAllSongs();
            setSongs(allSongs);

            // Load Custom Songs from LocalStorage
            try {
                const localSongs = localStorage.getItem('hh_custom_songs');
                if (localSongs) {
                    const parsed = JSON.parse(localSongs);
                    if (Array.isArray(parsed)) {
                        setCustomSongs(parsed);
                    }
                }
            } catch (e) {
                console.error("Failed to load custom songs", e);
            }

            const currentUser = songManager.getUser();
            if (currentUser) setUser(currentUser);

            // Load Scores for UI
            const scores = await songManager.getAllScores();
            const starMap: any = {};
            const highScoreMap: any = {};
            scores.forEach(s => {
                starMap[s.songId] = s.stars;
                if (s.score) highScoreMap[s.songId] = s;
            });
            setSavedData({ stars: starMap, highScores: highScoreMap });

            // Load Favorites
            const storedFavs = localStorage.getItem('hh_favorites');
            if (storedFavs) {
                setFavorites(new Set(JSON.parse(storedFavs)));
            }
        };
        init();
    }, []);

    const saveCustomSongs = (newSongs: ExtendedSong[]) => {
        setCustomSongs(newSongs);
        try {
            localStorage.setItem('hh_custom_songs', JSON.stringify(newSongs));
        } catch (e) {
            alert("Storage Full! Cannot save song locally.");
        }
    };

    const deleteCustomSong = (id: string, e: React.MouseEvent | React.TouchEvent) => {
        e.stopPropagation();
        e.preventDefault();
        if (confirm("Delete this song?")) {
            const updated = customSongs.filter(s => s.id !== id);
            saveCustomSongs(updated);
        }
    };

    const toggleFavorite = (songId: string) => {
        setFavorites(prev => {
            const next = new Set(prev);
            if (next.has(songId)) next.delete(songId);
            else next.add(songId);
            localStorage.setItem('hh_favorites', JSON.stringify(Array.from(next)));
            return next;
        });
    };

    // Long Press Logic
    const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
    const isLongPressRef = useRef(false);

    const handleTouchStart = (songId: string, e: React.TouchEvent | React.MouseEvent) => {
        isLongPressRef.current = false;

        // Store initial touch position
        if ('touches' in e) {
            touchStartPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        } else {
            touchStartPos.current = { x: e.clientX, y: e.clientY };
        }

        longPressTimerRef.current = setTimeout(() => {
            isLongPressRef.current = true;
            toggleFavorite(songId);
            if (navigator.vibrate) navigator.vibrate(50); // Haptic feedback
        }, 800);
    };

    const handleTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
        // Cancel long press if user is scrolling
        if (touchStartPos.current && longPressTimerRef.current) {
            const currentX = 'touches' in e ? e.touches[0].clientX : e.clientX;
            const currentY = 'touches' in e ? e.touches[0].clientY : e.clientY;

            const deltaX = Math.abs(currentX - touchStartPos.current.x);
            const deltaY = Math.abs(currentY - touchStartPos.current.y);

            if (deltaX > 10 || deltaY > 10) {
                if (longPressTimerRef.current) {
                    clearTimeout(longPressTimerRef.current);
                    longPressTimerRef.current = null;
                }
            }
        }
    };

    const handleTouchEnd = () => {
        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }
        touchStartPos.current = null;
    };

    const handleStartGame = (song: Song) => {
        if (isLongPressRef.current) return;
        setSelectedSong(song);
        setView('game');
    };

    const handleGameCompletion = async (stats: any) => {
        setLastStats(stats);

        if (selectedSong) {
            const starsEarned = await songManager.saveScore(selectedSong.id, stats);
            setSavedData((prev: any) => ({
                stars: {
                    ...prev.stars,
                    [selectedSong.id]: starsEarned
                },
                highScores: {
                    ...prev.highScores,
                    [selectedSong.id]: stats
                }
            }));
        }
        setView('results');
    };

    const handleLogin = async () => {
        if (!usernameInput) return;
        try {
            const hash = btoa(passwordInput || "nopass");
            const u = await songManager.login(usernameInput, hash);
            setUser(u as { username: string });
            setShowLogin(false);
            const scores = await songManager.getAllScores();
            const starMap: any = {};
            scores.forEach(s => starMap[s.songId] = s.stars);
            setSavedData({ stars: starMap });
        } catch (e) {
            alert("Login Failed/Error");
        }
    };

    const handleLogout = () => {
        songManager.logout();
        setUser(null);
        setSavedData({ stars: {} });
    };

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            const newSong = await processFile(file);
            const updated = [newSong, ...customSongs];
            saveCustomSongs(updated);

            alert(`Imported "${newSong.title}" successfully!`);
            if (fileInputRef.current) fileInputRef.current.value = '';

        } catch (err: any) {
            alert(err.message || "Failed to import song");
            console.error(err);
        }
    };

    const handlePDMXImport = (song: Song) => {
        // Add source tag
        const taggedSong: ExtendedSong = { ...song, source: 'pdmx' };
        const updated = [taggedSong, ...customSongs];
        saveCustomSongs(updated);
        alert(`Saved "${song.title}" to Library!`);
    };

    const handleLogoTap = () => {
        logoTapCount.current++;
        if (logoTapTimer.current) clearTimeout(logoTapTimer.current);
        logoTapTimer.current = setTimeout(() => {
            logoTapCount.current = 0;
        }, 1000);

        if (logoTapCount.current >= 5) {
            if (confirm("Enter Judge Mode?")) {
                setView('judge');
            }
            logoTapCount.current = 0;
        }
    };

    // Categorize songs
    const visibleSongs: ExtendedSong[] = [];
    const hiddenPDMXSongs: ExtendedSong[] = [];

    [...songs, ...customSongs].forEach(s => {
        // If it's a PDMX song AND NOT favorite -> Hide in folder
        const isFav = favorites.has(s.id);
        if (s.source === 'pdmx' && !isFav) {
            hiddenPDMXSongs.push(s);
        } else {
            visibleSongs.push(s);
        }
    });

    return (
        <div className={view === 'menu' ? "app-container" : "game-view-container"}>
            {!isAndroid && <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 100 }}>
                {user ? (
                    <div style={{ background: 'rgba(0,0,0,0.8)', padding: '10px', borderRadius: '8px', color: '#fff' }}>
                        <span>👤 {user.username}</span>
                        <button onClick={handleLogout} style={{ marginLeft: '10px', fontSize: '12px', background: '#d32f2f', border: 'none', color: 'white', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}>Log Out</button>
                    </div>
                ) : (
                    <button onClick={() => setShowLogin(true)} style={{ background: '#E65100', border: 'none', color: 'white', padding: '10px 15px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Login</button>
                )}
            </div>}

            {showLogin && (
                <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 200, backdropFilter: 'blur(5px)' }}>
                    <div className="modal-glass" style={{ minWidth: '350px', background: '#fff', padding: '30px', borderRadius: '15px', border: '1px solid #eee', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
                        <h2 style={{ marginTop: 0, color: '#E65100' }}>☁️ Login</h2>
                        <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '20px' }}>Login or Register to save your stars forever.</p>
                        <input
                            placeholder="Username"
                            value={usernameInput}
                            onChange={e => setUsernameInput(e.target.value)}
                            style={{ display: 'block', width: '100%', margin: '10px 0', padding: '12px', background: '#f5f5f5', border: '1px solid #ddd', color: '#333', borderRadius: '5px', fontSize: '1rem' }}
                        />
                        <input
                            type="password"
                            placeholder="Password"
                            value={passwordInput}
                            onChange={e => setPasswordInput(e.target.value)}
                            style={{ display: 'block', width: '100%', margin: '10px 0', padding: '12px', background: '#f5f5f5', border: '1px solid #ddd', color: '#333', borderRadius: '5px', fontSize: '1rem' }}
                        />
                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
                            <button onClick={() => setShowLogin(false)} style={{ background: 'transparent', border: '1px solid #ccc', color: '#666', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer' }}>Cancel</button>
                            <button onClick={handleLogin} style={{ background: '#E65100', border: 'none', color: 'white', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>Login</button>
                        </div>
                    </div>
                </div>
            )}

            {view === 'menu' && (
                <div className="menu-container">
                    <div className="hero-header">
                        <img
                            src="/logo.png"
                            alt="Harmonica Hero Logo"
                            className="logo-img"
                            onClick={handleLogoTap}
                        />
                        <h1 className="main-title">Harmonica Hero</h1>
                        <p className="subtitle">Learn. Play. Master the C Harp.</p>

                        <div className="mode-toggle" style={{ margin: '20px 0', display: 'flex', justifyContent: 'center', gap: '20px', background: 'rgba(0,0,0,0.2)', padding: '5px', borderRadius: '30px' }}>
                            <button
                                onClick={() => setIsPerfectionist(false)}
                                style={{
                                    background: !isPerfectionist ? '#4CAF50' : 'transparent',
                                    color: !isPerfectionist ? 'white' : '#aaa',
                                    border: 'none', padding: '8px 20px', borderRadius: '20px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.3s'
                                }}>
                                Normal
                            </button>
                            <button
                                onClick={() => setIsPerfectionist(true)}
                                style={{
                                    background: isPerfectionist ? '#d32f2f' : 'transparent',
                                    color: isPerfectionist ? 'white' : '#aaa',
                                    border: 'none', padding: '8px 20px', borderRadius: '20px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', transition: 'all 0.3s'
                                }}>
                                <span>Perfectionist</span>
                                <span>💀</span>
                            </button>
                        </div>
                    </div>

                    <div className="song-grid" style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center', width: '100%', padding: '0 20px', boxSizing: 'border-box' }}>
                        {/* PUBLIC DOMAIN FOLDER */}
                        {hiddenPDMXSongs.length > 0 && (
                            <div style={{ width: '100%', marginBottom: '10px' }}>
                                <button
                                    onClick={() => setPdmxFolderOpen(!pdmxFolderOpen)}
                                    className="metro-btn"
                                    style={{
                                        width: '100%',
                                        background: '#2a2a2a',
                                        color: '#fff',
                                        padding: '12px 20px',
                                        borderRadius: '15px',
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        border: '1px solid #444'
                                    }}
                                >
                                    <span style={{ fontWeight: 'bold' }}>📂 Public Domain Songs ({hiddenPDMXSongs.length})</span>
                                    <span>{pdmxFolderOpen ? '🔼' : '🔽'}</span>
                                </button>

                                {pdmxFolderOpen && (
                                    <div style={{
                                        marginTop: '10px',
                                        padding: '10px',
                                        background: 'rgba(0,0,0,0.05)',
                                        borderRadius: '15px',
                                        borderLeft: '4px solid #2a2a2a'
                                    }}>
                                        {hiddenPDMXSongs.map(song => {
                                            return (
                                                <div
                                                    key={song.id}
                                                    className="metro-btn song-select-btn"
                                                    onClick={() => handleStartGame(song)}
                                                    // Long Press Handlers
                                                    onMouseDown={(e) => handleTouchStart(song.id, e)}
                                                    onMouseMove={handleTouchMove}
                                                    onMouseUp={handleTouchEnd}
                                                    onMouseLeave={handleTouchEnd}
                                                    onTouchStart={(e) => handleTouchStart(song.id, e)}
                                                    onTouchMove={handleTouchMove}
                                                    onTouchEnd={handleTouchEnd}

                                                    style={{
                                                        width: '100%',
                                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                        background: '#424242', // Darker for shelved items
                                                        border: 'none',
                                                        position: 'relative',
                                                        overflow: 'hidden',
                                                        padding: '15px 20px',
                                                        borderRadius: '15px',
                                                        cursor: 'pointer',
                                                        color: 'white',
                                                        marginBottom: '8px'
                                                    }}
                                                >
                                                    <div>
                                                        <div style={{ fontWeight: 'bold' }}>{song.title}</div>
                                                        <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>{song.artist}</div>
                                                    </div>
                                                    {/* Add trash can even even here */}
                                                    <div
                                                        onClick={(e) => deleteCustomSong(song.id, e)}
                                                        onMouseDown={(e) => e.stopPropagation()}
                                                        onTouchStart={(e) => e.stopPropagation()}
                                                        style={{ padding: '8px' }}
                                                    >
                                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="white" style={{ opacity: 0.7 }}>
                                                            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                                                        </svg>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                        {visibleSongs
                            .sort((a, b) => {
                                const aFav = favorites.has(a.id) ? 1 : 0;
                                const bFav = favorites.has(b.id) ? 1 : 0;
                                return bFav - aFav;
                            })
                            .map(song => {
                                const bestStats = savedData.highScores?.[song.id];
                                const bestPercent = bestStats ? Math.round((bestStats.score / (bestStats.perfect + bestStats.good + bestStats.missed)) * 100) : 0;
                                const isCustom = customSongs.some(cs => cs.id === song.id);

                                return (
                                    <div
                                        key={song.id}
                                        className="metro-btn song-select-btn"
                                        onClick={() => handleStartGame(song)}
                                        // Long Press Handlers
                                        onMouseDown={(e) => handleTouchStart(song.id, e)}
                                        onMouseMove={handleTouchMove}
                                        onMouseUp={handleTouchEnd}
                                        onMouseLeave={handleTouchEnd}
                                        onTouchStart={(e) => handleTouchStart(song.id, e)}
                                        onTouchMove={handleTouchMove}
                                        onTouchEnd={handleTouchEnd}

                                        style={{
                                            width: '100%',
                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                            background: '#E65100',
                                            border: 'none',
                                            position: 'relative',
                                            overflow: 'hidden',
                                            padding: '15px 20px',
                                            borderRadius: '30px',
                                            cursor: 'pointer',
                                            color: 'white',
                                            marginBottom: '10px'
                                        }}
                                    >
                                        <div style={{ textAlign: 'left', zIndex: 2, flex: 1, minWidth: 0 }}>
                                            <div style={{
                                                fontWeight: 'bold', fontSize: '1.1rem',
                                                whiteSpace: 'nowrap',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis'
                                            }}>{song.title}</div>
                                            <span style={{ opacity: 0.8, fontSize: '0.9rem', display: 'block' }}>{song.artist}</span>
                                            {song.warning && (
                                                <div style={{ color: '#ffccbc', fontSize: '0.75rem', marginTop: '4px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <span>⚠️</span> {song.warning}
                                                </div>
                                            )}
                                        </div>

                                        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '12px', zIndex: 2 }}>
                                            {bestPercent > 0 && (
                                                <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'rgba(255,255,255,0.9)' }}>
                                                    {bestPercent}%
                                                </div>
                                            )}

                                            {savedData.stars[song.id] && savedData.stars[song.id] !== 'none' && (
                                                <div className="star-badge" title={savedData.stars[song.id].toUpperCase()} style={{ fontSize: '1.2rem' }}>
                                                    {savedData.stars[song.id] === 'gold' && '🏅'}
                                                    {savedData.stars[song.id] === 'silver' && '🥈'}
                                                    {savedData.stars[song.id] === 'bronze' && '🥉'}
                                                </div>
                                            )}

                                            {/* Favorite Heart - Moved here to coexist properly */}
                                            {favorites.has(song.id) && (
                                                <svg width="24" height="24" viewBox="0 0 24 24" fill="white" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}>
                                                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                                                </svg>
                                            )}

                                            {isCustom && (
                                                <div
                                                    onClick={(e) => deleteCustomSong(song.id, e)}
                                                    onMouseDown={(e) => e.stopPropagation()}
                                                    onTouchStart={(e) => e.stopPropagation()}
                                                    style={{
                                                        background: 'transparent',
                                                        borderRadius: '50%',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        marginLeft: '5px',
                                                        cursor: 'pointer',
                                                        zIndex: 20,
                                                        padding: '8px' // Hit area
                                                    }}
                                                >
                                                    {/* White SVG Trash Can */}
                                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="white" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}>
                                                        <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                                                    </svg>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}

                        <div style={{ textAlign: 'center', marginTop: '20px', width: '100%' }}>
                            <input
                                type="file"
                                accept=".json,.txt,.xml,.musicxml,.mxl,.mid,.midi,application/xml,text/xml,application/vnd.recordare.musicxml+xml,application/vnd.recordare.musicxml,audio/midi,audio/x-midi,application/zip,application/octet-stream"
                                ref={fileInputRef}
                                style={{ display: 'none' }}
                                onChange={handleFileImport}
                            />
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="metro-btn"
                                style={{
                                    width: '100%',
                                    padding: '15px 20px',
                                    fontSize: '1rem',
                                    background: '#E65100',
                                    color: 'white',
                                    fontWeight: 'bold',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px'
                                }}>
                                <span>📂</span> Import Song
                            </button>

                            <div style={{ fontSize: '0.8rem', color: '#888', marginTop: '15px', lineHeight: '1.4', textAlign: 'left', background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '8px' }}>
                                <strong>💡 Quick Tips:</strong>
                                <ul style={{ margin: '5px 0 0 15px', padding: 0 }}>
                                    <li>Use <strong>Flute/Vocal</strong> parts for best results.</li>
                                    <li>Ensure song is in <strong>Key of C Major</strong>.</li>
                                    <li>Supports: <strong> .mxl  .xml  .mid  .json </strong></li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    <div style={{ marginTop: '20px', paddingBottom: '20px', fontSize: '0.75rem', color: '#999', opacity: 0.7 }}>
                        v2.2-UI
                    </div>
                </div>
            )}

            {view === 'judge' && (
                <PDMXLocalJudge
                    onExit={() => setView('menu')}
                    onImport={handlePDMXImport}
                />
            )}

            {view === 'game' && selectedSong && (
                <GameCanvas
                    onExit={() => setView('menu')}
                    // @ts-ignore
                    song={selectedSong}
                    onComplete={handleGameCompletion}
                    perfectionistMode={isPerfectionist}
                />
            )}

            {view === 'results' && lastStats && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
                    background: '#ffffff', // White
                    color: '#1a1a1a', // Black text
                    zIndex: 999
                }}>
                    {lastStats.missed === 0 && lastStats.good === 0 ? (
                        <div className="perfect-celebration">
                            <h1 style={{ color: '#E65100', fontSize: '3rem', margin: 0 }}>
                                PERFECT PERFORMANCE!
                            </h1>
                            <div style={{ fontSize: '6rem', marginBottom: '20px' }}>🏅</div>
                        </div>
                    ) : lastStats.missed === 0 ? (
                        <div className="full-combo-celebration">
                            <h1 style={{ color: '#1a1a1a', fontSize: '3rem', margin: 0 }}>
                                FULL COMBO!
                            </h1>
                            <div style={{ fontSize: '6rem', marginBottom: '20px' }}>🥈</div>
                        </div>
                    ) : (
                        // Standard Completion
                        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                            <h1 style={{ fontSize: '2.5rem', margin: 0, color: '#E65100' }}>Song Complete!</h1>
                            <div style={{ width: '60px', height: '4px', background: '#E65100', margin: '10px auto', borderRadius: '2px' }}></div>
                        </div>
                    )}

                    <div className="stats-grid" style={{
                        background: '#f9f9f9', // Light grey card 
                        padding: '30px',
                        borderRadius: '20px',
                        minWidth: '320px',
                        marginBottom: '40px',
                        border: '1px solid #eee',
                        boxShadow: '0 10px 30px rgba(0,0,0,0.1)' // Lighter shadow
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                            <span style={{ fontSize: '1.1rem', color: '#666' }}>Score</span>
                            <span style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1a1a1a' }}>{lastStats.score}</span>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <span style={{ fontSize: '1.1rem', color: '#666' }}>Max Combo</span>
                            <span style={{ fontSize: '2rem', fontWeight: 'bold', color: '#E65100' }}>{lastStats.maxStreak}</span>
                        </div>

                        <div className="divider" style={{ borderBottom: '1px solid #eee', margin: '20px 0' }}></div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span style={{ color: '#E65100', fontWeight: 'bold' }}>Perfect</span>
                            <span>{lastStats.perfect}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span style={{ color: '#333', fontWeight: 'bold' }}>Good</span>
                            <span>{lastStats.good}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#d32f2f', fontWeight: 'bold' }}>Missed</span>
                            <span>{lastStats.missed}</span>
                        </div>
                    </div>

                    <div className="results-buttons" style={{ display: 'flex', gap: '20px' }}>
                        <button
                            onClick={() => selectedSong && handleStartGame(selectedSong)}
                            style={{
                                background: '#E65100',
                                color: 'white',
                                border: 'none',
                                padding: '15px 30px',
                                borderRadius: '30px',
                                fontSize: '1.1rem',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                boxShadow: '0 4px 15px rgba(230, 81, 0, 0.4)'
                            }}
                        >
                            Retry Song
                        </button>
                        <button
                            onClick={() => setView('menu')}
                            style={{
                                background: 'transparent',
                                color: '#aaa',
                                border: '1px solid #444',
                                padding: '15px 30px',
                                borderRadius: '30px',
                                fontSize: '1.1rem',
                                fontWeight: 'bold',
                                cursor: 'pointer'
                            }}
                        >
                            Back to Menu
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default App;
