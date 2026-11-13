import React, { useState, useMemo } from 'react';
import {
  STREETS,
  STREET_META,
  getValidPositionsForStreet,
  getMaxLevelsForStreet,
  formatWmsAddress
} from '../constants/wmsConstants';

export interface ExportAddressesModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedStreet: string;
  addressMap: Map<string, any[]>;
  onDownloadCsv: (csvContent: string, fileName: string) => void;
  playMacSound: (type: 'pop' | 'success' | 'alert' | 'select' | 'search' | 'empty') => void;
  showToast: (title: string, message: string, icon?: string) => void;
}

export const ExportAddressesModal: React.FC<ExportAddressesModalProps> = ({
  isOpen,
  onClose,
  selectedStreet,
  addressMap,
  onDownloadCsv,
  playMacSound,
  showToast
}) => {
  // Scope: 'current' (rua selecionada), 'main' (RA a RH), 'all' (todas as 23 ruas), 'custom' (rua específica)
  const [scope, setScope] = useState<'current' | 'main' | 'all' | 'custom'>('current');
  const [customStreet, setCustomStreet] = useState<string>(selectedStreet || 'RA');
  const [includeHeader, setIncludeHeader] = useState<boolean>(false);
  const [includeStatusColumn, setIncludeStatusColumn] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  // Ruas principais RA a RH
  const mainStreets = useMemo(() => ['RA', 'RB', 'RC', 'RD', 'RE', 'RF', 'RG', 'RH'], []);

  // Ruas a exportar com base no escopo escolhido
  const targetStreets = useMemo(() => {
    if (scope === 'current') return [selectedStreet];
    if (scope === 'main') return mainStreets;
    if (scope === 'all') return Array.from(STREETS);
    return [customStreet];
  }, [scope, selectedStreet, mainStreets, customStreet]);

  // Geração completa de todos os endereços físicos (ocupados e vazios)
  const generatedData = useMemo(() => {
    const lines: string[] = [];
    if (includeHeader) {
      lines.push(includeStatusColumn ? 'ENDERECO;STATUS' : 'ENDERECO');
    }

    let totalSlots = 0;
    let occupiedSlots = 0;
    let emptySlots = 0;

    for (const rua of targetStreets) {
      const validPositions = getValidPositionsForStreet(rua);
      for (const pos of validPositions) {
        const maxLv = getMaxLevelsForStreet(rua, pos);
        for (let lv = 1; lv <= maxLv; lv++) {
          const wms = formatWmsAddress(rua, pos, lv);
          totalSlots++;

          const items = addressMap.get(wms) || [];
          const isOccupied = items.length > 0;
          if (isOccupied) occupiedSlots++;
          else emptySlots++;

          if (includeStatusColumn) {
            lines.push(`${wms};${isOccupied ? 'OCUPADO' : 'VAZIO'}`);
          } else {
            lines.push(wms);
          }
        }
      }
    }

    return {
      lines,
      csvText: lines.join('\n') + '\n',
      totalSlots,
      occupiedSlots,
      emptySlots
    };
  }, [targetStreets, includeHeader, includeStatusColumn, addressMap]);

  if (!isOpen) return null;

  const handleDownload = () => {
    const scopeLabel =
      scope === 'current'
        ? `rua_${selectedStreet}`
        : scope === 'main'
          ? 'ruas_RA_a_RH'
          : scope === 'all'
            ? 'mapa_completo_todas_ruas'
            : `rua_${customStreet}`;

    const dateStr = new Date().toISOString().slice(0, 10);
    const fileName = `enderecos_${scopeLabel}_todos_inclusive_vazios_${dateStr}.csv`;

    onDownloadCsv(generatedData.csvText, fileName);
    playMacSound('success');
    showToast(
      'Exportação Concluída!',
      `${generatedData.totalSlots.toLocaleString('pt-BR')} endereços gerados (${generatedData.emptySlots.toLocaleString('pt-BR')} vazios + ${generatedData.occupiedSlots.toLocaleString('pt-BR')} ocupados).`,
      '📍'
    );
    onClose();
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(generatedData.csvText);
      setCopied(true);
      playMacSound('success');
      showToast('Copiado!', `${generatedData.totalSlots} endereços copiados para a Área de Transferência.`, '📋');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      showToast('Erro ao Copiar', 'Não foi possível acessar a Área de Transferência.', '⚠️');
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="mac-window mac-sheet w-full max-w-xl rounded-2xl overflow-hidden shadow-2xl border border-white/20 flex flex-col max-h-[92vh] bg-white dark:bg-slate-900"
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-black/10 dark:border-white/10 flex items-center justify-between bg-white/40 dark:bg-black/30 backdrop-blur-md">
          <div className="flex items-center space-x-2.5">
            <span className="text-xl">📍</span>
            <div>
              <h3 className="font-display font-bold text-sm text-slate-800 dark:text-slate-100">
                Exportar Lista de Endereços do Mapa (Inclusive Vazios)
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Gera o arquivo com todos os endereços físicos colmeia a colmeia, sem SKUs
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 flex items-center justify-center text-xs font-bold transition text-slate-500 dark:text-slate-300"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
          {/* Seletor de Escopo de Ruas */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-700 dark:text-slate-200 block text-[11px] uppercase tracking-wider">
              1. Selecione as Ruas para Exportar:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setScope('current')}
                className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between ${
                  scope === 'current'
                    ? 'border-mac-blue bg-mac-blue/10 dark:bg-mac-blue/20 ring-2 ring-mac-blue/40 shadow-sm'
                    : 'border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                <div className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1">
                  <span>📍 Rua {selectedStreet}</span>
                </div>
                <span className="text-[10px] text-mac-blue font-semibold mt-1">
                  Rua Atual Selecionada
                </span>
              </button>

              <button
                type="button"
                onClick={() => setScope('main')}
                className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between ${
                  scope === 'main'
                    ? 'border-mac-blue bg-mac-blue/10 dark:bg-mac-blue/20 ring-2 ring-mac-blue/40 shadow-sm'
                    : 'border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                <div className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1">
                  <span>🏢 RA a RH</span>
                </div>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                  8 Ruas Principais
                </span>
              </button>

              <button
                type="button"
                onClick={() => setScope('all')}
                className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between ${
                  scope === 'all'
                    ? 'border-mac-blue bg-mac-blue/10 dark:bg-mac-blue/20 ring-2 ring-mac-blue/40 shadow-sm'
                    : 'border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                <div className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1">
                  <span>🌐 Todo o Mapa</span>
                </div>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                  Todas as 23 Ruas
                </span>
              </button>

              <button
                type="button"
                onClick={() => setScope('custom')}
                className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between ${
                  scope === 'custom'
                    ? 'border-mac-blue bg-mac-blue/10 dark:bg-mac-blue/20 ring-2 ring-mac-blue/40 shadow-sm'
                    : 'border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                <div className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1">
                  <span>⚙️ Outra Rua</span>
                </div>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                  Escolher na lista
                </span>
              </button>
            </div>

            {/* Dropdown de Rua específica caso escolha 'custom' */}
            {scope === 'custom' && (
              <div className="pt-2 flex items-center gap-2">
                <span className="font-medium text-slate-600 dark:text-slate-300">Escolha a Rua:</span>
                <select
                  value={customStreet}
                  onChange={e => setCustomStreet(e.target.value)}
                  className="px-3 py-1.5 rounded-xl bg-black/5 dark:bg-white/10 border border-black/15 dark:border-white/15 font-mono font-bold text-xs focus:outline-none focus:ring-2 focus:ring-mac-blue"
                >
                  {STREETS.map(r => (
                    <option key={r} value={r}>
                      Rua {r} {STREET_META[r] ? `(${STREET_META[r].badge})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Cards de Métricas de Resumo */}
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-[10px] uppercase font-bold text-emerald-800 dark:text-emerald-300 block">
                Total de Endereços a Exportar (100% da Capacidade Física)
              </span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="font-mono text-xl sm:text-2xl font-black text-emerald-950 dark:text-emerald-100">
                  {generatedData.totalSlots.toLocaleString('pt-BR')}
                </span>
                <span className="text-xs text-emerald-700 dark:text-emerald-300 font-semibold">
                  colmeias físicas
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 text-[11px] font-mono">
              <span className="px-2 py-1 rounded-lg bg-black/5 dark:bg-white/10 text-slate-700 dark:text-slate-300">
                ⚪ <strong>{generatedData.emptySlots.toLocaleString('pt-BR')}</strong> vazios
              </span>
              <span className="px-2 py-1 rounded-lg bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                🟢 <strong>{generatedData.occupiedSlots.toLocaleString('pt-BR')}</strong> ocupados
              </span>
            </div>
          </div>

          {/* Opções de Formatação */}
          <div className="space-y-2 pt-1 border-t border-black/5 dark:border-white/5">
            <label className="font-bold text-slate-700 dark:text-slate-200 block text-[11px] uppercase tracking-wider">
              2. Formatação do CSV:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <label className="flex items-center space-x-2.5 p-2 rounded-xl bg-black/5 dark:bg-white/5 cursor-pointer hover:bg-black/10 dark:hover:bg-white/10 transition">
                <input
                  type="checkbox"
                  checked={includeHeader}
                  onChange={e => setIncludeHeader(e.target.checked)}
                  className="rounded text-mac-blue focus:ring-mac-blue w-4 h-4 cursor-pointer"
                />
                <span className="text-xs text-slate-700 dark:text-slate-200">
                  Incluir cabeçalho <code className="font-mono font-bold">ENDERECO</code> na 1ª linha
                </span>
              </label>

              <label className="flex items-center space-x-2.5 p-2 rounded-xl bg-black/5 dark:bg-white/5 cursor-pointer hover:bg-black/10 dark:hover:bg-white/10 transition">
                <input
                  type="checkbox"
                  checked={includeStatusColumn}
                  onChange={e => setIncludeStatusColumn(e.target.checked)}
                  className="rounded text-mac-blue focus:ring-mac-blue w-4 h-4 cursor-pointer"
                />
                <span className="text-xs text-slate-700 dark:text-slate-200">
                  Adicionar 2ª coluna com status (<code className="font-mono font-bold">OCUPADO/VAZIO</code>)
                </span>
              </label>
            </div>
          </div>

          {/* Pré-visualização ao vivo */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                3. Pré-visualização do Arquivo (Primeiras 10 linhas):
              </span>
              <span className="font-mono text-slate-400">
                {generatedData.lines.length.toLocaleString('pt-BR')} linhas no total
              </span>
            </div>
            <pre className="p-3 rounded-xl bg-black/90 text-emerald-400 font-mono text-[11px] leading-relaxed max-h-36 overflow-y-auto border border-black/20 shadow-inner select-all">
              {generatedData.lines.slice(0, 10).join('\n')}
              {generatedData.lines.length > 10 && (
                <span className="text-slate-500 block mt-1">
                  ... mais {(generatedData.lines.length - 10).toLocaleString('pt-BR')} endereços
                </span>
              )}
            </pre>
          </div>
        </div>

        {/* Footer Buttons */}
        <div className="px-5 py-3.5 border-t border-black/10 dark:border-white/10 flex items-center justify-between bg-black/[0.02] dark:bg-white/[0.02] gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-300 font-semibold transition"
          >
            Cancelar
          </button>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleCopy}
              className="px-4 py-2 rounded-xl bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 font-semibold transition flex items-center gap-1.5"
            >
              <span>{copied ? '✅' : '📋'}</span>
              <span>{copied ? 'Copiado!' : 'Copiar Texto'}</span>
            </button>

            <button
              type="button"
              onClick={handleDownload}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-lg shadow-emerald-600/30 transition flex items-center gap-1.5"
            >
              <span>📥</span>
              <span>Baixar CSV Completo</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
