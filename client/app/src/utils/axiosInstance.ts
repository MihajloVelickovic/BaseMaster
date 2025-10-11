import axios from "axios";

const baseURL = 'http://127.0.0.1:1738';

const axiosInstance = axios.create({
    baseURL: baseURL,
})

axiosInstance.interceptors.request.use(
    (config) => {
        const protectedEndpoints = [
            '/user/friendRequests',
            '/user/sendFriendRequest', 
            '/user/handleFriendRequest',
            '/user/getFriends',
            '/user/removeFriend',
            '/user/sendInvite',
            '/user/getInvites',
            '/user/getAchievements',
            '/user/getPlayerStats',
            '/user/getFriendsWithAchievements',
            '/user/searchUsers',
            //'/user/refreshAccess',
            '/game/createGame',
            '/game/getCurrNum',
            '/game/joinLobby',
            '/game/getLobbies',
            '/game/setGameState',
            '/game/playerComplete',
            '/game/leaveLobby',
            '/game/leaveGame',
            '/game/sendLobbyMessage',
            '/game/getLobbyMessages',
            '/game/globalLeaderboard'
        ];
        const needsAuth = protectedEndpoints.some(endpoint => config.url?.includes(endpoint));
        
        if (needsAuth) {
            const token = localStorage.getItem('accessTok');
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

axiosInstance.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;
        
        if (error.response?.status === 403 && !originalRequest._retry) {
            originalRequest._retry = true;
            
            try {
                const refreshToken = localStorage.getItem('refreshTok');
                const refreshResponse = await axios.post("/user/refreshAccess", {
                    token: refreshToken
                });
                
                const newAccessToken = refreshResponse.data.accessTok;
                const newRefreshToken = refreshResponse.data.refreshTok;
                localStorage.setItem('accessTok', newAccessToken);
                localStorage.setItem('refreshTok', newRefreshToken);

                originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
                return axiosInstance(originalRequest);
            } catch (refreshError) {
                localStorage.removeItem('accessTok');
                localStorage.removeItem('refreshTok');
                window.location.href = '/login';
                return Promise.reject(refreshError);
            }
        }
        
        return Promise.reject(error);
    }
);

export default axiosInstance;