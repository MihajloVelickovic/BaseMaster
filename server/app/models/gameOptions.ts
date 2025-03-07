import { GameModes, Difficulties } from "../shared_modules/shared_enums";



export default class GameOptions {
    gamemode:GameModes;
    playerCount:number;
    roundCount:number;
    difficulty:Difficulties;

    constructor({ playerCount, fromBase, toBase, roundCount, difficulty }) {
        this.playerCount = playerCount;
        this.roundCount = roundCount;
        this.difficulty = difficulty;
    }
}