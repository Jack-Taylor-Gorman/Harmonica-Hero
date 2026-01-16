import { useState } from 'react'
import './App.css'
import Tuner from './components/Tuner'
import GameCanvas from './components/GameCanvas'
import { SONGS } from './game/Songs'
import type { Song } from './game/Types'

function App() {
  const [view, setView] = useState<'menu' | 'tuner' | 'game'>('menu');
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);

  const handleStartGame = (song: Song) => {
    setSelectedSong(song);
    setView('game');
  };

  return (
    <div className="app-container">
      {view === 'menu' && (
        <div className="menu">
          <h1>Harmonica Hero</h1>

          <div className="song-list">
            <h2>Select a Song</h2>
            {SONGS.map(song => (
              <button key={song.id} className="song-btn" onClick={() => handleStartGame(song)}>
                {song.title} <span className="artist">- {song.artist}</span>
              </button>
            ))}
          </div>

          <div className="menu-buttons">
            <button className="secondary" onClick={() => setView('tuner')}>Tuner / Mic Check</button>
          </div>
        </div>
      )}

      {view === 'tuner' && (
        <div className="view-container">
          <button className="back-btn" onClick={() => setView('menu')}>← Back</button>
          <Tuner />
        </div>
      )}

      {view === 'game' && selectedSong && (
        <GameCanvas song={selectedSong} onExit={() => setView('menu')} />
      )}
    </div>
  )
}

export default App
