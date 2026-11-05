import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary capturou uma exceção:', error, errorInfo);
    this.setState({ errorInfo });
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  public handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[280px] w-full p-6 flex flex-col items-center justify-center text-center bg-rose-500/5 dark:bg-rose-950/20 border-2 border-dashed border-rose-500/30 rounded-2xl m-2">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-600 dark:text-rose-300 flex items-center justify-center text-2xl mb-3 shadow-sm">
            ⚠️
          </div>
          <h3 className="font-display font-extrabold text-base text-rose-700 dark:text-rose-300">
            {this.props.fallbackTitle || 'Ocorreu uma falha ao renderizar este módulo'}
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-300 max-w-md mt-1 leading-relaxed">
            O aplicativo preveniu a tela em branco. Você pode tentar reiniciar o módulo ou recarregar a página para restaurar o estado normal.
          </p>

          <div className="flex items-center gap-2 mt-4">
            <button
              type="button"
              onClick={this.handleReset}
              className="px-4 py-2 rounded-xl bg-mac-blue hover:bg-blue-600 text-white font-bold text-xs shadow-sm transition"
            >
              🔄 Tentar Novamente
            </button>
            <button
              type="button"
              onClick={this.handleReload}
              className="px-4 py-2 rounded-xl bg-black/10 dark:bg-white/10 hover:bg-black/20 text-slate-700 dark:text-slate-200 font-semibold text-xs transition"
            >
              ⚡ Recarregar Página
            </button>
          </div>

          {this.state.error && (
            <details className="mt-4 text-left max-w-lg w-full text-[11px] font-mono bg-black/5 dark:bg-white/5 p-3 rounded-xl border border-black/10 dark:border-white/10 overflow-x-auto text-rose-600 dark:text-rose-300">
              <summary className="cursor-pointer font-bold text-slate-500">
                Ver detalhes técnicos do erro
              </summary>
              <pre className="mt-2 whitespace-pre-wrap">
                {this.state.error.toString()}
                {this.state.errorInfo?.componentStack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
