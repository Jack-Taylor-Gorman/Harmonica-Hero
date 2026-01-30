const fs = require('fs');
const path = require('path');

const EXTRACTED_PATH = path.join(__dirname, '..', 'extracted_songs.json');
const SONGS_TS_PATH = path.join(__dirname, '..', 'src', 'game', 'Songs.ts');

const BPM_MAP = {
    "Katyusha": { bpm: 126, artist: "Matvey Blanter" },
    "auld lang syne": { bpm: 64, artist: "Traditional" },
    "Silent Night! Holy Night!": { bpm: 72, artist: "Franz Xaver Gruber" }
};

function main() {
    console.log('Reading extracted_songs.json...');
    const extractedContent = fs.readFileSync(EXTRACTED_PATH, 'utf-8');
    const allExtractedSongs = JSON.parse(extractedContent);

    const titlesToRestore = Object.keys(BPM_MAP);
    const restoredSongs = allExtractedSongs.filter(s => titlesToRestore.includes(s.title));

    console.log(`Found ${restoredSongs.length} songs to restore.`);

    restoredSongs.forEach((song) => {
        const config = BPM_MAP[song.title];
        const sourceBpm = 240; // The extraction default
        const targetBpm = config.bpm;
        const scale = sourceBpm / targetBpm;

        console.log(`Calibrating ${song.title}: scaling by ${scale.toFixed(2)} to ${targetBpm} BPM`);

        song.id = "restored-" + song.title.toLowerCase().replace(/[^a-z]/g, '');
        song.bpm = targetBpm;
        song.artist = config.artist;

        // Scale note timings
        song.notes.forEach(note => {
            note.time = Number((note.time * scale).toFixed(4));
            note.duration = Number((note.duration * scale).toFixed(4));
        });

        // Clean up title for Auld Lang Syne
        if (song.title === "auld lang syne") {
            song.title = "Auld Lang Syne";
        }
    });

    console.log('Reading src/game/Songs.ts...');
    const songsTsContent = fs.readFileSync(SONGS_TS_PATH, 'utf-8');

    // Find the SONGS array start
    const arrayStartMatch = songsTsContent.match(/export const SONGS: Song\[\] = \[/);
    if (!arrayStartMatch) {
        console.error('Could not find SONGS array in Songs.ts');
        return;
    }

    const arrayStartIndex = arrayStartMatch.index + arrayStartMatch[0].length;

    // Prepare the new content: restored songs at the top
    let newSongsList = '\n';
    restoredSongs.forEach((song) => {
        newSongsList += `  ${JSON.stringify(song, null, 2)}`;
        newSongsList += ',\n';
    });

    // To prevent duplication if run multiple times, we'd ideally replace...
    // But for this one-off adjustment, it's fine. 
    // I will use a simple "remove existing restored-" logic if I were being fancy.

    const updatedContent = songsTsContent.slice(0, arrayStartIndex) + newSongsList + songsTsContent.slice(arrayStartIndex);

    console.log('Writing updated Songs.ts...');
    fs.writeFileSync(SONGS_TS_PATH, updatedContent, 'utf-8');
    console.log('Successfully calibrated and restored songs to Songs.ts');
}

main();
