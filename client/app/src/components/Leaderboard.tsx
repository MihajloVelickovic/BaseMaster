import { useEffect, useState } from "react";
import axiosInstance from "../utils/axiosInstance";
import "../styles/Leaderboard.css";

interface LeaderboardEntry {
  username: string;
  bestScore: number;
  firsts: number;
  seconds: number;
  thirds: number;
  fourths: number;
}

const Leaderboard = () => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.get("/game/globalLeaderboard", {
        params: { limit: 20 }
      });
      setLeaderboard(res.data.items || []);
      setError(null);
    } catch (err) {
      console.error("Error fetching leaderboard", err);
      setError("Failed to load leaderboard");
    } finally {
      setLoading(false);
    }
  };

  const getMedalEmoji = (rank: number) => {
    switch (rank) {
      case 1: return "🥇";
      case 2: return "🥈";
      case 3: return "🥉";
      default: return "";
    }
  };

  if (loading) {
    return (
      <div className="leaderboard-page">
        <div className="loading-spinner">Loading leaderboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="leaderboard-page">
        <div className="error-message">{error}</div>
        <button onClick={fetchLeaderboard} className="retry-button">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="leaderboard-page">
      <div className="leaderboard-header">
        <h1 className="leaderboard-title">
          <span className="globe-icon">🌍</span>
          Global Leaderboard
        </h1>
        <button onClick={fetchLeaderboard} className="refresh-button">
          🔄 Refresh
        </button>
      </div>

      <div className="leaderboard-table-container">
        <table className="leaderboard-table">
          <thead>
            <tr>
              <th className="rank-col">Rank</th>
              <th className="player-col">Player</th>
              <th className="score-col">Best Score</th>
              <th className="stats-col">1st</th>
              <th className="stats-col">2nd</th>
              <th className="stats-col">3rd</th>
              <th className="stats-col">4th</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.length > 0 ? (
              leaderboard.map((entry, index) => (
                <tr 
                  key={entry.username} 
                  className={`leaderboard-row ${index < 3 ? 'top-three' : ''}`}
                >
                  <td className="rank-cell">
                    <span className="rank-number">
                      {getMedalEmoji(index + 1) || `#${index + 1}`}
                    </span>
                  </td>
                  <td className="player-cell">
                    <div className="player-info">
                      <div className="player-avatar">
                        {entry.username.charAt(0).toUpperCase()}
                      </div>
                      <span className="player-name">{entry.username}</span>
                    </div>
                  </td>
                  <td className="score-cell">
                    <span className="score-badge">{entry.bestScore}</span>
                  </td>
                  <td className="stats-cell">{entry.firsts}</td>
                  <td className="stats-cell">{entry.seconds}</td>
                  <td className="stats-cell">{entry.thirds}</td>
                  <td className="stats-cell">{entry.fourths}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="empty-state">
                  <div className="empty-icon">🏆</div>
                  <p>No players on the leaderboard yet.</p>
                  <p className="empty-subtext">Be the first to play!</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Leaderboard;