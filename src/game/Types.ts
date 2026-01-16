export interface GameNote {
    time: number; // Time in seconds from start
    hole: number;
    type: 'blow' | 'draw';
    duration: number; // Length of note in seconds
    id: string; // Unique ID for React keys and tracking
    hit?: boolean; // Has this note been hit?
    missed?: boolean; // Did we miss it?
}

export interface Song {
    id: string;
    title: string;
    artist: string;
    bpm: number;
    offset: number; // Audio offset in seconds
    notes: GameNote[];
}
