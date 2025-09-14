
import * as React from 'react';
import BrandIcon from './BrandIcon';

const TypingIndicator: React.FC = () => {
    return (
        <div className="flex items-center space-x-3 p-4 self-start animate-fadeIn">
            <BrandIcon className="w-8 h-8 flex-shrink-0" />
            <div className="flex items-center space-x-1 bg-slate-700/50 rounded-full px-4 py-2">
                <span className="w-2 h-2 bg-slate-400 rounded-full animate-pulse" style={{ animationDelay: '0s' }}></span>
                <span className="w-2 h-2 bg-slate-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></span>
                <span className="w-2 h-2 bg-slate-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></span>
            </div>
        </div>
    );
};

export default TypingIndicator;
