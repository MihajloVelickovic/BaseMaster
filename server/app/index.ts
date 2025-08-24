import { redisClient, publisher, subscriber } from "./redisClient";
import express from "express";
import { SERVER_PORT } from "./config/config";
import gameRouter from './routers/gameRouter'
import cors from "cors";
import WebSocket,{ WebSocketServer } from "ws"
import http from "http";
import { IdPrefixes } from "./shared_modules/shared_enums";
import userRouter from "./routers/userRouter";
import { connectionSuccess, n4jSession, n4jDriver } from "./neo4jClient";
import { getFriends } from "./utils/userService";
import { ensureUserConstraints } from "./utils/neo4jConstraintsService";
import { ensureGraphConstraints } from "./utils/ensureConstraints";
import { recordResult } from "./graph/player.repo";

const wsClients = new Map();
const userSockets = new Map<string, Set<WebSocket>>(); 

//We are cooked no neo4j to be seen in sight
const corsOptions = {
    origin: 'http://localhost:3000',
    optionsSuccessStatus: 200,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"]
};

const app = express();
app.use(express.json());
app.use(cors(corsOptions));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });


wss.on("connection", (ws) => {
    let currentLobby = null;

    ws.on("message", async (data: any) => {
        try {
            const { type, gameId, playerID, username } = JSON.parse(data);
            //console.log("data je: ", JSON.parse(data));

            if (type === "joinLobby") {
                if (!wsClients.has(gameId)) {
                    wsClients.set(gameId, new Set());
                }
                wsClients.get(gameId).add(ws);
                currentLobby = gameId;
                console.log(`[SYSTEM]Player ${playerID} joined lobby ${gameId}`);
                
            }
            else if (type === IdPrefixes.SCOREBOARD_UPDATE) {
                if (!wsClients.has(gameId)) {
                    wsClients.set(gameId, new Set());
                }
                wsClients.get(gameId).add(ws);
                currentLobby = gameId;
                console.log(`Player ${playerID} joined lobby ${gameId}`);
            }

            if (type === "login") {
                if (!userSockets.has(username)) {
                    userSockets.set(username, new Set());
                }
                userSockets.get(username)!.add(ws);
                console.log(`User ${username} connected`);
    
                const friends = await getFriends(username);

            
                if (!userSockets.has(username)) {
                    userSockets.set(username, new Set());
                }
                userSockets.get(username)!.add(ws);
                console.log(`[SYSTEM]: User ${username} connected`);
                
                friends.forEach(friend => {
                    if (userSockets.has(friend)) {
                        userSockets.get(friend)!.forEach(client => {
                            if (client.readyState === 1) {
                                client.send(JSON.stringify({
                                    type: "USER_ONLINE",
                                    username,
                                }));
                            }
                        });
                    }
                });
                
                const onlineFriends = friends.filter(f => userSockets.has(f));
                ws.send(JSON.stringify({
                    type: "ONLINE_FRIENDS",
                    friends: onlineFriends,
                }));
            }
        } catch (err) {
            console.error("[ERROR]: parsing message failed:", err);
        }
    });

    ws.on("close", async() => {
        if (currentLobby && wsClients.has(currentLobby)) {
            wsClients.get(currentLobby).delete(ws);
            console.log(`[SYSTEM]: Client disconnected from lobby ${currentLobby}`);
        }

        for (const [username, sockets] of userSockets.entries()) {
            if (sockets.has(ws)) {
                sockets.delete(ws);
                console.log(`[SYSTEM]: WebSocket removed for ${username}`);
        
                if (sockets.size === 0) {
                    userSockets.delete(username);
                    console.log(`${username} is now offline`);
                
                    const friends = await getFriends(username);
                    friends.forEach(friend => {
                        if (userSockets.has(friend)) {
                            userSockets.get(friend)!.forEach(client => {
                                if (client.readyState === 1) {
                                    client.send(JSON.stringify({
                                        type: "USER_OFFLINE",
                                        username,
                                    }));
                                }
                            });
                        }
                    });
                }
                break;
            }
        }
    });
});

