import { useState, useEffect } from "react";
import "../styles/Game.css";

function Game() {
  const [elapsedTime, setElapsedTime] = useState(0);
  const [message, setMessage] = useState("");
  const [startTime, setStartTime] = useState(Date.now());

  function handleClick() {
    const currentTime = Date.now();
    const timeSpent = Math.floor((currentTime - startTime) / 1000);
    setElapsedTime(timeSpent);
    setMessage(`You just wasted ${timeSpent} seconds of your life...`);
  }

  return (
    <div className="Game">
      <label className="BigText">To be continued, my dudes ;3</label>
      <button className="btn btn-secondary" onClick={handleClick}>
        Useless button~ (click me)
      </button>
      {message && <p className="message">{message}</p>}
    </div>
  );
}

export default Game;
