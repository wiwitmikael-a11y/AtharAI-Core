import * as React from 'react';
import BrandIcon from './BrandIcon';
import { wakeUpModel } from '../services/huggingFaceService';

interface WelcomeScreenProps {
  onStart: () => void;
}

const MINIMUM_WAIT_SECONDS = 15;

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onStart }) => {
    const [isLoading, setIsLoading] = React.useState(true);
    const [isReady, setIsReady] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [statusMessage, setStatusMessage] = React.useState("Menghubungi kluster publik Hugging Face...");
    const [progress, setProgress] = React.useState(0);

    const progressIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

    const cleanupIntervals = () => {
        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
    };

    const startWakeUpProcess = React.useCallback(async () => {
        setIsLoading(true);
        setIsReady(false);
        setError(null);
        setProgress(0);
        setStatusMessage("Menginisialisasi model Llama 3 70B...");
        cleanupIntervals();

        const startTime = Date.now();
        let estimatedTime = 60; // Default estimate
        let isPolling = true;

        const poll = async () => {
            try {
                const response = await wakeUpModel();
                if (!isPolling) return; // Stop if process has completed

                const data = await response.json();
                if (response.status === 202 && data.status === 'loading') {
                    estimatedTime = Math.max(data.estimated_time || estimatedTime, 20); // Ensure estimate is not too short
                    setTimeout(poll, 7000); // Poll less frequently
                } else if (response.ok && data.status === 'ready') {
                    isPolling = false;
                    const elapsedTime = (Date.now() - startTime) / 1000;
                    const remainingTime = Math.max(0, MINIMUM_WAIT_SECONDS - elapsedTime);
                    
                    // Animate to 100% over the remaining time
                    const finalProgressInterval = setInterval(() => {
                        setProgress(p => Math.min(100, p + (100 / (remainingTime * 10))));
                    }, 100);

                    setTimeout(() => {
                        clearInterval(finalProgressInterval);
                        setProgress(100);
                        setStatusMessage("Model Siap!");
                        setIsLoading(false);
                        setIsReady(true);
                    }, remainingTime * 1000);
                } else {
                    throw new Error(data.detail || data.error || "Terjadi kesalahan saat pemanasan.");
                }
            } catch (e) {
                if (isPolling) {
                    isPolling = false;
                    cleanupIntervals();
                    setError(`Gagal membangunkan model AI: ${(e as Error).message}. Silakan coba lagi.`);
                    setIsLoading(false);
                }
            }
        };

        // Start a smooth, slow progress bar simulation immediately
        progressIntervalRef.current = setInterval(() => {
            setProgress(oldProgress => {
                // This will slowly move to 95% over the estimated time
                // It will be replaced by a faster animation on success
                if (oldProgress < 95) {
                    const increment = 100 / (estimatedTime * 1.5);
                    return oldProgress + increment;
                }
                return oldProgress;
            });
        }, 100);

        poll();
    }, []);

    React.useEffect(() => {
        startWakeUpProcess();
        return cleanupIntervals;
    }, [startWakeUpProcess]);
    
    const renderContent = () => {
        if (isLoading) {
            return (
                <div className="w-full max-w-md">
                    <p className="text-slate-300 mb-2 text-center">{statusMessage}</p>
                    <div className="w-full bg-slate-700/50 rounded-full h-2.5">
                        <div 
                            className="bg-sky-500 h-2.5 rounded-full transition-all duration-100 ease-linear" 
                            style={{ width: `${progress}%` }}
                        ></div>
                    </div>
                    <p className="text-center text-xs text-slate-400 mt-2">
                        Kami sedang "membangunkan" AI di server publik gratis. Ini memastikan chat pertama Anda responsif.
                    </p>
                </div>
            );
        }

        if (error) {
            return (
                <div className="text-center">
                    <p className="text-red-400 mb-6">{error}</p>
                    <button
                        onClick={startWakeUpProcess}
                        className="bg-red-600 hover:bg-red-500 text-white font-bold py-3 px-8 rounded-full text-lg transition-all duration-300"
                    >
                        Coba Lagi
                    </button>
                </div>
            );
        }
        
        return (
            <button
              onClick={onStart}
              className="bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold py-3 px-8 rounded-full text-lg transition-all duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-sky-400/50 shadow-lg hover:shadow-sky-500/40 animate-fadeIn"
            >
              Mulai Chatting
            </button>
        );
    };

    return (
        <div className="flex items-center justify-center h-screen animate-fadeIn p-4">
          <div className="text-center p-8 max-w-2xl mx-auto bg-black/20 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl">
            <BrandIcon className="w-24 h-24 mx-auto mb-6" />
            <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4" style={{ textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>
              Welcome to <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-300 to-indigo-400">AtharAI Core</span>
            </h1>
            <p className="text-slate-300 text-lg mb-8" style={{ textShadow: '0 1px 5px rgba(0,0,0,0.5)' }}>
              Powered by state-of-the-art open-source models like Meta's Llama 3 70B and Stable Diffusion XL.
            </p>
            <div className="bg-black/20 border border-white/10 rounded-lg p-4 mb-8 text-left text-sm text-slate-300 min-h-[120px] flex items-center justify-center">
                {renderContent()}
            </div>
            { isReady && (
                 <p className="text-xs text-slate-400">
                    AI dapat menghasilkan informasi yang tidak akurat. Tidak diperlukan kunci API.
                </p>
            )}
          </div>
        </div>
    );
};

export default WelcomeScreen;