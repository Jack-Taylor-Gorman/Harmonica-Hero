import Dexie, { type Table } from 'dexie';
import type { Song } from '../game/Types';

// Extend the Song interface to match DB schema if needed
// For now, we store the whole object.

export interface UserScore {
    userId: string; // 'local-guest' or UUID
    songId: string;
    score: number;
    stars: 'gold' | 'silver' | 'bronze' | 'none';
    maxStreak: number;
    perfect: number;
    good: number;
    missed: number;
    timestamp: number;
}

export class HarmonicaDB extends Dexie {
    // 'songs' table: id is primary key
    songs!: Table<Song, string>;

    // 'scores' table: compound key [userId+songId]
    scores!: Table<UserScore, [string, string]>;

    constructor() {
        super('HarmonicaHeroDB');
        this.version(1).stores({
            songs: 'id', // Primary key: id
            scores: '[userId+songId], songId, userId' // Compound PK, plus indexes
        });
    }
}

export const db = new HarmonicaDB();
