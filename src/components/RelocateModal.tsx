import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  SkuItem,
  MovedSkuEntry,
  TransbordoEntry,
  STREETS,
  STREET_META,
  isValidPositionInStreet,
  getStreetPositionRuleDescription,
  getValidPositionsForStreet,
  getMaxLevelsForStreet,
  formatWmsAddress,
  formatLevelsToSisplanLocal,
  isReservedCol35Street,
  getCanonicalSkuKey,
  decodeSkuPrefix,
  pickBestLevelsInColumn
} from '../constants/wmsConstants';
import { playMacSound, triggerCsvDownload } from '../utils/storageAndSync';

export interface RelocateModalProps {
  isOpen: boolean;
  onClose: () => void;
  skus: SkuItem[];
  setSkus: React.Dispatch<React.SetStateAction<SkuItem[]>>;
  movedSkusRegistry: Record<string, MovedSkuEntry>;
  setMovedSkusRegistry: React.Dispatch<React.SetStateAction<Record<string, MovedSkuEntry>>>;
  recordSkuMoved: (
    sku: SkuItem,
    oldRaw: string,
    newRawLocal: string,
    source: 'drag' | 'relocate' | 'modal',
    currentMoved: Record<string, MovedSkuEntry>
  ) => { nextMoved: Record<string, MovedSkuEntry>; staysMoved: boolean };
  persistCurrentState: (
    nextSkus: SkuItem[],
    nextMoved: Record<string, MovedSkuEntry>,
    nextTrb: Record<string, TransbordoEntry>
  ) => void;
  transbordoRegistry: Record<string, TransbordoEntry>;
  addressMap: Map<string, SkuItem[]>;
  selectedStreet: string;
  selectStreet: (rua: string) => void;
  setSelectedAddressKey: (addr: string) => void;
  soundEnabled: boolean;
  showToast: (title: string, message: string, icon?: string) => void;
  initialSkuId?: string;
  getSkuMultiLevelInfo: (sku: SkuItem) => {
    skuKey: string;
    siblingItems: SkuItem[];
    levels: number[];
    requiredLevels: number;
    groupedWms: string;
  };
  findMultiLevelFreeColumnInStreet: (
    rua: string,
    neededLevels: number,
    startPos?: number,
    excludeIds?: Set<string>
  ) => {
    rua: string;
    pos: number;
    levels: number[];
    wms: string;
    formattedLocal: string;
  } | null;
}

interface BatchAllocatedItem {
  canonicalKey: string;
  primarySku: SkuItem;
  allSiblingItems: SkuItem[];
  neededLevelsCount: number;
  originalLocal: string;
  originalWmsList: string[];
  totalQty: number;
  // Proposed allocation
  targetRua: string;
  targetPos: number;
  targetLevels: number[];
  targetSisplanLocal: string;
  targetWmsList: string[];
  isTowerOccupiedByOthers: boolean;
  isPositionValid: boolean;
}

