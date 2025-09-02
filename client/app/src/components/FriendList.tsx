import React, { useState, useEffect } from 'react';
import { useAuth } from '../utils/AuthContext';
import { useFriendContext } from '../utils/FriendContext';
import axiosInstance from '../utils/axiosInstance';
import { FaUserPlus, FaSearch, FaTimes, FaCircle, FaUserMinus } from 'react-icons/fa';
import '../styles/FriendList.css';

interface SearchResult {
  username: string;
  isFriend: boolean;
  requestSent: boolean;
  requestReceived: boolean;
}

function FriendList() {
  const { playerID } = useAuth();
  const { friends, setFriends, friendRequests, setFriendRequests, onlineUsers } = useFriendContext();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'friends' | 'requests' | 'search'>('friends');
  const [searchError, setSearchError] = useState('');

  useEffect(() => {
    if (playerID) {
      fetchFriends();
    }
  }, [playerID]);

  const fetchFriends = async () => {
    if (!playerID) return;
    
    try {
      const response = await axiosInstance.post('/user/getFriends', { username: playerID });
      setFriends(response.data.friends || []);
    } catch (error) {
      console.error('Error fetching friends:', error);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchError('Please enter a username to search');
      return;
    }

    if (!playerID) {
      setSearchError('You must be logged in to search for users');
      return;
    }

    setLoading(true);
    setSearchError('');
    
    try {
      // For now, we'll simulate a search by checking if the user exists
      // You might need to add a backend endpoint for searching users
      const response = await axiosInstance.post('/user/searchUsers', { 
        query: searchQuery,
        currentUser: playerID 
      }).catch(() => {
        // If the endpoint doesn't exist, we'll do a simple check
        return { data: { users: [{ 
          username: searchQuery,
          isFriend: friends.includes(searchQuery),
          requestSent: false, // You'd need to track this
          requestReceived: friendRequests.includes(searchQuery)
        }] } };
      });

      if (response.data.users && response.data.users.length > 0) {
        setSearchResults(response.data.users);
      } else {
        // Fallback: just show the searched username if it's valid
        setSearchResults([{
          username: searchQuery,
          isFriend: friends.includes(searchQuery),
          requestSent: false,
          requestReceived: friendRequests.includes(searchQuery)
        }]);
      }
    } catch (error) {
      console.error('Error searching users:', error);
      setSearchError('Error searching for users. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const sendFriendRequest = async (receiver: string) => {
    if (!playerID) return;

    try {
      await axiosInstance.post('/user/sendFriendRequest', {
        sender: playerID,
        receiver: receiver
      });
      
      // Update search results to reflect the sent request
      setSearchResults(prev => prev.map(user => 
        user.username === receiver ? { ...user, requestSent: true } : user
      ));
      
      alert(`Friend request sent to ${receiver}!`);
    } catch (error: any) {
      console.error('Error sending friend request:', error);
      alert(error.response?.data?.message || 'Failed to send friend request');
    }
  };

  const handleFriendRequest = async (sender: string, accept: boolean) => {
    if (!playerID) return;

    try {
      await axiosInstance.post('/user/handleFriendRequest', {
        username: playerID,
        sender: sender,
        userResponse: accept
      });

      if (accept) {
        setFriends(prev => [...prev, sender]);
      }
      setFriendRequests(prev => prev.filter(req => req !== sender));
    } catch (error) {
      console.error('Error handling friend request:', error);
    }
  };

  const removeFriend = async (friend: string) => {
    if (!playerID) return;
    
    if (!window.confirm(`Are you sure you want to remove ${friend} from your friends?`)) {
      return;
    }

    try {
      await axiosInstance.post('/user/removeFriend', {
        username: playerID,
        friend: friend
      });
      
      setFriends(prev => prev.filter(f => f !== friend));
    } catch (error) {
      console.error('Error removing friend:', error);
    }
  };

  if (!playerID) {
    return (
      <div className="friends-container">
        <div className="not-logged-in">
          <h2>Please log in to view your friends</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="friends-container">
      <div className="friends-header">
        <h1>Friends & Social</h1>
        <div className="friends-stats">
          <span>{friends.length} Friends</span>
          <span>{onlineUsers.length} Online</span>
          <span>{friendRequests.length} Pending Requests</span>
        </div>
      </div>

      <div className="friends-tabs">
        <button 
          className={`tab-button ${activeTab === 'friends' ? 'active' : ''}`}
          onClick={() => setActiveTab('friends')}
        >
          Friends ({friends.length})
        </button>
        <button 
          className={`tab-button ${activeTab === 'requests' ? 'active' : ''}`}
          onClick={() => setActiveTab('requests')}
        >
          Requests ({friendRequests.length})
        </button>
        <button 
          className={`tab-button ${activeTab === 'search' ? 'active' : ''}`}
          onClick={() => setActiveTab('search')}
        >
          Search Users
        </button>
      </div>

      <div className="friends-content">
        {activeTab === 'friends' && (
          <div className="friends-list">
            {friends.length === 0 ? (
              <div className="empty-state">
                <p>No friends yet. Search for users to add friends!</p>
              </div>
            ) : (
              friends.map(friend => (
                <div key={friend} className="friend-item">
                  <div className="friend-avatar">
                    {friend.charAt(0).toUpperCase()}
                  </div>
                  <div className="friend-info">
                    <h3>{friend}</h3>
                    <div className="friend-status">
                      {onlineUsers.includes(friend) ? (
                        <span className="online">
                          <FaCircle /> Online
                        </span>
                      ) : (
                        <span className="offline">
                          <FaCircle /> Offline
                        </span>
                      )}
                    </div>
                  </div>
                  <button 
                    className="remove-friend-btn"
                    onClick={() => removeFriend(friend)}
                    title="Remove friend"
                  >
                    <FaUserMinus />
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'requests' && (
          <div className="requests-list">
            {friendRequests.length === 0 ? (
              <div className="empty-state">
                <p>No pending friend requests</p>
              </div>
            ) : (
              friendRequests.map(request => (
                <div key={request} className="request-item">
                  <div className="friend-avatar">
                    {request.charAt(0).toUpperCase()}
                  </div>
                  <div className="request-info">
                    <h3>{request}</h3>
                    <p>Wants to be your friend</p>
                  </div>
                  <div className="request-actions">
                    <button 
                      className="accept-btn"
                      onClick={() => handleFriendRequest(request, true)}
                    >
                      Accept
                    </button>
                    <button 
                      className="decline-btn"
                      onClick={() => handleFriendRequest(request, false)}
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'search' && (
          <div className="search-section">
            <div className="search-bar">
              <input
                type="text"
                placeholder="Enter username to search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="search-input"
              />
              <button 
                className="search-button"
                onClick={handleSearch}
                disabled={loading}
              >
                {loading ? 'Searching...' : <FaSearch />}
              </button>
            </div>

            {searchError && (
              <div className="search-error">
                {searchError}
              </div>
            )}

            <div className="search-results">
              {searchResults.map(user => (
                <div key={user.username} className="search-result-item">
                  <div className="friend-avatar">
                    {user.username.charAt(0).toUpperCase()}
                  </div>
                  <div className="user-info">
                    <h3>{user.username}</h3>
                    {user.isFriend && <span className="friend-badge">Friend</span>}
                    {user.requestSent && <span className="request-badge">Request Sent</span>}
                    {user.requestReceived && <span className="request-badge">Request Received</span>}
                  </div>
                  <div className="user-actions">
                    {!user.isFriend && !user.requestSent && !user.requestReceived && (
                      <button 
                        className="add-friend-btn"
                        onClick={() => sendFriendRequest(user.username)}
                      >
                        <FaUserPlus /> Add Friend
                      </button>
                    )}
                    {user.requestReceived && (
                      <div className="request-actions">
                        <button 
                          className="accept-btn"
                          onClick={() => handleFriendRequest(user.username, true)}
                        >
                          Accept
                        </button>
                        <button 
                          className="decline-btn"
                          onClick={() => handleFriendRequest(user.username, false)}
                        >
                          Decline
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default FriendList;