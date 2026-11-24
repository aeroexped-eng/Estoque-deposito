import React, { useMemo } from 'react';
import {
  SkuItem,
  TransbordoEntry,
  formatWmsAddress,
  getValidPositionsForStreet,
  getCanonicalSkuKey
} from '../constants/wmsConstants';

export interface TowerInspectionPanelProps {
  rua: string;
  pos: number;
  activeNivel: number;
  maxLv: number;
  addressMap: Map<string, SkuItem[]>;
  transbordoRegistry: Record<string, TransbordoEntry>;
  conflictSlots: Set<string>;
  invaderSlots: Set<string>;
  lowStockSlots: Set<string>;
  isPulmao: boolean;
  onSelectLevel: (nivel: number) => void;
  onNavigateTower: (nextPos: number) => void;
  onQuickAllocateLevel: (wms: string) => void;
  onQuickTogglePulmao?: (nivel: number, isOccupied: boolean) => void;
}

interface TowerLevelRow {
  nivel: number;
  wms: string;
  items: SkuItem[];
  primary: SkuItem | null;
  trbEntry: TransbordoEntry | null;
  isOccupied: boolean;
  isConflict: boolean;
  isInvader: boolean;
  isLowStock: boolean;
  isActive: boolean;
  totalQty: number;
  uniqueSkuCount: number;
}

