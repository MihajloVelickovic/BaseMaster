import { Router } from "express";
import { n4jDriver, n4jSession } from "../neo4jClient";
import { auth, Transaction } from "neo4j-driver";
import { areInvalidMessagePair, invalidateFriendListCache, UserService } from "../utils/userService";
import {publisher, redisClient} from "../redisClient";
import { IdPrefixes, CacheTypes, PAGE_SIZE } from "../shared_modules/shared_enums";
import { upsertPlayer } from "../graph/player.repo";
import { connectPlayerToLeaderboard, getPlayerAchievements, getPlayerStats, getFriendsWithAchievements, getAllAchievementsWithStats, getGlobalLeaderboard, checkAndAwardFriendAchievements } from '../graph/leaderboard.repo';
import { RedisKeys } from "../utils/redisKeyService";
import { authUser, JWT_REFRESH, JWT_SECRET } from "../config/config";
import jwt from "jsonwebtoken";
import { hashPassword, verifyPassword } from "../utils/auth";
import { CACHE_DURATION } from "../shared_modules/configMaps";
import { isNullOrWhitespace } from "../utils/stringUtils";
import { getPlayerRankFromRedis, invalidateLeaderboardCache } from "../utils/gameService";

const userRouter = Router();
let refreshToks: string[] = [];

userRouter.post("/register", async(req: any, res: any) => {
    console.log("someone is registering 🤫🤫🤫");
    const {email, username, password} = req.body;
    let player = {
        username: username,
        password: password,
        email: email
    };

    if(isNullOrWhitespace(email) || isNullOrWhitespace(username) ||
       isNullOrWhitespace(password))
        return res.status(400).json({message: "All fields necessary"});

    try{
        const hashedPassword = await hashPassword(password);
        
        // Create Player node directly (no separate User node)
        await upsertPlayer(username, email, hashedPassword);
        await connectPlayerToLeaderboard(username);
        await redisClient.del(RedisKeys.globalLeaderboard());
        await invalidateLeaderboardCache();
        
        const token = jwt.sign({username}, JWT_SECRET, {expiresIn: 600});
        const refreshToken = jwt.sign({username}, JWT_REFRESH);
        refreshToks.push(refreshToken);
        console.log("a");
        return res.status(200).json({message: "Successfully added player!", user: player, token: token, refresh: refreshToken});
    }
    catch(error:any){
        return res.status(500).json({message:"How did this happen....", error: error.message});
    }
});

userRouter.post("/login", async(req: any, res: any) => {
    console.log("someone is signing in 🕺🕺🕺");

    const {emailOrUsername, password} = req.body;

    if(isNullOrWhitespace(emailOrUsername) || isNullOrWhitespace(password))
        return res.status(400).json({message: "EmailOrUsername and Password required"}); 

    try{
        const n4jSesh = n4jSession();
        let player = await n4jSesh.executeRead(async transaction => {
            const result = await transaction.run(`MATCH(p:Player)
                                                   WHERE p.username = $emailOrUsername OR 
                                                         p.email = $emailOrUsername
                                                   RETURN {
                                                    email: p.email, 
                                                    username: p.username, 
                                                    password: p.password
                                                   } as player`, 
                                                 { emailOrUsername });
            return result.records[0]?.get("player") ?? false;
        });
        
        n4jSesh.close();
    
        if(!player)
            return res.status(400).json({message: `Player '${emailOrUsername}' does not exist`});

        const isCorrectPassword = await verifyPassword(password, player.password);

        if(!isCorrectPassword)
            return res.status(400).json({message: "Incorrect password"});

        await redisClient.sAdd(RedisKeys.onlinePlayers(), player.username);
        await connectPlayerToLeaderboard(player.username);
        
        const token = jwt.sign({emailOrUsername}, JWT_SECRET, {expiresIn: 600});
        const refreshToken = jwt.sign({emailOrUsername}, JWT_REFRESH);
        refreshToks.push(refreshToken);
        console.log("a");
        return res.status(200).json({message: "Success", user: player, token: token, refresh: refreshToken});
    }
    catch(error:any){
        return res.status(500).json({message:`How did this happen....\n[ERROR]:${error.message}`, 
                                     error: error.message});
    }
});

