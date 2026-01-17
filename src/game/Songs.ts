import type { Song } from './Types';
import { TabParser } from './TabParser';

// Katyusha (C Major Diatonic - A Minor relative)
const KATYUSHA_TABS = `
  // Rastsvitali yabloni i grushi
  -6 -7 7 -7 -8 -8 7 -8 8:4
  
  // Poplyli tumany nad rekoy
  8 -9 8 -8 7 -8 8 -8 7 -7 7:4

  // Vykhodila na bereg Katyusha
  -9 -8 -9 7 -8 -8 7 -7 -6:4

  // Na vysokiy bereg na krutoy 
  -6 -7 7 -7 -8 -7 7 -7 -6:4
  
  // (Repeat Chorus)
  -9 -8 -9 7 -8 -8 7 -7 -6:4
  -6 -7 7 -7 -8 -7 7 -7 -6:4
`;

const OH_SUSANNAH_TABS = `
  4 4 -4 5 5 -5 5 -4 4 -4 5 5 4 4 -4 4 -3:2
  4 4 -4 5 5 -5 5 -4 4 -4 5 5 4 4 -4 -3 4:2
  -5 -5 -6 -6 -6 6 6 5 4 -4
  5 5 -5 5 -4 4 -4 5 5 4 4 -4 -3 4:2
`;

const MARY_LAMB_TABS = `
  5 4 3 4 5 5 5:2
  4 4 4:2 5 6 6:2
  5 4 3 4 5 5 5 5
  4 4 5 4 3:4
`;

const SAINTS_TABS = `
  4 5 -5 6:4 4 5 -5 6:4
  4 5 -5 6 5 4 5 -4:4
  5 5 -4 4 4 5 6 6 6 -5
  5 -5 6 5 4 -4 4:4
`;

const ODE_TO_JOY_TABS = `
  5 5 -5 6 6 -5 5 -4 4 4 -4 5 5:1.5 -4:0.5 -4:2
  5 5 -5 6 6 -5 5 -4 4 4 -4 5 -4:1.5 4:0.5 4:2
  -4 -4 5 4 -4 5 -5 5 4 -4 5 -5 5 -4 4 -4 -3
  5 5 -5 6 6 -5 5 -4 4 4 -4 5 -4:1.5 4:0.5 4:2
`;

export const SONGS: Song[] = [
  {
    id: 'katyusha',
    title: "Katyusha",
    artist: "Russian Folk",
    bpm: 120,
    offset: 0,
    notes: TabParser.parse("Katyusha", KATYUSHA_TABS, { bpm: 120 })
  },
  {
    id: 'oh-susannah',
    title: "Oh Susannah",
    artist: "Traditional",
    bpm: 120,
    offset: 0,
    notes: TabParser.parse("Oh Susannah", OH_SUSANNAH_TABS, { bpm: 120 })
  },
  {
    id: 'mary-lamb',
    title: "Mary Had a Little Lamb",
    artist: "Traditional",
    bpm: 100,
    offset: 0,
    notes: TabParser.parse("Mary Lamb", MARY_LAMB_TABS, { bpm: 100 })
  },
  {
    id: 'when-the-saints',
    title: "When The Saints",
    artist: "Traditional",
    bpm: 140,
    offset: 0,
    notes: TabParser.parse("Saints", SAINTS_TABS, { bpm: 140 })
  },
  {
    id: 'ode-to-joy',
    title: "Ode To Joy",
    artist: "Beethoven",
    bpm: 110,
    offset: 0,
    notes: TabParser.parse("Ode To Joy", ODE_TO_JOY_TABS, { bpm: 110 })
  }
];
