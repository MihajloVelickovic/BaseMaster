// Add this to your migration.ts file
import { n4jSession } from "../neo4jClient";

export async function checkDatabaseState() {
  const session = n4jSession();
  try {
    console.log("[DIAGNOSTIC] Checking database state...");
    
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
    
    console.log(`[DIAGNOSTIC] Found ${userCount} User nodes`);
    console.log(`[DIAGNOSTIC] Of those, ${alsoPlayer} also have Player label`);
    
    // Check for Player-only nodes
    const playerResult = await session.executeRead(async tx => {
      return await tx.run(`
        MATCH (p:Player)
        WHERE NOT p:User
        RETURN count(p) as playerOnlyCount
      `);
    });
    
    const playerOnlyCount = playerResult.records[0]?.get('playerOnlyCount').toNumber() || 0;
    console.log(`[DIAGNOSTIC] Found ${playerOnlyCount} Player-only nodes (no User label)`);
    
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
    
    console.log(`[DIAGNOSTIC] Sample nodes:`);
    sampleResult.records.forEach(record => {
      console.log(`  - Labels: ${record.get('labels')}, Username: ${record.get('username')}, Email: ${record.get('email')}`);
    });
    
  } catch (error: any) {
    console.error("[DIAGNOSTIC ERROR]", error.message);
  } finally {
    await session.close();
  }
}