userRouter.post("/logout", authUser, (req, res) => {
    const {token} = req.body;
    
    if (isNullOrWhitespace(token)) 
        return res.status(400).json({message: "Refresh token required"});
    
    const tokenIndex = refreshToks.indexOf(token);
    if (tokenIndex !== -1) {
        refreshToks.splice(tokenIndex, 1);
        return res.status(200).json({message: "Successfully logged out"});
    }
    
    return res.status(400).json({message: "Invalid refresh token"});
})

userRouter.post("/refreshAccess", (req, res) => {
    const {token} = req.body;
    const verified = (() => {
        try{
            return jwt.verify(token, JWT_REFRESH);
        }
        catch(err){
            return false;
        }
    })();

    if(!verified)
        return res.status(403).json({message: "Refresh token invalid"});

    if(!refreshToks.includes(token))
        return res.status(403).json({message: "Refresh token invalid"});

    if (typeof verified === 'object' && 'emailOrUsername' in verified){
        const newTok = jwt.sign({emailOrUsername: verified.emailOrUsername}, JWT_SECRET, {expiresIn: 600});
        const newRefreshToken = jwt.sign({emailOrUsername: verified.emailOrUsername}, JWT_REFRESH);
        refreshToks.splice(refreshToks.indexOf(token), 1);
        refreshToks.push(newRefreshToken);
        return res.status(200).json({accessTok: newTok, refreshTok: newRefreshToken});
    }
});

userRouter.post("/friendRequests", authUser, async(req: any, res: any) => {
    console.log("na prste ruke prebroj prijatelje ☝️ ✌️ 🖐️");

    const {username} = req.body;

    if(isNullOrWhitespace(username))
        return res.status(400).json({message: "Username necessary to retrieve friend requests"});

    try{
        const n4jSesh = n4jSession();

        const playerExists = await n4jSesh.executeRead(async transaction => {
            const result = await transaction.run(`RETURN EXISTS{ 
                                                    MATCH(:Player{username: $username})
                                                  } AS playerExists`,
                                                 { username });
            return result.records[0]?.get("playerExists");
        });

        if(!playerExists){
            n4jSesh.close();
            return res.status(400).json({message: "Request made for non-existing player"});
        }

        const friendRequests = await n4jSesh.executeRead(async transaction => {
            const result = await transaction.run(`MATCH(:Player{username: $username}) <-
                                                       [:FRIEND_REQUEST] -
                                                       (senders: Player)
                                                  RETURN collect(senders) AS pending`,
                                                  { username });
            return result.records[0]?.get("pending").map((f:any) => f.properties.username);
        });

        n4jSesh.close();

        return res.status(200).json({message: `Gathered pending requests for player '${username}'`, requests: friendRequests});
    }
    catch(error:any){
        return res.status(500).json({message:"How did this happen....", error: error.message});
    }
});

