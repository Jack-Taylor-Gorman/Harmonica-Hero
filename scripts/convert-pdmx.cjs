#!/usr/bin/env node
/**
 * Convert PDMX CSV data to Harmonica Hero Songs.ts format
 * Preserves proper BPM and timing from the source data
 */

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

// Calculate BPM from PDMX metadata
function calculateBPM(songLengthSeconds, songLengthBeats) {
    if (!songLengthSeconds || !songLengthBeats || songLengthSeconds === 0) {
        return 120; // Default fallback
    }
    // BPM = (beats / seconds) * 60
    const bpm = (songLengthBeats / songLengthSeconds) * 60;
    return Math.round(bpm);
}

// Read and parse PDMX CSV
function loadPDMXData(csvPath) {
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true
    });
    return records;
}

// Filter for suitable songs (public domain, reasonable complexity)
function filterSongs(records) {
    return records.filter(record => {
        // Must be public domain
        if (record.license !== 'publicdomain' && record.license !== 'cc-zero') {
            return false;
        }
        // Must have valid timing data
        if (!record['song_length.seconds'] || !record['song_length.beats']) {
            return false;
        }
        // Reasonable complexity (not too many notes)
        const nNotes = parseInt(record.n_notes);
        if (nNotes > 1000 || nNotes < 10) {
            return false;
        }
        return true;
    });
}

// Convert PDMX record to Song format
// Note: This is a simplified version - actual melody conversion would require
// parsing the JSON/MXL files to extract note pitches and durations
function convertToSong(record, index) {
    const songLengthSeconds = parseFloat(record['song_length.seconds']);
    const songLengthBeats = parseFloat(record['song_length.beats']);
    const bpm = calculateBPM(songLengthSeconds, songLengthBeats);

    const title = record.title || record.song_name || `Song ${index}`;
    const artist = record.artist_name || record.composer_name || '';

    // Generate a safe ID
    const id = (index + 20000).toString();

    // For now, we'll create placeholder notes
    // TODO: Parse actual JSON/MXL files to extract melody
    const notes = generatePlaceholderNotes(songLengthSeconds, bpm);

    return {
        id,
        title,
        artist,
        bpm,
        offset: 0,
        notes
    };
}

// Generate placeholder notes based on timing
// This should be replaced with actual melody parsing from JSON/MXL
function generatePlaceholderNotes(duration, bpm) {
    const notes = [];
    const beatDuration = 60 / bpm; // seconds per beat
    const numBeats = Math.floor(duration / beatDuration);

    // Create simple placeholder pattern
    for (let i = 0; i < Math.min(numBeats, 50); i++) {
        const time = i * beatDuration;
        const hole = 4 + (i % 4); // Cycle through holes 4-7
        const type = i % 2 === 0 ? 'blow' : 'draw';

        notes.push({
            id: `note-${i}`,
            time,
            hole,
            type,
            duration: beatDuration * 0.8 // 80% of beat duration
        });
    }

    return notes;
}

// Generate TypeScript file content
function generateTSFile(songs) {
    let content = `import type { Song } from './Types';\n\n`;
    content += `export const SONGS: Song[] = [\n`;

    songs.forEach((song, index) => {
        content += `  ${JSON.stringify(song, null, 2)}`;
        if (index < songs.length - 1) {
            content += ',\n';
        }
    });

    content += `\n];\n`;
    return content;
}

// Main conversion function
function main() {
    const csvPath = path.join(__dirname, '..', 'PDMX.csv');
    const outputPath = path.join(__dirname, '..', 'src', 'game', 'Songs.ts');

    console.log('Loading PDMX data...');
    const records = loadPDMXData(csvPath);
    console.log(`Found ${records.length} total records`);

    console.log('Filtering suitable songs...');
    const filtered = filterSongs(records);
    console.log(`Filtered to ${filtered.length} suitable songs`);

    // Take first 100 for now
    const selected = filtered.slice(0, 100);
    console.log(`Converting ${selected.length} songs...`);

    const songs = selected.map((record, index) => convertToSong(record, index));

    console.log('Generating TypeScript file...');
    const tsContent = generateTSFile(songs);

    fs.writeFileSync(outputPath, tsContent, 'utf-8');
    console.log(`✓ Successfully wrote ${songs.length} songs to ${outputPath}`);

    // Print BPM statistics
    const bpms = songs.map(s => s.bpm);
    const avgBPM = bpms.reduce((a, b) => a + b, 0) / bpms.length;
    const minBPM = Math.min(...bpms);
    const maxBPM = Math.max(...bpms);
    console.log(`\nBPM Statistics:`);
    console.log(`  Average: ${avgBPM.toFixed(1)}`);
    console.log(`  Range: ${minBPM} - ${maxBPM}`);
}

if (require.main === module) {
    main();
}

module.exports = { calculateBPM, convertToSong };
