import {json, Router} from "express";
import GameOptions from "../models/gameOptions"
import { GameModes,Difficulties,
fromStringDiff, fromStringGM, IdPrefixes as Prefixes, BaseValues, 
GameStates,
fromStringState,
CacheTypes,
getGamemode,
PAGE_SIZE}
from "../shared_modules/shared_enums";
import { nanoid, random } from 'nanoid';
import {redisClient, publisher} from "../redisClient";
import { RedisKeys } from "../utils/redisKeyService";
import { CACHE_DURATION, DiffcultyModifier, MAX_NUMBER } from "../shared_modules/configMaps";
import { isNullOrWhitespace } from "../utils/stringUtils";
import { addChaosBaseArrays, CleanupGameContext, SaveResults, setRounds } from "../utils/gameService";
import { getGlobalLeaderboard } from "../graph/leaderboard.repo";
import { authUser } from "../config/config";
import { PlayerResult } from "../models/types";



const gameRouter = Router();

gameRouter.post("/createGame", authUser, async (req: any, res:any) => {
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
    
    var gameId = RedisKeys.gameId(gamemode); // upisati u redis i vratiti ID
    
    console.log(gameOptions.gamemode); //DEBUG

    try {
        const randomNumbersKey = RedisKeys.randomNumbers(gameId);
        //save random numbers
        await redisClient.rPush(randomNumbersKey, randomNums.map(String));

        if(gameOptions.gamemode === GameModes.CHAOS)
            await addChaosBaseArrays(roundCount,gameId);
        
        const finalLobbyName = 
        isNullOrWhitespace(lobbyName) || lobbyName === 'NONE' 
        ? `${hostId}'s` : lobbyName;

        var gameData = {difficulty:gameOptions.difficulty, maxPlayers:playerCount,
            currPlayerCount: 1, gameState: GameStates.LOBBY, base: toBase,
            gamemode:gameOptions.gamemode, roundCount:roundCount, lobbyName:finalLobbyName
        }
        const scroeboardKey = RedisKeys.scoreboard(gameId);
        const lobbyPlayersKey = RedisKeys.lobbyPlayers(gameId);
        const currNumKey = RedisKeys.playerCurrentRound(gameId, hostId);

        await redisClient.set(gameId, JSON.stringify(gameData)); // set max player count
             
        await redisClient.hSet(Prefixes.LOBBIES_CURR_PLAYERS, gameId,  1); //[gameid,curr,max]
        
        await redisClient.hSet(Prefixes.LOBBIES_MAX_PLAYERS, gameId, playerCount);               
                
        await redisClient.hSet(Prefixes.LOBBIES_NAMES, gameId,
                                finalLobbyName);
        await redisClient.set(currNumKey, 0);
               
        await redisClient.zAdd(scroeboardKey, { score: 0, value: hostId });                              
        
        const now = Date.now();
        await redisClient.zAdd(lobbyPlayersKey, {
            score:now,
            value:hostId
        });
        console.log("BEFORE send gameData",gameData);                              
        return res.send({message:`Game created succesfully`, gameID:gameId, gameData});
    } catch (err) {
        return res.status(500).send('Error saving user data to Redis');
    }
});

