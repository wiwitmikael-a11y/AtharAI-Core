export enum ChatMode {
  General = 'General',
  Coding = 'Coding',
  Media = 'Media',
}

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
  image?: string; // For generated image URL
  prompt?: string; // The prompt used to generate the image
}

export type ConversationHistory = {
  [key in ChatMode]: ChatMessage[];
};
