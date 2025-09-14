import { ChatMessage, ChatMode } from '../types';

export async function warmUpModels(): Promise<void> {
  try {
    // This is a "fire-and-forget" request. We don't need to wait for the response
    // or handle its result. Its only purpose is to trigger the backend.
    fetch('/api/warmup', { method: 'POST' });
    console.log("Warming up AI models in the background...");
  } catch (error) {
    // This is a non-critical optimization, so we just log a warning if it fails.
    console.warn("Model warm-up request failed to dispatch:", error);
  }
}

export async function generateTextStream(
    mode: ChatMode.General | ChatMode.Coding,
    history: ChatMessage[],
    prompt: string,
    onChunk: (chunk: string) => void,
    onComplete: () => void,
    onError: (error: Error) => void,
    signal?: AbortSignal
): Promise<void> {
    try {
        const response = await fetch(`/api/stream`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode, history, prompt }),
            signal,
        });

        if (!response.ok || !response.body) {
            const errorText = await response.text();
            throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Keep the last partial line in the buffer

            for (const line of lines) {
                if (line.startsWith('data:')) {
                    const jsonString = line.substring(5).trim();
                    if (jsonString) {
                        try {
                            const parsed = JSON.parse(jsonString);
                            // For streaming, Hugging Face sends a `token` object.
                            if (parsed.token && parsed.token.text && !parsed.token.special) {
                                onChunk(parsed.token.text);
                            }
                        } catch (e) {
                            console.error('Failed to parse stream JSON:', jsonString, e);
                        }
                    }
                }
            }
        }
    } catch (error) {
        if ((error as Error).name !== 'AbortError') {
            console.error("Streaming error:", error);
            onError(error as Error);
        }
    } finally {
        onComplete();
    }
}

export async function generateImage(prompt: string, signal?: AbortSignal): Promise<string> {
    const response = await fetch(`/api/image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
        signal,
    });

    if (!response.ok) {
        try {
            const errorJson = await response.json();
            // Use the user-friendly error from the backend, fallback to detail
            throw new Error(errorJson.error || errorJson.detail || "Terjadi kesalahan yang tidak diketahui.");
        } catch (e) {
            // Fallback if the error response is not JSON
            const errorText = await response.text();
            throw new Error(`Image generation failed: ${response.status} ${errorText}`);
        }
    }

    const blob = await response.blob();
    return URL.createObjectURL(blob);
}