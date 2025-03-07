import {Router} from "express";
import GameOptions from "../models/gameOptions"
import { nanoid } from 'nanoid';
import GameInfo from "../models/gameInfo";
import redisClient from "../redisClient";

const gameRouter = Router();

gameRouter.post("/createGame", async (req: any, res) => {
    console.log(req.body);
    console.log("someting");
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

    console.log(gameOptions);

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

gameRouter.get("/getCurrNum", async (req:any, res) => {
    const {
        gameId,
        currNum
    } = req.body;

    try {
        const num = await redisClient.lIndex(gameId, currNum);
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