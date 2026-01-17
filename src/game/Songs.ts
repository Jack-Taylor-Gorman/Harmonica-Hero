import type { Song } from './Types';
import { TabParser } from './TabParser';

// Oh Susannah
const OH_SUSANNAH_TABS = `
  4 4 -4 5 5 -5 5 -4 4 -4 5 5 4 4 -4 4 -3:2
  4 4 -4 5 5 -5 5 -4 4 -4 5 5 4 4 -4 -3 4:2
  -5 -5 -6 -6 -6 6 6 5 4 -4
  5 5 -5 5 -4 4 -4 5 5 4 4 -4 -3 4:2
`;

// Ode To Joy
const ODE_TO_JOY_TABS = `
  5 5 -5 6 6 -5 5 -4 4 4 -4 5 5:1.5 -4:0.5 -4:2
  5 5 -5 6 6 -5 5 -4 4 4 -4 5 -4:1.5 4:0.5 4:2
  -4 -4 5 4 -4 5 -5 5 4 -4 5 -5 5 -4 4 -4 -3
  5 5 -5 6 6 -5 5 -4 4 4 -4 5 -4:1.5 4:0.5 4:2
`;

// Mary Had a Little Lamb
const MARY_LAMB_TABS = `
  5 4 3 4 5 5 5:2
  4 4 4:2 5 6 6:2
  5 4 3 4 5 5 5 5
  4 4 5 4 3:4
`;

// When The Saints
const SAINTS_TABS = `
  4 5 -5 6:4 4 5 -5 6:4
  4 5 -5 6 5 4 5 -4:4
  5 5 -4 4 4 5 6 6 6 -5
  5 -5 6 5 4 -4 4:4
`;

