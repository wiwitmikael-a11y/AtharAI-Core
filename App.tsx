import React, { useState, useContext } from 'react';
import { ChatMode } from './types';
import { MODE_DETAILS } from './constants';
import WelcomeScreen from './components/WelcomeScreen';
import ChatWindow from './components/ChatWindow';
import BrandIcon from './components/BrandIcon';
import { AppProvider, AppContext } from './context/AppContext';

const HamburgerIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
);

const AppLayout: React.FC = () => {
    const [showWelcome, setShowWelcome] = useState(true);
    const [isSidebarOpen, setSidebarOpen] = useState(false);
    const context = useContext(AppContext);

    if (!context) {
      return <div>Loading...</div>; // Or some other error state
    }
    const { activeMode, setActiveMode } = context;

    if (showWelcome) {
        return <WelcomeScreen onStart={() => setShowWelcome(false)} />;
    }

    const SidebarContent = () => (
      <>
        <header className="flex items-center gap-3 mb-8">
            <BrandIcon className="w-10 h-10" />
            <h1 className="text-2xl font-bold">AtharAI Core</h1>
        </header>
        <nav className="flex-1 space-y-2">
            {(Object.keys(ChatMode) as Array<keyof typeof ChatMode>).map((key) => {
                const mode = ChatMode[key];
                const isActive = activeMode === mode;
                return (
                    <button
                        key={mode}
                        onClick={() => {
                            setActiveMode(mode);
                            if (window.innerWidth < 768) { // md breakpoint
                              setSidebarOpen(false);
                            }
                        }}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all duration-200 border border-transparent ${
                            isActive 
                            ? 'bg-white/20 text-white border-white/20' 
                            : 'hover:bg-white/10 hover:border-white/10 text-slate-300'
                        }`}
                    >
                        <span className={isActive ? 'text-sky-300' : ''}>{MODE_DETAILS[mode].icon}</span>
                        <span className="font-medium">{MODE_DETAILS[mode].name}</span>
                    </button>
                );
            })}
        </nav>
        <footer className="text-center text-xs text-slate-400 mt-4">
            <p>Powered by Open Source Models</p>
            <p>&copy; {new Date().getFullYear()} Atharrazka Project</p>
        </footer>
      </>
    );

    return (
        <div className="flex h-screen font-sans text-slate-100 p-2 sm:p-4">
            {/* Sidebar for Mobile (fixed) */}
            <aside className={`fixed inset-y-0 left-0 w-64 bg-slate-900/80 backdrop-blur-2xl p-4 flex flex-col border-r border-white/10 z-30 transform transition-transform duration-300 ease-in-out md:hidden ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <SidebarContent />
            </aside>
            {/* Overlay for mobile */}
            {isSidebarOpen && <div className="fixed inset-0 bg-black/50 z-20 md:hidden" onClick={() => setSidebarOpen(false)}></div>}

            {/* Sidebar for Desktop (static) */}
            <aside className="hidden md:flex w-64 bg-black/10 backdrop-blur-2xl p-4 flex-col border border-white/10 rounded-2xl mr-4">
                <SidebarContent />
            </aside>

            {/* Main Chat Area */}
            <main className="flex-1 flex flex-col">
                 <button onClick={() => setSidebarOpen(true)} className="md:hidden p-2 absolute top-4 left-4 z-10 text-white bg-black/20 rounded-md">
                    <HamburgerIcon />
                </button>
                <ChatWindow />
            </main>
        </div>
    );
};

const App: React.FC = () => (
    <AppProvider>
        <AppLayout />
    </AppProvider>
);

export default App;
