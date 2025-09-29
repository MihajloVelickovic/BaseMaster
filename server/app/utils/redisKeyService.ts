import { nanoid } from "nanoid";
import { IdPrefixes } from "../shared_modules/shared_enums";

// RedisKeyService.ts
export class RedisKeys {
  static friendList(username: string) {
      return `${IdPrefixes.FRIEND_LIST}:${username}`;
  }

  static scoreboard(gameId: string) {
    return `${IdPrefixes.PLAYER_POINTS}:${gameId}`
  }

  static gameEnd(gameId: string) {
    return`${IdPrefixes.GAME_END}:${gameId}`;
  }

  static lobbyPlayers(gameId: string) {
    return `${IdPrefixes.LOBBY_PLAYERS}:${gameId}`
  }

  static lobbyMessage(gameId:string) {
    return `${IdPrefixes.MESSAGE}:${gameId}`;
  }

  static randomNumbers(gameId: string) {
    return `${IdPrefixes.RANDOM_NUMBERS}:${gameId}`;
  }

  static orderPoints(gameId: string) {
    return `${IdPrefixes.ORDER_POINTS}:${gameId}`;
  }

  static fromBaseArray(gameId: string) {
    return `${IdPrefixes.FROM_BASE}:${gameId}`
  }

  static toBaseArray(gameId: string) {
    return `${IdPrefixes.TO_BASE}:${gameId}`;
  }

  static roundCount(gameId:string) {
    return `${IdPrefixes.ROUND_COUNT}:${gameId}`;
  }

  static globalLeaderboard() {
    return 'global_learerboard';
  }

  static onlinePlayers() {
    return IdPrefixes.ONLINE_PLAYERS;
  }

  static playerStats(playerId:string) {
    return `${IdPrefixes.PLAYER_STATS}:${playerId}`;
  }

  static inboxKey(senderId:string,reveiverId:string) {
    const messageId = nanoid();
    const inboxId = [senderId, reveiverId].sort().join(":");
    return `${IdPrefixes.FRIEND_MESSAGES}:${inboxId}:${messageId}`;
  }

  static inboxPatern(senderId:string,reveiverId:string) {
    const inboxId = [senderId, reveiverId].sort().join(":");
    return `${IdPrefixes.FRIEND_MESSAGES}:${inboxId}:*`;
  }

  static scoreboardUpdate(gameId:string) {
    return `${IdPrefixes.SCOREBOARD_UPDATE}:${gameId}`;
  }

  static playerJoin(gameId:string) {
    return `${IdPrefixes.PLAYER_JOIN}:${gameId}`;
  }

  static gameStart(gameId:string) {
    return `${IdPrefixes.GAME_STARTED}:${gameId}`;
  }

  static allPlayersComplete(gameId:string) {
    return `${IdPrefixes.ALL_PLAYERS_COMPLETE}:${gameId}`;
  }

  static playerLeave(gameId:string) {
    return `${IdPrefixes.PLAYER_LEAVE}:${gameId}`;
  }
  
  static messageUpdate(gameId:string) {
    return `${IdPrefixes.MESSAGE_UPDATE}:${gameId}`;
  }

  static privateMessageUpdate(senderId: string, receiverId: string) {
    const inboxId = [senderId, receiverId].sort().join(":");
    return `${IdPrefixes.PRIVATE_MESSAGE_UPDATE}:${inboxId}`;
  }
}

