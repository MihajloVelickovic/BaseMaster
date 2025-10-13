import { n4jSession } from "../neo4jClient";
import neo4j from 'neo4j-driver';
import { formatNeo4jDate } from "../utils/timeConversion";
import type {Record} from 'neo4j-driver'
import { redisClient } from "../redisClient";
import { RedisKeys } from "../utils/redisKeyService";

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
        {code: 'YOU_ARE_MY_BEST_FRIEND', name:'You are my best friend', description:'Make one friend — send or accept a friend request', type:'SPECIAL', requirement:1},
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


       await tx.run(`
        MATCH (p:Player)-[:PARTICIPATES_IN]->(lb:Leaderboard {id: 'global'})
        WHERE p.currentRank IS NULL OR p.peakRank IS NULL
        WITH p ORDER BY COALESCE(p.bestScore, 0) DESC, p.username ASC
        WITH collect(p) as players
        UNWIND range(0, size(players)-1) as idx
        WITH players[idx] as player, idx + 1 as rank
        SET player.currentRank = rank,
            player.peakRank = rank,
            player.peakRankDate = datetime()
      `);
    
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
        MATCH (p:User {username: $username})
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

// Update the recordGameResult function in leaderboard.repo.ts

export async function recordGameResult(
  rows: Array<{ username: string; score: number; rank: number | null }>
): Promise<void> {
  const session = n4jSession();
  try {
    await session.executeWrite(async (tx) => {
      const result = await tx.run(
        `
        UNWIND $rows AS row
        MATCH (p:Player {username: row.username})-[r:PARTICIPATES_IN]->(lb:Leaderboard {id: 'global'})
        
        SET
          r.totalGames = COALESCE(r.totalGames, 0) + 1,
          r.totalScore = COALESCE(r.totalScore, 0) + row.score,
          r.bestScore = CASE
            WHEN row.score > COALESCE(r.bestScore, 0) THEN row.score
            ELSE COALESCE(r.bestScore, 0)
          END,
          r.bestScoreDate = CASE
            WHEN row.score > COALESCE(r.bestScore, 0) THEN datetime()
            ELSE r.bestScoreDate
          END,
          r.lastPlayed = datetime(),
          r.lastScore = row.score,
          
          p.totalGames = COALESCE(p.totalGames, 0) + 1,
          p.totalScore = COALESCE(p.totalScore, 0) + row.score,
          p.bestScore = CASE
            WHEN row.score > COALESCE(p.bestScore, 0) THEN row.score
            ELSE COALESCE(p.bestScore, 0)
          END,
          p.bestScoreDate = CASE
            WHEN row.score > COALESCE(p.bestScore, 0) THEN datetime()
            ELSE p.bestScoreDate
          END,
          p.averageScore = (COALESCE(p.totalScore, 0) + row.score) / (COALESCE(p.totalGames, 0) + 1),
          p.lastPlayed = datetime()
        
        RETURN
          row.username AS username,
          row.rank AS rank,
          p.totalGames AS totalGames,
          p.totalScore AS totalScore,
          p.bestScore AS bestScore,
          row.score AS lastScore,
          COALESCE(p.peakRank, 999999) AS oldPeakRank
        `,
        { rows }
      );

      for (const record of result.records) {
        const username = record.get('username');
        const rank = record.get('rank');
        const oldPeakRank = record.get('oldPeakRank');
        const totalGames = record.get('totalGames');
        const totalScore = record.get('totalScore');
        const bestScore = record.get('bestScore');
        const lastScore = record.get('lastScore');
        
        if (rank !== null) {
          if (rank < oldPeakRank) {
            await tx.run(`
              MATCH (p:Player {username: $username})
              SET p.currentRank = $rank,
                  p.peakRank = $rank,
                  p.peakRankDate = datetime()
            `, { username, rank });
          } else {
            await tx.run(`
              MATCH (p:Player {username: $username})
              SET p.currentRank = $rank
            `, { username, rank });
          }
        }
        
        await checkAndAwardAchievements(tx, username, {
          totalGames,
          totalScore,
          bestScore,
          lastScore,
          placement: 1,
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
          r.lastPlayed as lastPlayed,
           COALESCE(p.firsts, 0) AS firsts,
          COALESCE(p.seconds, 0) AS seconds,
          COALESCE(p.thirds, 0) AS thirds,
          COALESCE(p.fourths, 0) AS fourths
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
        rank: Math.floor(Math.abs(skip)) + index + 1,
        firsts: record.get('firsts') || 0,
        seconds: record.get('seconds') || 0,
        thirds: record.get('thirds') || 0,
        fourths: record.get('fourths') || 0,
        totalScore: record.get('totalScore') || 0
      };
    });
  } finally {
    await session.close();
  }
}

export async function getAllPlayersHighscores(): Promise<Array<{username: string, bestScore: number}>> {
  const session = n4jSession();
  try {
    const result = await session.executeRead(async tx => {
      return await tx.run(`
        MATCH (p:Player)-[:PARTICIPATES_IN]->(lb:Leaderboard {id: 'global'})
        RETURN 
          p.username as username,
          COALESCE(p.bestScore, 0) as bestScore
        ORDER BY bestScore DESC
      `);
    });
    
    return result.records.map(record => ({
      username: record.get('username'),
      bestScore: record.get('bestScore')
    }));
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
      achievements: record.get('achievements').filter((a:any) => a !== null)
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
          p.firsts as firsts,
          p.seconds as seconds,
          p.thirds as thirds,
          p.fourths as fourths,
          p.peakRank as peakRank,
          p.peakRankDate as peakRankDate,
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
      lastPlayed: formatNeo4jDate(record.get('lastPlayed')),
      firsts: record.get('firsts') || 0,
      seconds: record.get('seconds') || 0,
      thirds: record.get('thirds') || 0,
      fourths: record.get('fourths') || 0,
      peakRank: record.get('peakRank') || 0,
      peakRankDate: formatNeo4jDate(record.get('peakRankDate'))
    };
  } finally {
    await session.close();
  }
}

export async function getAllAchievementsWithStats() {
  const session = n4jSession();
  try {
    const result = await session.executeRead(async tx => {
      return await tx.run(`
        MATCH (a:Achievement)
        OPTIONAL MATCH (p:Player)-[:ACHIEVED]->(a)
        WITH a, count(p) as achieversCount
        WITH collect({
          code: a.code,
          name: a.name,
          description: a.description,
          type: a.type,
          requirement: a.requirement,
          created: a.created,
          achieversCount: achieversCount
        }) as achievements
        
        MATCH (total:Player)
        WITH achievements, count(total) as totalPlayers
        
        OPTIONAL MATCH (p:Player)-[r:PARTICIPATES_IN]->(lb:Leaderboard {id: 'global'})
        WITH achievements, totalPlayers, count(r) as activePlayers
        
        RETURN 
          achievements,
          totalPlayers,
          activePlayers
      `);
    });

    const record = result.records[0];
    
    return {
      totalPlayers: record.get('totalPlayers') || 0,
      activePlayers: record.get('activePlayers') || 0,
      achievements: record.get('achievements').map((achievement: any) => ({
        code: achievement.code,
        name: achievement.name,
        description: achievement.description,
        type: achievement.type,
        requirement: achievement.requirement,
        created: achievement.created,
        achieversCount: achievement.achieversCount || 0,
        // Calculate percentage of players who have this achievement
        achievementRate: record.get('totalPlayers') > 0 
          ? ((achievement.achieversCount || 0) / record.get('totalPlayers') * 100).toFixed(2) + '%'
          : '0%'
      }))
    };
  } finally {
    await session.close();
  }
}

export async function syncLeaderboardToRedis(): Promise<void> {
  try {
    console.log('[SYNC] Starting leaderboard sync to Redis...');
    
    // Get all players from Neo4j
    const players = await getAllPlayersHighscores();
    
    if (players.length === 0) {
      console.log('[SYNC] No players to sync');
      return;
    }
    
    const redisRankingsKey = RedisKeys.leaderboardRankings(); 

    // Clear existing ZSet
    await redisClient.del(redisRankingsKey);
    
    // Batch add to Redis ZSet
    const members = players.map(p => ({
      score: p.bestScore,
      value: p.username
    }));
    
    await redisClient.zAdd(redisRankingsKey, members);
    
    console.log(`[SYNC] Synced ${players.length} players to Redis ZSet`);
  } catch (error) {
    console.error('[SYNC ERROR] Failed to sync leaderboard to Redis:', error);
    throw error;
  }
}