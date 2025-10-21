// Enhanced constraints with leaderboard and achievement relationships
// ensureConstraints.ts - Updated version

import { n4jSession } from "../neo4jClient";

export async function ensureGraphConstraints() {
  const session = n4jSession();
  try {
    await session.executeWrite(async tx => {
      // Player constraints
      await tx.run(`CREATE CONSTRAINT unique_player_id IF NOT EXISTS
                    FOR (p:Player) REQUIRE p.id IS UNIQUE;`);
      await tx.run(`CREATE CONSTRAINT unique_username IF NOT EXISTS
                    FOR (p:Player) REQUIRE p.username IS UNIQUE;`);
      await tx.run(`CREATE CONSTRAINT unique_email IF NOT EXISTS
                    FOR (p:Player) REQUIRE p.email IS UNIQUE;`);
      
      // Achievement constraints
      await tx.run(`CREATE CONSTRAINT unique_achievement_code IF NOT EXISTS
                    FOR (a:Achievement) REQUIRE a.code IS UNIQUE;`);
      
      // Leaderboard constraints
      await tx.run(`CREATE CONSTRAINT unique_leaderboard_id IF NOT EXISTS
                    FOR (l:Leaderboard) REQUIRE l.id IS UNIQUE;`);
    });
  } finally {
    await session.close();
  }
}
