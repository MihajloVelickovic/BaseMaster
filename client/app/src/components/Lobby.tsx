import { useLocation, useNavigate } from "react-router-dom";
import { GameModes, Difficulties, GameStates } from "../shared_modules/shared_enums";
import "../styles/Lobby.css";
//import { roundCount } from "./Home";
import axiosInstance from "../utils/axiosInstance";
import { useEffect, useState } from "react";


export default function Lobby () {
    const location = useLocation();
    var { toBasee = 2, playerNum = 1, gameMode = GameModes.CLASSIC.toString(), difficulty = Difficulties.LAYMAN.toString(), gameId = "", playerID, lobbyName = "", hostId, roundCount} = location.state || {};
    console.log(playerID, 'ovo je player id');
    const navigate = useNavigate();
    const [startGameFlag, setStartGameFlag] = useState(false);

    useEffect(() => {
        const ws = new WebSocket("ws://localhost:1738");
        if (startGameFlag) {
            navigate("/Game", { state: { toBasee:toBasee, playerNum, gameMode, difficulty, gameId, playerID } });
        }

        ws.onopen = () => {
            
            ws.send(JSON.stringify({ type: "joinLobby", gameId, playerID }));
        };
        
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            console.log(data);
            setStartGameFlag(true);
        };
  
        return () => ws.close(); // Cleanup WebSocket on unmount

    }, [startGameFlag]);  // This effect runs when `gameId` is updated

    // function handleStartGame() {
    //     setStartGameFlag(true);
    // }

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


    useEffect(() => {
        const handleBeforeUnload = () => leaveLobby();
    
        window.addEventListener("beforeunload", handleBeforeUnload);
    
        return () => {
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

    return (                                                // change the label txt to LOBBY on release
        <div className="LobbyContainer ">
            <label className="mainLobbyText"> {lobbyName} Lobby </label>            
            {showLobbyStats()}

            {playerID === hostId ? (
                <button className="startGameButton" onClick={handleStartGame}>
                    Start Game!
                </button>
            ) : (
                <div className="waitingText">Waiting for lobby owner to start the game...</div>
            )}
            
            <button className="startGameButton leaveLobbyButton" onClick={() => navigate("/")}>
                Leave Lobby
            </button>
        </div>
    )

}