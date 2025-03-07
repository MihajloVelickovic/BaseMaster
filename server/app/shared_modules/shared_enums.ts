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

export const fromString = (value: string): Difficulties | undefined => {
    return (Object.values(Difficulties) as string[]).includes(value) ? (value as Difficulties) : undefined;
};