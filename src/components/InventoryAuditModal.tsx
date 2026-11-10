import React, { useState, useMemo } from 'react';
import {
  SkuItem,
  STREETS,
  isReservedCol35Street
} from '../constants/wmsConstants';
import { triggerCsvDownload, buildOperatorMisplacedGuideCsv } from '../utils/storageAndSync';

export interface InventoryAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  skus: SkuItem[];
  barraItems: SkuItem[];
  wmsPerspective: 'sku' | 'barra';
  conflictAnalysis: {
    overlappedSlots: Set<string>;
    splitSkus: Set<string>;
    splitSkuSlots: Set<string>;
    allConflictSlots: Set<string>;
    invaderSlots: Set<string>;
    lowStockSlots: Set<string>;
  };
  addressMap: Map<string, SkuItem[]>;
  onNavigateToSlot?: (wms: string, rua: string) => void;
}

export interface AuditRecord {
  id: string;
  category: 'CONFLITO_SOBREPOSICAO' | 'INVASOR_FORA_LOCAL' | 'SKU_FRAGMENTADO';
  badgeLabel: string;
  badgeClass: string;
  icon: string;
  rua: string;
  wms: string;
  skuCode: string;
  skuName: string;
  brand: string;
  colorCode: string;
  colorName: string;
  colorHex: string;
  size: string;
  qty: number;
  localCadastro: string;
  localAtual: string;
  colecao: string;
  deposito: string;
  diagnostico: string;
  itemRef: SkuItem;
}

