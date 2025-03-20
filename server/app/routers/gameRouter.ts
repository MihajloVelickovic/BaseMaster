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
import { receiveMessageOnPort } from "worker_threads";

const gameRouter = Router();

gameRouter.post("/createGame", async (req: any, res:any) => {
    console.log(req.body);
    //console.log("someting");
    const {
            gamemode,
            playerCount,
            roundCount,
            difficulty,
            hostId,
            toBase,
            lobbyName
        } = req.body;
          
    const gameOptions = new GameOptions({
        gamemode:fromStringGM(gamemode),
        playerCount,
        roundCount,
        difficulty:fromStringDiff(difficulty),
        hostId,
        lobbyName  
    });


    if(playerCount <= 0)
        return res.status(400).send({message: "Invalid player count"});
    if(roundCount <= 0)
        return res.status(400).send({message: "Invalid round count"});
    if(difficulty === undefined)
        return res.status(400).send({message: "Invalid difficulty option"});

    var maxValue = maxValueFromDifficulty(gameOptions.difficulty);

    if(maxValue === -1)
        return res.status(400).send({message: "Could not process difficulty"});

    var randomNums = Array.from({length:roundCount}, (_,i) => 
        Math.floor(Math.random()*maxValue) + 1
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
            currPlayerCount: 1, gameState: GameStates.LOBBY, base: toBase,
            gamemode:gameOptions.gamemode
        }

        await redisClient.set(gameId, JSON.stringify(gameData)); // set max player count
             
        await redisClient.hSet(IdPrefixes.LOBBIES_CURR_PLAYERS, gameId,  1); //[gameid,curr,max]

        await redisClient.hSet(IdPrefixes.LOBBIES_MAX_PLAYERS, gameId, playerCount);               
        
        if(gameOptions.lobbyName !== "NONE")
            await redisClient.hSet(IdPrefixes.LOBBIES_NAMES, gameId,
                                   gameOptions.lobbyName);

        await redisClient.zAdd(`${IdPrefixes.PLAYER_POINTS}_${gameId}`, 
                                { score: 0, value: hostId });                              

        res.send({message:`Game created succesfully`, gameID:gameId});
    } catch (err) {
        res.status(500).send('Error saving user data to Redis');
    }
});

gameRouter.post("/getCurrNum", async (req:any, res:any) => {  
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
        
        scoreboard.reverse();

        if(gamemode === GameModes.CHAOS) {
            fromBase = await redisClient.
                        lIndex(`${IdPrefixes.FROM_BASE}_${gameId}`,currRound);
            toBase = await redisClient.
                        lIndex(`${IdPrefixes.TO_BASE}_${gameId}`,currRound);
        }

        if(num === null)
            return res.status(404).send({message:"Could not find the number"});
        if(fromBase === null && gamemode === GameModes.CHAOS)
            return res.status(404).send({message:"Could not find the fromBase"});
        if(toBase === null && gamemode === GameModes.CHAOS)
            return res.status(404).send({message:"Could not find the toBase"});
        if(scoreboard === null)
            return res.status(404).send({message:"Could not find the scoreboard"});

        console.log("sending data to subscriber");
        publisher.publish(`${IdPrefixes.SCOREBOARD_UPDATE}_${gameId}`,
                           JSON.stringify(scoreboard));

        if(gamemode !== GameModes.CHAOS)
            return res.send({currRndNum:num});
        else
            return res.send({currRndNum:num, fromBase:fromBase, toBase:toBase});
    } catch (err) {
        return res.status(500).send('Error saving user data to Redis');
    }
});


gameRouter.post("/joinLobby", async (req:any, res:any) => {
    console.log("join Lobby is here");
    const {
        gameId,
        playerId
    } = req.body;

    const scoreboardID = `${IdPrefixes.PLAYER_POINTS}_${gameId}`;

    const lobbyData = await redisClient.hGet(IdPrefixes.LOBBIES_CURR_PLAYERS, gameId);

    const gameData = await redisClient.get(gameId);

    if(gameData === null)
        return res.status(404).send({message: "Requested lobby does not exsist"});
    if(lobbyData === null)
        return res.status(404).send({message: "Requested game does not exsist"});
    var parcedData = JSON.parse(gameData);
    
    const maxPlayerCount = parcedData.maxPlayers;
    if(Number(lobbyData) >= Number(maxPlayerCount))
        return res.status(404).send({message: "Lobby is full"});  

    try {        
        parcedData.currPlayerCount = 
        (Number(parcedData.currPlayerCount)+1).toString();
        
        await redisClient.set(gameId, JSON.stringify(parcedData));

        await redisClient.zAdd(scoreboardID, { score: 0, value: playerId });

        await redisClient.hIncrBy(IdPrefixes.LOBBIES_CURR_PLAYERS,gameId,1);

        console.log("Success", gameId, parcedData);

        return res.send({message:"Success", gameId:gameId, gameData:parcedData});
    }
    catch(err:any) {
        return res.status(404).send({message: err.message});
    }    
});

