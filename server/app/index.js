// // import express from "express";
// import { createClient } from 'redis';       //i ovo je dodato
// // const app = express();

// // app.use(express.json());



// //nova stvar..

import { createClient } from 'redis';
import {REDIS_HOST, REDIS_PASSWORD, REDIS_PORT} from './config/config.js';

const client = createClient({
    username: 'default',
    password: REDIS_PASSWORD,
    socket: {
        host: REDIS_HOST,
        port: REDIS_PORT
    }
});

client.on('error', err => console.log('Redis Client Error', err));

await client.connect();

await client.set('foo', 'bar');
const result = await client.get('foo');
const r3 = await client.keys('*');
const result2 = await client.get('Programer01');
console.log("Writing out everything currently in the database ;3");
r3.forEach(async (x) => {
    console.log(await client.get(x));
})




