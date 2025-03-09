import { useLocation, useNavigate } from "react-router-dom";
import { GameModes, Difficulties } from "../shared_modules/shared_enums";
import "../styles/Lobby.css";
import { roundCount } from "./Home";
import axiosInstance from "../utils/axiosInstance";
import { useEffect, useState } from "react";


export default function Lobby () {
    const location = useLocation();
    var { toBasee = 2, playerNum = 1, gameMode = GameModes.CLASSIC.toString(), difficulty = Difficulties.LAYMAN.toString(), gameId = "" } = location.state || {};
    const navigate = useNavigate();
    const [startGameFlag, setStartGameFlag] = useState(false);

    useEffect(() => {
        if (startGameFlag) {
          navigate("/Game", { state: { toBasee:toBasee, playerNum, gameMode, difficulty, gameId } });
        }
    }, [startGameFlag]);  // This effect runs when `gameId` is updated

    function handleStartGame() {
        setStartGameFlag(true);
    }

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
            <label className="mainLobbyText"> Ovo je lobby! </label>            
            {showLobbyStats()}
            <button className="btn btn-success" onClick={handleStartGame}>
                Start Game!
            </button>
        </div>
    )

}