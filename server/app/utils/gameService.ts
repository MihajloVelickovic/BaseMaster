import { recordGameResult } from "../graph/leaderboard.repo";
import { PlayerResult, ScoreboardEntry } from "../models/types";
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
//ranke used as placement, need to add it to enriched rows instead of how it is
export async function SaveResults(scoreboard: ScoreboardEntry[]): Promise<PlayerResult[]> {
  const enrichedRows: Array<{username: string, score: number,
                     placement: number, rank: number | null}> = [];


  for (let index = 0; index < scoreboard.length; index++) {
    const entry = scoreboard[index];
    const username = entry.value;
    const score = Math.floor(Number(entry.score) || 0);
    const placement = index + 1;
    const oldBestScore = await redisClient.zScore(RedisKeys.leaderboardRankings(), username) || 0;
    
    if (score > oldBestScore) {
      await updatePlayerScoreInRedis(username, score);
      console.log(`[RANK UPDATE] ${username}: ${oldBestScore} -> ${score}`);
    }
    
    const rank = await getPlayerRankFromRedis(username);
    
    enrichedRows.push({
      username,
      score,
      rank,
      placement
    });
  }

  await recordGameResult(enrichedRows);
  await invalidateLeaderboardCache();

  return scoreboard.map((row, index) => ({
    username: row.value,
    score: Math.floor(Number(row.score) || 0),
    placement: index + 1,
  }));
}

export async function getPlayerRankFromRedis(username: string): Promise<number | null> {
  try {
    const rankingKey = RedisKeys.leaderboardRankings();
    const rank = await redisClient.zRevRank(rankingKey, username);
    return rank !== null ? rank + 1 : null; // Convert 0-indexed to 1-indexed
  } catch (error) {
    console.error('[REDIS ERROR] Failed to get player rank:', error);
    return null;
  }
}

export async function updatePlayerScoreInRedis(username: string, newScore: number): Promise<void> {
  try {
    await redisClient.zAdd(RedisKeys.leaderboardRankings(), {
      score: newScore,
      value: username
    });
  } catch (error) {
    console.error('[REDIS ERROR] Failed to update player score:', error);
  }
}