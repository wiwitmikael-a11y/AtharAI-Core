// This file should be placed in `functions/api/[[path]].ts`
// It acts as a serverless backend proxy on Cloudflare Pages.

interface Env {
  HUGGING_FACE_API_KEY: string;
}

enum ChatMode {
  General = 'General',
  Coding = 'Coding',
  Media = 'Media',
}

interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

const MODELS = {
  [ChatMode.General]: "HuggingFaceH4/zephyr-7b-beta",
  [ChatMode.Coding]: "deepseek-ai/deepseek-coder-6.7b-instruct",
  [ChatMode.Media]: "stabilityai/stable-diffusion-xl-base-1.0",
};

const HUGGING_FACE_API_URL = "https://api-inference.huggingface.co/models/";

// This logic is moved from the frontend to the backend
const assemblePrompt = (mode: ChatMode, history: ChatMessage[], newUserMessage: string): string => {
    const contextHistory = history.length > 1 ? [] : history;

    if (mode === ChatMode.Coding) {
        const chatHistory = contextHistory.map(msg => 
            msg.role === 'user' 
            ? `### Instruction:\n${msg.content}` 
            : `### Response:\n${msg.content}`
        ).join('\n\n');
        return `${chatHistory}\n\n### Instruction:\n${newUserMessage}\n### Response:\n`;
    } else {
        const systemPrompt = "<|system|>\nYou are a helpful and friendly AI assistant.</s>";
        const chatHistory = contextHistory.map(msg =>
            msg.role === 'user'
            ? `<|user|>\n${msg.content}</s>`
            : `<|assistant|>\n${msg.content}</s>`
        ).join('\n');
        return `${systemPrompt}\n${chatHistory}\n<|user|>\n${newUserMessage}</s>\n<|assistant|>\n`;
    }
};

async function translatePromptToEnglish(prompt: string, apiKey: string): Promise<string> {
    const model = MODELS[ChatMode.General];
    const instruction = `Translate the following text from Indonesian to English. Output only the translated English text, without any additional explanations or conversational fluff. This translation will be used as a prompt for an image generation model.\n\nIndonesian text: "${prompt}"`;
    const formattedPrompt = `<|user|>\n${instruction}</s>\n<|assistant|>\n`;

    const response = await fetch(`${HUGGING_FACE_API_URL}${model}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            inputs: formattedPrompt,
            parameters: { max_new_tokens: 150, temperature: 0.1 },
        }),
    });

    if (!response.ok) throw new Error('Failed to translate prompt');

    const result = await response.json();
    const generatedText = result[0]?.generated_text || '';
    const translationParts = generatedText.split('<|assistant|>');
    const translation = translationParts.length > 1 ? translationParts[1].trim().replace(/<\/s>$/, '').trim() : '';
    
    if (!translation) throw new Error('Could not extract translation from model response.');
    
    return translation;
}


// FIX: Replace unknown `PagesFunction` with an inline type for the context.
export const onRequest = async (context: { request: Request; env: Env }): Promise<Response> => {
    const { request, env } = context;
    const url = new URL(request.url);
    const apiKey = env.HUGGING_FACE_API_KEY;

    if (!apiKey) {
      return new Response("API key is not configured.", { status: 500 });
    }

    // Basic routing
    if (url.pathname.startsWith('/api/stream')) {
        // FIX: Use type assertion on `request.json()` as it is not a generic method.
        const { mode, history, prompt } = await request.json() as { mode: ChatMode.General | ChatMode.Coding, history: ChatMessage[], prompt: string };
        const model = MODELS[mode];
        const formattedPrompt = assemblePrompt(mode, history, prompt);
        
        const hfResponse = await fetch(`${HUGGING_FACE_API_URL}${model}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                inputs: formattedPrompt,
                parameters: { max_new_tokens: 1024, temperature: 0.7, top_p: 0.95, repetition_penalty: 1.1 },
                stream: true,
            }),
        });
        
        // In Cloudflare Workers, we can stream the response directly
        const { readable, writable } = new TransformStream();
        
        // Start piping the body in the background
        if (hfResponse.body) {
            hfResponse.body.pipeTo(writable);
        }

        // Return the readable stream to the client
        return new Response(readable, {
            headers: { 'Content-Type': 'text/event-stream' }
        });

    } else if (url.pathname.startsWith('/api/image')) {
        // FIX: Use type assertion on `request.json()` as it is not a generic method.
        const { prompt } = await request.json() as {prompt: string};
        
        try {
            const translatedPrompt = await translatePromptToEnglish(prompt, apiKey);
            const model = MODELS[ChatMode.Media];
            
            const hfResponse = await fetch(`${HUGGING_FACE_API_URL}${model}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                },
                body: JSON.stringify({ inputs: translatedPrompt }),
            });

            if (!hfResponse.ok) {
                const errorText = await hfResponse.text();
                return new Response(`Hugging Face API error: ${errorText}`, { status: hfResponse.status });
            }

            return new Response(hfResponse.body, {
                headers: { 'Content-Type': 'image/jpeg' }
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error";
            return new Response(`Image generation failed: ${message}`, { status: 500 });
        }
    }

    return new Response('Not Found', { status: 404 });
};