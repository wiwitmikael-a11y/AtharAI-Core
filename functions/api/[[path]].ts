// This file should be placed in `functions/api/[[path]].ts`
// It acts as a serverless backend proxy on Cloudflare Pages, now powered by a high-speed open-source stack.

// IMPORTANT: You need to add `GROQ_API_KEY` and `FIREWORKS_API_KEY` to your Cloudflare environment variables.

// ULTIMATE FIX v4: Removed the 'groq-sdk' dependency entirely. We now use a direct `fetch` call
// to the Groq API. This completely sidesteps the module resolution issue that was causing the deployment to fail.

interface Env {
  GROQ_API_KEY: string;
  FIREWORKS_API_KEY: string;
}

enum ChatMode {
  General = 'General',
  Coding = 'Coding',
}

interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

// Helper to transform conversation history for Groq (Llama 3 format)
const buildGroqHistory = (history: ChatMessage[]) => {
  return history.slice(1).map(msg => ({
    role: msg.role === 'model' ? 'assistant' : msg.role,
    content: msg.content,
  }));
};

// Cloudflare Pages Function onRequest handler
export const onRequest = async (context: { request: Request; env: Env; waitUntil: (promise: Promise<any>) => void }): Promise<Response> => {
    const { request, env, waitUntil } = context;
    const url = new URL(request.url);
    const groqApiKey = env.GROQ_API_KEY;
    const fireworksApiKey = env.FIREWORKS_API_KEY;

    if (!groqApiKey || !fireworksApiKey) {
      return new Response("API keys for Groq and/or Fireworks are not configured.", { status: 500 });
    }

    // Routing
    if (url.pathname.startsWith('/api/stream')) {
        try {
            const { mode, history, prompt } = await request.json() as { mode: ChatMode.General | ChatMode.Coding, history: ChatMessage[], prompt: string };
            
            const systemPrompt = mode === ChatMode.Coding 
                ? "You are a world-class expert software engineer. Provide clear, concise, and correct code. Use markdown for code blocks with language identifiers."
                : "You are a helpful and friendly AI assistant. Be insightful and thorough in your responses.";
            
            const messages = [
                { role: 'system', content: systemPrompt },
                ...buildGroqHistory(history),
                { role: 'user', content: prompt }
            ];

            const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${groqApiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'llama3-8b-8192',
                    messages,
                    stream: true,
                }),
            });
            
            if (!groqResponse.ok) {
                const errorBody = await groqResponse.text();
                throw new Error(`Groq API Error: ${groqResponse.status} ${errorBody}`);
            }

            // Pipe the streaming response from Groq to our client
            const { readable, writable } = new TransformStream();
            const writer = writable.getWriter();
            const reader = groqResponse.body!.getReader();
            const decoder = new TextDecoder();
            const encoder = new TextEncoder();

            const streamProcessor = async () => {
                let buffer = '';
                try {
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;

                        buffer += decoder.decode(value, { stream: true });
                        const lines = buffer.split('\n');
                        buffer = lines.pop() || '';

                        for (const line of lines) {
                            if (line.startsWith('data:')) {
                                const jsonString = line.substring(5).trim();
                                if (jsonString === '[DONE]') continue;
                                
                                try {
                                    const parsed = JSON.parse(jsonString);
                                    const text = parsed.choices[0]?.delta?.content || '';
                                    if (text) {
                                        const clientSseChunk = `data: ${JSON.stringify({ text })}\n\n`;
                                        await writer.write(encoder.encode(clientSseChunk));
                                    }
                                } catch (e) {
                                    console.error('Failed to parse Groq stream chunk:', jsonString);
                                }
                            }
                        }
                    }
                } catch (error) {
                    console.error("Error during Groq stream processing:", error);
                    const errorMessage = error instanceof Error ? error.message : "Unknown stream error";
                    const errorChunk = `data: ${JSON.stringify({ error: errorMessage })}\n\n`;
                    await writer.write(encoder.encode(errorChunk));
                } finally {
                    await writer.close();
                }
            };

            waitUntil(streamProcessor());

            return new Response(readable, {
                headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' }
            });

        } catch (error) {
            console.error("Error in /api/stream endpoint:", error);
            const message = error instanceof Error ? error.message : "An unknown error occurred.";
            return new Response(JSON.stringify({ error: "Backend stream failed", detail: message }), { 
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

    } else if (url.pathname.startsWith('/api/image')) {
        try {
            const { prompt } = await request.json() as { prompt: string };
            const fireworksResponse = await fetch('https://api.fireworks.ai/inference/v1/text_to_image/accounts/fireworks/models/stable-diffusion-xl-1024-v1-0', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${fireworksApiKey}`,
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    prompt: `A high-quality, cinematic photo of: ${prompt}`,
                    height: 1024,
                    width: 1024,
                    steps: 30,
                }),
            });

            if (!fireworksResponse.ok) {
                const errorBody = await fireworksResponse.text();
                throw new Error(`Fireworks API Error: ${fireworksResponse.status} ${errorBody}`);
            }

            const result = await fireworksResponse.json() as { image_b64: string };
            const imageUrl = `data:image/png;base64,${result.image_b64}`;

            return new Response(JSON.stringify({ imageUrl }), {
                headers: { 'Content-Type': 'application/json' }
            });

        } catch (error) {
            console.error("Fireworks Image Generation Error:", error);
            const message = error instanceof Error ? error.message : "Unknown error";
            const errorPayload = {
                error: "Gagal membuat gambar.",
                detail: message
            };
           return new Response(JSON.stringify(errorPayload), { 
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    }

    return new Response('Not Found', { status: 404 });
};
