const fs = require('fs');
const path = require('path');

const SONGS_FILE = 'src/game/Songs.ts';
const CONVERTED_DIR = 'converted_songs';

const songsPath = path.resolve(SONGS_FILE);
let songsContent = fs.readFileSync(songsPath, 'utf8');

// Find the end of the array
const lastBracketIndex = songsContent.lastIndexOf(']');
if (lastBracketIndex === -1) {
    console.error("Could not find closing bracket of SONGS array.");
    process.exit(1);
}

const files = fs.readdirSync(CONVERTED_DIR).filter(f => f.endsWith('.json'));
console.log(`Found ${files.length} songs to inject.`);

let newSongsStr = '';

for (const file of files) {
    const filePath = path.join(CONVERTED_DIR, file);
    const content = fs.readFileSync(filePath, 'utf8');
    try {
        const json = JSON.parse(content);

        // FIX: Ensure ID
        if (!json.id) json.id = path.basename(file, '.json').replace(/[^a-zA-Z0-9-]/g, '-');

        // FIX: Ensure Artist & Offset (Required by TS Interface)
        if (!json.artist) json.artist = "PDMX Import";
        if (json.offset === undefined) json.offset = 0;

        // FIX: Ensure Note IDs
        if (json.notes && Array.isArray(json.notes)) {
            json.notes.forEach((note, index) => {
                if (!note.id) {
                    note.id = `${json.id}-${index}`;
                }
            });
        }

        // Add comma to string
        newSongsStr += `,\n  ${JSON.stringify(json, null, 2)}`;
    } catch (e) {
        console.error(`Error parsing ${file}`, e);
    }
}

// Slice before bracket
let contentBefore = songsContent.slice(0, lastBracketIndex).trimEnd();
// Remove trailing comma if exists
if (contentBefore.endsWith(',')) {
    contentBefore = contentBefore.slice(0, -1);
}

// Inject
const newContent = contentBefore + newSongsStr + "\n];";

fs.writeFileSync(songsPath, newContent);
console.log("Successfully injected songs into Songs.ts with IDs, Artist, Offset, and CLEAN syntax");
