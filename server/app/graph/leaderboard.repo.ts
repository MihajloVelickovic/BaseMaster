import { n4jSession } from "../neo4jClient";
import neo4j from 'neo4j-driver';

export interface LeaderboardEntry {
  username: string;
  bestScore: number;
  totalGames: number;
  averageScore: number;
  rank?: number;
}

export interface Achievement {
  code: string;
  name: string;
  description: string;
  type: 'SCORE' | 'GAMES' | 'STREAK' | 'SPECIAL';
  requirement: number;
}

// Initialize the global leaderboard node and achievements
export async function initializeGraphStructure() {
  const session = n4jSession();
  try {
    await session.executeWrite(async tx => {
      // Create global leaderboard node if it doesn't exist
      await tx.run(`
        MERGE (lb:Leaderboard {id: 'global'})
        ON CREATE SET 
          lb.name = 'Global Leaderboard',
          lb.created = datetime(),
          lb.updated = datetime()
        ON MATCH SET
          lb.updated = datetime()
        RETURN lb
      `);

      // Create achievement nodes
      const achievements: Achievement[] = [
        { code: 'FIRST_WIN', name: 'First Victory', description: 'Win your first game', type: 'GAMES', requirement: 1 },
        { code: 'HIGH_SCORER', name: 'High Scorer', description: 'Score over 1000 points', type: 'SCORE', requirement: 1000 },
        { code: 'VETERAN', name: 'Veteran Player', description: 'Play 50 games', type: 'GAMES', requirement: 50 },
        { code: 'PERFECTIONIST', name: 'Perfectionist', description: 'Get a perfect score', type: 'SPECIAL', requirement: 1 },
        { code: 'SOCIAL_BUTTERFLY', name: 'Social Butterfly', description: 'Have 10 friends', type: 'SPECIAL', requirement: 10 }
      ];

      for (const achievement of achievements) {
        await tx.run(`
          MERGE (a:Achievement {code: $code})
          ON CREATE SET 
            a.name = $name,
            a.description = $description,
            a.type = $type,
            a.requirement = $requirement,
            a.created = datetime()
          RETURN a
        `, achievement);
      }
    });
    console.log("[SYSTEM]: Graph structure initialized.");
  } finally {
    await session.close();
  }
}

// Connect player to global leaderboard
export async function connectPlayerToLeaderboard(username: string) {
  const session = n4jSession();
  try {
    await session.executeWrite(async tx => {
      await tx.run(`
        MATCH (p:Player {username: $username})
        MATCH (lb:Leaderboard {id: 'global'})
        MERGE (p)-[r:PARTICIPATES_IN]->(lb)
        ON CREATE SET 
          r.joined = datetime(),
          r.totalGames = 0,
          r.totalScore = 0,
          r.bestScore = 0,
          p.bestScore = 0,
          p.totalGames = 0,
          p.totalScore = 0,
          p.gamesWon = 0,
          p.averageScore = 0
        ON MATCH SET
          p.bestScore = COALESCE(p.bestScore, 0),
          p.totalGames = COALESCE(p.totalGames, 0),
          p.totalScore = COALESCE(p.totalScore, 0),
          p.gamesWon = COALESCE(p.gamesWon, 0),
          p.averageScore = COALESCE(p.averageScore, 0)
        RETURN r
      `, { username });
    });
  } finally {
    await session.close();
  }
}

// Record a game result and update leaderboard
export async function recordGameResult(username: string, score: number, placement: 1 | 2 | 3 | 4) {
  const session = n4jSession();
  try {
    await session.executeWrite(async tx => {
      // Update both the relationship AND the player node properties
      const result = await tx.run(`
        MATCH (p:Player {username: $username})-[r:PARTICIPATES_IN]->(lb:Leaderboard {id: 'global'})
        SET 
          r.totalGames = r.totalGames + 1,
          r.totalScore = r.totalScore + $score,
          r.bestScore = CASE WHEN $score > r.bestScore THEN $score ELSE r.bestScore END,
          r.lastPlayed = datetime(),
          r.lastScore = $score,
          r.lastPlacement = $placement,
          // Update player node properties as well
          p.totalGames = r.totalGames + 1,
          p.totalScore = r.totalScore + $score,
          p.bestScore = CASE WHEN $score > r.bestScore THEN $score ELSE r.bestScore END,
          p.gamesWon = CASE WHEN $placement = 1 THEN p.gamesWon + 1 ELSE p.gamesWon END,
          p.averageScore = (r.totalScore + $score) / (r.totalGames + 1),
          p.lastPlayed = datetime()
        RETURN r.totalGames as games, r.totalScore as total, r.bestScore as best
      `, { username, score, placement });

      const record = result.records[0];
      if (record) {
        const totalGames = record.get('games');
        const totalScore = record.get('total');
        const bestScore = record.get('best');

        // Check and award achievements
        await checkAndAwardAchievements(tx, username, {
          totalGames,
          totalScore,
          bestScore,
          lastScore: score,
          placement
        });
      }
    });
  } finally {
    await session.close();
  }
}

