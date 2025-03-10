// // import express from "express";
// import { createClient } from 'redis';       //i ovo je dodato
// // const app = express();

// // app.use(express.json());

// //nova stvar..
import {redisClient, publisher, subscriber} from "./redisClient";
import express from "express";
import { SERVER_PORT } from "./config/config";
import gameRouter from './routers/gameRouter'
import cors from "cors";
import {WebSocketServer} from "ws"
import http from "http";
import { IdPrefixes } from "./shared_modules/shared_enums";

const CLIENTS = new Map(); // Maps WebSocket clients to lobbies

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

    ws.on("message", (data) => {
        try {
            const { type, gameId, playerId } = JSON.parse(data);
            console.log(data);
            if (type === "joinLobby") {
                if (!CLIENTS.has(gameId)) {
                    CLIENTS.set(gameId, new Set());
                }
                CLIENTS.get(gameId).add(ws);
                currentLobby = gameId;
                console.log(`Player ${playerId} joined lobby ${gameId}`);
            }
        } catch (err) {
            console.error("Error parsing message:", err);
        }
    });

    ws.on("close", () => {
        if (currentLobby && CLIENTS.has(currentLobby)) {
            CLIENTS.get(currentLobby).delete(ws);
            console.log(` Client disconnected from lobby ${currentLobby}`);
        }
    });
});


subscriber.pSubscribe(`*`, async (message, channel) => { // Listen to all channels

    const lobbyId = channel; // Use the full channel name as gameId

    if (CLIENTS.has(lobbyId)) {
        CLIENTS.get(lobbyId).forEach(client => {
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
    const lobbyId = channel.replace("gameStart_", ""); // Extract game ID

    if (CLIENTS.has(lobbyId)) {
        CLIENTS.get(lobbyId).forEach(client => {
            if (client.readyState === 1) {
                client.send(JSON.stringify({
                    type: "gameStart",
                    message: "Game has started!",
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




