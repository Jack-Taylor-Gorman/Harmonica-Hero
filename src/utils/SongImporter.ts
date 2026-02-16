import JSZip from 'jszip';
import { Midi } from '@tonejs/midi';
import type { Song, GameNote } from '../game/Types';

// C Diatonic Harmonica Mapping (Hole, Blow/Draw)
// Identical to the previous node script mapping
const NOTE_MAP: Record<number, { hole: number, type: 'blow' | 'draw' }> = {
    // Hole 1
    60: { hole: 1, type: 'blow' }, // C4
    62: { hole: 1, type: 'draw' }, // D4
    // Hole 2
    64: { hole: 2, type: 'blow' }, // E4
    67: { hole: 2, type: 'draw' }, // G4
    // Hole 3
    71: { hole: 3, type: 'draw' }, // B4
    // Hole 4
    72: { hole: 4, type: 'blow' }, // C5
    74: { hole: 4, type: 'draw' }, // D5
    // Hole 5
    76: { hole: 5, type: 'blow' }, // E5
    77: { hole: 5, type: 'draw' }, // F5
    // Hole 6
    79: { hole: 6, type: 'blow' }, // G5
    81: { hole: 6, type: 'draw' }, // A5
    // Hole 7
    84: { hole: 7, type: 'blow' }, // C6
    83: { hole: 7, type: 'draw' }, // B5
    // Hole 8
    88: { hole: 8, type: 'blow' }, // E6
    86: { hole: 8, type: 'draw' }, // D6
    // Hole 9
    91: { hole: 9, type: 'blow' }, // G6
    89: { hole: 9, type: 'draw' }, // F6
    // Hole 10
    96: { hole: 10, type: 'blow' }, // C7
    93: { hole: 10, type: 'draw' }, // A6
};

// Helper to read file as text
const readFileAsText = (file: File | Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = (e) => reject(e);
        reader.readAsText(file);
    });
};

// Helper to read file as ArrayBuffer
const readFileAsBuffer = (file: File | Blob): Promise<ArrayBuffer> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as ArrayBuffer);
        reader.onerror = (e) => reject(e);
        reader.readAsArrayBuffer(file);
    });
};

// Transposition Logic
function getBestTransposition(notes: { midi: number }[]): number {
    let bestShift = 0;
    let maxPlayable = -1;

    // Try shifting -6 to +6 semitones
    for (let shift = -6; shift <= 6; shift++) {
        let playableCount = 0;
        for (const n of notes) {
            const shifted = n.midi + shift;
            if (NOTE_MAP[shifted]) {
                playableCount++;
            }
        }

        if (playableCount > maxPlayable) {
            maxPlayable = playableCount;
            bestShift = shift;
        }
    }
    return bestShift;
}

export async function processFile(file: File): Promise<Song> {
    const name = file.name.toLowerCase();
    const type = file.type;
    console.log(`Processing file: ${name}, type: ${type}, size: ${file.size}`);

    try {
        if (name.endsWith('.json')) {
            return await parseJson(file);
        } else if (name.endsWith('.xml') || name.endsWith('.musicxml')) {
            return await parseXml(file);
        } else if (name.endsWith('.mxl')) {
            return await parseMxl(file);
        } else if (name.endsWith('.mid') || name.endsWith('.midi')) {
            return await parseMidi(file);
        } else {
            // Fallback for Android sometimes not giving extension or weird type
            if (type.includes('musicxml') || type.includes('xml')) {
                return await parseXml(file);
            }
            if (type.includes('zip') || type.includes('octet-stream')) {
                // Try zip logic first (MXL)
                try {
                    return await parseMxl(file);
                } catch (e) {
                    // If zip fails, maybe it's just a raw xml?
                    console.warn("MXL parse failed on generic type, trying XML", e);
                    return await parseXml(file);
                }
            }

            throw new Error('Unsupported file extension/type. Use JSON, XML, MXL, or MIDI.');
        }
    } catch (e: any) {
        console.error("Import Error:", e);
        throw new Error(`Failed to parse file: ${e.message}`);
    }
}

