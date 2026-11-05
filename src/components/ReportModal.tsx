import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import {
  SkuItem,
  TransbordoEntry,
  STREETS,
  RESERVED_COL35_STREETS,
  ACCESSORIES_STREETS,
  PULMAO_STREETS,
  getTotalSlotsForStreet,
  STREET_META
} from '../constants/wmsConstants';

export interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  skus: SkuItem[];
  barraItems: SkuItem[];
  transbordoRegistry: Record<string, TransbordoEntry>;
  wmsPerspective: 'sku' | 'barra';
  onSelectStreet?: (rua: string) => void;
}

interface StreetStatItem {
  rua: string;
  category: 'Porta-Paletes' | 'Acessórios' | 'Pulmão';
  capacity: number;
  occupied: number;
  transbordo: number;
  free: number;
  rate: number;
  pieces: number;
  uniqueSkus: number;
  desc: string;
}

interface CollectionStatItem {
  name: string;
  pieces: number;
  skusCount: number;
  percentage: number;
  topStreets: string[];
}

interface LevelStatItem {
  level: number;
  pieces: number;
  occupiedSlots: number;
  percentage: number;
}

export const ReportModal: React.FC<ReportModalProps> = ({
  isOpen,
  onClose,
  skus,
  barraItems,
  transbordoRegistry,
  wmsPerspective,
  onSelectStreet
}) => {
  const [activeTab, setActiveTab] = useState<'charts' | 'table' | 'collections'>('charts');
  const [streetFilter, setStreetFilter] = useState<'ALL' | 'RACK' | 'ACCESSORIES' | 'PULMAO'>('ALL');
  const [sortField, setSortField] = useState<keyof StreetStatItem>('rate');
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  const [tooltipData, setTooltipData] = useState<{
    visible: boolean;
    x: number;
    y: number;
    title: string;
    lines: string[];
  }>({ visible: false, x: 0, y: 0, title: '', lines: [] });

  const activeDataset = wmsPerspective === 'barra' ? barraItems : skus;

  // 1. Processa estatísticas detalhadas por rua
  const streetStats = useMemo<StreetStatItem[]>(() => {
    const map = new Map<string, { occupiedSlots: Set<string>; pieces: number; skusSet: Set<string> }>();

    for (const r of STREETS) {
      map.set(r, { occupiedSlots: new Set<string>(), pieces: 0, skusSet: new Set<string>() });
    }

    for (const item of activeDataset) {
      const entry = map.get(item.rua);
      if (entry) {
        entry.occupiedSlots.add(item.wms);
        entry.pieces += typeof item.qty === 'number' ? item.qty : 1;
        entry.skusSet.add(item.code);
      }
    }

    const trbMap = new Map<string, number>();
    for (const trb of Object.values(transbordoRegistry)) {
      trbMap.set(trb.rua, (trbMap.get(trb.rua) || 0) + 1);
    }

    return (STREETS as readonly string[]).map(rua => {
      const capacity = getTotalSlotsForStreet(rua);
      const data = map.get(rua) || { occupiedSlots: new Set<string>(), pieces: 0, skusSet: new Set<string>() };
      const occupied = data.occupiedSlots.size;
      const transbordo = trbMap.get(rua) || 0;
      const free = Math.max(0, capacity - occupied - transbordo);
      const rate = capacity > 0 ? (occupied / capacity) * 100 : 0;

      let category: 'Porta-Paletes' | 'Acessórios' | 'Pulmão' = 'Porta-Paletes';
      if ((ACCESSORIES_STREETS as readonly string[]).includes(rua)) category = 'Acessórios';
      else if ((PULMAO_STREETS as readonly string[]).includes(rua)) category = 'Pulmão';

      const meta = STREET_META[rua];

      return {
        rua,
        category,
        capacity,
        occupied,
        transbordo,
        free,
        rate: Math.round(rate * 10) / 10,
        pieces: data.pieces,
        uniqueSkus: data.skusSet.size,
        desc: meta?.desc || ''
      };
    });
  }, [activeDataset, transbordoRegistry]);

  // 2. Processa estatísticas por Coleção
  const collectionStats = useMemo<CollectionStatItem[]>(() => {
    const colMap = new Map<string, { pieces: number; skus: Set<string>; streets: Map<string, number> }>();
    let totalPiecesAll = 0;

    for (const item of activeDataset) {
      const col = item.colecao ? `Coleção ${item.colecao}` : 'Sem Coleção';
      const q = typeof item.qty === 'number' ? item.qty : 1;
      totalPiecesAll += q;

      if (!colMap.has(col)) {
        colMap.set(col, { pieces: 0, skus: new Set<string>(), streets: new Map<string, number>() });
      }
      const entry = colMap.get(col)!;
      entry.pieces += q;
      entry.skus.add(item.code);
      entry.streets.set(item.rua, (entry.streets.get(item.rua) || 0) + q);
    }

    const result: CollectionStatItem[] = [];
    for (const [name, val] of colMap.entries()) {
      const sortedStreets = Array.from(val.streets.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([r]) => r);

      const percentage = totalPiecesAll > 0 ? (val.pieces / totalPiecesAll) * 100 : 0;

      result.push({
        name,
        pieces: val.pieces,
        skusCount: val.skus.size,
        percentage: Math.round(percentage * 10) / 10,
        topStreets: sortedStreets
      });
    }

    return result.sort((a, b) => b.pieces - a.pieces);
  }, [activeDataset]);

  // 3. Processa distribuição por Nível (N1 ao N7)
  const levelStats = useMemo<LevelStatItem[]>(() => {
    const lvMap = new Map<number, { pieces: number; slots: Set<string> }>();
    for (let l = 1; l <= 7; l++) {
      lvMap.set(l, { pieces: 0, slots: new Set<string>() });
    }

    let totalP = 0;
    for (const item of activeDataset) {
      const q = typeof item.qty === 'number' ? item.qty : 1;
      totalP += q;
      const entry = lvMap.get(item.nivel);
      if (entry) {
        entry.pieces += q;
        entry.slots.add(item.wms);
      }
    }

    const arr: LevelStatItem[] = [];
    for (let l = 1; l <= 7; l++) {
      const val = lvMap.get(l) || { pieces: 0, slots: new Set() };
      arr.push({
        level: l,
        pieces: val.pieces,
        occupiedSlots: val.slots.size,
        percentage: totalP > 0 ? Math.round((val.pieces / totalP) * 1000) / 10 : 0
      });
    }
    return arr;
  }, [activeDataset]);

  // Totais Globais do Armazém
  const globalSummary = useMemo(() => {
    let totalCap = 0;
    let totalOcc = 0;
    let totalTrb = 0;
    let totalPieces = 0;
    const totalSkusSet = new Set<string>();

    for (const s of streetStats) {
      totalCap += s.capacity;
      totalOcc += s.occupied;
      totalTrb += s.transbordo;
      totalPieces += s.pieces;
    }

    for (const it of activeDataset) {
      totalSkusSet.add(it.code);
    }

    const globalRate = totalCap > 0 ? (totalOcc / totalCap) * 100 : 0;

    return {
      totalCap,
      totalOcc,
      totalTrb,
      totalFree: Math.max(0, totalCap - totalOcc - totalTrb),
      globalRate: Math.round(globalRate * 10) / 10,
      totalPieces,
      totalSkus: totalSkusSet.size
    };
  }, [streetStats, activeDataset]);

  // Ruas filtradas para visualização
  const filteredStreets = useMemo(() => {
    return streetStats.filter(s => {
      if (streetFilter === 'RACK') return s.category === 'Porta-Paletes';
      if (streetFilter === 'ACCESSORIES') return s.category === 'Acessórios';
      if (streetFilter === 'PULMAO') return s.category === 'Pulmão';
      return true;
    });
  }, [streetStats, streetFilter]);

  // Ruas ordenadas para a tabela
  const sortedStreetsForTable = useMemo(() => {
    return [...filteredStreets].sort((a, b) => {
      const valA = a[sortField];
      const valB = b[sortField];
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortAsc ? valA - valB : valB - valA;
      }
      return sortAsc
        ? String(valA).localeCompare(String(valB))
        : String(valB).localeCompare(String(valA));
    });
  }, [filteredStreets, sortField, sortAsc]);

  // Exportar Relatório em CSV
  const handleExportCsv = () => {
    const headers = [
      'Rua',
      'Categoria',
      'Capacidade_Total_Slots',
      'Slots_Ocupados',
      'Slots_Transbordo',
      'Slots_Livres',
      'Taxa_Ocupacao_Pct',
      'Total_Pecas',
      'SKUs_Unicos',
      'Descricao_Regra'
    ];

    const rows = streetStats.map(s => [
      s.rua,
      s.category,
      s.capacity,
      s.occupied,
      s.transbordo,
      s.free,
      `${s.rate.toFixed(1)}%`,
      s.pieces,
      s.uniqueSkus,
      `"${s.desc.replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `relatorio_wms_ocupacao_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Imprimir Relatório
  const handlePrint = () => {
    window.print();
  };

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-5 overflow-hidden"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="mac-window mac-sheet w-full max-w-6xl max-h-[92vh] sm:max-h-[90vh] rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-2xl flex flex-col border border-white/20 bg-white/95 dark:bg-slate-900/95"
      >
        {/* Header no Estilo Janela macOS */}
        <div className="mac-menubar px-4 py-3 flex items-center justify-between border-b border-black/10 dark:border-white/10 shrink-0">
          <div className="flex items-center space-x-2.5 truncate mr-2">
            <div className="flex space-x-1.5 traffic-group shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="w-3 h-3 rounded-full bg-mac-red flex items-center justify-center text-[8px] text-black/60 shadow-sm"
                title="Fechar Relatório"
              >
                <span className="traffic-icon">✕</span>
              </button>
              <span className="w-3 h-3 rounded-full bg-mac-yellow shadow-sm" />
              <button
                type="button"
                onClick={handlePrint}
                className="w-3 h-3 rounded-full bg-mac-green flex items-center justify-center text-[8px] text-black/60 shadow-sm"
                title="Imprimir Relatório"
              >
                <span className="traffic-icon">🖨️</span>
              </button>
            </div>
            <div className="ml-1 truncate">
              <h2 className="font-display font-extrabold text-xs sm:text-base flex items-center gap-1.5 truncate">
                <span className="truncate">📊 Relatório WMS</span>
                <span className="text-[10px] font-mono px-2 py-0.2 rounded-full bg-mac-blue/15 text-mac-blue font-bold border border-mac-blue/30 shrink-0">
                  D3
                </span>
              </h2>
              <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {wmsPerspective === 'barra' ? 'Caixas Físicas' : 'SKUs'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-1.5 shrink-0">
            <button
              type="button"
              onClick={handleExportCsv}
              className="px-2.5 sm:px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-bold text-xs flex items-center gap-1 transition"
              title="Baixar dados em planilha CSV"
            >
              <span>📥</span>
              <span className="hidden sm:inline">Exportar CSV</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-lg bg-black/5 dark:bg-white/10 hover:bg-black/10 text-xs font-semibold items-center gap-1.5 transition hidden md:flex"
            >
              <span>🖨️ Imprimir</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg bg-mac-blue text-white text-xs font-bold shadow-sm"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Executive KPI Summary Cards */}
        <div className="px-3 sm:px-5 py-2.5 sm:py-3.5 bg-slate-50/70 dark:bg-slate-800/40 border-b border-black/5 dark:border-white/5 flex sm:grid sm:grid-cols-3 lg:grid-cols-6 gap-2 overflow-x-auto no-scrollbar shrink-0 pb-2">
          <div className="p-2 sm:p-2.5 rounded-xl bg-white dark:bg-slate-800/80 border border-black/5 dark:border-white/10 shadow-xs shrink-0 w-32 sm:w-auto">
            <p className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Ocupação</p>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className={`text-lg sm:text-xl font-extrabold font-mono ${
                globalSummary.globalRate > 90
                  ? 'text-rose-600 dark:text-rose-400'
                  : globalSummary.globalRate > 75
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-mac-blue'
              }`}>
                {globalSummary.globalRate}%
              </span>
              <span className="text-[9px] text-slate-400">geral</span>
            </div>
          </div>

          <div className="p-2 sm:p-2.5 rounded-xl bg-white dark:bg-slate-800/80 border border-black/5 dark:border-white/10 shadow-xs shrink-0 w-32 sm:w-auto">
            <p className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Slots Ocupados</p>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-lg sm:text-xl font-extrabold font-mono text-emerald-600 dark:text-emerald-400">
                {globalSummary.totalOcc.toLocaleString('pt-BR')}
              </span>
              <span className="text-[9px] text-slate-400">/ {globalSummary.totalCap.toLocaleString('pt-BR')}</span>
            </div>
          </div>

          <div className="p-2 sm:p-2.5 rounded-xl bg-white dark:bg-slate-800/80 border border-black/5 dark:border-white/10 shadow-xs shrink-0 w-32 sm:w-auto">
            <p className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Peças Físicas</p>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-lg sm:text-xl font-extrabold font-mono text-indigo-600 dark:text-indigo-400">
                {globalSummary.totalPieces.toLocaleString('pt-BR')}
              </span>
              <span className="text-[9px] text-slate-400">pçs</span>
            </div>
          </div>

          <div className="p-2 sm:p-2.5 rounded-xl bg-white dark:bg-slate-800/80 border border-black/5 dark:border-white/10 shadow-xs shrink-0 w-32 sm:w-auto">
            <p className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">SKUs Únicos</p>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-lg sm:text-xl font-extrabold font-mono text-slate-800 dark:text-slate-100">
                {globalSummary.totalSkus.toLocaleString('pt-BR')}
              </span>
            </div>
          </div>

          <div className="p-2 sm:p-2.5 rounded-xl bg-white dark:bg-slate-800/80 border border-black/5 dark:border-white/10 shadow-xs shrink-0 w-32 sm:w-auto">
            <p className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Transbordos</p>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-lg sm:text-xl font-extrabold font-mono text-yellow-600 dark:text-yellow-400">
                {globalSummary.totalTrb}
              </span>
              <span className="text-[9px] text-slate-400">slots</span>
            </div>
          </div>

          <div className="p-2 sm:p-2.5 rounded-xl bg-white dark:bg-slate-800/80 border border-black/5 dark:border-white/10 shadow-xs shrink-0 w-32 sm:w-auto">
            <p className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Coleções</p>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-lg sm:text-xl font-extrabold font-mono text-purple-600 dark:text-purple-400">
                {collectionStats.length}
              </span>
              <span className="text-[9px] text-slate-400">ativas</span>
            </div>
          </div>
        </div>

        {/* Tab Controls & Filters */}
        <div className="px-3 sm:px-5 py-2 bg-white/70 dark:bg-slate-900/70 border-b border-black/10 dark:border-white/10 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 shrink-0">
          <div className="flex space-x-1 bg-black/5 dark:bg-white/10 p-1 rounded-xl text-xs font-semibold overflow-x-auto no-scrollbar flex-nowrap shrink-0 max-w-full">
            <button
              type="button"
              onClick={() => setActiveTab('charts')}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                activeTab === 'charts'
                  ? 'bg-white dark:bg-slate-800 text-mac-blue shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              <span>📈 Gráficos D3</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('table')}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                activeTab === 'table'
                  ? 'bg-white dark:bg-slate-800 text-mac-blue shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              <span>📋 Tabela por Rua</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('collections')}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                activeTab === 'collections'
                  ? 'bg-white dark:bg-slate-800 text-mac-blue shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              <span>🏷️ Coleções</span>
            </button>
          </div>

          <div className="flex items-center space-x-1 text-xs overflow-x-auto no-scrollbar flex-nowrap shrink-0 max-w-full pb-0.5">
            <span className="text-slate-400 font-medium text-[10px] shrink-0">Setor:</span>
            {(
              [
                { id: 'ALL', label: 'Todas' },
                { id: 'RACK', label: 'Porta-Paletes' },
                { id: 'ACCESSORIES', label: 'Acessórios' },
                { id: 'PULMAO', label: 'Pulmão' }
              ] as const
            ).map(opt => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setStreetFilter(opt.id)}
                className={`px-2 py-1 rounded-lg font-medium transition text-[10px] whitespace-nowrap shrink-0 ${
                  streetFilter === opt.id
                    ? 'bg-mac-blue text-white shadow-xs font-bold'
                    : 'bg-black/5 dark:bg-white/5 text-slate-600 dark:text-slate-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {activeTab === 'charts' && (
            <div className="space-y-6">
              {/* Gráfico D3 Principal: Taxa de Ocupação Percentual por Rua */}
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/70 border border-black/10 dark:border-white/10 shadow-sm space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-display font-extrabold text-sm sm:text-base flex items-center gap-2">
                      <span>Taxa de Ocupação Percentual por Rua (%)</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                        {filteredStreets.length} Ruas
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Proporção de slots ocupados sobre a capacidade técnica real de cada rua. A linha tracejada vermelha representa a meta de saturação recomendada (85%).
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      <span className="text-slate-500">&lt; 70% Equilibrado</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                      <span className="text-slate-500">70–85% Ideal</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                      <span className="text-slate-500">85–95% Alerta</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                      <span className="text-slate-500">&gt; 95% Crítico</span>
                    </span>
                  </div>
                </div>

                <div className="w-full overflow-x-auto pt-2">
                  <StreetOccupancyBarChart
                    data={filteredStreets}
                    onBarHover={(data, clientX, clientY) => {
                      if (!data || clientX === undefined || clientY === undefined) {
                        setTooltipData(prev => ({ ...prev, visible: false }));
                      } else {
                        setTooltipData({
                          visible: true,
                          x: clientX,
                          y: clientY - 14,
                          title: `Rua ${data.rua} (${data.category})`,
                          lines: [
                            `Ocupação: ${data.rate.toFixed(1)}%`,
                            `Slots: ${data.occupied} ocupados / ${data.capacity} total`,
                            `Livres: ${data.free} slots disponíveis`,
                            data.transbordo > 0 ? `Transbordos: ${data.transbordo} colmeias` : '',
                            `Peças Físicas: ${data.pieces.toLocaleString('pt-BR')} pçs`,
                            `SKUs Únicos: ${data.uniqueSkus}`
                          ].filter(Boolean)
                        });
                      }
                    }}
                    onBarClick={item => {
                      if (onSelectStreet) {
                        onSelectStreet(item.rua);
                        onClose();
                      }
                    }}
                  />
                </div>
              </div>

              {/* Grid com 2 Gráficos D3 Secundários: Distribuição por Coleção & Densidade por Andar */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Gráfico D3: Tendência & Estoque por Coleção */}
                <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/70 border border-black/10 dark:border-white/10 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-display font-extrabold text-sm flex items-center gap-2">
                        <span>🏷️ Tendência & Volume de Estoque por Coleção</span>
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Participação no volume total de peças armazenadas
                      </p>
                    </div>
                    <span className="text-[11px] font-mono text-purple-600 dark:text-purple-400 font-bold">
                      {collectionStats.length} Coleções
                    </span>
                  </div>

                  <CollectionDonutChart
                    data={collectionStats}
                    totalPieces={globalSummary.totalPieces}
                    onSliceHover={(slice, clientX, clientY) => {
                      if (!slice || clientX === undefined || clientY === undefined) {
                        setTooltipData(prev => ({ ...prev, visible: false }));
                      } else {
                        setTooltipData({
                          visible: true,
                          x: clientX,
                          y: clientY - 14,
                          title: slice.name,
                          lines: [
                            `Total de Peças: ${slice.pieces.toLocaleString('pt-BR')} pçs`,
                            `Participação: ${slice.percentage}% do armazém`,
                            `SKUs únicos: ${slice.skusCount}`,
                            slice.topStreets.length > 0 ? `Principais Ruas: ${slice.topStreets.join(', ')}` : ''
                          ].filter(Boolean)
                        });
                      }
                    }}
                  />
                </div>

                {/* Gráfico D3: Ocupação Vertical por Andar (Nível 1 a Nível 7) */}
                <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/70 border border-black/10 dark:border-white/10 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-display font-extrabold text-sm flex items-center gap-2">
                        <span>🏢 Densidade de Carga Vertical (Nível 1 ao Nível 7)</span>
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Distribuição de peças por nível de altura nas colmeias
                      </p>
                    </div>
                    <span className="text-[11px] font-mono text-slate-400 font-bold">
                      Ergonomia & Picking
                    </span>
                  </div>

                  <LevelDensityBarChart
                    data={levelStats}
                    onBarHover={(levelData, clientX, clientY) => {
                      if (!levelData || clientX === undefined || clientY === undefined) {
                        setTooltipData(prev => ({ ...prev, visible: false }));
                      } else {
                        setTooltipData({
                          visible: true,
                          x: clientX,
                          y: clientY - 14,
                          title: `Nível ${levelData.level} (${levelData.level === 1 ? 'Piso/Chão' : levelData.level === 7 ? 'Topo' : 'Intermediário'})`,
                          lines: [
                            `Peças no Nível: ${levelData.pieces.toLocaleString('pt-BR')} pçs`,
                            `Participação Vertical: ${levelData.percentage}%`,
                            `Slots ocupados: ${levelData.occupiedSlots} endereços`
                          ]
                        });
                      }
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'table' && (
            <div className="rounded-2xl border border-black/10 dark:border-white/10 overflow-hidden shadow-xs bg-white dark:bg-slate-800">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-b border-black/5 dark:border-white/5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="font-bold text-sm">Auditoria Completa de Capacidade por Rua</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Clique no cabeçalho das colunas para ordenar de forma crescente ou decrescente
                  </p>
                </div>
                <div className="text-xs text-slate-500 font-mono">
                  {sortedStreetsForTable.length} ruas listadas
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100/70 dark:bg-slate-700/50 uppercase font-mono text-[10px] text-slate-500 border-b border-black/10 dark:border-white/10">
                    <tr>
                      <th
                        onClick={() => {
                          if (sortField === 'rua') setSortAsc(!sortAsc);
                          else { setSortField('rua'); setSortAsc(true); }
                        }}
                        className="p-3 cursor-pointer hover:bg-black/5"
                      >
                        Rua {sortField === 'rua' ? (sortAsc ? '▲' : '▼') : ''}
                      </th>
                      <th className="p-3">Categoria</th>
                      <th
                        onClick={() => {
                          if (sortField === 'capacity') setSortAsc(!sortAsc);
                          else { setSortField('capacity'); setSortAsc(false); }
                        }}
                        className="p-3 text-right cursor-pointer hover:bg-black/5"
                      >
                        Capacidade {sortField === 'capacity' ? (sortAsc ? '▲' : '▼') : ''}
                      </th>
                      <th
                        onClick={() => {
                          if (sortField === 'occupied') setSortAsc(!sortAsc);
                          else { setSortField('occupied'); setSortAsc(false); }
                        }}
                        className="p-3 text-right cursor-pointer hover:bg-black/5"
                      >
                        Ocupados {sortField === 'occupied' ? (sortAsc ? '▲' : '▼') : ''}
                      </th>
                      <th
                        onClick={() => {
                          if (sortField === 'free') setSortAsc(!sortAsc);
                          else { setSortField('free'); setSortAsc(false); }
                        }}
                        className="p-3 text-right cursor-pointer hover:bg-black/5"
                      >
                        Livres {sortField === 'free' ? (sortAsc ? '▲' : '▼') : ''}
                      </th>
                      <th
                        onClick={() => {
                          if (sortField === 'rate') setSortAsc(!sortAsc);
                          else { setSortField('rate'); setSortAsc(false); }
                        }}
                        className="p-3 text-right cursor-pointer hover:bg-black/5"
                      >
                        Ocupação % {sortField === 'rate' ? (sortAsc ? '▲' : '▼') : ''}
                      </th>
                      <th
                        onClick={() => {
                          if (sortField === 'pieces') setSortAsc(!sortAsc);
                          else { setSortField('pieces'); setSortAsc(false); }
                        }}
                        className="p-3 text-right cursor-pointer hover:bg-black/5"
                      >
                        Total Peças {sortField === 'pieces' ? (sortAsc ? '▲' : '▼') : ''}
                      </th>
                      <th
                        onClick={() => {
                          if (sortField === 'uniqueSkus') setSortAsc(!sortAsc);
                          else { setSortField('uniqueSkus'); setSortAsc(false); }
                        }}
                        className="p-3 text-right cursor-pointer hover:bg-black/5"
                      >
                        SKUs {sortField === 'uniqueSkus' ? (sortAsc ? '▲' : '▼') : ''}
                      </th>
                      <th className="p-3 text-center">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5 dark:divide-white/5 font-mono">
                    {sortedStreetsForTable.map(s => (
                      <tr key={s.rua} className="hover:bg-mac-blue/5 transition">
                        <td className="p-3 font-bold font-sans flex items-center gap-1.5">
                          <span className={`px-2 py-0.5 rounded text-white font-extrabold text-[11px] ${
                            (RESERVED_COL35_STREETS as readonly string[]).includes(s.rua)
                              ? 'bg-amber-600'
                              : (ACCESSORIES_STREETS as readonly string[]).includes(s.rua)
                                ? 'bg-purple-600'
                                : (PULMAO_STREETS as readonly string[]).includes(s.rua)
                                  ? 'bg-cyan-600'
                                  : 'bg-mac-blue'
                          }`}>
                            {s.rua}
                          </span>
                          {(RESERVED_COL35_STREETS as readonly string[]).includes(s.rua) && (
                            <span className="text-[10px] text-amber-600 font-sans font-bold">Col. 35</span>
                          )}
                        </td>
                        <td className="p-3 font-sans text-slate-500">{s.category}</td>
                        <td className="p-3 text-right">{s.capacity}</td>
                        <td className="p-3 text-right text-emerald-600 dark:text-emerald-400 font-bold">{s.occupied}</td>
                        <td className="p-3 text-right text-slate-500">{s.free}</td>
                        <td className="p-3 text-right">
                          <span className={`font-bold px-2 py-0.5 rounded-full text-[10px] ${
                            s.rate > 90
                              ? 'bg-rose-500/20 text-rose-600'
                              : s.rate > 75
                                ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                                : 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                          }`}>
                            {s.rate.toFixed(1)}%
                          </span>
                        </td>
                        <td className="p-3 text-right font-bold text-indigo-600 dark:text-indigo-400">
                          {s.pieces.toLocaleString('pt-BR')}
                        </td>
                        <td className="p-3 text-right">{s.uniqueSkus}</td>
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              if (onSelectStreet) {
                                onSelectStreet(s.rua);
                                onClose();
                              }
                            }}
                            className="px-2.5 py-1 rounded-lg bg-mac-blue/15 hover:bg-mac-blue hover:text-white text-mac-blue font-sans font-bold text-[10px] transition"
                          >
                            Ver no Mapa ➜
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'collections' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {collectionStats.map(c => (
                  <div
                    key={c.name}
                    className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-black/10 dark:border-white/10 shadow-xs space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-display font-extrabold text-sm text-slate-800 dark:text-slate-100">
                        {c.name}
                      </span>
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-700 dark:text-purple-300">
                        {c.percentage}% do total
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                      <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-900/50">
                        <span className="text-[10px] text-slate-400 block font-sans">Peças Físicas</span>
                        <strong className="text-sm text-indigo-600 dark:text-indigo-400">
                          {c.pieces.toLocaleString('pt-BR')}
                        </strong>
                      </div>
                      <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-900/50">
                        <span className="text-[10px] text-slate-400 block font-sans">SKUs Únicos</span>
                        <strong className="text-sm text-slate-700 dark:text-slate-200">
                          {c.skusCount}
                        </strong>
                      </div>
                    </div>

                    {c.topStreets.length > 0 && (
                      <div className="text-[11px] text-slate-500 pt-1">
                        <span className="font-sans font-semibold">Ruas Principais: </span>
                        <span className="font-mono font-bold text-mac-blue">{c.topStreets.join(' • ')}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Floating Custom D3 Tooltip */}
        {tooltipData.visible && (
          <div
            className="fixed pointer-events-none z-50 transform -translate-x-1/2 -translate-y-full mb-2 mac-window px-3 py-2 rounded-xl shadow-xl text-xs space-y-0.5 border border-white/20 transition-all duration-75"
            style={{ left: tooltipData.x, top: tooltipData.y }}
          >
            <p className="font-bold text-mac-blue">{tooltipData.title}</p>
            {tooltipData.lines.map((line, idx) => (
              <p key={idx} className="text-slate-600 dark:text-slate-300 font-mono text-[11px]">
                {line}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

/* =======================================================================
   D3 CHART COMPONENT 1: Bar Chart de Taxa de Ocupação por Rua
   ======================================================================= */
interface StreetOccupancyBarChartProps {
  data: StreetStatItem[];
  onBarHover: (item: StreetStatItem | null, clientX?: number, clientY?: number) => void;
  onBarClick: (item: StreetStatItem) => void;
}

const StreetOccupancyBarChart: React.FC<StreetOccupancyBarChartProps> = ({
  data,
  onBarHover,
  onBarClick
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!svgRef.current || data.length === 0) return;

    try {
      const svg = d3.select(svgRef.current);
      svg.selectAll('*').remove();

      const margin = { top: 25, right: 25, bottom: 45, left: 45 };
      const width = Math.max(700, data.length * 36) - margin.left - margin.right;
      const height = 260 - margin.top - margin.bottom;

    const g = svg
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // X Scale (Ruas)
    const x = d3
      .scaleBand()
      .domain(data.map(d => d.rua))
      .range([0, width])
      .padding(0.28);

    // Y Scale (Ocupação 0% a 100%)
    const y = d3.scaleLinear().domain([0, 100]).range([height, 0]);

    // Gridlines horizontais sutis
    g.append('g')
      .attr('class', 'grid')
      .call(
        d3.axisLeft(y)
          .tickValues([25, 50, 75, 85, 100])
          .tickSize(-width)
          .tickFormat(() => '')
      )
      .selectAll('line')
      .attr('stroke', 'currentColor')
      .attr('opacity', 0.08);

    // Linha de Referência de Alerta (85% meta de capacidade)
    g.append('line')
      .attr('x1', 0)
      .attr('x2', width)
      .attr('y1', y(85))
      .attr('y2', y(85))
      .attr('stroke', '#E11D48')
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '4,4')
      .attr('opacity', 0.7);

    g.append('text')
      .attr('x', width - 6)
      .attr('y', y(85) - 4)
      .attr('text-anchor', 'end')
      .attr('font-size', '9px')
      .attr('font-weight', 'bold')
      .attr('fill', '#E11D48')
      .text('Meta Alerta WMS: 85%');

    // Eixo X
    const xAxis = g
      .append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x));

    xAxis.selectAll('text')
      .attr('font-family', 'JetBrains Mono, monospace')
      .attr('font-size', '11px')
      .attr('font-weight', '700')
      .attr('fill', 'currentColor')
      .attr('opacity', 0.85);

    // Eixo Y
    const yAxis = g.append('g').call(
      d3.axisLeft(y)
        .tickValues([0, 25, 50, 75, 100])
        .tickFormat(d => `${d}%`)
    );

    yAxis.selectAll('text')
      .attr('font-family', 'JetBrains Mono, monospace')
      .attr('font-size', '10px')
      .attr('opacity', 0.65);

    // Barras Verticais de Ocupação
    const bars = g
      .selectAll('.bar-group')
      .data(data)
      .enter()
      .append('g')
      .attr('class', 'bar-group')
      .style('cursor', 'pointer');

    // Fundo cinza suave de capacidade total (100%)
    bars.append('rect')
      .attr('x', d => x(d.rua) || 0)
      .attr('y', 0)
      .attr('width', x.bandwidth())
      .attr('height', height)
      .attr('rx', 4)
      .attr('fill', 'currentColor')
      .attr('opacity', 0.04);

    // Barra de Ocupação Real com Cor Dinâmica
    bars.append('rect')
      .attr('x', d => x(d.rua) || 0)
      .attr('y', height)
      .attr('width', x.bandwidth())
      .attr('height', 0)
      .attr('rx', 4)
      .attr('fill', d => {
        if (d.rate > 95) return '#E11D48'; // Rose
        if (d.rate > 85) return '#F59E0B'; // Amber
        if (d.rate > 70) return '#6366F1'; // Indigo
        return '#10B981'; // Emerald
      })
      .attr('opacity', 0.9)
      .transition()
      .duration(750)
      .ease(d3.easeCubicOut)
      .attr('y', d => y(d.rate))
      .attr('height', d => height - y(d.rate));

    // Rótulo da Porcentagem em Cima de Cada Barra
    bars.append('text')
      .attr('x', d => (x(d.rua) || 0) + x.bandwidth() / 2)
      .attr('y', d => Math.max(12, y(d.rate) - 4))
      .attr('text-anchor', 'middle')
      .attr('font-family', 'JetBrains Mono, monospace')
      .attr('font-size', '9px')
      .attr('font-weight', 'bold')
      .attr('fill', d => (d.rate > 85 ? '#E11D48' : 'currentColor'))
      .attr('opacity', 0.9)
      .text(d => `${d.rate}%`);

    // Eventos Interativos
    bars
      .on('mouseenter', function (event: MouseEvent, d: StreetStatItem) {
        d3.select(this as SVGGElement)
          .select('rect:nth-child(2)')
          .attr('opacity', 1)
          .attr('stroke', '#0A84FF')
          .attr('stroke-width', 2);
        onBarHover(d, event.clientX, event.clientY);
      })
      .on('mousemove', function (event: MouseEvent, d: StreetStatItem) {
        onBarHover(d, event.clientX, event.clientY);
      })
      .on('mouseleave', function () {
        d3.select(this as SVGGElement)
          .select('rect:nth-child(2)')
          .attr('opacity', 0.9)
          .attr('stroke', 'none');
        onBarHover(null);
      })
      .on('click', (_, d: StreetStatItem) => {
        onBarClick(d);
      });
    } catch (err) {
      console.error('StreetOccupancyBarChart render error:', err);
    }
  }, [data, onBarHover, onBarClick]);

  return <svg ref={svgRef} className="mx-auto block select-none text-slate-700 dark:text-slate-200" />;
};

/* =======================================================================
   D3 CHART COMPONENT 2: Donut Chart de Estoque por Coleção
   ======================================================================= */
interface CollectionDonutChartProps {
  data: CollectionStatItem[];
  totalPieces: number;
  onSliceHover: (item: CollectionStatItem | null, clientX?: number, clientY?: number) => void;
}

const CollectionDonutChart: React.FC<CollectionDonutChartProps> = ({
  data,
  totalPieces,
  onSliceHover
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    if (data.length === 0 || totalPieces <= 0) {
      svg
        .attr('width', 280)
        .attr('height', 80)
        .append('text')
        .attr('x', 140)
        .attr('y', 45)
        .attr('text-anchor', 'middle')
        .attr('font-size', '11px')
        .attr('fill', 'currentColor')
        .attr('opacity', 0.5)
        .text('Nenhuma peça registrada nesta perspectiva');
      return;
    }

    try {
      const width = 280;
      const height = 240;
      const radius = Math.min(width, height) / 2 - 16;
      const innerRadius = radius * 0.58;

      const g = svg
        .attr('width', width)
        .attr('height', height)
        .append('g')
        .attr('transform', `translate(${width / 2},${height / 2})`);

      const colorPalette = [
        '#6366F1', // Indigo
        '#0A84FF', // Mac Blue
        '#10B981', // Emerald
        '#F59E0B', // Amber
        '#EC4899', // Pink
        '#8B5CF6', // Purple
        '#14B8A6'  // Teal
      ];

      const pie = d3
        .pie<CollectionStatItem>()
        .value(d => d.pieces)
        .sort(null)
        .padAngle(0.03);

      const arc = d3
        .arc<d3.PieArcDatum<CollectionStatItem>>()
        .innerRadius(innerRadius)
        .outerRadius(radius)
        .cornerRadius(4);

      const arcHover = d3
        .arc<d3.PieArcDatum<CollectionStatItem>>()
        .innerRadius(innerRadius)
        .outerRadius(radius + 7)
        .cornerRadius(5);

      const arcs = g
        .selectAll('.arc')
        .data(pie(data))
        .enter()
        .append('g')
        .attr('class', 'arc')
        .style('cursor', 'pointer');

      arcs
        .append('path')
        .attr('d', d => arc(d) || '')
        .attr('fill', (_, i) => colorPalette[i % colorPalette.length])
        .attr('opacity', 0.88)
        .transition()
        .duration(700)
        .attrTween('d', function (d) {
          const interpolate = d3.interpolate({ startAngle: 0, endAngle: 0 }, d);
          return function (t) {
            return arc(interpolate(t)) || '';
          };
        });

      // Texto Central do Donut
      g.append('text')
        .attr('text-anchor', 'middle')
        .attr('dy', '-0.3em')
        .attr('font-family', 'JetBrains Mono, monospace')
        .attr('font-size', '17px')
        .attr('font-weight', '800')
        .attr('fill', 'currentColor')
        .text(totalPieces.toLocaleString('pt-BR'));

      g.append('text')
        .attr('text-anchor', 'middle')
        .attr('dy', '1.2em')
        .attr('font-size', '10px')
        .attr('font-weight', 'bold')
        .attr('opacity', 0.5)
        .attr('fill', 'currentColor')
        .text('TOTAL PEÇAS');

      arcs
        .on('mouseenter', function (event: MouseEvent, d: d3.PieArcDatum<CollectionStatItem>) {
          d3.select(this as SVGGElement)
            .select('path')
            .transition()
            .duration(150)
            .attr('d', () => arcHover(d) || '')
            .attr('opacity', 1);
          onSliceHover(d.data, event.clientX, event.clientY);
        })
        .on('mousemove', function (event: MouseEvent, d: d3.PieArcDatum<CollectionStatItem>) {
          onSliceHover(d.data, event.clientX, event.clientY);
        })
        .on('mouseleave', function (_: MouseEvent, d: d3.PieArcDatum<CollectionStatItem>) {
          d3.select(this as SVGGElement)
            .select('path')
            .transition()
            .duration(150)
            .attr('d', () => arc(d) || '')
            .attr('opacity', 0.88);
          onSliceHover(null);
        });
    } catch (err) {
      console.error('CollectionDonutChart render error:', err);
    }
  }, [data, totalPieces, onSliceHover]);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
      <svg ref={svgRef} className="select-none text-slate-800 dark:text-slate-100 shrink-0" />
      <div className="space-y-1.5 w-full max-w-xs text-xs">
        {data.slice(0, 5).map((item, idx) => {
          const colors = ['bg-indigo-500', 'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-pink-500'];
          return (
            <div key={item.name} className="flex items-center justify-between p-1.5 rounded-lg bg-black/5 dark:bg-white/5 font-mono">
              <div className="flex items-center gap-2 truncate">
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${colors[idx % colors.length]}`} />
                <span className="font-sans font-bold truncate text-[11px]">{item.name}</span>
              </div>
              <div className="text-right shrink-0">
                <span className="font-bold text-[11px]">{item.pieces.toLocaleString('pt-BR')} pçs</span>
                <span className="text-[10px] text-slate-400 ml-1">({item.percentage}%)</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* =======================================================================
   D3 CHART COMPONENT 3: Densidade de Carga Vertical (N1 a N7)
   ======================================================================= */
interface LevelDensityBarChartProps {
  data: LevelStatItem[];
  onBarHover: (item: LevelStatItem | null, clientX?: number, clientY?: number) => void;
}

const LevelDensityBarChart: React.FC<LevelDensityBarChartProps> = ({ data, onBarHover }) => {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!svgRef.current || data.length === 0) return;

    try {
      const svg = d3.select(svgRef.current);
      svg.selectAll('*').remove();

      const margin = { top: 15, right: 35, bottom: 25, left: 55 };
      const width = 360 - margin.left - margin.right;
      const height = 240 - margin.top - margin.bottom;

      const g = svg
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

      // Invertido: Nível 7 no topo, Nível 1 no piso!
      const y = d3
        .scaleBand()
        .domain([7, 6, 5, 4, 3, 2, 1].map(String))
        .range([0, height])
        .padding(0.24);

      const maxPieces = d3.max(data, d => d.pieces) || 1;
      const x = d3.scaleLinear().domain([0, maxPieces]).range([0, width]);

      // Eixo Y (Níveis)
      const yAxis = g.append('g').call(
        d3.axisLeft(y).tickFormat(d => `Nível ${d}`)
      );

      yAxis.selectAll('text')
        .attr('font-family', 'Plus Jakarta Sans, sans-serif')
        .attr('font-size', '10px')
        .attr('font-weight', '700')
        .attr('fill', 'currentColor')
        .attr('opacity', 0.85);

      // Barras Horizontais
      const bars = g
        .selectAll('.level-bar')
        .data(data)
        .enter()
        .append('g')
        .attr('class', 'level-bar')
        .style('cursor', 'pointer');

      // Fundo cinza suave
      bars.append('rect')
        .attr('x', 0)
        .attr('y', d => y(String(d.level)) || 0)
        .attr('width', width)
        .attr('height', y.bandwidth())
        .attr('rx', 4)
        .attr('fill', 'currentColor')
        .attr('opacity', 0.04);

      // Barra Real
      bars.append('rect')
        .attr('x', 0)
        .attr('y', d => y(String(d.level)) || 0)
        .attr('width', 0)
        .attr('height', y.bandwidth())
        .attr('rx', 4)
        .attr('fill', d => {
          if (d.level === 1) return '#0A84FF'; // Piso
          if (d.level <= 3) return '#6366F1'; // Níveis baixos
          if (d.level <= 5) return '#8B5CF6'; // Níveis médios
          return '#EC4899'; // Níveis altos (Topo)
        })
        .attr('opacity', 0.85)
        .transition()
        .duration(650)
        .ease(d3.easeCubicOut)
        .attr('width', d => x(d.pieces));

      // Rótulos de Texto com Quantidade de Peças
      bars.append('text')
        .attr('x', d => Math.max(8, x(d.pieces) + 6))
        .attr('y', d => (y(String(d.level)) || 0) + y.bandwidth() / 2 + 3)
        .attr('font-family', 'JetBrains Mono, monospace')
        .attr('font-size', '9px')
        .attr('font-weight', 'bold')
        .attr('fill', 'currentColor')
        .attr('opacity', 0.85)
        .text(d => `${d.pieces.toLocaleString('pt-BR')} pçs`);

      bars
        .on('mouseenter', function (event: MouseEvent, d: LevelStatItem) {
          d3.select(this as SVGGElement)
            .select('rect:nth-child(2)')
            .attr('opacity', 1)
            .attr('stroke', '#0A84FF')
            .attr('stroke-width', 1.5);
          onBarHover(d, event.clientX, event.clientY);
        })
        .on('mousemove', function (event: MouseEvent, d: LevelStatItem) {
          onBarHover(d, event.clientX, event.clientY);
        })
        .on('mouseleave', function () {
          d3.select(this as SVGGElement)
            .select('rect:nth-child(2)')
            .attr('opacity', 0.85)
            .attr('stroke', 'none');
          onBarHover(null);
        });
    } catch (err) {
      console.error('LevelDensityBarChart render error:', err);
    }
  }, [data, onBarHover]);

  return <svg ref={svgRef} className="mx-auto block select-none text-slate-800 dark:text-slate-100" />;
};
