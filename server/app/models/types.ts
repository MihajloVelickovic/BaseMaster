export type ScoreboardEntry = {
  score: number;
  value: string; // playerId
};

export type GameResultRow = {
  username: string;
  score: number;
  placement: 1 | 2 | 3 | 4;
};

export type PlayerResult = {
  username: string;
  score: number;
  placement: number;
};

export type ScoreRow = {
  username: string;
  score: number;
  placement: 1 | 2 | 3 | 4;
};

export type Neo4jResult = {
  username: string;
  totalGames: number;
  totalScore: number;
  bestScore: number;
};

export interface GameResultRowWithRank extends GameResultRow {
  newRank: number | null;
}