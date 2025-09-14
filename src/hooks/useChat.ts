
import * as React from 'react';
import { ChatMode, ChatMessage } from '../types';
import { generateTextStream, generateImage, getVisionResponse } from '../services/huggingFaceService';
import { AppContext } from '../context/AppContext';
import { IMAGE_GENERATION_PLACEHOLDERS } from '../constants';

const MAX_RETRIES = 2; // Allow up to 2 retries (3 total attempts)

export const useChat = () => {
    const context = React.useContext(AppContext);
    if (!context) {
        throw new Error('useChat must be used within an AppProvider');
    }
    const {
        activeMode,
        conversations,
        setConversations,
        isLoading,
        setIsLoading,
        setStreamingMessage,
    } = context;

    const abortControllerRef = React.useRef<AbortController | null>(null);
    const placeholderIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
    const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    const cleanupAfterRequest = React.useCallback(() => {
        if (placeholderIntervalRef.current) {
            clearInterval(placeholderIntervalRef.current);
            placeholderIntervalRef.current = null;
        }
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
        setIsLoading(false);
        setStreamingMessage(null);
        abortControllerRef.current = null;
    }, [setIsLoading, setStreamingMessage]);
    
    const performSendWithRetries = async (prompt: string, currentConversation: ChatMessage[], retryCount = 0, imageBase64?: string | null): Promise<void> => {
        abortControllerRef.current = new AbortController();
        const signal = abortControllerRef.current.signal;
        
        // VQA and Image models can be slower
        const timeoutDuration = (activeMode === ChatMode.Media || activeMode === ChatMode.Vision) ? 180000 : 120000;
        timeoutRef.current = setTimeout(() => {
            abortControllerRef.current?.abort();
        }, timeoutDuration);
        
        try {
            if (activeMode === ChatMode.Vision) {
                 if (!imageBase64) throw new Error("Vision mode requires an image.");
                 const answer = await getVisionResponse(prompt, imageBase64, signal);
                 const finalAnswerMessage: ChatMessage = { role: 'model', content: answer };
                 setConversations(prev => ({...prev, [activeMode]: [...currentConversation, finalAnswerMessage]}));

            } else if (activeMode === ChatMode.Media) {
                let placeholderIndex = 0;
                // Only show the detailed loading UI on the first attempt
                if (retryCount === 0) {
                    const tempImageMessage: ChatMessage = {
                        role: 'model',
                        content: IMAGE_GENERATION_PLACEHOLDERS[placeholderIndex],
                        prompt: prompt,
                        isLoading: true,
                    };
                    setConversations(prev => ({...prev, [activeMode]: [...currentConversation, tempImageMessage]}));

                    placeholderIntervalRef.current = setInterval(() => {
                        placeholderIndex = (placeholderIndex + 1) % IMAGE_GENERATION_PLACEHOLDERS.length;
                        setConversations(prev => {
                            const conv = [...prev[activeMode]];
                            const lastMsg = conv[conv.length - 1];
                            if (lastMsg?.role === 'model' && lastMsg.isLoading) {
                                lastMsg.content = IMAGE_GENERATION_PLACEHOLDERS[placeholderIndex];
                                return { ...prev, [activeMode]: conv };
                            }
                            return prev;
                        });
                    }, 3500);
                }

                const imageUrl = await generateImage(prompt, signal);
                
                if (placeholderIntervalRef.current) clearInterval(placeholderIntervalRef.current);

                const finalImageMessage: ChatMessage = { role: 'model', content: '', image: imageUrl, prompt: prompt };
                setConversations(prev => ({ ...prev, [activeMode]: [...currentConversation, finalImageMessage] }));

            } else if (activeMode === ChatMode.General || activeMode === ChatMode.Coding) {
                let fullResponse = '';
                setStreamingMessage({ role: 'model', content: '' });

                await generateTextStream(
                    activeMode,
                    currentConversation,
                    prompt,
                    (chunk) => {
                        fullResponse += chunk;
                        setStreamingMessage(prev => prev ? { ...prev, content: fullResponse } : null);
                    },
                    () => {},
                    (error) => { throw error; },
                    signal
                );
                
                setConversations(prev => ({
                    ...prev,
                    [activeMode]: [...currentConversation, { role: 'model', content: fullResponse }]
                }));
            }
        } catch (error) {
            // Clear timers and intervals for the failed attempt
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            if (placeholderIntervalRef.current) {
                clearInterval(placeholderIntervalRef.current);
                placeholderIntervalRef.current = null;
            }
            
            const errorMessage = (error as Error).message;
            const isModelLoadingError = errorMessage.includes("Model sedang dimuat");

            if (isModelLoadingError && retryCount < MAX_RETRIES) {
                const waitTimeMatch = errorMessage.match(/(\d+)\s*detik/);
                const waitTimeSeconds = waitTimeMatch ? parseInt(waitTimeMatch[1], 10) : 20;

                const retryUIMessage: ChatMessage = {
                    role: 'model',
                    content: `Model sedang dimuat oleh penyedia layanan. Mencoba lagi secara otomatis dalam ${waitTimeSeconds} detik... (Percobaan ${retryCount + 1}/${MAX_RETRIES})`
                };
                
                setConversations(prev => ({ ...prev, [activeMode]: [...currentConversation, retryUIMessage] }));
                setStreamingMessage(null);

                await new Promise(resolve => setTimeout(resolve, waitTimeSeconds * 1000));
                
                // Remove the retry message before the next attempt for a clean UI
                setConversations(prev => ({ ...prev, [activeMode]: currentConversation }));
                
                // Recursive call for the next retry attempt
                return performSendWithRetries(prompt, currentConversation, retryCount + 1, imageBase64);
            }

            // If not retrying, format and display the final error message
            let errorContent: string;
            if ((error as Error).name === 'AbortError') {
                errorContent = "Maaf, permintaan membutuhkan waktu terlalu lama untuk direspon. Ini kemungkinan karena layanan gratis sedang sibuk atau sedang memuat model besar untuk pertama kalinya. Silakan coba lagi sesaat lagi.";
            } else if (isModelLoadingError) {
                 errorContent = `Model masih gagal dimuat setelah beberapa kali percobaan. Layanan mungkin sedang sibuk. Silakan coba lagi nanti. Pesan dari server: "${errorMessage}"`;
            } else {
                errorContent = `Maaf, terjadi kesalahan: ${(error as Error).message}`;
            }

            const finalErrorMessage = { role: 'model' as const, content: errorContent };
            setConversations(prev => ({ ...prev, [activeMode]: [...currentConversation, finalErrorMessage] }));
        }
    };
    
    const sendMessage = React.useCallback(async (userInput: string, imageBase64?: string | null) => {
        if (isLoading) return;

        if (activeMode === ChatMode.Vision && !imageBase64) {
            alert("Please provide an image for Vision mode.");
            return;
        }
        if (activeMode !== ChatMode.Vision && !userInput.trim()) {
            return;
        }

        setIsLoading(true);
        
        // Use a default prompt for vision mode if the user doesn't provide one
        const prompt = userInput.trim() || (activeMode === ChatMode.Vision ? "What do you see in this image?" : "");
        
        const userMessage: ChatMessage = {
            role: 'user',
            content: prompt,
            ...(imageBase64 && { image: imageBase64 }),
        };
        const updatedConversation = [...conversations[activeMode], userMessage];
        setConversations(prev => ({ ...prev, [activeMode]: updatedConversation }));

        try {
            await performSendWithRetries(prompt, updatedConversation, 0, imageBase64);
        } finally {
            cleanupAfterRequest();
        }
    }, [activeMode, conversations, isLoading, cleanupAfterRequest, setConversations, setIsLoading, setStreamingMessage]);
    
    const cancelRequest = React.useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            // The AbortError will be caught by the error handler in `performSendWithRetries`,
            // and the `finally` block in `sendMessage` will handle the cleanup process.
        } else {
            // If the request hasn't been dispatched but UI is loading, clean up immediately.
            cleanupAfterRequest();
        }
    }, [cleanupAfterRequest]);

    return { sendMessage, cancelRequest };
};