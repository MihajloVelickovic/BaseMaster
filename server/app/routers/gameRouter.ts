import {Router} from "express";
import GameOptions from "../models/gameOptions"
import { nanoid } from 'nanoid';
import GameInfo from "../models/gameInfo";

const gameRouter = Router();

gameRouter.get("/createGame", async (req: any, res) => {
    const {
            playerCount,
            fromBase,
            toBase,
            roundCount,
            maxValue,
            difficulty
        } = req.body;
    
    const gameOptions = new GameOptions({
        playerCount,
        fromBase,
        toBase,
        roundCount,
        maxValue,
        difficulty  
    });

    var randomNums = Array.from({length:roundCount}, (_,i) => 
        Math.floor(Math.random()*maxValue)+1
    );

    var gameId = nanoid(); // upisati u redis i vratiti ID
    
    const gameInfo = new GameInfo(
        randomNums, gameId
    );

    res.json(gameInfo);

});

// gamemode:GameModes;
//     playerCount:number;
//     fromBase:number;
//     toBase:number;
//     roundCount:number;
//     difficulty:difficulty;

export default gameRouter;