export const RelocateModal: React.FC<RelocateModalProps> = ({
  isOpen,
  onClose,
  skus,
  setSkus,
  movedSkusRegistry,
  setMovedSkusRegistry,
  recordSkuMoved,
  persistCurrentState,
  transbordoRegistry,
  addressMap,
  selectedStreet,
  selectStreet,
  setSelectedAddressKey,
  soundEnabled,
  showToast,
  initialSkuId,
  getSkuMultiLevelInfo,
  findMultiLevelFreeColumnInStreet
}) => {
  // Modal Mode: Single SKU vs. Batch (Lote) via CSV
  const [activeTab, setActiveTab] = useState<'single' | 'batch'>('single');

  // =========================================================================
  // SINGLE RELOCATE STATE
  // =========================================================================
  const [singleSearchQuery, setSingleSearchQuery] = useState<string>('');
  const [singleSkuId, setSingleSkuId] = useState<string>(initialSkuId || '');
  const [singleNewRua, setSingleNewRua] = useState<string>(selectedStreet || 'RG');
  const [singleNewPos, setSingleNewPos] = useState<number>(1);
  const [singleNewNivel, setSingleNewNivel] = useState<number>(1);
  const [singleMoveAllLevels, setSingleMoveAllLevels] = useState<boolean>(true);
  const [singleSelectedLevels, setSingleSelectedLevels] = useState<number[]>([1]);

  // Synchronize initialSkuId if opened with a specific SKU
  useEffect(() => {
    if (initialSkuId) {
      setSingleSkuId(initialSkuId);
      const found = skus.find(s => s.id === initialSkuId);
      if (found) {
        setSingleSearchQuery(found.code);
        setSingleNewRua(found.rua || selectedStreet || 'RG');
        setSingleNewPos(found.pos || 1);
        const m = getSkuMultiLevelInfo(found);
        setSingleSelectedLevels(m.levels.length > 0 ? m.levels : [found.nivel || 1]);
        setSingleNewNivel(m.levels[0] || found.nivel || 1);
      }
    }
  }, [initialSkuId, skus, selectedStreet, getSkuMultiLevelInfo]);

  // When selected single SKU changes
  const handleSingleSkuSelected = useCallback((sku: SkuItem) => {
    setSingleSkuId(sku.id);
    setSingleSearchQuery(sku.code);
    setSingleNewRua(sku.rua || selectedStreet || 'RG');
    setSingleNewPos(sku.pos || 1);
    const m = getSkuMultiLevelInfo(sku);
    setSingleSelectedLevels(m.levels.length > 0 ? m.levels : [sku.nivel || 1]);
    setSingleNewNivel(m.levels[0] || sku.nivel || 1);
  }, [getSkuMultiLevelInfo, selectedStreet]);

  // Filtered SKUs for Single Mode autocomplete
  const singleCandidateSkus = useMemo(() => {
    const q = singleSearchQuery.trim().toUpperCase();
    if (!q) return skus.slice(0, 150);
    return skus.filter(s =>
      s.code.toUpperCase().includes(q) ||
      (s.name && s.name.toUpperCase().includes(q)) ||
      s.wms.toUpperCase().includes(q) ||
      (s.rawLocal && s.rawLocal.toUpperCase().includes(q))
    ).slice(0, 150);
  }, [skus, singleSearchQuery]);

  const currentSelectedSingleSku = useMemo(() => {
    return skus.find(s => s.id === singleSkuId) ||
      skus.find(s => s.code.toUpperCase() === singleSearchQuery.trim().toUpperCase()) ||
      null;
  }, [skus, singleSkuId, singleSearchQuery]);

  // Multi-level info for current single SKU
  const currentSingleMulti = useMemo(() => {
    if (!currentSelectedSingleSku) return null;
    return getSkuMultiLevelInfo(currentSelectedSingleSku);
  }, [currentSelectedSingleSku, getSkuMultiLevelInfo]);

  // =========================================================================
  // BATCH RELOCATE (LOTE VIA CSV) STATE
  // =========================================================================
  const [batchPasteText, setBatchPasteText] = useState<string>('');
  const [batchTargetRua, setBatchTargetRua] = useState<string>(selectedStreet || 'RF');
  const [batchStartPos, setBatchStartPos] = useState<number>(1);
  const [batchSkipOccupied, setBatchSkipOccupied] = useState<boolean>(true);
  const [batchKeepMultiLevels, setBatchKeepMultiLevels] = useState<boolean>(true);
  const [batchFilterQuery, setBatchFilterQuery] = useState<string>('');
  const [showUnmatchedList, setShowUnmatchedList] = useState<boolean>(false);

  // Success state after batch relocation
  const [batchExecutedSummary, setBatchExecutedSummary] = useState<{
    count: number;
    totalBoxes: number;
    totalPieces: number;
    targetRua: string;
    items: BatchAllocatedItem[];
    timestamp: string;
  } | null>(null);

  // Fast map lookup of SKUs by canonical key and raw code
  const skuLookup = useMemo(() => {
    const byCanonical = new Map<string, SkuItem[]>();
    const byRawCode = new Map<string, SkuItem[]>();
    const byWms = new Map<string, SkuItem>();

    for (const item of skus) {
      const canon = getCanonicalSkuKey(item.code);
      if (!byCanonical.has(canon)) byCanonical.set(canon, []);
      byCanonical.get(canon)!.push(item);

      const raw = item.code.trim().toUpperCase();
      if (!byRawCode.has(raw)) byRawCode.set(raw, []);
      byRawCode.get(raw)!.push(item);

      byWms.set(item.wms.toUpperCase(), item);
    }
    return { byCanonical, byRawCode, byWms };
  }, [skus]);

  // Parse pasted CSV / text and match SKUs in real time
  const { matchedGroups, unmatchedTokens } = useMemo(() => {
    if (!batchPasteText.trim()) {
      return { matchedGroups: [] as { primary: SkuItem; siblings: SkuItem[]; key: string }[], unmatchedTokens: [] as string[] };
    }

    const lines = batchPasteText
      .split(/[\r\n]+/)
      .map(l => l.trim())
      .filter(Boolean);

    const seenCanonical = new Set<string>();
    const matched: { primary: SkuItem; siblings: SkuItem[]; key: string }[] = [];
    const unmatched: string[] = [];

    for (const rawLine of lines) {
      // Split by semicolon, comma, or tab
      const tokens = rawLine
        .split(/[;,\t]/)
        .map(t => t.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean);

      // If line is header (e.g. CODIGO;COR;TAMANHO), skip
      if (tokens.some(t => /^(?:CODIGO|SKU|PRODUTO|REF|LOCAL|COR|TAMANHO)$/i.test(t))) {
        continue;
      }

      let lineMatched = false;

      // Try tokens from left to right (usually first token is SKU or address)
      for (const tok of tokens) {
        if (!tok) continue;
        const upTok = tok.toUpperCase();

        // 1. Check if token is WMS address (e.g. RF.001.2)
        if (skuLookup.byWms.has(upTok)) {
          const sku = skuLookup.byWms.get(upTok)!;
          const key = getCanonicalSkuKey(sku.code);
          if (!seenCanonical.has(key)) {
            seenCanonical.add(key);
            const siblings = skuLookup.byCanonical.get(key) || [sku];
            matched.push({ primary: sku, siblings, key });
            lineMatched = true;
            break;
          } else {
            lineMatched = true;
            break;
          }
        }

        // 2. Check canonical key
        const canonKey = getCanonicalSkuKey(tok);
        if (canonKey && skuLookup.byCanonical.has(canonKey)) {
          if (!seenCanonical.has(canonKey)) {
            seenCanonical.add(canonKey);
            const siblings = skuLookup.byCanonical.get(canonKey)!;
            matched.push({ primary: siblings[0], siblings, key: canonKey });
          }
          lineMatched = true;
          break;
        }

        // 3. Check raw code match
        if (skuLookup.byRawCode.has(upTok)) {
          const siblings = skuLookup.byRawCode.get(upTok)!;
          const key = getCanonicalSkuKey(siblings[0].code);
          if (!seenCanonical.has(key)) {
            seenCanonical.add(key);
            matched.push({ primary: siblings[0], siblings, key });
          }
          lineMatched = true;
          break;
        }

        // 4. Try prefix or substring match if token has 6+ digits
        const cleanDigits = tok.replace(/\D/g, '');
        if (cleanDigits.length >= 6) {
          const partial = skus.find(s => s.code.replace(/\D/g, '').includes(cleanDigits));
          if (partial) {
            const key = getCanonicalSkuKey(partial.code);
            if (!seenCanonical.has(key)) {
              seenCanonical.add(key);
              const siblings = skuLookup.byCanonical.get(key) || [partial];
              matched.push({ primary: partial, siblings, key });
            }
            lineMatched = true;
            break;
          }
        }
      }

      if (!lineMatched) {
        unmatched.push(rawLine.length > 35 ? rawLine.slice(0, 32) + '...' : rawLine);
      }
    }

    return { matchedGroups: matched, unmatchedTokens: unmatched };
  }, [batchPasteText, skuLookup, skus]);

  // Set of IDs of items currently being relocated (to avoid self-collision when checking occupied towers)
  const movingItemIds = useMemo(() => {
    const ids = new Set<string>();
    for (const g of matchedGroups) {
      for (const s of g.siblings) {
        ids.add(s.id);
      }
    }
    return ids;
  }, [matchedGroups]);

  // Map of non-moving items per tower in target street
  const existingOccupiedPositionsInTarget = useMemo(() => {
    const posOccupied = new Map<number, SkuItem[]>();
    for (const it of skus) {
      if (it.rua === batchTargetRua && !movingItemIds.has(it.id)) {
        if (!posOccupied.has(it.pos)) posOccupied.set(it.pos, []);
        posOccupied.get(it.pos)!.push(it);
      }
    }
    return posOccupied;
  }, [skus, batchTargetRua, movingItemIds]);

  // Calculate planned allocation (DE ➔ PARA plan)
  const batchAllocationPlan = useMemo(() => {
    const results: BatchAllocatedItem[] = [];
    if (matchedGroups.length === 0) return results;

    const validPosList = getValidPositionsForStreet(batchTargetRua);
    if (validPosList.length === 0) return results;

    const assignedPositionsInBatch = new Set<number>();
    let currentPosSearchIndex = validPosList.findIndex(p => p >= batchStartPos);
    if (currentPosSearchIndex === -1) currentPosSearchIndex = 0;

    for (const group of matchedGroups) {
      const primary = group.primary;
      const siblings = group.siblings;
      const neededLevels = siblings.length > 0 ? siblings.length : 1;
      const origWmsList = siblings.map(s => s.wms);
      const totalQty = siblings.reduce((sum, s) => sum + (s.qty || 0), 0);
      const origLocal = primary.rawLocal || siblings[0].wms;

      let allocatedPos = -1;
      let allocatedLevels: number[] = [];
      let isOccupiedByOthers = false;

      // Find eligible tower in target street
      let found = false;
      const startIndex = currentPosSearchIndex;

      for (let i = startIndex; i < validPosList.length; i++) {
        const candidatePos = validPosList[i];
        if (assignedPositionsInBatch.has(candidatePos)) continue;

        const maxLv = getMaxLevelsForStreet(batchTargetRua, candidatePos);
        const existingInTower = existingOccupiedPositionsInTarget.get(candidatePos) || [];

        if (batchSkipOccupied && existingInTower.length > 0) {
          // Skip occupied tower
          continue;
        }

        // Check if tower has enough levels
        if (batchKeepMultiLevels && neededLevels > 1) {
          if (maxLv < neededLevels) continue;
          // Available levels
          const occupiedLvls = new Set(existingInTower.map(e => e.nivel));
          const freeLevels: number[] = [];
          for (let lv = 1; lv <= maxLv; lv++) {
            if (!occupiedLvls.has(lv)) freeLevels.push(lv);
          }
          if (freeLevels.length >= neededLevels) {
            allocatedPos = candidatePos;
            allocatedLevels = pickBestLevelsInColumn(freeLevels, neededLevels);
            isOccupiedByOthers = existingInTower.length > 0;
            assignedPositionsInBatch.add(candidatePos);
            currentPosSearchIndex = i + 1;
            found = true;
            break;
          }
        } else {
          // Standard single or sequential levels
          const occupiedLvls = new Set(existingInTower.map(e => e.nivel));
          const lvls: number[] = [];
          for (let lv = 1; lv <= Math.min(maxLv, neededLevels); lv++) {
            lvls.push(lv);
          }
          if (lvls.length === 0) lvls.push(1);
          allocatedPos = candidatePos;
          allocatedLevels = lvls;
          isOccupiedByOthers = existingInTower.length > 0;
          assignedPositionsInBatch.add(candidatePos);
          currentPosSearchIndex = i + 1;
          found = true;
          break;
        }
      }

      // If we couldn't find a position through the end of the street, wrap around or assign overflow
      if (!found) {
        allocatedPos = validPosList[validPosList.length - 1] || 1;
        allocatedLevels = Array.from({ length: Math.min(neededLevels, 6) }, (_, k) => k + 1);
        isOccupiedByOthers = true;
      }

      const isValidPos = isValidPositionInStreet(batchTargetRua, allocatedPos);
      const targetLocal = formatLevelsToSisplanLocal(batchTargetRua, allocatedPos, allocatedLevels);
      const targetWms = allocatedLevels.map(lv => formatWmsAddress(batchTargetRua, allocatedPos, lv));

      results.push({
        canonicalKey: group.key,
        primarySku: primary,
        allSiblingItems: siblings,
        neededLevelsCount: neededLevels,
        originalLocal: origLocal,
        originalWmsList: origWmsList,
        totalQty,
        targetRua: batchTargetRua,
        targetPos: allocatedPos,
        targetLevels: allocatedLevels,
        targetSisplanLocal: targetLocal,
        targetWmsList: targetWms,
        isTowerOccupiedByOthers: isOccupiedByOthers,
        isPositionValid: isValidPos
      });
    }

    return results;
  }, [
    matchedGroups,
    batchTargetRua,
    batchStartPos,
    batchSkipOccupied,
    batchKeepMultiLevels,
    existingOccupiedPositionsInTarget
  ]);

  // Find consecutive free positions helper
  const handleSuggestConsecutiveFree = useCallback(() => {
    if (matchedGroups.length === 0) {
      playMacSound('alert', soundEnabled);
      showToast('Nenhum SKU para alocar', 'Cole primeiro os SKUs na caixa de texto.', '⚠️');
      return;
    }

    const neededTowers = matchedGroups.length;
    const validPositions = getValidPositionsForStreet(batchTargetRua);

    // Look for a run of consecutive free towers in batchTargetRua
    let bestStartPos = validPositions[0] || 1;
    let currentRun = 0;
    let runStart = -1;

    for (const pos of validPositions) {
      const existing = existingOccupiedPositionsInTarget.get(pos) || [];
      if (existing.length === 0 && !transbordoRegistry[formatWmsAddress(batchTargetRua, pos, 1)]) {
        if (currentRun === 0) runStart = pos;
        currentRun++;
        if (currentRun >= neededTowers) {
          bestStartPos = runStart;
          break;
        }
      } else {
        currentRun = 0;
        runStart = -1;
      }
    }

    // If no single contiguous block of neededTowers, pick the first tower with minimum occupancy
    if (currentRun < neededTowers) {
      for (const pos of validPositions) {
        const existing = existingOccupiedPositionsInTarget.get(pos) || [];
        if (existing.length === 0) {
          bestStartPos = pos;
          break;
        }
      }
    }

    setBatchStartPos(bestStartPos);
    playMacSound('pop', soundEnabled);
    showToast(
      'Sequência de Posições Encontrada!',
      `Início sugerido na Torre ${bestStartPos} da Rua ${batchTargetRua}`,
      '✨'
    );
  }, [
    matchedGroups.length,
    batchTargetRua,
    existingOccupiedPositionsInTarget,
    transbordoRegistry,
    soundEnabled,
    showToast
  ]);

  // Filtered preview items for table
  const filteredAllocationPlan = useMemo(() => {
    const q = batchFilterQuery.trim().toUpperCase();
    if (!q) return batchAllocationPlan;
    return batchAllocationPlan.filter(it =>
      it.primarySku.code.toUpperCase().includes(q) ||
      (it.primarySku.name && it.primarySku.name.toUpperCase().includes(q)) ||
      it.originalLocal.toUpperCase().includes(q) ||
      it.targetSisplanLocal.toUpperCase().includes(q)
    );
  }, [batchAllocationPlan, batchFilterQuery]);

  // Populate sample SKUs for quick test
  const handlePopulateSample = useCallback(() => {
    if (skus.length === 0) return;
    // Pick 5 distinct SKUs from the current warehouse
    const distinct: SkuItem[] = [];
    const seen = new Set<string>();
    for (const item of skus) {
      const k = getCanonicalSkuKey(item.code);
      if (!seen.has(k)) {
        seen.add(k);
        distinct.push(item);
        if (distinct.length >= 5) break;
      }
    }
    const sampleCsv = distinct
      .map(s => `${s.code};${s.colorCode || '101'};${s.size || 'M'};2;${s.rawLocal || s.wms}`)
      .join('\n');
    setBatchPasteText(sampleCsv);
    playMacSound('pop', soundEnabled);
    showToast('Amostra Carregada', `${distinct.length} SKUs preenchidos para teste rápido`, '📋');
  }, [skus, soundEnabled, showToast]);

  // =========================================================================
  // EXECUTE BATCH RELOCATION
  // =========================================================================
  const handleExecuteBatchRelocation = useCallback(() => {
    if (batchAllocationPlan.length === 0) return;

    // Check invalid positions
    const invalidItems = batchAllocationPlan.filter(i => !i.isPositionValid);
    if (invalidItems.length > 0) {
      playMacSound('alert', soundEnabled);
      showToast(
        'Posições Inválidas Detectadas',
        `Existem ${invalidItems.length} itens com endereço fora do limite da Rua ${batchTargetRua}. Ajuste a posição inicial.`,
        '🚨'
      );
      return;
    }

    const itemsToMoveMap = new Map<string, BatchAllocatedItem>();
    for (const plan of batchAllocationPlan) {
      for (const sib of plan.allSiblingItems) {
        itemsToMoveMap.set(sib.id, plan);
      }
    }

    let curMoved = { ...movedSkusRegistry };

    // Update SKUs array
    const nextSkus = skus.map(item => {
      const plan = itemsToMoveMap.get(item.id);
      if (!plan) return item;

      const sibIndex = plan.allSiblingItems.findIndex(s => s.id === item.id);
      const lv = plan.targetLevels[sibIndex] || plan.targetLevels[0] || 1;
      const newWms = formatWmsAddress(plan.targetRua, plan.targetPos, lv);
      const isReserved35 = isReservedCol35Street(plan.targetRua);

      return {
        ...item,
        lastRelocatedFrom: item.wms,
        rua: plan.targetRua,
        pos: plan.targetPos,
        nivel: lv,
        wms: newWms,
        rawLocal: plan.targetSisplanLocal,
        colecao: isReserved35 ? '35' : item.colecao
      };
    });

    // Record every SKU in movedSkusRegistry
    for (const plan of batchAllocationPlan) {
      const rec = recordSkuMoved(
        plan.primarySku,
        plan.originalLocal,
        plan.targetSisplanLocal,
        'relocate',
        curMoved
      );
      curMoved = rec.nextMoved;
    }

    // Persist and apply
    setSkus(nextSkus);
    setMovedSkusRegistry(curMoved);
    persistCurrentState(nextSkus, curMoved, transbordoRegistry);
    selectStreet(batchTargetRua);
    if (batchAllocationPlan[0]) {
      setSelectedAddressKey(batchAllocationPlan[0].targetWmsList[0]);
    }

    const now = new Date();
    const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    setBatchExecutedSummary({
      count: batchAllocationPlan.length,
      totalBoxes: batchAllocationPlan.reduce((sum, p) => sum + p.allSiblingItems.length, 0),
      totalPieces: batchAllocationPlan.reduce((sum, p) => sum + p.totalQty, 0),
      targetRua: batchTargetRua,
      items: batchAllocationPlan,
      timestamp: timeStr
    });

    playMacSound('success', soundEnabled);
    showToast(
      'Remanejamento em Lote Concluído!',
      `${batchAllocationPlan.length} SKUs remanejados para Rua ${batchTargetRua} (Pos. ${batchAllocationPlan[0].targetPos} em diante)`,
      '🚀'
    );
  }, [
    batchAllocationPlan,
    batchTargetRua,
    movedSkusRegistry,
    skus,
    recordSkuMoved,
    setSkus,
    setMovedSkusRegistry,
    persistCurrentState,
    transbordoRegistry,
    selectStreet,
    setSelectedAddressKey,
    soundEnabled,
    showToast
  ]);

  // Export Batch CSV
  const handleDownloadBatchCsv = useCallback(() => {
    if (!batchExecutedSummary) return;

    const headers = [
      'CODIGO_SKU',
      'DESCRICAO',
      'COR',
      'TAMANHO',
      'DEPOSITO',
      'LOCAL_ANTERIOR',
      'NOVO_LOCAL_SISPLAN',
      'WMS_DESTINO',
      'TOTAL_CAIXAS',
      'TOTAL_PECAS',
      'DATA_HORA'
    ];

    const rows = batchExecutedSummary.items.map(item => {
      const dec = decodeSkuPrefix(item.primarySku.code);
      return [
        item.primarySku.code,
        `"${(item.primarySku.name || dec.autoName).replace(/"/g, '""')}"`,
        item.primarySku.colorCode || dec.colorCode,
        item.primarySku.size || dec.size,
        item.primarySku.deposito || '2',
        item.originalLocal,
        item.targetSisplanLocal,
        item.targetWmsList.join(';'),
        item.allSiblingItems.length,
        item.totalQty,
        batchExecutedSummary.timestamp
      ].join(';');
    });

    const csvContent = [headers.join(';'), ...rows].join('\r\n');
    const filename = `remanejamento_lote_rua_${batchExecutedSummary.targetRua}_${new Date().toISOString().slice(0, 10)}.csv`;
    triggerCsvDownload(csvContent, filename);
    playMacSound('pop', soundEnabled);
    showToast('Download do Relatório Iniciado', filename, '📥');
  }, [batchExecutedSummary, soundEnabled, showToast]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200">
      <div className="mac-window mac-sheet w-full max-w-4xl max-h-[92vh] rounded-2xl overflow-hidden shadow-2xl border border-white/20 flex flex-col bg-slate-900/95 text-slate-100">
        
        {/* MODAL HEADER */}
        <div className="px-5 py-3.5 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-amber-500/20 via-orange-500/15 to-transparent shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold text-lg shadow-sm">
              ⇄
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-display font-bold text-base text-white tracking-wide">
                  Central de Remanejamento de Endereços
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/25 text-amber-300 border border-amber-500/40">
                  WMS Sequoia
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Alocação inteligente individual ou movimentação em lote de SKUs via colagem de CSV
              </p>
            </div>
          </div>
          
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition text-sm"
          >
            ✕
          </button>
        </div>

        {/* TAB NAVIGATION */}
        <div className="px-5 pt-3 pb-2 border-b border-white/10 bg-black/20 flex items-center justify-between shrink-0">
          <div className="flex space-x-2">
            <button
              type="button"
              onClick={() => {
                setActiveTab('single');
                setBatchExecutedSummary(null);
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-2 transition ${
                activeTab === 'single'
                  ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                  : 'bg-white/5 text-slate-300 hover:bg-white/10'
              }`}
            >
              <span>⇄</span>
              <span>Remanejamento Individual</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('batch')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-2 transition ${
                activeTab === 'batch'
                  ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                  : 'bg-white/5 text-slate-300 hover:bg-white/10'
              }`}
            >
              <span>📑</span>
              <span>Remanejamento em Lote (Batch CSV)</span>
              {matchedGroups.length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-950/40 text-amber-200">
                  {matchedGroups.length}
                </span>
              )}
            </button>
          </div>

          <div className="text-[11px] text-slate-400 flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Rua Selecionada: <strong className="text-white font-mono">{selectedStreet}</strong></span>
          </div>
        </div>

        {/* MODAL BODY */}
        <div className="p-5 overflow-y-auto flex-1 space-y-5 custom-scrollbar">

          {/* ================================================================= */}
          {/* TAB 1: SINGLE SKU RELOCATION                                      */}
          {/* ================================================================= */}
          {activeTab === 'single' && (
            <form
              onSubmit={e => {
                e.preventDefault();
                if (!currentSelectedSingleSku) return;

                if (!isValidPositionInStreet(singleNewRua, singleNewPos)) {
                  playMacSound('alert', soundEnabled);
                  showToast(
                    `Torre ${singleNewPos} Inválida na Rua ${singleNewRua}!`,
                    getStreetPositionRuleDescription(singleNewRua),
                    '🚨'
                  );
                  return;
                }

                const multi = currentSingleMulti || getSkuMultiLevelInfo(currentSelectedSingleSku);
                const levelsToUse =
                  singleMoveAllLevels && singleSelectedLevels.length > 0
                    ? singleSelectedLevels
                    : [singleNewNivel];

                const newRawLocal = formatLevelsToSisplanLocal(
                  singleNewRua,
                  singleNewPos,
                  levelsToUse
                );
                const oldRaw = currentSelectedSingleSku.rawLocal || currentSelectedSingleSku.wms;
                const sibIds = new Set(multi.siblingItems.map(s => s.id));

                const nextSkus = skus.map(item => {
                  if (!sibIds.has(item.id)) return item;
                  const idx = multi.siblingItems.findIndex(s => s.id === item.id);
                  const lv = levelsToUse[idx] || levelsToUse[0];
                  return {
                    ...item,
                    lastRelocatedFrom: item.wms,
                    rua: singleNewRua,
                    pos: singleNewPos,
                    nivel: lv,
                    wms: formatWmsAddress(singleNewRua, singleNewPos, lv),
                    rawLocal: newRawLocal,
                    colecao: isReservedCol35Street(singleNewRua) ? '35' : item.colecao
                  };
                });

                const { nextMoved } = recordSkuMoved(
                  currentSelectedSingleSku,
                  oldRaw,
                  newRawLocal,
                  'relocate',
                  movedSkusRegistry
                );
                setSkus(nextSkus);
                setMovedSkusRegistry(nextMoved);
                selectStreet(singleNewRua);
                setSelectedAddressKey(formatWmsAddress(singleNewRua, singleNewPos, levelsToUse[0]));
                persistCurrentState(nextSkus, nextMoved, transbordoRegistry);
                onClose();
                playMacSound('success', soundEnabled);
                showToast(
                  'SKU Remanejado com Sucesso',
                  `${currentSelectedSingleSku.code}: ${oldRaw} → ${newRawLocal}`,
                  '⇄'
                );
              }}
              className="space-y-4 text-xs"
            >
              {/* Step 1: Select SKU */}
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200">1. Selecionar SKU Cadastrado</span>
                  <span className="text-[11px] text-slate-400">Total no estoque: {skus.length} caixas</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold mb-1 text-slate-400">
                      Filtrar por Código, Nome ou Endereço Atual
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: 11060127, RG.005.1, Azul..."
                      value={singleSearchQuery}
                      onChange={e => setSingleSearchQuery(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 font-mono text-xs text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold mb-1 text-slate-400">
                      Lista de SKUs Encontrados
                    </label>
                    <select
                      value={singleSkuId}
                      onChange={e => {
                        const id = e.target.value;
                        const found = skus.find(s => s.id === id);
                        if (found) handleSingleSkuSelected(found);
                      }}
                      className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 font-mono text-xs text-white focus:border-amber-400 focus:outline-none"
                    >
                      <option value="">Selecione um SKU da lista...</option>
                      {singleCandidateSkus.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.wms} — {s.code} ({s.name || 'Sem descrição'})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* SKU Info Card */}
                {currentSelectedSingleSku && (
                  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-between">
                    <div className="space-y-0.5">
                      <p className="font-mono font-bold text-amber-300 text-xs">
                        {currentSelectedSingleSku.code}
                      </p>
                      <p className="text-[11px] text-slate-300">
                        {currentSelectedSingleSku.name} • Cor: {currentSelectedSingleSku.colorCode} • Tam: {currentSelectedSingleSku.size}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        Endereço Atual:{' '}
                        <strong className="text-white font-mono">
                          {currentSelectedSingleSku.rawLocal || currentSelectedSingleSku.wms}
                        </strong>{' '}
                        ({currentSingleMulti?.requiredLevels || 1} nível(is) / {currentSingleMulti?.siblingItems.reduce((acc, x) => acc + (x.qty || 0), 0) || currentSelectedSingleSku.qty || 0} peças)
                      </p>
                    </div>

                    <label className="flex items-center space-x-2 text-[11px] text-slate-300 cursor-pointer bg-black/30 px-2.5 py-1.5 rounded-lg border border-white/10">
                      <input
                        type="checkbox"
                        checked={singleMoveAllLevels}
                        onChange={e => setSingleMoveAllLevels(e.target.checked)}
                        className="rounded border-slate-700 text-amber-500 focus:ring-0"
                      />
                      <span>Mover todos os níveis agrupados</span>
                    </label>
                  </div>
                )}
              </div>

              {/* Step 2: Target Location */}
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-emerald-400">
                    2. Novo Endereço de Destino no WMS
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      const needed = singleMoveAllLevels ? (currentSingleMulti?.requiredLevels || 1) : 1;
                      const sug = findMultiLevelFreeColumnInStreet(
                        singleNewRua,
                        needed,
                        singleNewPos + 1
                      );
                      if (sug) {
                        setSingleNewPos(sug.pos);
                        setSingleSelectedLevels(sug.levels);
                        setSingleNewNivel(sug.levels[0]);
                        playMacSound('pop', soundEnabled);
                        showToast(
                          'Coluna Livre Sugerida',
                          `Torre ${sug.pos} com ${sug.levels.length} nível(is) disponíveis na Rua ${singleNewRua}`,
                          '✨'
                        );
                      } else {
                        playMacSound('alert', soundEnabled);
                        showToast('Aviso', `Sem colunas com ${needed} níveis livres consecutivos a partir da posição atual.`, '⚠️');
                      }
                    }}
                    className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold flex items-center space-x-1.5 shadow"
                  >
                    <span>✨</span>
                    <span>Sugerir Coluna Livre</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold mb-1 text-slate-400">
                      Nova Rua
                    </label>
                    <select
                      value={singleNewRua}
                      onChange={e => {
                        const r = e.target.value;
                        setSingleNewRua(r);
                        const valid = getValidPositionsForStreet(r);
                        if (!valid.includes(singleNewPos)) {
                          setSingleNewPos(valid[0] || 1);
                        }
                      }}
                      className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/15 font-mono font-bold text-white focus:border-emerald-400 focus:outline-none"
                    >
                      {STREETS.map(r => (
                        <option key={r} value={r}>
                          Rua {r} {STREET_META[r] ? `(${STREET_META[r].badge})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold mb-1 text-slate-400">
                      Nova Posição (Torre)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={175}
                      value={singleNewPos}
                      onChange={e => setSingleNewPos(parseInt(e.target.value, 10) || 1)}
                      className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/15 font-mono font-bold text-white focus:border-emerald-400 focus:outline-none"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      {getStreetPositionRuleDescription(singleNewRua)}
                    </p>
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold mb-1 text-slate-400">
                      Nível Inicial / Principal
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={getMaxLevelsForStreet(singleNewRua, singleNewPos)}
                      value={singleNewNivel}
                      onChange={e => setSingleNewNivel(parseInt(e.target.value, 10) || 1)}
                      className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/15 font-mono font-bold text-white focus:border-emerald-400 focus:outline-none"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      Máx. {getMaxLevelsForStreet(singleNewRua, singleNewPos)} níveis nesta torre
                    </p>
                  </div>
                </div>

                {/* Preview string */}
                <div className="pt-2 border-t border-emerald-500/20 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Prévia do Endereço de Destino:</span>
                  <span className="font-mono font-bold text-emerald-300 bg-black/40 px-2 py-0.5 rounded border border-emerald-500/30">
                    {formatLevelsToSisplanLocal(
                      singleNewRua,
                      singleNewPos,
                      singleMoveAllLevels && singleSelectedLevels.length > 0 ? singleSelectedLevels : [singleNewNivel]
                    )}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end space-x-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 font-medium text-slate-300 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!currentSelectedSingleSku}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold shadow-lg transition"
                >
                  Confirmar Remanejamento Individual
                </button>
              </div>
            </form>
          )}

          {/* ================================================================= */}
          {/* TAB 2: BATCH RELOCATE (REMANEJAMENTO EM LOTE VIA CSV)             */}
          {/* ================================================================= */}
          {activeTab === 'batch' && !batchExecutedSummary && (
            <div className="space-y-4 text-xs">
              
              {/* STEP 1: CSV / TEXT INPUT */}
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-slate-200 text-xs flex items-center space-x-2">
                      <span>1. Colar SKUs ou Linhas CSV</span>
                      <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 text-[10px] border border-blue-500/30">
                        Suporta Sisplan, WMS ou Códigos Puros
                      </span>
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Cole códigos de SKUs separados por quebra de linha, vírgula, ponto-e-vírgula ou colunas exportadas do Sisplan
                    </p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={handlePopulateSample}
                      className="px-2.5 py-1 rounded-lg bg-blue-600/30 hover:bg-blue-600/50 text-blue-200 border border-blue-500/40 text-[11px] font-semibold flex items-center space-x-1 transition"
                    >
                      <span>📋</span>
                      <span>Exemplo Rápido</span>
                    </button>
                    {batchPasteText && (
                      <button
                        type="button"
                        onClick={() => {
                          setBatchPasteText('');
                          playMacSound('pop', soundEnabled);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-[11px] font-semibold transition"
                      >
                        Limpar
                      </button>
                    )}
                  </div>
                </div>

                <textarea
                  rows={5}
                  value={batchPasteText}
                  onChange={e => setBatchPasteText(e.target.value)}
                  placeholder="Exemplos aceitos:&#10;11060127;102;M;2;RF.001.1 - 4&#10;11040102-409-38&#10;RF.003.1&#10;11060600, 11210015, 12140004"
                  className="w-full px-3 py-2.5 rounded-xl bg-black/50 border border-white/15 font-mono text-xs text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none custom-scrollbar"
                />

                {/* Parsing Summary Badges */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div className="flex items-center space-x-2">
                    <span className={`px-2.5 py-1 rounded-lg font-bold text-[11px] flex items-center space-x-1.5 ${
                      matchedGroups.length > 0
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-white/5 text-slate-400 border border-white/10'
                    }`}>
                      <span>✓</span>
                      <span>{matchedGroups.length} SKUs identificados no estoque</span>
                    </span>

                    {matchedGroups.length > 0 && (
                      <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold text-[11px]">
                        {batchAllocationPlan.reduce((sum, p) => sum + p.allSiblingItems.length, 0)} caixas / níveis totais
                      </span>
                    )}

                    {unmatchedTokens.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowUnmatchedList(!showUnmatchedList)}
                        className="px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold text-[11px] flex items-center space-x-1 hover:bg-rose-500/30 transition"
                      >
                        <span>⚠️</span>
                        <span>{unmatchedTokens.length} não encontrados</span>
                        <span className="text-[10px]">{showUnmatchedList ? '▲' : '▼'}</span>
                      </button>
                    )}
                  </div>

                  <span className="text-[11px] text-slate-400 font-mono">
                    {batchPasteText.split(/[\r\n]+/).filter(Boolean).length} linha(s) processada(s)
                  </span>
                </div>

                {/* Unmatched list dropdown */}
                {showUnmatchedList && unmatchedTokens.length > 0 && (
                  <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-500/30 space-y-1.5 max-h-32 overflow-y-auto custom-scrollbar">
                    <p className="text-[10px] font-bold text-rose-300 uppercase tracking-wider">
                      Itens não localizados no estoque atual:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {unmatchedTokens.map((tok, i) => (
                        <span key={i} className="px-2 py-0.5 rounded bg-rose-900/60 text-rose-200 font-mono text-[10px] border border-rose-500/30">
                          {tok}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* STEP 2: TARGET ALLOCATION CONFIGURATION */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent border border-emerald-500/30 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-emerald-400 text-xs flex items-center space-x-1.5">
                      <span>2. Parâmetros de Destino e Alocação</span>
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Selecione a rua e posição inicial para reorganização contínua do corredor
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleSuggestConsecutiveFree}
                    disabled={matchedGroups.length === 0}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-[11px] flex items-center space-x-1.5 shadow-md transition"
                  >
                    <span>✨</span>
                    <span>Sugerir Posições Consecutivas Livres</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold mb-1 text-slate-300">
                      Rua de Destino
                    </label>
                    <select
                      value={batchTargetRua}
                      onChange={e => {
                        const r = e.target.value;
                        setBatchTargetRua(r);
                        const valids = getValidPositionsForStreet(r);
                        if (!valids.includes(batchStartPos)) {
                          setBatchStartPos(valids[0] || 1);
                        }
                      }}
                      className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/15 font-mono font-bold text-white focus:border-emerald-400 focus:outline-none"
                    >
                      {STREETS.map(r => (
                        <option key={r} value={r}>
                          Rua {r} {STREET_META[r] ? `(${STREET_META[r].badge})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold mb-1 text-slate-300">
                      Posição Inicial (Torre)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={175}
                      value={batchStartPos}
                      onChange={e => setBatchStartPos(parseInt(e.target.value, 10) || 1)}
                      className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/15 font-mono font-bold text-white focus:border-emerald-400 focus:outline-none"
                    />
                  </div>

                  <div className="flex flex-col justify-end">
                    <label className="flex items-center space-x-2 text-[11px] text-slate-200 cursor-pointer bg-black/30 p-2 rounded-lg border border-white/10 hover:border-white/20 transition">
                      <input
                        type="checkbox"
                        checked={batchSkipOccupied}
                        onChange={e => setBatchSkipOccupied(e.target.checked)}
                        className="rounded border-slate-700 text-emerald-500 focus:ring-0"
                      />
                      <span>Pular torres ocupadas</span>
                    </label>
                  </div>

                  <div className="flex flex-col justify-end">
                    <label className="flex items-center space-x-2 text-[11px] text-slate-200 cursor-pointer bg-black/30 p-2 rounded-lg border border-white/10 hover:border-white/20 transition">
                      <input
                        type="checkbox"
                        checked={batchKeepMultiLevels}
                        onChange={e => setBatchKeepMultiLevels(e.target.checked)}
                        className="rounded border-slate-700 text-emerald-500 focus:ring-0"
                      />
                      <span>Manter níveis agrupados</span>
                    </label>
                  </div>
                </div>

                {isReservedCol35Street(batchTargetRua) && (
                  <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-300 flex items-center space-x-2">
                    <span>💡</span>
                    <span>
                      Rua <strong>{batchTargetRua}</strong> pertence à <strong>Coleção 35</strong>. Todas as peças movidas receberão automaticamente a tag de Coleção 35.
                    </span>
                  </div>
                )}
              </div>

              {/* STEP 3: PREVIEW "DE ➔ PARA" */}
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <h4 className="font-bold text-slate-200 text-xs">
                      3. Prévia do Remanejamento: DE ➔ PARA ({batchAllocationPlan.length} SKUs)
                    </h4>
                    {batchAllocationPlan.length > 0 && (
                      <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded border border-emerald-500/30">
                        Rua {batchTargetRua} • Torres {batchAllocationPlan[0]?.targetPos} a {batchAllocationPlan[batchAllocationPlan.length - 1]?.targetPos}
                      </span>
                    )}
                  </div>

                  {batchAllocationPlan.length > 5 && (
                    <input
                      type="text"
                      placeholder="Filtrar na prévia..."
                      value={batchFilterQuery}
                      onChange={e => setBatchFilterQuery(e.target.value)}
                      className="px-2.5 py-1 rounded-lg bg-black/40 border border-white/15 text-[11px] text-white focus:border-amber-400 focus:outline-none w-48"
                    />
                  )}
                </div>

                {batchAllocationPlan.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 border border-dashed border-white/10 rounded-xl space-y-2">
                    <p className="text-2xl">📋</p>
                    <p className="font-semibold text-xs">Nenhum SKU pronto para prévia</p>
                    <p className="text-[11px]">Cole os códigos de SKU ou linhas CSV acima para ver a alocação proposta</p>
                  </div>
                ) : (
                  <div className="border border-white/10 rounded-xl overflow-hidden max-h-64 overflow-y-auto custom-scrollbar">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-black/40 text-slate-400 uppercase text-[9px] font-bold border-b border-white/10 sticky top-0 backdrop-blur z-10">
                        <tr>
                          <th className="p-2.5">SKU & Produto</th>
                          <th className="p-2.5">Endereço Atual</th>
                          <th className="p-2.5 text-center">➔</th>
                          <th className="p-2.5">Novo Endereço Proposto</th>
                          <th className="p-2.5 text-center">Caixas</th>
                          <th className="p-2.5 text-center">Peças</th>
                          <th className="p-2.5 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 font-mono">
                        {filteredAllocationPlan.map((item, idx) => {
                          const dec = decodeSkuPrefix(item.primarySku.code);
                          return (
                            <tr key={idx} className="hover:bg-white/5 transition">
                              <td className="p-2.5">
                                <div className="font-bold text-white text-xs">{item.primarySku.code}</div>
                                <div className="text-[10px] text-slate-400 truncate max-w-[220px]">
                                  {item.primarySku.name || dec.autoName}
                                </div>
                              </td>

                              <td className="p-2.5">
                                <span className="px-2 py-0.5 rounded bg-white/5 text-slate-300 border border-white/10">
                                  {item.originalLocal}
                                </span>
                              </td>

                              <td className="p-2.5 text-center text-amber-400 font-bold">
                                ➔
                              </td>

                              <td className="p-2.5">
                                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                                  {item.targetSisplanLocal}
                                </span>
                              </td>

                              <td className="p-2.5 text-center text-slate-300">
                                {item.allSiblingItems.length}
                              </td>

                              <td className="p-2.5 text-center text-slate-300 font-bold">
                                {item.totalQty}
                              </td>

                              <td className="p-2.5 text-right">
                                {!item.isPositionValid ? (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] bg-rose-500/20 text-rose-300 border border-rose-500/40">
                                    Posição Inválida
                                  </span>
                                ) : item.isTowerOccupiedByOthers ? (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                    Compartilhada
                                  </span>
                                ) : (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                    ✓ Livre
                                  </span>
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

              {/* BATCH ACTIONS */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-white/10">
                <div className="text-[11px] text-slate-400">
                  {batchAllocationPlan.length > 0 && (
                    <span>
                      Movimentação registrará <strong className="text-white">{batchAllocationPlan.length} SKUs</strong> no histórico de auditoria e salvará no WMS.
                    </span>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 font-medium text-slate-300 transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleExecuteBatchRelocation}
                    disabled={batchAllocationPlan.length === 0}
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:opacity-50 text-slate-950 font-bold shadow-lg transition flex items-center space-x-2"
                  >
                    <span>🚀</span>
                    <span>Executar Remanejamento em Lote ({batchAllocationPlan.length})</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* TAB 2: POST-EXECUTION SUCCESS SCREEN                              */}
          {/* ================================================================= */}
          {activeTab === 'batch' && batchExecutedSummary && (
            <div className="p-6 text-center space-y-6 animate-in zoom-in-95 duration-200">
              <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-3xl shadow-lg shadow-emerald-500/10">
                🎉
              </div>

              <div className="space-y-1">
                <h3 className="font-display font-extrabold text-xl text-white">
                  Remanejamento em Lote Concluído com Sucesso!
                </h3>
                <p className="text-xs text-slate-300">
                  Todos os endereços WMS e posições Sisplan foram atualizados e sincronizados.
                </p>
              </div>

              {/* KPI CARDS */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl mx-auto">
                <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 text-center">
                  <p className="text-[10px] uppercase font-bold text-slate-400">SKUs Movidos</p>
                  <p className="text-xl font-black text-amber-400 font-mono mt-0.5">{batchExecutedSummary.count}</p>
                </div>
                <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 text-center">
                  <p className="text-[10px] uppercase font-bold text-slate-400">Caixas / Níveis</p>
                  <p className="text-xl font-black text-blue-400 font-mono mt-0.5">{batchExecutedSummary.totalBoxes}</p>
                </div>
                <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 text-center">
                  <p className="text-[10px] uppercase font-bold text-slate-400">Total Peças</p>
                  <p className="text-xl font-black text-emerald-400 font-mono mt-0.5">{batchExecutedSummary.totalPieces}</p>
                </div>
                <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 text-center">
                  <p className="text-[10px] uppercase font-bold text-slate-400">Rua de Destino</p>
                  <p className="text-xl font-black text-purple-400 font-mono mt-0.5">Rua {batchExecutedSummary.targetRua}</p>
                </div>
              </div>

              {/* Relocation Download CTA */}
              <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30 max-w-xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-left">
                <div>
                  <h4 className="font-bold text-xs text-blue-300">
                    Relatório CSV do Remanejamento para Operadores
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Baixe a planilha com as colunas DE / PARA formatadas para o coletor ou impressão física
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadBatchCsv}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center space-x-2 shrink-0 shadow-md transition"
                >
                  <span>📥</span>
                  <span>Baixar CSV do Lote</span>
                </button>
              </div>

              <div className="flex justify-center space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setBatchExecutedSummary(null);
                    setBatchPasteText('');
                  }}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-medium text-xs transition"
                >
                  Realizar Outro Remanejamento
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg transition"
                >
                  Concluir & Voltar ao Mapa
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default RelocateModal;
