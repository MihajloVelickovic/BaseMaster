import { GameModes, Difficulties } from "../shared_modules/shared_enums";

export default class GameOptions {
    gamemode:GameModes;
    playerCount:number;
    roundCount:number;
    difficulty:Difficulties;
    hostId:string;
    lobbyName:string;

    constructor({gamemode, playerCount, roundCount, difficulty, hostId, lobbyName}) {
        this.gamemode = gamemode;
        this.playerCount = playerCount;
        this.roundCount = roundCount;
        this.difficulty = difficulty;
        this.hostId = hostId;
        this.lobbyName = lobbyName;
    }
}