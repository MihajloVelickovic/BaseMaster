import { n4jSession } from "../neo4jClient";

export async function ensureGraphConstraints() {
  const session = n4jSession();
  try {
    await session.executeWrite(async tx => {
      await tx.run(`CREATE CONSTRAINT unique_player_id IF NOT EXISTS
                    FOR (p:Player) REQUIRE p.id IS UNIQUE;`);
      await tx.run(`CREATE CONSTRAINT unique_username IF NOT EXISTS
                    FOR (p:Player) REQUIRE p.username IS UNIQUE;`);
      await tx.run(`CREATE CONSTRAINT unique_email IF NOT EXISTS
                    FOR (p:Player) REQUIRE p.email IS UNIQUE;`);
      await tx.run(`CREATE CONSTRAINT unique_achievement_code IF NOT EXISTS
                    FOR (a:Achievement) REQUIRE a.code IS UNIQUE;`);
    });
    console.log("[SYSTEM]: Neo4j constraints ensured.");
  } finally {
    await session.close();
  }
}
