import React, { useRef, useEffect, useState, useContext } from 'react';
import { ChatMessage, ChatMode } from '../types';
import { MODE_DETAILS, DownloadIcon, SendIcon, UserIcon, CopyIcon, CopiedIcon } from '../constants';
import BrandIcon from './BrandIcon';
import { AppContext } from '../context/AppContext';
import { useChat } from '../hooks/useChat';

const MessageBubble: React.FC<{ message: ChatMessage }> = ({ message }) => {
    const [copied, setCopied] = useState(false);
    const isModel = message.role === 'model';
    const hasCode = message.content.includes('```');

    const handleCopy = () => {
        navigator.clipboard.writeText(message.content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className={`flex items-start gap-4 my-5 ${isModel ? '' : 'flex-row-reverse'}`}>
            <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ring-2 ring-white/10 shadow-lg ${isModel ? 'bg-gradient-to-br from-indigo-500 to-purple-600' : 'bg-gradient-to-br from-sky-500 to-cyan-600'}`}>
                {isModel ? <BrandIcon className="w-7 h-7" /> : <UserIcon />}
            </div>
            <div className={`group relative p-4 rounded-2xl max-w-xl lg:max-w-3xl border border-white/10 shadow-md text-slate-200 ${isModel ? 'bg-black/20 rounded-tl-none' : 'bg-black/30 rounded-tr-none'}`}>
                {isModel && hasCode && (
                     <button
                        onClick={handleCopy}
                        className="absolute top-2 right-2 p-1.5 bg-slate-700/50 rounded-md text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label="Copy code to clipboard"
                    >
                        {copied ? <CopiedIcon /> : <CopyIcon />}
                    </button>
                )}
                {message.image ? (
                    <div>
                        <img src={message.image} alt={message.prompt} className="rounded-lg max-w-full h-auto border-2 border-white/10" />
                        <p className="text-sm text-slate-400 mt-2 italic">Prompt: "{message.prompt}"</p>
                    </div>
                ) : (
                    <p className="whitespace-pre-wrap">{message.content}</p>
                )}
            </div>
        </div>
    );
};

const ChatWindow: React.FC = () => {
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const context = useContext(AppContext);
    
    if (!context) throw new Error('ChatWindow must be used within an AppProvider');
    // FIX: Destructure `activeMode` and `conversations` from context and derive `messages`.
    const { activeMode: mode, conversations, isLoading } = context;
    const messages = conversations[mode];
    
    const { input, setInput, sendMessage } = useChat();

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [messages]);

    const handleExport = () => {
        const header = `AtharAI Core Conversation\nMode: ${mode}\nExported on: ${new Date().toLocaleString()}\n\n`;
        const content = messages.map(msg => {
            if (msg.role === 'user') return `You: ${msg.content}`;
            if (msg.image) return `AtharAI: [Image generated with prompt: "${msg.prompt}"]`;
            return `AtharAI: ${msg.content}`;
        }).join('\n\n');

        const blob = new Blob([header + content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `AtharAI-Chat-${mode}-${Date.now()}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        sendMessage(input);
    };
    
    return (
        <div className="flex flex-col h-full bg-black/20 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl">
            <header className="flex items-center justify-between p-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                    <span className="text-sky-300">{MODE_DETAILS[mode].icon}</span>
                    <h2 className="text-xl font-bold">{MODE_DETAILS[mode].name}</h2>
                </div>
                <button
                    onClick={handleExport}
                    className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-200 bg-white/5 hover:bg-white/10 rounded-md transition-colors border border-white/10"
                    aria-label="Export conversation"
                >
                    <DownloadIcon />
                    Export
                </button>
            </header>

            <div className="flex-1 overflow-y-auto p-6" aria-live="polite">
                {messages.map((msg, index) => (
                    <MessageBubble key={index} message={msg} />
                ))}
                <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t border-white/10">
                <form onSubmit={handleSubmit} className="relative">
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSubmit(e);
                            }
                        }}
                        placeholder={MODE_DETAILS[mode].placeholder}
                        className="w-full bg-black/30 border border-white/10 rounded-lg py-3 pl-4 pr-16 resize-none focus:outline-none focus:ring-2 focus:ring-sky-400/80 transition-shadow text-slate-200 placeholder-slate-400"
                        rows={1}
                        disabled={isLoading}
                        aria-label="Chat input"
                    />
                    <button
                        type="submit"
                        disabled={isLoading || !input.trim()}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-gradient-to-br from-sky-500 to-cyan-500 text-white disabled:from-slate-600 disabled:to-slate-700 disabled:cursor-not-allowed hover:from-sky-400 transition-all duration-200 transform hover:scale-110"
                        aria-label="Send message"
                    >
                        {isLoading ? (
                            <div className="w-6 h-6 border-2 border-t-transparent border-white rounded-full animate-spin"></div>
                        ) : (
                            <SendIcon />
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default ChatWindow;