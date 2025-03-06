// // import express from "express";
// import { createClient } from 'redis';       //i ovo je dodato
// // const app = express();

// // app.use(express.json());



// //nova stvar..
import express from "express";
import { SERVER_PORT } from "./config/config";
import gameRouter from './routers/gameRouter'

const app = express();
app.use(express.json());

app.use("/game", gameRouter);

app.listen(SERVER_PORT, async () => {
    console.log(`Server running on port ${SERVER_PORT}`);
});

// redisClient.connect().then(() => {
//         console.log('Connected to Redis');

//         // Start the Express server after Redis is connected
        
//     })
//     .catch((err) => {
//         console.error('Failed to connect to Redis:', err.message);
//     });




