import express from "express";
import { SERVER_PORT } from "./config/config";
import gameRouter from './routers/gameRouter'
import cors from "cors";
import WebSocket, { WebSocketServer } from "ws"
import http from "http";
import { IdPrefixes, WebServerTypes } from "./shared_modules/shared_enums";
import userRouter from "./routers/userRouter";
import { connectionSuccess, n4jSession, n4jDriver } from "./neo4jClient";
import { UserService } from "./utils/userService";
//import { ensureUserConstraints } from "./utils/neo4jConstraintsService";
import { ensureGraphConstraints } from "./utils/ensureConstraints";
import { initializeGraphStructure, syncLeaderboardToRedis } from './graph/leaderboard.repo';
import { initRedisWsBridge } from "./utils/redisWsBridge";
import { migrateUsersToPlayers } from "./migration/migrateUsersToPlayers";
import { checkDatabaseState } from "./migration/checkDatabaseState";
import { RedisKeys } from "./utils/redisKeyService";
import { redisClient } from "./redisClient";

// Server state management
class ServerState {
    private isShuttingDown = false;
    private shutdownPromise: Promise<void> | null = null;
    
    isActive() {
        return !this.isShuttingDown;
    }
    
    startShutdown(): Promise<void> {
        if (this.shutdownPromise) {
            return this.shutdownPromise;
        }
        
        this.isShuttingDown = true;
        this.shutdownPromise = Promise.resolve();
        return this.shutdownPromise;
    }
}

const serverState = new ServerState();
const wsClients = new Map<string, Set<WebSocket>>();
const userSockets = new Map<string, Set<WebSocket>>();

// CORS configuration
const corsOptions = {
    origin: process.env.CLIENT_ORIGIN || 'http://localhost:3000',
    optionsSuccessStatus: 200,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"]
};

// Express app setup
const app = express();
app.use(express.json());
app.use(cors(corsOptions));

// Add health check endpoint
app.get('/health', (req, res) => {
    if (!serverState.isActive()) {
        return res.status(503).json({ status: 'shutting_down' });
    }
    res.json({ status: 'healthy' });
});

// Create HTTP server and WebSocket server
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Track active WebSocket connections
const activeConnections = new Set<WebSocket>();

// WebSocket connection handler
wss.on("connection", (ws) => {
    // Reject new connections if shutting down
    if (!serverState.isActive()) {
        ws.close(1001, 'Server is shutting down');
        return;
    }
    
    activeConnections.add(ws);
    let currentLobby: string | null = null;
    let currentUsername: string | null = null;

    ws.on("message", async (data: any) => {
        try {
            // Skip processing if shutting down
            if (!serverState.isActive()) return;
            
            const message = JSON.parse(data.toString());
            const { type, gameId, playerID, username } = message;
            
            switch (type) {
                case WebServerTypes.JOIN_LOBBY:
                case IdPrefixes.SCOREBOARD_UPDATE:
                    if (gameId) {
                        if (!wsClients.has(gameId)) {
                            wsClients.set(gameId, new Set());
                        }
                        wsClients.get(gameId)!.add(ws);
                        currentLobby = gameId;
                        console.log(`[SYSTEM] Player ${playerID} joined lobby ${gameId}`);
                    }
                    break;
                    
                case WebServerTypes.LOGIN:
                    if (username) {
                        currentUsername = username;
                        
                        if (!userSockets.has(username)) {
                            userSockets.set(username, new Set());
                        }
                        userSockets.get(username)!.add(ws);
                        console.log(`[SYSTEM] User ${username} connected`);
                        
                        // Notify friends of online status
                        try {
                            const friends = await UserService.getFriends(username);
                            
                            // Notify friends that user is online
                            friends.forEach((friend: string) => {
                                const friendSockets = userSockets.get(friend);
                                if (friendSockets) {
                                    friendSockets.forEach(client => {
                                        if (client.readyState === WebSocket.OPEN) {
                                            client.send(JSON.stringify({
                                                type: "USER_ONLINE",
                                                username,
                                            }));
                                        }
                                    });
                                }
                            });
                            
                            // Send list of online friends to the user
                            const onlineFriends = friends.filter((f: string) => userSockets.has(f));
                            if (ws.readyState === WebSocket.OPEN) {
                                ws.send(JSON.stringify({
                                    type: "ONLINE_FRIENDS",
                                    friends: onlineFriends,
                                }));
                            }
                        } catch (err) {
                            console.error(`[ERROR] Failed to process friend notifications for ${username}:`, err);
                        }
                    }
                    break;
                    case WebServerTypes.LOGOUT:  // ADD THIS CASE
                    if (username && currentUsername) {
                        console.log(`[SYSTEM] User ${username} logging out`);
                        
                        // Remove from userSockets
                        const sockets = userSockets.get(username);
                        if (sockets) {
                            sockets.delete(ws);
                            
                            if (sockets.size === 0) {
                                userSockets.delete(username);
                                
                                // Notify friends that user went offline
                                try {
                                    const friends = await UserService.getFriends(username);
                                    friends.forEach((friend: string) => {
                                        const friendSockets = userSockets.get(friend);
                                        if (friendSockets) {
                                            friendSockets.forEach(client => {
                                                if (client.readyState === WebSocket.OPEN) {
                                                    client.send(JSON.stringify({
                                                        type: "USER_OFFLINE",
                                                        username: username,
                                                    }));
                                                }
                                            });
                                        }
                                    });
                                } catch (err) {
                                    console.error(`[ERROR] Failed to notify friends of logout:`, err);
                                }
                            }
                        }
                        
                        currentUsername = null;
                    }
                    break;
                default:
                    console.log(`[INFO] Unhandled message type: ${type}`);
            }
        } catch (err) {
            console.error("[ERROR] Failed to parse WebSocket message:", err);
        }
    });

    ws.on("close", async () => {
        activeConnections.delete(ws);
        
        // Clean up lobby association
        if (currentLobby && wsClients.has(currentLobby)) {
            wsClients.get(currentLobby)!.delete(ws);
            if (wsClients.get(currentLobby)!.size === 0) {
                wsClients.delete(currentLobby);
            }
            console.log(`[SYSTEM] Client disconnected from lobby ${currentLobby}`);
        }

        // Clean up user association
        if (currentUsername) {
            const sockets = userSockets.get(currentUsername);
            if (sockets) {
                sockets.delete(ws);
                
                if (sockets.size === 0) {
                    userSockets.delete(currentUsername);
                    console.log(`[SYSTEM] ${currentUsername} is now offline`);
                    
                    // Notify friends of offline status (only if not shutting down)
                    if (serverState.isActive()) {
                        try {
                            const friends = await UserService.getFriends(currentUsername);
                            friends.forEach((friend: string) => {
                                const friendSockets = userSockets.get(friend);
                                if (friendSockets) {
                                    friendSockets.forEach(client => {
                                        if (client.readyState === WebSocket.OPEN) {
                                            client.send(JSON.stringify({
                                                type: "USER_OFFLINE",
                                                username: currentUsername,
                                            }));
                                        }
                                    });
                                }
                            });
                            const onlinePlayers = RedisKeys.onlinePlayers();
                            await redisClient.sRem(onlinePlayers, currentUsername);
                             
                        } catch (err) {
                            console.error(`[ERROR] Failed to notify friends of ${currentUsername} going offline:`, err);
                        }
                    }
                }
            }
        }
    });

    ws.on("error", (err) => {
        console.error("[ERROR] WebSocket error:", err);
    });
});

