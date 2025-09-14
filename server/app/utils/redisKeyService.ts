import { IdPrefixes } from "../shared_modules/shared_enums";

// RedisKeyService.ts
export class RedisKeys {
  static friendList(username: string) {
      return `${IdPrefixes.FRIEND_LIST}_${username}`;
  }

  static scoreboard(gameId: string) {
    return `${IdPrefixes.PLAYER_POINTS}_${gameId}`
  }

  static gameEnd(gameId: string) {
    return`${IdPrefixes.GAME_END}_${gameId}`;
  }

  static lobbyPlayers(gameId: string) {
    return `${IdPrefixes.LOBBY_PLAYERS}_${gameId}`
  }

  static lobbyMessage(gameId:string) {
    return `${IdPrefixes.MESSAGE}_${gameId}`;
  }

  static randomNumbers(gameId: string) {
    return `${IdPrefixes.RANDOM_NUMBERS}_${gameId}`;
  }

  static orderPoints(gameId: string) {
    return `${IdPrefixes.ORDER_POINTS}_${gameId}`;
  }

  static fromBaseArray(gameId: string) {
    return `${IdPrefixes.FROM_BASE}_${gameId}`
  }

  static toBaseArray(gameId: string) {
    return `${IdPrefixes.TO_BASE}_${gameId}`;
  }

  static globalLeaderboard() {
    return 'global_learerboard';
  }

  static onlinePlayers() {
    return IdPrefixes.ONLINE_PLAYERS;
  }

  static playerStats(playerId:string) {
    return `${IdPrefixes.PLAYER_STATS}_${playerId}`;
  }
}
