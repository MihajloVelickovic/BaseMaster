import {Router} from "express";
import GameOptions from "../models/gameOptions"
import { GameModes,Difficulties,
fromStringDiff, fromStringGM, IdPrefixes, BaseValues, 
GameStates,
fromStringState,
CacheTypes,
getGamemode}
from "../shared_modules/shared_enums";
import { nanoid, random } from 'nanoid';
import {redisClient, publisher} from "../redisClient";
import { recordResult } from "../graph/player.repo";
import { getLeaderboard } from "../graph/player.repo";
import { RedisKeys } from "../utils/redisKeyService";
import { CACHE_DURATION, MAX_NUMBER } from "../shared_modules/configMaps";



const gameRouter = Router();

function playerIdToUsername(playerId: string): string {
  // Your playerId looks like "username_random"
  // If it ever comes as just "username", this still works.
  const name = String(playerId).split("_")[0];
  return name || String(playerId);
}


gameRouter.post("/createGame", async (req: any, res:any) => {
    console.log(req.body); //DEBUG
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
    console.log(gameOptions.difficulty)
    if(gameOptions.difficulty === undefined)
        return res.status(400).send({message: "Invalid difficulty option"});

    var maxValue = MAX_NUMBER[gameOptions.difficulty];
    if(maxValue === -1)
        return res.status(400).send({message: "Could not process difficulty"});


    var randomNums = Array.from({length:roundCount}, (_,i) => 
        Math.floor(Math.random() * maxValue) + 1
    );
    
    var gameId = `${gamemode}:${nanoid()}`; // upisati u redis i vratiti ID
    
    console.log(gameOptions.gamemode); //DEBUG

    try {
        const randomNumbersKey = RedisKeys.randomNumbers(gameId);
        //save random numbers
        await redisClient.rPush(randomNumbersKey, randomNums.map(String));

        if(gameOptions.gamemode === GameModes.CHAOS)
            await addChaosBaseArrays(roundCount,gameId);
        
        var gameData = {difficulty:gameOptions.difficulty, maxPlayers:playerCount,
            currPlayerCount: 1, gameState: GameStates.LOBBY, base: toBase,
            gamemode:gameOptions.gamemode, roundCount:roundCount
        }

        await redisClient.set(gameId, JSON.stringify(gameData)); // set max player count
             
        await redisClient.hSet(IdPrefixes.LOBBIES_CURR_PLAYERS, gameId,  1); //[gameid,curr,max]
        
        await redisClient.hSet(IdPrefixes.LOBBIES_MAX_PLAYERS, gameId, playerCount);               
        
        if(gameOptions.lobbyName !== "NONE")
            await redisClient.hSet(IdPrefixes.LOBBIES_NAMES, gameId,
                                   gameOptions.lobbyName);
        
        const scroeboardKey = RedisKeys.scoreboard(gameId);
        const lobbyPlayersKey = RedisKeys.lobbyPlayers(gameId);

        await redisClient.zAdd(scroeboardKey, { score: 0, value: hostId });                              
        
        const now = Date.now();
        await redisClient.zAdd(lobbyPlayersKey, {
            score:now,
            value:hostId
        });
                                        
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
        const randomNumsKey = RedisKeys.randomNumbers(gameId);

        const num = await redisClient.lIndex(randomNumsKey, currRound);

        var fromBase ,toBase, orderBonus=0;

        const gamemode = getGamemode(gameId);
        
        const scoreboardKey = RedisKeys.scoreboard(gameId);        
        
        if(currRound > 0 && correct) {
            const orderPointsKey = RedisKeys.orderPoints(gameId);
            orderBonus = await 
            redisClient.hIncrBy(orderPointsKey, `${currRound}`, -1);
            console.log(`Order bonus: ${orderBonus+1}`);
        }
        
        const basePoints = 100;
        const pointsToAdd = orderBonus * basePoints;

        await redisClient.zIncrBy(scoreboardKey, pointsToAdd, playerId );
        
        const scoreboard =
        await redisClient.zRangeWithScores(scoreboardKey, 0, -1);
        
        scoreboard.reverse();

        if(gamemode === GameModes.CHAOS) {
            const fromBaseArrKey = RedisKeys.fromBaseArray(gameId);
            const toBaseArrayKey = RedisKeys.toBaseArray(gameId);

            fromBase = await redisClient.lIndex(fromBaseArrKey,currRound);
            toBase = await redisClient.lIndex(toBaseArrayKey,currRound);
        }

        if(!num)
            return res.status(404).send({message:"Could not find the number"});
        if(!fromBase && gamemode === GameModes.CHAOS)
            return res.status(404).send({message:"Could not find the fromBase"});
        if(!toBase && gamemode === GameModes.CHAOS)
            return res.status(404).send({message:"Could not find the toBase"});
        if(!scoreboard)
            return res.status(404).send({message:"Could not find the scoreboard"});

        console.log("sending data to subscriber", scoreboard);
        publisher.publish(RedisKeys.scoreboardUpdate(gameId),
                           JSON.stringify({scoreboard, playerId, points:pointsToAdd}));

        if(gamemode !== GameModes.CHAOS)
            return res.send({currRndNum:num});
        else
            return res.send({currRndNum:num, fromBase:fromBase, toBase:toBase});
    } catch (err) {
        return res.status(500).send('Error saving user data to Redis');
    }
});


