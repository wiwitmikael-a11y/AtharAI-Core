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

    const sendMessage = React.useCallback(async (userInput: string) => {
        if (!userInput.trim() || isLoading) return;

        const userMessage: ChatMessage = { role: 'user', content: userInput };
        const updatedConversation = [...conversations[activeMode], userMessage];
        setConversations(prev => ({ ...prev, [activeMode]: updatedConversation }));

        setIsLoading(true);
        abortControllerRef.current = new AbortController();
        const signal = abortControllerRef.current.signal;

        try {
            if (activeMode === ChatMode.Media) {
                let placeholderIndex = 0;
                // Create a dedicated loading message state
                const tempImageMessage: ChatMessage = {
                    role: 'model',
                    content: IMAGE_GENERATION_PLACEHOLDERS[placeholderIndex],
                    prompt: userInput,
                    isLoading: true, // Mark this message for special rendering
                };
                setConversations(prev => ({...prev, [activeMode]: [...updatedConversation, tempImageMessage]}));

                // Cycle through placeholder texts
                placeholderIntervalRef.current = setInterval(() => {
                    placeholderIndex = (placeholderIndex + 1) % IMAGE_GENERATION_PLACEHOLDERS.length;
                    const newContent = IMAGE_GENERATION_PLACEHOLDERS[placeholderIndex];
                    setConversations(prev => {
                        const conv = [...prev[activeMode]];
                        const lastMsg = conv[conv.length - 1];
                        if (lastMsg && lastMsg.role === 'model' && lastMsg.isLoading) {
                            lastMsg.content = newContent;
                            return { ...prev, [activeMode]: conv };
                        }
                        return prev;
                    });
                }, 2500);

                const imageUrl = await generateImage(userInput, signal);

                const finalImageMessage: ChatMessage = {
                    role: 'model',
                    content: 'Here is the image you requested.',
                    image: imageUrl,
                    prompt: userInput,
                };
                
                // Replace the loading message with the final image message
                setConversations(prev => {
                     const conv = [...updatedConversation]; // Start from after the user message
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
            if ((error as Error).name !== 'AbortError') {
                console.error("Error during generation:", error);
                const errorMessage = { role: 'model', content: `Sorry, an error occurred: ${(error as Error).message}` };
                setConversations(prev => ({ ...prev, [activeMode]: [...updatedConversation, errorMessage] }));
            }
        } finally {
            if (placeholderIntervalRef.current) {
                clearInterval(placeholderIntervalRef.current);
                placeholderIntervalRef.current = null;
            }
            setIsLoading(false);
            setStreamingMessage(null);
            abortControllerRef.current = null;
        }
    }, [activeMode, conversations, isLoading, setConversations, setIsLoading, setStreamingMessage]);
    
    const cancelRequest = React.useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        if (placeholderIntervalRef.current) {
            clearInterval(placeholderIntervalRef.current);
            placeholderIntervalRef.current = null;
        }
        setIsLoading(false);
        setStreamingMessage(null);

        if (activeMode === ChatMode.Media) {
             // Remove the loading message on cancellation
            setConversations(prev => {
                const currentConversation = prev[activeMode];
                const lastMessage = currentConversation[currentConversation.length - 1];
                if (lastMessage && lastMessage.role === 'model' && lastMessage.isLoading) {
                    return { ...prev, [activeMode]: currentConversation.slice(0, -1) };
                }
                return prev;
            });
        }
    }, [activeMode, setIsLoading, setConversations, setStreamingMessage]);

    return { sendMessage, cancelRequest };
};