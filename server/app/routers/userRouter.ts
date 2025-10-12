import { Router } from "express";
import { n4jDriver, n4jSession } from "../neo4jClient";
import { auth, Transaction } from "neo4j-driver";
import { UserService } from "../utils/userService";
import {publisher, redisClient} from "../redisClient";
import { IdPrefixes, CacheTypes } from "../shared_modules/shared_enums";
import { upsertPlayerFromUser } from "../graph/player.repo";
import { connectPlayerToLeaderboard, getPlayerAchievements, getPlayerStats, getFriendsWithAchievements, getAllAchievementsWithStats } from '../graph/leaderboard.repo';
import { RedisKeys } from "../utils/redisKeyService";
import { authUser, JWT_REFRESH, JWT_SECRET } from "../config/config";
import jwt from "jsonwebtoken";
import { hashPassword, verifyPassword } from "../utils/auth";
import { CACHE_DURATION } from "../shared_modules/configMaps";
import { isNullOrWhitespace } from "../utils/stringUtils";
import { invalidateLeaderboardCache } from "../utils/gameService";

// TODO hashiranje sifre

const userRouter = Router();
let refreshToks: string[] = [];

userRouter.post("/register", async(req: any, res: any) => {

    console.log("someone is registering 🤫🤫🤫");
    const {email, username, password} = req.body;

    

    if(isNullOrWhitespace(email) || isNullOrWhitespace(username) ||
       isNullOrWhitespace(password))
        return res.status(400).json({message: "All fields necessary"});

    try{
        const n4jSesh = n4jSession();

        const hashedPassword = await hashPassword(password);

        const register = await n4jSesh.executeWrite(async transaction => {
            const result = await transaction.run(`CREATE(n:User{email: $email, username: $username, password: $password})
                                                  RETURN true AS success`,
                                                 { username, email, password: hashedPassword });
            return result.records[0]?.get("success") ?? false;
        });

        //TODO email potvrda

        n4jSesh.close();

        if (register) {
            await upsertPlayerFromUser(username, email);
            await connectPlayerToLeaderboard(username); // Add this line
            await redisClient.del(RedisKeys.globalLeaderboard());
            await invalidateLeaderboardCache();
            return res.status(200).json({message: `User successfully created!`, username});
        }
        else 
            return res.status(400).json({message: `Failed to create user "${username}"\n${register}`});
    }
    catch(error:any){
        return res.status(500).json({message:"How did this happen....", error: error.gqlStatusDescription});
    }
    
        
});

