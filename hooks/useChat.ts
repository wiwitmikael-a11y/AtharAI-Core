import { useState, useContext, useEffect, useRef } from 'react';
import { AppContext } from '../context/AppContext';
import { ChatMessage, ChatMode } from '../types';
import { generateTextStream, generateImage } from '../services/huggingFaceService';
import { IMAGE_GENERATION_PLACEHOLDERS } from '../constants';

export const useChat = () => {
    const [input, setInput] = useState('');
    const context = useContext(AppContext);
    const placeholderIntervalRef = useRef<number | null>(null);

    if (!context) {
        throw new Error('useChat must be used within an AppProvider');
    }

    const {
        // FIX: Destructure `activeMode` as `mode` and include `setConversations`
        activeMode: mode,
        isLoading,
        setIsLoading,
        conversations,
        updateCurrentConversation,
        setConversations,
    } = context;

    const messages = conversations[mode];

    // Cleanup interval on unmount or mode change
    useEffect(() => {
        return () => {
            if (placeholderIntervalRef.current) {
                clearInterval(placeholderIntervalRef.current);
            }
        };
    }, [mode]);


    const sendMessage = async (userInput: string) => {
        if (!userInput.trim() || isLoading) return;

        const userMessage: ChatMessage = { role: 'user', content: userInput };
        const newMessages = [...messages, userMessage];
        updateCurrentConversation(newMessages);
        setInput('');
        setIsLoading(true);

        try {
            if (mode === ChatMode.Media) {
                const placeholderId = `placeholder-${Date.now()}`;
                let placeholderIndex = 0;

                // Add initial placeholder
                const placeholderMessage: ChatMessage = { 
                    role: 'model', 
                    content: IMAGE_GENERATION_PLACEHOLDERS[placeholderIndex], 
                    prompt: placeholderId 
                };
                updateCurrentConversation([...newMessages, placeholderMessage]);

                // Cycle through placeholders
                placeholderIntervalRef.current = window.setInterval(() => {
                    placeholderIndex = (placeholderIndex + 1) % IMAGE_GENERATION_PLACEHOLDERS.length;
                    const nextPlaceholder = IMAGE_GENERATION_PLACEHOLDERS[placeholderIndex];
                    // FIX: Use `setConversations` for functional updates.
                    setConversations(prev => ({
                        ...prev,
                        [mode]: prev[mode].map(m =>
                            m.prompt === placeholderId ? { ...m, content: nextPlaceholder } : m
                        ),
                    }));
                }, 2500);

                const imageUrl = await generateImage(userInput);
                
                if (placeholderIntervalRef.current) clearInterval(placeholderIntervalRef.current);

                const modelMessage: ChatMessage = { role: 'model', content: '', image: imageUrl, prompt: userInput };
                // FIX: Use `setConversations` for functional updates.
                setConversations(prev => ({
                    ...prev,
                    [mode]: prev[mode].map(m => (m.prompt === placeholderId ? modelMessage : m)),
                }));
            } else {
                let fullResponse = '';
                const modelMessage: ChatMessage = { role: 'model', content: '' };
                updateCurrentConversation([...newMessages, modelMessage]);

                await generateTextStream(
                    mode,
                    messages,
                    userInput,
                    (chunk) => {
                        fullResponse += chunk;
                        updateCurrentConversation([...newMessages, { role: 'model', content: fullResponse }]);
                    },
                    () => {},
                    (error) => {
                        console.error("Stream error", error);
                        updateCurrentConversation([...newMessages, { role: 'model', content: `Maaf, terjadi kesalahan: ${error.message}` }]);
                    }
                );
            }
        } catch (error) {
            if (placeholderIntervalRef.current) clearInterval(placeholderIntervalRef.current);
            console.error("API call failed:", error);
            const errorMessage = error instanceof Error ? error.message : "Terjadi kesalahan yang tidak diketahui.";
            updateCurrentConversation([...messages, userMessage, { role: 'model', content: `Error: ${errorMessage}` }]);
        } finally {
            if (placeholderIntervalRef.current) clearInterval(placeholderIntervalRef.current);
            setIsLoading(false);
        }
    };

    return {
        input,
        setInput,
        sendMessage,
    };
};