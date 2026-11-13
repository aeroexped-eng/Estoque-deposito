import React, { useState } from 'react';
import { OccupancyEvolutionChart, ImportHistorySnapshot } from './OccupancyEvolutionChart';

export interface ExecutiveDashboardProps {
  totalSkusCount: {
    unique: number;
    totalRecords: number;
  };
  totalPieces: number;
  grandOccupiedSlots: number;
  grandTotalSlots: number;
  grandFreeSlots: number;
  occupancyPercentage: number;
  conflictCount: number;
  invaderCount?: number;
  selectedStreet?: string;
  onSelectStreet?: (rua: string) => void;
  importHistory?: ImportHistorySnapshot[];
  onAddSnapshot?: () => void;
  onResetHistory?: () => void;
  onNavigateToConflict?: () => void;
  onOpenInventoryAudit?: () => void;
  onExportMisplacedGuide?: () => void;
  onOpenSpotlight?: () => void;
  onToggleHeatmap?: () => void;
  isHeatmapActive?: boolean;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  onClose?: () => void;
}

export const ExecutiveDashboard: React.FC<ExecutiveDashboardProps> = ({
  totalSkusCount,
  totalPieces,
  grandOccupiedSlots,
  grandTotalSlots,
  grandFreeSlots,
  occupancyPercentage,
  conflictCount,
  invaderCount = 0,
  selectedStreet = 'RF',
  onSelectStreet,
  importHistory,
  onAddSnapshot,
  onResetHistory,
  onNavigateToConflict,
  onOpenInventoryAudit,
  onExportMisplacedGuide,
  onOpenSpotlight,
  onToggleHeatmap,
  isHeatmapActive = false,
  isExpanded,
  onToggleExpanded,
  onClose
}) => {
  const [showEvolutionChart, setShowEvolutionChart] = useState<boolean>(true);
  // Format numbers to Brazilian Portuguese locale
  const fmt = (n: number) => n.toLocaleString('pt-BR');

  // Average pieces per unique SKU
  const avgPiecesPerSku =
    totalSkusCount.unique > 0 ? Math.round(totalPieces / totalSkusCount.unique) : 0;

  // Occupancy color theme
  const getOccupancyTheme = (pct: number) => {
    if (pct >= 88) return {
      bar: 'from-rose-500 to-red-600',
      badge: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
      text: 'text-rose-600 dark:text-rose-400',
      icon: '🚨',
      label: 'Crítica'
    };
    if (pct >= 70) return {
      bar: 'from-orange-500 to-amber-500',
      badge: 'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30',
      text: 'text-orange-600 dark:text-orange-400',
      icon: '🔥',
      label: 'Alta'
    };
    if (pct >= 45) return {
      bar: 'from-amber-400 to-yellow-500',
      badge: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
      text: 'text-amber-600 dark:text-amber-400',
      icon: '🟡',
      label: 'Moderada'
    };
    return {
      bar: 'from-blue-500 to-emerald-500',
      badge: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
      text: 'text-emerald-600 dark:text-emerald-400',
      icon: '🟢',
      label: 'Normal'
    };
  };

  const occTheme = getOccupancyTheme(occupancyPercentage);

  return (
    <section
      aria-label="Dashboard Executivo de Estoque"
      className="w-full shrink-0 z-30 select-none bg-white/80 dark:bg-slate-900/85 backdrop-blur-md border-b border-black/10 dark:border-white/10 transition-all duration-300 shadow-xs"
    >
      <div className="w-full px-2.5 sm:px-5 py-1.5 sm:py-2">
        {/* Header bar of the dashboard with title and collapse toggle */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 pb-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
          <div className="flex items-center space-x-1.5 sm:space-x-2 min-w-0">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-mac-blue/15 text-mac-blue text-xs font-bold shrink-0">
              📊
            </span>
            <span className="font-display font-bold tracking-tight text-slate-800 dark:text-slate-200 uppercase text-[10px] sm:text-[11px] truncate">
              Dashboard Executivo
            </span>
            <span className="text-[10px] text-slate-400 hidden md:inline truncate">
              • Indicadores Globais do Armazém em Tempo Real
            </span>
          </div>

          <div className="flex items-center flex-wrap gap-1 sm:gap-2">
            {onToggleHeatmap && (
              <button
                type="button"
                onClick={onToggleHeatmap}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold transition flex items-center gap-1 border ${
                  isHeatmapActive
                    ? 'bg-orange-500/20 text-orange-700 dark:text-orange-300 border-orange-500/40 ring-1 ring-orange-500/40'
                    : 'bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 border-black/5 dark:border-white/10'
                }`}
                title="Alternar Modo Heatmap Térmico"
              >
                <span>🔥</span>
                <span className="hidden sm:inline">Heatmap:</span>
                <span>{isHeatmapActive ? 'ON' : 'OFF'}</span>
              </button>
            )}

            {importHistory && importHistory.length > 0 && (
              <button
                type="button"
                onClick={() => setShowEvolutionChart(prev => !prev)}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold transition flex items-center gap-1 border ${
                  showEvolutionChart
                    ? 'bg-blue-600/20 text-blue-700 dark:text-blue-300 border-blue-500/40 ring-1 ring-blue-500/40'
                    : 'bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 border-black/5 dark:border-white/10'
                }`}
                title="Alternar exibição do gráfico D3 de evolução de ocupação da rua selecionada"
              >
                <span>📈</span>
                <span className="hidden sm:inline">Gráfico D3:</span>
                <span>{showEvolutionChart ? 'ON' : 'OFF'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={onToggleExpanded}
              className="px-2 py-0.5 rounded-lg bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 text-[10px] font-medium transition flex items-center gap-1 border border-black/5 dark:border-white/10"
              title={isExpanded ? 'Recolher Dashboard' : 'Expandir Cards do Dashboard'}
            >
              <span>{isExpanded ? '▲' : '▼'}</span>
              <span className="hidden sm:inline">{isExpanded ? 'Recolher' : 'Expandir'}</span>
            </button>

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="w-5 h-5 rounded-md hover:bg-black/10 dark:hover:bg-white/10 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition flex items-center justify-center text-xs"
                title="Ocultar Dashboard Executivo"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* EXPANDED VIEW: 4 High-Impact Executive Cards & D3 Evolution Chart */}
        {isExpanded ? (
          <>
            <div className="grid grid-cols-1 min-[380px]:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 pt-1">
            {/* CARD 1: Total de SKUs */}
            <div
              onClick={onOpenSpotlight}
              role={onOpenSpotlight ? 'button' : undefined}
              tabIndex={onOpenSpotlight ? 0 : undefined}
              onKeyDown={e => {
                if (e.key === 'Enter' && onOpenSpotlight) onOpenSpotlight();
              }}
              title={onOpenSpotlight ? 'Clique para buscar referências e SKUs (⌘K)' : undefined}
              className="group relative rounded-xl p-2.5 sm:p-3 bg-gradient-to-br from-indigo-50/70 to-blue-50/40 dark:from-indigo-950/25 dark:to-blue-950/15 border border-indigo-200/50 dark:border-indigo-800/40 shadow-xs hover:border-indigo-400/60 transition-all duration-200 cursor-pointer overflow-hidden"
            >
              <div className="flex items-start justify-between gap-1">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                    Total de SKUs
                  </span>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span className="text-xl sm:text-2xl font-extrabold font-mono tracking-tight text-slate-900 dark:text-white">
                      {fmt(totalSkusCount.unique)}
                    </span>
                    <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                      referências
                    </span>
                  </div>
                </div>
                <div className="w-8 h-8 rounded-lg bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-base shrink-0 group-hover:scale-110 transition-transform">
                  📦
                </div>
              </div>

              <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1.5 border-t border-indigo-200/40 dark:border-indigo-800/30">
                <span className="truncate">
                  {fmt(totalSkusCount.totalRecords)} alocações físicas
                </span>
                <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 opacity-80 group-hover:opacity-100 flex items-center gap-0.5">
                  <span>⌘K</span>
                </span>
              </div>
            </div>

            {/* CARD 2: Total de Peças */}
            <div
              className="relative rounded-xl p-2.5 sm:p-3 bg-gradient-to-br from-emerald-50/70 to-teal-50/40 dark:from-emerald-950/25 dark:to-teal-950/15 border border-emerald-200/50 dark:border-emerald-800/40 shadow-xs hover:border-emerald-400/60 transition-all duration-200 overflow-hidden"
              title="Quantidade total física somada de todas as peças registradas no armazém"
            >
              <div className="flex items-start justify-between gap-1">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                    Total de Peças
                  </span>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span className="text-xl sm:text-2xl font-extrabold font-mono tracking-tight text-emerald-600 dark:text-emerald-400">
                      {fmt(totalPieces)}
                    </span>
                    <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                      unidades
                    </span>
                  </div>
                </div>
                <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-base shrink-0">
                  🔢
                </div>
              </div>

              <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1.5 border-t border-emerald-200/40 dark:border-emerald-800/30">
                <span className="truncate">Estoque físico registrado</span>
                <span className="text-[10px] font-mono font-bold text-emerald-700 dark:text-emerald-300 px-1.5 py-0.2 rounded bg-emerald-500/10">
                  ~{fmt(avgPiecesPerSku)} un/SKU
                </span>
              </div>
            </div>

            {/* CARD 3: Taxa de Ocupação Geral */}
            <div
              onClick={onToggleHeatmap}
              role={onToggleHeatmap ? 'button' : undefined}
              tabIndex={onToggleHeatmap ? 0 : undefined}
              onKeyDown={e => {
                if (e.key === 'Enter' && onToggleHeatmap) onToggleHeatmap();
              }}
              title={onToggleHeatmap ? 'Clique para alternar o modo Heatmap Térmico' : undefined}
              className="group relative rounded-xl p-2.5 sm:p-3 bg-gradient-to-br from-amber-50/70 to-orange-50/40 dark:from-amber-950/25 dark:to-orange-950/15 border border-amber-200/50 dark:border-amber-800/40 shadow-xs hover:border-amber-400/60 transition-all duration-200 cursor-pointer overflow-hidden"
            >
              <div className="flex items-start justify-between gap-1">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                    Taxa de Ocupação Geral
                  </span>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span className={`text-xl sm:text-2xl font-extrabold font-mono tracking-tight ${occTheme.text}`}>
                      {occupancyPercentage}%
                    </span>
                    <span className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded border ${occTheme.badge}`}>
                      {occTheme.icon} {occTheme.label}
                    </span>
                  </div>
                </div>
                <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center text-base shrink-0 group-hover:scale-110 transition-transform">
                  🏭
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-2 space-y-1 pt-1.5 border-t border-amber-200/40 dark:border-amber-800/30">
                <div className="w-full h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${occTheme.bar} transition-all duration-500`}
                    style={{ width: `${Math.min(100, Math.max(0, occupancyPercentage))}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                  <span>{fmt(grandOccupiedSlots)} ocupados</span>
                  <span>{fmt(grandFreeSlots)} livres</span>
                </div>
              </div>
            </div>

            {/* CARD 4: Número de Conflitos */}
            <div
              className={`relative rounded-xl p-2.5 sm:p-3 border shadow-xs transition-all duration-200 overflow-hidden ${
                conflictCount > 0
                  ? 'bg-gradient-to-br from-rose-50/80 to-red-50/50 dark:from-rose-950/30 dark:to-red-950/20 border-rose-300/60 dark:border-rose-800/50 hover:border-rose-400'
                  : 'bg-gradient-to-br from-slate-50/70 to-emerald-50/30 dark:from-slate-900/40 dark:to-emerald-950/20 border-emerald-300/40 dark:border-emerald-800/30'
              }`}
            >
              <div className="flex items-start justify-between gap-1">
                <div>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider ${
                      conflictCount > 0
                        ? 'text-rose-700 dark:text-rose-300'
                        : 'text-emerald-700 dark:text-emerald-300'
                    }`}
                  >
                    Número de Conflitos
                  </span>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span
                      className={`text-xl sm:text-2xl font-extrabold font-mono tracking-tight ${
                        conflictCount > 0
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {fmt(conflictCount)}
                    </span>
                    <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                      {conflictCount === 1 ? 'colmeia' : 'colmeias'}
                    </span>
                  </div>
                </div>

                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0 ${
                    conflictCount > 0
                      ? 'bg-rose-500/20 text-rose-600 dark:text-rose-300 animate-pulse'
                      : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {conflictCount > 0 ? '🚨' : '🛡️'}
                </div>
              </div>

              <div
                className={`mt-2 flex items-center justify-between text-[11px] pt-1.5 border-t ${
                  conflictCount > 0
                    ? 'border-rose-200/50 dark:border-rose-800/40'
                    : 'border-emerald-200/40 dark:border-emerald-800/30'
                }`}
              >
                {conflictCount > 0 ? (
                  <>
                    <span className="text-rose-600 dark:text-rose-400 font-semibold text-[10px] truncate">
                      {invaderCount > 0
                        ? `${fmt(invaderCount)} invasores fora do local`
                        : 'Sobreposições / SKUs divididos'}
                    </span>
                    <div className="flex items-center flex-wrap justify-end gap-1 shrink-0">
                      {onNavigateToConflict && (
                        <button
                          type="button"
                          onClick={onNavigateToConflict}
                          className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10px] transition shadow-xs flex items-center gap-0.5"
                          title="Ir direto ao endereço físico com conflito"
                        >
                          <span>Ir</span>
                          <span>➜</span>
                        </button>
                      )}
                      {onOpenInventoryAudit && (
                        <button
                          type="button"
                          onClick={onOpenInventoryAudit}
                          className="px-1.5 py-0.5 rounded bg-rose-500/15 hover:bg-rose-500/25 text-rose-700 dark:text-rose-300 font-semibold text-[10px] transition"
                          title="Abrir Auditoria de Conflitos"
                        >
                          Auditar
                        </button>
                      )}
                      {onExportMisplacedGuide && (
                        <button
                          type="button"
                          onClick={onExportMisplacedGuide}
                          className="px-1.5 py-0.5 rounded bg-orange-600 hover:bg-orange-700 text-white font-bold text-[10px] transition shadow-xs flex items-center gap-0.5"
                          title="Exportar CSV de itens em locais incorretos com rotulação S/Cadastro"
                        >
                          <span>🚚</span>
                          <span>CSV</span>
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium text-[10px]">
                      0 divergências • Armazém regular
                    </span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                      ✓ OK
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* D3 OCCUPANCY EVOLUTION CHART */}
          {showEvolutionChart && importHistory && importHistory.length > 0 && (
            <OccupancyEvolutionChart
              selectedStreet={selectedStreet}
              onSelectStreet={onSelectStreet}
              importHistory={importHistory}
              onAddSnapshot={onAddSnapshot}
              onResetHistory={onResetHistory}
            />
          )}
        </>
      ) : (
          /* COMPACT VIEW: Slim 1-Line Summary Bar */
          <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar py-1 text-xs">
            <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
              {/* Pill 1: Total SKUs */}
              <div
                onClick={onOpenSpotlight}
                role={onOpenSpotlight ? 'button' : undefined}
                className="px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/25 flex items-center space-x-1.5 cursor-pointer hover:bg-indigo-500/20 transition"
                title="Clique para buscar SKUs (⌘K)"
              >
                <span className="text-xs">📦</span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">SKUs:</span>
                <strong className="font-mono font-bold text-slate-900 dark:text-white text-xs">
                  {fmt(totalSkusCount.unique)}
                </strong>
                <span className="text-[10px] text-slate-400 hidden md:inline">
                  ({fmt(totalSkusCount.totalRecords)} aloc.)
                </span>
              </div>

              {/* Pill 2: Total Peças */}
              <div
                className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-center space-x-1.5"
                title="Total de peças físicas"
              >
                <span className="text-xs">🔢</span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">Peças:</span>
                <strong className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs">
                  {fmt(totalPieces)}
                </strong>
              </div>

              {/* Pill 3: Taxa de Ocupação */}
              <div
                onClick={onToggleHeatmap}
                role={onToggleHeatmap ? 'button' : undefined}
                className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/25 flex items-center space-x-1.5 cursor-pointer hover:bg-amber-500/20 transition"
                title="Ocupação Geral do Armazém"
              >
                <span className="text-xs">{occTheme.icon}</span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">Ocupação:</span>
                <strong className={`font-mono font-bold text-xs ${occTheme.text}`}>
                  {occupancyPercentage}%
                </strong>
                <span className="text-[10px] text-slate-400 hidden lg:inline">
                  ({fmt(grandOccupiedSlots)}/{fmt(grandTotalSlots)})
                </span>
              </div>

              {/* Pill 4: Conflitos */}
              <div
                className={`px-2.5 py-1 rounded-lg border flex items-center space-x-1.5 ${
                  conflictCount > 0
                    ? 'bg-rose-500/15 border-rose-500/40 text-rose-600 dark:text-rose-400'
                    : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-600 dark:text-emerald-400'
                }`}
              >
                <span className="text-xs">{conflictCount > 0 ? '🚨' : '🛡️'}</span>
                <span className="text-[11px]">Conflitos:</span>
                <strong className="font-mono font-bold text-xs">
                  {fmt(conflictCount)}
                </strong>
                {conflictCount > 0 && onNavigateToConflict && (
                  <button
                    type="button"
                    onClick={onNavigateToConflict}
                    className="ml-1 px-1.5 py-0.2 rounded bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-[9px] transition"
                    title="Ir ao conflito"
                  >
                    Ir ➜
                  </button>
                )}
                {conflictCount > 0 && onExportMisplacedGuide && (
                  <button
                    type="button"
                    onClick={onExportMisplacedGuide}
                    className="ml-1 px-1.5 py-0.2 rounded bg-orange-600 hover:bg-orange-700 text-white font-extrabold text-[9px] transition"
                    title="Exportar CSV de itens em locais incorretos com 'S/Cadastro'"
                  >
                    CSV
                  </button>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={onToggleExpanded}
              className="text-[10px] text-mac-blue hover:underline font-semibold shrink-0"
            >
              Expandir Detalhes ▾
            </button>
          </div>
        )}
      </div>
    </section>
  );
};