gameRouter.get("/getLobbies", async (req:any, res:any) => {
    try {
        const lobbies_curr_players = 
        await redisClient.hGetAll(IdPrefixes.LOBBIES_CURR_PLAYERS);
        
        const lobbies_max_players = 
        await redisClient.hGetAll(IdPrefixes.LOBBIES_MAX_PLAYERS);

        const lobbies_names = await redisClient.hGetAll(IdPrefixes.LOBBIES_NAMES);

        if(lobbies_curr_players === null)
            return res.status(404).send({message:"Could not fin any lobbies!"});
                                                //Fin???? adventure time????
        if(lobbies_max_players === null)
            return res.status(404).send({message:"Could not fin any lobbies!"});
                                                //Fin???? adventure time????
        if(lobbies_names === null)
            return res.status(404).send({message:"Could not fin any lobbies!"});

        const parsedLobbies_curr_players = Object.fromEntries(
        Object.entries(lobbies_curr_players).map(([key, value]) => [key, value])
        );
        const parsedLobbies_max_players = Object.fromEntries(
        Object.entries(lobbies_max_players).map(([key, value]) => [key, value])
        );
        const parsedLobbies_names = Object.fromEntries(
            Object.entries(lobbies_names).map(([key, value]) => [key, value])
        );
        var mergedLobbyData:any = []

        for (const [gameId, currPlayers] of Object.entries(parsedLobbies_curr_players)) {
            mergedLobbyData.push([gameId,currPlayers,
            parsedLobbies_max_players[String(gameId)], parsedLobbies_names[gameId] ?? "NONE"]);
        }
       
        return res.send({lobbies: mergedLobbyData});
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

        await redisClient.set(`${IdPrefixes.GAME_END}_${gameId}`,
                               Number(parcedData.currPlayerCount));

        await redisClient.set(gameId, JSON.stringify(parcedData));

        await redisClient.hDel(IdPrefixes.LOBBIES_CURR_PLAYERS, gameId); // remove the data

        await redisClient.hDel(IdPrefixes.LOBBIES_MAX_PLAYERS, gameId);

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

gameRouter.post("/playerComplete", async (req:any, res:any) => {
    const {
        playerId: playerId,
        gameId: gameId,
        correct: correct
    } = req.body;

    const scoreboardID = `${IdPrefixes.PLAYER_POINTS}_${gameId}`;    
    await redisClient.zIncrBy(scoreboardID, correct ? 100 : 0, playerId );
    const scoreboard = await redisClient.zRangeWithScores(scoreboardID, 0, -1);
    scoreboard.reverse();
    publisher.publish(gameId, JSON.stringify(scoreboard));

    const remainingPlayers = 
    await redisClient.decr(`${IdPrefixes.GAME_END}_${gameId}`);

    if(remainingPlayers === 0 ) {
        try {
            await CleanupGameContext(gameId);

            publisher.publish(`${IdPrefixes.ALL_PLAYERS_COMPLETE}_${gameId}`,
                               "Game Over");
        }
        catch(err:any) {
            return res.send({message: `Error with cleanup: ${err}`})
        }
    }
    else
        return res.send({message:"Player status saved"});

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
}

async function CleanupGameContext(gameId:string) {
    await redisClient.del(gameId);
    await redisClient.del(`${IdPrefixes.RANDOM_NUMBERS}_${gameId}`);
    await redisClient.del(`${IdPrefixes.PLAYER_POINTS}_${gameId}`);
    await redisClient.del(`${IdPrefixes.GAME_END}_${gameId}`);

    if(gameId.split("_")[0] === GameModes.CHAOS) {
        await redisClient.del(`${IdPrefixes.FROM_BASE}_${gameId}`);
        await redisClient.del(`${IdPrefixes.TO_BASE}_${gameId}`);
    }
}

export default gameRouter;
