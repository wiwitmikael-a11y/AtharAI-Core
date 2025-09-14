import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { AppContext } from '../context/AppContext';
import { useChat } from '../hooks/useChat';
import {
  UserIcon,
  CopyIcon,
  CopiedIcon,
  DownloadIcon,
  SendIcon,
  StopIcon,
  PaperclipIcon,
  MODELS,
  MODE_DETAILS,
} from '../constants';
import BrandIcon from './BrandIcon';
import TypingIndicator from './TypingIndicator';
import { ChatMode, ChatMessage } from '../types';

// Let TypeScript know about the global variables from the CDN scripts
declare var marked: any;
declare var hljs: any;

const CopyButton: React.FC<{ code: string }> = ({ code }) => {
    const [copied, setCopied] = React.useState(false);
    const handleCopy = () => {
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    return (
        <button onClick={handleCopy}>
            {copied ? <CopiedIcon /> : <CopyIcon />}
            <span className={copied ? 'copied-text' : ''}>{copied ? 'Copied!' : 'Copy'}</span>
        </button>
    );
};

const MarkdownRenderer: React.FC<{ content: string }> = React.memo(({ content }) => {
    const rootRef = React.useRef<HTMLDivElement>(null);
    const rootsRef = React.useRef<any[]>([]);

    React.useEffect(() => {
        if (rootRef.current) {
            // Unmount previous React roots
            rootsRef.current.forEach(root => root.unmount());
            rootsRef.current = [];

            const rawHtml = marked.parse(content, { gfm: true, breaks: true, async: false }) as string;
            rootRef.current.innerHTML = rawHtml;

            const preElements = rootRef.current.querySelectorAll('pre');
            preElements.forEach(preElement => {
                const codeElement = preElement.querySelector('code');
                if (codeElement) {
                    hljs.highlightElement(codeElement);
                    
                    const header = document.createElement('div');
                    header.className = 'code-header';
                    
                    const langMatch = codeElement.className.match(/language-([a-zA-Z0-9]+)/);
                    const lang = langMatch ? langMatch[1] : 'code';
                    const langSpan = document.createElement('span');
                    langSpan.innerText = lang;
                    header.appendChild(langSpan);

                    const buttonContainer = document.createElement('div');
                    header.appendChild(buttonContainer);
                    
                    preElement.prepend(header);
                    
                    const root = createRoot(buttonContainer);
                    root.render(<CopyButton code={codeElement.innerText} />);
                    rootsRef.current.push(root);
                }
            });
        }
    }, [content]);
    
    React.useEffect(() => {
        return () => {
             rootsRef.current.forEach(root => root.unmount());
        }
    }, []);

    return <div ref={rootRef} className="prose prose-invert prose-sm max-w-none rendered-markdown" />;
});


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
    const isModelImage = message.role === 'model' && !!message.image;

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
                ? 'bg-sky-600/80 rounded-br-lg' 
                : isModelImage
                ? 'bg-slate-700/50 rounded-bl-lg overflow-hidden'
                : 'bg-slate-700/50 rounded-bl-lg p-4'
            }`}>
                {isUser ? (
                    <div className="flex flex-col">
                        {message.image && (
                             <img 
                                src={message.image} 
                                alt="User upload" 
                                className="w-full max-w-xs object-cover bg-slate-800/50 rounded-t-lg"
                                loading="lazy"
                            />
                        )}
                        {message.content && (
                            <div className="p-4">
                                <MarkdownRenderer content={message.content} />
                            </div>
                        )}
                    </div>
                 ) : isModelImage ? (
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
                    <MarkdownRenderer content={message.content} />
                )}
            </div>
            {isUser && <UserIcon />}
        </div>
    );
});

const ChatInput: React.FC<{
    activeMode: ChatMode;
    onSend: (input: string, image?: string | null) => void;
    onCancel: () => void;
    isLoading: boolean;
    placeholder: string;
}> = ({ activeMode, onSend, onCancel, isLoading, placeholder }) => {
    const [input, setInput] = React.useState('');
    const [image, setImage] = React.useState<string | null>(null);
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    React.useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [input]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setImage(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleAttachClick = () => {
        fileInputRef.current?.click();
    };

    const removeImage = () => {
        setImage(null);
        if(fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const canSend = !isLoading && (
            (activeMode === ChatMode.Vision && image) || 
            (activeMode !== ChatMode.Vision && input.trim())
        );

        if (canSend) {
            onSend(input, image);
            setInput('');
            removeImage();
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
        }
    };

    const isSendDisabled = isLoading || (
        activeMode === ChatMode.Vision ? !image : !input.trim()
    );

    return (
        <form onSubmit={handleSubmit} className="relative mt-auto">
             {image && (
                <div className="relative w-fit mb-2 p-1 bg-slate-700/50 border border-slate-600/50 rounded-lg">
                    <img src={image} alt="Preview" className="h-20 w-20 object-cover rounded" />
                    <button 
                        type="button" 
                        onClick={removeImage} 
                        className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full h-6 w-6 flex items-center justify-center text-sm font-bold leading-none hover:bg-red-500 transition-colors"
                        aria-label="Remove image"
                    >
                        &times;
                    </button>
                </div>
            )}
            <div className="bg-slate-800/50 border border-slate-600/50 rounded-2xl p-2 flex items-end backdrop-blur-sm">
                 {activeMode === ChatMode.Vision && (
                    <>
                        <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
                        <button 
                            type="button" 
                            onClick={handleAttachClick} 
                            className="p-2 text-slate-400 hover:text-white transition-colors" 
                            aria-label="Attach image"
                            disabled={isLoading}
                        >
                            <PaperclipIcon />
                        </button>
                    </>
                )}
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
                    disabled={isSendDisabled}
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
                {isLoading && !streamingMessage && <TypingIndicator />}
            </div>

            <ChatInput 
                activeMode={activeMode}
                onSend={sendMessage} 
                onCancel={cancelRequest}
                isLoading={isLoading} 
                placeholder={placeholder} 
            />
        </div>
    );
};

export default ChatWindow;