userRouter.post("/sendFriendRequest", authUser, async(req:any, res:any)=>{
    console.log("woo friends 👋👋👋");
    
    const {sender, receiver} = req.body;

    if(isNullOrWhitespace(sender) || isNullOrWhitespace(receiver))
        return res.status(400).json({message: "Both fields necessary"});

    if(sender === receiver)
        return res.status(400).json({message: "Can't add yourself silly"});

    try{
        const n4jSesh = n4jSession();

        const playerExists = await n4jSesh.executeRead(async transaction => {
            const result = await transaction.run(`RETURN EXISTS{ 
                                                    MATCH(:Player{username: $sender})
                                                  } AS senderExists,
                                                  EXISTS{ 
                                                    MATCH(:Player{username: $receiver})
                                                  } AS receiverExists`,
                                                 { sender, receiver });
            const se = result.records[0]?.get("senderExists");
            const re = result.records[0]?.get("receiverExists");
            return [se, re];
        });

        if(!playerExists[0]){
            n4jSesh.close();
            return res.status(400).json({message: `Player '${sender}' doesn't exist`});
        }

        if(!playerExists[1]){
            n4jSesh.close();
            return res.status(400).json({message: `Player '${receiver}' doesn't exist`});
        }

        const friendListKey = RedisKeys.friendList(sender);
        const cachedIsFriend = await redisClient.lPos(friendListKey, receiver);

        if(cachedIsFriend !== null)
            return res.status(400).json({message: `Already friends with ${receiver}`});

        const requestExists = await n4jSesh.executeRead(async transaction => {
            const result = await transaction.run(`MATCH(sender: Player{username: $sender}) - 
                                                       [r:FRIEND_REQUEST] - 
                                                       (receiver: Player{username: $receiver})
                                                  RETURN 
                                                  CASE startNode(r) 
                                                  WHEN sender THEN 1
                                                  ELSE 2
                                                  END AS req`, 
                                                  { sender, receiver });
            return result.records[0]?.get("req") ?? 0;
        });

        switch(requestExists){
            case 0:
                break;
            case 1:
                n4jSesh.close();
                return res.status(400).json({message: `Already sent friend request to ${receiver}`});
            case 2:
                n4jSesh.close();
                return res.status(400).json({message: `Already have a pending request from ${receiver}`});
        }
        
        const friendRequest = await n4jSesh.executeWrite(async transaction => {
            const result = await transaction.run(`MATCH(sender:Player{username: $sender}),
                                                    (receiver:Player{username: $receiver})
                                                CREATE(sender)-[r:FRIEND_REQUEST]->(receiver)
                                                RETURN true AS req`, { sender, receiver });
            return result.records[0]?.get("req") ?? false;
        });

        n4jSesh.close();

        if(!friendRequest)
            return res.status(400).json({message: "Failed to send friend request"});

        await publisher.publish(
            RedisKeys.friendRequest(receiver),
            JSON.stringify({
                from: sender,
                message: `${sender} sent you a friend request`
        }));
        return res.status(200).json({message: `Friend request to '${receiver}' successfully sent!`});
    }
    catch(error:any){
        console.log(error);
        return res.status(500).json({message:"How did this happen....", error: error.message});
    }
});

userRouter.post("/handleFriendRequest", authUser, async(req:any, res:any)=>{
    console.log("handling friend request 🧛🧛🧛");

    const {username, sender, userResponse} = req.body;
    if(isNullOrWhitespace(username) || isNullOrWhitespace(sender) 
      ||userResponse === null || userResponse === undefined)
        return res.status(400).json({message: "The sender and the response need to be known to handle the request"});

    try{
        const n4jSesh = n4jSession();
        
        const playerExists = await n4jSesh.executeRead(async transaction => {
            const result = await transaction.run(`RETURN EXISTS{ 
                                                    MATCH(:Player{username: $username})
                                                  } AS playerExists, 
                                                  EXISTS{ 
                                                    MATCH(:Player{username: $sender})
                                                  } AS senderExists`,
                                                 { username , sender});
            
            const pe = result.records[0]?.get("playerExists");
            const se = result.records[0]?.get("senderExists");
            return [pe, se];
        });

        if(!playerExists[0]){
            n4jSesh.close();
            return res.status(400).json({message: `Player '${username}' doesn't exist`});
        }

        if(!playerExists[1]){
            n4jSesh.close();
            return res.status(400).json({message: `Player '${sender}' doesn't exist`});
        }

        const deleteRequest = await n4jSesh.executeWrite(async transaction => {
            const result = await transaction.run(`MATCH(:Player{username: $username}) <- 
                                                       [r:FRIEND_REQUEST] -
                                                       (:Player{username: $sender})
                                                  DELETE r RETURN true AS deleted`,
                                                 { username, sender });
            return result.records[0]?.get("deleted") ?? false;
        });

        if(!deleteRequest){
            n4jSesh.close();
            return res.status(400).json({message: "Friend request didn't exist"});
        }

        if(!userResponse){
            n4jSesh.close();
            await publisher.publish(
                RedisKeys.friendRequestDeny(sender),
                JSON.stringify({
                    from: username,
                    message: `${username} declined your friend request`
            }));

            return res.status(200).json({message: `Player '${username}' declined friend request from '${sender}'`});
        }

        const makeFriends = await n4jSesh.executeWrite(async transaction => {
            const result = await transaction.run(`MATCH(sender:Player{username: $sender}), (player:Player{username: $username})
                                                  CREATE(sender)-[:FRIEND]->(player)
                                                  RETURN true AS friends`,
                                                  {username, sender});
            return result.records[0]?.get("friends") ?? false;                                                        
        });

        n4jSesh.close();
        
        
        if(!makeFriends)
            return res.status(400).json({message: `Failed to establish friendship between '${username}' and '${sender}'`});
        
        await invalidateFriendListCache(sender, username);

        await checkAndAwardFriendAchievements(sender);
        await checkAndAwardFriendAchievements(username);

        await publisher.publish(
            RedisKeys.friendRequestAccept(sender),
            JSON.stringify({
                from: username,
                message: `${username} accepted your friend request`
        }));

        return res.status(200).json({message: `Player '${username}' accepted '${sender}'s friend request!`});        
    }
    catch(error:any){
        return res.status(500).json({message:"How did this happen....", error: error.message});
    }
});

