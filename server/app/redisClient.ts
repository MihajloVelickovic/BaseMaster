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

redisClient.connect()
  .then(() => console.log('Redis client connected successfully'))
  .catch((err) => console.error('Error connecting to Redis:', err));

export default redisClient;