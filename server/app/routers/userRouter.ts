import { Router } from "express";
import { redisClient } from "../redisClient";
import { IdPrefixes } from "../shared_modules/shared_enums";
import { nanoid } from 'nanoid';

const userRouter = Router();


userRouter.post("/register", async (req:any, res:any) => {
    const {
        email,
        username,
        password
    } = req.body;

    if(!email || !username || ! password)
        return res.status(400).send({message: "Did not recieve all parameters"});

    const emailStatus = await redisClient.sAdd(IdPrefixes.USER_EMAILS, email);

    if(emailStatus === 0) //Check if email is already used
        return res.status(400).send({message: `User with email already exists`,
                                     email:email});
    
    const fullUsername = `${username}_${nanoid()}`;

    const usernameExists = 
    await redisClient.sIsMember(IdPrefixes.USERNAMES, fullUsername);

    if(usernameExists)
        return res.status(500).send({message: "User with same full username exists"});

    try {
        // this is used for fast checking if username or email already exist
        await redisClient.hSet(IdPrefixes.USER_EMAILS, email, fullUsername); //add email to all emails
        await redisClient.sAdd(IdPrefixes.USERNAMES, fullUsername); // add username to usernames

        await redisClient.set(fullUsername, password);

        return res.status(200).send({message: "Added user succesfuly", username:fullUsername});
    }
    catch(err:any) {
        return res.status(400).send({message: "Failed to create user", reason:err.message});
    }
    

});

userRouter.post("/login", async (req:any, res:any) => {
    const {
        email,
        password
    } = req.body;

    if(!email || !password)
        return res.status(400).send({message: "Did not recieve all parameters"});

    try {
        const fullUsername = await redisClient.hGet(IdPrefixes.USER_EMAILS, email);

        if(!fullUsername)
            return res.status(404).send({message: `Wrong email or password`});

        const realPassword = await redisClient.get(fullUsername);

        if(!realPassword)
            return res.status(500).send({message: `Fatal error`});

        if(realPassword === password)
            return res.send({message: "Succesful login", fullUsername:fullUsername});
        else
            return res.status(400).send({message: `Wrong email or password`});
    }
    catch(err:any) {
        return res.status(500).send({message: "Whoopsie this should not have happened",
                                     reason:err.message});
    }
});

export default userRouter;