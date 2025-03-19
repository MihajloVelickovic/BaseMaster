import { redisClient, publisher, subscriber } from "./redisClient";
import express from "express";
import { SERVER_PORT } from "./config/config";
import gameRouter from './routers/gameRouter'
import cors from "cors";
import { WebSocketServer } from "ws"
import http from "http";
import { IdPrefixes } from "./shared_modules/shared_enums";

const wsClients = new Map(); // Maps WebSocket clients to lobbies

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

    ws.on("message", (data: any) => {
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
            else if (type === "scoreUpdate") {
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

subscriber.pSubscribe(`*`, async (message, channel) => { // Listen to all channels

    const lobbyId = channel; // Use the full channel name as gameId

    if (wsClients.has(lobbyId)) {
        wsClients.get(lobbyId).forEach(client => {
            if (client.readyState === 1) {
                client.send(JSON.stringify({
                    type: "scoreUpdate",
                    scores: JSON.parse(message)
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

app.use("/game", gameRouter);

server.listen(SERVER_PORT, async () => {
    console.log(`Server running on port ${SERVER_PORT}`);
});

// const r3 = await redisClient.keys('*');
// console.log("Writing out everything currently in the database ;3");
// r3.forEach(async (x) => {
//     //console.log(await redisClient.get(x));
//     console.log(x);
// })

// redisClient.connect().then(() => {
//         console.log('Connected to Redis');

//         // Start the Express server after Redis is connected
        
//     })
//     .catch((err) => {
//         console.error('Failed to connect to Redis:', err.message);
//     });




