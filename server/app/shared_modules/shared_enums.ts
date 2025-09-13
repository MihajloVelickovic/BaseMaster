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

export enum DifficultyValues {
    LAYMAN=64,
    CHILL_GUY=256,
    ELFAK_ENJOYER=512,
    BASED_MASTER=2048,
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
    MESSAGE = "msg",
    INVITE = "INVITE",
    FRIEND_LIST = "FRIEND_LIST"
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

export enum NumericalConstants {
    CACHE_EXP_TIME = 300
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

export function maxValueFromDifficulty(diff:Difficulties | undefined) {
    var maxValue:number;
    switch(diff) {
        case Difficulties.LAYMAN:
            maxValue = DifficultyValues.LAYMAN;
            break;
        case Difficulties.CHILL_GUY:
            maxValue = DifficultyValues.CHILL_GUY;
            break;
        case Difficulties.ELFAK_ENJOYER:
            maxValue = DifficultyValues.ELFAK_ENJOYER;
            break;
        case Difficulties.BASED_MASTER:
            maxValue = DifficultyValues.BASED_MASTER;
            break;
        default:
            maxValue=-1;
    }
    return maxValue;
}