import {Router} from "express";
import GameOptions from "../models/gameOptions"
import { GameModes,Difficulties, DifficultyValues, fromStringDiff, fromStringGM, IdPrefixes, BaseValues }
 from "../shared_modules/shared_enums";
import { nanoid } from 'nanoid';
import GameInfo from "../models/gameInfo";
import redisClient from "../redisClient";

const gameRouter = Router();

gameRouter.post("/createGame", async (req: any, res) => {
    console.log(req.body);
    //console.log("someting");
    const {
            gamemode,
            playerCount,
            roundCount,
            difficulty
        } = req.body;
    
    
    
    const gameOptions = new GameOptions({
        gamemode:fromStringGM(gamemode),
        playerCount,
        roundCount,
        difficulty:fromStringDiff(difficulty)  
    });

    
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

  
    var gameId = `${gamemode}_${nanoid()}`; // upisati u redis i vratiti ID
    
    console.log(gameOptions.gamemode);

    try {
        randomNums.forEach(async (num) => {
            await redisClient.rPush(`${IdPrefixes.RANDOM_NUMBERS}_${gameId}`,
                                     String(num));
        });

        if(gameOptions.gamemode === GameModes.CHAOS) {
            console.log("Entering chaos bases creation....");
            const randomBases = Array.from({ length: roundCount }, () => [
                Math.floor(Math.random() * (BaseValues.MAX_BASE -
                     BaseValues.MIN_BASE + 1)) + BaseValues.MIN_BASE,
                Math.floor(Math.random() * (BaseValues.MAX_BASE -
                            BaseValues.MIN_BASE + 1)) + BaseValues.MIN_BASE
            ]);
            
            for (const [fromBase, toBase] of randomBases) {  // Use for...of here
                console.log("FromBase:", fromBase);
                
                await redisClient.rPush(
                    `${IdPrefixes.FROM_BASE}_${gameId}`, String(fromBase)
                );
                
                console.log("ToBase:", toBase);
                
                await redisClient.rPush(
                    `${IdPrefixes.TO_BASE}_${gameId}`, String(toBase)
                );
            }
        }

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
        const num = await redisClient.lIndex(
            `${IdPrefixes.RANDOM_NUMBERS}_${gameId}`, currRound);

        var fromBase ,toBase;

        const gamemode = fromStringGM(String(gameId).split("_")[0]);

        if(gamemode === GameModes.CHAOS) {
            fromBase = await redisClient.
                        lIndex(`${IdPrefixes.FROM_BASE}_${gameId}`,currRound);
            toBase = await redisClient.
                        lIndex(`${IdPrefixes.TO_BASE}_${gameId}`,currRound);
        }

        if(num === null)
            res.status(404).send({message:"Could not find the number"});
        if(fromBase === null && gamemode === GameModes.CHAOS)
            res.status(404).send({message:"Could not find the fromBase"});
        if(toBase === null && gamemode === GameModes.CHAOS)
            res.status(404).send({message:"Could not find the toBase"});

        if(gamemode !== GameModes.CHAOS)
            res.send({currRndNum:num});
        else
            res.send({currRndNum:num, fromBase:fromBase, toBase:toBase});
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