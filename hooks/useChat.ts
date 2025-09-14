
import * as React from 'react';
import { ChatMode, ChatMessage } from '../types';
import { generateTextStream, generateImage } from '../services/huggingFaceService';
import { AppContext } from '../context/AppContext';
import { IMAGE_GENERATION_PLACEHOLDERS } from '../constants';

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

    const cleanupAfterRequest = () => {
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
    };

    const sendMessage = React.useCallback(async (userInput: string) => {
        if (!userInput.trim() || isLoading) return;

        const userMessage: ChatMessage = { role: 'user', content: userInput };
        const updatedConversation = [...conversations[activeMode], userMessage];
        setConversations(prev => ({ ...prev, [activeMode]: updatedConversation }));

        setIsLoading(true);
        abortControllerRef.current = new AbortController();
        const signal = abortControllerRef.current.signal;

        // Set a timeout to prevent indefinite loading for large models
        const timeoutDuration = activeMode === ChatMode.Media ? 180000 : 120000; // 3 mins for images, 2 mins for text
        timeoutRef.current = setTimeout(() => {
            abortControllerRef.current?.abort();
        }, timeoutDuration);

        try {
            if (activeMode === ChatMode.Media) {
                let placeholderIndex = 0;
                const tempImageMessage: ChatMessage = {
                    role: 'model',
                    content: IMAGE_GENERATION_PLACEHOLDERS[placeholderIndex],
                    prompt: userInput,
                    isLoading: true,
                };
                setConversations(prev => ({...prev, [activeMode]: [...updatedConversation, tempImageMessage]}));

                placeholderIntervalRef.current = setInterval(() => {
                    placeholderIndex = (placeholderIndex + 1) % IMAGE_GENERATION_PLACEHOLDERS.length;
                    const newContent = IMAGE_GENERATION_PLACEHOLDERS[placeholderIndex];
                    setConversations(prev => {
                        const conv = [...prev[activeMode]];
                        const lastMsg = conv[conv.length - 1];
                        if (lastMsg?.role === 'model' && lastMsg.isLoading) {
                            lastMsg.content = newContent;
                            return { ...prev, [activeMode]: conv };
                        }
                        return prev;
                    });
                }, 3500); // Slower interval for longer wait

                const imageUrl = await generateImage(userInput, signal);

                const finalImageMessage: ChatMessage = {
                    role: 'model',
                    content: 'Here is the image you requested.',
                    image: imageUrl,
                    prompt: userInput,
                };
                
                setConversations(prev => {
                     const conv = [...updatedConversation];
                     return { ...prev, [activeMode]: [...conv, finalImageMessage] };
                });

            } else if (activeMode === ChatMode.General || activeMode === ChatMode.Coding) {
                let fullResponse = '';
                setStreamingMessage({ role: 'model', content: '' });

                await generateTextStream(
                    activeMode,
                    updatedConversation,
                    userInput,
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
                    [activeMode]: [...updatedConversation, { role: 'model', content: fullResponse }]
                }));
            }
        } catch (error) {
            console.error("Error during generation:", error);
            let errorContent: string;

            if ((error as Error).name === 'AbortError') {
                errorContent = "Maaf, permintaan membutuhkan waktu terlalu lama untuk direspon. Ini kemungkinan karena layanan gratis sedang sibuk atau sedang memuat model besar untuk pertama kalinya. Silakan coba lagi sesaat lagi.";
            } else {
                errorContent = `Maaf, terjadi kesalahan: ${(error as Error).message}`;
            }

            // Replace loading message or add new error message
            if (activeMode === ChatMode.Media) {
                setConversations(prev => {
                    const conv = [...updatedConversation];
                    return { ...prev, [activeMode]: [...conv, { role: 'model', content: errorContent }] };
                });
            } else {
                const errorMessage = { role: 'model', content: errorContent };
                setConversations(prev => ({ ...prev, [activeMode]: [...updatedConversation, errorMessage] }));
            }
        } finally {
            cleanupAfterRequest();
        }
    }, [activeMode, conversations, isLoading, setConversations, setIsLoading, setStreamingMessage]);
    
    const cancelRequest = React.useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        cleanupAfterRequest();

        if (activeMode === ChatMode.Media) {
            setConversations(prev => {
                const currentConversation = prev[activeMode];
                const lastMessage = currentConversation[currentConversation.length - 1];
                if (lastMessage?.role === 'model' && lastMessage.isLoading) {
                    return { ...prev, [activeMode]: currentConversation.slice(0, -1) };
                }
                return prev;
            });
        }
    }, [activeMode, setIsLoading, setConversations, setStreamingMessage]);

    return { sendMessage, cancelRequest };
};
