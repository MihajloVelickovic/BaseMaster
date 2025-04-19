import React, { createContext, useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import axiosInstance from "../utils/axiosInstance";

type LobbyContextType = {
  joinLobby: (selectedGameId: string, isFull: boolean) => Promise<void>;
  playerID: string;
  setPlayerID: React.Dispatch<React.SetStateAction<string>>;
};

const LobbyContext = createContext<LobbyContextType | undefined>(undefined);

export const LobbyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [playerID, setPlayerID] = useState<string>("");
  const navigate = useNavigate();

  const joinLobby = async (selectedGameId: string, isFull: boolean) => {
    if (isFull) {
      return; // You can customize how to handle full lobbies here too
    }

    try {
      const response = await axiosInstance.post('/game/joinLobby', {
        gameId: selectedGameId,
        playerId: playerID,
      });

      const { gameId, gameData, players, lobbyName } = response.data;

      const toBase = Number(gameData.toBase);
      const playerNum = gameData.maxPlayers;
      const gameMode = gameId.split('_')[0];
      const difficulty = gameData.difficulty;
      const hostId = players[0];
      const roundCount = gameData.roundCount;
      const playerIds = players;

      navigate("/Lobby", {
        state: {
          toBase,
          playerNum,
          gameMode,
          difficulty,
          gameId: selectedGameId,
          playerID,
          hostId,
          roundCount,
          playerIds,
          lobbyName,
        },
      });

    } catch (error: any) {
      console.error('Error joining lobby:', error.response?.data || error.message);
    }
  };

  return (
    <LobbyContext.Provider value={{ joinLobby, playerID, setPlayerID }}>
      {children}
    </LobbyContext.Provider>
  );
};

export const useLobbyContext = () => {
  const context = useContext(LobbyContext);
  if (!context) {
    throw new Error("useLobbyContext must be used within a LobbyProvider");
  }
  return context;
};
