import { GameModes, Difficulties } from "../shared_modules/shared_enums";

interface GameOptionsParams {
  gamemode: GameModes | undefined;
  playerCount: number;
  roundCount: number;
  difficulty: Difficulties | undefined;
  hostId: string;
  lobbyName: string;
}

export default class GameOptions {
  gamemode: GameModes | undefined;
  playerCount: number;
  roundCount: number;
  difficulty: Difficulties | undefined;
  hostId: string;
  lobbyName: string;

  constructor({ gamemode, playerCount, roundCount, difficulty, hostId, lobbyName }: GameOptionsParams) {
    this.gamemode = gamemode;
    this.playerCount = playerCount;
    this.roundCount = roundCount;
    this.difficulty = difficulty;
    this.hostId = hostId;
    this.lobbyName = lobbyName;
  }
}
