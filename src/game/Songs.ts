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

export const SONGS: Song[] = [
  {
    id: 'katyusha',
    title: "Katyusha",
    artist: "Russian Folk",
    bpm: 120,
    offset: 0,
    notes: TabParser.parse("Katyusha", KATYUSHA_TABS, { bpm: 120 })
  }
];
