import { neon } from '@neondatabase/serverless';

// The serverless driver works nicely in browser environments if configured.
// However, for direct connection via 'neon', we typically need standard fetch.
// IMPORTANT: Exposing connection string in frontend is generally bad practice for public apps.
// But for this "Personal Cloud" offline-first app, it's acceptable if the user owns the DB.

const sql = neon(import.meta.env.VITE_DATABASE_URL);

export const api = {
    async fetchSongs() {
        try {
            const result = await sql`SELECT * FROM songs`;
            return result;
        } catch (e) {
            console.error("Neon API: Fetch Songs Failed", e);
            throw e;
        }
    },

    async fetchUserScores(username: string) {
        try {
            // Join users and scores
            const result = await sql`
                SELECT s.* 
                FROM user_scores s
                JOIN users u ON s.user_id = u.id
                WHERE u.username = ${username}
            `;
            return result;
        } catch (e) {
            console.error("Neon API: Fetch Scores Failed", e);
            throw e;
        }
    },

    async loginOrRegister(username: string, passwordHash: string) {
        // Simple "Trust" Auth for prototype: If user exists, check pass. If not, create.
        try {
            // Check User
            const existing = await sql`SELECT * FROM users WHERE username = ${username}`;

            if (existing.length > 0) {
                const user = existing[0];
                if (user.password_hash === passwordHash) {
                    return { id: user.id, username: user.username };
                } else {
                    throw new Error("Invalid Credentials");
                }
            } else {
                // Create User
                const newUser = await sql`
                    INSERT INTO users (username, password_hash)
                    VALUES (${username}, ${passwordHash})
                    RETURNING id, username
                `;
                return newUser[0];
            }
        } catch (e) {
            console.error("Neon API: Auth Failed", e);
            throw e;
        }
    },

    async upsertScore(userId: string, songId: string, stats: any) {
        try {
            await sql`
                INSERT INTO user_scores (user_id, song_id, score, stars, max_streak, perfect_count, good_count, missed_count)
                VALUES (${userId}, ${songId}, ${stats.score}, ${stats.stars}, ${stats.maxStreak}, ${stats.perfect}, ${stats.good}, ${stats.missed})
                ON CONFLICT (user_id, song_id) DO UPDATE
                SET score = GREATEST(user_scores.score, EXCLUDED.score),
                    stars = CASE 
                        WHEN user_scores.stars = 'gold' THEN 'gold'
                        WHEN EXCLUDED.stars = 'gold' THEN 'gold'
                        WHEN user_scores.stars = 'silver' THEN 'silver'
                        WHEN EXCLUDED.stars = 'silver' THEN 'silver'
                        ELSE EXCLUDED.stars
                    END,
                    max_streak = GREATEST(user_scores.max_streak, EXCLUDED.max_streak),
                    perfect_count = GREATEST(user_scores.perfect_count, EXCLUDED.perfect_count),
                    updated_at = NOW()
            `;
        } catch (e) {
            console.error("Neon API: Upload Score Failed", e);
            throw e;
        }
    }
}
