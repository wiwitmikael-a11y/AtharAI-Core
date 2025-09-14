import * as React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error: error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log the error to the console for debugging
    console.error("Uncaught error caught by ErrorBoundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      return (
        <div className="flex items-center justify-center h-screen text-white p-4">
            <div className="text-center p-8 max-w-2xl mx-auto bg-black/20 backdrop-blur-2xl border border-red-500/30 rounded-2xl shadow-2xl">
                <h1 className="text-3xl font-bold text-red-400 mb-4">
                    Application Error
                </h1>
                <p className="text-slate-300 text-lg mb-6">
                    Maaf, terjadi kesalahan kritis yang mencegah aplikasi untuk berjalan.
                </p>
                <div className="bg-black/20 border border-white/10 rounded-lg p-4 mb-6 text-left text-sm text-slate-300">
                    <h2 className="font-semibold text-white mb-2">Detail Error:</h2>
                    <pre className="text-red-300 whitespace-pre-wrap break-all">
                      {this.state.error?.toString()}
                    </pre>
                </div>
                <p className="text-slate-400 text-sm">
                    Silakan coba muat ulang halaman atau periksa browser console untuk informasi teknis lebih lanjut.
                </p>
            </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;