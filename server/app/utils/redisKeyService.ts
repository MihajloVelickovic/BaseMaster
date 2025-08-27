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

  
}
