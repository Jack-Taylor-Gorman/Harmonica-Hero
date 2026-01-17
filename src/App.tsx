import { useState, useEffect } from 'react';
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
  const [savedData, setSavedData] = useState<any>({ stars: {} });

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
      scores.forEach(s => {
        starMap[s.songId] = s.stars;
      });
      setSavedData({ stars: starMap });

      // AUTO-START REMOVED: User requested a button for Katyusha.
      // The menu will render the single song from Songs.ts.
      /*
      if (allSongs.length > 0) {
        console.log("Auto-starting " + allSongs[0].title);
        setSelectedSong(allSongs[0]);
        setView('game');
      }
      */
    };
    init();
  }, []);

  const handleStartGame = (song: Song) => {
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
          </div>

          <div className="song-grid" style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center' }}>
            {songs.map(song => (
              <button key={song.id} className="metro-btn song-select-btn" onClick={() => handleStartGame(song)} style={{ width: '100%', maxWidth: '600px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ textAlign: 'left' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{song.title}</span>
                  <span style={{ marginLeft: '10px', opacity: 0.7 }}>{song.artist}</span>
                </div>

                {/* Star Badge */}
                {savedData.stars[song.id] && savedData.stars[song.id] !== 'none' && (
                  <div className="star-badge" title={savedData.stars[song.id].toUpperCase()} style={{ fontSize: '1.2rem' }}>
                    {savedData.stars[song.id] === 'gold' && '🏅'}
                    {savedData.stars[song.id] === 'silver' && '🥈'}
                    {savedData.stars[song.id] === 'bronze' && '🥉'}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {view === 'game' && selectedSong && (
        <GameCanvas
          onExit={() => setView('menu')}
          // @ts-ignore
          song={selectedSong}
          onComplete={handleGameCompletion}
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
