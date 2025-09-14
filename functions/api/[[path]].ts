
// This file should be placed in `functions/api/[[path]].ts`
// It acts as a serverless backend proxy on Cloudflare Pages, now powered by the free Hugging Face Inference API.
// NO API KEYS ARE REQUIRED.

interface Env {} // No environment variables are needed anymore.

enum ChatMode {
  General = 'General',
  Coding = 'Coding',
}

interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

// Helper to transform conversation history for Hugging Face TGI format
const buildApiHistory = (history: ChatMessage[]) => {
  // Remove the initial system message if it exists, as we'll provide a new one.
  const cleanHistory = history[0]?.role === 'model' ? history.slice(1) : history;
  
  return cleanHistory.map(msg => ({
    role: msg.role === 'model' ? 'assistant' : msg.role,
    content: msg.content,
  }));
};

// Helper to convert an ArrayBuffer to a Base64 string in a Cloudflare Worker environment
const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
};


// Cloudflare Pages Function onRequest handler
export const onRequest = async (context: { request: Request; env: Env; waitUntil: (promise: Promise<any>) => void }): Promise<Response> => {
    const { request, waitUntil } = context;
    const url = new URL(request.url);

    // Routing
    if (url.pathname.startsWith('/api/stream')) {
        try {
            const { mode, history, prompt } = await request.json() as { mode: ChatMode.General | ChatMode.Coding, history: ChatMessage[], prompt: string };
            
            const systemPrompt = mode === ChatMode.Coding 
                ? "You are an elite software architect and programmer named AtharAI. Your code is clean, efficient, and follows best practices. Provide detailed explanations for your code. Use markdown for all code blocks, specifying the language."
                : "You are AtharAI, a helpful and friendly AI assistant based on Llama 3. Be insightful, comprehensive, and thorough in your responses.";
            
            const messages = [
                { role: 'system', content: systemPrompt },
                ...buildApiHistory(history),
                { role: 'user', content: prompt }
            ];
            
            // Using Hugging Face's TGI endpoint with a state-of-the-art model
            const apiResponse = await fetch('https://api-inference.huggingface.co/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // NO 'Authorization' header is needed for the free public API
                },
                body: JSON.stringify({
                    model: 'meta-llama/Meta-Llama-3-70B-Instruct', // Upgraded to SOTA model
                    messages,
                    stream: true,
                    max_tokens: 4096,
                }),
            });
            
            if (!apiResponse.ok) {
                const errorBody = await apiResponse.text();
                console.error("Hugging Face API Error:", errorBody);
                throw new Error(`Hugging Face API Error: ${apiResponse.status} ${errorBody}`);
            }

            // The streaming logic can remain the same because the endpoint is OpenAI-compatible
            const { readable, writable } = new TransformStream();
            const writer = writable.getWriter();
            const reader = apiResponse.body!.getReader();
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
                                    // Ignore empty or malformed chunks
                                }
                            }
                        }
                    }
                } catch (error) {
                    console.error("Error during API stream processing:", error);
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
            // Switched to SDXL Base for higher quality image generation
            const hfResponse = await fetch('https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // NO 'Authorization' header is needed
                },
                body: JSON.stringify({
                    inputs: prompt,
                }),
            });

            if (!hfResponse.ok) {
                const errorBody = await hfResponse.text();
                 try {
                    const errorJson = JSON.parse(errorBody);
                    // Hugging Face can return an "estimated_time" error when the model is loading
                    if (errorJson.error && errorJson.estimated_time) {
                        throw new Error(`Model is currently loading, please try again in ${Math.ceil(errorJson.estimated_time)} seconds.`);
                    }
                    throw new Error(errorJson.error || `Hugging Face Image API Error: ${hfResponse.status}`);
                } catch (e) {
                    throw new Error(`Hugging Face Image API Error: ${hfResponse.status} ${errorBody}`);
                }
            }
            
            const imageBuffer = await hfResponse.arrayBuffer();
            const base64Image = arrayBufferToBase64(imageBuffer);
            const imageUrl = `data:image/jpeg;base64,${base64Image}`;

            return new Response(JSON.stringify({ imageUrl }), {
                headers: { 'Content-Type': 'application/json' }
            });

        } catch (error) {
            console.error("Hugging Face Image Generation Error:", error);
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