subscriber.pSubscribe(`${IdPrefixes.SCOREBOARD_UPDATE}_*`, async (message, channel) => { // Listen to all channels

    const lobbyId = channel.replace(`${IdPrefixes.SCOREBOARD_UPDATE}_`, "");
    const parsedData = JSON.parse(message);

    if (wsClients.has(lobbyId)) {
        wsClients.get(lobbyId).forEach(client => {
            if (client.readyState === 1) {
                client.send(JSON.stringify({
                    type: IdPrefixes.SCOREBOARD_UPDATE,
                    scores: parsedData.scoreboard,
                    points: parsedData.pointsToAdd,
                    playerId: parsedData.playerId
                }));
            }
        });
    }
});
//Man on monday I start working on neo4j if nothing is done about it until then
//I do not even hope anymore that the person who said they would do it ever will
subscriber.pSubscribe(`${IdPrefixes.GAME_STARTED}_*`, async (message, channel) => {
    const lobbyId = channel.replace(`${IdPrefixes.GAME_STARTED}_`, ""); // Extract game ID

    if (wsClients.has(lobbyId)) {
        wsClients.get(lobbyId).forEach(client => {
            if (client.readyState === 1) {
                client.send(JSON.stringify({
                    type: `${IdPrefixes.GAME_STARTED}`,
                    message: "Game has started!",
                }));
            }
        });
    }
});
//4 weeks no work done with neo4j, I should stop writing neo4j so it would be 
//harder to temove this type of comments.... I thing I will
subscriber.pSubscribe(`${IdPrefixes.ALL_PLAYERS_COMPLETE}_*`, async (message, channel) => {
    const lobbyId = channel.replace(`${IdPrefixes.ALL_PLAYERS_COMPLETE}_`, ""); // Extract game ID
    const payload = JSON.parse(message);

    // 1) PERSIST to Neo4j (once per player)
    // if (Array.isArray(payload?.results)) {
    //     for (const r of payload.results) {
    //     await recordResult({
    //         username: r.username,   // same as Player.id
    //         score: r.score,
    //         placement: r.placement
    //     });

    //     // 2) OPTIONAL: maintain a Redis ZSET for blazing-fast reads
    //     // key: "global:leaderboard"
    //     // member = username, score = best score (we store latest best).
    //     // We should ZADD with the player's best; easiest is to just ZADD the final if it’s the best:
    //     await redisClient.zAdd("global:leaderboard", [{ score: r.score, value: r.username }]);
    //     // If the player’s existing best in Redis is higher, ZADD keeps it if 'score' is smaller.
    //     // (If you want strict “max”, fetch ZSCORE and compare before zAdd.)    !!!!!!!!!!!!!!!!!!!!!
    //     }
    // }


    if (wsClients.has(lobbyId)) {
        wsClients.get(lobbyId).forEach(client => {
            if (client.readyState === 1) {
                client.send(JSON.stringify({
                    type: `${IdPrefixes.ALL_PLAYERS_COMPLETE}`,
                    message: "Game has ended!",
                }));
            }
        });
    }



});

subscriber.pSubscribe(`${IdPrefixes.PLAYER_JOIN}_*`, async (message, channel) => {
    const lobbyId = channel.replace(`${IdPrefixes.PLAYER_JOIN}_`, ""); // Extract game ID
    const parsedMessage = JSON.parse(message);
    const playerId = parsedMessage.playerID;

    if (wsClients.has(lobbyId)) {
        wsClients.get(lobbyId).forEach(client => {
            if (client.readyState === 1) {
                client.send(JSON.stringify({
                    type: `${IdPrefixes.PLAYER_JOIN}`,
                    message: "Player joined the game",
                    playerId:playerId
                }));
            }
        });
    }
});

subscriber.pSubscribe(`${IdPrefixes.PlAYER_LEAVE}_*`, async (message, channel) => {
    const lobbyId = channel.replace(`${IdPrefixes.PlAYER_LEAVE}_`, ""); // Extract game ID
    const parsedMessage = JSON.parse(message);
    const playerId = parsedMessage.playerID;
    const newHost = parsedMessage.newHost;

    if (wsClients.has(lobbyId)) {
        wsClients.get(lobbyId).forEach(client => {
            if (client.readyState === 1) {
                client.send(JSON.stringify({
                    type: `${IdPrefixes.PlAYER_LEAVE}`,
                    message: "Player left the game",
                    playerId:playerId,
                    newHost:newHost
                }));
            }
        });
    }
});

subscriber.pSubscribe(`${IdPrefixes.MESSAGE_UPDATE}_*`, async (message, channel) => {
    const lobbyId = channel.replace(`${IdPrefixes.MESSAGE_UPDATE}_`, ""); // Extract game ID
    const parsedMessage = JSON.parse(message);
    const playerId = parsedMessage.playerId;
    const pMessage = parsedMessage.message;

    if (wsClients.has(lobbyId)) {
        wsClients.get(lobbyId).forEach(client => {
            if (client.readyState === 1) {
                client.send(JSON.stringify({
                    type: `${IdPrefixes.MESSAGE_UPDATE}`,
                    message: "Player joined the game",
                    playerId:playerId,
                    playerMessage: pMessage
                }));
            }
        });
    }
});

subscriber.pSubscribe("FRIEND_REQUEST_*", async (message, channel) => {
    const toUser = channel.replace("FRIEND_REQUEST_", "");
    if (userSockets.has(toUser)) {
        userSockets.get(toUser)!.forEach(client => {
            if (client.readyState === 1) {
                client.send(JSON.stringify({
                    type: "FRIEND_REQUEST",
                    ...JSON.parse(message),
                }));
            }
        });
    }
});

