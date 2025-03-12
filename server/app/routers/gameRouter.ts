import {Router} from "express";
import GameOptions from "../models/gameOptions"
import { GameModes,Difficulties, DifficultyValues,
fromStringDiff, fromStringGM, IdPrefixes, BaseValues, maxValueFromDifficulty, 
GameStates,
fromStringState}
from "../shared_modules/shared_enums";
import { nanoid } from 'nanoid';
import GameInfo from "../models/gameInfo";
import {redisClient, publisher} from "../redisClient";
import { json } from "stream/consumers";

const gameRouter = Router();

gameRouter.post("/createGame", async (req: any, res) => {
    console.log(req.body);
    //console.log("someting");
    const {
            gamemode,
            playerCount,
            roundCount,
            difficulty,
            hostId,
            toBase
        } = req.body;
          
    const gameOptions = new GameOptions({
        gamemode:fromStringGM(gamemode),
        playerCount,
        roundCount,
        difficulty:fromStringDiff(difficulty),
        hostId  
    });

    
    var maxValue = maxValueFromDifficulty(gameOptions.difficulty);

    if(maxValue === -1)
        res.status(400).send({message: "Could not process difficulty"});

    var randomNums = Array.from({length:roundCount}, (_,i) => 
        Math.floor(Math.random()*maxValue)+1
    );

    
    var gameId = `${gamemode}_${nanoid()}`; // upisati u redis i vratiti ID
    
    console.log(gameOptions.gamemode);

    try {

        //save random numbers
        await redisClient.rPush(`${IdPrefixes.RANDOM_NUMBERS}_${gameId}`,
                                randomNums.map(String)
        );

        if(gameOptions.gamemode === GameModes.CHAOS)
            await addChaosBaseArrays(roundCount,gameId);
        
        var gameData = {difficulty:gameOptions.difficulty, maxPlayers:playerCount,
            currPlayerCount: 1, gameState: GameStates.LOBBY, base: toBase
        }

        await redisClient.set(gameId, JSON.stringify(gameData)); // set max player count
        
        
        await redisClient.sAdd(IdPrefixes.LOBBIES, gameId);

        await redisClient.zAdd(`${IdPrefixes.PLAYER_POINTS}_${gameId}`, 
            { score: 0, value: hostId });

        res.send({message:`Game created succesfully`, gameID:gameId});
    } catch (err) {
        res.status(500).send('Error saving user data to Redis');
    }

    

});

gameRouter.post("/getCurrNum", async (req:any, res) => {
    
    const {
        gameId,
        currRound,
        playerId,
        correct
    } = req.body;

    try {
        const num = await redisClient.lIndex(
            `${IdPrefixes.RANDOM_NUMBERS}_${gameId}`, currRound);

        var fromBase ,toBase;

        const gamemode = fromStringGM(String(gameId).split("_")[0]);
        
        const scoreboardID = `${IdPrefixes.PLAYER_POINTS}_${gameId}`;
        
        await redisClient.zIncrBy(scoreboardID, correct ? 100 : 0, playerId );
        
        const scoreboard = await 
        redisClient.zRangeWithScores(scoreboardID, 0, -1);
   
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
        if(scoreboard === null)
            res.status(404).send({message:"Could not find the scoreboard"});

        console.log("sending data to subscriber");
        publisher.publish(gameId, JSON.stringify(scoreboard));

        if(gamemode !== GameModes.CHAOS)
            res.send({currRndNum:num});
        else
            res.send({currRndNum:num, fromBase:fromBase, toBase:toBase});
    } catch (err) {
        res.status(500).send('Error saving user data to Redis');
    }
});


gameRouter.post("/joinLobby", async (req:any, res:any) => {
    console.log("join Lobby is here");
    const {
        gameId,
        playerId
    } = req.body;


    const scoreboardID = `${IdPrefixes.PLAYER_POINTS}_${gameId}`;

    const currPlayerCount = 
    await redisClient.zCard(scoreboardID);

    const gameData = await redisClient.get(gameId);

    if(gameData === null)
        return res.status(404).send({message: "Requested lobby does not exsist"});

    var parcedData = JSON.parse(gameData);
    console.log(parcedData);
    const maxPlayerCount = parcedData.maxPlayers;

    
    if(maxPlayerCount === null)
        return res.status(404).send({message: "Requested game does not exsist"});
    if(Number(currPlayerCount) > Number(maxPlayerCount))
        return res.status(404).send({message: "Lobby is full"});

    try {
        console.log("in try");
        parcedData.currPlayerCount = (Number(parcedData.currPlayerCount)+1).toString();
        console.log("a lit bit deeper");
        await redisClient.set(gameId, JSON.stringify(parcedData));

        await redisClient.zAdd(scoreboardID, 
            { score: 0, value: playerId });

        console.log("Success", gameId, parcedData);

        return res.send({message:"Success", gameId:gameId, gameData:parcedData});
    }
    catch(err:any) {
        return res.status(404).send({message: err.message});
    }

    
    //if(lobbyData)
});

gameRouter.get("/getLobbies", async (req:any, res:any) => {
    try {
        const lobbies = await redisClient.sMembers(IdPrefixes.LOBBIES);
        console.log("lobbies: ", lobbies);
        if(lobbies === null)
            return res.status(404).send({message:"Could not fin any lobbies!"});

        return res.send({lobbies});
    } catch (err) {
        res.status(500).send('Error saving user data to Redis');
    }
});

gameRouter.post("/setGameState", async (req:any, res:any) => {
    const {
        gameId,
        gameState
    } = req.body;

    try {
        const gameData = await redisClient.get(gameId);

        if(gameData === null)
            return res.status(404).send({message:"Could not fin the game"});

        const parcedData = JSON.parse(gameData);

        parcedData.gameState = fromStringState(gameState);

        await redisClient.set(gameId, JSON.stringify(parcedData));

        await redisClient.sRem(IdPrefixes.LOBBIES, gameId); // remove the data

        publisher.publish(
        `${IdPrefixes.GAME_STARTED}_${gameId}`,
         JSON.stringify({message:"GAME STARTED"}));      

        console.log("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");   

        return res.status(200).send({message:"Set state to: "});
    }
    catch(err:any) {
        return res.status(404).send({message: err.message});
    }

});

async function addChaosBaseArrays(roundCount:number, gameId:String) {
    console.log("Entering chaos bases creation....");
    const fromBases = Array.from({ length: roundCount }, () => 
        Math.floor(Math.random() * (BaseValues.MAX_BASE -
             BaseValues.MIN_BASE + 1)) + BaseValues.MIN_BASE
    );

    const toBases = Array.from({ length: roundCount }, () => 
        Math.floor(Math.random() * (BaseValues.MAX_BASE -
                BaseValues.MIN_BASE + 1)) + BaseValues.MIN_BASE      
    );
    

    await redisClient.rPush(`${IdPrefixes.FROM_BASE}_${gameId}`,
                             fromBases.map(String));
    await redisClient.rPush(`${IdPrefixes.TO_BASE}_${gameId}`,
                             toBases.map(String));

    // for (const [fromBase, toBase] of randomBases) {  // Use for...of here
    //     console.log("FromBase:", fromBase);
        
    //     await redisClient.rPush(
    //         `${IdPrefixes.FROM_BASE}_${gameId}`, String(fromBase)
    //     );
        
    //     console.log("ToBase:", toBase);
        
    //     await redisClient.rPush(
    //         `${IdPrefixes.TO_BASE}_${gameId}`, String(toBase)
    //     );
    // }
}


export default gameRouter;