import { n4jSession } from "../neo4jClient";
import { redisClient } from "../redisClient";
import { CACHE_DURATION } from "../shared_modules/configMaps";
import { CacheTypes } from "../shared_modules/shared_enums";

export class UserService {
  static async getFriends(username: string): Promise<string[]> {
    const n4jSesh = n4jSession();

    try {
      // Check if player exists
      const playerExists = await n4jSesh.executeRead(async tx => {
        const result = await tx.run(
          `RETURN EXISTS{ MATCH(:Player {username: $username}) } AS playerExists`,
          { username }
        );
        return result.records[0]?.get("playerExists");
      });

      if (!playerExists) {
        throw new Error(`Player '${username}' does not exist`);
      }

      // Get friends
      const friends = await n4jSesh.executeRead(async tx => {
        const result = await tx.run(
          `MATCH(p:Player {username: $username})
           OPTIONAL MATCH (p)-[:FRIEND]-(f:Player)
           RETURN collect(f.username) AS friends`,
          { username }
        );
        return result.records[0]?.get("friends") ?? [];
      });

      return friends;
    } finally {
      await n4jSesh.close();
    }
  }

  static async getCachedFriendList(redisKey: string) {
    const cachedList = await redisClient.lRange(redisKey, 0, -1);
    return cachedList;
  }

  static async deleteCachedFriendList(redisKey: string) {
    await redisClient.del(redisKey);
  }

  static async cacheFriends(redisKey: string, friends: string[]) {
    if (friends.length === 0) return;
    
    await redisClient.rPush(redisKey, friends);
    await redisClient.expire(redisKey, CACHE_DURATION[CacheTypes.GENERIC_CACHE]);
  }
}

export const isInvalid = (value:any) => {
    return !value || typeof value !== 'string' || value.trim() === '';
}

export const areInvalidMessagePair = (sender:any, receiver:any) => {
    return isInvalid(sender) || isInvalid(receiver) || sender === receiver;
}