export const InventoryAuditModal: React.FC<InventoryAuditModalProps> = ({
  isOpen,
  onClose,
  skus,
  barraItems,
  wmsPerspective,
  conflictAnalysis,
  addressMap,
  onNavigateToSlot
}) => {
  const [selectedRuaFilter, setSelectedRuaFilter] = useState<string>('ALL');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<'ALL' | 'CONFLITO' | 'INVASOR' | 'FRAGMENTADO'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedNotification, setCopiedNotification] = useState<boolean>(false);

  // Active items based on current perspective
  const activeItems = useMemo(() => {
    if (wmsPerspective === 'barra' && barraItems.length > 0) {
      return barraItems;
    }
    return skus;
  }, [wmsPerspective, barraItems, skus]);

  // Build complete list of discrepancy audit records
  const allAuditRecords = useMemo(() => {
    const list: AuditRecord[] = [];
    const seenItemIds = new Set<string>();

    // 1. SKUs Invasores (Alocados fora do local cadastrado na ficha do produto)
    for (const item of activeItems) {
      if (item.isTransbordo) continue;
      if (item.isOutsideRegisteredLocal) {
        seenItemIds.add(item.id);
        const rua = item.rua || item.wms.split('.')[0] || '—';
        const rawCad = (item.localCadastroRaw || item.rawLocal || '').trim();
        const hasNoCad = !rawCad || /^(sem\s*local|s\/?cadastro|s\/?local|null|undefined)$/i.test(rawCad);
        const localCadastroDisplay = hasNoCad ? 'S/Cadastro' : rawCad;
        list.push({
          id: `invader-${item.id}`,
          category: 'INVASOR_FORA_LOCAL',
          badgeLabel: hasNoCad ? '⚠️ SKU Sem Local de Cadastro' : '⚠️ SKU Invasor (Fora do Cadastro)',
          badgeClass: 'bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300',
          icon: '⚠️',
          rua,
          wms: item.wms,
          skuCode: item.code,
          skuName: item.name || 'Produto sem descrição',
          brand: item.brand || '—',
          colorCode: item.colorCode || '—',
          colorName: item.colorName || '—',
          colorHex: item.colorHex || '#94A3B8',
          size: item.size || '—',
          qty: item.qtdForaDoLocal || (typeof item.qty === 'number' ? item.qty : 1),
          localCadastro: localCadastroDisplay,
          localAtual: item.wms,
          colecao: item.colecao || '—',
          deposito: item.deposito || '2',
          diagnostico: hasNoCad
            ? `Peça em ${item.wms} sem local cadastrado (S/Cadastro) no sistema`
            : `Peça bipada fisicamente em ${item.wms}, mas cadastrada para ${rawCad}`,
          itemRef: item
        });
      }
    }

    // 2. Conflitos de Sobreposição (Mais de um SKU diferente ocupando a mesma célula WMS)
    for (const wmsKey of conflictAnalysis.overlappedSlots) {
      const itemsInSlot = (addressMap.get(wmsKey) || []).filter(i => !i.isTransbordo);
      const street = itemsInSlot[0]?.rua || wmsKey.split('.')[0] || '—';
      const otherSkuCodes = Array.from(new Set(itemsInSlot.map(i => i.code.split(' - ')[0])));

      for (const item of itemsInSlot) {
        const uniqueKey = `overlap-${wmsKey}-${item.id}`;
        list.push({
          id: uniqueKey,
          category: 'CONFLITO_SOBREPOSICAO',
          badgeLabel: '🚨 Conflito: Sobreposição (Mesma Célula)',
          badgeClass: 'bg-rose-500/15 border-rose-500/40 text-rose-700 dark:text-rose-300',
          icon: '🚨',
          rua: street,
          wms: wmsKey,
          skuCode: item.code,
          skuName: item.name || 'Produto sem descrição',
          brand: item.brand || '—',
          colorCode: item.colorCode || '—',
          colorName: item.colorName || '—',
          colorHex: item.colorHex || '#94A3B8',
          size: item.size || '—',
          qty: typeof item.qty === 'number' ? item.qty : 1,
          localCadastro: item.localCadastroRaw || item.rawLocal || wmsKey,
          localAtual: wmsKey,
          colecao: item.colecao || '—',
          deposito: item.deposito || '2',
          diagnostico: `Compartilha a célula ${wmsKey} com: ${otherSkuCodes.filter(c => c !== item.code.split(' - ')[0]).join(', ') || 'outro SKU'}`,
          itemRef: item
        });
      }
    }

    // 3. Conflitos de Fragmentação (Mesmo SKU espalhado em múltiplas torres distintas)
    for (const item of activeItems) {
      if (item.isTransbordo) continue;
      const canonical = item.code.trim().toUpperCase();
      if (conflictAnalysis.splitSkus.has(canonical)) {
        // If not already in the list as overlap or invader for this slot
        const isAlreadyListedForSlot = list.some(r => r.wms === item.wms && r.itemRef.id === item.id);
        if (!isAlreadyListedForSlot) {
          const rua = item.rua || item.wms.split('.')[0] || '—';
          list.push({
            id: `split-${item.id}`,
            category: 'SKU_FRAGMENTADO',
            badgeLabel: '🔀 SKU Fragmentado (Múltiplas Torres)',
            badgeClass: 'bg-purple-500/15 border-purple-500/40 text-purple-700 dark:text-purple-300',
            icon: '🔀',
            rua,
            wms: item.wms,
            skuCode: item.code,
            skuName: item.name || 'Produto sem descrição',
            brand: item.brand || '—',
            colorCode: item.colorCode || '—',
            colorName: item.colorName || '—',
            colorHex: item.colorHex || '#94A3B8',
            size: item.size || '—',
            qty: typeof item.qty === 'number' ? item.qty : 1,
            localCadastro: item.localCadastroRaw || item.rawLocal || '—',
            localAtual: item.wms,
            colecao: item.colecao || '—',
            deposito: item.deposito || '2',
            diagnostico: `Estoque deste mesmo SKU está distribuído em mais de uma prumada/torre física`,
            itemRef: item
          });
        }
      }
    }

    return list;
  }, [activeItems, conflictAnalysis, addressMap]);

  // Available streets with discrepancy counts
  const streetDiscrepancyCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const rec of allAuditRecords) {
      counts[rec.rua] = (counts[rec.rua] || 0) + 1;
    }
    return counts;
  }, [allAuditRecords]);

  const streetsWithIssues = useMemo(() => {
    return Object.keys(streetDiscrepancyCounts).sort();
  }, [streetDiscrepancyCounts]);

  // Filtered records
  const filteredRecords = useMemo(() => {
    return allAuditRecords.filter(rec => {
      // Filter by street
      if (selectedRuaFilter !== 'ALL' && rec.rua !== selectedRuaFilter) {
        return false;
      }
      // Filter by type
      if (selectedTypeFilter === 'CONFLITO' && rec.category !== 'CONFLITO_SOBREPOSICAO') {
        return false;
      }
      if (selectedTypeFilter === 'INVASOR' && rec.category !== 'INVASOR_FORA_LOCAL') {
        return false;
      }
      if (selectedTypeFilter === 'FRAGMENTADO' && rec.category !== 'SKU_FRAGMENTADO') {
        return false;
      }
      // Filter by search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesSku = rec.skuCode.toLowerCase().includes(q);
        const matchesName = rec.skuName.toLowerCase().includes(q);
        const matchesWms = rec.wms.toLowerCase().includes(q);
        const matchesColor = rec.colorCode.toLowerCase().includes(q) || rec.colorName.toLowerCase().includes(q);
        const matchesLocal = rec.localCadastro.toLowerCase().includes(q);
        const matchesSize = rec.size.toLowerCase().includes(q);
        return matchesSku || matchesName || matchesWms || matchesColor || matchesLocal || matchesSize;
      }
      return true;
    });
  }, [allAuditRecords, selectedRuaFilter, selectedTypeFilter, searchQuery]);

  // Summary KPI statistics
  const summaryKpis = useMemo(() => {
    const totalDiscrepancies = filteredRecords.length;
    const countOverlaps = filteredRecords.filter(r => r.category === 'CONFLITO_SOBREPOSICAO').length;
    const countInvaders = filteredRecords.filter(r => r.category === 'INVASOR_FORA_LOCAL').length;
    const countSplits = filteredRecords.filter(r => r.category === 'SKU_FRAGMENTADO').length;
    const totalImpactedPieces = filteredRecords.reduce((acc, r) => acc + (r.qty || 1), 0);
    return {
      totalDiscrepancies,
      countOverlaps,
      countInvaders,
      countSplits,
      totalImpactedPieces
    };
  }, [filteredRecords]);

  // Export to CSV function
  const handleExportCsv = () => {
    if (filteredRecords.length === 0) return;

    const headers = [
      'RUA',
      'ENDERECO_WMS',
      'TIPO_DISCREPANCIA',
      'SKU_COMPLETO',
      'CODIGO_BASE',
      'DESCRICAO',
      'COLECAO',
      'CODIGO_COR',
      'NOME_COR',
      'TAMANHO',
      'QTD_PECAS',
      'LOCAL_CADASTRO_OFICIAL',
      'LOCAL_ATUAL_FISICO',
      'DEPOSITO',
      'DIAGNOSTICO_OPERACIONAL',
      'DATA_AUDITORIA'
    ];

    const todayStr = new Date().toISOString().slice(0, 10);
    const rows = filteredRecords.map(rec => {
      const cleanSku = rec.skuCode.replace(/"/g, '""');
      const cleanName = rec.skuName.replace(/"/g, '""');
      const cleanDiag = rec.diagnostico.replace(/"/g, '""');
      return [
        rec.rua,
        rec.wms,
        rec.badgeLabel.replace(/[^\w\s()À-ÿ]/g, '').trim(),
        `"${cleanSku}"`,
        rec.itemRef.codigoBase || rec.skuCode.split(' - ')[0],
        `"${cleanName}"`,
        rec.colecao,
        rec.colorCode,
        rec.colorName,
        rec.size,
        rec.qty,
        `"${rec.localCadastro}"`,
        rec.localAtual,
        rec.deposito,
        `"${cleanDiag}"`,
        todayStr
      ].join(';');
    });

    // Add UTF-8 BOM so Excel opens with proper accents (ç, ã, etc.)
    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
    const filename = `auditoria_inventario_${selectedRuaFilter === 'ALL' ? 'todas_ruas' : `rua_${selectedRuaFilter}`}_${todayStr}.csv`;
    triggerCsvDownload(csvContent, filename);
  };

  // Export Guia do Operador (Onde Tirar ➔ Onde Guardar ou S/Cadastro)
  const handleExportOperatorGuide = () => {
    const res = buildOperatorMisplacedGuideCsv(skus, barraItems);
    if (res.count === 0) {
      alert('Nenhuma peça fora do local cadastrado encontrada no estoque.');
      return;
    }
    const todayStr = new Date().toISOString().slice(0, 10);
    triggerCsvDownload(res.csv, `guia_operador_onde_tirar_e_guardar_${todayStr}.csv`);
  };

  // Copy table to clipboard in TSV format
  const handleCopyTsv = () => {
    if (filteredRecords.length === 0) return;

    const headers = [
      'Rua',
      'Endereço WMS',
      'Tipo Alerta',
      'SKU',
      'Cor',
      'Tamanho',
      'Qtd Peças',
      'Local Cadastro',
      'Local Atual',
      'Diagnóstico'
    ];

    const rows = filteredRecords.map(rec => [
      rec.rua,
      rec.wms,
      rec.badgeLabel,
      rec.skuCode.split(' - ')[0],
      `${rec.colorCode} - ${rec.colorName}`,
      rec.size,
      rec.qty,
      rec.localCadastro,
      rec.localAtual,
      rec.diagnostico
    ]);

    const tsvContent = [headers.join('\t'), ...rows.map(r => r.join('\t'))].join('\n');
    navigator.clipboard.writeText(tsvContent).then(() => {
      setCopiedNotification(true);
      setTimeout(() => setCopiedNotification(false), 2500);
    });
  };

  // Print table
  const handlePrint = () => {
    window.print();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-md overflow-hidden animate-fadeIn">
      <div
        onClick={e => e.stopPropagation()}
        className="mac-window rounded-3xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl border border-black/15 dark:border-white/15 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-2xl"
      >
        {/* ============================================================== */}
        {/* MODAL HEADER                                                   */}
        {/* ============================================================== */}
        <div className="px-5 py-3.5 border-b border-black/10 dark:border-white/10 bg-white/50 dark:bg-slate-800/50 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-mac-blue/15 text-mac-blue flex items-center justify-center text-xl shadow-inner shrink-0">
              📋
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="font-display font-extrabold text-base sm:text-lg text-slate-800 dark:text-slate-100">
                  Auditoria de Inventário WMS
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                  {allAuditRecords.length} Discrepância(s)
                </span>
                <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/10 text-slate-500">
                  Perspectiva: {wmsPerspective === 'barra' ? 'Locais_Barras' : 'SKU'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Lista consolidada de SKUs com Conflitos de Sobreposição, Peças Invasoras (fora do cadastro) e Fragmentação
              </p>
            </div>
          </div>

          {/* Action Buttons: Export CSV, Copy TSV, Print, Close */}
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleExportOperatorGuide}
              className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition flex items-center space-x-1.5 shadow-sm"
              title="Baixar Guia do Operador: Onde Tirar ➔ Onde Guardar (ou S/Cadastro) em CSV"
            >
              <span>🚚</span>
              <span className="hidden sm:inline">Guia do Operador (CSV)</span>
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              disabled={filteredRecords.length === 0}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center space-x-1.5 shadow-sm disabled:opacity-40"
              title="Baixar arquivo CSV compatível com Excel e Google Sheets"
            >
              <span>📥</span>
              <span className="hidden sm:inline">Exportar Auditoria</span>
            </button>

            <button
              type="button"
              onClick={handleCopyTsv}
              disabled={filteredRecords.length === 0}
              className="px-3 py-1.5 rounded-xl bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 text-xs font-bold transition flex items-center space-x-1.5 disabled:opacity-40"
              title="Copiar dados formatados para colar no Excel ou Planilhas"
            >
              <span>{copiedNotification ? '✓' : '📋'}</span>
              <span className="hidden sm:inline">{copiedNotification ? 'Copiado!' : 'Copiar'}</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="px-2.5 py-1.5 rounded-xl bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 text-xs font-bold transition hidden md:flex items-center space-x-1"
              title="Imprimir relatório de auditoria"
            >
              <span>🖨️</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/10 hover:bg-rose-500 hover:text-white flex items-center justify-center text-xs font-bold transition"
              title="Fechar painel de auditoria"
            >
              ✕
            </button>
          </div>
        </div>

        {/* ============================================================== */}
        {/* SUMMARY KPI CARDS                                              */}
        {/* ============================================================== */}
        <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white/40 dark:bg-white/[0.02] border-b border-black/10 dark:border-white/10 shrink-0">
          <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/25 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                Sobreposições
              </span>
              <div className="font-mono text-xl font-extrabold text-rose-700 dark:text-rose-200 mt-0.5">
                {summaryKpis.countOverlaps}
              </div>
              <p className="text-[10px] text-rose-600/80">Múltiplos SKUs na célula</p>
            </div>
            <span className="text-2xl">🚨</span>
          </div>

          <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                SKUs Invasores
              </span>
              <div className="font-mono text-xl font-extrabold text-amber-700 dark:text-amber-200 mt-0.5">
                {summaryKpis.countInvaders}
              </div>
              <p className="text-[10px] text-amber-600/80">Fora do local cadastrado</p>
            </div>
            <span className="text-2xl">⚠️</span>
          </div>

          <div className="p-3 rounded-2xl bg-purple-500/10 border border-purple-500/25 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                Fragmentados
              </span>
              <div className="font-mono text-xl font-extrabold text-purple-700 dark:text-purple-200 mt-0.5">
                {summaryKpis.countSplits}
              </div>
              <p className="text-[10px] text-purple-600/80">Dividido em várias torres</p>
            </div>
            <span className="text-2xl">🔀</span>
          </div>

          <div className="p-3 rounded-2xl bg-mac-blue/10 border border-mac-blue/25 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-mac-blue">
                Peças Impactadas
              </span>
              <div className="font-mono text-xl font-extrabold text-mac-blue mt-0.5">
                {summaryKpis.totalImpactedPieces}
              </div>
              <p className="text-[10px] text-mac-blue/80">Total com necessidade de remanejo</p>
            </div>
            <span className="text-2xl">📦</span>
          </div>
        </div>

        {/* ============================================================== */}
        {/* FILTERS & SEARCH BAR                                           */}
        {/* ============================================================== */}
        <div className="p-3.5 border-b border-black/10 dark:border-white/10 flex flex-wrap items-center justify-between gap-3 bg-white/30 dark:bg-black/10 shrink-0">
          {/* Street Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar max-w-full pb-1 sm:pb-0 touch-pan-x">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mr-1 shrink-0">
              Rua:
            </span>
            <button
              type="button"
              onClick={() => setSelectedRuaFilter('ALL')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition whitespace-nowrap shrink-0 ${
                selectedRuaFilter === 'ALL'
                  ? 'bg-mac-blue text-white shadow-sm'
                  : 'bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300'
              }`}
            >
              Todas as Ruas ({allAuditRecords.length})
            </button>
            {streetsWithIssues.map(rua => (
              <button
                key={rua}
                type="button"
                onClick={() => setSelectedRuaFilter(rua)}
                className={`px-2.5 py-1 rounded-xl text-xs font-mono font-bold transition whitespace-nowrap shrink-0 flex items-center space-x-1 ${
                  selectedRuaFilter === rua
                    ? 'bg-mac-blue text-white shadow-sm'
                    : 'bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200'
                }`}
              >
                <span>Rua {rua}</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500 text-white font-extrabold">
                  {streetDiscrepancyCounts[rua]}
                </span>
              </button>
            ))}
          </div>

          {/* Type Filter & Search Bar */}
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <div className="flex items-center gap-1 bg-black/5 dark:bg-white/5 p-1 rounded-xl text-xs">
              <button
                type="button"
                onClick={() => setSelectedTypeFilter('ALL')}
                className={`px-2 py-0.5 rounded-lg font-semibold transition ${
                  selectedTypeFilter === 'ALL'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Todos
              </button>
              <button
                type="button"
                onClick={() => setSelectedTypeFilter('CONFLITO')}
                className={`px-2 py-0.5 rounded-lg font-semibold transition ${
                  selectedTypeFilter === 'CONFLITO'
                    ? 'bg-rose-500 text-white shadow-xs'
                    : 'text-slate-500 hover:text-rose-600'
                }`}
              >
                🚨 Conflitos
              </button>
              <button
                type="button"
                onClick={() => setSelectedTypeFilter('INVASOR')}
                className={`px-2 py-0.5 rounded-lg font-semibold transition ${
                  selectedTypeFilter === 'INVASOR'
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'text-slate-500 hover:text-amber-600'
                }`}
              >
                ⚠️ Invasores
              </button>
              <button
                type="button"
                onClick={() => setSelectedTypeFilter('FRAGMENTADO')}
                className={`px-2 py-0.5 rounded-lg font-semibold transition ${
                  selectedTypeFilter === 'FRAGMENTADO'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-slate-500 hover:text-purple-600'
                }`}
              >
                🔀 Fragmentados
              </button>
            </div>

            {/* Quick Search Input */}
            <div className="relative flex-1 sm:w-48">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔍</span>
              <input
                type="text"
                placeholder="Buscar SKU, cor..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-7 pr-3 py-1 rounded-xl bg-white dark:bg-black/30 border border-black/10 dark:border-white/10 text-xs focus:outline-none focus:ring-1 focus:ring-mac-blue"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* AUDIT TABLE CONTENT                                            */}
        {/* ============================================================== */}
        <div className="flex-1 overflow-y-auto p-4">
          {filteredRecords.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-8">
              <div className="w-16 h-16 rounded-full bg-emerald-500/15 text-emerald-600 flex items-center justify-center text-3xl mb-3 shadow-inner">
                ✅
              </div>
              <h3 className="font-display font-extrabold text-base text-slate-800 dark:text-slate-100">
                Nenhuma Discrepância Encontrada
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mt-1">
                {selectedRuaFilter !== 'ALL'
                  ? `A Rua ${selectedRuaFilter} está em total conformidade sem sobreposições de SKUs ou peças fora do local.`
                  : 'Nenhum conflito de sobreposição ou SKU invasor identificado com os filtros atuais.'}
              </p>
              {(selectedRuaFilter !== 'ALL' || selectedTypeFilter !== 'ALL' || searchQuery) && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedRuaFilter('ALL');
                    setSelectedTypeFilter('ALL');
                    setSearchQuery('');
                  }}
                  className="mt-4 px-3.5 py-1.5 rounded-xl bg-mac-blue text-white text-xs font-bold shadow-sm"
                >
                  Limpar Todos os Filtros
                </button>
              )}
            </div>
          ) : (
            <div className="mac-card rounded-2xl overflow-hidden border border-black/10 dark:border-white/10 shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                      <th className="py-2.5 px-3 font-bold uppercase tracking-wider">Tipo / Diagnóstico</th>
                      <th className="py-2.5 px-3 font-bold uppercase tracking-wider">Endereço WMS</th>
                      <th className="py-2.5 px-3 font-bold uppercase tracking-wider">Código SKU & Descrição</th>
                      <th className="py-2.5 px-3 font-bold uppercase tracking-wider">Cor / Tam</th>
                      <th className="py-2.5 px-3 font-bold uppercase tracking-wider text-right">Qtd</th>
                      <th className="py-2.5 px-3 font-bold uppercase tracking-wider">Local Cadastrado</th>
                      <th className="py-2.5 px-3 font-bold uppercase tracking-wider text-center">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5 dark:divide-white/5">
                    {filteredRecords.map(rec => {
                      const isOverlapped = rec.category === 'CONFLITO_SOBREPOSICAO';
                      const isInvader = rec.category === 'INVASOR_FORA_LOCAL';

                      return (
                        <tr
                          key={rec.id}
                          className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition"
                        >
                          {/* Tipo / Diagnóstico */}
                          <td className="py-3 px-3 align-top min-w-[210px]">
                            <div className="space-y-1">
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${rec.badgeClass}`}
                              >
                                <span>{rec.icon}</span>
                                <span>{rec.badgeLabel}</span>
                              </span>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                                {rec.diagnostico}
                              </p>
                            </div>
                          </td>

                          {/* Endereço WMS */}
                          <td className="py-3 px-3 align-top font-mono whitespace-nowrap">
                            <div className="flex items-center space-x-1.5">
                              <span className="px-1.5 py-0.5 rounded bg-mac-blue text-white font-black text-[10px]">
                                {rec.rua}
                              </span>
                              <span className="font-bold text-slate-800 dark:text-slate-100 text-xs">
                                {rec.wms}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              Depósito {rec.deposito}
                            </div>
                          </td>

                          {/* Código SKU & Descrição */}
                          <td className="py-3 px-3 align-top min-w-[220px]">
                            <div className="font-mono font-bold text-slate-900 dark:text-slate-100 text-xs flex items-center space-x-1.5">
                              <span>{rec.skuCode.split(' - ')[0]}</span>
                              {rec.colecao && (
                                <span className="px-1.5 py-0.2 rounded bg-black/5 dark:bg-white/10 text-[9px] font-sans font-semibold text-slate-600 dark:text-slate-300">
                                  Col. {rec.colecao}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-1 mt-0.5">
                              {rec.skuName}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {rec.brand}
                            </div>
                          </td>

                          {/* Cor & Tamanho */}
                          <td className="py-3 px-3 align-top whitespace-nowrap">
                            <div className="flex items-center space-x-1.5">
                              <span
                                className="w-3 h-3 rounded-full border border-black/30 shrink-0"
                                style={{ backgroundColor: rec.colorHex }}
                                title={`${rec.colorCode} - ${rec.colorName}`}
                              />
                              <span className="font-mono font-semibold text-slate-800 dark:text-slate-200 text-xs">
                                {rec.colorCode}
                              </span>
                              <span className="font-bold text-mac-blue text-xs">
                                • Tam {rec.size}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-400 truncate max-w-[120px] mt-0.5">
                              {rec.colorName}
                            </div>
                          </td>

                          {/* Quantidade */}
                          <td className="py-3 px-3 align-top text-right font-mono whitespace-nowrap">
                            <span className="inline-block px-2 py-0.5 rounded-lg bg-black/5 dark:bg-white/10 font-black text-slate-800 dark:text-slate-100 text-xs">
                              {rec.qty} pç{rec.qty === 1 ? '' : 's'}
                            </span>
                          </td>

                          {/* Local Cadastrado (Ficha do Produto) */}
                          <td className="py-3 px-3 align-top font-mono text-xs">
                            <div className="space-y-0.5">
                              {rec.localCadastro === 'S/Cadastro' ? (
                                <span className="px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-700 dark:text-rose-300 font-mono font-extrabold text-[11px] inline-block border border-rose-500/30">
                                  S/Cadastro
                                </span>
                              ) : (
                                <div
                                  className={`font-bold ${
                                    isInvader
                                      ? 'text-amber-600 dark:text-amber-400 underline decoration-dotted'
                                      : 'text-slate-700 dark:text-slate-300'
                                  }`}
                                >
                                  {rec.localCadastro}
                                </div>
                              )}
                              {rec.localCadastro === 'S/Cadastro' ? (
                                <span className="text-[10px] font-sans text-rose-500 font-semibold block">
                                  Sem cadastro fixo no Sisplan
                                </span>
                              ) : isInvader ? (
                                <span className="text-[10px] font-sans text-amber-600 dark:text-amber-400 font-semibold block">
                                  Diverge de {rec.wms}
                                </span>
                              ) : null}
                            </div>
                          </td>

                          {/* Ação: Navegar para o endereço */}
                          <td className="py-3 px-3 align-top text-center whitespace-nowrap">
                            {onNavigateToSlot ? (
                              <button
                                type="button"
                                onClick={() => onNavigateToSlot(rec.wms, rec.rua)}
                                className="px-2.5 py-1 rounded-xl bg-mac-blue/15 hover:bg-mac-blue text-mac-blue hover:text-white font-bold text-xs transition flex items-center space-x-1 mx-auto shadow-xs"
                                title={`Ir para ${rec.wms} no mapa interativo`}
                              >
                                <span>🎯</span>
                                <span>Ver no Mapa</span>
                              </button>
                            ) : (
                              <span className="text-slate-400 font-mono text-[10px]">
                                {rec.wms}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* ============================================================== */}
        {/* FOOTER BAR                                                     */}
        {/* ============================================================== */}
        <div className="px-5 py-3 border-t border-black/10 dark:border-white/10 bg-white/40 dark:bg-slate-800/40 flex flex-wrap items-center justify-between gap-2 shrink-0 text-xs text-slate-500">
          <div className="flex items-center space-x-2">
            <span>
              Exibindo <strong>{filteredRecords.length}</strong> de <strong>{allAuditRecords.length}</strong> itens auditados
            </span>
            {selectedRuaFilter !== 'ALL' && (
              <span className="font-mono text-[11px] px-1.5 py-0.2 rounded bg-mac-blue/10 text-mac-blue font-bold">
                Filtro: Rua {selectedRuaFilter}
              </span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={filteredRecords.length === 0}
              className="text-mac-blue hover:underline font-bold"
            >
              Exportar para Excel / Sheets (.CSV)
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1 rounded-lg bg-black/10 dark:bg-white/10 hover:bg-black/15 font-semibold text-slate-700 dark:text-slate-200 transition"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
