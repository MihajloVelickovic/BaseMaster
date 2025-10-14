import { useState, useEffect, useRef } from "react";
import "../styles/Game.css";
import { useLocation, useNavigate } from "react-router-dom";
import { GameModes, Difficulties, DifficultyValues, IdPrefixes } from "../shared_modules/shared_enums";
import axiosInstance from "../utils/axiosInstance";

var maxVal:bigint = BigInt(255);
var numToFind = getRandomNumber(1, Number(maxVal));   //this appears to be unneeded
const maxBase = 32;

function getUserName (id: string) {
  if (id && id != "") {
    return id.split("_")[0];
  }
  return "";
}

function clcBtnCount(base:bigint, maxValue:bigint) {
  var count = 0, currVal=maxValue;
  while(currVal > 0) {
    ++count;
    currVal = currVal / base;
  }
  return count;
}

function getRandomNumber(min:number, max:number) {
  min = Math.floor(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}


function Game() {
  const location = useLocation();
  const [currRound, setCurrRound] = useState(0);
  const [currNum, setCurrNum] = useState(100);
  const [toBase, setToBase] = useState(2);
  const [fromBase, setFromBase] = useState(10);
  const [isConfirmDisabled, setIsConfirmDisabled] = useState(false);
  const [scoreboard, setScoreboard] = useState<{ value: string, score: number }[]>([]);
  const [finished, setFinished] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [playerChat, setPlayerChat] = useState<string[]>([]);
  const [chatInput, setChatInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [wsConnection, setWsConnection] = useState<WebSocket | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
useEffect(() => {
  chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
}, [playerChat]);

const navigate = useNavigate();
const { 
  toBasee = 2, 
  playerNum = 1, 
  gameMode = GameModes.CLASSIC.toString(), 
  difficulty = Difficulties.LAYMAN.toString(), 
  gameId = "", 
  playerID = "", 
  roundCount 
} = location.state || {};

console.log("toBasee je: ", toBasee);

  const getNumberFromServer = async (correct:boolean) => {
    const toSend = {
      gameId:gameId,
      currRound:currRound,
      playerId: playerID,
      correct: correct
    }
    if (currRound >= roundCount){
      setFinished(true);
      console.log("in", currRound);
      var response = await axiosInstance.post('/game/playerComplete',  {playerId: playerID, gameId: gameId, correct:correct});
      console.log(response);
      return -1;      //idk, it's unneeded
    }
    console.log("out", currRound);
    try {
      var response = await axiosInstance.post('/game/getCurrNum', toSend);
      const num:number = Number(response.data['currRndNum']);        //check the name.. if changed
      if (gameMode == GameModes.CHAOS.toString()) {
        setToBase(Number(response.data['toBase']));
        setFromBase(Number(response.data['fromBase']));
        let val = clcBtnCount(BigInt(Number(response.data['toBase'])), maxVal);
        console.log(toBase, fromBase, val);
        setNumOfButtons(val);
        setArrayOfValues(Array.from({length: val}, (_, i) => 0));
      }
      else{
        setArrayOfValues(Array.from({length: numOfButtons}, () => 0));
      }
      //console.log(response.data["scoreboard"])
      console.log(response);
      setCurrRound(currRound+1);                                  //CHANGE THIS BACK TO +1 WHEN DONE
      setCurrNum(num);
      console.log("Current round: ", currRound);
      return num;  
    }
    catch(error:any) {
      console.error("Error fetching new number:", error.response?.data || error.message);

      // If round limit is reached, disable confirm button
      if (error.response?.status === 400) {  // Adjust based on server response
          alert("Max rounds reached! No more numbers will be generated.");
          setIsConfirmDisabled(true);
      }
      return currNum;
    }
  }


  switch (difficulty) {
    case Difficulties.LAYMAN.toString(): maxVal = BigInt(DifficultyValues.LAYMAN);
      break;
    case Difficulties.CHILL_GUY.toString(): maxVal = BigInt(DifficultyValues.CHILL_GUY);
      break;
    case Difficulties.ELFAK_ENJOYER.toString(): maxVal = BigInt(DifficultyValues.ELFAK_ENJOYER);
      break;
    case Difficulties.BASED_MASTER.toString(): maxVal = BigInt(DifficultyValues.BASED_MASTER);
      break;
    default:
      maxVal = BigInt(DifficultyValues.LAYMAN);
      console.log("something went wrong for this to show up");
  }

useEffect(() => {
  if (wsRef.current) {
    console.log("WebSocket already exists, skipping");
    return;
  }

  // Guard against missing data
  if (!gameId || !playerID) {
    console.error("Missing gameId or playerID:", { gameId, playerID });
    alert("Missing game information. Redirecting to home...");
    navigate("/");
    return;
  }

  let mounted = true; // Track if component is still mounted
  const ws = new WebSocket("ws://localhost:1738");

  // Configure game mode
  switch (gameMode) {
    case "Classic":
      break;
    case "Reverse":
      setFromBase(toBasee); // Fixed: was using toBase instead of toBasee
      setToBase(10);
      break;
    case "Chaos":
      break;
    default:
      break;
  }

  // Configure difficulty
  switch (difficulty) {
    case Difficulties.LAYMAN.toString(): 
      maxVal = BigInt(DifficultyValues.LAYMAN);
      break;
    case Difficulties.CHILL_GUY.toString(): 
      maxVal = BigInt(DifficultyValues.CHILL_GUY);
      break;
    case Difficulties.ELFAK_ENJOYER.toString(): 
      maxVal = BigInt(DifficultyValues.ELFAK_ENJOYER);
      break;
    case Difficulties.BASED_MASTER.toString(): 
      maxVal = BigInt(DifficultyValues.BASED_MASTER);
      break;
    default:
      maxVal = BigInt(DifficultyValues.LAYMAN);
      console.log("something went wrong for this to show up");
  }

  ws.onopen = () => {
    if (!mounted) return;
    
    console.log("WebSocket connected");
    ws.send(JSON.stringify({ 
      type: IdPrefixes.SCOREBOARD_UPDATE, 
      gameId, 
      playerID 
    }));
    
    // NOW it's safe to get the first number - moved here from outside
    getNumberFromServer(false);
  };

  ws.onmessage = (event) => {
    if (!mounted) return; // Don't process if unmounted
    
    try {
      const data = JSON.parse(event.data);
      console.log("WS received:", data); // Debug log
      
      if (data.type === IdPrefixes.SCOREBOARD_UPDATE) {
        setScoreboard(data.scores);
        
        // Fixed comparison and check
        if (data.points !== undefined && data.points !== 0) {
          const isCurrentPlayer = playerID === String(data.playerId);
          const message = isCurrentPlayer 
            ? `You scored ${data.points} points.`
            : `Player ${getUserName(data.playerId)} scored ${data.points} points.`;
          
          setPlayerChat(prevChat => [...prevChat, message]);
        }
      }
      else if (data.type === IdPrefixes.PLAYER_LEAVE) {
        setPlayerChat(prevChat => [...prevChat, 
          `Player ${getUserName(data.playerId)} left the game.`
        ]);
      }
      else if (data.type === IdPrefixes.MESSAGE_UPDATE) {
        setPlayerChat(prevChat => [...prevChat, 
          `${getUserName(data.playerId)}: ${data.playerMessage}`
        ]);
      }
    } catch (error) {
      console.error("Error parsing WebSocket message:", error);
    }
  };

  ws.onerror = (error) => {
    console.error("WebSocket error:", error);
  };

  ws.onclose = (event) => {
    if (mounted) {
      console.log("WebSocket closed:", event.code, event.reason);
    }
  };

  // Cleanup function
  return () => {
    mounted = false;
    if (ws.readyState === WebSocket.OPEN) {
      ws.close(1000, "Component unmounting");
    } else {
      ws.close();
    }
  };
}, []); // Added dependencies

console.log("toBase: "+toBase+" playerNum: "+playerNum+" gameMode: "+gameMode+" difficulty: "+difficulty+ " gameId: "+gameId);

const sendPlayerChatMessage = async () => {
  if (!chatInput.trim()) return;
  try {
    await axiosInstance.post('/game/sendLobbyMessage', { 
      playerId: playerID, 
      message: chatInput, 
      gameId 
    });
    setChatInput("");
  } catch (error) {
    console.error("Error sending message:", error);
  }
};

const leaveGame = async () => {
  try {
    await axiosInstance.post("/game/leaveGame", { gameId, playerID });
    navigate("/");
  } catch (error) {
    console.error("Error leaving game:", error);
  }
};



  const [numOfButtons, setNumOfButtons] = useState(clcBtnCount(BigInt(toBase), maxVal));
  const [arrayOfValues, setArrayOfValues] = useState(Array.from({length: numOfButtons}, (_, i) => 0));  
  const btnArrayLabels = Array.from({ length: numOfButtons}, (_, i) => Math.pow(Number(toBase), numOfButtons - 1 - i));

  function handleButtonClick(key: number) {
    // if (!arrayOfValues[key]) {
    //   console.log("I guess It doesn't exist..");
    //   return;
    // }

    const newArray = [...arrayOfValues];
    newArray[key] = newArray[key] + 1 < toBase ? newArray[key] + 1: 0;
    setArrayOfValues(newArray);
  }

  function numToLetter(num:number) : string {
    if (num < 10) 
      return num.toString();
    return String.fromCharCode(55 + num);  
  }

  function clearButtonHandler() {
    const newArray = Array.from({length: numOfButtons}, (_, i) => 0)
    setArrayOfValues(newArray);
  }

  const confirmButtonHandler = async () => {
    //alert("Idk bro... Maybe it's right, maybe it's not.. That's like moral.. what is good, what is bad? Who knows?!");
    const result = arrayOfValues.map((val, index) => val * btnArrayLabels[index])
                                .reduce((sum, val) => sum + val, 0);
    if (result==currNum){
      alert("You got the right answer!");
    }else
      alert("Better luck next time");

    await getNumberFromServer(result==currNum);
    
    //clearButtonHandler();
    
  }

  function numtoBase(num:number, tobase:number) {
    if (tobase < 2 || tobase > 36) {
      throw new Error("Base must be between 2 and 36");
    }
    let p = 69;
    return num.toString(tobase).toUpperCase();
  }

  function generateTargetNumLabel(num: number, mode: string) {
    var text;
    switch (mode){
      case "Classic":
        text = <label className="NumToFindLabel">
                ({num})<label className="smallNumToFindLabel">{fromBase}</label> → (?)<label className="smallNumToFindLabel">{toBase}</label> 
               </label>
        break;
      case "Reverse":
        text = <label className="NumToFindLabel">
                ({numtoBase(num, fromBase)})<label className="smallNumToFindLabel">{fromBase}</label> → (?)<label className="smallNumToFindLabel">{toBase}</label> 
               </label>
        break;
      case "Chaos":
        console.log(toBase, fromBase, num, gameMode);
        text = <label className="NumToFindLabel">
                ({numtoBase(num, fromBase)})<label className="smallNumToFindLabel">{fromBase}</label> → (?)<label className="smallNumToFindLabel">{toBase}</label> 
              </label>
        break;
      default:
        text = <label className="NumToFindLabel">
                ({num})<label className="smallNumToFindLabel">{fromBase}</label> → (?)<label className="smallNumToFindLabel">{toBase}</label> 
              </label>
    }

    return (
      text
    );
 
  }

  function generateBaseButtons(btnCount: number) {
    const buttonArray = btnArrayLabels.map( (element, ind) => {
      return (
        <div className="ButtonAndLabel" key={ind}>
          <label>
            {element}
          </label>  
          <button className="BaseButton" onClick={() => handleButtonClick(ind)}>
            {numToLetter(arrayOfValues[ind])}
          </button>
        </div>
      );
    });
    return (
      <div className="AllButtonsAndLables">
        {buttonArray}
      </div>
    );
  }

  return (
    <>
      <div className="GameScreen">
        {!finished && (
          <div className="Game">
            {generateTargetNumLabel(currNum, gameMode)}
            {generateBaseButtons(numOfButtons)}
  
            <button className="ClearButton" onClick={clearButtonHandler}>Clear</button>
            <button className="ConfirmButton" onClick={confirmButtonHandler} disabled={isConfirmDisabled}>
              Confirm
            </button>
          </div>
        )}
  
        <div className="infoContainer">
          <div className="toggleContainer">
            <button className={`toggleButton ${!showChat ? 'active' : ''}`} onClick={() => setShowChat(false)}>
              Scoreboard
            </button>
            <button className={`toggleButton ${showChat ? 'active' : ''}`} onClick={() => setShowChat(true)}>
              Chat
            </button>
          </div>
  
          {!showChat ? (
            <div className="Scoreboard">
              <ul>
                {scoreboard.map((player, index) => (
                  <div key={index} className={`${player.value === playerID ? "gameCurrentPlayer" : ""}`}>
                    <li key={index}>{getUserName(player.value)}: {player.score} pts</li>
                  </div>
                ))}
              </ul>
            </div>
          ) : (
            <div className="gameChatContainer">
              <div className="gameChatMessages">
                {playerChat.map((message, index) => {
                  const isSystemMessage = message.startsWith("Player") || message.startsWith("You");
                  const [playerId, ...messageParts] = message.split(": ");
                  const messageText = messageParts.join(": ");
  
                  return (
                    <div key={index} className={`chatMessage ${isSystemMessage ? "systemMessage" : ""}`}>
                      {isSystemMessage ? (
                        <span className="systemText">{message}</span>
                      ) : (
                        <>
                          <span className="gamePlayerName">{playerId}:</span>
                          <span className="gameMessageText">{messageText}</span>
                        </>
                      )}
                    </div>
                  );
                })}
                <div ref={chatEndRef} />
              </div>
  
              <div className="chatInputContainer">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendPlayerChatMessage()}
                  placeholder="Type a message..."
                  className="chatInput"
                />
                <button onClick={sendPlayerChatMessage} className="gameSendMessageButton">Send</button>
              </div>
            </div>
          )}
  
          {!finished && !showChat && (
            <button className="leaveGameButton" onClick={() => setShowExitConfirm(true)}>
              Exit Game
            </button>
          )}
        </div>
      </div>
  
      {showExitConfirm && (
        <div className="confirmationDialog">
          <p>Are you sure you want to leave the game?</p>
          <button onClick={leaveGame}>Yes, Exit</button>
          <button onClick={() => setShowExitConfirm(false)}>Cancel</button>
        </div>
      )}
  
      {finished && (
        <div className="finishedGameButtons">
          <button className="finishedGameButton" onClick={() => navigate("/")}>Back to Home</button>
        </div>
      )}
    </>
  );
}  

export default Game;