gameRouter.post("/submitResult", authUser, async (req:any, res:any) => {  
    const { gameId, playerId, correct } = req.body;

    if(isNullOrWhitespace(gameId) || isNullOrWhitespace(playerId) 
       || correct === null)
        return res.status(400).send('Invalid body');
    
    try {
        const randomNumsKey = RedisKeys.randomNumbers(gameId);
        const playerCurrNumKey = RedisKeys.playerCurrentRound(gameId, playerId);

        const currRoundRaw = await redisClient.get(playerCurrNumKey);
        if(!currRoundRaw)
            return res.status(404).send('Could not find curr round');

        const currRound = Number(currRoundRaw);
        if(isNaN(currRound))
            return res.status(500).send('Invalid round number found');

        // Get CURRENT round data for scoring
        const num = await redisClient.lIndex(randomNumsKey, currRound);
        if(!num)
            return res.status(404).send({message:"Could not find the number"});

        const gameDataRaw = await redisClient.get(gameId);
        if(!gameDataRaw)
            return res.status(404).send('Could not find game with specified id');

        const gameData:GameOptions = JSON.parse(gameDataRaw);
        const gamemode = getGamemode(gameId);
        
        // Calculate score for CURRENT round
        const scoreboardKey = RedisKeys.scoreboard(gameId);        
        let orderBonus = 0;
        
        if(correct) {
            const orderPointsKey = RedisKeys.orderPoints(gameId);
            orderBonus = await redisClient.hIncrBy(orderPointsKey, `${currRound}`, -1);
        }
        
        const basePoints = 100;
        const pointsToAdd = orderBonus * basePoints;
        await redisClient.zIncrBy(scoreboardKey, pointsToAdd, playerId);
        
        const scoreboard = await redisClient.zRangeWithScores(scoreboardKey, 0, -1);
        scoreboard.reverse();

        await publisher.publish(RedisKeys.scoreboardUpdate(gameId),
            JSON.stringify({scoreboard, playerId, points:pointsToAdd}));

        // NOW increment to next round
        await redisClient.incr(playerCurrNumKey);
        const nextRound = currRound + 1;
        
        // Check if there's a next round
        const hasNext = nextRound < gameData.roundCount;
        
        if (!hasNext) {
            return res.send({ 
                hasNext: false,
                finished: true
            });
        }

        // Get NEXT round data
        const nextNum = await redisClient.lIndex(randomNumsKey, nextRound);
        if(!nextNum)
            return res.status(404).send({message:"Could not find next number"});

        if(gamemode === GameModes.CHAOS) {
            const fromBaseArrKey = RedisKeys.fromBaseArray(gameId);
            const toBaseArrayKey = RedisKeys.toBaseArray(gameId);
            const fromBase = await redisClient.lIndex(fromBaseArrKey, nextRound);
            const toBase = await redisClient.lIndex(toBaseArrayKey, nextRound);
            
            if(!fromBase || !toBase)
                return res.status(404).send({message:"Could not find bases"});
            
            return res.send({
                currRndNum: nextNum,
                fromBase,
                toBase,
                hasNext: true,
                finished: false
            });
        }

        return res.send({
            currRndNum: nextNum,
            hasNext: true,
            finished: false
        });
    } catch (err) {
        return res.status(500).send('Error processing submission');
    }
});

gameRouter.get("/getCurrNum", authUser, async (req:any, res:any) => {  
    const { gameId, playerId } = req.query;

    if(isNullOrWhitespace(gameId))
        return res.status(400).send('Missing gameId');
    if(isNullOrWhitespace(playerId))
        return res.status(400).send('Missing playerId');

    try {
        const playerRoundKey = RedisKeys.playerCurrentRound(gameId as string, playerId as string);
        const currRoundRaw = await redisClient.get(playerRoundKey);
        const currRound = currRoundRaw !== null ? parseInt(currRoundRaw) : 0;

        const randomNumsKey = RedisKeys.randomNumbers(gameId as string);
        const num = await redisClient.lIndex(randomNumsKey, currRound);
             
        const gameDataRaw = await redisClient.get(gameId);

        if(!gameDataRaw)
            return res.status(404).send({ message: "Could not find the game" });

        const gameData:GameOptions = JSON.parse(gameDataRaw);

        const gamemode = getGamemode(gameId as string);
        let fromBase, toBase;
        if (gamemode === GameModes.CHAOS) {
            const fromBaseArrKey = RedisKeys.fromBaseArray(gameId as string);
            const toBaseArrayKey = RedisKeys.toBaseArray(gameId as string);
            fromBase = await redisClient.lIndex(fromBaseArrKey, currRound);
            toBase = await redisClient.lIndex(toBaseArrayKey, currRound);
        }

        if(!num)
            return res.status(404).send({message:"Could not find the number"});
        if(!fromBase && gamemode === GameModes.CHAOS)
            return res.status(404).send({message:"Could not find the fromBase"});
        if(!toBase && gamemode === GameModes.CHAOS)
            return res.status(404).send({message:"Could not find the toBase"});
        
        const scoreboardKey = RedisKeys.scoreboard(gameId as string);
        const scoreboard = await redisClient.zRangeWithScores(scoreboardKey, 0, -1);
        const hasNext = gameData.roundCount > currRound;

        if (gamemode !== GameModes.CHAOS)
            return res.send({ currRndNum: num, hasNext, scoreboard });
        else
            return res.send({ currRndNum: num, fromBase,
                              toBase, hasNext, scoreboard  });
    }
    catch(error:any) {
        console.log("[ ERROR ]: ", error);
        return res.status(500).send('Error saving user data to Redis');
    }
});

