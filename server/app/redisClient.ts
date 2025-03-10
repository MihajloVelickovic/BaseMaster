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

const pubSubClient = redisClient.duplicate();

(async () => {
  await redisClient.connect();
  await pubSubClient.connect();
})();

export  {redisClient, pubSubClient };