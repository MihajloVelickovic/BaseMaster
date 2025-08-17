import { n4jDriver, n4jSession } from "../neo4jClient";

export async function ensureUserConstraints() {
  const session = n4jSession();
  try {
    await session.executeWrite(async tx => {
      await tx.run(`
        CREATE CONSTRAINT unique_username IF NOT EXISTS
        FOR (u:User)
        REQUIRE u.username IS UNIQUE;
      `);

      await tx.run(`
        CREATE CONSTRAINT unique_email IF NOT EXISTS
        FOR (u:User)
        REQUIRE u.email IS UNIQUE;
      `);
    });
    console.log("User constraints ensured.");
  } finally {
    await session.close();
  }
}
