import dotnev from "dotenv";
import path from "path";

const env_file_path = process.platform.startsWith("win") ? 
                      path.resolve(__dirname, "../../../config.env") :
                      path.resolve(__dirname, "../../../.env");

dotnev.config({path: env_file_path});