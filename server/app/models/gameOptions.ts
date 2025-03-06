import { GameModes } from "./gamemodeEnum";

enum difficulty {
    LAYMAN,
    CHILL_GUY,
    ELFAK_ENJOYER,
    BASED_MASTER
}

export default class GameOptions {
    gamemode:GameModes;
    playerCount:number;
    fromBase:number;
    toBase:number;
    roundCount:number;
    maxValue:number;
    difficulty:difficulty;

    constructor({ playerCount, fromBase, toBase, roundCount, maxValue, difficulty }) {
        this.playerCount = playerCount;
        this.fromBase = fromBase;
        this.toBase = toBase;
        this.roundCount = roundCount;
        this.maxValue = maxValue;
        this.difficulty = difficulty;
    }
}