// Check and award achievements
async function checkAndAwardAchievements(tx: any, username: string, stats: any) {
  const achievementChecks = [
    { code: 'FIRST_WIN', condition: stats.placement === 1 && stats.totalGames >= 1 },
    { code: 'HIGH_SCORER', condition: stats.bestScore >= 1000 },
    { code: 'VETERAN', condition: stats.totalGames >= 50 },
    { code: 'PERFECTIONIST', condition: stats.lastScore === 2000 }, // Adjust perfect score as needed
  ];

  for (const check of achievementChecks) {
    if (check.condition) {
      await tx.run(`
        MATCH (p:Player {username: $username})
        MATCH (a:Achievement {code: $code})
        MERGE (p)-[r:ACHIEVED]->(a)
        ON CREATE SET r.achievedAt = datetime()
        RETURN r
      `, { username, code: check.code });
    }
  }

  // Check friend count achievement
  const friendResult = await tx.run(`
    MATCH (p:Player {username: $username})-[:FRIEND]-()
    RETURN count(*) as friendCount
  `, { username });
  
  const friendCount = friendResult.records[0]?.get('friendCount') || 0;
  if (friendCount >= 10) {
    await tx.run(`
      MATCH (p:Player {username: $username})
      MATCH (a:Achievement {code: 'SOCIAL_BUTTERFLY'})
      MERGE (p)-[r:ACHIEVED]->(a)
      ON CREATE SET r.achievedAt = datetime()
      RETURN r
    `, { username });
  }
}

// Get global leaderboard with pagination
export async function getGlobalLeaderboard(limit: number = 50, skip: number = 0): Promise<LeaderboardEntry[]> {
  const session = n4jSession();
  try {
    // Convert to Neo4j integer type explicitly
    const limitInt = neo4j.int(Math.floor(Math.abs(limit)));
    const skipInt = neo4j.int(Math.floor(Math.abs(skip)));
    
    const result = await session.executeRead(async tx => {
      return await tx.run(`
        MATCH (p:Player)-[r:PARTICIPATES_IN]->(lb:Leaderboard {id: 'global'})
        RETURN 
          p.username as username,
          COALESCE(p.bestScore, r.bestScore, 0) as bestScore,
          COALESCE(p.totalGames, r.totalGames, 0) as totalGames,
          COALESCE(p.totalScore, r.totalScore, 0) as totalScore,
          r.lastPlayed as lastPlayed
        ORDER BY COALESCE(p.bestScore, r.bestScore, 0) DESC, COALESCE(p.totalGames, r.totalGames, 0) DESC
        SKIP $skip LIMIT $limit
      `, { skip: skipInt, limit: limitInt });
    });

    return result.records.map((record, index) => {
      const totalGames = record.get('totalGames') || 0;
      const totalScore = record.get('totalScore') || 0;
      
      return {
        username: record.get('username'),
        bestScore: record.get('bestScore') || 0,
        totalGames: totalGames,
        averageScore: totalGames > 0 ? Math.round(totalScore / totalGames) : 0,
        rank: Math.floor(Math.abs(skip)) + index + 1
      };
    });
  } finally {
    await session.close();
  }
}

// Get player's achievements
export async function getPlayerAchievements(username: string) {
  const session = n4jSession();
  try {
    const result = await session.executeRead(async tx => {
      return await tx.run(`
        MATCH (p:Player {username: $username})-[r:ACHIEVED]->(a:Achievement)
        RETURN 
          a.code as code,
          a.name as name,
          a.description as description,
          a.type as type,
          r.achievedAt as achievedAt
        ORDER BY r.achievedAt DESC
      `, { username });
    });

    return result.records.map(record => ({
      code: record.get('code'),
      name: record.get('name'),
      description: record.get('description'),
      type: record.get('type'),
      achievedAt: record.get('achievedAt')
    }));
  } finally {
    await session.close();
  }
}

// Get player's friends and their achievements (social aspect)
export async function getFriendsWithAchievements(username: string) {
  const session = n4jSession();
  try {
    const result = await session.executeRead(async tx => {
      return await tx.run(`
        MATCH (p:Player {username: $username})-[:FRIEND]-(friend:Player)
        OPTIONAL MATCH (friend)-[r:PARTICIPATES_IN]->(lb:Leaderboard {id: 'global'})
        OPTIONAL MATCH (friend)-[:ACHIEVED]->(a:Achievement)
        RETURN 
          friend.username as friendUsername,
          r.bestScore as bestScore,
          r.totalGames as totalGames,
          collect(DISTINCT a.name) as achievements
        ORDER BY r.bestScore DESC
      `, { username });
    });

    return result.records.map(record => ({
      username: record.get('friendUsername'),
      bestScore: record.get('bestScore') || 0,
      totalGames: record.get('totalGames') || 0,
      achievements: record.get('achievements').filter(a => a !== null)
    }));
  } finally {
    await session.close();
  }
}

// Get detailed player stats
export async function getPlayerStats(username: string) {
  const session = n4jSession();
  try {
    const result = await session.executeRead(async tx => {
      return await tx.run(`
        MATCH (p:Player {username: $username})
        OPTIONAL MATCH (p)-[r:PARTICIPATES_IN]->(lb:Leaderboard {id: 'global'})
        OPTIONAL MATCH (p)-[:ACHIEVED]->(a:Achievement)
        OPTIONAL MATCH (p)-[:FRIEND]-(friends:Player)
        RETURN 
          p.username as username,
          p.email as email,
          r.bestScore as bestScore,
          r.totalGames as totalGames,
          r.totalScore as totalScore,
          r.lastPlayed as lastPlayed,
          count(DISTINCT a) as achievementCount,
          count(DISTINCT friends) as friendCount
      `, { username });
    });

    const record = result.records[0];
    if (!record) return null;

    const totalGames = record.get('totalGames') || 0;
    const totalScore = record.get('totalScore') || 0;

    return {
      username: record.get('username'),
      email: record.get('email'),
      bestScore: record.get('bestScore') || 0,
      totalGames,
      averageScore: totalGames > 0 ? Math.round(totalScore / totalGames) : 0,
      achievementCount: record.get('achievementCount'),
      friendCount: record.get('friendCount'),
      lastPlayed: record.get('lastPlayed')
    };
  } finally {
    await session.close();
  }
}
