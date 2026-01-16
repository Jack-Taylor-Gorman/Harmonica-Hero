export interface NoteDefinition {
  hole: number;
  type: 'blow' | 'draw';
  note: string;
  frequency: number;
}

// Standard Richland Tuned Diatonic Harmonica in C
export const HARMONICA_KEY_C: NoteDefinition[] = [
  { hole: 1, type: 'blow', note: 'C4', frequency: 261.63 },
  { hole: 1, type: 'draw', note: 'D4', frequency: 293.66 },
  { hole: 2, type: 'blow', note: 'E4', frequency: 329.63 },
  { hole: 2, type: 'draw', note: 'G4', frequency: 392.00 },
  { hole: 3, type: 'blow', note: 'G4', frequency: 392.00 }, // Same as 2 draw
  { hole: 3, type: 'draw', note: 'B4', frequency: 493.88 },
  { hole: 4, type: 'blow', note: 'C5', frequency: 523.25 },
  { hole: 4, type: 'draw', note: 'D5', frequency: 587.33 },
  { hole: 5, type: 'blow', note: 'E5', frequency: 659.25 },
  { hole: 5, type: 'draw', note: 'F5', frequency: 698.46 },
  { hole: 6, type: 'blow', note: 'G5', frequency: 783.99 },
  { hole: 6, type: 'draw', note: 'A5', frequency: 880.00 },
  { hole: 7, type: 'blow', note: 'C6', frequency: 1046.50 },
  { hole: 7, type: 'draw', note: 'B5', frequency: 987.77 },
  { hole: 8, type: 'blow', note: 'E6', frequency: 1318.51 },
  { hole: 8, type: 'draw', note: 'D6', frequency: 1174.66 },
  { hole: 9, type: 'blow', note: 'G6', frequency: 1567.98 },
  { hole: 9, type: 'draw', note: 'F6', frequency: 1396.91 },
  { hole: 10, type: 'blow', note: 'C7', frequency: 2093.00 },
  { hole: 10, type: 'draw', note: 'A6', frequency: 1760.00 },
];
