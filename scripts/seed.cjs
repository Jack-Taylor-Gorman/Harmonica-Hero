require('dotenv').config();
const { Client } = require('pg');

const client = new Client({
    connectionString: process.env.VITE_DATABASE_URL,
});

// Minimal set for seeding. Full detailed parsing happens in app, we just need raw Data.
// Note: We are storing the TABS string directly in DB.
const SONGS = [
    {
        id: 'love-me-do',
        title: "Love Me Do",
        artist: "The Beatles",
        bpm: 148,
        tabs: `
      5:8
      -5:2 5:2 -4:2 -2:2 -2:2 -2:2 -2:2
      -5:2 5:2 -4:2 -2:2 -2:2 -2:2 -2:2
      5:2 5:2 5:2 5:2 5:2 -4:4
      -5:2 5:2 -4:2 -2:2 -2:2 -2:2 -2:2
    `
    },
    {
        id: 'piano-man',
        title: "Piano Man",
        artist: "Billy Joel",
        bpm: 140,
        tabs: `
      // Intro / Main Theme
      6:2 -6:2 6:2 -5:2 5:2 -5:2 5:2 4:2 -4:2 5:2 -4:2 5:2 -5:2 6:2 -6:2 6:2 -5:2 5:2 -5:2 5:2 4:2 -5:2 5:2 -4:2 4:4
      
      // Repeat
      6:2 -6:2 6:2 -5:2 5:2 -5:2 5:2 4:2 -4:2 5:2 -4:2 5:2 -5:2 6:2 -6:2 6:2 -5:2 5:2 -5:2 5:2 4:2 -5:2 5:2 -4:2 4:4
    `
    },
    {
        id: 'hallelujah',
        title: "Hallelujah",
        artist: "Leonard Cohen",
        bpm: 80,
        tabs: `
      // Well I heard there was a secret chord
      5:2 5:2 6:2 6:2 6:2 6:2 -6:2 -6:2
      
      // That David played and it pleased the Lord
      5:2 6:2 6:2 6:2 5:2 6:2 -6:2 -6:4
      
      // But you don't really care for music do ya
      6:2 -6:2 -6:2 -6:2 -6:2 -6:2 6:2 6:2 -5:2 6:2 6:4
      
      // Hallelujah Chorus
      5:4 6:4 -6:4 -6:4
      -6:4 6:4 5:4 5:4
      5:4 6:4 -6:4 -6:4
      -6:2 6:2 5:4 -5:4 5:8
    `
    },
    {
        id: 'country-roads',
        title: "Take Me Home, Country Roads",
        artist: "John Denver",
        bpm: 100,
        tabs: `
      4:2 -4:2 5:4 
      5:2 4:2 -4:4
      5:2 -4:2 4:2 5:2 6:4 -6:4
      
      -6:2 5:2 6:2 5:2 5:2 4:2 -4:2 
      5:2 5:2 -4:2 4:2 4:4 -4:2 4:4
      
      4:2 -4:2 5:4 
      5:2 4:2 -4:4
      5:2 -4:2 4:2 5:2 6:4 -6:4
    `
    },
    {
        id: 'sound-of-silence',
        title: "The Sound of Silence",
        artist: "Simon & Garfunkel",
        bpm: 104,
        tabs: `
        // Hello darkness my old friend
        -4:2 -4:2 -5:2 -5:2 6:4 6:4
        // I've come to talk with you again
        -5:2 -5:2 6:2 6:2 -6:4 -6:4
        
        // Because a vision softly creeping
        -6:2 -6:2 7:2 7:2 7:2 -7:2 7:2 -6:2 6:4
        // Left its seeds while I was sleeping
        6:2 -6:2 7:2 7:2 7:2 -7:2 7:2 -6:2 6:4
        
        // And the vision that was planted in my brain
        6:2 6:2 7:2 7:2 -7:2 7:2 -8:4 -8:4 -8:2 7:2 -7:4 7:4 -6:8
      `
    }
];

async function seed() {
    try {
        await client.connect();
        console.log('Using connection string:', process.env.VITE_DATABASE_URL);

        // Clear existing for clean slate? Or upsert?
        // Let's upsert
        for (const song of SONGS) {
            await client.query(`
            INSERT INTO songs (id, title, artist, bpm, tabs)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (id) DO UPDATE 
            SET title = EXCLUDED.title, 
                artist = EXCLUDED.artist, 
                bpm = EXCLUDED.bpm, 
                tabs = EXCLUDED.tabs;
        `, [song.id, song.title, song.artist, song.bpm, song.tabs]);
            console.log(`Seeded: ${song.title}`);
        }

        console.log('Seeding Complete.');
    } catch (err) {
        console.error('Seeding Failed:', err);
    } finally {
        await client.end();
    }
}

seed();
