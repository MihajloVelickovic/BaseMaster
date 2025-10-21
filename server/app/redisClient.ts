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
    await publisher.connect();
    await subscriber.connect();
  }
  catch (err:any) {

  }
})();

export  {redisClient, publisher, subscriber};