import { useState, useContext, useEffect, useRef } from 'react';
import { AppContext } from '../context/AppContext';
import { ChatMessage, ChatMode } from '../types';
import { generateTextStream, generateImage } from '../services/huggingFaceService';
import { IMAGE_GENERATION_PLACEHOLDERS } from '../constants';

export const useChat = () => {
    const [input, setInput] = useState('');
    const context = useContext(AppContext);
    const placeholderIntervalRef = useRef<number | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);
    const isFirstRequestRef = useRef({
        [ChatMode.General]: true,
        [ChatMode.Coding]: true,
        [ChatMode.Media]: true,
    });

    if (!context) {
        throw new Error('useChat must be used within an AppProvider');
    }

    const {
        activeMode: mode,
        isLoading,
        setIsLoading,
        conversations,
        setConversations,
    } = context;

    const messages = conversations[mode];

    // Cleanup interval on unmount
    useEffect(() => {
        return () => {
            if (placeholderIntervalRef.current) {
                clearInterval(placeholderIntervalRef.current);
            }
        };
    }, []);

    const cancelRequest = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        setIsLoading(false);
        if (placeholderIntervalRef.current) {
            clearInterval(placeholderIntervalRef.current);
        }
        // Clean up temporary messages from conversation
        setConversations(prev => {
            const currentHistory = prev[mode];
            const lastMessage = currentHistory[currentHistory.length - 1];
            if (lastMessage && lastMessage.role === 'model' && (lastMessage.prompt?.startsWith('placeholder-') || lastMessage.content === '')) {
                return { ...prev, [mode]: currentHistory.slice(0, -1) };
            }
            return prev;
        });
    };

    const sendMessage = async (userInput: string) => {
        if (!userInput.trim() || isLoading) return;

        abortControllerRef.current = new AbortController();
        const userMessage: ChatMessage = { role: 'user', content: userInput };
        const newMessages = [...messages, userMessage];
        setConversations(prev => ({ ...prev, [mode]: newMessages }));
        setInput('');
        setIsLoading(true);

        try {
            if (mode === ChatMode.Media) {
                const placeholderId = `placeholder-${Date.now()}`;
                let placeholderIndex = 0;
                const placeholderMessage: ChatMessage = { 
                    role: 'model', 
                    content: IMAGE_GENERATION_PLACEHOLDERS[placeholderIndex], 
                    prompt: placeholderId 
                };
                setConversations(prev => ({ ...prev, [mode]: [...newMessages, placeholderMessage] }));

                placeholderIntervalRef.current = window.setInterval(() => {
                    placeholderIndex = (placeholderIndex + 1) % IMAGE_GENERATION_PLACEHOLDERS.length;
                    const nextPlaceholder = IMAGE_GENERATION_PLACEHOLDERS[placeholderIndex];
                    setConversations(prev => ({
                        ...prev,
                        [mode]: prev[mode].map(m =>
                            m.prompt === placeholderId ? { ...m, content: nextPlaceholder } : m
                        ),
                    }));
                }, 2500);

                const imageUrl = await generateImage(userInput, abortControllerRef.current.signal);
                isFirstRequestRef.current[mode] = false; // Mark as no longer the first request
                
                if (placeholderIntervalRef.current) clearInterval(placeholderIntervalRef.current);

                const modelMessage: ChatMessage = { role: 'model', content: '', image: imageUrl, prompt: userInput };
                setConversations(prev => ({
                    ...prev,
                    [mode]: prev[mode].map(m => (m.prompt === placeholderId ? modelMessage : m)),
                }));
            } else {
                let fullResponse = '';
                const initialContent = isFirstRequestRef.current[mode]
                    ? "🚀 Model is warming up... First response might take up to a minute."
                    : "";
                const modelMessage: ChatMessage = { role: 'model', content: initialContent };
                let hasStartedStreaming = false;

                setConversations(prev => ({ ...prev, [mode]: [...newMessages, modelMessage] }));

                await generateTextStream(
                    mode,
                    messages,
                    userInput,
                    (chunk) => {
                        if (isFirstRequestRef.current[mode] && !hasStartedStreaming) {
                            fullResponse = ''; // Clear the "warming up" message
                            hasStartedStreaming = true;
                            isFirstRequestRef.current[mode] = false;
                        }
                        fullResponse += chunk;
                        setConversations(prev => ({ ...prev, [mode]: [...newMessages, { role: 'model', content: fullResponse }] }));
                    },
                    () => {},
                    (error) => {
                        console.error("Stream error", error);
                        setConversations(prev => ({ ...prev, [mode]: [...newMessages, { role: 'model', content: `Maaf, terjadi kesalahan: ${error.message}` }] }));
                    },
                    abortControllerRef.current.signal
                );
            }
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                console.log("Request successfully cancelled by user.");
                return;
            }
            if (placeholderIntervalRef.current) clearInterval(placeholderIntervalRef.current);
            console.error("API call failed:", error);
            const errorMessage = error instanceof Error ? error.message : "Terjadi kesalahan yang tidak diketahui.";
            setConversations(prev => ({...prev, [mode]: [...messages, userMessage, { role: 'model', content: `Error: ${errorMessage}` }]}));
        } finally {
            if (placeholderIntervalRef.current) clearInterval(placeholderIntervalRef.current);
            setIsLoading(false);
            abortControllerRef.current = null;
        }
    };

    return {
        input,
        setInput,
        sendMessage,
        cancelRequest,
    };
};