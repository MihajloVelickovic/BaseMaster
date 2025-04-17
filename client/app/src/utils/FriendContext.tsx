import React, { createContext, useContext, useState } from "react";

type FriendContextType = {
  friends: string[];
  friendRequests: string[];
  onlineUsers: string[];
  setFriends: React.Dispatch<React.SetStateAction<string[]>>;
  setFriendRequests: React.Dispatch<React.SetStateAction<string[]>>;
  setOnlineUsers: React.Dispatch<React.SetStateAction<string[]>>;
};

const FriendContext = createContext<FriendContextType | undefined>(undefined);

export const FriendProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [friends, setFriends] = useState<string[]>([]);
  const [friendRequests, setFriendRequests] = useState<string[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);


  return (
    <FriendContext.Provider value={{ friends, setFriends, friendRequests, setFriendRequests, onlineUsers, setOnlineUsers }}>
      {children}
    </FriendContext.Provider>
  );
};

export const useFriendContext = () => {
  const context = useContext(FriendContext);
  if (!context) {
    throw new Error("useFriendContext must be used within a FriendProvider");
  }
  return context;
};