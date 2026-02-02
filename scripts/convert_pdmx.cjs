const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');
const JSZip = require('jszip');

const INPUT_DIR = process.argv[2] || 'temp/PDMX_SAMPLE';
const OUTPUT_DIR = process.argv[3] || 'converted_songs';

// C Diatonic Harmonica Mapping (Hole, Blow/Draw)
const NOTE_MAP = {
    // Hole 1
    60: { hole: 1, type: 'blow' }, // C4
    62: { hole: 1, type: 'draw' }, // D4
    // Hole 2
    64: { hole: 2, type: 'blow' }, // E4
    67: { hole: 2, type: 'draw' }, // G4
    // Hole 3
    67: { hole: 3, type: 'blow' }, // G4 (Duplicate, prefer 2 Draw usually but 3 Blow is valid)
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

// Helper: MIDI Note Number from Step/Octave
function getMidiNote(step, octave, alter = 0) {
    const steps = { 'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11 };
    let note = steps[step] + (octave + 1) * 12 + parseInt(alter || 0);
    return note;
}

async function readXmlContent(filePath) {
    if (filePath.endsWith('.mxl')) {
        try {
            const data = fs.readFileSync(filePath);
            const zip = await JSZip.loadAsync(data);

            // Find the main XML file. Usually ends in .xml or .musicxml
            // Or look in META-INF/container.xml (Skip for simple heuristic)
            const xmlFile = Object.keys(zip.files).find(name =>
                name.endsWith('.xml') && !name.includes('META-INF') && !name.includes('container.xml')
            );

            if (xmlFile) {
                return await zip.file(xmlFile).async('string');
            } else {
                // Fallback: take *any* xml that isn't container
                const anyXml = Object.keys(zip.files).find(name => name.endsWith('.xml'));
                if (anyXml) return await zip.file(anyXml).async('string');
            }
            return null;
        } catch (e) {
            console.error(`Failed to unzip ${filePath}:`, e);
            return null;
        }
    } else {
        return fs.readFileSync(filePath, 'utf8');
    }
}

async function convertFile(filePath) {
    const parser = new xml2js.Parser();
    const xml = await readXmlContent(filePath);

    if (!xml) {
        console.warn(`Skipping ${filePath}: No XML content found.`);
        return null;
    }

    try {
        const result = await parser.parseStringPromise(xml);

        // Handle Score-Partwise
        let score = result['score-partwise'];
        // Sometimes it's score-timewise? Assume partwise for PDMX.
        if (!score) return null;

        let part = score.part;
        if (!part) return null;

        // If multiple parts, pick first (melody usually)
        if (Array.isArray(part)) part = part[0];

        // Metadata
        let title = path.basename(filePath, path.extname(filePath));
        if (score.work && score.work[0]['work-title']) {
            title = score.work[0]['work-title'][0];
        } else if (score.movement_title) {
            title = score.movement_title[0];
        }

        // Find Tempo (BPM)
        let bpm = 120;
        try {
            // Look in first few measures for sound tempo
            const measures = part.measure;
            for (let i = 0; i < Math.min(5, measures.length); i++) {
                const m = measures[i];
                if (m.direction) {
                    for (const d of m.direction) {
                        if (d.sound && d.sound[0].$ && d.sound[0].$.tempo) {
                            bpm = parseFloat(d.sound[0].$.tempo);
                            break;
                        }
                    }
                }
                if (bpm !== 120) break;
            }
        } catch (e) { }

        const finalNotes = [];
        let currentTime = 0;
        let lastNoteTime = -1;

        // Process Measures
        const measures = part.measure;
        for (const measure of measures) {

            // Calculate timing for this measure
            // MusicXML timing is based on 'divisions' (ticks per quarter note)
            let divisions = 1;
            // Divisions are usually defined in attributes of the first measure, or changed later
            // We need to track current divisions.
            // Simplified: Look for divisions in this measure, update state.

            if (measure.attributes) {
                for (const attr of measure.attributes) {
                    if (attr.divisions) {
                        divisions = parseInt(attr.divisions[0]);
                    }
                }
            }
            // NOTE: If divisions wasn't in this measure, it persists from previous.
            // We need to persist state variable outside loop if we want accuracy.
            // But 'divisions' usually appears in first measure.
            // Let's hoist divisions state outside loop? 
            // Ideally yes. But `measure.attributes` is an array.

            // Quick fix: define divisions as state
        }

        // Correct approach with state:
        let currentDivisions = 1;

        for (const measure of part.measure) {
            if (measure.attributes) {
                for (const attr of measure.attributes) {
                    if (attr.divisions) {
                        currentDivisions = parseInt(attr.divisions[0]);
                    }
                }
            }

            const secondsPerBeat = 60 / bpm;
            const secondsPerDiv = secondsPerBeat / currentDivisions;

            if (!measure.note) continue;

            for (const note of measure.note) {
                // Duration in divisions
                let durationDivs = 0;
                if (note.duration) durationDivs = parseInt(note.duration[0]);

                const noteDuration = durationDivs * secondsPerDiv;

                // Chord logic
                const isChord = note.chord !== undefined;
                const noteTime = isChord ? lastNoteTime : currentTime;

                if (!isChord) {
                    // Start time is current time
                    // Advance time ONLY if not chord? 
                    // Wait. In MusicXML, notes in sequence advance time. Chords do not.
                    // Correct.
                    // But we advance AFTER processing note?
                    // Yes.
                }

                if (note.rest) {
                    if (!isChord) currentTime += noteDuration;
                    continue;
                }

                // Pitch
                const pitch = note.pitch?.[0];
                if (pitch) {
                    const step = pitch.step[0];
                    const octave = parseInt(pitch.octave[0]);
                    const alter = pitch.alter ? parseFloat(pitch.alter[0]) : 0;

                    const midi = getMidiNote(step, octave, alter);
                    const mapping = NOTE_MAP[midi];

                    if (mapping) {
                        // Monophony Conflict Resolution
                        const existingIndex = finalNotes.findIndex(n => Math.abs(n.time - noteTime) < 0.001);

                        if (existingIndex !== -1) {
                            // Determine priority: Highest Pitch wins
                            // We don't store midi in finalNotes, just hole.
                            // But we can infer pitch roughly from hole? 
                            // Or just accept that "latest note in XML for same time" is usually top note in chords? 
                            // Actually in MusicXML chords, notes are usually listed bottom-to-top or top-to-bottom.
                            // Let's assume we OVERWRITE to keep the "last" one (which is often top).
                            finalNotes[existingIndex] = {
                                time: parseFloat(noteTime.toFixed(3)),
                                hole: mapping.hole,
                                type: mapping.type,
                                duration: parseFloat((noteDuration * 0.9).toFixed(3))
                            };
                        } else {
                            finalNotes.push({
                                time: parseFloat(noteTime.toFixed(3)),
                                hole: mapping.hole,
                                type: mapping.type,
                                duration: parseFloat((noteDuration * 0.9).toFixed(3))
                            });
                        }
                    }
                }

                if (!isChord) {
                    lastNoteTime = currentTime;
                    currentTime += noteDuration;
                }
            }
        }

        finalNotes.sort((a, b) => a.time - b.time);

        return {
            title: title,
            bpm: bpm,
            notes: finalNotes
        };

    } catch (err) {
        console.error(`Error parsing ${filePath}:`, err);
        return null;
    }
}

async function main() {
    if (!fs.existsSync(INPUT_DIR)) {
        console.error(`Input directory ${INPUT_DIR} does not exist!`);
        return;
    }
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR);
    }

    const files = fs.readdirSync(INPUT_DIR).filter(f => f.endsWith('.xml') || f.endsWith('.musicxml') || f.endsWith('.mxl'));
    console.log(`Found ${files.length} files in ${INPUT_DIR}`);

    for (const file of files) {
        console.log(`Converting ${file}...`);
        const songData = await convertFile(path.join(INPUT_DIR, file));

        if (songData && songData.notes.length > 0) {
            const cleanTitle = songData.title.replace(/[^a-zA-Z0-9]/g, '_');
            const outFile = path.join(OUTPUT_DIR, `${cleanTitle}.json`);
            fs.writeFileSync(outFile, JSON.stringify(songData, null, 2));
            console.log(`Saved ${outFile}`);
        } else {
            console.log(`Skipped ${file} (No valid notes or parse error)`);
        }
    }
    console.log("Done!");
}

main();
