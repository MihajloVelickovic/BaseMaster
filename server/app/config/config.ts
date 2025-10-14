import dotenv from "dotenv";
import path from "path";
import jwt, { JwtPayload } from "jsonwebtoken";
import {jwtDecode} from "jwt-decode";
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
export const JWT_SECRET: string = process.env.JWT_SECRET ?? "";
export const JWT_REFRESH: string = process.env.JWT_REFRESH ?? "";

export function authUser(req: any, res: any, next: any){
    const authFromReq = req.headers["authorization"];
    const token = authFromReq && authFromReq.split(' ')[1];
    
    if(!token)
        return res.status(401).json({message:"Unauthorized"});
   
    jwt.verify(token, JWT_SECRET, (error:any, user:any) => {
        if(error) {
            if(error.name === 'TokenExpiredError') {
                return res.status(403).json({message:"Token expired"});
            }
            return res.status(403).json({message:`${error.message}`});
        }
       
        req.user = user;
        next();
    });
}