import { n4jSession } from "../neo4jClient";
import { recordGameResult, getGlobalLeaderboard, connectPlayerToLeaderboard } from './leaderboard.repo';

/**
 * Ensure the given User is also labeled :Player and has leaderboard props.
 * Idempotent: safe to call on every register/login.
 */
export async function upsertPlayerFromUser(username: string, email?: string) {
  const session = n4jSession();
  try {
    await session.executeWrite(tx =>
      tx.run(
        `
        // Make sure there is a User node for this username (register already does this)
        MERGE (u:User {username: $username})

        // Upgrade the same node to also be a :Player
        SET u:Player

        // Set a stable id (we'll use username as id here)
        SET u.id = coalesce(u.id, $username)

        // Keep email if we learn a new one
        SET u.email = coalesce($email, u.email)

        // Initialize leaderboard fields if missing
        SET u.highestScore = coalesce(u.highestScore, 0),
            u.firsts       = coalesce(u.firsts, 0),
            u.seconds      = coalesce(u.seconds, 0),
            u.thirds       = coalesce(u.thirds, 0),
            u.fourths      = coalesce(u.fourths, 0),

            // metadata
            u.createdAt    = coalesce(u.createdAt, timestamp())
        `,
        { username, email }
      )
    );
  } finally {
    await session.close();
  }
}

export async function recordResult({ username, score, placement }: { username: string; score: number; placement: 1 | 2 | 3 | 4 }) {
  await recordGameResult(username, score, placement);
}

export async function getLeaderboard({ limit, skip }: { limit: number; skip: number }) {
  return await getGlobalLeaderboard(limit, skip);
}
