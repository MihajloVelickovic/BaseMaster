import { Router } from "express";
import { n4jSession } from "../neo4jClient";
import { Transaction } from "neo4j-driver";

const userRouter = Router();

userRouter.post("/register", async(req: any, res: any) => {

    console.log("someone is registering 🤫🤫🤫");
    const {email, username, password} = req.body;

    if(!email || !username || !password)
        return res.status(400).json({message: "All fields necessary"});

    try{
        const n4jSesh = n4jSession();

        let query = await n4jSesh.executeRead(async transaction => {
            const result = await transaction.run(`RETURN EXISTS{
                                                  MATCH(n:User{email: $email})
                                                  } AS alreadyExists`, 
                                                  { email });
            return result.records[0]?.get("alreadyExists") ?? false;
        });

        if(query){
            n4jSesh.close();
            return res.status(400).json({message: "User with this email already exists"});
        }

        query = await n4jSesh.executeRead(async transaction => {
            const result = await transaction.run(`RETURN EXISTS{
                                                    MATCH(n:User{username: $username}) 
                                                  } AS alreadyExists`,
                                                 { username });
            return result.records[0]?.get("alreadyExists") ?? false;
        });

        if(query){
            n4jSesh.close();
            return res.status(400).json({message: "Username already taken"});
        }

        const register = await n4jSesh.executeWrite(async transaction => {
            const result = await transaction.run(`CREATE(n:User{email: $email, username: $username, password: $password})
                                                  RETURN true AS success`,
                                                 { username, email, password });
            return result.records[0]?.get("success") ?? false;
        });

        //TODO email potvrda

        n4jSesh.close();

        return register ?
        res.status(200).json({message: `User '${username}' successfully created!`}):
        res.status(400).json({message: `Failed to create user "${username}"\n${register}`});
    }
    catch(error){
        return res.status(500).json({message:"How did this happen....", error: error});
    }
    
        
});

userRouter.post("/login", async(req: any, res: any) => {

    console.log("someone is signing in 🕺🕺🕺");

    const {emailOrUsername, password} = req.body;

    try{
        const n4jSesh = n4jSession();

        let user = await n4jSesh.executeRead(async transaction => {
            const result = await transaction.run(`RETURN EXISTS{
                                                    MATCH(n:User)
                                                    WHERE n.username = $emailOrUsername OR 
                                                          n.email = $emailOrUsername
                                                  } AS user`, 
                                                 { emailOrUsername });
            return result.records[0]?.get("user") ?? false;
        });

        n4jSesh.close();
    
        if(!user)
            return res.status(400).json({message: `User '${emailOrUsername}' does not exist`});

        if(password != user.password)
            return res.status(400).json({message: "Incorrect password"});

        //TODO JWT

        return res.status(200).json({message: "Success", user: user});
    }
    catch(error){
        return res.status(500).json({message:"How did this happen....", error: error});
    }

});

userRouter.get("/friendRequests", async(req: any, res: any) => {

    console.log("na prste ruke prebroj prijatelje ☝️ ✌️ 🖐️");

    const {username} = req.body;

    if(!username)
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
            return result.records[0]?.get("pending").map(f => f.properties.username);
        });

        n4jSesh.close();

        return res.status(200).json({message: `Gathered pending requests for user '${username}'`, data: friendRequests});
    }
    catch(error){
        return res.status(500).json({message:"How did this happen....", error: error});
    }

});

userRouter.post("/sendFriendRequest", async(req:any, res:any)=>{

    console.log("woo friends 👋👋👋");

    const {sender, receiver} = req.body;

    if(!sender || !receiver)
        return res.status(400).json({message: "Both fields necessary"});

    if(sender === receiver)
        return res.status(400).json({message: "Can't add yourself silly"});

    try{
        const n4jSesh = n4jSession();

        const senderExists = await n4jSesh.executeRead(async transaction => {
            const result = await transaction.run(`RETURN EXISTS{ 
                                                    MATCH(:User{username: $sender})
                                                  } AS userExists`,
                                                 { sender });
            return result.records[0]?.get("userExists");
        });

        if(!senderExists){
            n4jSesh.close();
            return res.status(400).json({message: `User '${sender}' doesn't exist`});
        }

        const receiverExists = await n4jSesh.executeRead(async transaction => {
            const result = await transaction.run(`RETURN EXISTS{ 
                                                    MATCH(:User{username: $receiver})
                                                  } AS userExists`,
                                                 { receiver });
            return result.records[0]?.get("userExists");
        });

        if(!receiverExists){
            n4jSesh.close();
            return res.status(400).json({message: `User '${receiver}' doesn't exist`});
        }

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
            return result.records[0]?.get("req").toNumber() ?? 0;
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

        return res.status(200).json({message: `Friend request to user '${receiver}' successfully sent!`});

    }
    catch(error){
        return res.status(500).json({message:"How did this happen....", error: error});
    }

});

userRouter.post("/handleFriendRequest", async(req:any, res:any)=>{

    console.log("handling friend request 🧛🧛🧛");

    const {username, sender, userResponse} = req.body;
    if(!username || !sender || userResponse === undefined || userResponse === null)
        return res.status(400).json({message: "The sender and the response need to be known to handle the request"});

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
            return res.status(400).json({message: `User '${username}' doesn't exist`});
        }

        const senderExists = await n4jSesh.executeRead(async transaction => {
            const result = await transaction.run(`RETURN EXISTS{ 
                                                    MATCH(:User{username: $sender})
                                                  } AS userExists`,
                                                 { sender });
            return result.records[0]?.get("userExists");
        });

        if(!senderExists){
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
            return res.status(400).json({message: `User '${username}' declined friend request from '${sender}'`});
        }

        const makeFriends = await n4jSesh.executeWrite(async transaction => {
            const result = await transaction.run(`CREATE(:User{username: $sender}) -
                                                        [:FRIEND] ->
                                                        (:User{username: $username})
                                                  RETURN true AS friends`,
                                                  {username, sender});
            return result.records[0]?.get("friends") ?? false;                                                        
        });

        n4jSesh.close();

        if(!makeFriends)
            return res.status(400).json({message: `Failed to establish friendship between '${username}' and '${sender}'`});

        return res.status(200).json({message: `User '${username}' accepted '${sender}'s friend request!'`});
        
    }
    catch(error){
        return res.status(500).json({message:"How did this happen....", error: error});
    }

});

export default userRouter;