import React, { useState, useEffect } from 'react';
import { SyncConflictItem, ThreeWayMergeResult } from '../utils/storageAndSync';

interface SyncConflictModalProps {
  isOpen: boolean;
  mergeResult: ThreeWayMergeResult | null;
  isApplying: boolean;
  onResolve: (choices: Record<string, 'local' | 'cloud'>) => void;
  onCancel: () => void;
}

const formatTimestampPtBr = (rawIso: string): string => {
  if (!rawIso) return 'Sem horário';
  const parsed = Date.parse(rawIso);
  if (Number.isNaN(parsed)) return rawIso;
  const d = new Date(parsed);
  return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ${d.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })}`;
};

export const SyncConflictModal: React.FC<SyncConflictModalProps> = ({
  isOpen,
  mergeResult,
  isApplying,
  onResolve,
  onCancel
}) => {
  const [choices, setChoices] = useState<Record<string, 'local' | 'cloud'>>({});

  useEffect(() => {
    if (!mergeResult) return;
    const defaults: Record<string, 'local' | 'cloud'> = {};
    for (const c of mergeResult.conflicts) {
      defaults[c.skuKey] = c.recommendedChoice;
    }
    setChoices(defaults);
  }, [mergeResult]);

  if (!isOpen || !mergeResult || mergeResult.conflicts.length === 0) {
    return null;
  }

  const { conflicts, summary } = mergeResult;

  const setAllTo = (mode: 'recommended' | 'local' | 'cloud') => {
    const next: Record<string, 'local' | 'cloud'> = {};
    for (const c of conflicts) {
      next[c.skuKey] = mode === 'recommended' ? c.recommendedChoice : mode;
    }
    setChoices(next);
  };

  return (
    <div className="fixed inset-0 z-[98] bg-black/65 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
      <div className="mac-window mac-sheet w-full max-w-3xl rounded-2xl overflow-hidden shadow-2xl border border-amber-500/40 flex flex-col max-h-[92dvh]">
        {/* Header */}
        <div className="px-4 sm:px-5 py-3.5 border-b border-black/10 dark:border-white/10 bg-gradient-to-r from-amber-500/20 via-rose-500/10 to-transparent flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-500/25 border border-amber-500/45 flex items-center justify-center text-lg shrink-0">
              ⚔️
            </div>
            <div className="min-w-0">
              <h3 className="font-display font-extrabold text-sm sm:text-base truncate">
                Conflito de Sincronização Offline ({conflicts.length} SKU{conflicts.length > 1 ? 's' : ''})
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-300">
                Dois dispositivos salvaram o mesmo SKU em endereços diferentes. Escolha 1 destino oficial para impedir duplicação.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isApplying}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-black/10 dark:hover:bg-white/10 transition shrink-0"
            title="Adiar resolução (continuar com alterações salvas localmente)"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-3.5 sm:p-5 space-y-3.5 overflow-y-auto text-xs flex-1">
          {/* Anti-duplication & Multi-device merge summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25">
              <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                ☁️ Outros Usuários
              </p>
              <p className="font-mono font-extrabold text-sm mt-0.5">
                +{summary.preservedCloudEdits} mesclados
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-mac-blue/10 border border-mac-blue/25">
              <p className="text-[10px] font-bold text-mac-blue">
                📱 Este Dispositivo
              </p>
              <p className="font-mono font-extrabold text-sm mt-0.5">
                +{summary.preservedLocalEdits} mantidos
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/25">
              <p className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300">
                🛡️ Deduplicados
              </p>
              <p className="font-mono font-extrabold text-sm mt-0.5">
                {summary.deduplicatedMatches} iguais
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/35">
              <p className="text-[10px] font-bold text-amber-700 dark:text-amber-300">
                ⚔️ Em Conflito
              </p>
              <p className="font-mono font-extrabold text-sm mt-0.5">
                {conflicts.length} endereço(s)
              </p>
            </div>
          </div>

          {/* Bulk Quick Select */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10">
            <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
              Aplicar preferência rápida para todos os conflitos:
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setAllTo('recommended')}
                className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500 hover:text-slate-950 text-amber-700 dark:text-amber-300 border border-amber-500/35 font-bold text-[10px] transition"
              >
                🕒 Mais Recentes (Recomendado)
              </button>
              <button
                type="button"
                onClick={() => setAllTo('local')}
                className="px-2.5 py-1 rounded-lg bg-mac-blue/15 hover:bg-mac-blue text-mac-blue hover:text-white border border-mac-blue/30 font-bold text-[10px] transition"
              >
                📱 Todos Deste Dispositivo
              </button>
              <button
                type="button"
                onClick={() => setAllTo('cloud')}
                className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-600 text-emerald-700 dark:text-emerald-300 hover:text-white border border-emerald-500/30 font-bold text-[10px] transition"
              >
                ☁️ Todos da Nuvem
              </button>
            </div>
          </div>

          {/* Conflict Items */}
          <div className="space-y-2.5">
            {conflicts.map((conflict: SyncConflictItem) => {
              const selected = choices[conflict.skuKey] || conflict.recommendedChoice;
              return (
                <div
                  key={conflict.skuKey}
                  className="p-3 rounded-xl bg-white/70 dark:bg-slate-900/80 border border-black/10 dark:border-white/15 space-y-2.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-3 h-3 rounded-full border border-black/25 shrink-0"
                        style={{ backgroundColor: conflict.colorHex }}
                      />
                      <span className="font-mono font-extrabold text-xs sm:text-sm">
                        {conflict.code}
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {conflict.name}
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/10 font-mono text-[10px] text-slate-500 dark:text-slate-300 shrink-0">
                      Base anterior: <strong>{conflict.baseLocal}</strong>
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {/* Option A: Local Device */}
                    <button
                      type="button"
                      onClick={() =>
                        setChoices(prev => ({ ...prev, [conflict.skuKey]: 'local' }))
                      }
                      className={`text-left p-2.5 rounded-xl border-2 transition space-y-1 ${
                        selected === 'local'
                          ? 'bg-mac-blue/15 border-mac-blue ring-1 ring-mac-blue/40'
                          : 'bg-black/5 dark:bg-white/5 border-transparent hover:border-black/20 dark:hover:border-white/20 opacity-80'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold text-[11px] flex items-center gap-1 text-mac-blue">
                          <span>{selected === 'local' ? '🔘' : '⚪'}</span>
                          <span>📱 Este Dispositivo ({conflict.localDeviceId})</span>
                        </span>
                        {conflict.recommendedChoice === 'local' && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold text-[9px]">
                            Mais recente
                          </span>
                        )}
                      </div>
                      <p className="font-mono font-extrabold text-xs">
                        {conflict.localIsDeleted ? '🗑️ ' : '📍 '}
                        {conflict.localLocal}
                      </p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                        Editado em: {formatTimestampPtBr(conflict.localUpdatedAt)}
                      </p>
                    </button>

                    {/* Option B: Cloud / Other Device */}
                    <button
                      type="button"
                      onClick={() =>
                        setChoices(prev => ({ ...prev, [conflict.skuKey]: 'cloud' }))
                      }
                      className={`text-left p-2.5 rounded-xl border-2 transition space-y-1 ${
                        selected === 'cloud'
                          ? 'bg-emerald-500/15 border-emerald-500 ring-1 ring-emerald-500/40'
                          : 'bg-black/5 dark:bg-white/5 border-transparent hover:border-black/20 dark:hover:border-white/20 opacity-80'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold text-[11px] flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
                          <span>{selected === 'cloud' ? '🔘' : '⚪'}</span>
                          <span>☁️ Outro Usuário (Nuvem)</span>
                        </span>
                        {conflict.recommendedChoice === 'cloud' && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold text-[9px]">
                            Mais recente
                          </span>
                        )}
                      </div>
                      <p className="font-mono font-extrabold text-xs">
                        {conflict.cloudIsDeleted ? '🗑️ ' : '📍 '}
                        {conflict.cloudLocal}
                      </p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                        Atualizado em: {formatTimestampPtBr(conflict.cloudUpdatedAt)}
                      </p>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-5 py-3 border-t border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <p className="text-[10px] text-slate-500 dark:text-slate-400">
            🛡️ Garantia anti-duplicidade: nenhum SKU será salvo em dois endereços diferentes nem duplicado no mesmo endereço.
          </p>
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onCancel}
              disabled={isApplying}
              className="px-4 py-2 rounded-xl bg-black/10 dark:bg-white/10 hover:bg-black/15 dark:hover:bg-white/15 text-xs font-semibold transition"
            >
              Adiar (Manter Offline)
            </button>
            <button
              type="button"
              disabled={isApplying}
              onClick={() => onResolve(choices)}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-extrabold shadow-lg transition flex items-center gap-1.5"
            >
              <span>{isApplying ? '⏳' : '✅'}</span>
              <span>
                {isApplying
                  ? 'Aplicando e Sincronizando...'
                  : `Aplicar Escolhas & Sincronizar (${conflicts.length})`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
