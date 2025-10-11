import React, { useState, useEffect } from 'react';
import { useAuth } from '../utils/AuthContext';
import axiosInstance from '../utils/axiosInstance';
import '../styles/Profile.css';

interface PlayerStats {
  username: string;
  email: string;
  bestScore: number;
  totalGames: number;
  averageScore: number;
  achievementCount: number;
  friendCount: number;
  lastPlayed: string | null;
  gamesWon?: number;
  firsts?: number;
  seconds?: number;
  thirds?: number;
  fourths?: number;
}

interface Achievement {
  code: string;
  name: string;
  description: string;
  type: string;
  requirement?: number;
  achievedAt?: string;
  unlocked: boolean;
  globalPercentage?: number;
}

interface FriendWithAchievements {
  username: string;
  bestScore: number;
  totalGames: number;
  achievements: string[];
}

// All possible achievements - should match backend
const ALL_ACHIEVEMENTS = [
  { code: 'FIRST_WIN', name: 'First Victory', description: 'Win your first game', type: 'GAMES' },
  { code: 'HIGH_SCORER', name: 'High Scorer', description: 'Score over 1000 points', type: 'SCORE' },
  { code: 'VETERAN', name: 'Veteran Player', description: 'Play 50 games', type: 'GAMES' },
  { code: 'PERFECTIONIST', name: 'Perfectionist', description: 'Get a perfect score', type: 'SPECIAL' },
  { code: 'SOCIAL_BUTTERFLY', name: 'Social Butterfly', description: 'Have 10 friends', type: 'SPECIAL' }
];

