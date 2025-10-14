import { useEffect, useState } from "react";
import axiosInstance from "../utils/axiosInstance";
import "../styles/Leaderboard.css";
import { useLocation } from "react-router-dom";

interface LeaderboardEntry {
  username: string;
  bestScore: number;
  totalScore: number;
  firsts: number;
  seconds: number;
  thirds: number;
  fourths: number;
}

interface LeaderboardResponse {
  items: LeaderboardEntry[];
  page: number;
  pageSize: number;
  hasNextPage: boolean;
  cached: boolean;
}

const Leaderboard = () => {
  const location = useLocation();
  var {username } = location.state || {};
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState(16);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);

  const [playerDetails, setPlayerDetails] = useState<(LeaderboardEntry & { rank: number }) | null>(null);
  const [currentUsername, setCurrentUsername] = useState<string | null>(username);
  
  useEffect(() => {
    fetchLeaderboard();
  }, [currentPage]); // Only refetch leaderboard when page changes

  useEffect(() => {
    if (currentUsername) {
      fetchPlayerDetails();
    }
  }, [currentUsername, currentPage]);

  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.get<LeaderboardResponse>("/game/globalLeaderboard", {
        params: { 
          page: currentPage
        }
      });            

      console.log(res);
      const items = res.data.items || [];
      setLeaderboard(items);
      // If we got fewer items than requested, there's no next page
      setPageSize(res.data.pageSize);
      setHasNextPage(res.data.hasNextPage);
      setError(null);
    } catch (err) {
      console.error("Error fetching leaderboard", err);
      setError("Failed to load leaderboard");
    } finally {
      setLoading(false);
    }
  };

  const fetchPlayerDetails = async () => {    
    if (!currentUsername) return;
    
    try {
      const res = await axiosInstance.get("/user/getPlayerRank", {
        params: { username: currentUsername }
      });
      console.log("PlAYER RANK", res.data);
      setPlayerDetails(res.data);
    } catch (err) {
      console.error("Error fetching player details", err);
      // Don't show error, just don't display player rank
      setPlayerDetails(null);
    }
  };

  const isPlayerOnCurrentPage = () => {
    if (!playerDetails) return false;
    return leaderboard.some(entry => entry.username === currentUsername);
  };


  const handleNextPage = () => {
    if (hasNextPage) {
      setCurrentPage(prev => prev + 1);
      setExpandedRow(null); // Close any expanded rows
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
      setExpandedRow(null); // Close any expanded rows
    }
  };

  const toggleDetails = (username: string) => {
    setExpandedRow(expandedRow === username ? null : username);
  };

  const getMedalEmoji = (rank: number) => {
    switch (rank) {
      case 1: return "🥇";
      case 2: return "🥈";
      case 3: return "🥉";
      default: return "";
    }
  };

  const getGlobalRank = (index: number) => {
    return (currentPage - 1) * pageSize + index + 1;
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
              <th className="score-col">Total Score</th>
              <th className="score-col">High Score</th>
              <th className="actions-col">Details</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.length > 0 ? (
              leaderboard.map((entry, index) => {
                const globalRank = getGlobalRank(index);
                return (
                  <>
                    {/* Main Row */}
                    <tr 
                      key={entry.username} 
                      className={`leaderboard-row ${globalRank <= 3 ? 'top-three' : ''}`}
                    >
                      <td className="rank-cell">
                        <span className="rank-number">
                          {getMedalEmoji(globalRank) || `#${globalRank}`}
                        </span>
                      </td>
                      <td className="player-cell">
                        <div className="player-info">
                          <div className="player-avatar">
                            {entry.username.charAt(0).toUpperCase()}
                          </div>
                          {/* <span className="player-name">{entry.username}</span> */}
                        </div>
                      </td>
                      <td className="score-cell">
                        <span className="score-badge total">{entry.totalScore}</span>
                      </td>
                      <td className="score-cell">
                        <span className="score-badge best">{entry.bestScore}</span>
                      </td>
                      <td className="actions-cell">
                        <button 
                          onClick={() => toggleDetails(entry.username)}
                          className="details-button"
                          aria-label="Toggle details"
                        >
                          {expandedRow === entry.username ? '▲' : '▼'}
                        </button>
                      </td>
                    </tr>

                    {/* Expanded Details Row */}
                    {expandedRow === entry.username && (
                      <tr className="details-row">
                        <td colSpan={5}>
                          <div className="placement-details">
                            <h4>Placement History</h4>
                            <div className="placement-grid">
                              <div className="placement-stat">
                                <span className="medal">🥇</span>
                                <span className="count">{entry.firsts || 0}</span>
                                <span className="label">First Place</span>
                              </div>
                              <div className="placement-stat">
                                <span className="medal">🥈</span>
                                <span className="count">{entry.seconds || 0}</span>
                                <span className="label">Second Place</span>
                              </div>
                              <div className="placement-stat">
                                <span className="medal">🥉</span>
                                <span className="count">{entry.thirds || 0}</span>
                                <span className="label">Third Place</span>
                              </div>
                              <div className="placement-stat">
                                <span className="medal">4️⃣</span>
                                <span className="count">{entry.fourths || 0}</span>
                                <span className="label">Fourth Place</span>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })
            ) : (
              <tr>
                <td colSpan={5} className="empty-state">
                  <div className="empty-icon">🏆</div>
                  <p>No players on the leaderboard yet.</p>
                  <p className="empty-subtext">Be the first to play!</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      
      
      {/* Your Rank Section - Shows only when player is NOT on current page */}
        {playerDetails && !isPlayerOnCurrentPage() && (
          <div className="player-rank-section">
            <div className="player-rank-header">
              <span className="your-rank-label">📍 Your Rank</span>
            </div>
            <table className="leaderboard-table">
              <tbody>
                <tr className="leaderboard-row current-player highlight">
                  <td className="rank-cell">
                    <span className="rank-number">
                      {getMedalEmoji(playerDetails.rank) || `#${playerDetails.rank}`}
                    </span>
                  </td>
                  <td className="player-cell">
                    <div className="player-info">
                      <div className="player-avatar">
                        {playerDetails.username.charAt(0).toUpperCase()}
                      </div>
                    </div>
                  </td>
                  <td className="score-cell">
                    <span className="score-badge total">{playerDetails.totalScore}</span>
                  </td>
                  <td className="score-cell">
                    <span className="score-badge best">{playerDetails.bestScore}</span>
                  </td>
                  <td className="actions-cell">
                    <button 
                      onClick={() => toggleDetails(playerDetails.username)}
                      className="details-button"
                      aria-label="Toggle details"
                    >
                      {expandedRow === playerDetails.username ? '▲' : '▼'}
                    </button>
                  </td>
                </tr>
                {expandedRow === playerDetails.username && (
                  <tr className="details-row">
                    <td colSpan={5}>
                      <div className="placement-details">
                        <h4>Placement History</h4>
                        <div className="placement-grid">
                          <div className="placement-stat">
                            <span className="medal">🥇</span>
                            <span className="count">{playerDetails.firsts || 0}</span>
                            <span className="label">First Place</span>
                          </div>
                          <div className="placement-stat">
                            <span className="medal">🥈</span>
                            <span className="count">{playerDetails.seconds || 0}</span>
                            <span className="label">Second Place</span>
                          </div>
                          <div className="placement-stat">
                            <span className="medal">🥉</span>
                            <span className="count">{playerDetails.thirds || 0}</span>
                            <span className="label">Third Place</span>
                          </div>
                          <div className="placement-stat">
                            <span className="medal">4️⃣</span>
                            <span className="count">{playerDetails.fourths || 0}</span>
                            <span className="label">Fourth Place</span>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination Controls - Bottom */}
      <div className="pagination-controls bottom">
        <button 
          onClick={handlePrevPage} 
          className="pagination-button"
          disabled={currentPage === 1}
        >
          ← Previous
        </button>
        <span className="page-info">
          Page {currentPage}
        </span>
        <button 
          onClick={handleNextPage} 
          className="pagination-button"
          disabled={!hasNextPage}
        >
          Next →
        </button>
      </div>
    </div>
  );
};

export default Leaderboard;