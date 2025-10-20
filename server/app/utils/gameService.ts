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
  
  const pattern = `current_number:${gameId}:*`;
  const keys = await redisClient.keys(pattern);
  if (keys.length > 0)
    await redisClient.del(keys);
  

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
  for (let i = 0; i < roundCount; i++) {
    roundData[`${i}`] = initialValue;
  }
  //console.log("Order data: ", roundData);
  await redisClient.hSet(gameId, roundData);
}
//ranke used as placement, need to add it to enriched rows instead of how it is
export async function SaveResults(scoreboard: ScoreboardEntry[]): Promise<PlayerResult[]> {
  const results = scoreboard.map((entry, index) => ({
    username: entry.value,
    score: Math.floor(Number(entry.score) || 0),
    placement: index + 1,
  }));
  console.log("PLAYER COUNT", scoreboard.length)
  // Early exit for singleplayer
  if (scoreboard.length === 1)
    return results;
  

  // Batch fetch old scores
  const usernames = scoreboard.map(user => user.value);
  const oldBestScores = await Promise.all(
    usernames.map(username => redisClient.zScore(RedisKeys.leaderboardRankings(), username))
  );

  // Find and update improved scores
  const updates = scoreboard.map((entry, index) => ({
      username: entry.value,
      score: results[index].score,
      oldScore: oldBestScores[index] || 0,
  })).filter(player => player.score > player.oldScore);

  await Promise.all(
    updates.map(player => {
      console.log(`[RANK UPDATE] ${player.username}: ${player.oldScore} => ${player.score}`);
      return updatePlayerScoreInRedis(player.username, player.score);
    })
  );

  // Batch fetch ranks and record results
  const ranks = await Promise.all(usernames.map(username => getPlayerRankFromRedis(username)));
  const enrichedRows = results.map((result, index) => ({ ...result, rank: ranks[index] }));

  await recordGameResult(enrichedRows);
  await invalidateLeaderboardCache();

  return results;
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