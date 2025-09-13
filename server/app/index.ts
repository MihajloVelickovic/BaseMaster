import express from "express";
import { SERVER_PORT } from "./config/config";
import gameRouter from './routers/gameRouter'
import cors from "cors";
import WebSocket,{ WebSocketServer } from "ws"
import http from "http";
import { IdPrefixes, WebServerTypes } from "./shared_modules/shared_enums";
import userRouter from "./routers/userRouter";
import { connectionSuccess, n4jSession, n4jDriver } from "./neo4jClient";
import { UserService } from "./utils/userService";
import { ensureUserConstraints } from "./utils/neo4jConstraintsService";
import { ensureGraphConstraints } from "./utils/ensureConstraints";
import { initializeGraphStructure } from './graph/leaderboard.repo';
import { initRedisWsBridge } from "./utils/redisWsBridge";

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
    let currentLobby:any = null;

    ws.on("message", async (data: any) => {
        try {
            const { type:rawType, gameId, playerID, username } = JSON.parse(data);
            //console.log("data je: ", JSON.parse(data));
            const type = rawType.toLowerCase();
            
            if (type === WebServerTypes.JOIN_LOBBY) {
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

            if (type === WebServerTypes.LOGIN) {
                if (!userSockets.has(username)) {
                    userSockets.set(username, new Set());
                }
                userSockets.get(username)!.add(ws);
                console.log(`User ${username} connected`);
    
                const friends = await UserService.getFriends(username);

            
                if (!userSockets.has(username)) {
                    userSockets.set(username, new Set());
                }
                userSockets.get(username)!.add(ws);
                console.log(`[SYSTEM]: User ${username} connected`);
                
                friends.forEach((friend:any) => {
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
                
                const onlineFriends = friends.filter((f:any) => userSockets.has(f));
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
                
                    const friends = await UserService.getFriends(username);
                    friends.forEach((friend:any) => {
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

initRedisWsBridge({wsClients, userSockets});

app.use("/game", gameRouter);
app.use("/user", userRouter);

await ensureUserConstraints();
await ensureGraphConstraints();
await initializeGraphStructure();

server.listen(SERVER_PORT, async () => {
    console.log(`[SYSTEM]: Server running on port ${SERVER_PORT}`);
    console.log(connectionSuccess);
});
