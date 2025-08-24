import { n4jSession } from "../neo4jClient";

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

export async function recordResult(input: {
  username: string;
  score: number;
  placement?: 1 | 2 | 3 | 4;
}) {
  const session = n4jSession();
  try {
    await session.executeWrite(tx =>
      tx.run(
        `
        MATCH (p:Player {username: $username})
        SET p.highestScore = CASE
          WHEN $score > coalesce(p.highestScore, 0) THEN $score
          ELSE coalesce(p.highestScore, 0)
        END,
        p.firsts  = coalesce(p.firsts, 0)  + CASE WHEN $placement = 1 THEN 1 ELSE 0 END,
        p.seconds = coalesce(p.seconds, 0) + CASE WHEN $placement = 2 THEN 1 ELSE 0 END,
        p.thirds  = coalesce(p.thirds, 0)  + CASE WHEN $placement = 3 THEN 1 ELSE 0 END,
        p.fourths = coalesce(p.fourths, 0) + CASE WHEN $placement = 4 THEN 1 ELSE 0 END
        `,
        input
      )
    );
  } finally { await session.close(); }
}


// graph/player.repo.ts
export async function getLeaderboard(params: { limit: number; skip?: number }) {
  const session = n4jSession();
  try {
    const res = await session.executeRead(tx =>
      tx.run(
        `
        MATCH (p:Player)
        RETURN p.username AS username,
               coalesce(p.highestScore, 0) AS score,
               coalesce(p.firsts, 0)  AS firsts,
               coalesce(p.seconds, 0) AS seconds,
               coalesce(p.thirds, 0)  AS thirds,
               coalesce(p.fourths, 0) AS fourths
        ORDER BY score DESC, username ASC
        SKIP toInteger($skip)
        LIMIT toInteger($limit)
        `,
        { limit: params.limit, skip: params.skip ?? 0 }
      )
    );
    return res.records.map(r => r.toObject());
  } finally {
    await session.close();
  }
}

