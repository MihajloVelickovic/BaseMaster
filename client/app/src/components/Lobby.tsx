import { useLocation, useNavigate } from "react-router-dom";
import { GameModes, Difficulties, GameStates, IdPrefixes } from "../shared_modules/shared_enums";
import "../styles/Lobby.css";
//import { roundCount } from "./Home";
import axiosInstance from "../utils/axiosInstance";
import { useEffect, useState, useRef, useCallback } from "react";
import { FaBell, FaCheck, FaPlus, FaTimes, FaUserPlus } from "react-icons/fa";
import { useFriendContext } from "../utils/FriendContext"
import { STATUS_CODES } from "http";
import { useWebSocket } from "../utils/WebSocketContext";

function getUserName (id: string) {
    if (id && id != "") {
      return id.split("_")[0];
    }
    return "";
}

export default function Lobby () {
    const location = useLocation();
    const { subscribe, unsubscribe, sendMessage } = useWebSocket();
    const hasJoinedLobby = useRef(false);
    var { toBasee = 2, playerNum = 1, gameMode = GameModes.CLASSIC.toString(),
         difficulty = Difficulties.LAYMAN.toString(), gameId = "", playerID,
          transferedLobbyName, hostId, roundCount, playerIds} = location.state || {};
    // console.log(playerID, 'ovo je player id');
    // console.log(hostId);
    console.log("Lobby Name Entered Lobby: ", transferedLobbyName)
    const navigate = useNavigate();
    const [startGameFlag, setStartGameFlag] = useState(false);
    //const [friends, setFriends] = useState<string[]>([]);
    const [players, setPlayers] = useState<string[]>
    (Array.isArray(playerIds) ? playerIds : playerID ? [playerID] : []);
    const [hostIdState, setHostIdState] = useState(hostId);
    const [playerChat, setPlayerChat] = useState<string[]>([]);
    const [chatInput, setChatInput] = useState("");
    const chatEndRef = useRef<HTMLDivElement | null>(null);
    const [isOpen, setIsOpen] = useState(false);
    //const [friendRequests, setFriendRequests] = useState<string[]>([]);
    const { friends,setFriends,friendRequests,setFriendRequests } = useFriendContext();
    const [isInviteOpen, setIsInviteOpen] = useState<boolean>(false);
    const { onlineUsers } = useFriendContext();
    const [lobbyName, setLobbyName] = useState(transferedLobbyName)
    console.log("playerChat: ", playerChat);
   
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [playerChat]); 

    useEffect(() => {
        let isMounted = true;

        const fetchFriends = async () => {
            try {
                const response = await axiosInstance.post("/user/getFriends", { username: playerID });
                if (isMounted) {
                    setFriends(response.data.friends || []);
                }
            } catch (err: any) {
                if (isMounted) {
                    console.error("Failed to fetch friends:", err.message);
                }
            }
        };

        if (playerID) {
            fetchFriends();
        }

        return () => {
            isMounted = false;
        };
    }, [playerID, setFriends]);

    const startGameRef = useRef(false);
    useEffect(() => {
        startGameRef.current = startGameFlag;
    }, [startGameFlag]);

    // Use ref to store current playerID to avoid recreating handlers
    const playerIDRef = useRef(playerID);
    useEffect(() => {
        playerIDRef.current = playerID;
    }, [playerID]);

    // Message handlers - now stable (won't recreate)
    const handleGameStarted = useCallback((data: any) => {
        console.log('Lobby received GAME_STARTED:', data);
        setStartGameFlag(true);
    }, []);

    const handlePlayerJoin = useCallback((data: any) => {
        console.log("Lobby received PLAYER_JOIN:", data.playerId);
        setPlayers(prevPlayers =>
            prevPlayers.includes(data.playerId) ? prevPlayers : [...prevPlayers, data.playerId]
        );

        if (data.playerId === playerIDRef.current) {
            setPlayerChat(["You joined a lobby."]);
        } else {
            setPlayerChat(prevChat => [...prevChat, `Player ${getUserName(data.playerId)} joined the lobby.`]);
        }
    }, []);

    const handlePlayerLeave = useCallback((data: any) => {
        console.log("Lobby received PLAYER_LEAVE:", data.playerId);
        setPlayers(prevPlayers => prevPlayers.filter(id => id !== data.playerId));
        if (data.newHost) {
            setHostIdState(data.newHost);
        }

        setPlayerChat(prevChat => [...prevChat, `Player ${getUserName(data.playerId)} left the lobby.`]);
    }, []);

    const handleMessageUpdate = useCallback((data: any) => {
        console.log("Lobby received MESSAGE_UPDATE:", data.playerId, data.playerMessage);
        const newMessage = `${getUserName(data.playerId)}: ${data.playerMessage}`;

        // Avoid adding duplicate messages if we already added it optimistically
        setPlayerChat(prevChat => {
            // Check if the last message is identical (happens when we sent it ourselves)
            if (prevChat.length > 0 && prevChat[prevChat.length - 1] === newMessage) {
                console.log("Duplicate message detected (own message echoed back), skipping");
                return prevChat;
            }
            return [...prevChat, newMessage];
        });
    }, []);

    // Navigate to game when flag is set
    useEffect(() => {
        if (startGameFlag) {
            navigate("/Game", { state: { toBasee: toBasee, playerNum, gameMode, difficulty, gameId, playerID, roundCount } });
        }
    }, [startGameFlag, navigate, toBasee, playerNum, gameMode, difficulty, gameId, playerID, roundCount]);

    // Join lobby via WebSocket (runs once)
    useEffect(() => {
        if (startGameFlag) return;

        // Join lobby via WebSocket
        if (!hasJoinedLobby.current) {
            sendMessage({ type: "joinLobby", gameId, playerID });
            hasJoinedLobby.current = true;

            if (playerID === hostId) {
                setPlayerChat(prevChat => [...prevChat, "You created a lobby."]);
            } else {
                setPlayerChat(["You joined a lobby."]);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gameId, playerID]);

    // Subscribe to lobby messages (separate effect to avoid re-subscriptions)
    useEffect(() => {
        if (startGameFlag) return;

        subscribe(IdPrefixes.GAME_STARTED, handleGameStarted);
        subscribe(IdPrefixes.PLAYER_JOIN, handlePlayerJoin);
        subscribe(IdPrefixes.PLAYER_LEAVE, handlePlayerLeave);
        subscribe(IdPrefixes.MESSAGE_UPDATE, handleMessageUpdate);

        return () => {
            unsubscribe(IdPrefixes.GAME_STARTED, handleGameStarted);
            unsubscribe(IdPrefixes.PLAYER_JOIN, handlePlayerJoin);
            unsubscribe(IdPrefixes.PLAYER_LEAVE, handlePlayerLeave);
            unsubscribe(IdPrefixes.MESSAGE_UPDATE, handleMessageUpdate);
        };
        // Handlers are now stable, so this effect only runs when startGameFlag changes or on mount
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [startGameFlag]);

    // function handleStartGame() {
    //     setStartGameFlag(true);
    // }

    async function sendPlayerChatMessage() {
        if (!chatInput.trim()) return; // Prevent sending empty messages

        const messageToSend = chatInput;
        setChatInput(""); // Clear input immediately

        try {
            // Optimistically add message to local state immediately
            setPlayerChat(prevChat => [...prevChat, `${getUserName(playerID)}: ${messageToSend}`]);

            await axiosInstance.post('/game/sendLobbyMessage', { playerId: playerID, message: messageToSend, gameId });
        } catch (error) {
            console.error("Error sending message:", error);
        }
    }

    const handleStartGame = async () => {
        var response = await axiosInstance.post('/game/setGameState', {gameId, gameState:GameStates.STARTED});      //ovde treba da se posalje i lobby name i roundCount
        console.log(response);
        // const ws = new WebSocket("ws://localhost:1738");
        // ws.onopen = () => {
        //     ws.send(JSON.stringify({ type: "startGame", gameId }));
        // }; 
        setStartGameFlag(true);
    }

    
    const leaveLobby = async () => {
        try {
            await axiosInstance.post("/game/leaveLobby", { gameId, playerID });
        } catch (error) {
            console.error("Error leaving lobby:", error);
        }
    };

    const handleLeaveLobby = async () => {
        // Send leave message via WebSocket context
        sendMessage({
            type: IdPrefixes.PLAYER_LEAVE,
            gameId,
            playerID,
        });
        navigate("/");
    };

    const getPlayerChat = async () => {
        var response = await axiosInstance.post('/game/getLobbyMessages', {gameId});
        var res = response.data['messages'];
    
        setPlayerChat([playerID === hostId ? "You created a lobby." : "You joined a lobby."]);
    
        res = res.map((e:any) => `${getUserName(e.playerId)}: ${e.message}`);
        setPlayerChat(prevChat => [...prevChat, ...res]);
    };
    

    useEffect(() => {
        const handleBeforeUnload = () => leaveLobby();
    
        window.addEventListener("beforeunload", handleBeforeUnload);

        //adding chat functions
        getPlayerChat();
    
        return () => {
            if(!startGameRef.current)
                leaveLobby(); 
            window.removeEventListener("beforeunload", handleBeforeUnload);
        };
    }, []);

    function showLobbyStats() {
        return (
            <div className="LobbyStats">
                <div>
                    <label>Base: </label>
                    <label>{toBasee}</label>
                </div>
                <div>
                    <label>Player number: </label>
                    <label>{playerNum}</label>
                </div>
                <div>
                    <label>Number of rounds: </label>
                    <label>{roundCount}</label>
                </div>
                <div>
                    <label>Game Mode: </label>
                    <label>{gameMode}</label>
                </div>
                <div>
                    <label>Difficulty: </label>
                    <label>{difficulty}</label>
                </div>
               
            </div>
        );
    }
    //console.log("player chat pre poslednjeg: ", playerChat);
    const  sendFriendRequest = async (e: React.MouseEvent<HTMLButtonElement>) => {
        const targetPlayerID = e.currentTarget.getAttribute('data-player-id');
        if (!targetPlayerID)
            return;
            
        try {
            const response = await axiosInstance.post('/user/sendFriendRequest',
                 {sender:playerID, receiver:targetPlayerID});
            
            console.log(response);

            if(response === null)
                return;

            const receiverUsername = getUserName(targetPlayerID);
            setFriendRequests((prev) => [...prev, receiverUsername]);
        }
        catch(err:any) {
            console.log(err.message);
        }
    };


    const inviteFriendsClicked =  () => {
       setIsInviteOpen(prevState => !prevState);
    }

    async function sendInvite(friend:string) {
        try {
            const response = await axiosInstance.post("/user/sendInvite", {sender:playerID, receiver:friend, gameId:gameId});
            console.log(response.data['message']);
        }
        catch(err:any) {
            console.log(err.message)
        }
        finally
        {
            setIsInviteOpen(false);
        }
    }

    const renderInviteFriends = () => {
        return (
            <div className="invite-modal">
            <div className="invite-modal-content">
                <button className="close-button" onClick={() => setIsInviteOpen(false)}>
                    <FaTimes />
                </button>
                <h2>Online Friends</h2>
                <div className="friend-list-container">
                    {friends.filter(friend => onlineUsers.includes(friend)).length === 0 ? (
                        <span>None of your friends is currently online.</span>
                    ) : (
                        friends
                            .filter(friend => onlineUsers.includes(friend))
                            .map((friend, index) => (
                                <div className="friend-card" key={index}>
                                    <span className="friend-name">
                                        {friend}
                                        <span className="status-dot online">🟢 Online</span>
                                    </span>
                                    <button className="sendMessageButton" onClick={() => sendInvite(friend)}>
                                        Invite
                                        <FaUserPlus style={{ marginLeft: "5px" }} />
                                    </button>
                                </div>
                            ))
                    )}
                </div>
            </div>
        </div>
        );
    }

    return (
        <>
        <div className="lobbyScreen">
            <div className="chatContainer">
                <label className="playersText"> Chat </label>
                <div className="chatMessages">
                    {playerChat.map((message, index) => {
                            const isSystemMessage = message.startsWith("Player") || message.startsWith("You");
                            const [playerId, ...messageParts] = message.split(": ");
                            const messageText = messageParts.join(": ");
                            return (
                                <div key={index} className={`chatMessage ${isSystemMessage ? "systemMessage" : ""}`}>
                                    {isSystemMessage? (
                                        <span className="systemText">{message}</span>
                                    ) : (
                                        <>
                                            <span className="playerName">{playerId}:</span>
                                            <span className="messageText">{messageText}</span>
                                        </>
                                    )}
                                    
                                </div>
                            );        
                    })}
                    <div ref={chatEndRef}/>
                </div>
                <div className="chatInputContainer">
                    <input
                        type="text"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && sendPlayerChatMessage()}
                        placeholder="Type a message...."
                        className="chatInput"
                    />
                    <button onClick={sendPlayerChatMessage} className="sendMessageButton">
                        Send
                    </button>
                </div>
            </div>

            <div className="LobbyContainer ">
                <label className="mainLobbyText"> {lobbyName} Lobby </label>            
                {showLobbyStats()}

                {playerID === hostIdState ? (
                    <button className="startGameButton" onClick={handleStartGame}>
                        Start Game!
                    </button>
                ) : (
                    <div className="waitingText">Waiting for host to start the game....</div>
                )}
                
                <button className="startGameButton leaveLobbyButton" onClick={handleLeaveLobby}>
                    Leave Lobby
                </button>
            </div>
            
            <div className="playerList">
                <label className="playersText"> Players </label>
                {players.map((id, index) => (
                    <div key={index} className={`playerEntry ${id === hostIdState ? "hostPlayer" : ""} ${id === playerID ? "currentPlayer" : ""}`}>
                        <span className="playerIndex">{index + 1}.</span>
                        <span className="playerName">{getUserName(id)}</span>
                        {id === hostIdState && <span className="hostBadge">👑 Host</span>}
                        {getUserName(id) !== getUserName(playerID) &&
                        !friends.includes(getUserName(id)) &&
                        !friendRequests.includes(getUserName(id)) && (
                            <button
                            className="FriendRequestButton"
                            onClick={sendFriendRequest}
                            data-player-id={id}
                            >
                            <FaUserPlus />
                            </button>
                        )}
                    </div>
                ))}
               {playerNum >= 2 && players.length < playerNum && (
               <button className="InviteFriendsButton" onClick={inviteFriendsClicked}>
                    Invite friends
                    <FaUserPlus style={{ marginLeft: "8px", marginBottom: "4px", fontSize:"18px"}} />
                </button>
                )}
            </div>

            
        </div>
        {isInviteOpen && renderInviteFriends()}  
        </>
    )

}