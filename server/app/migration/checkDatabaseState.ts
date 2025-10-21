// Add this to your migration.ts file
import { n4jSession } from "../neo4jClient";

export async function checkDatabaseState() {
  const session = n4jSession();
  try {

    // Check for User nodes
    const userResult = await session.executeRead(async tx => {
      return await tx.run(`
        MATCH (u:User)
        RETURN count(u) as userCount,
               count(CASE WHEN u:Player THEN 1 END) as alsoPlayer
      `);
    });

    const userCount = userResult.records[0]?.get('userCount').toNumber() || 0;
    const alsoPlayer = userResult.records[0]?.get('alsoPlayer').toNumber() || 0;

    // Check for Player-only nodes
    const playerResult = await session.executeRead(async tx => {
      return await tx.run(`
        MATCH (p:Player)
        WHERE NOT p:User
        RETURN count(p) as playerOnlyCount
      `);
    });

    const playerOnlyCount = playerResult.records[0]?.get('playerOnlyCount').toNumber() || 0;

    // Show sample data
    const sampleResult = await session.executeRead(async tx => {
      return await tx.run(`
        MATCH (n)
        WHERE n:User OR n:Player
        RETURN labels(n) as labels,
               n.username as username,
               n.email as email
        LIMIT 5
      `);
    });

    sampleResult.records.forEach(record => {
    });

  } catch (error: any) {
  } finally {
    await session.close();
  }
}
