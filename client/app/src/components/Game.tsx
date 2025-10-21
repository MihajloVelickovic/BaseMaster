import { useState, useEffect, useRef, useCallback } from "react";
import "../styles/Game.css";
import { useLocation, useNavigate } from "react-router-dom";
import { GameModes, Difficulties, DifficultyValues, IdPrefixes } from "../shared_modules/shared_enums";
import axiosInstance from "../utils/axiosInstance";
import { useWebSocket } from "../utils/WebSocketContext";

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
  const { subscribe, unsubscribe, sendMessage } = useWebSocket();
  const hasJoinedLobby = useRef(false);

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


  const getNumberFromServer = async (correct: boolean) => {
  try {
    const response = await axiosInstance.post('/game/submitResult', {
      gameId,
      playerId: playerID,
      correct
    });
    
    // Server tells us if game is done
    const { currRndNum, hasNext, finished, fromBase: newFromBase, toBase: newToBase } = response.data;
    
    if (finished || !hasNext) {
      setFinished(true);
      await axiosInstance.post('/game/playerComplete', {
        playerId: playerID,
        gameId: gameId,
        correct: correct
      });
      return;
    }
    
    // Update UI for next round
    setCurrNum(Number(currRndNum));
    
    if (gameMode === GameModes.CHAOS.toString()) {
      setToBase(Number(newToBase));
      setFromBase(Number(newFromBase));
      let val = clcBtnCount(BigInt(Number(newToBase)), maxVal);
      setNumOfButtons(val);
      setArrayOfValues(Array.from({length: val}, () => 0));
    } else {
      setArrayOfValues(Array.from({length: numOfButtons}, () => 0));
    }
    return hasNext && !finished;
  } catch (error: any) {
    console.error("Error submitting result:", error.response?.data || error.message);
    return false;
  }
};


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
  }

  // Message handlers
  const handleScoreboardUpdate = useCallback((data: any) => {
    setScoreboard(data.scores);

    if (data.points !== undefined && data.points !== 0) {
      const isCurrentPlayer = playerID === String(data.playerId);
      const message = isCurrentPlayer
        ? `You scored ${data.points} points.`
        : `Player ${getUserName(data.playerId)} scored ${data.points} points.`;

      setPlayerChat(prevChat => [...prevChat, message]);
    }
  }, [playerID]);

  const handlePlayerLeave = useCallback((data: any) => {
    setPlayerChat(prevChat => [...prevChat,
      `Player ${getUserName(data.playerId)} left the game.`
    ]);
  }, []);

  const handleMessageUpdate = useCallback((data: any) => {
    setPlayerChat(prevChat => [...prevChat,
      `${getUserName(data.playerId)}: ${data.playerMessage}`
    ]);
  }, []);

  // Join game lobby and subscribe to messages
  useEffect(() => {
    // Guard against missing data
    if (!gameId || !playerID) {
      console.error("Missing gameId or playerID:", { gameId, playerID });
      alert("Missing game information. Redirecting to home...");
      navigate("/");
      return;
    }

    // Configure game mode
    switch (gameMode) {
      case "Classic":
        break;
      case "Reverse":
        setFromBase(toBasee);
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
    }

    // Join the game lobby via WebSocket
    if (!hasJoinedLobby.current) {
      sendMessage({
        type: IdPrefixes.SCOREBOARD_UPDATE,
        gameId,
        playerID
      });
      hasJoinedLobby.current = true;

      // Fetch initial number
      fetchInitialNumber();
    }

    // Subscribe to game messages
    subscribe(IdPrefixes.SCOREBOARD_UPDATE, handleScoreboardUpdate);
    subscribe(IdPrefixes.PLAYER_LEAVE, handlePlayerLeave);
    subscribe(IdPrefixes.MESSAGE_UPDATE, handleMessageUpdate);

    return () => {
      unsubscribe(IdPrefixes.SCOREBOARD_UPDATE, handleScoreboardUpdate);
      unsubscribe(IdPrefixes.PLAYER_LEAVE, handlePlayerLeave);
      unsubscribe(IdPrefixes.MESSAGE_UPDATE, handleMessageUpdate);
    };
  }, [gameId, playerID, gameMode, difficulty, toBasee, subscribe, unsubscribe, sendMessage, handleScoreboardUpdate, handlePlayerLeave, handleMessageUpdate, navigate]);

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

const fetchInitialNumber = async () => {
  try {
    const response = await axiosInstance.get('/game/getCurrNum', {
      params: { gameId, playerId: playerID }
    });
    
    const num = Number(response.data.currRndNum);
    setCurrNum(num);

    if (response.data.scoreboard) 
      setScoreboard(response.data.scoreboard);
    

    if (gameMode === GameModes.CHAOS.toString()) {
      setToBase(Number(response.data.toBase));
      setFromBase(Number(response.data.fromBase));
      let val = clcBtnCount(BigInt(Number(response.data.toBase)), maxVal);
      setNumOfButtons(val);
      setArrayOfValues(Array.from({length: val}, () => 0));
    }
  } catch (error) {
    console.error("Error fetching initial number:", error);
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

  const [feedback, setFeedback] = useState<{show: boolean, correct: boolean}>({ 
    show: false, 
    correct: false 
  });
  const [isProcessing, setIsProcessing] = useState(false);

  const [numOfButtons, setNumOfButtons] = useState(clcBtnCount(BigInt(toBase), maxVal));
  const [arrayOfValues, setArrayOfValues] = useState(Array.from({length: numOfButtons}, (_, i) => 0));  
  const btnArrayLabels = Array.from({ length: numOfButtons}, (_, i) => Math.pow(Number(toBase), numOfButtons - 1 - i));

  function handleButtonClick(key: number) {
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
    // Prevent multiple clicks
    if (isProcessing) return;
    
    // Disable button and show processing state
    setIsProcessing(true);
    setIsConfirmDisabled(true);
    
    const result = arrayOfValues.map((val, index) => 
      val * btnArrayLabels[index]
    ).reduce((sum, val) => sum + val, 0);
    
    const isCorrect = result === currNum;
    
   
    setFeedback({ show: true, correct: isCorrect });

    setTimeout(() => {
      setFeedback({ show: false, correct: false });            
    }, 1500);
    // Submit to server
    await getNumberFromServer(isCorrect);
    
    setIsProcessing(false);
    setIsConfirmDisabled(false);
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
            
            <button className="ClearButton" onClick={clearButtonHandler}>
              Clear
            </button>
            <button 
              className="ConfirmButton" 
              onClick={confirmButtonHandler} 
              disabled={isConfirmDisabled || isProcessing}
            >
              {isProcessing ? 'Checking...' : 'Confirm'}
            </button>
            
            {/* Add the feedback toast here */}
            {feedback.show &&  (
              <div className={`feedback-toast ${feedback.correct ? 'correct' : 'incorrect'}`}>
                {feedback.correct ? '✓ Correct!' : '✗ Better luck next time'}
              </div>
            )}
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
  
      {finished && !feedback.show && (
        <div className="finishedGameButtons">
          <button className="finishedGameButton" onClick={() => navigate("/")}>Back to Home</button>
        </div>
      )}
    </>
  );
}  

export default Game;