import { ChatMessage, ChatMode } from '../types';

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
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (line.startsWith('data:')) {
                    const jsonString = line.substring(5).trim();
                    if (jsonString) {
                        try {
                            const parsed = JSON.parse(jsonString);
                            if (parsed.text) {
                                onChunk(parsed.text);
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
            throw new Error(errorJson.error || errorJson.detail || "Terjadi kesalahan yang tidak diketahui.");
        } catch (e) {
            const errorText = await response.text();
            throw new Error(`Image generation failed: ${response.status} ${errorText}`);
        }
    }

    const result = await response.json();
    if (!result.imageUrl) {
        throw new Error("API did not return a valid image URL.");
    }

    return result.imageUrl; // Returns a Base64 data URL directly
}
