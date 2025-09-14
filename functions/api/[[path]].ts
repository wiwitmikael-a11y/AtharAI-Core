// This file should be placed in `functions/api/[[path]].ts`
// It acts as a serverless backend proxy on Cloudflare Pages, now powered by a high-speed open-source stack.

// IMPORTANT: You need to add `GROQ_API_KEY` and `FIREWORKS_API_KEY` to your Cloudflare environment variables.

// DEFINITIVE FIX v3: Import the Groq SDK from a CDN to resolve the build error on Cloudflare.
// This avoids the need for a package.json and npm install step.
import Groq from 'https://esm.sh/groq-sdk@0.5.0'; // Corrected URL with https://

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
  // Take all messages except the very first "Welcome" message
  return history.slice(1).map(msg => ({
    // FIX: The Groq API expects the 'assistant' role for model responses,
    // but the application uses 'model'. This maps the role to be compatible.
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
            
            const groq = new Groq({ apiKey: groqApiKey });

            const systemPrompt = mode === ChatMode.Coding 
                ? "You are a world-class expert software engineer. Provide clear, concise, and correct code. Use markdown for code blocks with language identifiers."
                : "You are a helpful and friendly AI assistant. Be insightful and thorough in your responses.";
            
            const messages = [
                { role: 'system', content: systemPrompt },
                ...buildGroqHistory(history),
                { role: 'user', content: prompt }
            ];

            const groqStream = await groq.chat.completions.create({
                model: 'llama3-8b-8192', // State-of-the-art open source model
                messages,
                stream: true,
            });

            const { readable, writable } = new TransformStream();
            const writer = writable.getWriter();
            const encoder = new TextEncoder();

            const streamProcessor = async () => {
                try {
                    for await (const chunk of groqStream) {
                        const text = chunk.choices[0]?.delta?.content || '';
                        if (text) {
                            const sseFormattedChunk = `data: ${JSON.stringify({ text })}\n\n`;
                            await writer.write(encoder.encode(sseFormattedChunk));
                        }
                    }
                } catch (error) {
                    console.error("Error during stream processing:", error);
                    const errorMessage = error instanceof Error ? error.message : "Unknown stream processing error";
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
            const message = error instanceof Error ? error.message : "An unknown error occurred in the stream endpoint.";
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
                    steps: 30, // Good balance of quality and speed
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
    } else if (url.pathname.startsWith('/api/warmup')) {
      // Warmup is no longer needed for these fast serverless platforms
      return new Response(JSON.stringify({ message: "Warmup not required" }), { status: 200 });
    }

    return new Response('Not Found', { status: 404 });
};
