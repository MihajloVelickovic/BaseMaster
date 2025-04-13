import { Router } from "express";
import { redisClient } from "../redisClient";
import { IdPrefixes } from "../shared_modules/shared_enums";
import { nanoid } from 'nanoid';

import { n4jSession } from "../neo4jClient";


const userRouter = Router();


userRouter.post("/register", async(req: any, res: any) => {

    console.log("someone is registering 🤫🤫🤫");
    const {email, username, password, confirmPassword} = req.body;

    if(!email || !username || !password || !confirmPassword)
        return res.status(400).json({message: "All fields necessary"});

    if(password !== confirmPassword)
        return res.status(400).json({message: "Passwords do not match"});

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

    return register ?
    res.status(200).json({message: `User '${username}' successfully created!`}):
    res.status(400).json({message: `Failed to create user "${username}"\n${register}`});

});


// userRouter.post("/register", async (req:any, res:any) => {
//     console.log("Entering register route");
//     const {
//         email,
//         username,
//         password
//     } = req.body;

//     if(!email || !username || ! password)
//         return res.status(400).send({message: "Did not recieve all parameters"});

//     console.log("email, username, password", email, username, password, "if only we had neo4j");

//     const emailStatus = await redisClient.hExists(IdPrefixes.USER_EMAILS, email);
//     console.log("Email unique check");
//     if(emailStatus) //Check if email is already used
//         return res.status(400).send({message: `User with email already exists`,
//                                      email:email});
    
//     const fullUsername = `${username}_${nanoid()}`;
//     console.log("username", fullUsername);
//     //Erm what the sigma why is this not neo4j who could have forgotten to
//     // chane it from REDIS ?????? I wonder....
//     const usernameExists = 
//     await redisClient.sIsMember(IdPrefixes.USERNAMES, fullUsername);
//     console.log("Username exsists:",usernameExists);
//     if(usernameExists)
//         return res.status(500).send({message: "User with same full username exists"});

//     try {
//         // this is used for fast checking if username or email already exist
//         console.log(await redisClient.hGetAll(IdPrefixes.USER_EMAILS));
//         console.log("adding email");
//         await redisClient.hSet(IdPrefixes.USER_EMAILS, email, fullUsername); //add email to all emails
//         console.log("added email");
//         await redisClient.sAdd(IdPrefixes.USERNAMES, fullUsername); // add username to usernames

//         await redisClient.set(fullUsername, password);

//         return res.status(200).send({message: "Added user succesfuly", fullUsername:fullUsername});
//     }
//     catch(err:any) {
//         return res.status(400).send({message: "Failed to create user", reason:err.message});
//     }
    

// });
// //chat is this real we still don't have neo4j
// userRouter.post("/login", async (req:any, res:any) => {
//     const {
//         email,
//         password
//     } = req.body;

//     if(!email || !password)
//         return res.status(400).send({message: "Did not recieve all parameters"});

//     try {
//         const fullUsername = await redisClient.hGet(IdPrefixes.USER_EMAILS, email);
//         //man this works nice, but you know what would worl even better
//         if(!fullUsername)
//             return res.status(400).send({message: `Wrong email or password`});
//         //IF THIS WAS NEO4J
//         const realPassword = await redisClient.get(fullUsername); 
//         //(Certain someone is one who is not me, nor KingLaza or Jana108)
//         if(!realPassword)
//             return res.status(500).send({message: `Fatal error`});
        
//         if(realPassword === password)
//             return res.send({message: "Succesful login", fullUsername:fullUsername});
//         else
//             return res.status(400).send({message: `Wrong email or password`});
//     }
//     catch(err:any) {
//         return res.status(500).send({message: "Whoopsie this should not have happened",
//                                      reason:err.message});
//     }
// });

export default userRouter;