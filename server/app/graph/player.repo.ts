import { n4jSession } from "../neo4jClient";
import { recordGameResult, getGlobalLeaderboard, connectPlayerToLeaderboard } from './leaderboard.repo';

/**
 * Ensure Player node exists with all necessary properties.
 * Used during registration and login.
 */
export async function upsertPlayer(username: string, email?: string, hashedPassword?: string) {
  const session = n4jSession();
  try {
    await session.executeWrite(tx =>
      tx.run(
        `
        // Create or update Player node
        MERGE (p:Player {username: $username})
        
        // Set stable id
        ON CREATE SET 
          p.id = $username,
          p.email = $email,
          p.password = $hashedPassword,
          p.createdAt = timestamp()
        
        ON MATCH SET
          p.email = coalesce($email, p.email),
          p.password = coalesce($hashedPassword, p.password)
        
        // Initialize leaderboard fields if missing
        SET p.highestScore = coalesce(p.highestScore, 0),
            p.firsts       = coalesce(p.firsts, 0),
            p.seconds      = coalesce(p.seconds, 0),
            p.thirds       = coalesce(p.thirds, 0),
            p.fourths      = coalesce(p.fourths, 0),
            p.bestScore    = coalesce(p.bestScore, 0),
            p.totalGames   = coalesce(p.totalGames, 0),
            p.totalScore   = coalesce(p.totalScore, 0),
            p.gamesWon     = coalesce(p.gamesWon, 0),
            p.averageScore = coalesce(p.averageScore, 0)
        
        RETURN p
        `,
        { username, email, hashedPassword }
      )
    );
  } finally {
    await session.close();
  }
}

export async function getLeaderboard({ limit, skip }: { limit: number; skip: number }) {
  return await getGlobalLeaderboard(limit, skip);
}
