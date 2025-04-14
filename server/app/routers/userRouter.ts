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

        let query = await n4jSesh.executeRead(transaction => {
            const result = transaction.run(`MATCH(n:User{email: $email}) 
                                            RETURN n IS NOT NULL AS alreadyExists`, {email})
                                      .then(result => {
                const resultBody = result.records[0]?.get("alreadyExists") ?? false;
                return resultBody;
            });
            return result;
        });

        if(query)
            return res.status(400).json({message: "User with this email already exists"});

        query = await n4jSesh.executeRead(transaction => {
            const result = transaction.run(`MATCH(n:User{username: $username}) 
                                            RETURN n IS NOT NULL AS alreadyExists`, 
                                            {username})
                                      .then(result => {
                            const resultBody = result.records[0]?.get("alreadyExists") ?? false;
                            return resultBody;
                        });
            return result;
        });

        if(query)
            return res.status(400).json({message: "Username already taken"});

        const register = await n4jSesh.executeWrite(transaction => {

            const result = transaction.run(`CREATE(n:User{email: $email, username: $username, password: $password})
                                            RETURN true AS success`, 
                                            {username, email, password})
                                    .then(result => {
                            const resultBody = result.records[0]?.get("success") ?? false;
                            return resultBody;})
                                    .catch(err => err);
            return result;
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

        let user = await n4jSesh.executeRead(transaction => {
            const result = transaction.run(`MATCH(n:User)
                                            WHERE n.username = $emailOrUsername OR n.email = $emailOrUsername
                                            RETURN {username: n.username, password: n.password} AS user`, {emailOrUsername})
                                    .then(result => {
                            const resultBody = result.records[0]?.get("user") ?? false;
                            return resultBody;
            });
            return result;
        });

        if(!user)
            return res.status(400).json({message: `User '${emailOrUsername}' does not exist`});

        if(password != user.password)
            return res.status(400).json({message: "Incorrect password"});

        //TODO JWT

        n4jSesh.close();

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

    const n4jSesh = n4jSession();

    const userExists = await n4jSesh.executeRead(transaction => {
        return transaction.run(`RETURN EXISTS{ 
                                    MATCH(:User{username: $username})
                                } AS userExists`, 
                                {username})
                          .then(result => {
                            return result.records[0]?.get("userExists");
                        });
    });

    if(!userExists)
        return res.status(400).json({message: "Request made for non-existing user"});

    const friendRequests = await n4jSesh.executeRead(transaction => {
        return transaction.run(`MATCH(:User{username: $username}) <-
                                     [:FRIEND_REQUEST] -
                                     (senders: User)
                                RETURN collect(senders) AS pending`, 
                                {username})
                          .then(result => {
                            return result.records[0]?.get("pending").map(f => f.properties.username);    
                        });
    });

    n4jSesh.close();

    return res.status(200).json({message: `Gathered pending requests for user '${username}'`, data: friendRequests});


});

userRouter.post("/sendFriendRequest", async(req:any, res:any)=>{


    console.log("woo friends 👋👋👋");

    const {sender, receiver} = req.body;

    if(!sender || !receiver)
        return res.status(400).json({message: "Both fields necessary"});

    if(sender === receiver)
        return res.status(400).json({message: "Can't add yourself silly"});

    const n4jSesh = n4jSession();

    const requestExists = await n4jSesh.executeRead(transaction => {
        return transaction.run(`MATCH(sender: User{username: $sender}) - 
                                     [r:FRIEND_REQUEST] - 
                                     (receiver: User{username: $receiver})
                                RETURN 
                                CASE startNode(r) 
                                WHEN sender THEN 1
                                ELSE 2
                                END AS req`, {sender, receiver})
                          .then(result => {
            return result.records[0]?.get("req").toNumber() ?? 0;
        });
    });

   switch(requestExists){
    case 0:
        break;
    case 1:
        return res.status(400).json({message: `Already sent friend request to user ${receiver}`});
    case 2:
        return res.status(400).json({message: `Already have a pending request from ${receiver}`});
   }

    if(requestExists)
        return res.status(400).json({message: `Already sent friend request to user ${receiver}`});

    const friendRequest = await n4jSesh.executeWrite(transaction => {
        return transaction.run(`MATCH(sender:User{username: $sender}),
                                     (receiver:User{username: $receiver})
                                CREATE(sender)-[r:FRIEND_REQUEST]->(receiver)
                                RETURN(r) AS req`, {sender, receiver})
                          .then(result => {
                            return result.records[0]?.get("req") ? true : false;
                          });
    });

    n4jSesh.close();

    if(!friendRequest)
        return res.status(400).json({message: "Failed to send friend request"});

    return res.status(200).json({message: `Friend request to user '${receiver}' successfully sent!`});

});

userRouter.post("/handleFriendRequest", async(req:any, res:any)=>{

    // obrisati FRIEND_REQUEST poteg
    // ako se primi sa klijenta accept dodati bidirekcionu FRIENDS vezu
    // ako se primi sa klijenta decline ne raditi nista

});

export default userRouter;