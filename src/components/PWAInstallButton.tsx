import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWA';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="flex items-center gap-1 rounded-md bg-mac-blue hover:bg-blue-500 px-2 py-0.5 text-[11px] font-bold text-white shadow-sm transition shrink-0 whitespace-nowrap"
        title="Instalar EstoqueOS WMS no dispositivo para acesso rápido e uso offline"
      >
        <span>📲</span>
        <span>Instalar App</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-1 rounded-md border border-mac-blue/40 bg-mac-blue/10 hover:bg-mac-blue hover:text-white px-2 py-0.5 text-[11px] font-bold text-mac-blue transition shrink-0 whitespace-nowrap"
          title="Como instalar no iPhone / iPad para usar offline"
        >
          <span>📲</span>
          <span>Instalar App</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-[96] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="mac-window w-full max-w-sm rounded-2xl p-5 shadow-2xl border border-white/20 space-y-3 text-xs">
              <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-2">
                <h3 className="font-display font-bold text-sm">
                  📲 Instalar no iPhone / iPad
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="text-slate-400 hover:text-slate-200 text-sm"
                >
                  ✕
                </button>
              </div>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                1. Toque no botão <strong>Compartilhar</strong> na barra do Safari.
                <br />
                2. Role para baixo e toque em <strong>Adicionar à Tela de Início</strong>.
                <br />
                3. Após instalar, o mapa e os dados permanecem disponíveis mesmo sem internet.
              </p>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="w-full py-2 rounded-xl bg-mac-blue hover:bg-blue-500 text-white font-bold transition"
              >
                Entendi
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

interface OfflineSyncBannerProps {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  onSyncNow: () => void;
}

export const OfflineSyncBanner: React.FC<OfflineSyncBannerProps> = ({
  isOnline,
  pendingCount,
  isSyncing,
  onSyncNow,
}) => {
  if (isOnline && pendingCount === 0 && !isSyncing) {
    return null;
  }

  return (
    <div
      className={`fixed bottom-16 lg:bottom-9 left-3 sm:left-4 z-30 flex flex-wrap items-center gap-2 rounded-xl px-3 py-1.5 text-[11px] font-bold shadow-xl border backdrop-blur-md transition-all ${
        !isOnline
          ? 'bg-amber-500/95 text-slate-950 border-amber-300'
          : isSyncing
            ? 'bg-mac-blue/95 text-white border-blue-300'
            : 'bg-emerald-600/95 text-white border-emerald-400'
      }`}
    >
      <span
        className={`h-2 w-2 rounded-full shrink-0 ${
          !isOnline
            ? 'bg-slate-950 animate-pulse'
            : isSyncing
              ? 'bg-white animate-ping'
              : 'bg-white'
        }`}
      />
      {!isOnline ? (
        <span>
          Modo Offline — Mapa salvo localmente
          {pendingCount > 0 ? ` (${pendingCount} alteração(ões) pendente(s) p/ sincronizar)` : ''}
        </span>
      ) : isSyncing ? (
        <span>Sincronizando alterações offline ({pendingCount})...</span>
      ) : (
        <>
          <span>Conexão ativa — {pendingCount} alteração(ões) aguardando envio</span>
          <button
            type="button"
            onClick={onSyncNow}
            className="px-2 py-0.5 rounded-lg bg-white/20 hover:bg-white/30 text-white font-extrabold text-[10px] transition"
          >
            🔄 Sincronizar Agora
          </button>
        </>
      )}
    </div>
  );
};