gameRouter.post("/joinLobby", authUser, async (req:any, res:any) => {
    const {
        gameId,
        playerId
    } = req.body;

    if(isNullOrWhitespace(gameId) || isNullOrWhitespace(playerId))
        return res.status(400).send('Invalid body for join lobby');

    const scoreboardKey = RedisKeys.scoreboard(gameId);

    const lobbyData = await redisClient.hGet(Prefixes.LOBBIES_CURR_PLAYERS, gameId);

    const gameData = await redisClient.get(gameId);

    const lobbyName = await redisClient.hGet(Prefixes.LOBBIES_NAMES, gameId);

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

        await redisClient.hIncrBy(Prefixes.LOBBIES_CURR_PLAYERS,gameId,1);

        const playerRoundKey = RedisKeys.playerCurrentRound(gameId, playerId);
        await redisClient.set(playerRoundKey, 0);

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

        await publisher.publish(RedisKeys.playerJoin(gameId),
                            JSON.stringify({playerID:playerId, gameData}));

        return res.send({message:"Success", gameId:gameId,
        gameData: {...parsedData, roundCount:roundCount}, players:players, lobbyName: lobbyName || gameId.slice(-5)});
    }
    catch(err:any) {
        return res.status(404).send({message: err.message});
    }    
});

gameRouter.get("/getLobbies", authUser, async (req:any, res:any) => {
    try {
        const lobbies_curr_players = 
        await redisClient.hGetAll(Prefixes.LOBBIES_CURR_PLAYERS);
        
        const lobbies_max_players = 
        await redisClient.hGetAll(Prefixes.LOBBIES_MAX_PLAYERS);

        const lobbies_names = await redisClient.hGetAll(Prefixes.LOBBIES_NAMES);

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

gameRouter.post("/setGameState", authUser, async (req:any, res:any) => {
    const {
        gameId,
        gameState
    } = req.body;

    if(isNullOrWhitespace(gameId) || isNullOrWhitespace(gameState))
        return res.status(400).send('Invalid body for set game state');

    try {
        const gameData = await redisClient.get(gameId);

        if(!gameData)
            return res.status(404).send({message:"Could not fin the game"});

        const parcedData = JSON.parse(gameData);

        parcedData.gameState = fromStringState(gameState)

        const gameEndKey = RedisKeys.gameEnd(gameId);

        await redisClient.set(gameEndKey, Number(parcedData.currPlayerCount));

        await redisClient.set(gameId, JSON.stringify(parcedData));
        
        
        const currPlayers = 
        await redisClient.hGet(Prefixes.LOBBIES_CURR_PLAYERS, gameId);
        console.log("curr players = ",currPlayers);
        if(!currPlayers)
            return res.status(404).send({message: "could not find curr players"});

        await redisClient.hDel(Prefixes.LOBBIES_CURR_PLAYERS, gameId); // remove the data

        await redisClient.hDel(Prefixes.LOBBIES_MAX_PLAYERS, gameId);
        
        await redisClient.del(RedisKeys.lobbyPlayers(gameId));
        
        const orderPointsKey = RedisKeys.orderPoints(gameId);

        await setRounds(orderPointsKey,
                        parcedData.roundCount, Number(currPlayers) + 1);

        await publisher.publish(
        RedisKeys.gameStart(gameId),
         JSON.stringify({message:"GAME STARTED"}));      

        console.log("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");   

        return res.status(200).send({message:"Set state to: "});
    }
    catch(err:any) {
        return res.status(404).send({message: err.message});
    }

});

gameRouter.post("/playerComplete", authUser,  async (req:any, res:any) => {
    const {
        playerId: playerId,
        gameId: gameId,
        correct: correct
    } = req.body;

    if(isNullOrWhitespace(playerId) || isNullOrWhitespace(gameId) ||
       correct === null)
        return res.status(400).send('Invalid body for player complete');


    const scoreboardKey = RedisKeys.scoreboard(gameId); 
    const gameData = await redisClient.get(gameId);

    if(!gameData)
        return res.status(404).send({message:"Could not find the game"});

    const parcedData:GameOptions = JSON.parse(gameData);
    const currRound = parcedData.roundCount - 1;
    var orderBonus = 0;   
    
    const difficulty = parcedData.difficulty;

    // if(correct) {
    //     const orderPointsKey = RedisKeys.orderPoints(gameId);
    //     orderBonus = await 
    //     redisClient.hIncrBy(orderPointsKey, `${currRound}`, -1);
    // }
    
    // const basePoints = 100;
    // const pointsToAdd = orderBonus * basePoints * DiffcultyModifier[difficulty];
    // await redisClient.zIncrBy(scoreboardKey, pointsToAdd, playerId );
    const scoreboard = await redisClient.zRangeWithScores(scoreboardKey, 0, -1);
    scoreboard.reverse();

    await publisher.publish(RedisKeys.scoreboardUpdate(gameId),
        JSON.stringify({scoreboard, playerId, pointsToAdd:0}));
    
    const gameEndKey = RedisKeys.gameEnd(gameId);

    const remainingPlayers = 
    await redisClient.decr(gameEndKey);
    
    if (parcedData.playerCount > 0) {
        parcedData.playerCount -= 1;
        await redisClient.set(gameId, JSON.stringify(parcedData));
    }

    if(remainingPlayers > 0 ) 
        return res.send({message:"Player status saved"});
    
    const lockKey = RedisKeys.gameCompletionLock(gameId);
    const lockAcquired = await redisClient.set(
        lockKey, 
        playerId,  // store who got the lock
        { NX: true, EX: 10 }  // NX: only if not exists, EX: expire in 10s
    );

    if(!lockAcquired) {
        console.log(`[RACE] ${playerId} lost race for game ${gameId} completion`);
        return res.send({message:"Game already being completed"});
    }

    try {
        await CleanupGameContext(gameId);
        const results = await SaveResults(scoreboard); // <— now returns standings

        await publisher.publish(
            RedisKeys.allPlayersComplete(gameId),
            JSON.stringify({ results })
        );

        for (const playerResult of results) {
            const playerId = playerResult.username;
            await publisher.publish(
                RedisKeys.gameResult(playerId),  // Publish to individual player channel
                JSON.stringify({
                    place: playerResult.placement,
                    score: playerResult.score,
                    totalPlayers: results.length,
                    fullResults: results
                })
            );
        }
    }
    catch(err:any) {
        return res.send({message: `Error with cleanup: ${err}`})
    }
    finally {
        await redisClient.del(lockKey);
    }   
});


gameRouter.post("/leaveLobby", authUser, async (req: any, res: any) => {
    const { gameId, playerID } = req.body;

    if (isNullOrWhitespace(gameId) || isNullOrWhitespace(playerID)) {
        return res.status(400).send({ message: "Missing gameId or playerID" });
    }

    try {
        const lobbyData = await redisClient.hGet(Prefixes.LOBBIES_CURR_PLAYERS, gameId);
        const gameData = await redisClient.get(gameId);

        if (!lobbyData || !gameData) {
            return res.status(404).send({ message: "Lobby or game not found" });
        }

        let parsedData = JSON.parse(gameData);

        const scoreboardKey = RedisKeys.scoreboard(gameId);
        const lobbyPlayersKey = RedisKeys.lobbyPlayers(gameId);

        await redisClient.zRem(scoreboardKey, playerID);
        await redisClient.zRem(lobbyPlayersKey, playerID);
        const playerRoundKey = RedisKeys.playerCurrentRound(gameId, playerID);
        await redisClient.del(playerRoundKey);

        const remainingPlayers = await redisClient.zRange(lobbyPlayersKey,0,-1);

        var newHost : string|null=null;
        if (parsedData.currPlayerCount > 1) {
            parsedData.currPlayerCount -= 1;
            await redisClient.set(gameId, JSON.stringify(parsedData));
            await redisClient.hIncrBy(Prefixes.LOBBIES_CURR_PLAYERS, gameId, -1);

            if(remainingPlayers.length>0)
            {
                newHost = remainingPlayers[0];
                console.log(newHost);
            }
                
        } else {
            await CleanupGameContext(gameId);
            await redisClient.hDel(Prefixes.LOBBIES_CURR_PLAYERS, gameId);
            await redisClient.hDel(Prefixes.LOBBIES_MAX_PLAYERS, gameId);
            await redisClient.del(lobbyPlayersKey);
        }


        await publisher.publish(RedisKeys.playerLeave(gameId), JSON.stringify({
            type:Prefixes.PLAYER_LEAVE,
            playerID,
            newHost: newHost
        }));

        return res.status(200).send({ message: "Player left the lobby successfully" });
    } catch (err) {
        return res.status(500).send({ message: "Error processing leave request" });
    }
});

gameRouter.post("/leaveGame", authUser, async (req: any, res: any) => {
    const { gameId, playerID } = req.body;

    if (isNullOrWhitespace(gameId) || isNullOrWhitespace(playerID)) {
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

        const playerRoundKey = RedisKeys.playerCurrentRound(gameId, playerID);
        await redisClient.del(playerRoundKey);

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

        await publisher.publish(RedisKeys.scoreboardUpdate(gameId),
            JSON.stringify({scoreboard, playerID, points: 0}));

        await publisher.publish(RedisKeys.playerLeave(gameId), JSON.stringify({
            type:Prefixes.PLAYER_LEAVE,
            playerID,
        }));

        return res.status(200).send({ message: "Player left the game successfully" });
    } catch (err) {
        console.error(err);
        return res.status(500).send({ message: "Error processing leave request" });
    }
});

gameRouter.post("/sendLobbyMessage", authUser, async (req:any, res:any) => {
    const {
        playerId,
        message,
        gameId
    } = req.body;

    if(isNullOrWhitespace(playerId) || isNullOrWhitespace(message) 
                                    || isNullOrWhitespace(gameId))
        return res.status(400).send({ message: "Error processing request" });

    try {
        const lobbyMessageKey = RedisKeys.lobbyMessage(gameId);

        await redisClient.rPush(lobbyMessageKey,
                                JSON.stringify({ playerId, message }));
        await publisher.publish(RedisKeys.messageUpdate(gameId),
             JSON.stringify({ playerId, message }));
        return res.send({ Message:"SENT", playerId, message });
    } 
    catch (err) {
        console.error(err);
        return res.status(500).send({ message: "Error processing message" });
    }
});

gameRouter.post("/getLobbyMessages", authUser, async (req:any, res:any) => {
    const {
        gameId
    } = req.body;

    if(isNullOrWhitespace(gameId))
        return res.status(400).send({ message: "[ERROR]: Argument gameId missing" });

    try {
        const lobbyMessageKey = RedisKeys.lobbyMessage(gameId);

        var messages = 
        await redisClient.lRange(lobbyMessageKey, 0,-1);
        messages = messages.map((e) => {
            return JSON.parse(e);
        })
 
        return res.send({message:"SUCCESS", gameId:gameId, messages:messages });
    } 
    catch (err) {
        console.error('[ERROR]:',err);
        return res.status(500).send({ message: "Error processing message" });
    }
});

gameRouter.get("/globalLeaderboard", authUser, async (req: any, res: any) => {  
  const pageRaw = req.query.page;
  
  const page = Number.isInteger(Number(pageRaw)) &&  Number(pageRaw) > 0
    ? Math.floor(Number(pageRaw)) 
    : 1;
  
  const skip = (page - 1) * PAGE_SIZE;
 
  try {
    const pageKey = RedisKeys.leaderboardPage(page);
   
    // Try to get cached page
    const cached = await redisClient.get(pageKey);
    const totalPlayers = await redisClient.zCard(RedisKeys.leaderboardRankings());
    const hasNextPage = (page * PAGE_SIZE) < totalPlayers;

    if (cached) {
      // Cache hit
      console.log(`[CACHE HIT] Leaderboard page ${page}-${skip}`);
      const leaderboard = JSON.parse(cached);
      return res.status(200).json({ 
        items: leaderboard,
        page: page,
        pageSize: PAGE_SIZE,
        hasNextPage: hasNextPage,
        cached: true
      });
    }
   
    console.log(`[CACHE MISS] Fetching leaderboard page ${page}-${skip} from Neo4j`);
    const items = await getGlobalLeaderboard(PAGE_SIZE, skip);
   
    // Cache this page's results
    if (items && items.length > 0) {
      await redisClient.setEx(
        pageKey,
        CACHE_DURATION[CacheTypes.GENERIC_CACHE], // e.g., 300 seconds
        JSON.stringify(items)
      );
      console.log(`[CACHE SET] Cached page ${skip}-${skip} for ${CACHE_DURATION[CacheTypes.GENERIC_CACHE]}s`);
    }

    return res.status(200).json({
        items,
        page: page,           // Must be a number
        pageSize: PAGE_SIZE,  // Must be a number, not a string
        hasNextPage: hasNextPage,
        cached: false
    });
   
  } catch (err: any) {
    console.error("[ERROR] get /globalLeaderboard:", err?.message || err);
    return res.status(500).json({ 
      message: "Failed to fetch global leaderboard" 
    });
  }
});


export default gameRouter;


