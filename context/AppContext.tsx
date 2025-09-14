import * as React from 'react';
import { ChatMode, ChatMessage, ConversationHistory, TodoTask } from '../types';
import { INITIAL_MESSAGES } from '../constants';

const TODO_STORAGE_KEY = 'athar_ai_todos';

interface AppContextType {
  activeMode: ChatMode;
  setActiveMode: (mode: ChatMode) => void;
  conversations: ConversationHistory;
  setConversations: React.Dispatch<React.SetStateAction<ConversationHistory>>;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  updateCurrentConversation: (messages: ChatMessage[]) => void;
  streamingMessage: ChatMessage | null;
  setStreamingMessage: React.Dispatch<React.SetStateAction<ChatMessage | null>>;
  todos: TodoTask[];
  setTodos: React.Dispatch<React.SetStateAction<TodoTask[]>>;
}

export const AppContext = React.createContext<AppContextType | null>(null);

const getInitialTodos = (): TodoTask[] => {
  try {
    const savedTodos = localStorage.getItem(TODO_STORAGE_KEY);
    return savedTodos ? JSON.parse(savedTodos) : [];
  } catch (error) {
    console.error("Failed to load todos from localStorage", error);
    return [];
  }
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeMode, setActiveMode] = React.useState<ChatMode>(ChatMode.General);
  const [conversations, setConversations] = React.useState<ConversationHistory>({
    [ChatMode.General]: [INITIAL_MESSAGES[ChatMode.General]],
    [ChatMode.Coding]: [INITIAL_MESSAGES[ChatMode.Coding]],
    [ChatMode.Media]: [INITIAL_MESSAGES[ChatMode.Media]],
    [ChatMode.Todo]: [INITIAL_MESSAGES[ChatMode.Todo]],
  });
  const [isLoading, setIsLoading] = React.useState(false);
  const [streamingMessage, setStreamingMessage] = React.useState<ChatMessage | null>(null);
  const [todos, setTodos] = React.useState<TodoTask[]>(getInitialTodos);

  React.useEffect(() => {
    try {
        localStorage.setItem(TODO_STORAGE_KEY, JSON.stringify(todos));
    } catch (error) {
        console.error("Failed to save todos to localStorage", error);
    }
  }, [todos]);

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
        streamingMessage,
        setStreamingMessage,
        todos,
        setTodos
      }}
    >
      {children}
    </AppContext.Provider>
  );
};