gameRouter.post("/joinLobby", async (req:any, res:any) => {
    console.log("join Lobby is here"); //DEBUG
    
    const {
        gameId,
        playerId
    } = req.body;

    const scoreboardKey = RedisKeys.scoreboard(gameId);


    const lobbyData = await redisClient.hGet(IdPrefixes.LOBBIES_CURR_PLAYERS, gameId);

    const gameData = await redisClient.get(gameId);

    const lobbyName = await redisClient.hGet(IdPrefixes.LOBBIES_NAMES, gameId);

    if(!gameData)
        return res.status(404).send({message: "Requested lobby does not exsist"});
    if(!lobbyData)
        return res.status(404).send({message: "Requested game does not exsist"});
    var parsedData = JSON.parse(gameData);
    
    const maxPlayerCount = parsedData.maxPlayers;
    if(Number(lobbyData) >= Number(maxPlayerCount))
        return res.status(404).send({message: "Lobby is full"});  

    try {        
        parsedData.currPlayerCount = 
        (Number(parsedData.currPlayerCount) + 1).toString();
        
        await redisClient.set(gameId, JSON.stringify(parsedData));

        await redisClient.zAdd(scoreboardKey, { score: 0, value: playerId });

        await redisClient.hIncrBy(IdPrefixes.LOBBIES_CURR_PLAYERS,gameId,1);

        const now=Date.now();

        const lobbyPlayersKey = RedisKeys.lobbyPlayers(gameId);

        await redisClient.zAdd(lobbyPlayersKey, {
            score: now,
            value: playerId
        });
        
        const players = await 
        redisClient.zRange(lobbyPlayersKey, 0, -1);
        
        if(!players)
            return res.status(404).send({message: "Could not find lobby"});

        const roundsKey = RedisKeys.roundCount(gameId);
        const roundCount = await redisClient.lLen(roundsKey);
        //needed since we may join after the message is sent
        console.log("Success", gameId, parsedData);

        publisher.publish(RedisKeys.playerJoin(gameId),
                            JSON.stringify({playerID:playerId}));

        return res.send({message:"Success", gameId:gameId,
        gameData: {...parsedData, roundCount:roundCount}, players:players, lobbyName: lobbyName || gameId.slice(-5)});
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

        if(!lobbies_curr_players)
            return res.status(404).send({message:"Could not fin any lobbies!"});
                                                //Fin???? adventure time????
        if(!lobbies_max_players)
            return res.status(404).send({message:"Could not fin any lobbies!"});
                                                //Fin???? adventure time????
        if(!lobbies_names)
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

        if(!gameData)
            return res.status(404).send({message:"Could not fin the game"});

        const parcedData = JSON.parse(gameData);
        //console.log(parcedData);
        parcedData.gameState = fromStringState(gameState)

        const gameEndKey = RedisKeys.gameEnd(gameId);

        await redisClient.set(gameEndKey, Number(parcedData.currPlayerCount));

        await redisClient.set(gameId, JSON.stringify(parcedData));
        
        
        const currPlayers = 
        await redisClient.hGet(IdPrefixes.LOBBIES_CURR_PLAYERS, gameId);
        console.log("curr players = ",currPlayers);
        if(!currPlayers)
            return res.status(404).send({message: "could not find curr players"});

        await redisClient.hDel(IdPrefixes.LOBBIES_CURR_PLAYERS, gameId); // remove the data

        await redisClient.hDel(IdPrefixes.LOBBIES_MAX_PLAYERS, gameId);
        
        await redisClient.del(RedisKeys.lobbyPlayers(gameId));
        
        const orderPointsKey = RedisKeys.orderPoints(gameId);

        await setRounds(orderPointsKey,
                        parcedData.roundCount, Number(currPlayers) + 1);

        publisher.publish(
        RedisKeys.gameStart(gameId),
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

    const scoreboardKey = RedisKeys.scoreboard(gameId); 
    const gameData = await redisClient.get(gameId);

    if(!gameData)
        return res.status(404).send({message:"Could not find the game"});

    const parcedData = JSON.parse(gameData);
    const currRound = parcedData.roundCount;
    var orderBonus = 0;   
    
    if(correct) {
        const orderPointsKey = RedisKeys.orderPoints(gameId);
        orderBonus = await 
        redisClient.hIncrBy(orderPointsKey, `${currRound}`, -1);
    }
    
    const basePoints = 100;
    const pointsToAdd = orderBonus * basePoints;
    await redisClient.zIncrBy(scoreboardKey, pointsToAdd, playerId );
    const scoreboard = await redisClient.zRangeWithScores(scoreboardKey, 0, -1);
    scoreboard.reverse();

    publisher.publish(RedisKeys.scoreboardUpdate(gameId),
        JSON.stringify({scoreboard, playerId, pointsToAdd}));
    
    const gameEndKey = RedisKeys.gameEnd(gameId);

    const remainingPlayers = 
    await redisClient.decr(gameEndKey);
    
    if (parcedData.currPlayerCount > 0) {
        parcedData.currPlayerCount -= 1;
        await redisClient.set(gameId, JSON.stringify(parcedData));
    }

    if(remainingPlayers > 0 ) 
        return res.send({message:"Player status saved"});
    
    try {
        //Ove dodaj da se sacuvaju stvari u NEO4J, poruke i rezultat

        await CleanupGameContext(gameId);
        const results = await SaveResults(scoreboard); // <— now returns standings

        await publisher.publish(
            RedisKeys.allPlayersComplete(gameId),
            JSON.stringify({ results })
        );

    }
    catch(err:any) {
        return res.send({message: `Error with cleanup: ${err}`})
    }   
});


gameRouter.post("/leaveLobby", async (req: any, res: any) => {
    const { gameId, playerID } = req.body;

    if (!gameId || !playerID) {
        return res.status(400).send({ message: "Missing gameId or playerID" });
    }

    try {
        const lobbyData = await redisClient.hGet(IdPrefixes.LOBBIES_CURR_PLAYERS, gameId);
        const gameData = await redisClient.get(gameId);

        if (!lobbyData || !gameData) {
            return res.status(404).send({ message: "Lobby or game not found" });
        }

        let parsedData = JSON.parse(gameData);

        const scoreboardKey = RedisKeys.scoreboard(gameId);
        const lobbyPlayersKey = RedisKeys.lobbyPlayers(gameId);

        await redisClient.zRem(scoreboardKey, playerID);
        await redisClient.zRem(lobbyPlayersKey, playerID);

        const remainingPlayers = await redisClient.zRange(lobbyPlayersKey,0,-1);

        var newHost : string|null=null;
        if (parsedData.currPlayerCount > 1) {
            parsedData.currPlayerCount -= 1;
            await redisClient.set(gameId, JSON.stringify(parsedData));
            await redisClient.hIncrBy(IdPrefixes.LOBBIES_CURR_PLAYERS, gameId, -1);

            if(remainingPlayers.length>0)
            {
                newHost = remainingPlayers[0];
                console.log(newHost);
            }
                
        } else {
            await CleanupGameContext(gameId);
            await redisClient.hDel(IdPrefixes.LOBBIES_CURR_PLAYERS, gameId);
            await redisClient.hDel(IdPrefixes.LOBBIES_MAX_PLAYERS, gameId);
            await redisClient.del(lobbyPlayersKey);
        }


        publisher.publish(RedisKeys.playerLeave(gameId), JSON.stringify({
            type:IdPrefixes.PlAYER_LEAVE,
            playerID,
            newHost: newHost
        }));

        return res.status(200).send({ message: "Player left the lobby successfully" });
    } catch (err) {
        return res.status(500).send({ message: "Error processing leave request" });
    }
});

gameRouter.post("/leaveGame", async (req: any, res: any) => {
    const { gameId, playerID } = req.body;

    if (!gameId || !playerID) {
        return res.status(400).send({ message: "Missing gameId or playerID" });
    }

    try {
        const gameData = await redisClient.get(gameId);

        if (!gameData) {
            return res.status(404).send({ message: "Game not found" });
        }

        let parsedData = JSON.parse(gameData);

        const scoreboardID = RedisKeys.scoreboard(gameId);
        const gameEndKey = RedisKeys.gameEnd(gameId);
        const lobbyPlayersKey = RedisKeys.lobbyPlayers(gameId);

        await redisClient.zRem(scoreboardID, playerID);

        const scoreboard = await redisClient.zRangeWithScores(scoreboardID, 0, -1);
        const remainingPlayers = await redisClient.decr(gameEndKey);
        await redisClient.zRem(lobbyPlayersKey, playerID);

        if (parsedData.currPlayerCount > 1) {
            parsedData.currPlayerCount -= 1;
            await redisClient.set(gameId, JSON.stringify(parsedData));

        } else {
            await CleanupGameContext(gameId);
            await redisClient.del(gameId);
        }

        publisher.publish(RedisKeys.scoreboardUpdate(gameId),
            JSON.stringify({scoreboard, playerID, points: 0}));

        publisher.publish(RedisKeys.playerLeave(gameId), JSON.stringify({
            type:IdPrefixes.PlAYER_LEAVE,
            playerID,
        }));

        return res.status(200).send({ message: "Player left the game successfully" });
    } catch (err) {
        console.error(err);
        return res.status(500).send({ message: "Error processing leave request" });
    }
});

gameRouter.post("/sendLobbyMessage", async (req:any, res:any) => {
    const {
        playerId,
        message,
        gameId
    } = req.body;

    if(!playerId)
        return res.status(400).send({ message: "Error processing request" });
    if(!message)
        return res.status(400).send({ message: "Error processing request" });
    if(!gameId)
        return res.status(400).send({ message: "Error processing request" });

    try {
        const lobbyMessageKey = RedisKeys.lobbyMessage(gameId);

        await redisClient.rPush(lobbyMessageKey,
                                 JSON.stringify({ playerId, message }));
        publisher.publish(RedisKeys.messageUpdate(gameId),
             JSON.stringify({ playerId, message }));
        return res.send({ Message:"SENT", playerId, message });
    } 
    catch (err) {
        console.error(err);
        return res.status(500).send({ message: "Error processing message" });
    }
});

gameRouter.post("/getLobbyMessages", async (req:any, res:any) => {
    const {
        gameId
    } = req.body;

    console.log(req.body);

    if(!gameId)
        return res.status(400).send({ message: "[ERROR]: Argument gameId missing" });

    try {
        const lobbyMessageKey = RedisKeys.lobbyMessage(gameId);

        var messages = 
        await redisClient.lRange(lobbyMessageKey, 0,-1);
        messages = messages.map((e) => {
            return JSON.parse(e);
        })
        console.log(messages);
        return res.send({message:"SUCCESS", gmaeId:gameId, messages:messages });
    } 
    catch (err) {
        console.error('[ERROR]:',err);
        return res.status(500).send({ message: "Error processing message" });
    }
});


async function addChaosBaseArrays(roundCount:number, gameId:string) {
    //console.log("Entering chaos bases creation....");
    const fromBases = Array.from({ length: roundCount }, () => 
        Math.floor(Math.random() * (BaseValues.MAX_BASE -
             BaseValues.MIN_BASE + 1)) + BaseValues.MIN_BASE
    );

    const toBases = Array.from({ length: roundCount }, () => 
        Math.floor(Math.random() * (BaseValues.MAX_BASE -
                BaseValues.MIN_BASE + 1)) + BaseValues.MIN_BASE      
    );
    
    const fromBaseArrayKey = RedisKeys.fromBaseArray(gameId);
    const toBaseArrayKey = RedisKeys.toBaseArray(gameId);

    await redisClient.rPush(fromBaseArrayKey, fromBases.map(String));
    await redisClient.rPush(toBaseArrayKey, toBases.map(String));
}

async function CleanupGameContext(gameId:string) {

    const randomNumbersKey = RedisKeys.randomNumbers(gameId);
    const scoreboardKey = RedisKeys.scoreboard(gameId);
    const gameEndKey = RedisKeys.gameEnd(gameId);
    const lobbyMessageKey = RedisKeys.lobbyMessage(gameId);
    const orderPointsKey = RedisKeys.orderPoints(gameId);

    await redisClient.del(gameId);
    await redisClient.del(randomNumbersKey);
    await redisClient.del(scoreboardKey);
    await redisClient.del(gameEndKey);
    await redisClient.del(lobbyMessageKey);
    await redisClient.del(orderPointsKey);

    if(getGamemode(gameId) === GameModes.CHAOS) {
        const fromBaseArrayKey = RedisKeys.fromBaseArray(gameId);
        const toBaseArrayKey = RedisKeys.toBaseArray(gameId);

        await redisClient.del(fromBaseArrayKey);
        await redisClient.del(toBaseArrayKey);
    }
}

async function setRounds(gameId:string, roundCount:number, initialValue:number) {
    // Prepare the fields and values as a key-value pair for the hash
    const roundData:any = {};
    for (let i = 1; i <= roundCount; i++) {
      roundData[`${i}`] = initialValue;
    }
    //console.log("Order data: ", roundData);
    await redisClient.hSet(gameId, roundData);
  }

  async function SaveResults(scoreboard: { score: number; value: string; }[]) {
    // scoreboard: [{ value: playerId, score: number }, ...] high → low (you already reversed above)
    const results: Array<{ username: string; playerId: string; score: number; placement: number }> = [];

    for (let i = 0; i < scoreboard.length; i++) {
        const row = scoreboard[i];
        const playerId = row.value;
        const score = Number(row.score) || 0;
        const placement = i + 1; // 1-based podium
        const username = playerIdToUsername(playerId);

        // 1) Persist to Neo4j (you set Player.id = username)
        await recordResult({ username, score, placement: placement as 1 | 2 | 3 | 4 });

        // 2) OPTIONAL: maintain a global Redis leaderboard as a ZSET (best scores)
        // Only write if new score is higher than stored best.
        const zKey = RedisKeys.globalLeaderboard();
        const existing = await redisClient.zScore(zKey, username); // number | null
        if (existing === null || score > existing) {
            await redisClient.zAdd(zKey, [{ score, value: username }]);
        }

        results.push({ username, playerId, score, placement });
    }

  return results;
}

gameRouter.get("/globalLeaderboard", async (req: any, res: any) => {
  const limitRaw = req.query.limit;
  const skipRaw = req.query.skip;
  
  const limit = 30;
  const skip = Number.isInteger(Number(skipRaw)) ? Math.floor(Math.abs(Number(skipRaw))) : 0;
  
  try {
    // Create unique cache key for this pagination
    const leaderboardKey = `${RedisKeys.globalLeaderboard()}:${skip}:${limit}`;
    
    // Check cache
    const cached = await redisClient.get(leaderboardKey);
    
    if (cached) {
      // Cache hit
      const leaderboard = JSON.parse(cached);
      return res.status(200).json({ items:leaderboard,
                                    nextSkip: skip + leaderboard.length });
    }
    
    // Cache miss - get from Neo4j
    const items = await getLeaderboard({ limit, skip });
    
    // Cache the result
    if (items && items.length > 0) {
      await redisClient.setEx(
        leaderboardKey,
        CACHE_DURATION[CacheTypes.GENERIC_CACHE],
        JSON.stringify(items)
      );
    }
    
    return res.status(200).json({ items, nextSkip: skip + items.length });
    
  } catch (err: any) {
    console.error("[ERROR] get /globalLeaderboard:", err?.message || err);
    return res.status(500).json({ message: "Failed to fetch global leaderboard" });
  }
});



export default gameRouter;