export const TowerInspectionPanel: React.FC<TowerInspectionPanelProps> = ({
  rua,
  pos,
  activeNivel,
  maxLv,
  addressMap,
  transbordoRegistry,
  conflictSlots,
  invaderSlots,
  lowStockSlots,
  isPulmao,
  onSelectLevel,
  onNavigateTower,
  onQuickAllocateLevel,
  onQuickTogglePulmao
}) => {
  const towerCode = `${rua}.${String(pos).padStart(3, '0')}`;

  // Previous / Next valid tower position in the same street
  const { prevPos, nextPos, towerIndex, totalTowersInStreet } = useMemo(() => {
    const valid = getValidPositionsForStreet(rua);
    const idx = valid.indexOf(pos);
    return {
      prevPos: idx > 0 ? valid[idx - 1] : null,
      nextPos: idx >= 0 && idx < valid.length - 1 ? valid[idx + 1] : null,
      towerIndex: idx,
      totalTowersInStreet: valid.length
    };
  }, [rua, pos]);

  // Build ordered levels (both ascending for quick pills and descending for physical rack stack)
  const { levelsAsc, levelsDesc, occupiedCount, freeCount, alertCount, totalPieces } = useMemo(() => {
    const asc: TowerLevelRow[] = [];
    let occ = 0;
    let alerts = 0;
    let pieces = 0;

    for (let lv = 1; lv <= maxLv; lv++) {
      const wms = formatWmsAddress(rua, pos, lv);
      const items = addressMap.get(wms) || [];
      const trbEntry = transbordoRegistry[wms] || null;
      const nonTrb = items.filter(i => !i.isTransbordo);
      const primary = nonTrb[0] || items[0] || null;
      const isOccupied = items.length > 0 || Boolean(trbEntry);
      const isConflict = conflictSlots.has(wms);
      const isInvader = invaderSlots.has(wms);
      const isLowStock = lowStockSlots.has(wms) && !trbEntry;
      const totalQty = nonTrb.reduce(
        (sum, it) => sum + (typeof it.qty === 'number' ? it.qty : 1),
        0
      );
      const uniqueSkuCount = new Set(nonTrb.map(i => getCanonicalSkuKey(i.code))).size;

      if (isOccupied) occ++;
      if (isConflict || isInvader) alerts++;
      pieces += totalQty;

      asc.push({
        nivel: lv,
        wms,
        items,
        primary,
        trbEntry,
        isOccupied,
        isConflict,
        isInvader,
        isLowStock,
        isActive: lv === activeNivel,
        totalQty,
        uniqueSkuCount
      });
    }

    return {
      levelsAsc: asc,
      levelsDesc: [...asc].reverse(),
      occupiedCount: occ,
      freeCount: Math.max(0, maxLv - occ),
      alertCount: alerts,
      totalPieces: pieces
    };
  }, [
    rua,
    pos,
    maxLv,
    activeNivel,
    addressMap,
    transbordoRegistry,
    conflictSlots,
    invaderSlots,
    lowStockSlots
  ]);

  const occupancyPct = maxLv > 0 ? Math.round((occupiedCount / maxLv) * 100) : 0;

  return (
    <div className="space-y-2.5">
      {/* Tower Header & Adjacent Tower Navigation */}
      <div className="mac-card rounded-2xl p-3 space-y-2.5 border border-mac-blue/25 bg-gradient-to-br from-mac-blue/10 via-white/60 to-indigo-500/10 dark:from-mac-blue/15 dark:via-slate-900/60 dark:to-indigo-500/15">
        <div className="flex items-center justify-between gap-1.5">
          <button
            type="button"
            disabled={prevPos === null}
            onClick={() => prevPos !== null && onNavigateTower(prevPos)}
            className="w-7 h-7 rounded-xl bg-black/5 dark:bg-white/10 hover:bg-mac-blue hover:text-white disabled:opacity-30 disabled:hover:bg-black/5 disabled:hover:text-current flex items-center justify-center text-xs font-bold transition shrink-0"
            title={
              prevPos !== null
                ? `Torre anterior: ${rua}.${String(prevPos).padStart(3, '0')}`
                : 'Primeira torre da rua'
            }
          >
            ◀
          </button>

          <div className="text-center min-w-0 flex-1">
            <div className="flex items-center justify-center gap-1.5 flex-wrap">
              <span className="font-mono text-xs font-black text-slate-900 dark:text-white tracking-tight">
                🏢 Torre {towerCode}
              </span>
              {alertCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-rose-500 text-white font-mono text-[9px] font-black">
                  {alertCount} Alerta{alertCount > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
              {occupiedCount}/{maxLv} ocup. • {freeCount} livre{freeCount === 1 ? '' : 's'}
              {!isPulmao && totalPieces > 0 ? ` • ${totalPieces} pçs` : ''}
              {towerIndex >= 0 ? ` • #${towerIndex + 1}/${totalTowersInStreet}` : ''}
            </p>
          </div>

          <button
            type="button"
            disabled={nextPos === null}
            onClick={() => nextPos !== null && onNavigateTower(nextPos)}
            className="w-7 h-7 rounded-xl bg-black/5 dark:bg-white/10 hover:bg-mac-blue hover:text-white disabled:opacity-30 disabled:hover:bg-black/5 disabled:hover:text-current flex items-center justify-center text-xs font-bold transition shrink-0"
            title={
              nextPos !== null
                ? `Próxima torre: ${rua}.${String(nextPos).padStart(3, '0')}`
                : 'Última torre da rua'
            }
          >
            ▶
          </button>
        </div>

        {/* Occupancy Mini Bar */}
        <div className="w-full h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              alertCount > 0
                ? 'bg-rose-500'
                : occupancyPct >= 100
                  ? 'bg-emerald-500'
                  : 'bg-mac-blue'
            }`}
            style={{ width: `${occupancyPct}%` }}
          />
        </div>

        {/* 1-Click Level Switcher Pills + Step Up/Down */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[10px]">
            <span className="font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Troca Rápida de Nível
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={activeNivel >= maxLv}
                onClick={() => activeNivel < maxLv && onSelectLevel(activeNivel + 1)}
                className="px-1.5 py-0.5 rounded-md bg-black/5 dark:bg-white/10 hover:bg-mac-blue hover:text-white disabled:opacity-30 font-mono font-bold transition"
                title="Subir 1 nível (N+1)"
              >
                ▲
              </button>
              <button
                type="button"
                disabled={activeNivel <= 1}
                onClick={() => activeNivel > 1 && onSelectLevel(activeNivel - 1)}
                className="px-1.5 py-0.5 rounded-md bg-black/5 dark:bg-white/10 hover:bg-mac-blue hover:text-white disabled:opacity-30 font-mono font-bold transition"
                title="Descer 1 nível (N-1)"
              >
                ▼
              </button>
            </div>
          </div>

          <div
            className={`grid gap-1 font-mono text-[10px] ${
              maxLv <= 4 ? 'grid-cols-4' : maxLv === 5 ? 'grid-cols-5' : 'grid-cols-6'
            }`}
          >
            {levelsAsc.map(row => {
              const pillColor = row.isActive
                ? 'bg-mac-blue text-white border-mac-blue shadow-md ring-2 ring-mac-blue/40 scale-[1.03]'
                : row.trbEntry
                  ? 'bg-yellow-400/80 text-slate-950 border-yellow-600/60 hover:bg-yellow-400'
                  : row.isConflict
                    ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/50 hover:bg-rose-500/30'
                    : row.isInvader
                      ? 'bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-500/50 hover:bg-amber-500/30'
                      : row.isOccupied
                        ? isPulmao
                          ? 'bg-indigo-500/20 text-indigo-700 dark:text-indigo-200 border-indigo-500/40 hover:bg-indigo-500/30'
                          : 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/35 hover:bg-emerald-500/25'
                        : 'bg-white/60 dark:bg-white/5 text-slate-500 dark:text-slate-400 border-dashed border-black/20 dark:border-white/20 hover:border-mac-blue hover:text-mac-blue';

              return (
                <button
                  key={row.nivel}
                  type="button"
                  onClick={() => onSelectLevel(row.nivel)}
                  className={`py-1.5 px-1 rounded-xl border font-extrabold transition flex flex-col items-center justify-center leading-tight ${pillColor}`}
                  title={`${row.wms} — ${
                    row.trbEntry
                      ? `Transbordo: ${row.trbEntry.code}`
                      : row.primary
                        ? `${row.primary.code} (${row.totalQty} pçs)`
                        : 'Livre'
                  }`}
                >
                  <span>N{row.nivel}</span>
                  <span className="text-[8px] opacity-85">
                    {row.trbEntry
                      ? '⚡'
                      : row.isConflict
                        ? '🚨'
                        : row.isInvader
                          ? '⚠️'
                          : row.isOccupied
                            ? '●'
                            : '○'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Physical Vertical Stack of Tower Levels (Top -> Floor) */}
      <div className="mac-card rounded-2xl p-2 space-y-1.5 border border-black/10 dark:border-white/10">
        <div className="flex items-center justify-between px-1">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Visão Vertical (Topo → Piso)
          </span>
          <span className="font-mono text-[9px] text-slate-400">Clique no nível</span>
        </div>

        <div className="space-y-1">
          {levelsDesc.map(row => {
            const rowBaseClass = row.isActive
              ? 'bg-mac-blue/15 dark:bg-mac-blue/25 border-mac-blue ring-1 ring-mac-blue/50 shadow-sm'
              : row.trbEntry
                ? 'bg-yellow-400/15 border-yellow-500/40 hover:border-yellow-500'
                : row.isConflict
                  ? 'bg-rose-500/10 border-rose-500/40 hover:border-rose-500'
                  : row.isInvader
                    ? 'bg-amber-500/10 border-amber-500/40 hover:border-amber-500'
                    : row.isOccupied
                      ? 'bg-white/75 dark:bg-white/[0.04] border-black/10 dark:border-white/10 hover:border-mac-blue/50'
                      : 'bg-black/[0.02] dark:bg-white/[0.015] border-dashed border-black/15 dark:border-white/15 hover:border-mac-blue/50';

            return (
              <div
                key={row.wms}
                role="button"
                tabIndex={0}
                onClick={() => onSelectLevel(row.nivel)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectLevel(row.nivel);
                  }
                }}
                className={`w-full text-left px-2 py-1.5 rounded-xl border transition cursor-pointer flex items-center gap-2 ${rowBaseClass}`}
              >
                {/* Level Badge */}
                <span
                  className={`w-7 h-7 rounded-lg font-mono text-[11px] font-black flex items-center justify-center shrink-0 ${
                    row.isActive
                      ? 'bg-mac-blue text-white shadow-xs'
                      : row.trbEntry
                        ? 'bg-yellow-400 text-slate-950'
                        : row.isConflict
                          ? 'bg-rose-600 text-white'
                          : row.isInvader
                            ? 'bg-amber-500 text-slate-950'
                            : row.isOccupied
                              ? isPulmao
                                ? 'bg-indigo-600 text-white'
                                : 'bg-emerald-600/90 text-white'
                              : 'bg-black/10 dark:bg-white/10 text-slate-500 dark:text-slate-400'
                  }`}
                >
                  N{row.nivel}
                </span>

                {/* Slot Summary */}
                <div className="min-w-0 flex-1">
                  {row.trbEntry ? (
                    <>
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-[11px] font-extrabold text-slate-900 dark:text-yellow-100 truncate">
                          ⚡ {row.trbEntry.code}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-600 dark:text-yellow-200/80 truncate">
                        Transbordo • {row.trbEntry.note}
                      </p>
                    </>
                  ) : row.primary ? (
                    <>
                      <div className="flex items-center gap-1.5 min-w-0">
                        {!isPulmao && (
                          <span
                            className="w-2.5 h-2.5 rounded-full border border-black/25 shrink-0"
                            style={{ backgroundColor: row.primary.colorHex }}
                          />
                        )}
                        <span className="font-mono text-[11px] font-extrabold text-slate-900 dark:text-slate-100 truncate">
                          {isPulmao ? row.primary.name : row.primary.code}
                        </span>
                        {row.uniqueSkuCount > 1 && (
                          <span className="px-1 py-0.2 rounded bg-rose-600 text-white font-mono text-[9px] font-black shrink-0">
                            +{row.uniqueSkuCount - 1}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-1 text-[10px] text-slate-500 dark:text-slate-400">
                        <span className="truncate">
                          {isPulmao
                            ? `Pulmão • ${row.wms}`
                            : `${row.primary.name || 'SKU Alocado'}`}
                        </span>
                        <span
                          className={`font-mono font-bold shrink-0 ${
                            row.isLowStock
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {row.totalQty} pç{row.totalQty === 1 ? '' : 's'}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-between gap-1">
                      <div>
                        <span className="font-mono text-[11px] font-bold text-slate-500 dark:text-slate-400">
                          Livre
                        </span>
                        <span className="block font-mono text-[9px] text-slate-400">
                          {row.wms}
                        </span>
                      </div>
                      {isPulmao && onQuickTogglePulmao ? (
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            onSelectLevel(row.nivel);
                            onQuickTogglePulmao(row.nivel, false);
                          }}
                          className="px-2 py-0.5 rounded-lg bg-indigo-600/15 hover:bg-indigo-600 text-indigo-700 dark:text-indigo-300 hover:text-white font-bold text-[10px] transition shrink-0"
                          title={`Ocupar rapidamente ${row.wms} no Pulmão`}
                        >
                          + Ocupar
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            onSelectLevel(row.nivel);
                            onQuickAllocateLevel(row.wms);
                          }}
                          className="px-2 py-0.5 rounded-lg bg-mac-blue/15 hover:bg-mac-blue text-mac-blue hover:text-white font-bold text-[10px] transition shrink-0"
                          title={`Alocar SKU diretamente em ${row.wms}`}
                        >
                          + Alocar
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Right Status Marker */}
                <div className="flex items-center shrink-0">
                  {row.isActive ? (
                    <span className="text-[10px] font-black text-mac-blue">●</span>
                  ) : row.isConflict ? (
                    <span className="text-[11px]" title="Conflito neste nível">
                      🚨
                    </span>
                  ) : row.isInvader ? (
                    <span className="text-[11px]" title="SKU Invasor neste nível">
                      ⚠️
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Active Level Section Divider */}
      <div className="flex items-center justify-between px-1 pt-0.5">
        <span className="text-[10px] font-extrabold uppercase tracking-wider text-mac-blue">
          Detalhes do Nível Ativo
        </span>
        <span className="font-mono text-[10px] px-2 py-0.5 rounded-md bg-mac-blue/15 text-mac-blue font-bold">
          {formatWmsAddress(rua, pos, activeNivel)}
        </span>
      </div>
    </div>
  );
};
