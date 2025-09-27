export enum GameModes {
    CLASSIC = "Classic",
    REVERSE = "Reverse",
    CHAOS = "Chaos"
}

export enum Difficulties {
    LAYMAN = "Layman",
    CHILL_GUY = "Chill guy",
    ELFAK_ENJOYER = "Elfak enjoyer",
    BASED_MASTER = "Based master"
}


export enum IdPrefixes {
    RANDOM_NUMBERS = "rn",
    PLAYER_POINTS = "pp",
    ORDER_POINTS = "op",
    FROM_BASE = "fb",
    TO_BASE = "tb",
    GAME_END = "ge",
    GAME_STARTED = "GAME STARTED",
    LOBBIES_CURR_PLAYERS = "LOBBIES_CURR",
    LOBBIES_MAX_PLAYERS = "LOBBIES_MAX",
    LOBBIES_NAMES = "LOBBIES_NAMES",
    ALL_PLAYERS_COMPLETE = "ALL_PLAYERS_COMPLETE",
    SCOREBOARD_UPDATE = "SCOREBOARD_UPDATE",
    MESSAGE_UPDATE = "MESSAGE_UPDATE",
    USER_EMAILS = "USER_EMAILS",
    USERNAMES = "USERNAMES",
    PLAYER_JOIN = "PLAYER_JOIN",
    PlAYER_LEAVE = "PLAYER_LEAVE",
    LOBBY_PLAYERS = "lp",
    ONLINE_PLAYERS = "onp",
    PLAYER_STATS = "stats",
    MESSAGE = "msg",
    INVITE = "INVITE",
    FRIEND_LIST = "FRIEND_LIST",
    FRIEND_MESSAGES = "inbox",
    ROUND_COUNT = "rn"
}

export enum WebServerTypes {
    JOIN_LOBBY = "joinlobby",
    LOGIN = "login",    
}

export enum BaseValues {
    MIN_BASE = 2,
    MAX_BASE = 32
}

export enum GameStates {
    LOBBY = "Lobby",
    STARTED = "Started"
}

export enum CacheTypes {
    GENERIC_CACHE = "GENERIC_CACHE",
    DISSAPEARING_MESSAGE = "DISSAPEARING_MESSAGE",
    LOBBY_CONTEXT = "LOBBY_CONTEXT"
}
// If only commits could write themselves... oh wait, they can’t.  

export const fromStringState = (value: string): GameStates | undefined => {
    return (Object.values(GameStates) as string[]).includes(value) 
            ? (value as GameStates) : undefined;
};

export const fromStringDiff = (value: string): Difficulties | undefined => {
    return (Object.values(Difficulties) as string[]).includes(value) ? (value as Difficulties) : undefined;
};

export const fromStringGM = (value: string): GameModes | undefined => {
    return (Object.values(GameModes) as string[]).includes(value) ? (value as GameModes) : undefined;
};

export const getGamemode = (input: string): GameModes | undefined => {
    const value = input.split("_")[0];
    return (Object.values(GameModes) as string[]).includes(value) ? (value as GameModes) : undefined;
};