async function parseJson(file: File): Promise<Song> {
    const text = await readFileAsText(file);
    const data = JSON.parse(text);

    // Validate basic structure
    if (!data.title) throw new Error("Missing 'title' in JSON");

    if (!data.notes && data.tabs) {
        throw new Error("JSON must have 'notes' array. 'tabs' only import is deprecated for this converter.");
    }

    return {
        id: `custom-${Date.now()}`,
        title: data.title,
        artist: data.artist || "Unknown",
        bpm: data.bpm || 120,
        offset: data.offset || 0,
        notes: data.notes.map((n: any, i: number) => ({
            ...n,
            id: n.id || `note-${i}`
        }))
    };
}

async function parseXml(file: File | Blob, filename?: string): Promise<Song> {
    const text = await readFileAsText(file);
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(text, "text/xml");

    // Check for parse errors
    const parseError = xmlDoc.querySelector("parsererror");
    if (parseError) throw new Error("Invalid XML");

    const titleNode = xmlDoc.querySelector("work-title") || xmlDoc.querySelector("movement-title");
    const title = titleNode?.textContent || (filename ? filename.replace(/\.[^/.]+$/, "") : "Imported XML");

    // Attempt to find BPM
    let bpm = 120;
    const soundNode = xmlDoc.querySelector("sound[tempo]");
    if (soundNode) {
        const tempo = parseFloat(soundNode.getAttribute("tempo") || "120");
        if (!isNaN(tempo)) bpm = tempo;
    }

    const rawNotes: { midi: number, time: number, duration: number }[] = [];
    const parts = xmlDoc.querySelectorAll("part");

    // Process first part only for melody
    if (parts.length > 0) {
        const part = parts[0];
        const measures = part.querySelectorAll("measure");

        let currentTime = 0;
        let lastNoteTime = 0;
        let currentDivisions = 1;

        measures.forEach((measure) => {
            const divsNode = measure.querySelector("attributes > divisions");
            if (divsNode) currentDivisions = parseInt(divsNode.textContent || "1");

            const secondsPerBeat = 60 / bpm;
            const secondsPerDiv = secondsPerBeat / currentDivisions;

            const measureNotes = measure.querySelectorAll("note");

            measureNotes.forEach((noteNode) => {
                const rest = noteNode.querySelector("rest");
                const chord = noteNode.querySelector("chord");
                const durationNode = noteNode.querySelector("duration");

                let durationDivs = 0;
                if (durationNode) durationDivs = parseInt(durationNode.textContent || "0");
                const durationSec = durationDivs * secondsPerDiv;

                const isChord = chord !== null;
                const noteTime = isChord ? lastNoteTime : currentTime;

                if (!rest) {
                    const pitchNode = noteNode.querySelector("pitch");
                    if (pitchNode) {
                        const step = pitchNode.querySelector("step")?.textContent || "C";
                        const octave = parseInt(pitchNode.querySelector("octave")?.textContent || "4");
                        const alterNode = pitchNode.querySelector("alter");
                        const alter = alterNode ? parseInt(alterNode.textContent || "0") : 0;

                        const midi = getMidiNote(step, octave, alter);
                        rawNotes.push({ midi, time: noteTime, duration: durationSec });
                    }
                }

                if (!isChord) {
                    lastNoteTime = currentTime;
                    currentTime += durationSec;
                }
            });
        });
    }

    // Auto-Transpose
    const safestShift = getBestTransposition(rawNotes);
    let warning = undefined;
    if (safestShift !== 0) {
        const direction = safestShift > 0 ? "+" : "";
        warning = `Auto-Adjusted: ${direction}${safestShift} semitones to fit C Harmonica`;
    }

    // Convert to GameNotes
    const notes: GameNote[] = [];
    rawNotes.forEach(raw => {
        const shiftedMidi = raw.midi + safestShift;
        const mapping = NOTE_MAP[shiftedMidi];

        if (mapping) {
            // Overwrite existing at same time (monophony-ish)
            const existingIdx = notes.findIndex(n => Math.abs(n.time - raw.time) < 0.01);
            const newNote: GameNote = {
                id: "",
                time: parseFloat(raw.time.toFixed(3)),
                hole: mapping.hole,
                type: mapping.type,
                duration: parseFloat((raw.duration * 0.9).toFixed(3))
            };

            if (existingIdx !== -1) {
                notes[existingIdx] = newNote;
            } else {
                notes.push(newNote);
            }
        }
    });

    // Assign IDs and Sort
    notes.sort((a, b) => a.time - b.time);
    const songId = `imported-${Date.now()}`;
    notes.forEach((n, i) => n.id = `${songId}-${i}`);

    return {
        id: songId,
        title: title,
        artist: "Imported XML",
        bpm: bpm,
        offset: 0,
        notes: notes,
        warning: warning
    };
}