userRouter.post("/login", async(req: any, res: any) => {

    console.log("someone is signing in 🕺🕺🕺");

    const {emailOrUsername, password} = req.body;

    if(isNullOrWhitespace(emailOrUsername) || isNullOrWhitespace(password))
        return res.status(400).json({message: "EmailOrUsername and Password required"}); 

    try{
        const n4jSesh = n4jSession();
        let user = await n4jSesh.executeRead(async transaction => {
            const result = await transaction.run(`MATCH(n:User)
                                                   WHERE n.username = $emailOrUsername OR 
                                                         n.email = $emailOrUsername
                                                   RETURN {
                                                    email: n.email, 
                                                    username: n.username, 
                                                    password: n.password
                                                   } as user`, 
                                                 { emailOrUsername });
            return result.records[0]?.get("user") ?? false;
        });
        
        n4jSesh.close();
    
        if(!user)
            return res.status(400).json({message: `User '${emailOrUsername}' does not exist`});

        const isCorrectPassword = 
        await verifyPassword(password, user.password);

        if(!isCorrectPassword)
            return res.status(400).json({message: "Incorrect password"});

        //TODO JWT
        await redisClient.sAdd(RedisKeys.onlinePlayers(), user.username);
        await upsertPlayerFromUser(user.username, user.email);
        await connectPlayerToLeaderboard(user.username); // Add this line
        const token = jwt.sign({emailOrUsername}, JWT_SECRET, {expiresIn: 600});
        const refreshToken = jwt.sign({emailOrUsername}, JWT_REFRESH);
        refreshToks.push(refreshToken);
        return res.status(200).json({message: "Success", user: user, token: token, refresh: refreshToken});
    }
    catch(error:any){
        return res.status(500).json({message:`How did this happen....\n[ERROR]:${error.message}`, 
                                     error: error.gqlStatusDescription});
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

        const userExists = await n4jSesh.executeRead(async transaction => {
            const result = await transaction.run(`RETURN EXISTS{ 
                                                    MATCH(:User{username: $username})
                                                  } AS userExists`,
                                                 { username });
            return result.records[0]?.get("userExists");
        });

        if(!userExists){
            n4jSesh.close();
            return res.status(400).json({message: "Request made for non-existing user"});
        }

        const friendRequests = await n4jSesh.executeRead(async transaction => {
            const result = await transaction.run(`MATCH(:User{username: $username}) <-
                                                       [:FRIEND_REQUEST] -
                                                       (senders: User)
                                                  RETURN collect(senders) AS pending`,
                                                  { username });
            return result.records[0]?.get("pending").map((f:any) => f.properties.username);
        });

        n4jSesh.close();

        return res.status(200).json({message: `Gathered pending requests for user '${username}'`, requests: friendRequests});
    }
    catch(error:any){
        return res.status(500).json({message:"How did this happen....", error: error.gqlStatusDescription});
    }

});