// Initialize Redis-WS bridge
let redisWsBridge: any = null;

// Initialize server
async function initializeServer() {
    try {
        console.log("[SYSTEM] Initializing server components...");

        await ensureGraphConstraints();
        await initializeGraphStructure();
        await syncLeaderboardToRedis();
        // Initialize Redis-WebSocket bridge
        redisWsBridge = initRedisWsBridge({ wsClients, userSockets });
        
        // Mount routers
        app.use("/game", gameRouter);
        app.use("/user", userRouter);
        
        // Start server
        await new Promise<void>((resolve) => {
            server.listen(SERVER_PORT, () => {
                console.log(`[SYSTEM] Server running on port ${SERVER_PORT}`);
                console.log(connectionSuccess);
                resolve();
            });
        });
        
    } catch (error) {
        console.error("[FATAL] Failed to initialize server:", error);
        process.exit(1);
    }
}

// Graceful shutdown handler
async function gracefulShutdown(signal: string) {
    console.log(`\n[SYSTEM] ${signal} received. Starting graceful shutdown...`);
    
    // Prevent multiple shutdown attempts
    await serverState.startShutdown();
    
    const shutdownSteps = [];
    
    // Step 1: Stop accepting new connections
    console.log("[SHUTDOWN] Stopping new connections...");
    wss.close();
    
    // Step 2: Close existing WebSocket connections gracefully
    console.log("[SHUTDOWN] Closing WebSocket connections...");
    const wsClosePromises = Array.from(activeConnections).map(ws => {
        return new Promise<void>((resolve) => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.close(1001, 'Server shutting down');
                ws.once('close', resolve);
                // Timeout after 5 seconds
                setTimeout(resolve, 5000);
            } else {
                resolve();
            }
        });
    });
    shutdownSteps.push(Promise.all(wsClosePromises));
    
    // Step 3: Close HTTP server
    shutdownSteps.push(
        new Promise<void>((resolve) => {
            console.log("[SHUTDOWN] Closing HTTP server...");
            server.close(() => {
                console.log("[SHUTDOWN] HTTP server closed");
                resolve();
            });
        })
    );
    
    // Step 4: Cleanup Redis subscriptions
    if (redisWsBridge?.dispose) {
        shutdownSteps.push(
            redisWsBridge.dispose()
                .then(() => console.log("[SHUTDOWN] Redis connections closed"))
                .catch((err: any) => console.error("[ERROR] Failed to close Redis:", err))
        );
    }
    
    // Step 5: Close Neo4j connections
    if (n4jDriver) {
        shutdownSteps.push(
            Promise.resolve(n4jDriver.close())
                   .then(() => console.log("[SHUTDOWN] Neo4j connection closed"))
                   .catch((err) => console.error("[ERROR] Failed to close Neo4j:", err))
        );
    }
    
    // Wait for all shutdown steps with timeout
    try {
        await Promise.race([
            Promise.all(shutdownSteps),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Shutdown timeout')), 15000)
            )
        ]);
        
        console.log("[SHUTDOWN] Graceful shutdown completed");
        process.exit(0);
    } catch (error) {
        console.error("[ERROR] Shutdown error:", error);
        console.error("[SHUTDOWN] Forcing exit...");
        process.exit(1);
    }
}

// Signal handlers
process.once('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.once('SIGINT', () => gracefulShutdown('SIGINT'));

// Error handlers
process.on('uncaughtException', (error) => {
    console.error('[FATAL] Uncaught Exception:', error);
    gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('[FATAL] Unhandled Rejection at:', promise, 'reason:', reason);
    // Log but don't shut down for unhandled rejections in production
    // You might want to change this based on your needs
    if (process.env.NODE_ENV === 'development') {
        gracefulShutdown('UNHANDLED_REJECTION');
    }
});

// Initialize and start the server
initializeServer().catch((error) => {
    console.error("[FATAL] Server initialization failed:", error);
    process.exit(1);
});