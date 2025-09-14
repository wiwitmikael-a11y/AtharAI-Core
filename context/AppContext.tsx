import React, { createContext, useState, ReactNode } from 'react';
import { ChatMode, ChatMessage, ConversationHistory } from '../types';
import { INITIAL_MESSAGES } from '../constants';

interface AppContextType {
  activeMode: ChatMode;
  setActiveMode: (mode: ChatMode) => void;
  conversations: ConversationHistory;
  setConversations: React.Dispatch<React.SetStateAction<ConversationHistory>>;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  updateCurrentConversation: (messages: ChatMessage[]) => void;
}

export const AppContext = createContext<AppContextType | null>(null);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [activeMode, setActiveMode] = useState<ChatMode>(ChatMode.General);
  const [conversations, setConversations] = useState<ConversationHistory>({
    [ChatMode.General]: [INITIAL_MESSAGES[ChatMode.General]],
    [ChatMode.Coding]: [INITIAL_MESSAGES[ChatMode.Coding]],
    [ChatMode.Media]: [INITIAL_MESSAGES[ChatMode.Media]],
  });
  const [isLoading, setIsLoading] = useState(false);

  const updateCurrentConversation = (messages: ChatMessage[]) => {
    setConversations(prev => ({ ...prev, [activeMode]: messages }));
  };

  return (
    <AppContext.Provider
      value={{
        activeMode,
        setActiveMode,
        conversations,
        setConversations,
        isLoading,
        setIsLoading,
        updateCurrentConversation,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};
