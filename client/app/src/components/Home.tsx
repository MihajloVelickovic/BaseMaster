import { NavLink, useNavigate } from "react-router-dom";
import "../styles/Home.css"
import { JSXElementConstructor, ReactElement, ReactNode, ReactPortal, useEffect, useState } from "react";
import axiosInstance from "../utils/axiosInstance";   //ovde za sad ne treba
import {GameModes, Difficulties} from "../shared_modules/shared_enums"

export const roundCount = 15;
const maxValue = 255;
const gameID = "gameID";
const playerID = Math.floor(Math.random()*10000).toString();
console.log(playerID);

function Home() {
  const [toBase, setToBase] = useState(2);
  const [playerNum, setPlayerNum] = useState(1);
  const [gameMode, setGameMode] = useState(GameModes.CLASSIC.toString());
  const [difficulty, setDifficulty] = useState(Difficulties.LAYMAN.toString());
  const [gameId, setGameId] = useState(null);

  const [browsingLobbies, setBrowsingLobbies] = useState(false);
  const [lobbies, setLobbies] = useState<[string, number, number][]>([]);

  // const [playerId, setPlayerId] = useState(playerID);

  const navigate = useNavigate();
  const bases = Array.from({ length: 31}, (_, i) => i+2);
  const players = Array.from({length: 4}, (_, i) => i+1);
  // const gameModes = ["Classic", "Reverse", "Chaos", "Arithmetic classic", "Arithmetic chaos"];  
  const gameModes:string[] = Object.values(GameModes);
  const difficulties:string[] = Object.values(Difficulties);
  
  useEffect(() => {
    if (gameId) {
      navigate("/Lobby", { state: { toBasee:toBase, playerNum, gameMode, difficulty, gameId, playerID } });
    }
  }, [gameId]);  // This effect runs when `gameId` is updated

  const createGame = async () => {
    try {
        const toSend = {
          gamemode: gameMode,
          playerCount: playerNum,
          roundCount: roundCount,
          difficulty: difficulty,
          hostId:playerID,
          toBase:toBase
        };
        var response = await axiosInstance.post('/game/createGame', toSend);
        console.log("response za createGame je: ", response);
        const gId = response.data[`${gameID}`];        //check the name.. if changed
        console.log("gameId je: ", gId);
        setGameId(gId);

    } catch (error:any) {
        console.error('Error creating game:', error.response ? error.response.data : error.message);
    }
  };

  const fetchLobbies = async () => {
    try {
      console.log("fetching lobbies...");
      const response = await axiosInstance.get('/game/getLobbies');
      console.log("response: ", response);
      setLobbies(response.data['lobbies']);

      var n = response.data['lobbies'][0].slice(-5);


    } catch (error:any) {
      console.error('Error fetching lobbies: ', error.response ? error.response.data : error.message);
    }
  };

  const joinLobby = async (selectedGameId: string) => { 
    try {
      const response = await axiosInstance.post('/game/joinLobby', { gameId: selectedGameId, playerId: playerID });
      console.log(response);
      const { messsage, gameId, gameData } = response.data;
      const toBasee:number = Number(gameData.toBase);
      const playerNumm:number = gameData.maxPlayers;
      const gameModee:string = gameId.split('_')[0];
      const difficultyy:string = gameData.difficulty;  
      navigate("/Lobby", { state: { toBase:toBasee, playerNum:playerNumm, gameMode:gameModee, difficulty:difficultyy, gameId: selectedGameId, playerID } });
    } catch (error:any) {
      console.error('Error joining lobby:', error.response ? error.response.data : error.message);
    }
  };

  function showLobbies() {
    return (
      // <div className="lobby-list">
      //       {lobbies.length > 0 ? lobbies.map((lobby) => (
      //         // <li key={lobby.gameId} className="lobby-item" onClick={() => joinLobby(lobby.gameId)}>
      //         //   Game ID: {lobby.gameId}, Players: {lobby.currentPlayers}/{lobby.maximumPlayers}
      //         // </li>
              
      //         <button key={lobby[0]} className="btn btn-info lobby-item" style={{margin: "15px"}} onClick={() => joinLobby(lobby[0])}>
      //           Game id: {lobby[0].slice(-5)}, Players: {lobby[1]}/{lobby[2]}
      //         </button>
      //       )) : <p>No available lobbies.</p>}
      //     </div>
      <div className="lobby-list">
      {lobbies.length > 0 ? (
        <>
          {lobbies.map((lobby) => (
            
              <button className=" lobby-item" onClick={() => joinLobby(lobby[0])}>
                <span className="game-id">Game: {lobby[0].slice(-5)}</span>
                <span className="players">Players: {lobby[1]}/{lobby[2]}</span>
              </button>
            
          ))}
      </>
      ) : (
        <p className="no-lobbies">No available lobbies.</p>
      )}
    </div>

    );
  }
  
  function Chooser<T extends string | number>(choosingArray: T[], state: T, setState: (value: T) => void, text: string, labelTxt: string, disabled: boolean = false) {
    function onSelection(value: T) {
      if (!disabled) {
        setState(value);
      }
    }
    const basesButtons = choosingArray.map((val, ind) => {
      return (
        <li className="choosingFont">
          <button className="dropdown-item" onClick={() => onSelection(val)} disabled={disabled}>
            {text} {val}
          </button>
        </li>
      )
    })
    return (
    <div className="choosingDiv">
    
      <label className="smallFont">{labelTxt}</label  >
      <div className="dropdown choosingBtn">
        <button className="btn btn-secondary dropdown-toggle choosingBtn" type="button" data-bs-toggle="dropdown" aria-expanded="false"
                          disabled={disabled} // Disable when needed
                          style={{ backgroundColor: disabled ? "#d3d3d3" : "", cursor: disabled ? "not-allowed" : "" }}>
          {text}{state}
        </button>
        <ul className="dropdown-menu">
          {basesButtons}
        </ul>
      </div>
    </div>  
    )

  }

  return (

    <div className="HomeContainer">
      <div className="button-group">
        <button className={`btn ${!browsingLobbies ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setBrowsingLobbies(false)}>
          Create Game
        </button>
        <button className={`btn ${browsingLobbies ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setBrowsingLobbies(true); fetchLobbies(); }}>
          Browse Lobbies
        </button>
      </div>
      
      {!browsingLobbies ? (
        <>
          <label className="mainFont">Game Options</label>
          {Chooser(bases, toBase, setToBase, "Base ", "Choose Base:", gameMode === GameModes.CHAOS)}
          {Chooser(players, playerNum, setPlayerNum, "Players: ", "Choose number of players")}
          {Chooser(gameModes, gameMode, setGameMode, "", "Choose Game Mode:")}
          {Chooser(difficulties, difficulty, setDifficulty, "", "Choose difficulty:")}
          <button className="btn btn-success game-button" onClick={createGame}>Start game buddy!</button>
        </>
      ) : (
        <>
          <label className="mainFont">Available Lobbies</label>
          {showLobbies()}
        </>
      )}
    </div>
  );
}

export default Home;
