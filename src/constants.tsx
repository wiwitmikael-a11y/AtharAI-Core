import * as React from 'react';
import { ChatMode, ChatMessage } from './types';

export const MODELS: { [key in ChatMode]: string } = {
  [ChatMode.General]: "Llama 3 70B (via Hugging Face)",
  [ChatMode.Coding]: "Code Llama 70B (via Hugging Face)",
  [ChatMode.Vision]: "VILT B32 VQA (via Hugging Face)",
  [ChatMode.Media]: "Stable Diffusion XL (via Hugging Face)",
  [ChatMode.Todo]: "Local Task Management",
};

// Maps ChatMode to the specific Hugging Face model ID for backend API calls
export const MODEL_API_IDS: { [key in ChatMode]?: string } = {
  [ChatMode.General]: 'meta-llama/Meta-Llama-3-70B-Instruct',
  [ChatMode.Coding]: 'codellama/CodeLlama-70b-Instruct-hf',
  [ChatMode.Vision]: 'dandelin/vilt-b32-finetuned-vqa',
  [ChatMode.Media]: 'stabilityai/stable-diffusion-xl-base-1.0',
};


export const INITIAL_MESSAGES: { [key in ChatMode]: ChatMessage } = {
  [ChatMode.General]: {
    role: 'model',
    content: "Welcome to General & Research Mode. You're now connected to Meta's Llama 3 70B, a state-of-the-art model running on a free public endpoint. Responses may be slower but are significantly more powerful. How can I assist you?",
  },
  [ChatMode.Coding]: {
    role: 'model',
    content: "Welcome to Coding Mode, powered by Code Llama 70B. This is a highly specialized model for code generation and explanation. Please be patient, as the first request might take a moment to initialize. Let's build something incredible.",
  },
  [ChatMode.Vision]: {
    role: 'model',
    content: "Welcome to Vision Mode. Upload an image and ask me anything about it. I'm powered by a Visual Language Transformer model.",
  },
  [ChatMode.Media]: {
    role: 'model',
    content: "Welcome to Media Mode. I now use the full Stable Diffusion XL model for maximum image quality. This is slower than Turbo, but the results are far more detailed. What masterpiece shall we create?",
  },
  [ChatMode.Todo]: {
    role: 'model', // This is just a placeholder and won't be displayed
    content: "Welcome to your To-Do list.",
  },
};

export const IMAGE_GENERATION_PLACEHOLDERS = [
  '🚀 Allocating high-performance GPU on the public cluster...',
  'Loading the full Stable Diffusion XL model (10GB+)...',
  'Analyzing prompt for artistic interpretation...',
  'Rendering initial image draft...',
  'Applying high-resolution refinement steps...',
  'Finalizing composition and details...',
];

export const MODE_DETAILS = {
  [ChatMode.General]: {
    name: 'General & Research',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9V3m0 18a9 9 0 009-9m-9 9a9 9 0 00-9-9" />
      </svg>
    ),
    placeholder: 'Ask Llama 3 70B anything...'
  },
  [ChatMode.Coding]: {
    name: 'Coding',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
      </svg>
    ),
    placeholder: 'Describe the code for Code Llama...'
  },
    [ChatMode.Vision]: {
    name: 'Vision',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      </svg>
    ),
    placeholder: 'Ask a question about your image...'
  },
  [ChatMode.Media]: {
    name: 'Media',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    placeholder: 'Describe an image for SDXL...'
  },
  [ChatMode.Todo]: {
    name: 'To-Do List',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
    placeholder: 'Add a new task...'
  }
};

export const DownloadIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
    </svg>
);

export const SendIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
        <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
    </svg>
);

export const PaperclipIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path fillRule="evenodd" d="M8 4a3 3 0 00-3 3v4a5 5 0 0010 0V7a3 3 0 10-6 0v4a1 1 0 102 0V7a1 1 0 112 0v4a3 3 0 11-6 0V7a5 5 0 0110 0v4a5 5 0 01-10 0V7a3 3 0 00-3-3z" clipRule="evenodd" />
    </svg>
);

export const UserIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
    </svg>
);

export const CopyIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
);

export const CopiedIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
);

export const StopIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1zm4 0a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
    </svg>
);

export const TrashIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" />
    </svg>
);