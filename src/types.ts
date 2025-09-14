export type ModelStatus = 'online' | 'loading' | 'offline' | 'unknown';

export enum ChatMode {
  General = 'General',
  Coding = 'Coding',
  Vision = 'Vision',
  Media = 'Media',
  Todo = 'Todo',
}

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
  image?: string; // For generated OR uploaded image URL
  prompt?: string; // The prompt used to generate the image
  isLoading?: boolean; // To indicate media generation is in progress
}

export type ConversationHistory = {
  [key in ChatMode]: ChatMessage[];
};

export interface TodoTask {
  id: string;
  text: string;
  completed: boolean;
}