import React, { useEffect, useRef } from 'react';
import { usePitchDetector } from '../audio/PitchDetection';

const Tuner: React.FC = () => {
    const { isListening, startListening, stopListening, pitch, currentNote } = usePitchDetector();
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (isListening && canvasRef.current) {
            // simple visualizer if needed, but for now just text is fine
        }
    }, [isListening, pitch]);

    return (
        <div className="tuner-container">
            <h1>Harmonica Tuner (Key of C)</h1>

            <div className="controls">
                {!isListening ? (
                    <button onClick={startListening} className="btn-start">
                        Start Microphone
                    </button>
                ) : (
                    <button onClick={stopListening} className="btn-stop">
                        Stop
                    </button>
                )}
            </div>

            <div className="display">
                <div className="frequency-display">
                    <span className="label">Frequency:</span>
                    <span className="value">{pitch.toFixed(1)} Hz</span>
                </div>

                <div className={`note-display ${currentNote ? 'active' : ''}`}>
                    {currentNote ? (
                        <>
                            <div className="hole-number">
                                {currentNote.note === 'G4' ? "2 / 3" : currentNote.hole}
                            </div>
                            <div className="note-type">
                                {currentNote.note === 'G4' ? "DRAW / BLOW" : currentNote.type.toUpperCase()}
                            </div>
                            <div className="note-name">{currentNote.note}</div>
                        </>
                    ) : (
                        <div className="waiting">
                            {isListening ? "Listening..." : "Press Start"}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Tuner;
