import React, { useState, useEffect, useRef } from 'react';
import * as Tone from 'tone';
import { Filesystem, Directory } from '@capacitor/filesystem';
import type { Song } from '../game/Types';
import { processFile } from '../utils/SongImporter';
import JSZip from 'jszip';

interface PDMXLocalJudgeProps {
    onExit: () => void;
    onImport: (song: Song) => void;
}

const PDMXLocalJudge: React.FC<PDMXLocalJudgeProps> = ({ onExit, onImport }) => {
    const [pathInput, setPathInput] = useState("Download"); // Default to Download folder
    const [candidates, setCandidates] = useState<string[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [status, setStatus] = useState("");
    const [scanning, setScanning] = useState(false);

    // Current Song State
    const [currentSong, setCurrentSong] = useState<Song | null>(null);
    const [editTitle, setEditTitle] = useState("");
    const [isPlaying, setIsPlaying] = useState(false);
    const [loading, setLoading] = useState(false);

    // Audio
    const synthRef = useRef<Tone.PolySynth | null>(null);
    const partRef = useRef<Tone.Part | null>(null);

    // Instrument Whitelist
    const ALLOWED_INSTRUMENTS = [
        'violin', 'flute', 'piccolo', 'recorder', 'voice', 'vocal', 'oboe',
        'harmonica', 'clarinet', 'trumpet', 'saxophone', 'whistle'
    ];

    // Stop audio on unmount
    useEffect(() => {
        return () => stopAudio();
    }, []);

    const stopAudio = () => {
        if (partRef.current) {
            partRef.current.dispose();
            partRef.current = null;
        }
        Tone.Transport.stop();
        Tone.Transport.cancel();
        setIsPlaying(false);
    };

    // Helper: Base64 to Blob
    const b64toBlob = (b64Data: string, contentType = '', sliceSize = 512) => {
        const byteCharacters = atob(b64Data);
        const byteArrays = [];
        for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
            const slice = byteCharacters.slice(offset, offset + sliceSize);
            const byteNumbers = new Array(slice.length);
            for (let i = 0; i < slice.length; i++) {
                byteNumbers[i] = slice.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            byteArrays.push(byteArray);
        }
        return new Blob(byteArrays, { type: contentType });
    };

    const scanDirectory = async () => {
        setScanning(true);
        setStatus("Scanning directory...");
        setCandidates([]);
        setCurrentSong(null);

        try {
            // 1. List files
            const result = await Filesystem.readdir({
                path: pathInput,
                directory: Directory.External
            });

            // Explicitly cast f to any
            const files = result.files.filter((f: any) =>
                f.type === 'file' && (f.name.endsWith('.mxl') || f.name.endsWith('.xml') || f.name.endsWith('.musicxml'))
            );

            setStatus(`Found ${files.length} files. Filtering...`);

            const goodFiles: string[] = [];
            let deleted = 0;

            // 2. Filter loop
            for (const file of files) {
                try {
                    const contents = await Filesystem.readFile({
                        path: `${pathInput}/${file.name}`,
                        directory: Directory.External
                        // No encoding = returns base64 string
                    });

                    // Decode to check content
                    // For MXL we need to unzip. For XML we read text.
                    let xmlContent = "";

                    if (file.name.endsWith('.mxl')) {
                        const blob = b64toBlob(contents.data as string);
                        const zip = await JSZip.loadAsync(blob);
                        const xmlFile = Object.keys(zip.files).find(name => name.endsWith('.xml') || name.endsWith('.musicxml'));
                        if (xmlFile) {
                            xmlContent = await zip.file(xmlFile)!.async("string");
                        }
                    } else {
                        // XML/MusicXML - decode base64 to string
                        xmlContent = atob(contents.data as string);
                    }

                    if (!xmlContent) throw new Error("No XML content");

                    // Simple text-based heuristic check for performance
                    // Check Part List
                    // <part-list> ... <score-part id="P1"> ... </score-part> </part-list>
                    // Count parts
                    const partsMatches = xmlContent.match(/<score-part/g);
                    const partCount = partsMatches ? partsMatches.length : 0;

                    if (partCount > 1) {
                        // DELETE: Too many parts
                        await deleteFile(file.name);
                        deleted++;
                        continue;
                    }

                    // Check Instrument Name
                    // <instrument-name>Violin</instrument-name>
                    // or <part-name>Violin</part-name>
                    const instrumentMatches = xmlContent.match(/<(Part|instrument)-name>(.*?)<\/(Part|instrument)-name>/gi);
                    let isGoodInstrument = false;

                    if (instrumentMatches) {
                        for (const match of instrumentMatches) {
                            const name = match.replace(/<\/?.*?>/g, "").toLowerCase();
                            if (ALLOWED_INSTRUMENTS.some(inst => name.includes(inst))) {
                                isGoodInstrument = true;
                                break;
                            }
                        }
                    } else {
                        // No instrument found? Assume bad/unknown.
                        isGoodInstrument = false;
                    }

                    if (!isGoodInstrument) {
                        // DELETE
                        await deleteFile(file.name);
                        deleted++;
                        continue;
                    }

                    // If we got here, it's good
                    goodFiles.push(file.name);

                } catch (e) {
                    console.error("Filter error on " + file.name, e);
                    // Keep error files? Or Delete? Use caution -> Keep.
                }

                if ((deleted + goodFiles.length) % 10 === 0) {
                    setStatus(`Filtered: ${goodFiles.length} Good, ${deleted} Deleted...`);
                }
            }

            setCandidates(goodFiles);
            setStatus(`Done! ${goodFiles.length} songs ready. (${deleted} deleted)`);
            if (goodFiles.length > 0) {
                loadFile(goodFiles[0]);
            } else {
                setStatus(`Done! No matching songs found. (${deleted} deleted)`);
            }

        } catch (e) {
            setStatus("Error: " + String(e));
        } finally {
            setScanning(false);
        }
    };

    const deleteFile = async (filename: string) => {
        try {
            await Filesystem.deleteFile({
                path: `${pathInput}/${filename}`,
                directory: Directory.External
            });
        } catch (e) {
            console.error("Delete failed", e);
        }
    };

    const loadFile = async (filename: string) => {
        setLoading(true);
        try {
            const contents = await Filesystem.readFile({
                path: `${pathInput}/${filename}`,
                directory: Directory.External
                // No encoding = returns base64
            });

            const blob = b64toBlob(contents.data as string);
            const file = new File([blob], filename);
            const song = await processFile(file); // Uses our importer logic

            setCurrentSong(song);
            setEditTitle(song.title);

            // Auto-play? Maybe wait for user.

        } catch (e) {
            console.error("Load failed", e);
            setStatus("Failed to load " + filename);
            // Skip?
            handleTrash(); // Auto-skip bad files during play flow
        } finally {
            setLoading(false);
        }
    };

    const playPreview = async () => {
        if (!currentSong) return;

        await Tone.start();
        stopAudio();

        if (!synthRef.current) {
            synthRef.current = new Tone.PolySynth(Tone.Synth).toDestination();
            synthRef.current.volume.value = -10;
        }

        const toneEvents = currentSong.notes.map(n => ({
            time: n.time,
            note: getNoteName(n.hole, n.type),
            duration: n.duration
        }));

        partRef.current = new Tone.Part((time, event) => {
            synthRef.current?.triggerAttackRelease(event.note, event.duration, time);
        }, toneEvents).start(0);

        Tone.Transport.bpm.value = currentSong.bpm;
        Tone.Transport.start();
        setIsPlaying(true);
    };

    const handleKeep = async () => {
        if (!currentSong) return;

        const songToSave = { ...currentSong, title: editTitle };
        onImport(songToSave);

        nextSong();
    };

    const handleTrash = async () => {
        // Delete file from disk
        if (candidates[currentIndex]) {
            await deleteFile(candidates[currentIndex]);
        }
        nextSong();
    };

    const nextSong = () => {
        stopAudio();
        const next = currentIndex + 1;
        if (next < candidates.length) {
            setCurrentIndex(next);
            loadFile(candidates[next]);
        } else {
            setStatus("All songs reviewed!");
            setCurrentSong(null);
        }
    };

    // Helper
    const getNoteName = (hole: number, type: 'blow' | 'draw') => {
        const map: any = {
            1: { blow: 'C4', draw: 'D4' },
            2: { blow: 'E4', draw: 'G4' },
            3: { blow: 'G4', draw: 'B4' },
            4: { blow: 'C5', draw: 'D5' },
            5: { blow: 'E5', draw: 'F5' },
            6: { blow: 'G5', draw: 'A5' },
            7: { blow: 'C6', draw: 'B5' },
            8: { blow: 'E6', draw: 'D6' },
            9: { blow: 'G6', draw: 'F6' },
            10: { blow: 'C7', draw: 'A6' }
        };
        return map[hole]?.[type] || 'C4';
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: '#1a1a1a', color: '#fff',
            display: 'flex', flexDirection: 'column',
            zIndex: 1000, padding: '20px'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h2>📂 Local Judge</h2>
                <button onClick={onExit} style={{ background: 'transparent', border: '1px solid #666', color: '#fff', padding: '5px 10px', borderRadius: '5px' }}>Exit</button>
            </div>

            {/* Scan Controls */}
            {candidates.length === 0 && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '20px' }}>
                    <p>Enter the folder path relative to <strong>Internal Storage</strong> (e.g. Download/PDMX).</p>
                    <input
                        value={pathInput}
                        onChange={(e) => setPathInput(e.target.value)}
                        placeholder="Folder Name (e.g. PDMX)"
                        style={{ padding: '15px', borderRadius: '10px', border: 'none' }}
                    />
                    <button
                        onClick={scanDirectory}
                        disabled={scanning}
                        style={{
                            padding: '20px', background: '#E65100', color: '#fff',
                            border: 'none', borderRadius: '15px', fontSize: '1.2rem', fontWeight: 'bold'
                        }}
                    >
                        {scanning ? 'Scanning & Filtering...' : '📁 Scan & Filter'}
                    </button>
                    <div style={{ color: '#aaa', fontSize: '0.9rem', whiteSpace: 'pre-wrap' }}>{status}</div>
                </div>
            )}

            {/* Judging Interface */}
            {candidates.length > 0 && currentSong && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '20px' }}>
                    <div style={{ fontSize: '0.9rem', color: '#aaa', alignSelf: 'flex-start' }}>
                        {currentIndex + 1} / {candidates.length}
                    </div>

                    <div style={{ width: '100%', maxWidth: '400px' }}>
                        <label style={{ display: 'block', fontSize: '0.8rem', color: '#888', marginBottom: '5px' }}>Song Title</label>
                        <input
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            style={{
                                width: '100%', padding: '15px', fontSize: '1.2rem',
                                background: '#333', border: '1px solid #444', color: '#fff', borderRadius: '10px'
                            }}
                        />
                    </div>

                    <div style={{ fontSize: '0.9rem', color: '#aaa' }}>{currentSong.artist}</div>
                    <div style={{ fontSize: '0.8rem', fontFamily: 'monospace', color: '#666' }}>{candidates[currentIndex]}</div>

                    <div style={{ display: 'flex', gap: '20px', marginTop: '30px' }}>
                        <button
                            onClick={isPlaying ? stopAudio : playPreview}
                            style={{
                                width: '80px', height: '80px', borderRadius: '50%',
                                background: isPlaying ? '#ff9800' : '#4caf50',
                                border: 'none', color: '#fff', fontSize: '2rem',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                boxShadow: '0 5px 15px rgba(0,0,0,0.3)'
                            }}
                        >
                            {isPlaying ? '⏹️' : '▶️'}
                        </button>
                    </div>
                </div>
            )}

            {loading && candidates.length > 0 && <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading song...</div>}

            {candidates.length > 0 && !loading && (
                <div style={{ display: 'flex', gap: '20px', paddingBottom: '20px' }}>
                    <button
                        onClick={handleTrash}
                        style={{
                            flex: 1, padding: '20px', borderRadius: '15px',
                            background: '#d32f2f', border: 'none', color: '#fff', fontSize: '1.2rem', fontWeight: 'bold'
                        }}
                    >
                        🗑️ Trash (Delete File)
                    </button>
                    <button
                        onClick={handleKeep}
                        style={{
                            flex: 1, padding: '20px', borderRadius: '15px',
                            background: '#4caf50', border: 'none', color: '#fff', fontSize: '1.2rem', fontWeight: 'bold'
                        }}
                    >
                        💾 Keep
                    </button>
                </div>
            )}
        </div>
    );
};

export default PDMXLocalJudge;
