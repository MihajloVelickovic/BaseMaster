// migration.ts
import { n4jSession } from "../neo4jClient";

export async function migrateUsersToPlayers() {
  const session = n4jSession();
  try {
    console.log("[MIGRATION] Starting User → Player migration...");
    
    // Add Player label to all User nodes
    const result = await session.executeWrite(async tx => {
      return await tx.run(`
        MATCH (u:User)
        WHERE NOT u:Player
        SET u:Player
        SET u.id = coalesce(u.id, u.username)
        SET u.highestScore = coalesce(u.highestScore, 0),
            u.firsts = coalesce(u.firsts, 0),
            u.seconds = coalesce(u.seconds, 0),
            u.thirds = coalesce(u.thirds, 0),
            u.fourths = coalesce(u.fourths, 0),
            u.bestScore = coalesce(u.bestScore, 0),
            u.totalGames = coalesce(u.totalGames, 0),
            u.totalScore = coalesce(u.totalScore, 0),
            u.gamesWon = coalesce(u.gamesWon, 0),
            u.averageScore = coalesce(u.averageScore, 0),
            u.createdAt = coalesce(u.createdAt, timestamp())
        RETURN count(u) as migrated
      `);
    });
    
    const migratedCount = result.records[0]?.get('migrated');
    console.log(`[MIGRATION] Added Player label to ${migratedCount} User nodes`);
    
  } catch (error: any) {
    console.error("[MIGRATION ERROR]", error.message);
    throw error;
  } finally {
    await session.close();
  }
}