export const SONGS: Song[] = [
  {
    id: 'love-me-do',
    title: "Love Me Do",
    artist: "The Beatles",
    bpm: 148,
    offset: 0,
    notes: TabParser.parse("Love Me Do", `
      5:8
      -5:2 5:2 -4:2 -2:2 -2:2 -2:2 -2:2
      -5:2 5:2 -4:2 -2:2 -2:2 -2:2 -2:2
      5:2 5:2 5:2 5:2 5:2 -4:4
      -5:2 5:2 -4:2 -2:2 -2:2 -2:2 -2:2
    `, { bpm: 148 })
  },
  {
    id: 'piano-man',
    title: "Piano Man",
    artist: "Billy Joel",
    bpm: 140, // Waltz time, fast 3/4 feel
    offset: 0,
    notes: TabParser.parse("Piano Man", `
      // Intro / Main Theme
      6:2 -6:2 6:2 -5:2 5:2 -5:2 5:2 4:2 -4:2 5:2 -4:2 5:2 -5:2 6:2 -6:2 6:2 -5:2 5:2 -5:2 5:2 4:2 -5:2 5:2 -4:2 4:4
      
      // Repeat
      6:2 -6:2 6:2 -5:2 5:2 -5:2 5:2 4:2 -4:2 5:2 -4:2 5:2 -5:2 6:2 -6:2 6:2 -5:2 5:2 -5:2 5:2 4:2 -5:2 5:2 -4:2 4:4
    `, { bpm: 140 })
  },
  {
    id: 'hallelujah',
    title: "Hallelujah",
    artist: "Leonard Cohen",
    bpm: 80,
    offset: 0,
    notes: TabParser.parse("Hallelujah", `
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
    `, { bpm: 80 })
  },
  {
    id: 'country-roads',
    title: "Take Me Home, Country Roads",
    artist: "John Denver",
    bpm: 100,
    offset: 0,
    notes: TabParser.parse("Country Roads", `
      4:2 -4:2 5:4 
      5:2 4:2 -4:4
      5:2 -4:2 4:2 5:2 6:4 -6:4
      
      -6:2 5:2 6:2 5:2 5:2 4:2 -4:2 
      5:2 5:2 -4:2 4:2 4:4 -4:2 4:4
      
      4:2 -4:2 5:4 
      5:2 4:2 -4:4
      5:2 -4:2 4:2 5:2 6:4 -6:4
    `, { bpm: 120 })
  },
  {
    id: 'sound-of-silence',
    title: "The Sound of Silence",
    artist: "Simon & Garfunkel",
    bpm: 104,
    offset: 0,
    notes: TabParser.parse("Sound of Silence", `
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
    `, { bpm: 104 })
  },
  {
    id: 'heart-of-gold',
    title: "Heart of Gold",
    artist: "Neil Young",
    bpm: 140,
    offset: 0,
    notes: TabParser.parse("Heart of Gold", `
      // Intro Riff
      6:2 -6:2 6:2 5:2 6:2 -4:2 
      5:2 6:2 -6:2 6:2 5:2 6:2 -4:2 4:4
      
      // I want to live, I want to give
      6:2 6:2 6:2 -6:2 6:2 5:4
      // I've been a miner for a heart of gold
      5:2 6:2 6:2 6:2 -6:2 6:4
      
      // And I'm getting old
      -6:2 -6:2 6:2 5:4
    `, { bpm: 140 })
  },
  {
    id: 'stand-by-me',
    title: "Stand By Me",
    artist: "Ben E. King",
    bpm: 118,
    offset: 0,
    notes: TabParser.parse("Stand By Me", `
      // When the night has come
      8:4 9:4 -10:4 8:2 9:4
      // And the land is dark
      7:4 -8:4 8:4 -8:2 7:4
      // And the moon is the only light we'll see
      7:2 -8:2 8:2 7:2 8:2 -8:2 -8:2 -8:2 7:4
      
      // Darling stand by me
      9:2 -10:2 9:2 10:4 9:2 -10:2 9:2 -10:2 8:2 -8:2 7:4
      // Oh stand, stand by me
      8:2 7:2 8:2 -8:2 7:2 8:2 -8:2 7:4
    `, { bpm: 118 })
  },
  {
    id: 'imagine',
    title: "Imagine",
    artist: "John Lennon",
    bpm: 76,
    offset: 0,
    notes: TabParser.parse("Imagine", `
      // Imagine there's no heaven
      5:2 6:2 6:2 6:2 -7:2 -7:2 -6:4
      // It's easy if you try
      5:2 6:2 6:2 6:2 -7:2 -7:2 -6:4
      // No hell below us
      6:2 6:2 -7:2 -7:2 -6:4
      // Above us only sky
      6:2 5:2 6:2 -7:2 -6:8
    `, { bpm: 76 })
  },
  {
    id: 'aint-no-sunshine',
    title: "Ain't No Sunshine",
    artist: "Bill Withers",
    bpm: 75,
    offset: 0,
    notes: TabParser.parse("Ain't No Sunshine", `
      // Ain't no sunshine when she's gone
      -5:2 6:4 -6:2 7:4 -7:2 6:4 -6:4
      // It's not warm when she's away
      -5:2 6:4 -6:2 7:4 -7:2 6:4 -6:4
      
      // Ain't no sunshine when she's gone
      -5:2 6:4 -6:2 7:4 -7:2 6:4 -6:4
      // And she's always gone too long
      6:2 6:2 7:2 8:2 -8:2 8:2 8:2 -8:4
      // Anytime she goes away
      -8:2 -8:2 -8:2 7:2 -7:4
    `, { bpm: 75 })
  },
  {
    id: 'yesterday',
    title: "Yesterday",
    artist: "The Beatles",
    bpm: 96,
    offset: 0,
    notes: TabParser.parse("Yesterday", `
      // Yesterday
      7:8 
      // All my troubles seemed so far away
      -6:2 -7:2 -8:2 8:2 -9:2 8:2 -8:2 7:2 -7:2 -6:2 -6:4
      // Now it looks as though they're here to stay
      7:2 7:4 -8:2 -7:2 7:2 6:4 5:2 -4:2 5:6
      // Oh I believe in yesterday
      5:2 5:2 6:2 -6:2 6:4 7:8
    `, { bpm: 96 })
  },
  {
    id: 'blowin-wind',
    title: "Blowin' in the Wind",
    artist: "Bob Dylan",
    bpm: 175,
    offset: 0,
    notes: TabParser.parse("Blowin' in the Wind", `
      // How many roads must a man walk down
      6:2 6:2 6:2 -6:2 6:2 -5:2 6:2 5:2 -4:2 4:4
      // Before you call him a man
      5:2 6:2 6:2 6:2 -6:2 6:2 -5:2 6:4
      // How many seas must a white dove sail
      5:2 -5:2 6:2 6:2 6:2 -6:2 6:2 -5:2 6:2 5:2 -4:2 4:4
      // The answer my friend is blowin in the wind
      5:2 -5:2 -5:2 5:2 -4:2 -4:2 5:2 5:2 -4:2 4:4
    `, { bpm: 175 })
  },
  {
    id: 'let-it-be',
    title: "Let It Be",
    artist: "The Beatles",
    bpm: 140,
    offset: 0,
    notes: TabParser.parse("Let It Be", `
      // When I find myself in times of trouble
      6:2 6:2 6:2 6:2 -6:2 5:2 6:2 6:2 7:2 -8:4
      // Mother Mary comes to me
      8:2 8:2 8:2 -8:2 -8:2 7:2 7:4
      // Speaking words of wisdom, let it be
      8:2 8:2 -9:2 8:2 8:2 -8:2 8:2 -8:2 -8:2 7:2 7:4
      
      // Let it be, let it be
      9:4 9:4 8:4 8:4 -8:2 7:2 -6:2 6:2 8:2 7:4
      // Whisper words of wisdom, let it be
      8:2 8:2 -9:2 -9:2 -9:2 -8:2 8:2 -8:2 -8:2 -8:2 7:2 7:4
    `, { bpm: 140 })
  },
  {
    id: 'wonderful-world',
    title: "What a Wonderful World",
    artist: "Louis Armstrong",
    bpm: 70,
    offset: 0,
    notes: TabParser.parse("Wonderful World", `
      // I see trees of green, red roses too
      -2:2 -3:2 4:2 4:2 6:2 -6:2 -6:2 -6:2 6:4
      // I see them bloom for me and you
      -5:2 -5:2 -5:2 5:2 -4:2 -4:2 -4:2 4:4
      // And I think to myself
      4:2 4:2 4:2 4:2 4:2 4:2 
      // What a wonderful world
      4:2 4:2 -3:2 4:2 -4:2 5:8
    `, { bpm: 70 })
  },

  {
    id: 'amazing-grace',
    title: "Amazing Grace",
    artist: "Traditional",
    bpm: 90,
    offset: 0,
    notes: TabParser.parse("Amazing Grace", `
      6:2 7:4 8:1 7:1 8:4 -8:2 7:4 6:4 
      6:2 7:4 8:1 7:1 8:4 -8:4 9:8
      8:2 9:4 9:1 8:1 7:4 6:2 6:4 5:2 6:4
      6:2 7:4 8:1 7:1 8:4 -8:2 7:8
    `, { bpm: 90 })
  },
  {
    id: 'oh-susannah',
    title: "Oh! Susannah",
    artist: "Traditional",
    bpm: 120, // Reduced from 180 to be more playable
    offset: 0,
    notes: TabParser.parse("Oh! Susannah", OH_SUSANNAH_TABS, { bpm: 120 })
  },
  {
    id: 'ode-to-joy',
    title: "Ode to Joy",
    artist: "Beethoven",
    bpm: 140,
    offset: 0,
    notes: TabParser.parse("Ode to Joy", ODE_TO_JOY_TABS, { bpm: 120 })
  },
  {
    id: 'mary-lamb',
    title: "Mary Had a Little Lamb",
    artist: "Traditional",
    bpm: 100,
    offset: 0,
    notes: TabParser.parse("Mary Had a Little Lamb", MARY_LAMB_TABS, { bpm: 100 })
  },
  {
    id: 'saints',
    title: "When The Saints",
    artist: "Traditional",
    bpm: 160,
    offset: 0,
    notes: TabParser.parse("When The Saints", SAINTS_TABS, { bpm: 140 })
  }
];

export const TEST_SONG = SONGS[0];