userRouter.post("/getFriends", authUser, async(req: any, res: any) => {
    const {username} = req.body;
    const {expired} = req;
    if(expired)
        return res.status(403).json({message: "Token expired"});
    if(isNullOrWhitespace(username)) {
        console.log("[ERROR]: Argument username missing");
        return res.status(400).json({message: "Username needed to retrieve friends"});
    }
    
    try {
        const redisKey = RedisKeys.friendList(username);
        var cachedList = await UserService.getCachedFriendList(redisKey);
        
        if(cachedList && cachedList.length > 0) {            
            return res.status(200).json(
            {message:`All friends of player '${username}'`, friends:cachedList});
        }
        
        const friends = await UserService.getFriends(username);
        await UserService.cacheFriends(redisKey, friends);

        return res.status(200).json({message:`All friends of player '${username}'`, friends});
    } catch (error: any) {
        return res.status(400).json({message: error.message});
    }
});

userRouter.post("/removeFriend", authUser, async (req: any, res: any) => {
    const {username, friend} = req.body;

    console.log(`Removing friend '${friend}' from '${username}' 💔`);

    if (isNullOrWhitespace(username) || isNullOrWhitespace(friend)) {
        console.log("[ERROR]: Argument username or friend username missing");
        return res.status(400).json({ message: "Both username and friend are required" });
    }

    try {
        const n4jSesh = n4jSession();

        const playerExists = await n4jSesh.executeRead(async transaction => {
            const result = await transaction.run(`
                RETURN EXISTS { MATCH(:Player {username: $username}) } AS playerExists,
                EXISTS { MATCH(:Player {username: $friend}) } AS friendExists
                `, {username, friend});

                const pe = result.records[0]?.get("playerExists");
                const fe = result.records[0]?.get("friendExists");
                return [pe, fe];
        });

        if(!playerExists[0]) {
            n4jSesh.close();
            return res.status(400).json({message: `Player '${username}' does not exist`});
        }

        if(!playerExists[1]) {
            n4jSesh.close();
            return res.status(400).json({message: `Friend '${friend}' does not exist`});
        }

        const deleteFriendRelation = await n4jSesh.executeWrite(async transaction => {
            const result = await transaction.run(`
                MATCH (p1:Player {username: $username})-[f:FRIEND]-(p2:Player {username: $friend})
                DELETE f
                RETURN count(f) > 0 AS deleted
                `, {username,friend});

                return result.records[0]?.get("deleted") ?? false;
        });

        n4jSesh.close();

        if(!deleteFriendRelation)
            return res.status(400).json({message: `No friendship found between '${username}' and '${friend}'`});         

        await invalidateFriendListCache(username, friend);

        await publisher.publish(RedisKeys.friendRemoved(friend),
                        JSON.stringify({
            from: username,
            message: `${username} removed you from friends`
        }));

        // Notify the user who initiated the removal (for syncing other tabs/devices)
        await publisher.publish(RedisKeys.friendRemoved(username),
                                JSON.stringify({
            from: friend,
            message: `You removed ${friend} from friends`
        }));

        return res.status(200).json({message: `Successfully removed '${friend}' from '${username}' friend list`});
    }
    catch (error:any) {
        console.log(`[ERROR]: Something very wrong happened....:${error.message}`)
        return res.status(500).json({message: "How did this happen...", error: error.message});
    }
});

