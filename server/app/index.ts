// // import express from "express";
// import { createClient } from 'redis';       //i ovo je dodato
// // const app = express();

// // app.use(express.json());



// //nova stvar..
import redisClient from "./redisClient";
import express from "express";
import { SERVER_PORT } from "./config/config";
import gameRouter from './routers/gameRouter'
import cors from "cors";
import {WebSocketServer} from "ws"
import http from "http";

const CLIENTS = new Map(); // Maps WebSocket clients to lobbies

const corsOptions = {
    origin: 'http://localhost:3000',
    optionsSuccessStatus: 200,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"]
};

const app = express();
app.use(express.json());
app.use(cors(corsOptions));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use("/game", gameRouter);


app.listen(SERVER_PORT, async () => {
    console.log(`Server running on port ${SERVER_PORT}`);
});


// const r3 = await redisClient.keys('*');
// console.log("Writing out everything currently in the database ;3");
// r3.forEach(async (x) => {
//     //console.log(await redisClient.get(x));
//     console.log(x);
// })

// redisClient.connect().then(() => {
//         console.log('Connected to Redis');

//         // Start the Express server after Redis is connected
        
//     })
//     .catch((err) => {
//         console.error('Failed to connect to Redis:', err.message);
//     });




