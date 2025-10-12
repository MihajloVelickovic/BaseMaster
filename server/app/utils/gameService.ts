import { recordGameResult } from "../graph/leaderboard.repo";
import { GameResultRow, PlayerResult, ScoreboardEntry } from "../models/types";
import { redisClient } from "../redisClient";
import { BaseValues, GameModes, getGamemode } from "../shared_modules/shared_enums";
import { RedisKeys } from "./redisKeyService";



export async function invalidateLeaderboardCache() {
    const pattern = `${RedisKeys.globalLeaderboard()}:page:*`;
    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) {
    await redisClient.del(keys);
    }
}

export async function addChaosBaseArrays(roundCount:number, gameId:string) {
    //console.log("Entering chaos bases creation....");
    const fromBases = Array.from({ length: roundCount }, () => 
        Math.floor(Math.random() * (BaseValues.MAX_BASE -
             BaseValues.MIN_BASE + 1)) + BaseValues.MIN_BASE
    );

    const toBases = Array.from({ length: roundCount }, () => 
        Math.floor(Math.random() * (BaseValues.MAX_BASE -
                BaseValues.MIN_BASE + 1)) + BaseValues.MIN_BASE      
    );
    
    const fromBaseArrayKey = RedisKeys.fromBaseArray(gameId);
    const toBaseArrayKey = RedisKeys.toBaseArray(gameId);

    await redisClient.rPush(fromBaseArrayKey, fromBases.map(String));
    await redisClient.rPush(toBaseArrayKey, toBases.map(String));
}

export async function CleanupGameContext(gameId: string) {
  const randomNumbersKey = RedisKeys.randomNumbers(gameId);
  const scoreboardKey = RedisKeys.scoreboard(gameId);
  const gameEndKey = RedisKeys.gameEnd(gameId);
  const lobbyMessageKey = RedisKeys.lobbyMessage(gameId);
  const orderPointsKey = RedisKeys.orderPoints(gameId);
  
  const multi = redisClient.multi();
  
  multi.del(gameId);
  multi.del(randomNumbersKey);
  multi.del(scoreboardKey);
  multi.del(gameEndKey);
  multi.del(lobbyMessageKey);
  multi.del(orderPointsKey);
  
  if (getGamemode(gameId) === GameModes.CHAOS) {
    const fromBaseArrayKey = RedisKeys.fromBaseArray(gameId);
    const toBaseArrayKey = RedisKeys.toBaseArray(gameId);
    multi.del(fromBaseArrayKey);
    multi.del(toBaseArrayKey);
  }
  
  await multi.exec();
}

export async function setRounds(gameId:string, roundCount:number, initialValue:number) {
  // Prepare the fields and values as a key-value pair for the hash
  const roundData:any = {};
  for (let i = 1; i <= roundCount; i++) {
    roundData[`${i}`] = initialValue;
  }
  //console.log("Order data: ", roundData);
  await redisClient.hSet(gameId, roundData);
}

function playerIdToUsername(playerId: string): string {
  // Your playerId looks like "username_random"
  // If it ever comes as just "username", this still works.
  const name = String(playerId).split("_")[0];
  return name || String(playerId);
}

export async function SaveResults(scoreboard: ScoreboardEntry[]): Promise<PlayerResult[]> {
  // Build rows with usernames and placements
  const rows: GameResultRow[] = scoreboard.map((row, index) => ({
    username: playerIdToUsername(row.value),
    score: Math.floor(Number(row.score) || 0),
    placement: (index + 1) as 1 | 2 | 3 | 4,
  }));

  // Single Neo4j call to record all results
  await recordGameResult(rows);

  // Update Redis leaderboard (only if score is better)
  const zKey = RedisKeys.globalLeaderboard();
  const pipeline = redisClient.multi();

  for (const row of rows) {
    pipeline.zScore(zKey, row.username);
  }

  const scores = await pipeline.exec();
  const updates: Array<{ score: number; value: string }> = [];

  if (scores) {
    for (let i = 0; i < rows.length; i++) {
      // Handle different redis client return types
      const scoreResult = scores[i];
      const existingScore = Array.isArray(scoreResult) 
        ? (scoreResult[1] as number | null)
        : (scoreResult as number | null);
      
      if (existingScore === null || rows[i].score > existingScore) {
        updates.push({ score: rows[i].score, value: rows[i].username });
      }
    }
  }

  if (updates.length > 0) {
    await redisClient.zAdd(zKey, updates);
  }

  // Invalidate page cache
  invalidateLeaderboardCache();

  // Build proper return format
  const results: PlayerResult[] = scoreboard.map((row, index) => ({
    username: playerIdToUsername(row.value),
    playerId: row.value,
    score: Math.floor(Number(row.score) || 0),
    placement: index + 1,
  }));

  return results;
}