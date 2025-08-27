import { n4jSession } from "../neo4jClient";
import { redisClient } from "../redisClient";
import { IdPrefixes, NumericalConstants } from "../shared_modules/shared_enums";


class UserService {
  async getFriends(username: string): Promise<string[]> {
    const n4jSesh = n4jSession();

    try {
      // Check if user exists
      const userExists = await n4jSesh.executeRead(async tx => {
        const result = await tx.run(
          `RETURN EXISTS{ MATCH(:User {username: $username}) } AS userExists`,
          { username }
        );
        return result.records[0]?.get("userExists");
      });

      if (!userExists) {
        throw new Error(`User '${username}' does not exist`);
      }

      // Get friends
      const friends = await n4jSesh.executeRead(async tx => {
        const result = await tx.run(
          `MATCH(u:User {username: $username})
           OPTIONAL MATCH (u)-[:FRIEND]-(n:User)
           RETURN collect(n.username) AS friends`,
          { username }
        );
        return result.records[0]?.get("friends") ?? [];
      });

      return friends;
    } finally {
      await n4jSesh.close();
    }
  }

  async getCachedFriendList(redisKey: string) {
    
    const cachedList = 
    await redisClient.lRange(redisKey,0,-1);

    return cachedList;
  }

   async deleteCachedFriendList(redisKey: string) {
     await redisClient.del(redisKey);
   }    

  async cacheFriends(redisKey: string, friends: string[]) {
    if (friends.length === 0) return; // no-op
    
    await redisClient.rPush(redisKey, friends);
    await redisClient.expire(redisKey, NumericalConstants.CACHE_EXP_TIME);
   }

   createFriendListKey(username: string) {
    return  `${IdPrefixes.FRIEND_LIST}_${username}`;
   }
}

export const userService = new UserService();