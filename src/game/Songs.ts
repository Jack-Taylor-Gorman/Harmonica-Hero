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
    id: 'country-roads',
    title: "Take Me Home, Country Roads",
    artist: "John Denver",
    bpm: 100,
    offset: 0,
    // "Country road, take me home"
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
    id: 'big-iron',
    title: "Big Iron",
    artist: "Marty Robbins",
    bpm: 140,
    offset: 0,
    notes: TabParser.parse("Big Iron", `
      -5:2 6:2 -6:2 7:2 7:2 -8:2 -6:2 -5:4
      -5:2 6:2 -6:2 -4:2 -4:2 4:2 -4:4
      
      -5:2 6:2 -6:2 7:2 7:2 -8:2 -6:2 -5:4
      -5:2 6:2 -6:2 -5:2 -6:2 7:2 -8:4

      -6:2 7:2 -8:2 -8:2 -8:2 -8:2 -8:2 -8:4
      -8:2 -8:2 -8:2 7:2 7:2 -6:2 7:4
      
      -5:2 6:2 -6:2 7:2 7:2 -8:2 -6:2 -5:4
      -5:2 6:2 -6:2 -4:2 -4:2 4:2 -4:4
      -5:2 -5:2 -5:2 6:2 -5:4
    `, { bpm: 140 })
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
    id: 'piano-man',
    title: "Piano Man (Intro)",
    artist: "Billy Joel",
    bpm: 140,
    offset: 0,
    notes: TabParser.parse("Piano Man", `
      5:2 6:2 6:2 6:2 6:2 5:2 -5:2 5:2 -4:4 4:4 4:4
      5:2 6:2 6:2 6:2 6:2 5:2 -5:2 5:2 -4:4 4:4 4:4
      5:2 5:2 5:2 5:2 -4:2 4:2 4:2 4:2 3:2 4:4
    `, { bpm: 140 })
  },
  {
    id: 'oh-susannah',
    title: "Oh! Susannah",
    artist: "Traditional",
    bpm: 180,
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
