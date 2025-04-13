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
        n4jDriver = n4j.driver(client.uri, n4j.auth.basic(client.username, client.password));
        return "Successfully connected to Neo4J database";
    }
    catch(err){
        return `Couldn't connect to Neo4J database, ${err}`;
    }
})();

const n4jSession = () => {
    return n4jDriver.session({database: "neo4j"});
}

export {n4jDriver, n4jSession, connectionSuccess};