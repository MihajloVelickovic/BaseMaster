import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Create __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envFilePath = process.platform.startsWith("win") ?
                    path.join(__dirname, "../config.env") : 
                    path.join(__dirname, "../.env");

dotenv.config({ path: envFilePath });

export const SERVER_PORT = Number(process.env.SERVER_PORT);
export const REDIS_PASSWORD = process.env.REDIS_PASSWORD;
export const REDIS_HOST = process.env.REDIS_HOST;
export const REDIS_PORT = Number(process.env.REDIS_PORT);
export const NEO4J_URI = process.env.NEO4J_URI;
export const NEO4J_USERNAME = process.env.NEO4J_USERNAME;
export const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD;