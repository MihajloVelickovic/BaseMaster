import { GameModes, Difficulties, GameStates } from "../shared_modules/shared_enums";

interface GameOptionsParams {
  gamemode: GameModes | undefined;
  roundCount: number;
  difficulty: Difficulties;
  hostId: string;
  lobbyName: string;
  maxPlayers:number;
  gameState: GameStates;
  base: number;
}

export default class GameOptions {
  gamemode: GameModes | undefined;
  roundCount: number;
  difficulty: Difficulties;
  hostId: string;
  lobbyName: string;
  maxPlayers: number;
  gameState: GameStates;
  base:number;

  constructor({ gamemode, roundCount, difficulty, hostId, lobbyName, maxPlayers, gameState, base }: GameOptionsParams) {
    this.gamemode = gamemode;
    this.roundCount = roundCount;
    this.difficulty = difficulty;
    this.hostId = hostId;
    this.lobbyName = lobbyName;
    this.maxPlayers = maxPlayers;
    this.gameState = gameState;
    this.base = base;
  }
}
