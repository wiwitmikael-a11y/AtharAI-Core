// This file should be placed in `functions/api/[[path]].ts`
// It acts as a serverless backend proxy on Cloudflare Pages, now powered by the free Hugging Face Inference API.
// NO API KEYS ARE REQUIRED.

interface Env {} // No environment variables are needed anymore.

// Expanded for completeness, though not all are used in this specific file's logic.
enum ChatMode {
  General = 'General',
  Coding = 'Coding',
  Vision = 'Vision',
  Media = 'Media',
  Todo = 'Todo',
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

// Helper to generate a minimal payload for a status check based on model type
const getStatusPayload = (modelId: string, isText: boolean) => {
    if (isText) {
        return { model: modelId, messages: [{ role: 'user', content: 'status' }], max_tokens: 1, stream: false };
    }
    // VQA models require a specific object structure
    if (modelId.includes('vilt-b32-finetuned-vqa')) {
        return { inputs: { question: "status", image: "" } }; // Send minimal "valid-like" payload
    }
    // Default for other inference endpoints like Stable Diffusion
    return { inputs: 'status' };
};


// Helper to check the status of a single Hugging Face model endpoint
const checkModelStatus = async (modelId: string, isText: boolean): Promise<'online' | 'loading' | 'offline'> => {
    try {
        const payload = getStatusPayload(modelId, isText);
        
        const url = isText
            ? 'https://api-inference.huggingface.co/v1/chat/completions'
            : `https://api-inference.huggingface.co/models/${modelId}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        // A 422 error means the service is running but our minimal payload is invalid.
        // For our status check, this is a successful "online" signal.
        if (response.ok || response.status === 422) {
            return 'online';
        }

        const errorBody = await response.json();
        if (errorBody.error && errorBody.estimated_time) {
            return 'loading';
        }
        return 'offline';
    } catch (error) {
        return 'offline';
    }
};


// Cloudflare Pages Function onRequest handler
export const onRequest = async (context: { request: Request; env: Env; waitUntil: (promise: Promise<any>) => void }): Promise<Response> => {
    const { request, waitUntil } = context;
    const url = new URL(request.url);

    // Routing
    if (url.pathname.startsWith('/api/stream')) {
        try {
            const { mode, history, prompt } = await request.json() as { mode: ChatMode.General | ChatMode.Coding, history: ChatMessage[], prompt: string };
            
            const isCodingMode = mode === ChatMode.Coding;
            
            const model = isCodingMode 
                ? 'codellama/CodeLlama-70b-Instruct-hf' // Specialized model for coding
                : 'meta-llama/Meta-Llama-3-70B-Instruct'; // General purpose SOTA model

            const systemPrompt = isCodingMode
                ? "You are an elite software architect and programmer named AtharAI. Your code is clean, efficient, and follows best practices. Provide detailed explanations for your code. Use markdown for all code blocks, specifying the language."
                : "You are AtharAI, a helpful and friendly AI assistant based on Llama 3. Be insightful, comprehensive, and thorough in your responses.";
            
            const messages = [
                { role: 'system', content: systemPrompt },
                ...buildApiHistory(history),
                { role: 'user', content: prompt }
            ];
            
            const apiResponse = await fetch('https://api-inference.huggingface.co/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model,
                    messages,
                    stream: true,
                    max_tokens: 4096,
                }),
            });
            
            if (!apiResponse.ok) {
                const errorBody = await apiResponse.text();
                try {
                    const errorJson = JSON.parse(errorBody);
                    if (errorJson.error && errorJson.estimated_time) {
                        throw new Error(`Model sedang dimuat, silakan coba lagi dalam ${Math.ceil(errorJson.estimated_time)} detik.`);
                    }
                    throw new Error(errorJson.error || `Hugging Face API Error: ${apiResponse.status}`);
                } catch (e) {
                    console.error("Hugging Face API Error:", errorBody);
                    throw new Error(`Hugging Face API Error: ${apiResponse.status} ${errorBody}`);
                }
            }

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
            const hfResponse = await fetch('https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    inputs: prompt,
                }),
            });

            if (!hfResponse.ok) {
                const errorBody = await hfResponse.text();
                 try {
                    const errorJson = JSON.parse(errorBody);
                    if (errorJson.error && errorJson.estimated_time) {
                        throw new Error(`Model sedang dimuat, silakan coba lagi dalam ${Math.ceil(errorJson.estimated_time)} detik.`);
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
    } else if (url.pathname.startsWith('/api/vision')) {
        try {
            const { prompt, imageBase64 } = await request.json() as { prompt: string, imageBase64: string };

            if (!prompt || !imageBase64) {
                return new Response(JSON.stringify({ error: "Prompt and image are required."}), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
            
            const hfResponse = await fetch('https://api-inference.huggingface.co/models/dandelin/vilt-b32-finetuned-vqa', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    inputs: {
                        question: prompt,
                        image: imageBase64,
                    }
                }),
            });

            if (!hfResponse.ok) {
                const errorBody = await hfResponse.text();
                try {
                    const errorJson = JSON.parse(errorBody);
                    if (errorJson.error && errorJson.estimated_time) {
                        throw new Error(`Model sedang dimuat, silakan coba lagi dalam ${Math.ceil(errorJson.estimated_time)} detik.`);
                    }
                    throw new Error(errorJson.error || `Hugging Face VQA API Error: ${hfResponse.status}`);
                } catch (e) {
                    throw new Error(`Hugging Face VQA API Error: ${hfResponse.status} ${errorBody}`);
                }
            }
            
            const result = await hfResponse.json();
            const topAnswer = result?.[0]?.answer || "Maaf, saya tidak bisa menemukan jawaban dari gambar tersebut.";

            return new Response(JSON.stringify({ answer: topAnswer }), {
                headers: { 'Content-Type': 'application/json' }
            });

        } catch (error) {
            console.error("Hugging Face VQA Error:", error);
            const message = error instanceof Error ? error.message : "Unknown error";
            const errorPayload = {
                error: "Gagal menganalisis gambar.",
                detail: message
            };
            return new Response(JSON.stringify(errorPayload), { 
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    } else if (url.pathname.startsWith('/api/wakeup')) {
        try {
            // Send a minimal, non-streaming request to the main model to check its status.
            const model = 'meta-llama/Meta-Llama-3-70B-Instruct';
            const apiResponse = await fetch('https://api-inference.huggingface.co/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model,
                    messages: [{ role: 'user', content: 'Hello' }],
                    stream: false,
                    max_tokens: 2,
                }),
            });

            if (!apiResponse.ok) {
                const errorBody = await apiResponse.json();
                if (errorBody.error && errorBody.estimated_time) {
                    // Model is loading, this is an expected "error" during wakeup.
                    // We send a specific status code and the time to the client.
                    return new Response(JSON.stringify({
                        status: 'loading',
                        estimated_time: Math.ceil(errorBody.estimated_time)
                    }), { status: 202 }); // 202 Accepted
                }
                // For other errors, treat them as actual failures.
                throw new Error(errorBody.error || `Hugging Face API Error: ${apiResponse.status}`);
            }

            // If we get a 200 OK, the model is ready.
            return new Response(JSON.stringify({ status: 'ready' }), { status: 200 });

        } catch (error) {
            console.error("Wakeup call failed:", error);
            const message = error instanceof Error ? error.message : "Unknown error";
            return new Response(JSON.stringify({ error: "Wakeup failed", detail: message }), { 
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    } else if (url.pathname.startsWith('/api/status')) {
        const modelsToCheck = {
            'meta-llama/Meta-Llama-3-70B-Instruct': true,
            'codellama/CodeLlama-70b-Instruct-hf': true,
            'dandelin/vilt-b32-finetuned-vqa': false,
            'stabilityai/stable-diffusion-xl-base-1.0': false,
        };

        const promises = Object.entries(modelsToCheck).map(([modelId, isTextModel]) => 
            checkModelStatus(modelId, isTextModel).then(status => ({ modelId, status }))
        );

        const results = await Promise.all(promises);
        const statuses = results.reduce((acc, { modelId, status }) => {
            acc[modelId] = status;
            return acc;
        }, {} as Record<string, 'online' | 'loading' | 'offline'>);

        return new Response(JSON.stringify(statuses), {
            headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' }
        });
    }


    return new Response('Not Found', { status: 404 });
};