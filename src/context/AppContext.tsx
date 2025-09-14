import * as React from 'react';
import { ChatMode, ChatMessage, ConversationHistory, TodoTask, ModelStatus } from '../types';
import { INITIAL_MESSAGES, MODEL_API_IDS } from '../constants';
import { getModelStatuses } from '../services/huggingFaceService';

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
  modelStatuses: Record<string, ModelStatus>;
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
    [ChatMode.Vision]: [INITIAL_MESSAGES[ChatMode.Vision]],
    [ChatMode.Media]: [INITIAL_MESSAGES[ChatMode.Media]],
    [ChatMode.Todo]: [INITIAL_MESSAGES[ChatMode.Todo]],
  });
  const [isLoading, setIsLoading] = React.useState(false);
  const [streamingMessage, setStreamingMessage] = React.useState<ChatMessage | null>(null);
  const [todos, setTodos] = React.useState<TodoTask[]>(getInitialTodos);
  const [modelStatuses, setModelStatuses] = React.useState<Record<string, ModelStatus>>({});

  React.useEffect(() => {
    try {
        localStorage.setItem(TODO_STORAGE_KEY, JSON.stringify(todos));
    } catch (error) {
        console.error("Failed to save todos to localStorage", error);
    }
  }, [todos]);

  // Fetch model statuses on initial load and then periodically
  React.useEffect(() => {
    const fetchStatuses = async () => {
        try {
            const statuses = await getModelStatuses();
            setModelStatuses(statuses);
        } catch (error) {
            console.error("Failed to fetch model statuses:", error);
            const offlineStatuses = Object.values(MODEL_API_IDS).reduce((acc, id) => {
                if (id) acc[id] = 'offline';
                return acc;
            }, {} as Record<string, ModelStatus>);
            setModelStatuses(offlineStatuses);
        }
    };

    fetchStatuses(); // Initial fetch
    const intervalId = setInterval(fetchStatuses, 30000); // Fetch every 30 seconds

    return () => clearInterval(intervalId); // Cleanup on unmount
  }, []);


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
        setTodos,
        modelStatuses,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};