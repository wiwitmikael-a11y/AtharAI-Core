import * as React from 'react';
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

export const AppContext = React.createContext<AppContextType | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeMode, setActiveMode] = React.useState<ChatMode>(ChatMode.General);
  const [conversations, setConversations] = React.useState<ConversationHistory>({
    [ChatMode.General]: [INITIAL_MESSAGES[ChatMode.General]],
    [ChatMode.Coding]: [INITIAL_MESSAGES[ChatMode.Coding]],
    [ChatMode.Media]: [INITIAL_MESSAGES[ChatMode.Media]],
  });
  const [isLoading, setIsLoading] = React.useState(false);

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