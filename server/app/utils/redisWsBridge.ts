// src/redisWsBridge.ts
import { redisClient, publisher, subscriber } from "../redisClient";
import { UserService } from "./userService";
import { IdPrefixes } from "../shared_modules/shared_enums";
import type WebSocket from "ws";

type WsClientsMap = Map<string, Set<WebSocket>>;
type UserSocketsMap = Map<string, Set<WebSocket>>;

export function initRedisWsBridge({
  wsClients,
  userSockets
}: {
  wsClients: WsClientsMap;
  userSockets: UserSocketsMap;
}) {
  // Helper to safe-send
  const safeSend = (client: WebSocket, payload: unknown) => {
    try {
      if (client.readyState === 1) {
        const message = JSON.stringify(payload);
        client.send(message);
      } else {
      }
    } catch (err) {
      // optional: log or remove client if broken
    }
  };

  // scoreboard updates
  subscriber.pSubscribe(`${IdPrefixes.SCOREBOARD_UPDATE}:*`, 
                        async (message:any, channel:any) => {
    try {
      const lobbyId = channel.replace(`${IdPrefixes.SCOREBOARD_UPDATE}:`, "");
      const parsed = JSON.parse(message);
      if (wsClients.has(lobbyId)) {
        wsClients.get(lobbyId)!.forEach((client) =>
          safeSend(client, {
            type: IdPrefixes.SCOREBOARD_UPDATE,
            scores: parsed.scoreboard,
            points: parsed.pointsToAdd,
            playerId: parsed.playerId
          })
        );
      }
    } catch (err) {
    }
  });

  // game started
  subscriber.pSubscribe(`${IdPrefixes.GAME_STARTED}:*`, 
                        (message:any, channel:any) => {
    const lobbyId = channel.replace(`${IdPrefixes.GAME_STARTED}:`, "");
    if (wsClients.has(lobbyId)) {
      wsClients.get(lobbyId)!.forEach((c) =>
        safeSend(c, { type: IdPrefixes.GAME_STARTED, message: "Game has started!" })
      );
    }
  });

  // all players complete (example simplified)
  subscriber.pSubscribe(`${IdPrefixes.ALL_PLAYERS_COMPLETE}:*`, 
                        async (message:any, channel:any) => {
    try {
      const lobbyId = channel.replace(`${IdPrefixes.ALL_PLAYERS_COMPLETE}:`, "");
      const payload = JSON.parse(message);

      // If you want to record results in Neo4j or Redis, consider emitting an event here
      // or call some repo functions. Avoid heavy work per-message unless necessary.

      if (wsClients.has(lobbyId)) {
        wsClients.get(lobbyId)!.forEach((client) =>
          safeSend(client, {
            type: IdPrefixes.ALL_PLAYERS_COMPLETE,
            message: "Game has ended!"
          })
        );
      }
    } catch (err) {
    }
  });

  // player join
  subscriber.pSubscribe(`${IdPrefixes.PLAYER_JOIN}:*`, 
                        (message:any, channel:any) => {
    try {
      const lobbyId = channel.replace(`${IdPrefixes.PLAYER_JOIN}:`, "");
      const parsed = JSON.parse(message);
      const playerId = parsed.playerID;
      if (wsClients.has(lobbyId)) {
        wsClients.get(lobbyId)!.forEach((client) =>
          safeSend(client, { type: IdPrefixes.PLAYER_JOIN, message: "Player joined the game", playerId })
        );
      }
    } catch (err) {
    }
  });

  // player leave
  subscriber.pSubscribe(`${IdPrefixes.PLAYER_LEAVE}:*`, 
                        (message:any, channel:any) => {
    try {
      const lobbyId = channel.replace(`${IdPrefixes.PLAYER_LEAVE}:`, "");
      const parsed = JSON.parse(message);
      const playerId = parsed.playerID;
      const newHost = parsed.newHost;
      if (wsClients.has(lobbyId)) {
        wsClients.get(lobbyId)!.forEach((client) =>
          safeSend(client, { type: IdPrefixes.PLAYER_LEAVE, message: "Player left the game", playerId, newHost })
        );
      }
    } catch (err) {
    }
  });

  // message update
  subscriber.pSubscribe(`${IdPrefixes.MESSAGE_UPDATE}:*`, 
  (message:any, channel:any) => {
    try {
      const lobbyId = channel.replace(`${IdPrefixes.MESSAGE_UPDATE}:`, "");
      const parsed = JSON.parse(message);
      if (wsClients.has(lobbyId)) {
        wsClients.get(lobbyId)!.forEach((client) =>
          safeSend(client, {
            type: IdPrefixes.MESSAGE_UPDATE,
            message: "Player joined the game",
            playerId: parsed.playerId,
            playerMessage: parsed.message
          })
        );
      }
    } catch (err) {
    }
  });

  // FRIEND_* patterns -> user-specific sockets
  const friendPatterns = ["FRIEND_REQUEST:*", "FRIEND_ACCEPT:*", "FRIEND_DENY:*", "FRIEND_REMOVED:*"];
  friendPatterns.forEach(pattern => {
    subscriber.pSubscribe(pattern, (message:any, channel:any) => {
      try {
        const parts = channel.split(":"); // supports underscores in username
        const toUser = parts[parts.length - 1];
        const messageType = pattern.split(":")[0];

        if (userSockets.has(toUser)) {
          const sockets = userSockets.get(toUser)!;
          sockets.forEach(client => {
            safeSend(client, { type: messageType, ...JSON.parse(message) });
          });
        } else {
        }
      } catch (err) {
      }
    });
  });

  // NOTE: USER_ONLINE / USER_OFFLINE are handled directly in index.ts via WebSocket,
  // not through Redis pub/sub. No need to subscribe here.

  // INVITE pattern
  subscriber.pSubscribe(`${IdPrefixes.INVITE}:*`, (message:any, channel:any) => {
    try {
      const toUser = channel.replace(`${IdPrefixes.INVITE}:`, "");
      if (userSockets.has(toUser)) {
        userSockets.get(toUser)!.forEach(client => safeSend(client, { type: IdPrefixes.INVITE, ...JSON.parse(message) }));
      }
    } catch (err) {
    }
  });

  subscriber.pSubscribe(`${IdPrefixes.PRIVATE_MESSAGE_UPDATE}:*`, 
  (message: any, channel: any) => {
    try {
      const inboxId = channel.replace(`${IdPrefixes.PRIVATE_MESSAGE_UPDATE}:`, "");
      const parsed = JSON.parse(message);

      const [user1, user2] = inboxId.split(":");

      [user1, user2].forEach(user => {
        if (userSockets.has(user)) {
          userSockets.get(user)!.forEach(client => 
            safeSend(client, { 
              type: IdPrefixes.PRIVATE_MESSAGE_UPDATE,
              ...parsed
            })
          );
        }
      });
    } catch (err) {
    }
  }
);

  // Return a disposer so server can unsubscribe on shutdown
  const dispose = async () => {
    try {
      // best-effort unsubscribe - API depends on redis client lib
      // if using node-redis v4:
      // await subscriber.pUnsubscribe(); await subscriber.unsubscribe();
      // If those functions not available, you can call subscriber.disconnect()
      if ((subscriber as any).pUnsubscribe) {
        await (subscriber as any).pUnsubscribe();
      }
      if ((subscriber as any).unsubscribe) {
        await (subscriber as any).unsubscribe();
      }
      // Or disconnect entirely:
      // await subscriber.disconnect();
    } catch (err) {
    }
  };

  subscriber.pSubscribe(`${IdPrefixes.ACHIEVEMENT_UNLOCKED}:*`, (message: any, channel: any) => {
    try {
        const playerId = channel.replace(`${IdPrefixes.ACHIEVEMENT_UNLOCKED}:`, "");
        const payload = JSON.parse(message);
        
        if (userSockets.has(playerId)) {
            userSockets.get(playerId)!.forEach((client) =>
                safeSend(client, {
                    type: "ACHIEVEMENT_UNLOCKED",
                    actionData: payload
                })
            );
        }
    }
    catch (err) {
    }
  });

  subscriber.pSubscribe(`${IdPrefixes.GAME_RESULT}:*`, (message:any, channel:any) => {

    try {
        const playerId = channel.replace(`${IdPrefixes.GAME_RESULT}:`, "");
        const payload = JSON.parse(message);
        if (userSockets.has(playerId)) {
            userSockets.get(playerId)!.forEach((client) =>
                safeSend(client, {
                    type: "GAME_RESULT",
                    actionData: payload
                })
            );
        }
    } catch (err) {
    }
});

  return { dispose };
}

