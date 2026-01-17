import { db, type UserScore } from '../db/db';
import { SONGS } from './Songs'; // Fallback / Initial Seed
import type { Song } from './Types';
import { api } from '../api/neon';

class SongManager {
    private userId: string | null = null;
    private username: string | null = null;
    private isOnline: boolean = navigator.onLine;

    constructor() {
        window.addEventListener('online', () => { this.isOnline = true; this.sync(); });
        window.addEventListener('offline', () => { this.isOnline = false; });

        // Restore session
        const storedUser = localStorage.getItem('hh_user');
        if (storedUser) {
            const parsed = JSON.parse(storedUser);
            this.userId = parsed.id;
            this.username = parsed.username;
        }
    }

    async init() {
        // 1. FORCE SEED: Always clear and re-populate from local code to ensure updates apply.
        // This fixes the issue where old songs persist even if removed from code.
        console.log("SongManager: Re-seeding local DB from latest code...");
        await db.songs.clear();
        await db.songs.bulkAdd(SONGS);

        // 2. Try Fetch Cloud
        if (this.isOnline) {
            this.fetchCloudSongs();
        }
    }

    async fetchCloudSongs() {
        try {
            console.log("SongManager: Fetching from Cloud...");
            const cloudSongs = await api.fetchSongs();

            // Upsert into Local DB
            // We use bulkPut to overwrite existing with new data

            // Dynamic Import to avoid cycle if necessary
            const { TabParser } = await import('./TabParser');

            const parsedSongs: Song[] = cloudSongs.map((s: any) => ({
                id: s.id,
                title: s.title,
                artist: s.artist,
                bpm: s.bpm,
                offset: s.offset || 0,
                // Parse Tabs on the fly from DB content
                notes: TabParser.parse(s.title, s.tabs, { bpm: s.bpm })
            }));

            await db.songs.bulkPut(parsedSongs);
            console.log(`SongManager: Synced ${parsedSongs.length} songs from Cloud.`);
        } catch (e) {
            console.warn("SongManager: Cloud Fetch Failed (User might be offline or no DB)", e);
        }
    }

    async login(username: string, passwordHash: string) {
        // Call API
        const user = await api.loginOrRegister(username, passwordHash);
        this.userId = user.id;
        this.username = user.username;
        localStorage.setItem('hh_user', JSON.stringify(user));

        // Trigger Sync
        this.sync();
        return user;
    }

    logout() {
        this.userId = null;
        this.username = null;
        localStorage.removeItem('hh_user');
    }

    getUser() {
        return this.username ? { id: this.userId, username: this.username } : null;
    }

    async sync() {
        if (!this.userId || !this.isOnline) return;

        console.log("SongManager: Syncing Stats...");

        // 1. Push Local Scores for this user (migrating guest scores if needed)
        const guestScores = await db.scores.where('userId').equals('guest').toArray();
        if (guestScores.length > 0) {
            // Migrate to real user Ids locally
            const migrated = guestScores.map(s => ({ ...s, userId: this.userId! }));
            await db.scores.bulkPut(migrated);
            await db.scores.where('userId').equals('guest').delete();
        }

        // 2. Push to Cloud
        const userScores = await db.scores.where('userId').equals(this.userId).toArray();
        for (const s of userScores) {
            try {
                await api.upsertScore(this.userId, s.songId, s);
            } catch (e) {
                console.error("Sync: Failed to push score", s.songId);
            }
        }
    }

    async getAllSongs(): Promise<Song[]> {
        return await db.songs.toArray();
    }

    async getSong(id: string): Promise<Song | undefined> {
        return await db.songs.get(id);
    }

    async saveScore(songId: string, stats: { score: number; perfect: number; good: number; missed: number; maxStreak: number }) {
        // Determine Stars
        let stars: 'gold' | 'silver' | 'bronze' | 'none' = 'none';

        if (stats.missed === 0) {
            if (stats.good === 0) { // All Perfect
                stars = 'gold';
            } else {
                stars = 'silver'; // Full Combo
            }
        } else if (stats.score > 0) {
            stars = 'bronze'; // Cleared
        }

        const currentUserId = this.userId || 'guest';

        const scoreEntry: UserScore = {
            userId: currentUserId,
            songId: songId,
            score: stats.score,
            stars: stars,
            maxStreak: stats.maxStreak,
            perfect: stats.perfect,
            good: stats.good || 0,
            missed: stats.missed,
            timestamp: Date.now()
        };

        // Put = Upsert (Replace if exists)
        const existing = await db.scores.get([currentUserId, songId]);

        let shouldUpdate = false;
        if (!existing) {
            shouldUpdate = true;
        } else {
            // Priority: Gold > Silver > Bronze > None
            const rank = { 'gold': 3, 'silver': 2, 'bronze': 1, 'none': 0 };
            const newRank = rank[stars];
            // @ts-ignore
            const oldRank = rank[existing.stars] || 0;

            if (newRank > oldRank) shouldUpdate = true;
            else if (newRank === oldRank && stats.score > existing.score) shouldUpdate = true;
        }

        if (shouldUpdate) {
            console.log("SongManager: New High Score! Saving...", scoreEntry);
            await db.scores.put(scoreEntry);

            // Try Push immediately
            if (this.userId && this.isOnline) {
                api.upsertScore(this.userId, songId, scoreEntry).catch(console.error);
            }
        }

        return stars;
    }

    async getAllScores(): Promise<UserScore[]> {
        const uid = this.userId || 'guest';
        return await db.scores.where('userId').equals(uid).toArray();
    }
}

export const songManager = new SongManager();
