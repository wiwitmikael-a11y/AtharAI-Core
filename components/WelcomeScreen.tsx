
import * as React from 'react';
import BrandIcon from './BrandIcon';

interface WelcomeScreenProps {
  onStart: () => void;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onStart }) => {
  return (
    <div className="flex items-center justify-center h-screen animate-fadeIn p-4">
      <div className="text-center p-8 max-w-2xl mx-auto bg-black/20 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl">
        <BrandIcon className="w-24 h-24 mx-auto mb-6" />
        <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4" style={{ textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>
          Welcome to <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-300 to-indigo-400">AtharAI Core</span>
        </h1>
        <p className="text-slate-300 text-lg mb-8" style={{ textShadow: '0 1px 5px rgba(0,0,0,0.5)' }}>
          Powered by state-of-the-art open-source models like Meta's Llama 3 70B and Stable Diffusion XL, via Hugging Face's free public endpoints.
        </p>
        <div className="bg-black/20 border border-white/10 rounded-lg p-4 mb-8 text-left text-sm text-slate-300">
          <h2 className="font-semibold text-white mb-2">Penting: Harap Bersabar</h2>
          <p className="mb-2">
            Anda akan menggunakan model AI yang sangat besar (70 miliar parameter) pada layanan publik gratis. <strong>Permintaan pertama Anda mungkin membutuhkan waktu satu menit atau lebih untuk memuat model.</strong> Harap bersabar.
          </p>
          <p>
            AI dapat menghasilkan informasi yang tidak akurat. Tidak diperlukan kunci API.
          </p>
        </div>
        <button
          onClick={onStart}
          className="bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold py-3 px-8 rounded-full text-lg transition-all duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-sky-400/50 shadow-lg hover:shadow-sky-500/40"
        >
          Start Chatting
        </button>
      </div>
    </div>
  );
};

export default WelcomeScreen;
