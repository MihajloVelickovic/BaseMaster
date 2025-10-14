import axios from "axios";

const baseURL = 'http://127.0.0.1:1738';

const axiosInstance = axios.create({
    baseURL: baseURL,
});

// Track if we're currently refreshing to prevent multiple simultaneous refresh attempts
let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
    failedQueue.forEach(prom => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });
    failedQueue = [];
};

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
       
        // Don't retry refresh endpoint itself or if we've already retried
        if (originalRequest.url?.includes('/user/refreshAccess')) {
            return Promise.reject(error);
        }

        if (error.response?.status === 403 && !originalRequest._retry) {
            if (isRefreshing) {
                // If already refreshing, queue this request
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                }).then(token => {
                    originalRequest.headers.Authorization = `Bearer ${token}`;
                    return axiosInstance(originalRequest);
                }).catch(err => {
                    return Promise.reject(err);
                });
            }

            originalRequest._retry = true;
            isRefreshing = true;
           
            try {
                const refreshToken = localStorage.getItem('refreshTok');
                
                // Use axiosInstance for the refresh call, but it won't trigger interceptor
                // because we check for the /refreshAccess URL above
                const refreshResponse = await axiosInstance.post("/user/refreshAccess", {
                    token: refreshToken
                });
               
                const newAccessToken = refreshResponse.data.accessTok;
                const newRefreshToken = refreshResponse.data.refreshTok;
                
                localStorage.setItem('accessTok', newAccessToken);
                localStorage.setItem('refreshTok', newRefreshToken);
                
                originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
                
                // Process any queued requests
                processQueue(null, newAccessToken);
                
                return axiosInstance(originalRequest);
            } catch (refreshError) {
                processQueue(refreshError, null);
                localStorage.removeItem('accessTok');
                localStorage.removeItem('refreshTok');
                window.location.href = '/login';
                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false;
            }
        }
       
        return Promise.reject(error);
    }
);

export default axiosInstance;