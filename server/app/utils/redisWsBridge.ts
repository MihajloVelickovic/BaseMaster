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
      if (client.readyState === 1) client.send(JSON.stringify(payload));
    } catch (err) {
      // optional: log or remove client if broken
      console.error("[WS SEND ERROR]", err);
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
      console.error("[SCOREBOARD handler error]", err);
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
      console.error("[ALL_PLAYERS_COMPLETE handler error]", err);
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
      console.error("[PLAYER_JOIN handler error]", err);
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
      console.error("[PLAYER_LEAVE handler error]", err);
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
      console.error("[MESSAGE_UPDATE handler error]", err);
    }
  });

  // FRIEND_* patterns -> user-specific sockets
  const friendPatterns = ["FRIEND_REQUEST:*", "FRIEND_ACCEPTED:*", "FRIEND_DECLINED:*", "FRIEND_REMOVED:*"];
  friendPatterns.forEach(pattern => {
    subscriber.pSubscribe(pattern, (message:any, channel:any) => {
      try {
        const toUser = channel.split(":"); // supports underscores in username
        if (userSockets.has(toUser)) {
          userSockets.get(toUser)!.forEach(client => safeSend(client, { type: pattern.split("_")[0], ...JSON.parse(message) }));
        }
      } catch (err) {
        console.error(`[${pattern} handler error]`, err);
      }
    });
  });

  // USER_ONLINE / USER_OFFLINE (non-pattern subscribe)
  subscriber.subscribe("USER_ONLINE", (message:any) => {
    try {
      const { username } = JSON.parse(message);
      userSockets.forEach((sockets) => {
        sockets.forEach((client) => safeSend(client, { type: "USER_ONLINE", username }));
      });
    } catch (err) {
      console.error("[USER_ONLINE handler error]", err);
    }
  });

  subscriber.subscribe("USER_OFFLINE", (message) => {
    try {
      const { username } = JSON.parse(message);
      userSockets.forEach((sockets) => {
        sockets.forEach((client) => safeSend(client, { type: "USER_OFFLINE", username }));
      });
    } catch (err) {
      console.error("[USER_OFFLINE handler error]", err);
    }
  });

  // INVITE pattern
  subscriber.pSubscribe(`${IdPrefixes.INVITE}_*`, (message:any, channel:any) => {
    try {
      const toUser = channel.replace(`${IdPrefixes.INVITE}_`, "");
      if (userSockets.has(toUser)) {
        userSockets.get(toUser)!.forEach(client => safeSend(client, { type: IdPrefixes.INVITE, ...JSON.parse(message) }));
      }
    } catch (err) {
      console.error("[INVITE handler error]", err);
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
      console.error("[PRIVATE_MESSAGE_UPDATE handler error]", err);
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
      console.log("[RedisWsBridge] unsubscribed/cleaned up");
    } catch (err) {
      console.error("[RedisWsBridge dispose error]", err);
    }
  };

  return { dispose };
}
