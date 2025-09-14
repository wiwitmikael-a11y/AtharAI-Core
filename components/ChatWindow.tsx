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

const MessageBubble: React.FC<{ message: ChatMessage }> = ({ message }) => {
    const [copied, setCopied] = React.useState(false);
    const hasCode = /```/.test(message.content);

    const handleCopy = () => {
        const codeBlockRegex = /```[\s\S]*?```/g;
        const codeBlocks = message.content.match(codeBlockRegex) || [];
        const codeToCopy = codeBlocks.map(block => block.replace(/```.*\n/, '').replace(/```$/, '')).join('\n');
        
        if (codeToCopy) {
            navigator.clipboard.writeText(codeToCopy);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

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
    
    const formattedContent = message.content
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n(\s*)\* (.*)/g, (match, p1, p2) => `<li class="ml-4 list-disc">${p2}</li>`)
        .replace(/<li>/g, '<ul><li>') 
        .replace(/<\/li>\n(?!<li)/g, '</li></ul>');


    return (
        <div className={`flex items-start gap-3 my-4 animate-fadeIn ${message.role === 'user' ? 'justify-end' : ''}`}>
            {message.role === 'model' && <BrandIcon className="w-8 h-8 flex-shrink-0 mt-1" />}
            <div className={`group relative max-w-2xl w-fit rounded-2xl p-4 text-white ${
                message.role === 'user' 
                ? 'bg-sky-600/80 rounded-br-lg' 
                : 'bg-slate-700/50 rounded-bl-lg'
            }`}>
                 {message.image ? (
                    <div className="flex flex-col items-center">
                        <img src={message.image} alt={message.prompt} className="rounded-lg max-w-sm mb-2" />
                        <p className="text-sm text-slate-300 italic mb-2">"{message.prompt}"</p>
                        <button onClick={handleDownload} className="flex items-center gap-2 text-xs bg-black/20 hover:bg-black/40 px-3 py-1 rounded-md transition-colors">
                            <DownloadIcon /> Download Image
                        </button>
                    </div>
                ) : (
                    <div className="prose prose-invert prose-sm" dangerouslySetInnerHTML={{ __html: formattedContent.replace(/\n/g, '<br />') }} />
                )}
                
                {hasCode && message.role === 'model' && (
                    <button onClick={handleCopy} className="absolute -top-3 -right-3 p-1.5 bg-slate-800 border border-slate-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Copy code">
                        {copied ? <CopiedIcon /> : <CopyIcon />}
                    </button>
                )}
            </div>
            {message.role === 'user' && <UserIcon />}
        </div>
    );
};

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
    const { activeMode, conversations, isLoading } = context;
    const messages = conversations[activeMode];
    const { placeholder } = MODE_DETAILS[activeMode];

    React.useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [messages, isLoading]);

    return (
        <div className="flex flex-col h-full w-full bg-black/10 backdrop-blur-2xl border border-white/10 rounded-2xl p-4">
            <header className="text-center mb-4 border-b border-slate-600/50 pb-3">
                <h2 className="text-xl font-bold">{MODE_DETAILS[activeMode].name}</h2>
                <p className="text-xs text-slate-400">{MODELS[activeMode]}</p>
            </header>
            
            <div ref={chatContainerRef} className="flex-1 overflow-y-auto pr-2 -mr-2">
                {messages.map((msg, index) => <MessageBubble key={index} message={msg} />)}
                {isLoading && activeMode !== ChatMode.Media && <TypingIndicator />}
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
