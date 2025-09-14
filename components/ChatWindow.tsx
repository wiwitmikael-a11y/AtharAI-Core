import * as React from 'react';
import { AppContext } from '../context/AppContext';
import { useChat } from '../hooks/useChat';
import {
  UserIcon,
  CopyIcon,
  CopiedIcon,
  DownloadIcon,
  SendIcon,
  StopIcon,
  MODELS,
  MODE_DETAILS,
} from '../constants';
import BrandIcon from './BrandIcon';
import TypingIndicator from './TypingIndicator';
import { ChatMode, ChatMessage } from '../types';

const CodeBlock: React.FC<{ language: string; code: string }> = ({ language, code }) => {
    const [copied, setCopied] = React.useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="code-block">
            <div className="code-header">
                <span>{language || 'code'}</span>
                <button onClick={handleCopy}>
                    {copied ? <CopiedIcon /> : <CopyIcon />}
                    <span className={copied ? 'copied-text' : ''}>{copied ? 'Copied!' : 'Copy'}</span>
                </button>
            </div>
            <pre><code>{code}</code></pre>
        </div>
    );
};

const renderMessageContent = (content: string) => {
    const parts = content.split(/(```(?:[a-z]*\n)?[\s\S]*?```)/g);

    return parts.map((part, index) => {
        if (!part) return null;
        
        const codeBlockMatch = part.match(/^```([a-z]*)\n?([\s\S]*?)```$/);
        if (codeBlockMatch) {
            const language = codeBlockMatch[1];
            const code = codeBlockMatch[2].trim();
            return <CodeBlock key={index} language={language} code={code} />;
        } else {
            const formattedPart = part
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\n(\s*)\* (.*)/g, (match, p1, p2) => `<li class="ml-4 list-disc">${p2}</li>`)
                .replace(/<li>/g, '<ul><li>')
                .replace(/<\/li>\n(?!<li)/g, '</li></ul>');
            return <div key={index} className="prose prose-invert prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: formattedPart.replace(/\n/g, '<br />') }} />;
        }
    });
};


const MessageBubble: React.FC<{ message: ChatMessage }> = React.memo(({ message }) => {
    const handleDownload = () => {
        if (message.image) {
            const link = document.createElement('a');
            link.href = message.image;
            link.download = `${message.prompt?.replace(/\s+/g, '_') || 'generated_image'}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    const isUser = message.role === 'user';
    const isImage = !!message.image;

    // Premium loading state for image generation
    if (message.isLoading && message.role === 'model') {
        return (
            <div className="flex items-start gap-3 my-4 animate-fadeIn">
                <BrandIcon className="w-8 h-8 flex-shrink-0 mt-1" />
                <div className="group relative max-w-2xl w-fit rounded-2xl text-white bg-slate-700/50 rounded-bl-lg p-4">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-5 h-5 border-2 border-sky-400 border-t-transparent rounded-full animate-spin"></div>
                        <span className="font-semibold">Generating Image...</span>
                    </div>
                    <p className="text-sm text-slate-300 italic mb-3">"{message.prompt}"</p>
                    <p className="text-xs text-slate-400 animate-pulse">{message.content}</p>
                </div>
            </div>
        );
    }
    
    return (
        <div className={`flex items-start gap-3 my-4 animate-fadeIn ${isUser ? 'justify-end' : ''}`}>
            {!isUser && <BrandIcon className="w-8 h-8 flex-shrink-0 mt-1" />}
            <div className={`group relative max-w-2xl w-fit rounded-2xl text-white ${
                isUser 
                ? 'bg-sky-600/80 rounded-br-lg p-4' 
                : isImage
                ? 'bg-slate-700/50 rounded-bl-lg overflow-hidden'
                : 'bg-slate-700/50 rounded-bl-lg p-4'
            }`}>
                 {isImage ? (
                    <div>
                        <img 
                            src={message.image} 
                            alt={message.prompt} 
                            className="w-full max-w-lg object-cover aspect-square bg-slate-800/50"
                            loading="lazy"
                        />
                        <div className="p-4 bg-black/20">
                            <p className="text-sm text-slate-300 italic mb-3">"{message.prompt}"</p>
                            <button 
                                onClick={handleDownload} 
                                className="w-full flex items-center justify-center gap-2 text-sm bg-sky-600 hover:bg-sky-500 font-semibold px-4 py-2 rounded-lg transition-colors"
                            >
                                <DownloadIcon /> Download Image
                            </button>
                        </div>
                    </div>
                ) : (
                    <div>
                        {renderMessageContent(message.content)}
                    </div>
                )}
            </div>
            {isUser && <UserIcon />}
        </div>
    );
});

const ChatInput: React.FC<{
    onSend: (input: string) => void;
    onCancel: () => void;
    isLoading: boolean;
    placeholder: string;
}> = ({ onSend, onCancel, isLoading, placeholder }) => {
    const [input, setInput] = React.useState('');
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);

    React.useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [input]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (input.trim() && !isLoading) {
            onSend(input);
            setInput('');
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="relative mt-auto">
            <div className="bg-slate-800/50 border border-slate-600/50 rounded-2xl p-2 flex items-end backdrop-blur-sm">
                <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    rows={1}
                    className="flex-1 bg-transparent p-2 pr-12 resize-none focus:outline-none placeholder-slate-400 max-h-48"
                    disabled={isLoading}
                />
                 <button 
                    type={isLoading ? "button" : "submit"}
                    onClick={isLoading ? onCancel : undefined}
                    className={`absolute right-4 bottom-4 p-2 rounded-full transition-colors duration-200 ${
                        isLoading 
                        ? 'bg-red-500/80 text-white hover:bg-red-600' 
                        : 'bg-sky-500 text-white disabled:bg-slate-600 disabled:cursor-not-allowed'
                    }`}
                    aria-label={isLoading ? "Cancel generation" : "Send message"}
                    disabled={!isLoading && !input.trim()}
                >
                    {isLoading ? <StopIcon /> : <SendIcon />}
                </button>
            </div>
        </form>
    );
};


const ChatWindow: React.FC = () => {
    const context = React.useContext(AppContext);
    const chatContainerRef = React.useRef<HTMLDivElement>(null);
    const { sendMessage, cancelRequest } = useChat();

    if (!context) return null;
    const { activeMode, conversations, isLoading, streamingMessage } = context;
    const messages = conversations[activeMode];
    const { placeholder } = MODE_DETAILS[activeMode];

    React.useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [messages, isLoading, streamingMessage]);

    return (
        <div className="flex flex-col h-full w-full bg-black/10 backdrop-blur-2xl border border-white/10 rounded-2xl p-4">
            <header className="text-center mb-4 border-b border-slate-600/50 pb-3">
                <h2 className="text-xl font-bold">{MODE_DETAILS[activeMode].name}</h2>
                <p className="text-xs text-slate-400">{MODELS[activeMode]}</p>
            </header>
            
            <div ref={chatContainerRef} className="flex-1 overflow-y-auto pr-2 -mr-2">
                {messages.map((msg, index) => <MessageBubble key={index} message={msg} />)}
                {streamingMessage && <MessageBubble message={streamingMessage} />}
                {isLoading && !streamingMessage && activeMode !== ChatMode.Media && <TypingIndicator />}
            </div>

            <ChatInput 
                onSend={sendMessage} 
                onCancel={cancelRequest}
                isLoading={isLoading} 
                placeholder={placeholder} 
            />
        </div>
    );
};

export default ChatWindow;