async function parseMxl(file: File): Promise<Song> {
    const buffer = await readFileAsBuffer(file);
    const zip = await JSZip.loadAsync(buffer);

    const xmlFilename = Object.keys(zip.files).find(name =>
        (name.endsWith('.xml') || name.endsWith('.musicxml')) && !name.includes('META-INF') && !name.includes('container.xml')
    );

    if (!xmlFilename) throw new Error("No MusicXML file found inside MXL archive");

    const xmlContent = await zip.file(xmlFilename)!.async("string");
    const blob = new Blob([xmlContent], { type: "text/xml" });
    return parseXml(blob, file.name.replace('.mxl', ''));
}

async function parseMidi(file: File): Promise<Song> {
    const buffer = await readFileAsBuffer(file);
    const midi = new Midi(buffer);
    const title = midi.name || file.name.replace(/\.[^/.]+$/, "");

    let bpm = 120;
    if (midi.header.tempos.length > 0) {
        bpm = midi.header.tempos[0].bpm;
    }

    const rawNotes: { midi: number, time: number, duration: number }[] = [];

    midi.tracks.forEach(track => {
        track.notes.forEach(midiNote => {
            rawNotes.push({
                midi: midiNote.midi,
                time: midiNote.time,
                duration: midiNote.duration
            });
        });
    });

    // Auto-Transpose
    const safestShift = getBestTransposition(rawNotes);
    let warning = undefined;
    if (safestShift !== 0) {
        const direction = safestShift > 0 ? "+" : "";
        warning = `Auto-Adjusted: ${direction}${safestShift} semitones`;
    }

    const notes: GameNote[] = [];
    rawNotes.forEach(raw => {
        const shiftedMidi = raw.midi + safestShift;
        const mapping = NOTE_MAP[shiftedMidi];

        if (mapping) {
            const existingIdx = notes.findIndex(n => Math.abs(n.time - raw.time) < 0.01);
            const newNote: GameNote = {
                id: "",
                time: parseFloat(raw.time.toFixed(3)),
                hole: mapping.hole,
                type: mapping.type,
                duration: parseFloat((raw.duration * 0.9).toFixed(3))
            };

            if (existingIdx !== -1) {
                notes[existingIdx] = newNote;
            } else {
                notes.push(newNote);
            }
        }
    });

    notes.sort((a, b) => a.time - b.time);
    const songId = `imported-${Date.now()}`;
    notes.forEach((n, i) => n.id = `${songId}-${i}`);

    return {
        id: songId,
        title: title,
        artist: "Imported MIDI",
        bpm: bpm,
        offset: 0,
        notes: notes,
        warning: warning
    };
}

function getMidiNote(step: string, octave: number, alter: number = 0): number {
    const steps: Record<string, number> = { 'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11 };
    let note = steps[step] + (octave + 1) * 12 + alter;
    return note;
}