function Profile() {
  const { playerID } = useAuth();
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [friendsData, setFriendsData] = useState<FriendWithAchievements[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'stats' | 'achievements' | 'friends'>('stats');

  useEffect(() => {
    if (playerID) {
      fetchPlayerData();
    }
  }, [playerID]);

  const fetchPlayerData = async () => {
    if (!playerID) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      // Fetch all data in parallel
      const [statsRes, achievementsRes, friendsRes, globalStatsRes] = await Promise.all([
        axiosInstance.post('/user/getPlayerStats', { username: playerID }),
        axiosInstance.post('/user/getAchievements', { username: playerID }),
        axiosInstance.post('/user/getFriendsWithAchievements', { username: playerID }),
        axiosInstance.get('/user/getGlobalAchievementStats').catch(() => ({ data: { stats: {} } }))
      ]);

      setStats(statsRes.data.stats);
      setFriendsData(friendsRes.data.friends || []);

      // Merge unlocked achievements with all achievements
      const unlockedAchievements = achievementsRes.data.achievements || [];
      const globalData = globalStatsRes.data.stats || { totalPlayers: 0, achievements: [] };
    
    // Convert achievements array to percentage map
    const globalStatsMap: { [key: string]: number } = {};
    globalData.achievements.forEach((ach: any) => {
      if (globalData.totalPlayers > 0) {
        globalStatsMap[ach.code] = (ach.playerCount / globalData.totalPlayers) * 100;
      } else {
        globalStatsMap[ach.code] = 0;
      }
    });

    const allAchievementsWithStatus = ALL_ACHIEVEMENTS.map(achievement => {
      const unlocked = unlockedAchievements.find((a: any) => a.code === achievement.code);
      return {
        ...achievement,
        unlocked: !!unlocked,
        achievedAt: unlocked?.achievedAt,
        globalPercentage: globalStatsMap[achievement.code] || 0
      };
    });

    setAchievements(allAchievementsWithStatus);
    } catch (error) {
      console.error('Error fetching player data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateWinRate = () => {
    if (!stats || stats.totalGames === 0) return 0;
    const wins = stats.firsts || 0;
    return ((wins / stats.totalGames) * 100).toFixed(1);
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { //Long Live People of United Kingdom
      day: 'numeric', 
      month: 'short', 
      year: 'numeric' 
    });
  };

  if (loading) {
    return (
      <div className="profile-container">
        <div className="loading-spinner">Loading...</div>
      </div>
    );
  }

  if (!playerID) {
    return (
      <div className="profile-container">
        <div className="not-logged-in">
          <h2>Please log in to view your profile</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-container">
      <div className="profile-header">
        <div className="profile-avatar">
          <div className="avatar-placeholder">
            {playerID.charAt(0).toUpperCase()}
          </div>
        </div>
        <div className="profile-info">
          <h1>{playerID}</h1>
          {stats && (
            <div className="profile-summary">
              <span className="summary-item">
                <strong>{stats.totalGames}</strong> Games Played
              </span>
              <span className="summary-item">
                <strong>{stats.bestScore}</strong> Best Score
              </span>
              <span className="summary-item">
                <strong>{stats.friendCount}</strong> Friends
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="profile-tabs">
        <button 
          className={`tab-button ${activeTab === 'stats' ? 'active' : ''}`}
          onClick={() => setActiveTab('stats')}
        >
          Statistics
        </button>
        <button 
          className={`tab-button ${activeTab === 'achievements' ? 'active' : ''}`}
          onClick={() => setActiveTab('achievements')}
        >
          Achievements ({achievements.filter(a => a.unlocked).length}/{achievements.length})
        </button>
        <button 
          className={`tab-button ${activeTab === 'friends' ? 'active' : ''}`}
          onClick={() => setActiveTab('friends')}
        >
          Friends
        </button>
      </div>

      <div className="profile-content">
        {activeTab === 'stats' && stats && (
          <div className="stats-grid">
            <div className="stat-card">
              <h3>Performance</h3>
              <div className="stat-row">
                <span>Total Games:</span>
                <span className="stat-value">{stats.totalGames}</span>
              </div>
              <div className="stat-row">
                <span>Win Rate:</span>
                <span className="stat-value">{calculateWinRate()}%</span>
              </div>
              <div className="stat-row">
                <span>Average Score:</span>
                <span className="stat-value">{stats.averageScore}</span>
              </div>
              <div className="stat-row">
                <span>Best Score:</span>
                <span className="stat-value highlight">{stats.bestScore}</span>
              </div>
            </div>

            <div className="stat-card">
              <h3>Placements</h3>
              <div className="stat-row">
                <span>🥇 1st Place:</span>
                <span className="stat-value gold">{stats.firsts || 0}</span>
              </div>
              <div className="stat-row">
                <span>🥈 2nd Place:</span>
                <span className="stat-value silver">{stats.seconds || 0}</span>
              </div>
              <div className="stat-row">
                <span>🥉 3rd Place:</span>
                <span className="stat-value bronze">{stats.thirds || 0}</span>
              </div>
              <div className="stat-row">
                <span>4th Place:</span>
                <span className="stat-value">{stats.fourths || 0}</span>
              </div>
            </div>

            <div className="stat-card">
              <h3>Activity</h3>
              <div className="stat-row">
                <span>Last Played:</span>
                <span className="stat-value">{formatDate(stats.lastPlayed)}</span>
              </div>
              <div className="stat-row">
                <span>Achievements:</span>
                <span className="stat-value">{stats.achievementCount}/{ALL_ACHIEVEMENTS.length}</span>
              </div>
              <div className="stat-row">
                <span>Friends:</span>
                <span className="stat-value">{stats.friendCount}</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'achievements' && (
          <div className="achievements-grid">
            {achievements.map((achievement) => (
              <div 
                key={achievement.code} 
                className={`achievement-card ${!achievement.unlocked ? 'locked' : ''}`}
              >
                <div className="achievement-icon">
                  {achievement.unlocked ? (
                    <>
                      {achievement.type === 'SCORE' && '🏆'}
                      {achievement.type === 'GAMES' && '🎮'}
                      {achievement.type === 'STREAK' && '🔥'}
                      {achievement.type === 'SPECIAL' && '⭐'}
                    </>
                  ) : '🔒'}
                </div>
                <div className="achievement-details">
                  <h4>{achievement.name}</h4>
                  <p>{achievement.description}</p>
                  <div className="achievement-meta">
                    {achievement.unlocked ? (
                      <>
                        <span className="achievement-date">
                          Unlocked: {formatDate(achievement.achievedAt)}
                        </span>
                        <span className="achievement-rarity">
                          {achievement.globalPercentage?.toFixed(1) || '0'}% of players have this
                        </span>
                      </>
                    ) : (
                      <span className="achievement-locked-text">
                        Locked - {achievement.globalPercentage?.toFixed(1) || '0'}% of players have this
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'friends' && (
          <div className="friends-list">
            {friendsData.length === 0 ? (
              <div className="no-friends">
                <p>No friends yet. Add friends to compare scores!</p>
              </div>
            ) : (
              friendsData.map((friend) => (
                <div key={friend.username} className="friend-card">
                  <div className="friend-avatar">
                    {friend.username.charAt(0).toUpperCase()}
                  </div>
                  <div className="friend-info">
                    <h4>{friend.username}</h4>
                    <div className="friend-stats">
                      <span>Best Score: {friend.bestScore}</span>
                      <span>Games: {friend.totalGames}</span>
                    </div>
                    {friend.achievements.length > 0 && (
                      <div className="friend-achievements">
                        {friend.achievements.slice(0, 3).map((ach, idx) => (
                          <span key={idx} className="mini-achievement">🏅 {ach}</span>
                        ))}
                        {friend.achievements.length > 3 && (
                          <span className="more-achievements">
                            +{friend.achievements.length - 3} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default Profile;
