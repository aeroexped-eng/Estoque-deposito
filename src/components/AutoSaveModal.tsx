import React from 'react';

export interface AutoSaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  isAutoSaveEnabled: boolean;
  onToggleAutoSave: (enabled: boolean) => void;
  autoSaveIntervalSeconds: number;
  onChangeInterval: (seconds: number) => void;
  autoRefreshMode: 'save_only' | 'save_and_sync' | 'save_and_reload';
  onChangeRefreshMode: (mode: 'save_only' | 'save_and_sync' | 'save_and_reload') => void;
  countdownSeconds: number;
  lastSavedAt: Date;
  onSaveNow: () => void;
  onSaveAndReloadNow: () => void;
  cloudSyncConfigured: boolean;
  cloudStatusText: string;
}

export const AutoSaveModal: React.FC<AutoSaveModalProps> = ({
  isOpen,
  onClose,
  isAutoSaveEnabled,
  onToggleAutoSave,
  autoSaveIntervalSeconds,
  onChangeInterval,
  autoRefreshMode,
  onChangeRefreshMode,
  countdownSeconds,
  lastSavedAt,
  onSaveNow,
  onSaveAndReloadNow,
  cloudSyncConfigured,
  cloudStatusText
}) => {
  if (!isOpen) return null;

  const minutesRemaining = Math.floor(countdownSeconds / 60);
  const secondsRemaining = countdownSeconds % 60;
  const formattedCountdown = `${String(minutesRemaining).padStart(2, '0')}:${String(secondsRemaining).padStart(2, '0')}`;

  const formattedLastSaved = lastSavedAt.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-md animate-fadeIn">
      <div
        onClick={e => e.stopPropagation()}
        className="mac-window rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-black/15 dark:border-white/15 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-2xl flex flex-col"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-black/10 dark:border-white/10 bg-white/50 dark:bg-slate-800/50 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xl shadow-inner">
              💾
            </div>
            <div>
              <h3 className="font-display font-extrabold text-base text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <span>Automação de Salvamento & Atualização</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Preserve todo o progresso do mapa WMS automaticamente
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/10 hover:bg-rose-500 hover:text-white flex items-center justify-center text-xs font-bold transition"
          >
            ✕
          </button>
        </div>

        {/* Body Content */}
        <div className="p-5 space-y-4 overflow-y-auto max-h-[75vh]">
          {/* Status Banner */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-blue-600/10 via-indigo-600/10 to-purple-600/10 border border-blue-500/20 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className="relative flex h-3 w-3">
                {isAutoSaveEnabled && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                )}
                <span
                  className={`relative inline-flex rounded-full h-3 w-3 ${
                    isAutoSaveEnabled ? 'bg-blue-500' : 'bg-slate-400'
                  }`}
                />
              </span>
              <div>
                <p className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-100">
                  {isAutoSaveEnabled ? 'Auto-Salvamento Ativado' : 'Auto-Salvamento Pausado'}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                  Último salvamento: <strong className="text-slate-700 dark:text-slate-200">{formattedLastSaved}</strong>
                </p>
              </div>
            </div>

            {/* Live Countdown Badge */}
            {isAutoSaveEnabled && (
              <div className="text-right">
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block">
                  Próximo em
                </span>
                <span className="font-mono text-base font-extrabold text-blue-600 dark:text-blue-400">
                  {formattedCountdown}
                </span>
              </div>
            )}
          </div>

          {/* Toggle On/Off Switch */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5">
            <div>
              <span className="font-bold text-xs text-slate-800 dark:text-slate-200">
                Ativar Ciclo Automático
              </span>
              <p className="text-[11px] text-slate-500">
                Grava automaticamente o estado em LocalStorage, IndexedDB e Nuvem
              </p>
            </div>
            <button
              type="button"
              onClick={() => onToggleAutoSave(!isAutoSaveEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                isAutoSaveEnabled ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  isAutoSaveEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Interval Selection (e.g., 2 minutos) */}
          <div className="space-y-1.5">
            <label className="font-bold text-xs text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span>Frequência de Salvamento:</span>
              <span className="font-mono text-[11px] text-blue-600 font-extrabold">
                {Math.round(autoSaveIntervalSeconds / 60)} minuto(s)
              </span>
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { sec: 60, label: '1 min' },
                { sec: 120, label: '2 min (Ideal)' },
                { sec: 300, label: '5 min' },
                { sec: 600, label: '10 min' }
              ].map(opt => (
                <button
                  key={opt.sec}
                  type="button"
                  onClick={() => onChangeInterval(opt.sec)}
                  className={`py-2 px-2 rounded-xl text-xs font-semibold transition border ${
                    autoSaveIntervalSeconds === opt.sec
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm font-bold'
                      : 'bg-white dark:bg-slate-800 hover:bg-black/5 text-slate-700 dark:text-slate-200 border-black/10 dark:border-white/10'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Behavior / Refresh Mode */}
          <div className="space-y-1.5">
            <label className="font-bold text-xs text-slate-700 dark:text-slate-300">
              Comportamento do Ciclo:
            </label>
            <div className="space-y-2 text-xs">
              <label
                onClick={() => onChangeRefreshMode('save_only')}
                className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition ${
                  autoRefreshMode === 'save_only'
                    ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-500 text-blue-900 dark:text-blue-100 font-medium'
                    : 'bg-white dark:bg-slate-800 border-black/10 dark:border-white/10 text-slate-600 dark:text-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="refreshMode"
                  checked={autoRefreshMode === 'save_only'}
                  onChange={() => onChangeRefreshMode('save_only')}
                  className="mt-0.5 text-blue-600"
                />
                <div>
                  <div className="font-bold">Apenas Salvar Dados (Recomendado)</div>
                  <div className="text-[11px] opacity-75">
                    Grava o progresso no navegador sem interromper a visualização nem recarregar a interface.
                  </div>
                </div>
              </label>

              <label
                onClick={() => onChangeRefreshMode('save_and_sync')}
                className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition ${
                  autoRefreshMode === 'save_and_sync'
                    ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-500 text-blue-900 dark:text-blue-100 font-medium'
                    : 'bg-white dark:bg-slate-800 border-black/10 dark:border-white/10 text-slate-600 dark:text-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="refreshMode"
                  checked={autoRefreshMode === 'save_and_sync'}
                  onChange={() => onChangeRefreshMode('save_and_sync')}
                  className="mt-0.5 text-blue-600"
                />
                <div>
                  <div className="font-bold flex items-center gap-1.5">
                    <span>Salvar & Sincronizar com a Nuvem</span>
                    {cloudSyncConfigured ? (
                      <span className="text-[10px] text-emerald-600 font-mono">({cloudStatusText})</span>
                    ) : (
                      <span className="text-[10px] text-amber-500 font-mono">(Sem URL Google)</span>
                    )}
                  </div>
                  <div className="text-[11px] opacity-75">
                    Grava localmente e envia o snapshot para a planilha Google Apps Script a cada ciclo.
                  </div>
                </div>
              </label>

              <label
                onClick={() => onChangeRefreshMode('save_and_reload')}
                className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition ${
                  autoRefreshMode === 'save_and_reload'
                    ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-500 text-blue-900 dark:text-blue-100 font-medium'
                    : 'bg-white dark:bg-slate-800 border-black/10 dark:border-white/10 text-slate-600 dark:text-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="refreshMode"
                  checked={autoRefreshMode === 'save_and_reload'}
                  onChange={() => onChangeRefreshMode('save_and_reload')}
                  className="mt-0.5 text-blue-600"
                />
                <div>
                  <div className="font-bold">Salvar e Recarregar Página Automaticamente</div>
                  <div className="text-[11px] opacity-75">
                    Salva com garantia prévia e faz refresh da aba a cada ciclo para obter as alterações mais recentes.
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Quick Immediate Action Buttons */}
          <div className="pt-2 border-t border-black/10 dark:border-white/10 space-y-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Ações Imediatas
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onSaveNow}
                className="py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition shadow-sm flex items-center justify-center gap-2"
              >
                <span>💾</span>
                <span>Salvar Progresso Agora</span>
              </button>
              <button
                type="button"
                onClick={onSaveAndReloadNow}
                className="py-2.5 px-3 rounded-xl bg-black/10 dark:bg-white/10 hover:bg-black/15 text-slate-800 dark:text-slate-100 font-bold text-xs transition flex items-center justify-center gap-2"
                title="Salva todo o progresso e recarrega a página imediatamente"
              >
                <span>🔄</span>
                <span>Salvar & Recarregar Página</span>
              </button>
            </div>
          </div>

          {/* Safety Guarantee Callout */}
          <div className="p-2.5 rounded-xl bg-black/5 dark:bg-white/5 text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
            <div className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
              <span>🛡️ Proteção de Dados:</span>
            </div>
            <p className="leading-relaxed">
              O sistema utiliza persistência quádrupla (IndexedDB + LocalStorage + SessionStorage + window.name). Ao fechar a aba ou atualizar a página, o evento <code>beforeunload</code> também garante o salvamento imediato do mapa.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-black/10 dark:border-white/10 bg-white/40 dark:bg-slate-800/40 flex items-center justify-between text-xs text-slate-500">
          <span className="font-mono text-[10px]">
            Atalho rápido: <strong>⌘ + S</strong> ou <strong>Ctrl + S</strong>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-mac-blue text-white font-bold text-xs transition shadow-sm"
          >
            Concluir
          </button>
        </div>
      </div>
    </div>
  );
};
