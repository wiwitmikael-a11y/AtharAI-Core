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
    } = context;

    const abortControllerRef = React.useRef<AbortController | null>(null);
    // FIX: Changed the ref type to correctly handle the return type of `setInterval`.
    // In some environments (especially with mixed Node.js/browser typings), `setInterval`
    // returns a `NodeJS.Timeout` object instead of a `number`.
    // `ReturnType<typeof setInterval>` dynamically infers the correct type.
    const placeholderIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

    const sendMessage = React.useCallback(async (userInput: string) => {
        if (!userInput.trim() || isLoading) return;

        setIsLoading(true);
        abortControllerRef.current = new AbortController();
        const signal = abortControllerRef.current.signal;

        const userMessage: ChatMessage = { role: 'user', content: userInput };
        const currentConversation = conversations[activeMode];
        const updatedConversation = [...currentConversation, userMessage];
        setConversations(prev => ({ ...prev, [activeMode]: updatedConversation }));

        try {
            if (activeMode === ChatMode.Media) {
                // Image Generation
                let placeholderIndex = 0;
                const tempImageMessage: ChatMessage = {
                    role: 'model',
                    content: IMAGE_GENERATION_PLACEHOLDERS[placeholderIndex],
                    prompt: userInput,
                };
                setConversations(prev => ({...prev, [activeMode]: [...updatedConversation, tempImageMessage]}));

                placeholderIntervalRef.current = setInterval(() => {
                    placeholderIndex = (placeholderIndex + 1) % IMAGE_GENERATION_PLACEHOLDERS.length;
                    const newContent = IMAGE_GENERATION_PLACEHOLDERS[placeholderIndex];
                    setConversations(prev => {
                        const conv = [...prev[activeMode]];
                        const lastMsg = conv[conv.length - 1];
                        if (lastMsg && lastMsg.role === 'model') {
                            lastMsg.content = newContent;
                        }
                        return { ...prev, [activeMode]: conv };
                    });
                }, 2500);

                const imageUrl = await generateImage(userInput, signal);

                const finalImageMessage: ChatMessage = {
                    role: 'model',
                    content: 'Here is the image you requested.',
                    image: imageUrl,
                    prompt: userInput,
                };
                setConversations(prev => {
                     const conv = [...prev[activeMode]];
                     conv.pop(); // Remove placeholder
                     return { ...prev, [activeMode]: [...conv, finalImageMessage] };
                });

            } else {
                // Text Generation
                let firstChunk = true;
                let fullResponse = '';

                await generateTextStream(
                    activeMode,
                    updatedConversation,
                    userInput,
                    (chunk) => {
                        fullResponse += chunk;
                        if (firstChunk) {
                            const newModelMessage: ChatMessage = { role: 'model', content: fullResponse };
                            setConversations(prev => ({...prev, [activeMode]: [...updatedConversation, newModelMessage]}));
                            firstChunk = false;
                        } else {
                            setConversations(prev => {
                                const conv = [...prev[activeMode]];
                                const lastMsg = conv[conv.length - 1];
                                if (lastMsg && lastMsg.role === 'model') {
                                    lastMsg.content = fullResponse;
                                }
                                return { ...prev, [activeMode]: conv };
                            });
                        }
                    },
                    () => { /* onComplete */ },
                    (error) => {
                        const errorMessage: ChatMessage = {
                            role: 'model',
                            content: `Sorry, an error occurred: ${error.message}`,
                        };
                         setConversations(prev => {
                            const conv = [...prev[activeMode]];
                             // If it's not the first chunk, a partial message exists
                            if (!firstChunk) {
                                conv.pop();
                            }
                            return { ...prev, [activeMode]: [...conv, errorMessage] };
                        });
                    },
                    signal
                );
            }
        } catch (error) {
            if ((error as Error).name !== 'AbortError') {
                console.error("Failed to send message:", error);
                 const errorMessage: ChatMessage = {
                    role: 'model',
                    content: `Sorry, an error occurred: ${(error as Error).message}`,
                };
                setConversations(prev => ({ ...prev, [activeMode]: [...updatedConversation, errorMessage] }));
            }
        } finally {
            if (placeholderIntervalRef.current) {
                clearInterval(placeholderIntervalRef.current);
                placeholderIntervalRef.current = null;
            }
            setIsLoading(false);
            abortControllerRef.current = null;
        }
    }, [activeMode, conversations, isLoading, setConversations, setIsLoading]);
    
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

        // Clean up placeholder image message if it exists
        if (activeMode === ChatMode.Media) {
            setConversations(prev => {
                const currentConversation = prev[activeMode];
                const lastMessage = currentConversation[currentConversation.length - 1];
                if (lastMessage && lastMessage.role === 'model' && !lastMessage.image) {
                    return { ...prev, [activeMode]: currentConversation.slice(0, -1) };
                }
                return prev;
            });
        }
    }, [activeMode, setIsLoading, setConversations]);

    return { sendMessage, cancelRequest };
};
