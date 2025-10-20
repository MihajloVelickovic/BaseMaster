import { GameModes, Difficulties, GameStates } from "../shared_modules/shared_enums";

interface GameOptionsParams {
  gamemode: GameModes | undefined;
  playerCount: number;
  roundCount: number;
  difficulty: Difficulties;
  hostId: string;
  lobbyName: string;
  maxPlayers:number;
  gameState: GameStates;
}

export default class GameOptions {
  gamemode: GameModes | undefined;
  playerCount: number;
  roundCount: number;
  difficulty: Difficulties;
  hostId: string;
  lobbyName: string;
  maxPlayers: number;
  gameState: GameStates;

  constructor({ gamemode, playerCount, roundCount, difficulty, hostId, lobbyName, maxPlayers, gameState }: GameOptionsParams) {
    this.gamemode = gamemode;
    this.playerCount = playerCount;
    this.roundCount = roundCount;
    this.difficulty = difficulty;
    this.hostId = hostId;
    this.lobbyName = lobbyName;
    this.maxPlayers = maxPlayers;
    this.gameState = gameState;
  }
}
