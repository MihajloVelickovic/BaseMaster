import n4j, { Driver } from "neo4j-driver"
import { NEO4J_URI, NEO4J_USERNAME, NEO4J_PASSWORD } from "./config/config";

// sin string ili cerka undefined
const client = {
    uri:  NEO4J_URI ?? "",
    username: NEO4J_USERNAME ?? "",
    password: NEO4J_PASSWORD ?? ""
};

let n4jDriver: Driver | null = null;

/**
 * Initialize and verify Neo4j connection
 * Throws error if connection fails
 */
async function initializeNeo4j(): Promise<void> {
    try {

        n4jDriver = n4j.driver(
            client.uri,
            n4j.auth.basic(client.username, client.password),
            { disableLosslessIntegers: true }  // ← this makes integers come back as JS numbers
        );

        // Verify connection by getting server info
        await n4jDriver.getServerInfo();
    }
    catch (err) {
        throw new Error(`Neo4j connection failed: ${err}`);
    }
}

const n4jSession = () => {
    if (!n4jDriver) {
        throw new Error("Neo4j driver not initialized. Call initializeNeo4j() first.");
    }
    return n4jDriver.session({database: NEO4J_USERNAME});
}

export { n4jDriver, n4jSession, initializeNeo4j };

