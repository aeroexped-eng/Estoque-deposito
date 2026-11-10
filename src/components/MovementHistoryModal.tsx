import React, { useState, useMemo } from 'react';
import { MovedSkuEntry } from '../constants/wmsConstants';
import { triggerCsvDownload, playMacSound } from '../utils/storageAndSync';

export interface MovementHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  movedSkusRegistry: Record<string, MovedSkuEntry>;
  onNavigateToSlot?: (wms: string, rua: string) => void;
  onRevertMovement?: (skuKey: string) => void;
  onClearHistory?: () => void;
  soundEnabled?: boolean;
}

export const MovementHistoryModal: React.FC<MovementHistoryModalProps> = ({
  isOpen,
  onClose,
  movedSkusRegistry,
  onNavigateToSlot,
  onRevertMovement,
  onClearHistory,
  soundEnabled = true
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedSourceFilter, setSelectedSourceFilter] = useState<'ALL' | 'drag' | 'relocate' | 'modal'>('ALL');
  const [selectedRuaFilter, setSelectedRuaFilter] = useState<string>('ALL');
  const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc');
  const [copiedNotification, setCopiedNotification] = useState<boolean>(false);
  const [confirmClearOpen, setConfirmClearOpen] = useState<boolean>(false);

  // Convert dictionary into array with calculated metadata
  const allMovements = useMemo(() => {
    return Object.values(movedSkusRegistry).map(entry => {
      const ruaDest = entry.ruaDestino || entry.newLocal.split('.')[0] || '—';
      const ruaOrig = entry.ruaOrigem || entry.oldLocal.split('.')[0] || '—';
      return {
        ...entry,
        ruaDestinoCalc: ruaDest,
        ruaOrigemCalc: ruaOrig
      };
    });
  }, [movedSkusRegistry]);

  // Unique destination streets
  const destinationStreets = useMemo(() => {
    const set = new Set<string>();
    for (const m of allMovements) {
      if (m.ruaDestinoCalc && m.ruaDestinoCalc !== '—') {
        set.add(m.ruaDestinoCalc);
      }
    }
    return Array.from(set).sort();
  }, [allMovements]);

  // Summary KPIs
  const totalMovementsCount = allMovements.length;
  const totalPiecesMoved = useMemo(() => {
    return allMovements.reduce((sum, item) => sum + (item.qty || 0), 0);
  }, [allMovements]);

  const latestMovementTime = useMemo(() => {
    if (allMovements.length === 0) return '—';
    const sorted = [...allMovements].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    return sorted[0].movedAt || '—';
  }, [allMovements]);

  // Filtered and sorted movements
  const filteredMovements = useMemo(() => {
    const q = searchQuery.trim().toUpperCase();

    return allMovements
      .filter(item => {
        // Source filter
        if (selectedSourceFilter !== 'ALL' && item.source !== selectedSourceFilter) {
          return false;
        }

        // Rua Destino filter
        if (selectedRuaFilter !== 'ALL' && item.ruaDestinoCalc !== selectedRuaFilter) {
          return false;
        }

        // Search text
        if (q) {
          const matchCode = item.code.toUpperCase().includes(q);
          const matchName = (item.name || '').toUpperCase().includes(q);
          const matchOld = item.oldLocal.toUpperCase().includes(q);
          const matchNew = item.newLocal.toUpperCase().includes(q);
          const matchColor = (item.colorCode || '').toUpperCase().includes(q);
          const matchSize = (item.size || '').toUpperCase().includes(q);
          const matchBase = (item.codigoBase || '').toUpperCase().includes(q);
          return matchCode || matchName || matchOld || matchNew || matchColor || matchSize || matchBase;
        }

        return true;
      })
      .sort((a, b) => {
        const timeA = a.timestamp || 0;
        const timeB = b.timestamp || 0;
        if (timeA && timeB && timeA !== timeB) {
          return sortDirection === 'desc' ? timeB - timeA : timeA - timeB;
        }
        return sortDirection === 'desc'
          ? (b.movedAt || '').localeCompare(a.movedAt || '')
          : (a.movedAt || '').localeCompare(b.movedAt || '');
      });
  }, [allMovements, selectedSourceFilter, selectedRuaFilter, searchQuery, sortDirection]);

  // Export 1: Relatório De -> Para Completo
  const handleExportDeParaCsv = () => {
    if (filteredMovements.length === 0) return;

    const headers = [
      'HORARIO',
      'SKU',
      'NOME_PRODUTO',
      'CODIGO_BASE',
      'COR',
      'TAMANHO',
      'QUANTIDADE_PCS',
      'DEPOSITO',
      'LOCAL_ANTERIOR_DE',
      'NOVO_LOCAL_PARA',
      'RUA_ORIGEM',
      'RUA_DESTINO',
      'ORIGEM_ACAO'
    ];

    const rows = filteredMovements.map(item => {
      const sourceLabel =
        item.source === 'drag'
          ? 'Arraste no Mapa'
          : item.source === 'relocate'
            ? 'Remanejamento Rapido'
            : 'Manual / Modal';

      return [
        item.movedAt || '',
        `"${item.code.replace(/"/g, '""')}"`,
        `"${(item.name || '').replace(/"/g, '""')}"`,
        `"${item.codigoBase || ''}"`,
        `"${item.colorCode || ''}"`,
        `"${item.size || ''}"`,
        item.qty || 0,
        item.deposito || '2',
        `"${item.oldLocal}"`,
        `"${item.newLocal}"`,
        `"${item.ruaOrigemCalc}"`,
        `"${item.ruaDestinoCalc}"`,
        `"${sourceLabel}"`
      ].join(';');
    });

    const csvContent = [headers.join(';'), ...rows].join('\r\n');
    const dateStr = new Date().toISOString().slice(0, 10);
    triggerCsvDownload(csvContent, `relatorio_de_para_movimentacoes_${dateStr}.csv`);
    playMacSound('success', soundEnabled);
  };

  // Export 2: Formato SISPLAN ERP
  const handleExportSisplanCsv = () => {
    if (filteredMovements.length === 0) return;

    const headers = ['CODIGO', 'COR', 'TAMANHO', 'DEPOSITO', 'LOCAL'];
    const rows = filteredMovements.map(item => {
      return [
        item.codigoBase || '',
        item.colorCode || '',
        item.size || '',
        item.deposito || '2',
        item.newLocal || ''
      ].join(';');
    });

    const csvContent = [headers.join(';'), ...rows].join('\r\n');
    const dateStr = new Date().toISOString().slice(0, 10);
    triggerCsvDownload(csvContent, `sisplan_lote_remanejados_${dateStr}.csv`);
    playMacSound('success', soundEnabled);
  };

  // Export 3: Copiar para Área de Transferência (TSV)
  const handleCopyToClipboard = async () => {
    if (filteredMovements.length === 0) return;

    const headers = ['HORA\tSKU\tPRODUTO\tDE\tPARA\tQTD\tORIGEM'];
    const rows = filteredMovements.map(item => {
      const sourceLabel =
        item.source === 'drag'
          ? 'Arraste'
          : item.source === 'relocate'
            ? 'Remanejamento'
            : 'Manual';

      return `${item.movedAt}\t${item.code}\t${item.name || ''}\t${item.oldLocal}\t${item.newLocal}\t${item.qty || 0}\t${sourceLabel}`;
    });

    const text = [headers, ...rows].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopiedNotification(true);
      playMacSound('pop', soundEnabled);
      setTimeout(() => setCopiedNotification(false), 2400);
    } catch {
      // Fallback
    }
  };

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/55 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="mac-window mac-sheet w-full max-w-5xl rounded-2xl overflow-hidden shadow-2xl border border-white/20 bg-white/95 dark:bg-slate-900/95 flex flex-col max-h-[90vh]"
      >
        {/* Window Titlebar */}
        <div className="px-5 py-3.5 border-b border-black/10 dark:border-white/10 flex items-center justify-between bg-black/[0.02] dark:bg-white/[0.02] shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-xl bg-mac-blue/15 text-mac-blue dark:bg-mac-blue/25 dark:text-blue-300 flex items-center justify-center text-lg font-bold">
              🚚
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-display font-extrabold text-sm sm:text-base text-slate-800 dark:text-slate-100">
                  Histórico de Movimentações WMS
                </h3>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-mac-blue/15 text-mac-blue dark:text-blue-300 font-extrabold">
                  {totalMovementsCount} {totalMovementsCount === 1 ? 'movimento' : 'movimentos'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Registro cronológico De ➔ Para de todas as trocas de posição e arrastes realizados nesta sessão
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/15 dark:hover:bg-white/20 text-slate-600 dark:text-slate-300 flex items-center justify-center transition font-bold text-xs"
            title="Fechar (ESC)"
          >
            ✕
          </button>
        </div>

        {/* KPI Summary Cards */}
        <div className="px-5 py-3 border-b border-black/5 dark:border-white/5 bg-slate-50/50 dark:bg-slate-800/40 shrink-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
            <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900/80 border border-black/5 dark:border-white/5 shadow-2xs">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500 block">
                Total de SKUs Movidos
              </span>
              <span className="text-lg sm:text-xl font-mono font-black text-slate-800 dark:text-slate-100">
                {totalMovementsCount}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900/80 border border-black/5 dark:border-white/5 shadow-2xs">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500 block">
                Peças Remanejadas
              </span>
              <span className="text-lg sm:text-xl font-mono font-black text-emerald-600 dark:text-emerald-400">
                {totalPiecesMoved} <span className="text-xs font-normal opacity-75">pçs</span>
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900/80 border border-black/5 dark:border-white/5 shadow-2xs">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500 block">
                Ruas de Destino
              </span>
              <span className="text-lg sm:text-xl font-mono font-black text-mac-blue dark:text-blue-400">
                {destinationStreets.length} <span className="text-xs font-normal opacity-75">ruas</span>
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900/80 border border-black/5 dark:border-white/5 shadow-2xs">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500 block">
                Última Operação
              </span>
              <span className="text-sm sm:text-base font-mono font-bold text-amber-600 dark:text-amber-400 truncate block">
                {latestMovementTime}
              </span>
            </div>
          </div>
        </div>

        {/* Toolbar & Filters */}
        <div className="px-5 py-3 border-b border-black/10 dark:border-white/10 flex flex-wrap items-center justify-between gap-2.5 shrink-0 bg-white/70 dark:bg-slate-900/70">
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[260px]">
            {/* Search input */}
            <div className="relative flex-1 min-w-[180px] max-w-sm">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">🔍</span>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Filtrar por SKU, endereço De, Para..."
                className="w-full pl-8 pr-7 py-1.5 rounded-xl bg-black/5 dark:bg-white/10 border border-transparent focus:border-mac-blue text-xs focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Source Filter */}
            <select
              value={selectedSourceFilter}
              onChange={e => setSelectedSourceFilter(e.target.value as 'ALL' | 'drag' | 'relocate' | 'modal')}
              className="px-2.5 py-1.5 rounded-xl bg-black/5 dark:bg-white/10 border border-black/5 dark:border-white/10 text-xs font-semibold focus:outline-none"
            >
              <option value="ALL">Todas as Origens</option>
              <option value="drag">✋ Arraste no Mapa</option>
              <option value="relocate">⚡ Remanejamento Rápido</option>
              <option value="modal">📝 Modal / Manual</option>
            </select>

            {/* Rua Destino Filter */}
            {destinationStreets.length > 1 && (
              <select
                value={selectedRuaFilter}
                onChange={e => setSelectedRuaFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl bg-black/5 dark:bg-white/10 border border-black/5 dark:border-white/10 text-xs font-semibold focus:outline-none"
              >
                <option value="ALL">Todas as Ruas de Destino</option>
                {destinationStreets.map(r => (
                  <option key={r} value={r}>
                    Rua {r}
                  </option>
                ))}
              </select>
            )}

            {/* Sort order toggle */}
            <button
              type="button"
              onClick={() => setSortDirection(prev => (prev === 'desc' ? 'asc' : 'desc'))}
              className="px-2.5 py-1.5 rounded-xl bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 text-xs font-semibold transition flex items-center gap-1"
              title="Inverter ordenação cronológica"
            >
              <span>{sortDirection === 'desc' ? '⏱️ Recentes Primeiro' : '⏱️ Antigos Primeiro'}</span>
            </button>
          </div>

          {/* Export action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleExportDeParaCsv}
              disabled={filteredMovements.length === 0}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-xs transition shadow-xs flex items-center space-x-1.5"
              title="Baixar relatório completo De ➔ Para com histórico e detalhes dos SKUs"
            >
              <span>📊</span>
              <span>Exportar De ➔ Para (.CSV)</span>
            </button>

            <button
              type="button"
              onClick={handleExportSisplanCsv}
              disabled={filteredMovements.length === 0}
              className="px-3 py-1.5 rounded-xl bg-mac-blue hover:bg-blue-500 disabled:opacity-40 text-white font-bold text-xs transition shadow-xs flex items-center space-x-1.5"
              title="Exportar no formato SISPLAN ERP (CODIGO;COR;TAMANHO;DEPOSITO;LOCAL)"
            >
              <span>🏭</span>
              <span className="hidden sm:inline">Exportar SISPLAN (.CSV)</span>
              <span className="sm:hidden">SISPLAN</span>
            </button>

            <button
              type="button"
              onClick={handleCopyToClipboard}
              disabled={filteredMovements.length === 0}
              className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 disabled:opacity-40 text-slate-700 dark:text-slate-300 font-semibold text-xs transition flex items-center gap-1"
              title="Copiar tabela formatada para colar no Excel ou Google Planilhas"
            >
              <span>{copiedNotification ? '✅' : '📋'}</span>
              <span className="hidden md:inline">{copiedNotification ? 'Copiado!' : 'Copiar'}</span>
            </button>
          </div>
        </div>

        {/* Movements Table */}
        <div className="flex-1 overflow-y-auto p-4">
          {totalMovementsCount === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <div className="text-4xl mb-3">🚚</div>
              <h4 className="font-display font-extrabold text-base text-slate-700 dark:text-slate-200">
                Nenhuma movimentação registrada nesta sessão
              </h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto mt-1.5">
                Para remanejar produtos, arraste as colmeias no mapa de estoque ou utilize as ações rápidas{' '}
                <span className="font-semibold text-slate-600 dark:text-slate-300">"Mover p/ Vazio"</span> e{' '}
                <span className="font-semibold text-slate-600 dark:text-slate-300">"Trocar c/ Destino"</span> no
                Inspetor Lateral.
              </p>
            </div>
          ) : filteredMovements.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <div className="text-3xl mb-2">🔍</div>
              <p className="font-bold text-sm text-slate-600 dark:text-slate-300">
                Nenhum movimento encontrado para os filtros selecionados
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedSourceFilter('ALL');
                  setSelectedRuaFilter('ALL');
                }}
                className="mt-3 text-xs text-mac-blue hover:underline font-semibold"
              >
                Limpar filtros de busca
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-black/10 dark:border-white/10 shadow-2xs">
              <table className="w-full text-left text-xs divide-y divide-black/10 dark:divide-white/10">
                <thead className="bg-black/[0.04] dark:bg-white/[0.04] text-[11px] font-bold text-slate-600 dark:text-slate-300 select-none sticky top-0 backdrop-blur-md">
                  <tr>
                    <th className="py-2.5 px-3">Horário</th>
                    <th className="py-2.5 px-3">SKU / Peça</th>
                    <th className="py-2.5 px-3">Cor / Tam</th>
                    <th className="py-2.5 px-3 text-center">Qtd</th>
                    <th className="py-2.5 px-3">Local Anterior (De)</th>
                    <th className="py-2.5 px-2 text-center">Fluxo</th>
                    <th className="py-2.5 px-3">Novo Local (Para)</th>
                    <th className="py-2.5 px-3">Origem</th>
                    <th className="py-2.5 px-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 dark:divide-white/5 bg-white dark:bg-slate-900/60">
                  {filteredMovements.map((item, idx) => {
                    const sourceBadgeClass =
                      item.source === 'drag'
                        ? 'bg-blue-500/15 text-blue-600 dark:text-blue-300 border-blue-500/30'
                        : item.source === 'relocate'
                          ? 'bg-purple-500/15 text-purple-600 dark:text-purple-300 border-purple-500/30'
                          : 'bg-slate-500/15 text-slate-600 dark:text-slate-300 border-slate-500/30';

                    const sourceLabel =
                      item.source === 'drag'
                        ? '✋ Arraste'
                        : item.source === 'relocate'
                          ? '⚡ Remanejado'
                          : '📝 Manual';

                    return (
                      <tr
                        key={`${item.skuKey}-${idx}`}
                        className="hover:bg-mac-blue/5 dark:hover:bg-white/5 transition"
                      >
                        {/* Horário */}
                        <td className="py-2.5 px-3 font-mono text-[11px] font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          {item.movedAt}
                        </td>

                        {/* SKU e Descrição */}
                        <td className="py-2.5 px-3 max-w-xs">
                          <div className="font-mono font-bold text-xs text-slate-800 dark:text-slate-100 truncate">
                            {item.code}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            {item.name || 'Produto'}
                          </div>
                        </td>

                        {/* Cor e Tamanho */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <div className="text-[11px] font-medium text-slate-700 dark:text-slate-300">
                            Cor: <span className="font-mono font-bold">{item.colorCode}</span>
                          </div>
                          <div className="text-[10px] text-slate-400">
                            Tam: <span className="font-bold">{item.size}</span>
                          </div>
                        </td>

                        {/* Quantidade */}
                        <td className="py-2.5 px-3 text-center whitespace-nowrap font-mono font-bold text-slate-700 dark:text-slate-200">
                          {item.qty || '—'}
                        </td>

                        {/* Local Anterior */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className="font-mono font-bold text-[11px] px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                            {item.oldLocal}
                          </span>
                        </td>

                        {/* Indicador de Fluxo */}
                        <td className="py-2.5 px-2 text-center text-slate-400 font-bold select-none">
                          ➔
                        </td>

                        {/* Novo Local */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className="font-mono font-extrabold text-[11px] px-2.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/35">
                            {item.newLocal}
                          </span>
                        </td>

                        {/* Origem da Ação */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${sourceBadgeClass}`}
                          >
                            {sourceLabel}
                          </span>
                        </td>

                        {/* Ações (Localizar / Reverter) */}
                        <td className="py-2.5 px-3 text-right whitespace-nowrap space-x-1">
                          {onNavigateToSlot && (
                            <button
                              type="button"
                              onClick={() => {
                                onNavigateToSlot(item.newLocal, item.ruaDestinoCalc);
                                playMacSound('select', soundEnabled);
                              }}
                              className="px-2 py-1 rounded-md bg-mac-blue/10 hover:bg-mac-blue hover:text-white text-mac-blue text-[11px] font-bold transition"
                              title={`Localizar ${item.newLocal} no mapa`}
                            >
                              Localizar 🎯
                            </button>
                          )}

                          {onRevertMovement && (
                            <button
                              type="button"
                              onClick={() => {
                                onRevertMovement(item.skuKey);
                                playMacSound('pop', soundEnabled);
                              }}
                              className="px-2 py-1 rounded-md bg-rose-500/10 hover:bg-rose-500 hover:text-white text-rose-600 dark:text-rose-400 text-[11px] font-semibold transition"
                              title="Reverter este SKU para a posição original"
                            >
                              ↩️
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer Bar */}
        <div className="px-5 py-3 border-t border-black/10 dark:border-white/10 flex flex-wrap items-center justify-between text-xs text-slate-500 dark:text-slate-400 bg-black/[0.02] dark:bg-white/[0.02] shrink-0 gap-2">
          <div className="flex items-center space-x-2">
            <span>
              Mostrando <strong className="text-slate-700 dark:text-slate-200">{filteredMovements.length}</strong> de{' '}
              <strong className="text-slate-700 dark:text-slate-200">{totalMovementsCount}</strong> movimentações
            </span>
          </div>

          <div className="flex items-center space-x-3">
            {onClearHistory && totalMovementsCount > 0 && (
              <>
                {confirmClearOpen ? (
                  <div className="flex items-center space-x-1.5 bg-rose-500/10 border border-rose-500/30 px-2 py-0.5 rounded-lg">
                    <span className="text-[11px] text-rose-600 font-bold">Confirmar limpeza?</span>
                    <button
                      type="button"
                      onClick={() => {
                        onClearHistory();
                        setConfirmClearOpen(false);
                        playMacSound('pop', soundEnabled);
                      }}
                      className="px-1.5 py-0.5 rounded bg-rose-600 text-white text-[10px] font-bold hover:bg-rose-500"
                    >
                      Sim
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmClearOpen(false)}
                      className="px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 text-[10px] font-semibold"
                    >
                      Não
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmClearOpen(true)}
                    className="text-[11px] text-rose-500 hover:text-rose-600 hover:underline transition"
                    title="Limpar registro de movimentos desta sessão"
                  >
                    Limpar Registro
                  </button>
                )}
              </>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 font-bold text-xs transition"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
