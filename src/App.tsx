import { useState, useEffect, useRef } from 'react';
import './App.css';
import GameCanvas from './components/GameCanvas';
import { songManager } from './game/SongManager';
import type { Song } from './game/Types';

import { Capacitor } from '@capacitor/core';

function App() {
  const [view, setView] = useState<'menu' | 'game' | 'results'>('menu');
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [lastStats, setLastStats] = useState<any>(null);
  const [savedData, setSavedData] = useState<any>({ stars: {}, highScores: {} });
  const [isPerfectionist, setIsPerfectionist] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const touchStartPos = useRef<{ x: number, y: number } | null>(null);

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
    }, 800); // Increased from 600ms to 800ms
  };

  const handleTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
    // Cancel long press if user is scrolling
    if (touchStartPos.current && longPressTimerRef.current) {
      const currentX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const currentY = 'touches' in e ? e.touches[0].clientY : e.clientY;

      const deltaX = Math.abs(currentX - touchStartPos.current.x);
      const deltaY = Math.abs(currentY - touchStartPos.current.y);

      // If moved more than 10px, cancel the long press
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
    if (isLongPressRef.current) return; // Ignore click if it was a long press
    setSelectedSong(song);
    setView('game');
  };

  const handleGameCompletion = async (stats: any) => {
    setLastStats(stats);

    if (selectedSong) {
      // Save via Manager (handles Gold, Silver, Bronze logic)
      const starsEarned = await songManager.saveScore(selectedSong.id, stats);

      // Update UI state
      setSavedData((prev: any) => ({
        stars: {
          ...prev.stars,
          [selectedSong.id]: starsEarned
        },
        highScores: {
          ...prev.highScores,
          [selectedSong.id]: stats // Store full stats for percentage calc
        }
      }));
    }
    setView('results');
  };

  const handleLogin = async () => {
    if (!usernameInput) return;
    try {
      // Simple hash for prototype (Not secure for real prod)
      const hash = btoa(passwordInput || "nopass");
      const u = await songManager.login(usernameInput, hash);
      setUser(u as { username: string });
      setShowLogin(false);
      // Refresh songs/scores
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
    setSavedData({ stars: {} }); // Reset view
  };

  return (
    <div className="app-container">
      {/* Auth UI - Hidden on Android */}
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
            <img src="/logo.png" alt="Harmonica Hero Logo" className="logo-img" />
            <h1 className="main-title">Harmonica Hero</h1>
            <p className="subtitle">Learn. Play. Master the C Harp.</p>

            {/* Mode Toggle */}
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

          <div className="song-grid" style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center' }}>
            {songs
              .sort((a, b) => {
                const aFav = favorites.has(a.id) ? 1 : 0;
                const bFav = favorites.has(b.id) ? 1 : 0;
                return bFav - aFav; // Favorites first
              })
              .map(song => {
                const bestStats = savedData.highScores?.[song.id];
                const bestPercent = bestStats ? Math.round((bestStats.score / (bestStats.perfect + bestStats.good + bestStats.missed)) * 100) : 0;

                return (
                  <button
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
                      width: '100%', maxWidth: '600px',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      background: '#E65100', // Orange as requested
                      border: favorites.has(song.id) ? '2px solid #FFD700' : 'none',
                      position: 'relative',
                      overflow: 'hidden'
                    }}
                  >
                    <div style={{ textAlign: 'left', zIndex: 2, flex: 1 }}>
                      <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{song.title}</div>
                      <span style={{ opacity: 0.8, fontSize: '0.9rem', display: 'block' }}>{song.artist}</span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '12px', zIndex: 2 }}>
                      {/* Best Percentage */}
                      {bestPercent > 0 && (
                        <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'rgba(255,255,255,0.9)' }}>
                          Best: {bestPercent}%
                        </div>
                      )}

                      {/* Star Badge */}
                      {savedData.stars[song.id] && savedData.stars[song.id] !== 'none' && (
                        <div className="star-badge" title={savedData.stars[song.id].toUpperCase()} style={{ fontSize: '1.2rem' }}>
                          {savedData.stars[song.id] === 'gold' && '🏅'}
                          {savedData.stars[song.id] === 'silver' && '🥈'}
                          {savedData.stars[song.id] === 'bronze' && '🥉'}
                        </div>
                      )}

                      {/* Favorite Heart Icon - Only show for favorited songs */}
                      {favorites.has(song.id) && (
                        <svg
                          width="24"
                          height="24"
                          viewBox="0 0 24 24"
                          fill="white"
                          style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}
                        >
                          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                        </svg>
                      )}
                    </div>
                  </button>
                )
              })}
          </div>

          {/* Version Number */}
          <div style={{
            marginTop: '20px',
            paddingBottom: '20px',
            fontSize: '0.75rem',
            color: '#999',
            opacity: 0.7
          }}>
            v1.0.0
          </div>
        </div>
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
        <div className="results-overlay modal-glass" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: 'rgba(0,0,0,0.9)' }}>
          {lastStats.missed === 0 && lastStats.good === 0 ? (
            <div className="perfect-celebration">
              <h1 style={{ color: '#FFD700', fontSize: '3rem', textShadow: '0 0 20px #E65100', margin: 0 }}>
                PERFECT PERFORMANCE!
              </h1>
              <div style={{ fontSize: '6rem', marginBottom: '20px' }}>🏅</div>
            </div>
          ) : lastStats.missed === 0 ? (
            <div className="full-combo-celebration">
              <h1 style={{ color: '#C0C0C0', fontSize: '3rem', margin: 0 }}>
                FULL COMBO!
              </h1>
              <div style={{ fontSize: '6rem', marginBottom: '20px' }}>🥈</div>
            </div>
          ) : (
            <h2>Song Complete!</h2>
          )}

          <div className="stats-grid" style={{ background: '#222', padding: '20px', borderRadius: '10px', minWidth: '300px', marginBottom: '30px' }}>
            <div style={{ color: '#E65100', fontSize: '2rem', fontWeight: 'bold', marginBottom: '10px' }}>Max Combo: {lastStats.maxStreak}</div>
            <div style={{ fontSize: '1.2rem', marginBottom: '10px', opacity: 0.8 }}>Total Notes Hit: {lastStats.score} / {lastStats.perfect + lastStats.good + lastStats.missed}</div>
            <div className="divider" style={{ borderBottom: '1px solid #444', margin: '15px 0' }}></div>
            <div style={{ color: '#FFD700' }}>Perfect: {lastStats.perfect}</div>
            <div style={{ color: '#FFA726' }}>Good: {lastStats.good}</div>
            <div style={{ color: '#d32f2f' }}>Missed: {lastStats.missed}</div>
          </div>

          <div className="results-buttons" style={{ display: 'flex', gap: '20px' }}>
            <button className="metro-btn large" onClick={() => selectedSong && handleStartGame(selectedSong)}>Retry Song</button>
            <button className="metro-btn large secondary" onClick={() => setView('menu')}>Back to Menu</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
