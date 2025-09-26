import { createClient } from 'redis';
import {REDIS_HOST, REDIS_PASSWORD, REDIS_PORT} from "./config/config.ts"

const redisClient = createClient({
  username: 'default',
  password: REDIS_PASSWORD,
  socket: {
    host: REDIS_HOST,
    port: Number(REDIS_PORT)
  }
});

const publisher = createClient({
  username: 'default',
  password: REDIS_PASSWORD,
  socket: {
    host: REDIS_HOST,
    port: Number(REDIS_PORT)
  }
});

const subscriber = createClient({
  username: 'default',
  password: REDIS_PASSWORD,
  socket: {
    host: REDIS_HOST,
    port: Number(REDIS_PORT)
  }
});

(async () => {
  try {
    await redisClient.connect();
    console.log('[SYSTEM]: Successfully stared redis client');
    await publisher.connect();
    console.log('[SYSTEM]: Successfully stared redis publisher client');
    await subscriber.connect();
    console.log('[SYSTEM]: Successfully stared redis subscriber client');
  } 
  catch (err:any) {
    console.error('[ERROR]Error connecting to Redis:', err);
  
  }
})();

export  {redisClient, publisher, subscriber};