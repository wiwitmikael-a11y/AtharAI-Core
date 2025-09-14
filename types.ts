// FIX: Removed self-import of `ChatMode` to resolve declaration conflict.
export enum ChatMode {
  General = 'General',
  Coding = 'Coding',
  Media = 'Media',
  Todo = 'Todo',
}

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
  image?: string; // For generated image URL
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