userRouter.post("/sendInvite", authUser, async (req:any, res:any) => {
    const { sender, receiver, gameId} = req.body;

    if(isNullOrWhitespace(sender) || isNullOrWhitespace(receiver))
        return res.status(400).json({message: "Missing required parameters: username or friendUsername or gameId"});

    try {
        const inviteKey = RedisKeys.invite(receiver);

        await redisClient.hSet(inviteKey, sender, gameId);

        await publisher.publish(inviteKey, JSON.stringify({
            from: sender,
            to:receiver,    
            gameId:gameId,
            message: `${sender} invited you to game`
        }));
        return res.status(200).json({message: `Successfully sent invite to '${receiver}' from '${sender}'`});
    }
    catch(err:any) {
        console.log("[ERROR]: ", err.message);
        return res.status(500).json({message: "How did this happen...", error: err.message})
    }
});

userRouter.post("/getInvites", authUser, async (req:any, res:any) => {
    const {username} = req.body;

    if(isNullOrWhitespace(username))
        return res.status(400).json({message:"Missing username argument"});

    try {
        const invites = await redisClient.hGetAll(RedisKeys.invites(username));

        if(!invites)
            return res.status(404).json({message:"No invites found"});

        return res.status(200).json({message:"Found invites", invites:invites});
    }
    catch(err:any) {
        console.log(`[ERROR]: Something very wrong happened....:${err.message}`)        
    }
});

userRouter.post("/getAchievements", authUser,  async (req: any, res: any) => {
    const { username } = req.body;
    
    if (isNullOrWhitespace(username)) {
        return res.status(400).json({ message: "Username required" });
    }
    
    try {
        const achievements = await getPlayerAchievements(username);
        return res.status(200).json({ achievements });
    } catch (error) {
        return res.status(500).json({ message: "Failed to fetch achievements" });
    }
});

userRouter.post("/getPlayerStats", authUser, async (req: any, res: any) => {
    const { username } = req.body;
    
    if (isNullOrWhitespace(username)) {
        return res.status(400).json({ message: "Username required" });
    }
    
    try {
        const playerAchievementsKey = RedisKeys.playerStats(username);
        const cachedStats = await redisClient.get(playerAchievementsKey);
        
        if (cachedStats === null) {
            // Get fresh stats from Neo4j
            const stats = await getPlayerStats(username);
            
            // Cache the result
            await redisClient.set(playerAchievementsKey, JSON.stringify(stats));
            await redisClient.expire(
                playerAchievementsKey,
                CACHE_DURATION[CacheTypes.GENERIC_CACHE]
            );
            
            return res.status(200).json({ stats });
        } 
        else {
            return res.status(200).json({ stats: JSON.parse(cachedStats) });
        }
        
    } catch (error:any) {
        console.log(error)
        return res.status(500).json({ message: "Failed to fetch player stats" });
    }
});

userRouter.post("/getFriendsWithAchievements", authUser, async (req: any, res: any) => {
    const { username } = req.body;
    
    if (isNullOrWhitespace(username))
        return res.status(400).json({ message: "Username required" });
    
    
    try {
        const friends = await getFriendsWithAchievements(username);
        return res.status(200).json({ friends });
    } catch (error:any) { //any any any any
        return res.status(500).json({ message: "Failed to fetch friends data" });
    }
});

userRouter.post("/searchUsers", authUser, async (req: any, res: any) => {
    const { query, currentUser } = req.body;
    
    if (isNullOrWhitespace(query)) {
        return res.status(400).json({ message: "Search query required" });
    }
    
    try {
        const n4jSesh = n4jSession();
        
        const result = await n4jSesh.executeRead(async transaction => {
            return await transaction.run(`
                MATCH (p:Player)
                WHERE p.username CONTAINS $query AND p.username <> $currentUser
                OPTIONAL MATCH (current:Player {username: $currentUser})-[:FRIEND]-(p)
                OPTIONAL MATCH (current)-[:FRIEND_REQUEST]->(p)
                OPTIONAL MATCH (p)-[:FRIEND_REQUEST]->(current)
                RETURN DISTINCT p.username as username,
                       EXISTS((current)-[:FRIEND]-(p)) as isFriend,
                       EXISTS((current)-[:FRIEND_REQUEST]->(p)) as requestSent,
                       EXISTS((p)-[:FRIEND_REQUEST]->(current)) as requestReceived
                LIMIT 10
            `, { query, currentUser });
        });
        
        n4jSesh.close();
        
        const users = result.records.map(record => ({
            username: record.get('username'),
            isFriend: record.get('isFriend'),
            requestSent: record.get('requestSent'),
            requestReceived: record.get('requestReceived')
        }));
        
        return res.status(200).json({ users });
    } catch (error) {
        return res.status(500).json({ message: "Error searching users" });
    }
});