userRouter.post("/sendFriendRequest", authUser, async(req:any, res:any)=>{

    console.log("woo friends 👋👋👋");
    console.log(req);
    const {sender, receiver} = req.body;

    if(isNullOrWhitespace(sender) || isNullOrWhitespace(receiver))
        return res.status(400).json({message: "Both fields necessary"});

    if(sender === receiver)
        return res.status(400).json({message: "Can't add yourself silly"});

    try{
        const n4jSesh = n4jSession();

        const userExists = await n4jSesh.executeRead(async transaction => {
            const result = await transaction.run(`RETURN EXISTS{ 
                                                    MATCH(:User{username: $sender})
                                                  } AS userExists,
                                                  EXISTS{ 
                                                    MATCH(:User{username: $receiver})
                                                  } AS receiverExists`,
                                                 { sender, receiver });
            const ue = result.records[0]?.get("userExists");
            const re =  result.records[0]?.get("receiverExists");
            return [ue, re];
        });

        if(!userExists[0]){
            n4jSesh.close();
            return res.status(400).json({message: `User '${sender}' doesn't exist`});
        }

        if(!userExists[1]){
            n4jSesh.close();
            return res.status(400).json({message: `User '${receiver}' doesn't exist`});
        }

        const frinedListKey = RedisKeys.friendList(sender);
        const cachedIsFriend = await redisClient.lPos(frinedListKey, receiver);

        if(cachedIsFriend !== null)
            return res.status(400).json({message: `Already sent friend request to user ${receiver}`});

        
        const requestExists = await n4jSesh.executeRead(async transaction => {
            const result = await transaction.run(`MATCH(sender: User{username: $sender}) - 
                                                       [r:FRIEND_REQUEST] - 
                                                       (receiver: User{username: $receiver})
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
                return res.status(400).json({message: `Already sent friend request to user ${receiver}`});
            case 2:
                n4jSesh.close();
                return res.status(400).json({message: `Already have a pending request from ${receiver}`});
        }
        
        const friendRequest = await n4jSesh.executeWrite(async transaction => {
            const result = await transaction.run(`MATCH(sender:User{username: $sender}),
                                                    (receiver:User{username: $receiver})
                                                CREATE(sender)-[r:FRIEND_REQUEST]->(receiver)
                                                RETURN true AS req`, { sender, receiver });
            return result.records[0]?.get("req") ?? false;
        });

        n4jSesh.close();

        if(!friendRequest)
            return res.status(400).json({message: "Failed to send friend request"});

        await publisher.publish(`FRIEND_REQUEST_${receiver}`, JSON.stringify({
            from: sender,
            message: `${sender} sent you a friend request`
        }));
        return res.status(200).json({message: `Friend request to user '${receiver}' successfully sent!`});

    }
    catch(error:any){
        console.log(error);
        return res.status(500).json({message:"How did this happen....", error: error.gqlStatusDescription});
    }

});

userRouter.post("/handleFriendRequest", authUser, async(req:any, res:any)=>{

    console.log("handling friend request 🧛🧛🧛");

    const {username, sender, userResponse} = req.body;
    if(isNullOrWhitespace(username) || isNullOrWhitespace(sender) 
      ||userResponse === null || userResponse === null)
        return res.status(400).json({message: "The sender and the response need to be known to handle the request"});

    try{
        const n4jSesh = n4jSession();
        
        const userExists = await n4jSesh.executeRead(async transaction => {
            const result = await transaction.run(`RETURN EXISTS{ 
                                                    MATCH(:User{username: $username})
                                                  } AS userExists, 
                                                  EXISTS{ 
                                                    MATCH(:User{username: $sender})
                                                  } AS senderExists`,
                                                 { username , sender});
            
            const ue = result.records[0]?.get("userExists");
            const se = result.records[0]?.get("senderExists");
            return [ue, se];
        });

        if(!userExists[0]){
            n4jSesh.close();
            return res.status(400).json({message: `User '${username}' doesn't exist`});
        }

        if(!userExists[1]){
            n4jSesh.close();
            return res.status(400).json({message: `User '${sender}' doesn't exist`});
        }

        const deleteRequest = await n4jSesh.executeWrite(async transaction => {
            const result = await transaction.run(`MATCH(: User{username: $username}) <- 
                                                       [r: FRIEND_REQUEST] -
                                                       (: User{username: $sender})
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
            await publisher.publish(`FRIEND_DECLINED_${sender}`, JSON.stringify({
                from: username,
                message: `${username} accepted your friend request`
            }));
            return res.status(400).json({message: `User '${username}' declined friend request from '${sender}'`});
        }

        const makeFriends = await n4jSesh.executeWrite(async transaction => {
            const result = await transaction.run(`MATCH(sender:User{username: $sender}), (user:User{username: $username})
                                                  CREATE(sender)-[:FRIEND]->(user)
                                                  RETURN true AS friends`,
                                                  {username, sender});
            return result.records[0]?.get("friends") ?? false;                                                        
        });

        n4jSesh.close();
        
        const recieverKey = RedisKeys.friendList(username);
        const senderKey = RedisKeys.friendList(sender);

        await UserService.deleteCachedFriendList(recieverKey);
        
        await UserService.deleteCachedFriendList(senderKey);
        

        if(!makeFriends)
            return res.status(400).json({message: `Failed to establish friendship between '${username}' and '${sender}'`});

        await publisher.publish(`FRIEND_ACCEPTED_${sender}`, JSON.stringify({
            from: username,
            message: `${username} accepted your friend request`
        }));
        return res.status(200).json({message: `User '${username}' accepted '${sender}'s friend request!'`});        
    }
    catch(error:any){
        return res.status(500).json({message:"How did this happen....", error: error.gqlStatusDescription});
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
        const redsiKey = RedisKeys.friendList(username);

        var cachedList = await UserService.getCachedFriendList(redsiKey);
        
        if(cachedList && cachedList.length > 0) {            
            return res.status(200).json(
            {message:`All friends of user '${username}'`, friends:cachedList});
        }
        const friends = await UserService.getFriends(username); // neo4j call
        
        await UserService.cacheFriends(redsiKey, friends);

        return res.status(200).json({message:`All friends of user '${username}'`, friends});
    } catch (error: any) {
        return res.status(400).json({message: error.message});
    }
});

userRouter.post("/removeFriend", authUser, async (req: any, res: any) => {
    const {username, friend} = req.body;

    console.log(`Removing friend '${friend}' from '${username}' 💔`);

    if (isNullOrWhitespace(username) || isNullOrWhitespace(friend)) {
        console.log("[ERROR]: Argument username or friend usenrame missing");
        return res.status(400).json({ message: "Both username and friend are required" });
    }

    try {
        const n4jSesh = n4jSession();

        const userExists = await n4jSesh.executeRead(async transaction => {
            const result = await transaction.run(`
                RETURN EXISTS { MATCH(:User {username: $username}) } AS userExists,
                EXISTS { MATCH(:User {username: $friend}) } AS friendExists
                `, {username, friend});

                const ue = result.records[0]?.get("userExists");
                const fe = result.records[0]?.get("friendExists");
                return [ue, fe];
        });

        if(!userExists[0]) {
            n4jSesh.close();
            return res.status(400).json({message: `User '${username}' does not exist`});
        }

        if(!userExists[1]) {
            n4jSesh.close();
            return res.status(400).json({message: `Friend '${friend}' does not exist`});
        }

        const deleteFriendRelation = await n4jSesh.executeWrite(async transaction => {
            const result = await transaction.run(`
                MATCH (u1:User {username: $username}) -[f:FRIEND]- (u2:User {username: $friend})
                DELETE f
                RETURN count(f) > 0 AS deleted
                `, {username,friend});

                return result.records[0]?.get("deleted") ?? false;
        });

        n4jSesh.close();

        if(!deleteFriendRelation) {
            return res.status(400).json({message: `No friendship found between '${username}' and '${friend}'`}); 
        }

        const userCacheKey = RedisKeys.friendList(username);
        const friendCacheKey = RedisKeys.friendList(friend); 

        await UserService.deleteCachedFriendList(userCacheKey);
        await UserService.deleteCachedFriendList(friendCacheKey);

        await publisher.publish(`FRIEND_REMOVED_${friend}`, JSON.stringify({
            from: username,
            message: `${username} removed you from friends`
        }));
        return res.status(200).json({message: `Successfully removed '${friend}' from '${username}' friend list`});
    }
    catch (error:any) {
        console.log(`[ERROR]: Something very wrong happened....:${error.message}`)
        return res.status(500).json({message: "How did this happen...", error: error.gqlStatusDescription});
    }
});

userRouter.post("/sendInvite", authUser, async (req:any, res:any) => {
    const { sender, receiver, gameId} = req.body;

    if(isNullOrWhitespace(sender) || isNullOrWhitespace(receiver))
        return res.status(400).json({message: "Missing required parameters: username or friendUsername or gameId"});

    try {
        await redisClient.hSet(`${IdPrefixes.INVITE}_${receiver}`, sender, gameId); //add to requests

        await publisher.publish(`${IdPrefixes.INVITE}_${receiver}`, JSON.stringify({
            from: sender,
            to:receiver,    
            gameId:gameId,
            message: `${sender} invited you to game`
        }));
        return res.status(200).json({message: `Successfully sent invite to '${receiver}' from '${sender}'`});
    }
    catch(err:any) {
        console.log("[ERROR]: ", err.gqlStatusDescription);
        return res.status(500).json({message: "How did this happen...", error: err.gqlStatusDescription})
    }
});

userRouter.post("/getInvites", authUser, async (req:any, res:any) => {
    const {username} = req.body;

    if(isNullOrWhitespace(username))
        return res.status(400).json({message:"Missing username arugment"});

    try {
        const invites = await redisClient.hGetAll(`${IdPrefixes.INVITE}_${username}`);

        if(!invites)
            return res.status(404).json({message:"No invites found"});

        return res.status(200).json({message:"Found invites", invites:invites});
    }
    catch(err:any) {
        console.log(`[ERROR]: Something very wrong happened....:${err.message}`)        
    }
});

// Get player achievements
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

// Get player stats
userRouter.post("/getPlayerStats", authUser, async (req: any, res: any) => {
    const { username } = req.body;
    
    if (isNullOrWhitespace(username)) {
        return res.status(400).json({ message: "Username required" });
    }
    
    try {
        const playerAchievementsKey = RedisKeys.playerStats(username);
        
        let stats;
        
        stats = await redisClient.get(playerAchievementsKey);
        
        if (stats === null) {

            stats = await getPlayerStats(username);
            
            // Cache the result
            await redisClient.set(playerAchievementsKey, JSON.stringify(stats));
            await redisClient.expire(
                playerAchievementsKey,
                CACHE_DURATION[CacheTypes.GENERIC_CACHE]
            );
            //console.log("stats", stats)
            // stats is already an object here
            return res.status(200).json({ stats });
        } 
        else 
            return res.status(200).json({ stats: JSON.parse(stats) });
        
    } catch (error) {
        return res.status(500).json({ message: "Failed to fetch player stats" });
    }
});

// Get friends with their achievements
userRouter.post("/getFriendsWithAchievements", authUser, async (req: any, res: any) => {
    const { username } = req.body;
    
    if (isNullOrWhitespace(username)) {
        return res.status(400).json({ message: "Username required" });
    }
    
    try {
        const friends = await getFriendsWithAchievements(username);
        return res.status(200).json({ friends });
    } catch (error) {
        return res.status(500).json({ message: "Failed to fetch friends data" });
    }
});

// Add to userRouter.ts
userRouter.post("/searchUsers", authUser, async (req: any, res: any) => {
    const { query, currentUser } = req.body;
    
    if (isNullOrWhitespace(query)) {
        return res.status(400).json({ message: "Search query required" });
    }
    
    try {
        const n4jSesh = n4jSession();
        
        // Search for users matching the query
        const result = await n4jSesh.executeRead(async transaction => {
            return await transaction.run(`
                MATCH (u:User)
                WHERE u.username CONTAINS $query AND u.username <> $currentUser
                OPTIONAL MATCH (current:User {username: $currentUser})-[:FRIEND]-(u)
                OPTIONAL MATCH (current)-[:FRIEND_REQUEST]->(u)
                OPTIONAL MATCH (u)-[:FRIEND_REQUEST]->(current)
                RETURN DISTINCT u.username as username,
                       EXISTS((current)-[:FRIEND]-(u)) as isFriend,
                       EXISTS((current)-[:FRIEND_REQUEST]->(u)) as requestSent,
                       EXISTS((u)-[:FRIEND_REQUEST]->(current)) as requestReceived
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

userRouter.post("/sendMessage", async (req:any, res:any) => {
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

userRouter.post("/getMessages", async (req:any, res:any) => {
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

const isInvalid = (value:any) => {
    return !value || typeof value !== 'string' || value.trim() === '';
}

const areInvalidMessagePair = (sender:any, receiver:any) => {
    return isInvalid(sender) || isInvalid(receiver) || sender === receiver;
}


userRouter.get("/getAllAchievementsWithStats", async (req: any, res: any) => {
  try {
    // Check cache first
    const cacheKey = RedisKeys.globalAchievementStats(); // You'll need to add this to RedisKeys
    const cached = await redisClient.get(cacheKey);
    
    if (cached) {
      return res.status(200).json({ stats: JSON.parse(cached) });
    }

    // Get from Neo4j
    const stats = await getAllAchievementsWithStats();
    
    // Cache for 5 minutes (stats don't change that often)
    await redisClient.set(cacheKey, JSON.stringify(stats));
    await redisClient.expire(cacheKey, 300); // 5 minutes
    
    return res.status(200).json({ stats });
  } catch (error: any) {
    console.error('[ERROR]: Failed to fetch global stats', error);
    return res.status(500).json({ message: "Failed to fetch global stats" });
  }
});

export default userRouter;