subscriber.pSubscribe("FRIEND_ACCEPTED_*", async (message, channel) => {
    const toUser = channel.replace("FRIEND_ACCEPTED_", "");
    if (userSockets.has(toUser)) {
        userSockets.get(toUser)!.forEach(client => {
            if (client.readyState === 1) {
                client.send(JSON.stringify({
                    type: "FRIEND_ACCEPTED",
                    ...JSON.parse(message),
                }));
            }
        });
    }
});

subscriber.pSubscribe("FRIEND_DECLINED_*", async (message, channel) => {
    const toUser = channel.replace("FRIEND_DECLINED_", "");
    if (userSockets.has(toUser)) {
        userSockets.get(toUser)!.forEach(client => {
            if (client.readyState === 1) {
                client.send(JSON.stringify({
                    type: "FRIEND_DECLINED",
                    ...JSON.parse(message),
                }));
            }
        });
    }
});

subscriber.pSubscribe("FRIEND_REMOVED_*", async (message, channel) => {
    const toUser = channel.replace("FRIEND_REMOVED_", "");
    if (userSockets.has(toUser)) {
        userSockets.get(toUser)!.forEach(client => {
            if (client.readyState === 1) {
                client.send(JSON.stringify({
                    type: "FRIEND_REMOVED",
                    ...JSON.parse(message),
                }));
            }
        });
    }
});

subscriber.subscribe("USER_ONLINE", (message) => {
    const { username } = JSON.parse(message);
    userSockets.forEach((sockets, user) => {
        sockets.forEach(client => {
            if (client.readyState === 1) {
                client.send(JSON.stringify({
                    type: "USER_ONLINE",
                    username,
                }));
            }
        });
    });
});

subscriber.subscribe("USER_OFFLINE", (message) => {
    const { username } = JSON.parse(message);
    userSockets.forEach((sockets, user) => {
        sockets.forEach(client => {
            if (client.readyState === 1) {
                client.send(JSON.stringify({
                    type: "USER_OFFLINE",
                    username,
                }));
            }
        });
    });
});

subscriber.pSubscribe(`${IdPrefixes.INVITE}_*`, async (message, channel) => {
    const toUser = channel.replace(`${IdPrefixes.INVITE}_`, "");
    if (userSockets.has(toUser)) {
        userSockets.get(toUser)!.forEach(client => {
            if (client.readyState === 1) {
                client.send(JSON.stringify({
                    type: `${IdPrefixes.INVITE}`,
                    ...JSON.parse(message),
                }));
            }
        });
    }
});

app.use("/game", gameRouter);
app.use("/user", userRouter);
//the eternal silence of people who actually care will always be greater than
//the unbroken symphony of those who are indifferent to all, caring for nothing
//and no one   
//those whose words are empty, devoid of meaning or the slightest intension
//of putting them from their abstrat form into something that has the potential
//of having a meaning to others, who  in their eternal silence, forget that no 
//one should have the privilege to speak and make promises that never come to be
//whilst expecting them to do those things by themselves
//in the perfect world where time is unlimited they would not have the right to
//complain, but the reality we live in is not so forgiving unfortunately for the
//other ones, time is ticking torwards our certain demise, the only thing that
//is left for us to do is to decide how we spend the time that was given to us,
//freedom of choise should always exsist no matter what, but choices come with
//consequences, which may come true if the silent ones run out of patience
//and decide to show them that nne does not claim the harvest of another's toil

            //02.04.2025, Mihajo Dimitrijević, pun pesimizma, spreman da sam 
            //uradi obecano, ali neispunjeno

//Bilo bi veoma kul da imamo neo4j izgubio sam vise od sat vemena da napisem ovo
                                                    //(I prethodna dva commit-a)
//sto je vise nego sto je ????verovatno????(CERTAIN SOMEONE) proveo radeci na 
// projektu poslednjih mesec dana, vise se i nadam da ta osoba cite ove stvari
//i nadam se da bar pomisli da nije uredu, ako ne prema meni, prema ostalim
//clanovima tima koji rade i kad su prehladjeni, i kad su u zurbi i imaju manje 
//od sat vremena, ali uvek pokazuju da ih je briga da ispostuju to sto rade u 
//timu, pogled na repozitorijum je dovoljan za procenu doprinosa
//radu u timu ukoliko moje reci ne nose nikakvu tezinu i znacenje
        //10.12.2024. Datum kreiranja repozitorijuma
        //2.4.2025. sadasnjost

await ensureUserConstraints();
await ensureGraphConstraints();

server.listen(SERVER_PORT, async () => {
    console.log(`[SYSTEM]: Server running on port ${SERVER_PORT}`);
    console.log(connectionSuccess);
});

// I NEED A HERO HE'S GOT TO BE STRONG AND HE'S GOT TO KNOW NEO4J