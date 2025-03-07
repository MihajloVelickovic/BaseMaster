import {Router} from "express";
import GameOptions from "../models/gameOptions"
import { GameModes,Difficulties, DifficultyValues, fromString } from "../shared_modules/shared_enums";
import { nanoid } from 'nanoid';
import GameInfo from "../models/gameInfo";
import redisClient from "../redisClient";

const gameRouter = Router();

gameRouter.post("/createGame", async (req: any, res) => {
    console.log(req.body);
    //console.log("someting");
    const {
            playerCount,
            fromBase,
            toBase,
            roundCount,
            difficulty
        } = req.body;
    
    
    
    const gameOptions = new GameOptions({
        playerCount,
        fromBase,
        toBase,
        roundCount,
        difficulty:fromString(difficulty)  
    });

    console.log(gameOptions);
    var maxValue=0;

    switch(gameOptions.difficulty) {
        case Difficulties.LAYMAN:
            maxValue = DifficultyValues.LAYMAN;
            break;
        case Difficulties.CHILL_GUY:
            maxValue = DifficultyValues.CHILL_GUY;
            break;
        case Difficulties.ELFAK_ENJOYER:
            maxValue = DifficultyValues.ELFAK_ENJOYER;
            break;
        case Difficulties.BASED_MASTER:
            maxValue = DifficultyValues.BASED_MASTER;
            break;
        default:
            break;
    }

    var randomNums = Array.from({length:roundCount}, (_,i) => 
        Math.floor(Math.random()*maxValue)+1
    );

    var gameId = `rn_${nanoid()}`; // upisati u redis i vratiti ID
    
    try {
        randomNums.forEach(async (num) => {
            await redisClient.rPush(gameId, String(num));
        });
        res.send({message:`Game created succesfully`, gameID:gameId});
    } catch (err) {
        res.status(500).send('Error saving user data to Redis');
    }

    

});

gameRouter.post("/getCurrNum", async (req:any, res) => {
    const {
        gameId,
        currRound
    } = req.body;

    try {
        const num = await redisClient.lIndex(gameId, currRound);
        if(num !== null)
            res.send({currRndNum:num});
        else
            res.status(404).send({message:"Could not find the number"});
    } catch (err) {
        res.status(500).send('Error saving user data to Redis');
    }
});

// gamemode:GameModes;
//     playerCount:number;
//     fromBase:number;
//     toBase:number;
//     roundCount:number;
//     difficulty:difficulty;

export default gameRouter;