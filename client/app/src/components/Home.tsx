import { NavLink, useLocation, useNavigate } from "react-router-dom";
import "../styles/Home.css"
import { JSXElementConstructor, ReactElement, ReactNode, ReactPortal, useEffect, useState } from "react";
import axiosInstance from "../utils/axiosInstance";   //ovde za sad ne treba
import {GameModes, Difficulties} from "../shared_modules/shared_enums"
import { useAuth } from '../utils/AuthContext';

//export const roundCount = 15;
const maxValue = 255;
const gameID = "gameID";
const playerID = Math.floor(Math.random()*10000).toString();
console.log(playerID);

function getUserName (id: string) {
  if (id && id != "") {
    return id.split("_")[0];
  }
  return "";
}

interface LeaderboardEntry {
  username: string;
  bestScore: number;
  firsts: number;
  seconds: number;
  thirds: number;
  fourths: number;
}

function Home() {
  const location = useLocation();
  var { playerIdTransfered = ""} = location.state || {};
  const { playerID } = useAuth();
  const [toBase, setToBase] = useState(2);
  const [playerNum, setPlayerNum] = useState(1);
  const [gameMode, setGameMode] = useState(GameModes.CLASSIC.toString());
  const [difficulty, setDifficulty] = useState(Difficulties.LAYMAN.toString());
  const [gameId, setGameId] = useState(null);
  const [playerId, setPlayerId] = useState<string|null>(playerID);


  const [browsingLobbies, setBrowsingLobbies] = useState(false);
  const [lobbies, setLobbies] = useState<[string, number, number, string][]>([]);
  const [advancedOptions, setAdvancedOptions] = useState(false);
  const [lobbyName, setLobbyName] = useState("");
  const [roundCount, setRoundCount] = useState(Number(5));    //switch to 15 later
  const [clickedLobbies, setClickedLobbies] = useState<Map<string, boolean>>(new Map());
  // const [playerId, setPlayerId] = useState(playerID);

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loggedIn, setLoggedIn] = useState<boolean>(true); // TODO: replace with real auth state

  const navigate = useNavigate();
  const bases = Array.from({ length: 31}, (_, i) => i+2);
  const players = Array.from({length: 4}, (_, i) => i+1);
  // const gameModes = ["Classic", "Reverse", "Chaos", "Arithmetic classic", "Arithmetic chaos"];  
  const gameModes:string[] = Object.values(GameModes);
  const difficulties:string[] = Object.values(Difficulties);

  useEffect(() => {
    if (loggedIn) {
      fetchLeaderboard();
    }
  }, [loggedIn]);
  
  useEffect(() => {
    if (gameId) {
      navigate("/Lobby", { state: { toBasee:toBase, playerNum, gameMode, difficulty, gameId, playerID: playerId? playerId : "", roundCount, lobbyName: playerIdTransfered!=""? playerIdTransfered : "Enie", hostId: playerId? playerId : "" } });
    }
    // console.log("here");
    // console.log(location.state?.playerIdTransfered, "this is it");
    // setPlayerId(location.state?.playerIdTransfered);
  }, [gameId]);  // This effect runs when `gameId` is updated

  const fetchLeaderboard = async () => {
    try {
      const res = await axiosInstance.get("/game/globalLeaderboard", {
        params: { limit: 20 }
      });
      setLeaderboard(res.data.items || []);
      console.log(res.data);
    } catch (err) {
      console.error("Error fetching leaderboard", err);
    }
  };

  // leaderboard component
  const renderLeaderboard = () => (
    <div className="LeaderboardContainer">
      <div className="leaderboardTitle">Global Leaderboard 🌍</div>
      <ul className="leaderboardList">
        {leaderboard.length > 0 ? (
          leaderboard.map((entry, i) => (
            <li key={i} className="leaderboardItem">
              <span className="lb-rank">#{i + 1}</span>
              <span className="lb-name">{entry.username}</span>
              <span className="lb-score">{entry.bestScore}</span>
            </li>
          ))
        ) : (
          <li className="leaderboardEmpty">No players yet.</li>
        )}
      </ul>
    </div>
  );

  const createGame = async () => {
    try {
        const toSend = {
          gamemode: gameMode,
          playerCount: playerNum,
          roundCount: Math.max(1, Math.min(roundCount, 128)),
          difficulty: difficulty,
          hostId:playerId? playerId : "",
          toBase:toBase,
          lobbyName: lobbyName.trim() || "NONE"
        };
        var response = await axiosInstance.post('/game/createGame', toSend);
        console.log("response za createGame je: ", response);
        const gId = response.data[`${gameID}`];        //check the name.. if changed
        console.log("gameId je: ", gId);
        setGameId(gId);

        const finalLobbyName = lobbyName.trim() ? lobbyName : `${gId.slice(-5)}`;
        setLobbyName(finalLobbyName);

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

    } catch (error:any) {
      console.error('Error fetching lobbies: ', error.response ? error.response.data : error.message);
    }
  };

  const joinLobby = async (selectedGameId: string, isFull:boolean) => {
    if (isFull) {
      setClickedLobbies(prev => {
          const newMap = new Map(prev);
          newMap.set(selectedGameId, true);
          return newMap;
      });

      setTimeout(() => {
          setClickedLobbies(prev => {
              const newMap = new Map(prev);
              newMap.delete(selectedGameId);
              return newMap;
          });
      }, 3000);
      return;
  }

  try {
      const response = await axiosInstance.post('/game/joinLobby', { gameId: selectedGameId, playerId: playerId!=""? playerId : playerID });
      console.log(response);

      const { gameId, gameData, players, lobbyName } = response.data;
      const toBase = Number(gameData.toBase);
      const playerNum = gameData.maxPlayers;
      const gameMode = gameId.split('_')[0];
      const difficulty = gameData.difficulty; 
      const hostId = players[0];
      const roundCount = gameData.roundCount;
      const playerIds = players;
      const finalLobbyName = lobbyName;

      navigate("/Lobby", { state: { toBase, playerNum, gameMode,
                           difficulty, gameId: selectedGameId, playerID: playerId? playerId : "",
                            hostId, roundCount, playerIds:playerIds, lobbyName:finalLobbyName } });

  } catch (error: any) {
      console.error('Error joining lobby:', error.response ? error.response.data : error.message);

      if (error.response?.data?.message === "Lobby is full") {
          setClickedLobbies(prev => {
              const newMap = new Map(prev);
              newMap.set(selectedGameId, true);
              return newMap;
          });

          setTimeout(() => {
              setClickedLobbies(prev => {
                  const newMap = new Map(prev);
                  newMap.delete(selectedGameId);
                  return newMap;
              });
          }, 3000);
      }
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
          <div className="lobbyColumnNames">
            <div className="lobbyColumnNameItem">Game</div>
            <div className="lobbyColumnNameItem lobbyColumnNameItemPlayer">Players
            </div>
            <button className="refresh-button-small" onClick={fetchLobbies}>
              🔄
            </button>  
            
          </div>
          
          {lobbies.map((lobby) => (
              renderLobbyButton(lobby)
          ))}          
      </>
      ) : (
        <p className="no-lobbies">No available lobbies.</p>
      )}
    </div>

    );
  }
  
  function renderLobbyButton(lobby: any[]) {
    const isFull = lobby[1] >= lobby[2]; 
    const isClicked = clickedLobbies.get(lobby[0]) || false; 

    return (
      <button 
        key={lobby[0]}
        className={`lobby-item ${isClicked ? "clicked-button" : ""}`} 
        onClick={() => joinLobby(lobby[0], isFull)}
        disabled={isClicked} 
      >
        {isClicked ? (
          <span className="players">Lobby is full!</span>
        ) : (
          <>
         <span className="game-id ">{lobby[3] !== "NONE" ? lobby[3] : lobby[0].slice(-5)}</span>
          <span className="players">{lobby[1]}/{lobby[2]}</span>
        </>
        )}
      </button>
    );
  }

  const renderAdvancedOptions = () => {
    return (
      <>
        <div className="choosingDiv centerAlignItems">
          <label className="smallFont choosingLabel"> 
            Round count: 
          </label> 
          <input className="advancedOptionsInput inputFont" value={roundCount}
          onChange={e => setRoundCount(Math.min(64,Math.max(1,Number(e.target.value))))} type="number"/>
        </div>
        <div className="choosingDiv centerAlignItems">
          <label className="smallFont choosingLabel"> 
            Lobby name:            
          </label>
          <input className="advancedOptionsInput inputFont" 
          value={lobbyName} onChange={e => setLobbyName(e.target.value.toString().slice(0,10))}/> 
          </div>
      </>
    );
  }

  function Chooser<T extends string | number>(choosingArray: T[], state: T, setState: (value: T) => void, text: string, labelTxt: string, disabled: boolean = false) {
    function onSelection(value: T, event: React.MouseEvent<HTMLButtonElement>) {
      if (!disabled) {
          setState(value);
  
          const dropdown = (event.target as HTMLElement).closest(".dropdown");
          if (dropdown) {
              const button = dropdown.querySelector(".dropdown-toggle");
              if (button) {
                  button.setAttribute("aria-expanded", "false"); 
                  dropdown.classList.remove("show"); 
                  const menu = dropdown.querySelector(".dropdown-menu");
                  if (menu) {
                      menu.classList.remove("show"); 
                  }
              }
           }
        }
    }
  
    const basesButtons = choosingArray.map((val, ind) => {
      return (
        <li className="choosingFont" key={ind}>
          <button className="dropdown-item" onClick={(e) => onSelection(val,e)} disabled={disabled} data-bs-dismiss="dropdown">
            {text} {val}
          </button>
        </li>
      )
    })
    return (
    <div className="choosingDiv">
    
      <label className="smallFont choosingLabel">{labelTxt}</label>
      <div className="dropdown choosingBtn">
        <button key={text || state} className="btn btn-secondary dropdown-toggle choosingBtn" type="button" data-bs-toggle="dropdown" aria-expanded="false"
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

  function handleAdvanceOptions(){
    setAdvancedOptions(!advancedOptions);
  }

  return (
  <div className="HomePage">
    <div className="HomeAndLeaderboard">
      <div className="HomeContainer">
        {/* Existing Create Game / Browse Lobbies code */}
        <div className="lobbyOptionDiv">
          <button className={`btn ${!browsingLobbies ? 'btn-primary' : 'btn-secondary'} lobbyOptionButton`} onClick={() => setBrowsingLobbies(false)}>
            Create Game
          </button>
          <button className={`btn ${browsingLobbies ? 'btn-primary' : 'btn-secondary '} lobbyOptionButton`} onClick={() => { setBrowsingLobbies(true); fetchLobbies(); }}>
            Browse Lobbies
          </button>
        </div>  
        {!browsingLobbies ? (
          <>
            <label className="mainFont">Game Options</label>
            {Chooser(bases, toBase, setToBase, "Base ", "Choose Base:", gameMode === GameModes.CHAOS)}
            {Chooser(players, playerNum, setPlayerNum, "Players: ", "Choose player count:")}
            {Chooser(gameModes, gameMode, setGameMode, "", "Choose Game Mode:")}
            {Chooser(difficulties, difficulty, setDifficulty, "", "Choose difficulty:")}

            {!advancedOptions ? (
              <button className="advancedOptions" onClick={handleAdvanceOptions}>˅</button>
            ) : (
              <>
                <label className="advancedLabel">Advanced Options</label>
                {renderAdvancedOptions()}
                <button className="advancedOptions" onClick={handleAdvanceOptions}>˄</button>
              </>
            )}
            <button className="createLobbyButton" onClick={createGame}>Create Lobby</button>
          </>
        ) : (
          <>
            <label className="mainFont">Available Lobbies</label>
            {showLobbies()}
          </>
        )}
      </div>

      <div className="LeaderboardContainer">
        <h3 className="leaderboardTitle">🌍 Global Leaderboard</h3>
        <ul className="leaderboardList">
          {leaderboard.length > 0 ? leaderboard.map((e, i) => (
            <li key={i} className="leaderboardItem">
              <span className="rank">#{i + 1}</span>
              <span className="player">{e.username}</span>
              <span className="score">{e.bestScore}</span>
            </li>
          )) : (
            <p className="noPlayers">No players yet.</p>
          )}
        </ul>
      </div>
    </div>
  </div>
);

}

export default Home;