userRouter.post("/sendMessage", authUser, async (req:any, res:any) => {
    const { sender, receiver, messageText} = req.body;

    if(isNullOrWhitespace(messageText) || areInvalidMessagePair(sender,receiver))
        return res.status(400).json({ message: "Invalid input" });

    try {
        const inboxKey = RedisKeys.inboxKey(sender, receiver);

        const message = {
            from: sender,
            to: receiver,
            text: messageText,
            timestamp: Date.now()
        };

        await redisClient.setEx(inboxKey, 
                                CACHE_DURATION[CacheTypes.DISSAPEARING_MESSAGE],
                                JSON.stringify(message));

        publisher.publish(
            RedisKeys.privateMessageUpdate(sender,receiver),
            JSON.stringify(message)
        );

        return res.status(200).json({ receiver });                                
    }
    catch(err:any) {
        console.log(err);
        return res.status(500).json({ message: "Error sending message" });
    }
});

userRouter.post("/getMessages", authUser, async (req:any, res:any) => {
    const {sender, receiver} = req.body;
    
    if(areInvalidMessagePair(sender,receiver))
        return res.status(400).json({ message: "Invalid input" });

    try {
        const pattern = RedisKeys.inboxPatern(sender, receiver);
        const msgKeys = await redisClient.keys(pattern);

        const messagePromises = msgKeys.map(async (key) => {
            const msg = await redisClient.get(key);
            return msg ? JSON.parse(msg) : null;
        });

        const messages = (await Promise.all(messagePromises)).filter(Boolean);

        return res.status(200).json({ messages });
    }
    catch(err:any) {
         return res.status(500).json({ message: "Error getting messages" });
    }
});



userRouter.get("/getAllAchievementsWithStats", authUser, async (req: any, res: any) => {
  try {
    const cacheKey = RedisKeys.globalAchievementStats();
    const cached = await redisClient.get(cacheKey);
    
    if (cached) {
      return res.status(200).json({ stats: JSON.parse(cached) });
    }

    const stats = await getAllAchievementsWithStats();
    
    await redisClient.set(cacheKey, JSON.stringify(stats));
    await redisClient.expire(cacheKey, 300);
    
    return res.status(200).json({ stats });
  } catch (error: any) {
    console.error('[ERROR]: Failed to fetch global stats', error);
    return res.status(500).json({ message: "Failed to fetch global stats" });
  }
});

userRouter.get("/getPlayerRank", authUser, async(req:any, res:any) => {
try {
    const username = req.query.username;
    if (!username)
      return res.status(400).json({ error: "Missing username" });
   
    const rank = await getPlayerRankFromRedis(username);

    if (!rank || rank < 1)
      return res.status(404).json({ error: "Player not found" });
    
    const page = Math.ceil(rank / PAGE_SIZE);
    const skip = (page - 1) * PAGE_SIZE;
    
    const pageKey = RedisKeys.leaderboardPage(page);
    const cached = await redisClient.get(pageKey);
    
    let leaderboardPage;
    if (cached) 
      leaderboardPage = JSON.parse(cached);
    else 
      leaderboardPage = await getGlobalLeaderboard(PAGE_SIZE, skip);
    
    const player = leaderboardPage.find((p: any) => p.username === username);
    
    if (!player)
      return res.status(404).json({ error: "Player not found in page" });
    
    return res.json({
      username: player.username,
      bestScore: player.bestScore,
      totalScore: player.totalScore,
      firsts: player.firsts || 0,
      seconds: player.seconds || 0,
      thirds: player.thirds || 0,
      fourths: player.fourths || 0,
      rank: rank
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default userRouter;
