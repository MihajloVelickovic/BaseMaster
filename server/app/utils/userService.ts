import { n4jSession } from "../neo4jClient";

export async function getFriends(username: string): Promise<string[]> {
    const n4jSesh = n4jSession();

    const userExists = await n4jSesh.executeRead(async transaction => {
        const result = await transaction.run(`RETURN EXISTS{ 
                                                MATCH(:User{username: $username})
                                              } AS userExists`,
                                             { username });
        return result.records[0]?.get("userExists");
    });

    if (!userExists) {
        n4jSesh.close();
        throw new Error(`User '${username}' does not exist`);
    }

    const friends = await n4jSesh.executeRead(async transaction => {
        const result = await transaction.run(`MATCH(u:User{username: $username})  
                                               OPTIONAL MATCH (u) - 
                                                              [r:FRIEND] - 
                                                              (n:User) 
                                               RETURN collect(n.username) as friends`,
                                              { username });
        return result.records[0]?.get("friends") ?? [];
    });

    n4jSesh.close();
    return friends;
}
