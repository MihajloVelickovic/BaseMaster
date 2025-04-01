import { redisClient, publisher, subscriber } from "./redisClient";
import express from "express";
import { SERVER_PORT } from "./config/config";
import gameRouter from './routers/gameRouter'
import cors from "cors";
import { WebSocketServer } from "ws"
import http from "http";
import { IdPrefixes } from "./shared_modules/shared_enums";
import userRouter from "./routers/userRouter";

const wsClients = new Map(); // Maps WebSocket clients to lobbies
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
            const { type, gameId, playerID } = JSON.parse(data);
            console.log("data je: ", JSON.parse(data));

            if (type === "joinLobby") {
                if (!wsClients.has(gameId)) {
                    wsClients.set(gameId, new Set());
                }
                wsClients.get(gameId).add(ws);
                currentLobby = gameId;
                console.log(`Player ${playerID} joined lobby ${gameId}`);
                
            }
            else if (type === IdPrefixes.SCOREBOARD_UPDATE) {
                if (!wsClients.has(gameId)) {
                    wsClients.set(gameId, new Set());
                }
                wsClients.get(gameId).add(ws);
                currentLobby = gameId;
                console.log(`Player ${playerID} joined lobby ${gameId}`);
            }
            // if (type === "startGame") {
            //     console.log(`Game ${gameId} is starting!`);
            //     publisher.publish(`${IdPrefixes.GAME_STARTED}_${gameId}`, JSON.stringify({ gameId }));
            // }
        } catch (err) {
            console.error("Error parsing message:", err);
        }
    });

    ws.on("close", () => {
        if (currentLobby && wsClients.has(currentLobby)) {
            wsClients.get(currentLobby).delete(ws);
            console.log(` Client disconnected from lobby ${currentLobby}`);
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

subscriber.pSubscribe(`${IdPrefixes.ALL_PLAYERS_COMPLETE}_*`, async (message, channel) => {
    const lobbyId = channel.replace(`${IdPrefixes.ALL_PLAYERS_COMPLETE}_`, ""); // Extract game ID

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

app.use("/game", gameRouter);
app.use("/user", userRouter);

server.listen(SERVER_PORT, async () => {
    console.log(`Server running on port ${SERVER_PORT}`);
});



// I NEED A HERO HE'S GOT TO BE STRONG AND HE'S GOT TO KNOW NEO4J
