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
    GAME_END = "ge"
}

export enum BaseValues {
    MIN_BASE = 2,
    MAX_BASE = 32
}

export const fromStringDiff = (value: string): Difficulties | undefined => {
    return (Object.values(Difficulties) as string[]).includes(value) ? (value as Difficulties) : undefined;
};

export const fromStringGM = (value: string): GameModes | undefined => {
    return (Object.values(GameModes) as string[]).includes(value) ? (value as GameModes) : undefined;
};