export type LeaderboardEntry = {
  username: string;
  bestScore: number;
  totalGames: number;
  totalScore: number;  // Added this
  averageScore: number;
  rank: number;
  firsts: number;
  seconds: number;
  thirds: number;
  fourths: number;
};