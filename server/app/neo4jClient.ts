import n4j, { Driver } from "neo4j-driver"
import { NEO4J_URI, NEO4J_USERNAME, NEO4J_PASSWORD } from "./config/config";

// sin string ili cerka undefined
const client = {
    uri:  NEO4J_URI ?? "",
    username: NEO4J_USERNAME ?? "",
    password: NEO4J_PASSWORD ?? ""
};

let n4jDriver: Driver;

const connectionSuccess = await (async () => {
    try{
        console.log(client.uri + ' ' + client.username + ' ' + client.password);
        n4jDriver = n4j.driver(
            client.uri,
            n4j.auth.basic(client.username, client.password),
            { disableLosslessIntegers: true }  // ← this makes integers come back as JS numbers
            );
        await n4jDriver.getServerInfo();
        return "[SYSTEM]: Successfully connected to Neo4J database";
    }
    catch(err){
        return `[ERROR]: Couldn't connect to Neo4J database, ${err}`;
    }
})();

const n4jSession = () => {
    return n4jDriver.session({database: NEO4J_USERNAME});
}

export {n4jDriver, n4jSession, connectionSuccess};

