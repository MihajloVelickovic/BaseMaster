export interface LeaderboardEntry {
    username: string;
    bestScore: number;
    totalGames: number;
    totalScore: number;
    averageScore: number;
    rank: number;
    firsts: number;
    seconds: number;
    thirds: number;
    fourths: number;
    lastPlayed?: any;
}