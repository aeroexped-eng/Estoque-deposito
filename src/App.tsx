import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  STREETS,
  STREET_META,
  ADDRESS_RANGES,
  AERO_BRANDS,
  AERO_LABELS,
  AERO_GROUPS,
  OFFICIAL_COLORS,
  SkuItem,
  TransbordoEntry,
  MovedSkuEntry,
  isReservedCol35Street,
  isAccessoriesStreet,
  isPulmaoStreet,
  getMaxPosForStreet,
  isValidPositionInStreet,
  getMaxLevelsForStreet,
  getValidPositionsForStreet,
  getTotalSlotsForStreet,
  getStreetPositionRuleDescription,
  formatWmsAddress,
  parseAddressString,
  expandSisplanLocal,
  formatLevelsToSisplanLocal,
  pickBestLevelsInColumn,
  getCanonicalSkuKey,
  formatCanonicalSkuDisplay,
  decodeSkuPrefix
} from './constants/wmsConstants';
import {
  EMBEDDED_TRANSBORDO_DATA,
  EMBEDDED_SISPLAN_CSV,
  SAMPLE_CSV_DATA,
  playMacSound,
  parseCsvData,
  buildSisplanCsvString,
  saveWmsStateLocally,
  loadLocalWmsSnapshotSync,
  loadFromIndexedDB,
  getSavedCloudSyncUrl,
  setSavedCloudSyncUrl,
  pullStateFromCloud,
  pushStateToCloud,
  generateCleanStandaloneHtml,
  triggerCsvDownload,
  WmsPersistedSnapshot
} from './utils/storageAndSync';
import { ReportModal } from './components/ReportModal';
import { InventoryAuditModal } from './components/InventoryAuditModal';
import { AutoSaveModal } from './components/AutoSaveModal';
import { ErrorBoundary } from './components/ErrorBoundary';

type WmsPerspective = 'sku' | 'barra';
type MapMode = 'cards' | 'rack';
type MacroSector = 'ruas_all' | 'acessorios' | 'pulmao';
type OccupancyFilter =
  | 'ALL'
  | 'OCCUPIED'
  | 'FREE'
  | 'OVERLAPPED'
  | 'OUTSIDE_LOCAL'
  | 'LOW_STOCK_LT5'
  | 'TRANSBORDO';

const WALLPAPERS = ['wallpaper-sequoia', 'wallpaper-sonoma', 'wallpaper-ventura'] as const;

export default function App() {
  // Core WMS Data State
  const [skus, setSkus] = useState<SkuItem[]>([]);
  const [barraItems, setBarraItems] = useState<SkuItem[]>([]);
  const [transbordoRegistry, setTransbordoRegistry] = useState<Record<string, TransbordoEntry>>(() => {
    const init: Record<string, TransbordoEntry> = {};
    for (const entry of EMBEDDED_TRANSBORDO_DATA) {
      init[entry.wms] = { ...entry };
    }
    return init;
  });
  const [movedSkusRegistry, setMovedSkusRegistry] = useState<Record<string, MovedSkuEntry>>({});
  const [originalBaselineLocations, setOriginalBaselineLocations] = useState<Record<string, string>>({});

  // UI & Navigation State
  const [wmsPerspective, setWmsPerspective] = useState<WmsPerspective>('sku');
  const [macroSectorFilter, setMacroSectorFilter] = useState<MacroSector>('ruas_all');
  const [selectedStreet, setSelectedStreet] = useState<string>('RG');
  const [selectedRangeId, setSelectedRangeId] = useState<string>('1-20');
  const [selectedLevel, setSelectedLevel] = useState<string>('ALL');
  const [occupancyFilter, setOccupancyFilter] = useState<OccupancyFilter>('ALL');
  const [collectionFilter, setCollectionFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [mapMode, setMapMode] = useState<MapMode>('cards');
  const [highlightLowStockGreen, setHighlightLowStockGreen] = useState<boolean>(true);
  const [pulseAlertsEnabled, setPulseAlertsEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('estoque_pulse_alerts_enabled');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('estoque_pulse_alerts_enabled', String(pulseAlertsEnabled));
    } catch {}
  }, [pulseAlertsEnabled]);

  const [selectedAddressKey, setSelectedAddressKey] = useState<string>('RG.001.1');
  const [selectedSkuId, setSelectedSkuId] = useState<string | null>(null);

  // Quick Relocate & Swap State (1-Click Actions)
  const [quickActionPanel, setQuickActionPanel] = useState<'none' | 'move_empty' | 'swap'>('none');
  const [quickTargetAddressInput, setQuickTargetAddressInput] = useState<string>('');
  const [interactiveTargetMode, setInteractiveTargetMode] = useState<'none' | 'pick_empty' | 'pick_swap'>('none');

  // Transbordo Interactive Selection Mode
  const [transbordoSelectMode, setTransbordoSelectMode] = useState<boolean>(false);
  const [transbordoSelectedWms, setTransbordoSelectedWms] = useState<string[]>([]);
  const [transbordoTargetSku, setTransbordoTargetSku] = useState<string>('');
  const [transbordoNoteInput, setTransbordoNoteInput] = useState<string>('Excedente > 6 colmeias (Mini Pulmão)');

  // Pulmão Inspector Inputs
  const [pulmaoTempNote, setPulmaoTempNote] = useState<string>('Armazenamento Temporário (Pulmão)');
  const [pulmaoTempQty, setPulmaoTempQty] = useState<number>(1);

  // Theme, Window & Sound State
  const [isDark, setIsDark] = useState<boolean>(false);
  const [wallpaperIdx, setWallpaperIdx] = useState<number>(0);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [isDockCollapsed, setIsDockCollapsed] = useState<boolean>(false);
  const [sidebarOpenMobile, setSidebarOpenMobile] = useState<boolean>(false);
  const [inspectorOpenMobile, setInspectorOpenMobile] = useState<boolean>(false);
  const [sidebarCollapsedDesktop, setSidebarCollapsedDesktop] = useState<boolean>(false);
  const [inspectorCollapsedDesktop, setInspectorCollapsedDesktop] = useState<boolean>(false);
  const [rackLayoutMode, setRackLayoutMode] = useState<'columns' | 'matrix'>('columns');
  const [rackTowerFilter, setRackTowerFilter] = useState<string>('ALL');
  const [clockText, setClockText] = useState<string>('');

  // Dropdown Menus & Modals
  const [openMenu, setOpenMenu] = useState<'apple' | 'file' | 'view' | null>(null);
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [showSkuModal, setShowSkuModal] = useState<boolean>(false);
  const [showRelocateModal, setShowRelocateModal] = useState<boolean>(false);
  const [showCloudModal, setShowCloudModal] = useState<boolean>(false);
  const [showSpotlight, setShowSpotlight] = useState<boolean>(false);
  const [showAboutModal, setShowAboutModal] = useState<boolean>(false);
  const [showReportModal, setShowReportModal] = useState<boolean>(false);
  const [showAuditModal, setShowAuditModal] = useState<boolean>(false);
  const [showAutoSaveModal, setShowAutoSaveModal] = useState<boolean>(false);
  const [isAutoSaveEnabled, setIsAutoSaveEnabled] = useState<boolean>(true);
  const [autoSaveIntervalSeconds, setAutoSaveIntervalSeconds] = useState<number>(120); // 2 minutos
  const [autoSaveCountdown, setAutoSaveCountdown] = useState<number>(120);
  const [autoRefreshMode, setAutoRefreshMode] = useState<'save_only' | 'save_and_sync' | 'save_and_reload'>('save_only');
  const [lastSavedTimestamp, setLastSavedTimestamp] = useState<Date>(new Date());
  const [isAutoSaving, setIsAutoSaving] = useState<boolean>(false);

  // Import CSV Modal State
  const [csvPasteText, setCsvPasteText] = useState<string>('');
  const [csvImportMode, setCsvImportMode] = useState<'merge' | 'replace'>('merge');
  const [csvFileName, setCsvFileName] = useState<string>('Solte seu arquivo .CSV ou clique para selecionar');
  const [rawImportedCsv, setRawImportedCsv] = useState<string>('');

  // SKU Allocate/Edit Modal State
  const [skuFormEditId, setSkuFormEditId] = useState<string>('');
  const [skuFormBrand, setSkuFormBrand] = useState<string>('1');
  const [skuFormLabel, setSkuFormLabel] = useState<string>('1');
  const [skuFormGroup, setSkuFormGroup] = useState<string>('06');
  const [skuFormSeq, setSkuFormSeq] = useState<string>('0127');
  const [skuFormColor, setSkuFormColor] = useState<string>('102');
  const [skuFormSize, setSkuFormSize] = useState<string>('M');
  const [skuFormCode, setSkuFormCode] = useState<string>('11060127 - 102 - M');
  const [skuFormDeposito, setSkuFormDeposito] = useState<string>('2');
  const [skuFormName, setSkuFormName] = useState<string>('');
  const [skuFormRua, setSkuFormRua] = useState<string>('RG');
  const [skuFormPos, setSkuFormPos] = useState<number>(1);
  const [skuFormSelectedLevels, setSkuFormSelectedLevels] = useState<number[]>([1]);
  const [skuFormQty, setSkuFormQty] = useState<number>(50);
  const [skuFormColecao, setSkuFormColecao] = useState<string>('35');

  // Relocate Modal State
  const [relocateSearchInput, setRelocateSearchInput] = useState<string>('');
  const [relocateSkuId, setRelocateSkuId] = useState<string>('');
  const [relocateNewRua, setRelocateNewRua] = useState<string>('RG');
  const [relocateNewPos, setRelocateNewPos] = useState<number>(1);
  const [relocateNewNivel, setRelocateNewNivel] = useState<number>(1);
  const [relocateMoveAllLevels, setRelocateMoveAllLevels] = useState<boolean>(true);
  const [relocateSelectedLevels, setRelocateSelectedLevels] = useState<number[]>([1]);

  // Spotlight State
  const [spotlightQuery, setSpotlightQuery] = useState<string>('');

  // Cloud Sync & HTML Generator State
  const [cloudSyncUrl, setCloudSyncUrl] = useState<string>(() => getSavedCloudSyncUrl());
  const [cloudStatus, setCloudStatus] = useState<'idle' | 'syncing' | 'ok' | 'error'>('idle');
  const [cloudStatusText, setCloudStatusText] = useState<string>('Nuvem Pronta');
  const [generatedHtmlCode, setGeneratedHtmlCode] = useState<string>('');
  const [isGeneratingHtml, setIsGeneratingHtml] = useState<boolean>(false);

  // Drag and Drop State
  const [dragPayload, setDragPayload] = useState<{ skuId: string; fromWms: string; mode: 'group' | 'single' } | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);

  // Toast State
  const [toast, setToast] = useState<{ title: string; subtitle: string; icon: string; visible: boolean }>({
    title: '',
    subtitle: '',
    icon: '✅',
    visible: false
  });
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((title: string, subtitle: string, icon = '✅') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ title, subtitle, icon, visible: true });
    toastTimerRef.current = setTimeout(() => {
      setToast(prev => ({ ...prev, visible: false }));
    }, 3400);
  }, []);

  // Sync dark mode class on <html> and notify Google Sites Atari Embed container
  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      window.parent.postMessage(
        {
          type: 'ATARI_CODE_EMBED_BACKGROUND_COLOR',
          backgroundColor: isDark ? '#0b0f19' : '#f3f5f9'
        },
        '*'
      );
    } catch {
      // ignore
    }
  }, [isDark]);

  // Clock updater
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const str = now.toLocaleDateString('pt-BR', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      });
      setClockText(str.replace('.', ''));
    };
    updateClock();
    const timer = setInterval(updateClock, 15000);
    return () => clearInterval(timer);
  }, []);

  // Close menus on outside click
  useEffect(() => {
    const handleGlobalClick = () => setOpenMenu(null);
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  // Build baseline map helper
  const buildBaselineFromSkus = useCallback((items: SkuItem[]) => {
    const bySku = new Map<string, { rua: string; pos: number; levels: number[] }>();
    for (const s of items) {
      if (s.isTransbordo) continue;
      const key = getCanonicalSkuKey(s.code);
      if (!bySku.has(key)) {
        bySku.set(key, { rua: s.rua, pos: s.pos, levels: [] });
      }
      bySku.get(key)!.levels.push(s.nivel);
    }
    const base: Record<string, string> = {};
    for (const [k, v] of bySku.entries()) {
      base[k] = formatLevelsToSisplanLocal(v.rua, v.pos, v.levels);
    }
    return base;
  }, []);

  // Initial Data Load (Local Snapshot -> IndexedDB -> Cloud -> Embedded Default)
  useEffect(() => {
    let mounted = true;

    const applyCsvAndSnapshot = (
      source: WmsPersistedSnapshot | string,
      savedMoved?: Record<string, MovedSkuEntry>,
      savedTrb?: TransbordoEntry[]
    ) => {
      let csvText = '';
      let skusFromSnap: SkuItem[] | undefined;
      let barraFromSnap: SkuItem[] | undefined;
      let movedFromSnap = savedMoved;
      let trbFromSnap = savedTrb;
      let rawCsvFromSnap = '';
      let perspectiveFromSnap: 'sku' | 'barra' | undefined;

      if (typeof source === 'object' && source !== null) {
        csvText = source.csv || '';
        skusFromSnap = source.skusData;
        barraFromSnap = source.barraItemsData;
        movedFromSnap = source.movedSkus || savedMoved;
        trbFromSnap = source.transbordo || savedTrb;
        rawCsvFromSnap = source.rawImportedCsv || '';
        perspectiveFromSnap = source.wmsPerspective;
      } else {
        csvText = source;
      }

      const initTrb: Record<string, TransbordoEntry> = {};
      for (const entry of EMBEDDED_TRANSBORDO_DATA) {
        initTrb[entry.wms] = { ...entry };
      }
      if (Array.isArray(trbFromSnap)) {
        for (const t of trbFromSnap) {
          if (t && t.wms) initTrb[t.wms] = t;
        }
      }

      // Restaura dados estruturados com quantidades intactas se presentes no snapshot
      if (Array.isArray(skusFromSnap) && skusFromSnap.length > 0) {
        if (!mounted) return;
        setSkus(skusFromSnap);
        setBarraItems(Array.isArray(barraFromSnap) ? barraFromSnap : []);
        setTransbordoRegistry(initTrb);
        if (movedFromSnap) setMovedSkusRegistry(movedFromSnap);
        setOriginalBaselineLocations(buildBaselineFromSkus(skusFromSnap));
        if (rawCsvFromSnap) setRawImportedCsv(rawCsvFromSnap);
        if (perspectiveFromSnap) setWmsPerspective(perspectiveFromSnap);
        return;
      }

      // Fallback para parse de CSV (que agora também preserva 8 colunas com total_pecas e locais_barras)
      const parsed = parseCsvData(csvText, [], [], initTrb, 'replace');
      if (!mounted) return;
      setSkus(parsed.skus);
      setBarraItems(parsed.barraItems);
      setTransbordoRegistry(parsed.transbordoRegistry);
      if (movedFromSnap) setMovedSkusRegistry(movedFromSnap);
      setOriginalBaselineLocations(buildBaselineFromSkus(parsed.skus));
      if (rawCsvFromSnap) setRawImportedCsv(rawCsvFromSnap);
    };

    // 1. Synchronous load
    const syncSnap = loadLocalWmsSnapshotSync();
    if (syncSnap) {
      applyCsvAndSnapshot(syncSnap);
    } else {
      applyCsvAndSnapshot(EMBEDDED_SISPLAN_CSV);
    }

    // 2. Async IndexedDB & Cloud Pull
    (async () => {
      if (!syncSnap) {
        const idbRaw = await loadFromIndexedDB();
        if (idbRaw && mounted) {
          try {
            const parsedIdb = JSON.parse(idbRaw) as WmsPersistedSnapshot;
            if (parsedIdb) {
              applyCsvAndSnapshot(parsedIdb);
            }
          } catch {
            // ignore
          }
        }
      }

      const activeUrl = getSavedCloudSyncUrl();
      if (activeUrl) {
        setCloudStatus('syncing');
        setCloudStatusText('Sincronizando...');
        const cloudData = await pullStateFromCloud(activeUrl);
        if (!mounted) return;
        if (cloudData && cloudData.csv) {
          applyCsvAndSnapshot(cloudData.csv);
          setCloudStatus('ok');
          setCloudStatusText('Nuvem Conectada');
        } else {
          setCloudStatus('idle');
          setCloudStatusText('Nuvem Pronta');
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [buildBaselineFromSkus]);

  // Persist changes locally whenever skus, movedSkusRegistry, or transbordoRegistry change
  const persistCurrentState = useCallback(
    (
      nextSkus: SkuItem[],
      nextMoved: Record<string, MovedSkuEntry>,
      nextTrb: Record<string, TransbordoEntry>,
      nextBarraOrPushCloud: SkuItem[] | boolean = barraItems,
      customRawCsv?: string,
      pushCloud = true
    ) => {
      let actualBarra: SkuItem[] = barraItems;
      let actualPushCloud = pushCloud;
      if (typeof nextBarraOrPushCloud === 'boolean') {
        actualPushCloud = nextBarraOrPushCloud;
        actualBarra = barraItems;
      } else if (Array.isArray(nextBarraOrPushCloud)) {
        actualBarra = nextBarraOrPushCloud;
      }
      const rawCsvToUse = customRawCsv !== undefined ? customRawCsv : rawImportedCsv;
      const csvStr = saveWmsStateLocally(
        nextSkus,
        nextMoved,
        nextTrb,
        actualBarra,
        rawCsvToUse,
        wmsPerspective
      );
      if (actualPushCloud && cloudSyncUrl) {
        setCloudStatus('syncing');
        setCloudStatusText('Salvando Nuvem...');
        pushStateToCloud(cloudSyncUrl, csvStr).then(ok => {
          setCloudStatus(ok ? 'ok' : 'error');
          setCloudStatusText(ok ? 'Salvo na Nuvem' : 'Salvo Localmente');
        });
      }
    },
    [barraItems, rawImportedCsv, wmsPerspective, cloudSyncUrl]
  );

  // Manual save trigger
  const executeManualSave = useCallback(() => {
    setIsAutoSaving(true);
    try {
      const csvStr = saveWmsStateLocally(
        skus,
        movedSkusRegistry,
        transbordoRegistry,
        barraItems,
        rawImportedCsv,
        wmsPerspective
      );
      const now = new Date();
      setLastSavedTimestamp(now);
      setAutoSaveCountdown(autoSaveIntervalSeconds);
      playMacSound('success', soundEnabled);
      if (cloudSyncUrl) {
        setCloudStatus('syncing');
        pushStateToCloud(cloudSyncUrl, csvStr).then(ok => {
          setCloudStatus(ok ? 'ok' : 'error');
          setCloudStatusText(ok ? 'Salvo na Nuvem' : 'Salvo Localmente');
        });
      }
      showToast(
        'Progresso Salvo com Sucesso',
        `Gravado às ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} com quantidades de peças preservadas.`,
        '💾'
      );
    } catch (err) {
      console.error('Falha ao salvar progresso:', err);
      showToast('Erro ao Salvar', 'Não foi possível gravar os dados localmente.', '⚠️');
    } finally {
      setTimeout(() => setIsAutoSaving(false), 500);
    }
  }, [skus, movedSkusRegistry, transbordoRegistry, barraItems, rawImportedCsv, wmsPerspective, autoSaveIntervalSeconds, soundEnabled, cloudSyncUrl, showToast]);

  // Save and safe page reload
  const executeSaveAndReload = useCallback(() => {
    setIsAutoSaving(true);
    saveWmsStateLocally(
      skus,
      movedSkusRegistry,
      transbordoRegistry,
      barraItems,
      rawImportedCsv,
      wmsPerspective
    );
    setLastSavedTimestamp(new Date());
    playMacSound('success', soundEnabled);
    showToast('Progresso Salvo com Segurança', 'Recarregando página em 1 segundo...', '🔄');
    setTimeout(() => {
      window.location.reload();
    }, 900);
  }, [skus, movedSkusRegistry, transbordoRegistry, barraItems, rawImportedCsv, wmsPerspective, soundEnabled, showToast]);

  // Periodic Auto-Save interval (~2 minutes countdown)
  useEffect(() => {
    if (!isAutoSaveEnabled) return;

    const timerId = setInterval(() => {
      setAutoSaveCountdown(prev => {
        if (prev <= 1) {
          // Execute auto-save cycle
          try {
            const csvStr = saveWmsStateLocally(
              skus,
              movedSkusRegistry,
              transbordoRegistry,
              barraItems,
              rawImportedCsv,
              wmsPerspective
            );
            const now = new Date();
            setLastSavedTimestamp(now);

            if (cloudSyncUrl && (autoRefreshMode === 'save_and_sync' || cloudStatus === 'ok')) {
              setCloudStatus('syncing');
              pushStateToCloud(cloudSyncUrl, csvStr).then(ok => {
                setCloudStatus(ok ? 'ok' : 'error');
                setCloudStatusText(ok ? 'Salvo na Nuvem' : 'Salvo Localmente');
              });
            }

            if (autoRefreshMode === 'save_and_reload') {
              showToast('Auto-Salvamento Realizado', 'Recarregando página conforme configurado...', '🔄');
              setTimeout(() => {
                window.location.reload();
              }, 1100);
            } else {
              showToast(
                'Progresso Salvo Automaticamente',
                `Ciclo de ${Math.round(autoSaveIntervalSeconds / 60)} min concluído às ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`,
                '💾'
              );
            }
          } catch (err) {
            console.error('Falha no ciclo de auto-salvamento:', err);
          }
          return autoSaveIntervalSeconds;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerId);
  }, [
    isAutoSaveEnabled,
    autoSaveIntervalSeconds,
    autoRefreshMode,
    skus,
    movedSkusRegistry,
    transbordoRegistry,
    barraItems,
    rawImportedCsv,
    wmsPerspective,
    cloudSyncUrl,
    cloudStatus,
    showToast
  ]);

  // Page unload safety listener (guarantees latest state is saved on refresh/close)
  useEffect(() => {
    const handleBeforeUnload = () => {
      saveWmsStateLocally(
        skus,
        movedSkusRegistry,
        transbordoRegistry,
        barraItems,
        rawImportedCsv,
        wmsPerspective
      );
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [skus, movedSkusRegistry, transbordoRegistry, barraItems, rawImportedCsv, wmsPerspective]);

  // Global Cmd+S / Ctrl+S shortcut to save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        executeManualSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [executeManualSave]);

  // Active items according to perspective (`sku` vs `barra`)
  const activeItems = useMemo(() => {
    if (wmsPerspective === 'barra' && barraItems.length > 0) {
      return barraItems;
    }
    return skus;
  }, [wmsPerspective, barraItems, skus]);

  // Address Map: wms -> SkuItem[] (including Transbordo virtual items)
  const addressMap = useMemo(() => {
    const map = new Map<string, SkuItem[]>();
    for (const item of activeItems) {
      const list = map.get(item.wms) || [];
      list.push(item);
      map.set(item.wms, list);
    }

    for (const [wmsKey, trb] of Object.entries(transbordoRegistry)) {
      const dec = decodeSkuPrefix(trb.code);
      const virtualItem: SkuItem = {
        id: `transbordo-${wmsKey}`,
        code: trb.code,
        codigoBase: dec.dMarca + dec.dEtiqueta + dec.dGrupo + dec.modelSeq,
        name: `⚡ TRANSBORDO • ${dec.autoName}`,
        brand: dec.marca,
        label: dec.etiqueta,
        groupCode: dec.dGrupo,
        groupName: dec.grupo,
        colorCode: dec.colorCode,
        colorName: dec.colorName,
        colorHex: '#FACC15',
        size: dec.size,
        deposito: trb.deposito || '2',
        rua: trb.rua,
        pos: trb.pos,
        nivel: trb.nivel,
        wms: wmsKey,
        rawLocal: `${wmsKey} (TRANSBORDO)`,
        colecao: isReservedCol35Street(trb.rua) ? '35' : 'Geral',
        qty: 1,
        icon: '⚡',
        isTransbordo: true,
        transbordoNote: trb.note || 'Excedente > 6 colmeias (Mini Pulmão)',
        transbordoCreatedAt: trb.createdAt
      };
      const list = map.get(wmsKey) || [];
      if (!list.some(i => i.isTransbordo)) {
        list.unshift(virtualItem);
      }
      map.set(wmsKey, list);
    }
    return map;
  }, [activeItems, transbordoRegistry]);

  // Conflict & Multi-level analysis
  const conflictAnalysis = useMemo(() => {
    const overlappedSlots = new Set<string>();
    const skuTowersMap = new Map<string, Set<string>>();
    const splitSkus = new Set<string>();
    const splitSkuSlots = new Set<string>();
    const invaderSlots = new Set<string>();
    const lowStockSlots = new Set<string>();

    for (const [wmsKey, items] of addressMap.entries()) {
      const nonTrb = items.filter(i => !i.isTransbordo);
      const uniqueCodes = new Set(nonTrb.map(i => getCanonicalSkuKey(i.code)));
      if (uniqueCodes.size > 1) {
        overlappedSlots.add(wmsKey);
      }
      if (nonTrb.some(i => i.isOutsideRegisteredLocal)) {
        invaderSlots.add(wmsKey);
      }
      const totalQty = nonTrb.reduce(
        (acc, it) => acc + (typeof it.qty === 'number' ? it.qty : 1),
        0
      );
      if (nonTrb.length > 0 && totalQty > 0 && totalQty < 5) {
        lowStockSlots.add(wmsKey);
      }
    }

    for (const item of skus) {
      if (item.isTransbordo || isPulmaoStreet(item.rua)) continue;
      const key = getCanonicalSkuKey(item.code);
      const tower = `${item.rua}.${String(item.pos).padStart(3, '0')}`;
      if (!skuTowersMap.has(key)) skuTowersMap.set(key, new Set());
      skuTowersMap.get(key)!.add(tower);
    }

    for (const [skuKey, towers] of skuTowersMap.entries()) {
      if (towers.size > 1) {
        splitSkus.add(skuKey);
      }
    }

    if (splitSkus.size > 0) {
      for (const item of skus) {
        if (splitSkus.has(getCanonicalSkuKey(item.code))) {
          splitSkuSlots.add(item.wms);
        }
      }
    }

    const allConflictSlots = new Set<string>([...overlappedSlots, ...splitSkuSlots]);

    return {
      overlappedSlots,
      splitSkus,
      splitSkuSlots,
      allConflictSlots,
      invaderSlots,
      lowStockSlots
    };
  }, [addressMap, skus]);

  // Street statistics for Macro Strip & KPIs
  const streetStats = useMemo(() => {
    const stats: Record<
      string,
      { total: number; occupied: number; free: number; conflicts: number; transbordo: number; pct: number }
    > = {};
    let grandTotalSlots = 0;
    let grandOccupiedSlots = 0;

    for (const rua of STREETS) {
      const total = getTotalSlotsForStreet(rua);
      let occupied = 0;
      let conflicts = 0;
      let transbordo = 0;

      const positions = getValidPositionsForStreet(rua);
      for (const pos of positions) {
        const maxLv = getMaxLevelsForStreet(rua, pos);
        for (let lv = 1; lv <= maxLv; lv++) {
          const wms = formatWmsAddress(rua, pos, lv);
          const items = addressMap.get(wms) || [];
          if (items.length > 0) occupied++;
          if (conflictAnalysis.allConflictSlots.has(wms)) conflicts++;
          if (transbordoRegistry[wms]) transbordo++;
        }
      }

      const free = Math.max(0, total - occupied);
      const pct = total > 0 ? Math.round((occupied / total) * 100) : 0;
      stats[rua] = { total, occupied, free, conflicts, transbordo, pct };
      grandTotalSlots += total;
      grandOccupiedSlots += occupied;
    }

    return {
      byStreet: stats,
      grandTotalSlots,
      grandOccupiedSlots,
      grandFreeSlots: Math.max(0, grandTotalSlots - grandOccupiedSlots)
    };
  }, [addressMap, conflictAnalysis, transbordoRegistry]);

  // Visible streets in Macro Strip
  const visibleMacroStreets = useMemo(() => {
    if (macroSectorFilter === 'acessorios') {
      return STREETS.filter(r => isAccessoriesStreet(r));
    }
    if (macroSectorFilter === 'pulmao') {
      return STREETS.filter(r => isPulmaoStreet(r));
    }
    return STREETS.filter(r => !isAccessoriesStreet(r) && !isPulmaoStreet(r));
  }, [macroSectorFilter]);

  // Helper to get all sibling items of a SKU
  const getSkuMultiLevelInfo = useCallback(
    (skuItem: SkuItem) => {
      const key = getCanonicalSkuKey(skuItem.code);
      const siblingItems = skus
        .filter(s => !s.isTransbordo && getCanonicalSkuKey(s.code) === key)
        .sort((a, b) => a.nivel - b.nivel);
      const levels = siblingItems.map(s => s.nivel);
      return {
        skuKey: key,
        siblingItems: siblingItems.length > 0 ? siblingItems : [skuItem],
        levels: levels.length > 0 ? levels : [skuItem.nivel],
        requiredLevels: Math.max(1, siblingItems.length),
        groupedWms: formatLevelsToSisplanLocal(
          skuItem.rua,
          skuItem.pos,
          levels.length > 0 ? levels : [skuItem.nivel]
        )
      };
    },
    [skus]
  );

  // Record moved SKU for Drag & Drop / Relocate batch export
  const recordSkuMoved = useCallback(
    (
      sku: SkuItem,
      oldLocalFallback: string,
      newLocalStr: string,
      source: 'drag' | 'relocate' | 'modal',
      currentMoved: Record<string, MovedSkuEntry>
    ): { nextMoved: Record<string, MovedSkuEntry>; staysMoved: boolean } => {
      const skuKey = getCanonicalSkuKey(sku.code);
      const baselineLocal = originalBaselineLocations[skuKey] || oldLocalFallback;
      const dec = decodeSkuPrefix(sku.code);
      const nextMoved = { ...currentMoved };

      const normOld = baselineLocal.replace(/\s+/g, '').toUpperCase();
      const normNew = newLocalStr.replace(/\s+/g, '').toUpperCase();

      if (normOld === normNew) {
        delete nextMoved[skuKey];
        return { nextMoved, staysMoved: false };
      }

      nextMoved[skuKey] = {
        skuKey,
        code: sku.code,
        codigoBase: sku.codigoBase || dec.dMarca + dec.dEtiqueta + dec.dGrupo + dec.modelSeq,
        colorCode: sku.colorCode || dec.colorCode,
        size: sku.size || dec.size,
        deposito: sku.deposito || '2',
        oldLocal: baselineLocal,
        newLocal: newLocalStr,
        movedAt: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        source,
        name: sku.name || dec.autoName
      };
      return { nextMoved, staysMoved: true };
    },
    [originalBaselineLocations]
  );

  // Suggest free multi-level column in a street
  const findMultiLevelFreeColumnInStreet = useCallback(
    (rua: string, neededLevels: number, startPos = 1, excludeIds = new Set<string>()) => {
      const positions = getValidPositionsForStreet(rua);
      if (positions.length === 0) return null;

      const sortedPos = [
        ...positions.filter(p => p >= startPos),
        ...positions.filter(p => p < startPos)
      ];

      for (const pos of sortedPos) {
        const maxLv = getMaxLevelsForStreet(rua, pos);
        if (maxLv < neededLevels) continue;
        const freeLvls: number[] = [];
        for (let lv = 1; lv <= maxLv; lv++) {
          const wms = formatWmsAddress(rua, pos, lv);
          const occ = (addressMap.get(wms) || []).filter(it => !excludeIds.has(it.id));
          if (occ.length === 0 && !transbordoRegistry[wms]) {
            freeLvls.push(lv);
          }
        }
        if (freeLvls.length >= neededLevels) {
          const chosen = pickBestLevelsInColumn(freeLvls, neededLevels);
          return {
            rua,
            pos,
            levels: chosen,
            wms: formatWmsAddress(rua, pos, chosen[0]),
            formattedLocal: formatLevelsToSisplanLocal(rua, pos, chosen)
          };
        }
      }
      return null;
    },
    [addressMap, transbordoRegistry]
  );

  // Select street helper
  const selectStreet = useCallback((rua: string) => {
    setSelectedStreet(rua);
    const validPos = getValidPositionsForStreet(rua);
    const firstPos = validPos[0] || 1;
    setSelectedAddressKey(formatWmsAddress(rua, firstPos, 1));
    if (isAccessoriesStreet(rua)) setMacroSectorFilter('acessorios');
    else if (isPulmaoStreet(rua)) setMacroSectorFilter('pulmao');
    else setMacroSectorFilter('ruas_all');
  }, []);

  // Jump directly to the exact slot of the conflict
  const navigateToConflict = useCallback((conflictSlotList?: string[]) => {
    const list = conflictSlotList && conflictSlotList.length > 0
      ? conflictSlotList
      : Array.from(conflictAnalysis.allConflictSlots);

    if (list.length === 0) {
      playMacSound('success', soundEnabled);
      showToast('Nenhum Conflito Encontrado', 'Todas as posições estão em conformidade!', '✅');
      return;
    }

    // Procura o próximo conflito ou o primeiro da lista
    const currentIdx = list.indexOf(selectedAddressKey);
    const nextSlot = currentIdx !== -1 && currentIdx + 1 < list.length ? list[currentIdx + 1] : list[0];
    const parsed = parseAddressString(nextSlot);
    if (!parsed) return;

    if (isAccessoriesStreet(parsed.rua)) setMacroSectorFilter('acessorios');
    else if (isPulmaoStreet(parsed.rua)) setMacroSectorFilter('pulmao');
    else setMacroSectorFilter('ruas_all');

    setSelectedStreet(parsed.rua);
    setSelectedAddressKey(parsed.wms);
    setOccupancyFilter('OVERLAPPED');
    setSelectedRangeId('ALL-OCCUPIED');

    const items = addressMap.get(parsed.wms) || [];
    if (items.length > 0) {
      setSelectedSkuId(items[0].id);
    }

    playMacSound('alert', soundEnabled);
    showToast(
      `🚨 Conflito em ${parsed.wms}`,
      items.length > 1
        ? `${items.length} SKUs sobrepostos no mesmo endereço físico!`
        : `SKU dividido em mais de uma torre/rua.`,
      '🚨'
    );
  }, [conflictAnalysis.allConflictSlots, selectedAddressKey, soundEnabled, showToast, addressMap]);

  // Filtered positions & slots for the current street/search/filters
  const filteredViewData = useMemo(() => {
    const q = searchQuery.trim().toUpperCase();
    const isGlobalSearch = q.length >= 2;

    const rangeObj = ADDRESS_RANGES.find(r => r.id === selectedRangeId) || ADDRESS_RANGES[0];
    const targetStreets = isGlobalSearch ? STREETS : [selectedStreet];

    const slots: {
      rua: string;
      pos: number;
      nivel: number;
      wms: string;
      items: SkuItem[];
      isConflict: boolean;
      isInvader: boolean;
      isLowStock: boolean;
      isTransbordo: boolean;
    }[] = [];

    for (const rua of targetStreets) {
      if (collectionFilter === '35' && !isReservedCol35Street(rua)) continue;
      if (collectionFilter === 'ACESSORIOS' && !isAccessoriesStreet(rua)) continue;
      if (collectionFilter === 'PULMAO' && !isPulmaoStreet(rua)) continue;

      const validPositions = getValidPositionsForStreet(rua);
      for (const pos of validPositions) {
        if (!isGlobalSearch && selectedRangeId !== 'ALL' && selectedRangeId !== 'ALL-OCCUPIED') {
          if (pos < rangeObj.start || pos > rangeObj.end) continue;
        }

        const maxLv = getMaxLevelsForStreet(rua, pos);
        for (let lv = 1; lv <= maxLv; lv++) {
          if (selectedLevel !== 'ALL' && String(lv) !== selectedLevel) continue;

          const wms = formatWmsAddress(rua, pos, lv);
          const items = addressMap.get(wms) || [];
          const isOccupied = items.length > 0;

          if (!isGlobalSearch && selectedRangeId === 'ALL-OCCUPIED' && !isOccupied) continue;

          const isConflict = conflictAnalysis.allConflictSlots.has(wms);
          const isInvader = conflictAnalysis.invaderSlots.has(wms);
          const isLowStock = conflictAnalysis.lowStockSlots.has(wms);
          const isTransbordo = Boolean(transbordoRegistry[wms]);

          if (occupancyFilter === 'OCCUPIED' && !isOccupied) continue;
          if (occupancyFilter === 'FREE' && isOccupied) continue;
          if (occupancyFilter === 'OVERLAPPED' && !isConflict) continue;
          if (occupancyFilter === 'OUTSIDE_LOCAL' && !isInvader) continue;
          if (occupancyFilter === 'LOW_STOCK_LT5' && !isLowStock) continue;
          if (occupancyFilter === 'TRANSBORDO' && !isTransbordo) continue;

          if (collectionFilter === '51') {
            if (!items.some(it => it.colecao === '51')) continue;
          }

          if (isGlobalSearch) {
            const matchWms = wms.toUpperCase().includes(q);
            const matchItem = items.some(
              it =>
                it.code.toUpperCase().includes(q) ||
                it.name.toUpperCase().includes(q) ||
                it.colorName.toUpperCase().includes(q) ||
                it.groupName.toUpperCase().includes(q) ||
                (it.localCadastroRaw && it.localCadastroRaw.toUpperCase().includes(q))
            );
            if (!matchWms && !matchItem) continue;
          }

          slots.push({
            rua,
            pos,
            nivel: lv,
            wms,
            items,
            isConflict,
            isInvader,
            isLowStock,
            isTransbordo
          });
        }
      }
    }

    return { slots, isGlobalSearch, rangeObj };
  }, [
    searchQuery,
    selectedRangeId,
    selectedStreet,
    selectedLevel,
    occupancyFilter,
    collectionFilter,
    addressMap,
    conflictAnalysis,
    transbordoRegistry
  ]);

  // Currently inspected slot details
  const inspectedSlot = useMemo(() => {
    const parsed = parseAddressString(selectedAddressKey) || {
      rua: selectedStreet,
      pos: 1,
      nivel: 1,
      wms: formatWmsAddress(selectedStreet, 1, 1)
    };
    const items = addressMap.get(parsed.wms) || [];
    const trbEntry = transbordoRegistry[parsed.wms] || null;
    const maxLv = getMaxLevelsForStreet(parsed.rua, parsed.pos);
    return { parsed, items, trbEntry, maxLv };
  }, [selectedAddressKey, selectedStreet, addressMap, transbordoRegistry]);

  // Keep Pulmão inputs synced when selecting a Pulmão slot
  useEffect(() => {
    if (isPulmaoStreet(inspectedSlot.parsed.rua)) {
      const first = inspectedSlot.items[0];
      setPulmaoTempNote(first ? first.name : 'Armazenamento Temporário (Pulmão)');
      setPulmaoTempQty(first ? first.qty || 1 : 1);
    }
  }, [inspectedSlot]);

  // Nearby Free and Occupied Slots for 1-Click Inspector Relocation
  const nearbyFreeSlots = useMemo(() => {
    if (!inspectedSlot.parsed) return [];
    const list: string[] = [];
    const rua = inspectedSlot.parsed.rua;
    const pos = inspectedSlot.parsed.pos;
    const curWms = inspectedSlot.parsed.wms;
    const maxLv = getMaxLevelsForStreet(rua, pos);

    // 1. Same tower
    for (let lv = 1; lv <= maxLv; lv++) {
      const w = formatWmsAddress(rua, pos, lv);
      if (w !== curWms && (addressMap.get(w) || []).length === 0 && !transbordoRegistry[w]) {
        list.push(w);
        if (list.length >= 4) return list;
      }
    }

    // 2. Adjacent towers in same street
    for (let delta = 1; delta <= 25; delta++) {
      for (const p of [pos + delta, pos - delta]) {
        if (p >= 1 && isValidPositionInStreet(rua, p)) {
          const lvCount = getMaxLevelsForStreet(rua, p);
          for (let lv = 1; lv <= lvCount; lv++) {
            const w = formatWmsAddress(rua, p, lv);
            if ((addressMap.get(w) || []).length === 0 && !transbordoRegistry[w]) {
              list.push(w);
              if (list.length >= 4) return list;
            }
          }
        }
      }
    }
    return list;
  }, [inspectedSlot.parsed, addressMap, transbordoRegistry]);

  const nearbyOccupiedSlots = useMemo(() => {
    if (!inspectedSlot.parsed) return [];
    const list: { wms: string; skuCode: string; qty: number }[] = [];
    const rua = inspectedSlot.parsed.rua;
    const pos = inspectedSlot.parsed.pos;
    const curWms = inspectedSlot.parsed.wms;

    for (let delta = 0; delta <= 20; delta++) {
      for (const p of delta === 0 ? [pos] : [pos + delta, pos - delta]) {
        if (p >= 1 && isValidPositionInStreet(rua, p)) {
          const lvCount = getMaxLevelsForStreet(rua, p);
          for (let lv = 1; lv <= lvCount; lv++) {
            const w = formatWmsAddress(rua, p, lv);
            if (w !== curWms) {
              const items = addressMap.get(w) || [];
              if (items.length > 0 && !items[0].isTransbordo) {
                list.push({
                  wms: w,
                  skuCode: items[0].code.split(' - ')[0],
                  qty: items[0].qty || 1
                });
                if (list.length >= 4) return list;
              }
            }
          }
        }
      }
    }
    return list;
  }, [inspectedSlot.parsed, addressMap]);

  // Ação Rápida 1: Mover para Vazio
  const handleQuickMoveToEmpty = (activeItem: SkuItem, destWmsStr: string) => {
    const parsedDest = parseAddressString(destWmsStr);
    if (!parsedDest) {
      playMacSound('alert', soundEnabled);
      showToast('Endereço Inválido', `O endereço "${destWmsStr}" não é válido.`, '⚠️');
      return;
    }

    if (transbordoRegistry[parsedDest.wms]) {
      playMacSound('alert', soundEnabled);
      showToast('Destino Bloqueado', `O endereço ${parsedDest.wms} é um Mini Pulmão de Transbordo.`, '⚡');
      return;
    }

    const existingDest = (addressMap.get(parsedDest.wms) || []).filter(i => i.id !== activeItem.id);
    if (existingDest.length > 0) {
      playMacSound('alert', soundEnabled);
      showToast('Destino Ocupado', `${parsedDest.wms} já possui SKU. Para permutar posições, use "Trocar c/ Destino".`, '⚠️');
      return;
    }

    const oldRaw = activeItem.rawLocal || activeItem.wms;
    const nextSkus = skus.map(item => {
      if (item.id !== activeItem.id) return item;
      return {
        ...item,
        lastRelocatedFrom: item.wms,
        rua: parsedDest.rua,
        pos: parsedDest.pos,
        nivel: parsedDest.nivel,
        wms: parsedDest.wms,
        rawLocal: parsedDest.wms,
        colecao: isReservedCol35Street(parsedDest.rua) ? '35' : item.colecao
      };
    });

    const nextBarra = barraItems.map(item => {
      if (item.id !== activeItem.id) return item;
      return {
        ...item,
        lastRelocatedFrom: item.wms,
        rua: parsedDest.rua,
        pos: parsedDest.pos,
        nivel: parsedDest.nivel,
        wms: parsedDest.wms,
        localAtualRaw: parsedDest.wms,
        isOutsideRegisteredLocal: item.localCadastroRaw ? !item.localCadastroRaw.includes(parsedDest.wms) : false,
        colecao: isReservedCol35Street(parsedDest.rua) ? '35' : item.colecao
      };
    });

    const { nextMoved, staysMoved } = recordSkuMoved(
      activeItem,
      oldRaw,
      parsedDest.wms,
      'relocate',
      movedSkusRegistry
    );

    setSkus(nextSkus);
    setBarraItems(nextBarra);
    setMovedSkusRegistry(nextMoved);
    setSelectedStreet(parsedDest.rua);
    setSelectedAddressKey(parsedDest.wms);
    setSelectedSkuId(activeItem.id);
    persistCurrentState(nextSkus, nextMoved, transbordoRegistry, nextBarra);
    playMacSound(staysMoved ? 'success' : 'pop', soundEnabled);
    showToast(
      staysMoved ? 'SKU Movido p/ Vazio' : 'SKU Retornou ao Local Original',
      `${activeItem.code}: ${oldRaw} → ${parsedDest.wms}`,
      '📍'
    );
    setQuickActionPanel('none');
    setInteractiveTargetMode('none');
  };

  // Ação Rápida 2: Trocar com Destino (Permuta Direta)
  const handleSwapSlots = (skuA: SkuItem, destWmsStr: string) => {
    const parsedB = parseAddressString(destWmsStr);
    if (!parsedB) {
      playMacSound('alert', soundEnabled);
      showToast('Endereço Inválido', `O endereço "${destWmsStr}" não foi reconhecido.`, '⚠️');
      return;
    }

    if (transbordoRegistry[parsedB.wms]) {
      playMacSound('alert', soundEnabled);
      showToast('Destino Bloqueado', `O endereço ${parsedB.wms} é um Mini Pulmão de Transbordo.`, '⚡');
      return;
    }

    const itemsB = addressMap.get(parsedB.wms) || [];
    if (itemsB.length === 0) {
      handleQuickMoveToEmpty(skuA, parsedB.wms);
      return;
    }

    const skuB = itemsB[0];
    if (skuA.id === skuB.id || skuA.wms === skuB.wms) return;

    const wmsA = skuA.wms;
    const wmsB = skuB.wms;
    const parsedA = parseAddressString(wmsA)!;

    const nextSkus = skus.map(item => {
      if (item.id === skuA.id) {
        return {
          ...item,
          lastRelocatedFrom: wmsA,
          rua: parsedB.rua,
          pos: parsedB.pos,
          nivel: parsedB.nivel,
          wms: parsedB.wms,
          rawLocal: parsedB.wms,
          colecao: isReservedCol35Street(parsedB.rua) ? '35' : item.colecao
        };
      }
      if (item.id === skuB.id) {
        return {
          ...item,
          lastRelocatedFrom: wmsB,
          rua: parsedA.rua,
          pos: parsedA.pos,
          nivel: parsedA.nivel,
          wms: parsedA.wms,
          rawLocal: parsedA.wms,
          colecao: isReservedCol35Street(parsedA.rua) ? '35' : item.colecao
        };
      }
      return item;
    });

    const nextBarra = barraItems.map(item => {
      if (item.id === skuA.id) {
        return {
          ...item,
          lastRelocatedFrom: wmsA,
          rua: parsedB.rua,
          pos: parsedB.pos,
          nivel: parsedB.nivel,
          wms: parsedB.wms,
          localAtualRaw: parsedB.wms,
          isOutsideRegisteredLocal: item.localCadastroRaw ? !item.localCadastroRaw.includes(parsedB.wms) : false,
          colecao: isReservedCol35Street(parsedB.rua) ? '35' : item.colecao
        };
      }
      if (item.id === skuB.id) {
        return {
          ...item,
          lastRelocatedFrom: wmsB,
          rua: parsedA.rua,
          pos: parsedA.pos,
          nivel: parsedA.nivel,
          wms: parsedA.wms,
          localAtualRaw: parsedA.wms,
          isOutsideRegisteredLocal: item.localCadastroRaw ? !item.localCadastroRaw.includes(parsedA.wms) : false,
          colecao: isReservedCol35Street(parsedA.rua) ? '35' : item.colecao
        };
      }
      return item;
    });

    let curMoved = { ...movedSkusRegistry };
    const resA = recordSkuMoved(skuA, wmsA, parsedB.wms, 'relocate', curMoved);
    curMoved = resA.nextMoved;
    const resB = recordSkuMoved(skuB, wmsB, parsedA.wms, 'relocate', curMoved);
    curMoved = resB.nextMoved;

    setSkus(nextSkus);
    setBarraItems(nextBarra);
    setMovedSkusRegistry(curMoved);
    setSelectedStreet(parsedB.rua);
    setSelectedAddressKey(parsedB.wms);
    setSelectedSkuId(skuA.id);
    persistCurrentState(nextSkus, curMoved, transbordoRegistry, nextBarra);
    playMacSound('success', soundEnabled);
    showToast(
      'Troca Direta Realizada!',
      `${skuA.code.split(' - ')[0]} (${wmsA} ➔ ${wmsB}) ⇄ ${skuB.code.split(' - ')[0]} (${wmsB} ➔ ${wmsA})`,
      '⇄'
    );
    setQuickActionPanel('none');
    setInteractiveTargetMode('none');
  };

  // ============================================================================
  // ACTIONS: TRANSBORDO, PULMÃO, DRAG & DROP, MODALS, EXPORTS
  // ============================================================================
  const handleToggleTransbordoSlotSelection = (wmsKey: string) => {
    const occ = (addressMap.get(wmsKey) || []).filter(i => !i.isTransbordo);
    if (occ.length > 0 && !transbordoRegistry[wmsKey]) {
      playMacSound('alert', soundEnabled);
      showToast(
        'Colmeia Ocupada por SKU Fixo',
        `Selecione apenas colmeias livres para cadastrar como Transbordo.`,
        '⚠️'
      );
      return;
    }
    playMacSound('pop', soundEnabled);
    setTransbordoSelectedWms(prev =>
      prev.includes(wmsKey) ? prev.filter(k => k !== wmsKey) : [...prev, wmsKey]
    );
  };

  const registerColmeiasAsTransbordo = (wmsList: string[], rawSku: string, note: string) => {
    if (wmsList.length === 0) {
      playMacSound('alert', soundEnabled);
      showToast('Selecione ao menos 1 Colmeia', 'Clique nas colmeias livres no mapa.', '⚠️');
      return;
    }
    const cleanSku = formatCanonicalSkuDisplay(rawSku);
    if (!cleanSku) {
      playMacSound('alert', soundEnabled);
      showToast('Informe o SKU do Transbordo', 'Digite ou selecione o SKU que excedeu 6 colmeias.', '⚠️');
      return;
    }

    const nextTrb = { ...transbordoRegistry };
    for (const wms of wmsList) {
      const parsed = parseAddressString(wms);
      if (!parsed) continue;
      nextTrb[parsed.wms] = {
        wms: parsed.wms,
        rua: parsed.rua,
        pos: parsed.pos,
        nivel: parsed.nivel,
        code: cleanSku,
        deposito: '2',
        note: note.trim() || 'Excedente > 6 colmeias (Mini Pulmão)',
        createdAt: new Date().toISOString()
      };
    }

    setTransbordoRegistry(nextTrb);
    setTransbordoSelectedWms([]);
    setTransbordoSelectMode(false);
    persistCurrentState(skus, movedSkusRegistry, nextTrb);
    playMacSound('success', soundEnabled);
    showToast(
      `⚡ ${wmsList.length} Colmeia(s) Bloqueada(s) em Amarelo!`,
      `Transbordo do SKU ${cleanSku} salvo.`,
      '⚡'
    );
  };

  const releaseTransbordoColmeia = (wmsKey: string) => {
    const nextTrb = { ...transbordoRegistry };
    delete nextTrb[wmsKey];
    setTransbordoRegistry(nextTrb);
    persistCurrentState(skus, movedSkusRegistry, nextTrb);
    playMacSound('pop', soundEnabled);
    showToast(`Colmeia ${wmsKey} Liberada`, 'O bloqueio de Transbordo foi removido.', '🧹');
  };

  const releaseAllTransbordoForSku = (skuCode: string) => {
    const key = getCanonicalSkuKey(skuCode);
    const nextTrb = { ...transbordoRegistry };
    let removed = 0;
    for (const [w, entry] of Object.entries(nextTrb)) {
      if (getCanonicalSkuKey(entry.code) === key) {
        delete nextTrb[w];
        removed++;
      }
    }
    setTransbordoRegistry(nextTrb);
    persistCurrentState(skus, movedSkusRegistry, nextTrb);
    playMacSound('pop', soundEnabled);
    showToast(`${removed} Colmeias de Transbordo Liberadas`, `SKU ${skuCode}`, '🗑️');
  };

  // Pulmão Temporary Slot Toggle
  const togglePulmaoPosition = (
    rua: string,
    pos: number,
    nivel: number,
    noteOrNull: string | null,
    qty = 1
  ) => {
    const wms = formatWmsAddress(rua, pos, nivel);
    const filtered = skus.filter(s => s.wms !== wms);
    let nextSkus = filtered;

    if (noteOrNull !== null) {
      const newItem: SkuItem = {
        id: `pulmao-${wms}-${Date.now()}`,
        code: `PULMAO-${wms}`,
        codigoBase: 'PULMAO',
        name: noteOrNull.trim() || 'Armazenamento Temporário (Pulmão)',
        brand: 'Aero',
        label: 'Pulmão',
        groupCode: '33',
        groupName: 'Pulmão Temporário',
        colorCode: '407',
        colorName: 'Azul Índigo',
        colorHex: '#4F46E5',
        size: 'VOL',
        deposito: '2',
        rua,
        pos,
        nivel,
        wms,
        rawLocal: wms,
        colecao: 'Pulmão',
        qty: Math.max(1, Number(qty) || 1),
        icon: '📦'
      };
      nextSkus = [newItem, ...filtered];
    }

    setSkus(nextSkus);
    persistCurrentState(nextSkus, movedSkusRegistry, transbordoRegistry);
    playMacSound(noteOrNull !== null ? 'success' : 'pop', soundEnabled);
  };

  const setPulmaoTowerAllLevels = (
    rua: string,
    pos: number,
    occupy: boolean,
    note = 'Armazenamento Temporário (Pulmão)',
    qty = 1
  ) => {
    const maxLv = getMaxLevelsForStreet(rua, pos);
    const towerWmsSet = new Set<string>();
    for (let lv = 1; lv <= maxLv; lv++) {
      towerWmsSet.add(formatWmsAddress(rua, pos, lv));
    }

    let nextSkus = skus.filter(s => !towerWmsSet.has(s.wms));
    if (occupy) {
      const added: SkuItem[] = [];
      for (let lv = 1; lv <= maxLv; lv++) {
        const wms = formatWmsAddress(rua, pos, lv);
        added.push({
          id: `pulmao-${wms}-${Date.now()}-${lv}`,
          code: `PULMAO-${wms}`,
          codigoBase: 'PULMAO',
          name: note.trim() || 'Armazenamento Temporário (Pulmão)',
          brand: 'Aero',
          label: 'Pulmão',
          groupCode: '33',
          groupName: 'Pulmão Temporário',
          colorCode: '407',
          colorName: 'Azul Índigo',
          colorHex: '#4F46E5',
          size: 'VOL',
          deposito: '2',
          rua,
          pos,
          nivel: lv,
          wms,
          rawLocal: `${rua}.${String(pos).padStart(3, '0')}.1 - ${maxLv}`,
          colecao: 'Pulmão',
          qty: Math.max(1, Number(qty) || 1),
          icon: '📦'
        });
      }
      nextSkus = [...added, ...nextSkus];
    }

    setSkus(nextSkus);
    persistCurrentState(nextSkus, movedSkusRegistry, transbordoRegistry);
    playMacSound(occupy ? 'success' : 'pop', soundEnabled);
    showToast(
      occupy ? `Torre ${rua}.${String(pos).padStart(3, '0')} Ocupada` : `Torre ${rua}.${String(pos).padStart(3, '0')} Liberada`,
      `${maxLv} níveis atualizados no Pulmão Temporário.`,
      '📦'
    );
  };

  // Return invader SKU in Local Barra back to its registered Local Cadastro
  const returnBarraItemToRegisteredLocal = (invaderItem: SkuItem) => {
    const targetRaw = invaderItem.localCadastroRaw || invaderItem.rawLocal;
    const expanded = expandSisplanLocal(targetRaw);
    if (expanded.length === 0) {
      playMacSound('alert', soundEnabled);
      showToast('Local de Cadastro Inválido', `Não foi possível expandir ${targetRaw}`, '⚠️');
      return;
    }
    const targetAddr = expanded[0];
    const nextBarra = barraItems.map(b => {
      if (b.id === invaderItem.id) {
        return {
          ...b,
          rua: targetAddr.rua,
          pos: targetAddr.pos,
          nivel: targetAddr.nivel,
          wms: targetAddr.wms,
          localAtualRaw: targetRaw,
          isOutsideRegisteredLocal: false,
          qtdForaDoLocal: 0
        };
      }
      return b;
    });
    setBarraItems(nextBarra);
    persistCurrentState(skus, movedSkusRegistry, transbordoRegistry, nextBarra);
    playMacSound('success', soundEnabled);
    showToast(
      'Peça Devolvida ao Local Cadastrado',
      `${invaderItem.code} retornou para ${targetAddr.wms}`,
      '✅'
    );
  };

  // Drag & Drop handlers
  const handleDropOnStreet = (targetRua: string) => {
    if (!dragPayload) return;
    const sku = skus.find(s => s.id === dragPayload.skuId);
    setDragPayload(null);
    setDragOverKey(null);
    if (!sku) return;

    const multiInfo = getSkuMultiLevelInfo(sku);
    const excludeIds = new Set(multiInfo.siblingItems.map(s => s.id));
    const needLevels = Math.min(
      getMaxLevelsForStreet(targetRua),
      Math.max(1, multiInfo.siblingItems.length)
    );
    const suggestion = findMultiLevelFreeColumnInStreet(targetRua, needLevels, 1, excludeIds);
    if (!suggestion) {
      playMacSound('alert', soundEnabled);
      showToast(
        'Rua Sem Espaço Agrupado',
        `Não há coluna na Rua ${targetRua} com ${needLevels} nível(is) livre(s).`,
        '⚠️'
      );
      return;
    }

    const oldRaw = sku.rawLocal || sku.wms;
    const newRawLocal = suggestion.formattedLocal;
    const siblingIdSet = new Set(multiInfo.siblingItems.map(s => s.id));

    const nextSkus = skus.map(item => {
      if (!siblingIdSet.has(item.id)) return item;
      const idx = multiInfo.siblingItems.findIndex(s => s.id === item.id);
      const lv = suggestion.levels[idx] || suggestion.levels[0];
      return {
        ...item,
        lastRelocatedFrom: item.wms,
        rua: suggestion.rua,
        pos: suggestion.pos,
        nivel: lv,
        wms: formatWmsAddress(suggestion.rua, suggestion.pos, lv),
        rawLocal: newRawLocal,
        colecao: isReservedCol35Street(suggestion.rua) ? '35' : item.colecao
      };
    });

    const { nextMoved } = recordSkuMoved(sku, oldRaw, newRawLocal, 'drag', movedSkusRegistry);
    setSkus(nextSkus);
    setMovedSkusRegistry(nextMoved);
    selectStreet(suggestion.rua);
    setSelectedAddressKey(suggestion.wms);
    setSelectedSkuId(sku.id);
    persistCurrentState(nextSkus, nextMoved, transbordoRegistry);
    playMacSound('success', soundEnabled);
    showToast(
      `Arrastado p/ Rua ${suggestion.rua}`,
      `${sku.code} alocado em ${newRawLocal}`,
      '✋'
    );
  };

  const handleDropOnSlot = (destWms: string) => {
    if (!dragPayload) return;
    const payload = dragPayload;
    setDragPayload(null);
    setDragOverKey(null);

    const sku = skus.find(s => s.id === payload.skuId);
    if (!sku) return;

    const parsedDest = parseAddressString(destWms);
    if (!parsedDest) return;

    if (transbordoRegistry[parsedDest.wms]) {
      playMacSound('alert', soundEnabled);
      showToast(
        `🔒 Colmeia de Transbordo Protegida (${parsedDest.wms})!`,
        `Esta colmeia é um Mini Pulmão do SKU ${transbordoRegistry[parsedDest.wms].code}.`,
        '⚡'
      );
      return;
    }

    const multiInfo = getSkuMultiLevelInfo(sku);
    const isDifferentColOrStreet = parsedDest.rua !== sku.rua || parsedDest.pos !== sku.pos;

    if ((payload.mode === 'group' || isDifferentColOrStreet) && multiInfo.siblingItems.length > 1) {
      const maxLvDest = getMaxLevelsForStreet(parsedDest.rua, parsedDest.pos);
      const need = Math.min(maxLvDest, multiInfo.siblingItems.length);
      const excludeIds = new Set(multiInfo.siblingItems.map(s => s.id));
      const freeLvls: number[] = [];

      for (let lv = 1; lv <= maxLvDest; lv++) {
        const k = formatWmsAddress(parsedDest.rua, parsedDest.pos, lv);
        const occ = (addressMap.get(k) || []).filter(it => !excludeIds.has(it.id));
        if (occ.length === 0 && !transbordoRegistry[k]) freeLvls.push(lv);
      }

      let chosenLevels =
        freeLvls.length >= need
          ? pickBestLevelsInColumn(freeLvls, need)
          : Array.from({ length: need }, (_, idx) => Math.min(maxLvDest, idx + 1));

      if (freeLvls.includes(parsedDest.nivel) && !chosenLevels.includes(parsedDest.nivel)) {
        const others = freeLvls.filter(l => l !== parsedDest.nivel).slice(0, need - 1);
        chosenLevels = [parsedDest.nivel, ...others].sort((a, b) => a - b);
      }

      const newRawLocal = formatLevelsToSisplanLocal(parsedDest.rua, parsedDest.pos, chosenLevels);
      const oldRaw = sku.rawLocal || sku.wms;

      const nextSkus = skus.map(item => {
        if (!excludeIds.has(item.id)) return item;
        const idx = multiInfo.siblingItems.findIndex(s => s.id === item.id);
        const lv = chosenLevels[idx] || chosenLevels[0];
        return {
          ...item,
          lastRelocatedFrom: item.wms,
          rua: parsedDest.rua,
          pos: parsedDest.pos,
          nivel: lv,
          wms: formatWmsAddress(parsedDest.rua, parsedDest.pos, lv),
          rawLocal: newRawLocal,
          colecao: isReservedCol35Street(parsedDest.rua) ? '35' : item.colecao
        };
      });

      const { nextMoved, staysMoved } = recordSkuMoved(
        sku,
        oldRaw,
        newRawLocal,
        'drag',
        movedSkusRegistry
      );
      setSkus(nextSkus);
      setMovedSkusRegistry(nextMoved);
      setSelectedStreet(parsedDest.rua);
      setSelectedAddressKey(formatWmsAddress(parsedDest.rua, parsedDest.pos, chosenLevels[0]));
      setSelectedSkuId(sku.id);
      persistCurrentState(nextSkus, nextMoved, transbordoRegistry);
      playMacSound(staysMoved ? 'success' : 'pop', soundEnabled);
      showToast(
        staysMoved
          ? `SKU ${sku.code} Movido (${need} Níveis)`
          : `SKU Retornou ao Local Original`,
        `${oldRaw} → ${newRawLocal}`,
        staysMoved ? '✋' : '↩️'
      );
      return;
    }

    // Single level move
    if (parsedDest.wms === sku.wms) return;
    const oldRaw = sku.rawLocal || sku.wms;
    const skuKey = getCanonicalSkuKey(sku.code);

    const updatedSkus = skus.map(item => {
      if (item.id !== sku.id) return item;
      return {
        ...item,
        lastRelocatedFrom: item.wms,
        rua: parsedDest.rua,
        pos: parsedDest.pos,
        nivel: parsedDest.nivel,
        wms: parsedDest.wms
      };
    });

    const sameColLevels = updatedSkus
      .filter(
        s =>
          getCanonicalSkuKey(s.code) === skuKey &&
          s.rua === parsedDest.rua &&
          s.pos === parsedDest.pos
      )
      .map(s => s.nivel);
    const updatedRawLocal = formatLevelsToSisplanLocal(
      parsedDest.rua,
      parsedDest.pos,
      sameColLevels
    );

    const finalSkus = updatedSkus.map(item => {
      if (
        getCanonicalSkuKey(item.code) === skuKey &&
        item.rua === parsedDest.rua &&
        item.pos === parsedDest.pos
      ) {
        return { ...item, rawLocal: updatedRawLocal };
      }
      return item;
    });

    const { nextMoved, staysMoved } = recordSkuMoved(
      sku,
      oldRaw,
      updatedRawLocal,
      'drag',
      movedSkusRegistry
    );
    setSkus(finalSkus);
    setMovedSkusRegistry(nextMoved);
    setSelectedStreet(parsedDest.rua);
    setSelectedAddressKey(parsedDest.wms);
    setSelectedSkuId(sku.id);
    persistCurrentState(finalSkus, nextMoved, transbordoRegistry);
    playMacSound(staysMoved ? 'success' : 'pop', soundEnabled);
    showToast(
      staysMoved ? 'SKU Movido via Drag & Drop' : 'SKU Retornou ao Local Original',
      `${sku.code}: ${oldRaw} → ${updatedRawLocal}`,
      staysMoved ? '✋' : '↩️'
    );
  };

  // ============================================================================
  // CSV EXPORT HANDLERS
  // ============================================================================
  const exportCurrentMapCsv = (format: 'grouped' | 'flat') => {
    if (format === 'grouped') {
      const csv = buildSisplanCsvString(skus, transbordoRegistry);
      triggerCsvDownload(
        csv,
        `sisplan_wms_atualizado_${new Date().toISOString().slice(0, 10)}.csv`
      );
      playMacSound('success', soundEnabled);
      showToast('CSV SISPLAN Exportado', 'Formato agrupado CODIGO;COR;TAMANHO;DEPOSITO;LOCAL.', '📤');
    } else {
      const lines = ['RUA;ENDERECO;NIVEL;WMS;CODIGO;COR;TAMANHO;DEPOSITO;QTD'];
      for (const s of skus) {
        if (s.isTransbordo) continue;
        lines.push(
          `${s.rua};${s.pos};${s.nivel};${s.wms};${s.codigoBase};${s.colorCode};${s.size};${s.deposito};${s.qty}`
        );
      }
      triggerCsvDownload(
        lines.join('\n'),
        `wms_detalhado_por_nivel_${new Date().toISOString().slice(0, 10)}.csv`
      );
      playMacSound('success', soundEnabled);
      showToast('CSV Detalhado Exportado', '1 linha por nível exportada com sucesso.', '📤');
    }
  };

  const exportDraggedChangesCsv = (includeDePara: boolean) => {
    const entries = Object.values(movedSkusRegistry);
    if (entries.length === 0) {
      playMacSound('alert', soundEnabled);
      showToast('Nenhum SKU Movido', 'Arraste ou remaneje um SKU no mapa primeiro.', '⚠️');
      return;
    }

    if (includeDePara) {
      const lines = ['CODIGO;COR;TAMANHO;DEPOSITO;LOCAL_ANTERIOR;LOCAL_NOVO;HORA'];
      for (const e of entries) {
        lines.push(
          `${e.codigoBase};${e.colorCode};${e.size};${e.deposito};${e.oldLocal};${e.newLocal};${e.movedAt}`
        );
      }
      triggerCsvDownload(
        lines.join('\n'),
        `relatorio_de_para_arraste_${new Date().toISOString().slice(0, 10)}.csv`
      );
    } else {
      const lines = ['CODIGO;COR;TAMANHO;DEPOSITO;LOCAL'];
      for (const e of entries) {
        lines.push(`${e.codigoBase};${e.colorCode};${e.size};${e.deposito};${e.newLocal}`);
      }
      triggerCsvDownload(
        lines.join('\n'),
        `sisplan_lote_arrastados_${new Date().toISOString().slice(0, 10)}.csv`
      );
    }
    playMacSound('success', soundEnabled);
    showToast(
      `Exportado (${entries.length} SKUs Movidos)`,
      includeDePara ? 'Relatório De -> Para baixado.' : 'Formato SISPLAN pronto para importação.',
      '✋'
    );
  };

  const exportTransbordoCsv = () => {
    const list = Object.values(transbordoRegistry);
    if (list.length === 0) {
      playMacSound('alert', soundEnabled);
      showToast('Sem Colmeias de Transbordo', 'Nenhuma colmeia reservada no momento.', '⚠️');
      return;
    }
    const lines = ['COLMEIA_TRANSBORDO;SKU;DEPOSITO;OBSERVACAO;DATA_RESERVA'];
    for (const t of list) {
      lines.push(`${t.wms};${t.code};${t.deposito || '2'};${t.note};${t.createdAt}`);
    }
    triggerCsvDownload(
      lines.join('\n'),
      `colmeias_transbordo_${new Date().toISOString().slice(0, 10)}.csv`
    );
    playMacSound('success', soundEnabled);
    showToast(`${list.length} Colmeias de Transbordo Exportadas`, 'Arquivo CSV salvo.', '⚡');
  };

  const exportBarraInvadersGuideCsv = () => {
    const invaders = barraItems.filter(b => b.isOutsideRegisteredLocal);
    if (invaders.length === 0) {
      playMacSound('alert', soundEnabled);
      showToast('Sem SKUs Invasores', 'Nenhuma peça fora do local cadastrado na Aba Barra.', '✅');
      return;
    }
    const lines = ['CAIXA_ONDE_ESTA_AGORA;SKU_INVASOR;QTD_PECAS;GUARDAR_NO_LOCAL_CADASTRADO'];
    for (const inv of invaders) {
      lines.push(
        `${inv.wms};${inv.code};${inv.qtdForaDoLocal || inv.qty || 1};${inv.localCadastroRaw || inv.rawLocal}`
      );
    }
    triggerCsvDownload(
      lines.join('\n'),
      `guia_operador_skus_invasores_${new Date().toISOString().slice(0, 10)}.csv`
    );
    playMacSound('success', soundEnabled);
    showToast('Guia do Operador Exportado', `${invaders.length} desvios listados para correção.`, '📋');
  };

  // ============================================================================
  // OPEN SKU MODAL / RELOCATE MODAL HELPERS
  // ============================================================================
  const openAllocateOrEditSkuModal = (editItem?: SkuItem | null, defaultWms?: string) => {
    if (editItem) {
      const dec = decodeSkuPrefix(editItem.code);
      const multi = getSkuMultiLevelInfo(editItem);
      setSkuFormEditId(editItem.id);
      setSkuFormBrand(dec.dMarca);
      setSkuFormLabel(dec.dEtiqueta);
      setSkuFormGroup(dec.dGrupo);
      setSkuFormSeq(dec.modelSeq);
      setSkuFormColor(dec.colorCode);
      setSkuFormSize(dec.size);
      setSkuFormCode(editItem.code);
      setSkuFormDeposito(editItem.deposito || '2');
      setSkuFormName(editItem.name);
      setSkuFormRua(editItem.rua);
      setSkuFormPos(editItem.pos);
      setSkuFormSelectedLevels(multi.levels);
      setSkuFormQty(editItem.qty || 50);
      setSkuFormColecao(editItem.colecao || (isReservedCol35Street(editItem.rua) ? '35' : '51'));
    } else {
      const target = parseAddressString(defaultWms || selectedAddressKey) || {
        rua: selectedStreet,
        pos: 1,
        nivel: 1,
        wms: formatWmsAddress(selectedStreet, 1, 1)
      };
      setSkuFormEditId('');
      setSkuFormRua(target.rua);
      setSkuFormPos(target.pos);
      setSkuFormSelectedLevels([target.nivel]);
      setSkuFormColecao(isReservedCol35Street(target.rua) ? '35' : '51');
    }
    setShowSkuModal(true);
  };

  const openRelocateModalWithSku = (skuItem?: SkuItem | null) => {
    const target = skuItem || inspectedSlot.items.find(i => !i.isTransbordo) || skus[0] || null;
    if (target) {
      const multi = getSkuMultiLevelInfo(target);
      setRelocateSkuId(target.id);
      setRelocateSearchInput(target.code);
      setRelocateNewRua(target.rua);
      setRelocateNewPos(target.pos);
      setRelocateNewNivel(target.nivel);
      setRelocateMoveAllLevels(multi.requiredLevels > 1);
      setRelocateSelectedLevels(multi.levels);
    }
    setShowRelocateModal(true);
  };

  // Toggle level in Inspector for existing SKU
  const handleToggleSkuLevelInTower = (skuItem: SkuItem, levelToToggle: number) => {
    const multi = getSkuMultiLevelInfo(skuItem);
    const hasLevel = multi.levels.includes(levelToToggle);
    if (hasLevel && multi.levels.length <= 1) {
      playMacSound('alert', soundEnabled);
      showToast('Mínimo 1 Nível', 'Para remover totalmente o SKU, clique em Remover do Endereço.', '⚠️');
      return;
    }

    const targetWms = formatWmsAddress(skuItem.rua, skuItem.pos, levelToToggle);
    if (!hasLevel && transbordoRegistry[targetWms]) {
      playMacSound('alert', soundEnabled);
      showToast('Colmeia de Transbordo Protegida', `${targetWms} está bloqueada como Mini Pulmão.`, '⚡');
      return;
    }

    const nextLevels = hasLevel
      ? multi.levels.filter(l => l !== levelToToggle)
      : [...multi.levels, levelToToggle].sort((a, b) => a - b);

    const newRawLocal = formatLevelsToSisplanLocal(skuItem.rua, skuItem.pos, nextLevels);
    const ownIds = new Set(multi.siblingItems.map(s => s.id));
    const filtered = skus.filter(s => !ownIds.has(s.id));

    const recreated: SkuItem[] = nextLevels.map((lv, idx) => ({
      ...skuItem,
      id: idx === 0 ? skuItem.id : `sku-${Date.now()}-${lv}-${idx}`,
      nivel: lv,
      wms: formatWmsAddress(skuItem.rua, skuItem.pos, lv),
      rawLocal: newRawLocal
    }));

    const nextSkus = [...recreated, ...filtered];
    const { nextMoved } = recordSkuMoved(
      skuItem,
      skuItem.rawLocal || skuItem.wms,
      newRawLocal,
      'modal',
      movedSkusRegistry
    );
    setSkus(nextSkus);
    setMovedSkusRegistry(nextMoved);
    setSelectedAddressKey(formatWmsAddress(skuItem.rua, skuItem.pos, levelToToggle));
    persistCurrentState(nextSkus, nextMoved, transbordoRegistry);
    playMacSound('pop', soundEnabled);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowImportModal(false);
        setShowSkuModal(false);
        setShowRelocateModal(false);
        setShowCloudModal(false);
        setShowSpotlight(false);
        setShowAboutModal(false);
        setOpenMenu(null);
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowSpotlight(prev => !prev);
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        setShowImportModal(true);
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        openAllocateOrEditSkuModal(null);
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        openRelocateModalWithSku(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const movedCount = Object.keys(movedSkusRegistry).length;
  const transbordoCount = Object.keys(transbordoRegistry).length;

  return (
    <div
      className={`${WALLPAPERS[wallpaperIdx]} text-slate-900 dark:text-slate-100 h-full w-full overflow-hidden flex flex-col justify-between relative select-none`}
    >
      {/* ==================================================================== */}
      {/* TOP MACOS SEQUOIA MENUBAR                                            */}
      {/* ==================================================================== */}
      {!isFullscreen && (
        <header className="mac-menubar h-7 px-3 flex items-center justify-between text-xs font-medium z-40 shrink-0">
          <div className="flex items-center space-x-3 relative">
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                setOpenMenu(prev => (prev === 'apple' ? null : 'apple'));
              }}
              className="flex items-center space-x-1 hover:bg-black/10 dark:hover:bg-white/15 px-1.5 py-0.5 rounded transition"
            >
              <span className="text-sm">✈️</span>
            </button>

            <span className="font-display font-bold tracking-tight">EstoqueOS</span>

            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                setOpenMenu(prev => (prev === 'file' ? null : 'file'));
              }}
              className="hover:bg-black/10 dark:hover:bg-white/15 px-2 py-0.5 rounded transition"
            >
              Arquivo
            </button>
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                setOpenMenu(prev => (prev === 'view' ? null : 'view'));
              }}
              className="hover:bg-black/10 dark:hover:bg-white/15 px-2 py-0.5 rounded transition"
            >
              Visualizar
            </button>
            <button
              type="button"
              onClick={() => openAllocateOrEditSkuModal(null)}
              className="hover:bg-black/10 dark:hover:bg-white/15 px-2 py-0.5 rounded transition hidden sm:inline-block"
            >
              + Alocar SKU
            </button>
            <button
              type="button"
              onClick={() => openRelocateModalWithSku(null)}
              className="hover:bg-black/10 dark:hover:bg-white/15 px-2 py-0.5 rounded transition hidden md:inline-block text-amber-600 dark:text-amber-400 font-semibold"
            >
              ⇄ Remanejar SKU
            </button>
            <button
              type="button"
              onClick={() => setShowImportModal(true)}
              className="hover:bg-black/10 dark:hover:bg-white/15 px-2 py-0.5 rounded transition hidden md:inline-block text-emerald-600 dark:text-emerald-400 font-semibold"
            >
              📥 Importar CSV
            </button>
            <button
              type="button"
              onClick={() => setShowCloudModal(true)}
              className="hover:bg-black/10 dark:hover:bg-white/15 px-2 py-0.5 rounded transition hidden lg:inline-block text-mac-blue font-bold"
            >
              ☁️ Google Sites / Nuvem
            </button>

            {/* Apple Menu Dropdown */}
            {openMenu === 'apple' && (
              <div
                onClick={e => e.stopPropagation()}
                className="absolute left-0 top-7 w-64 mac-window rounded-xl p-1.5 shadow-2xl z-50 text-xs space-y-1"
              >
                <button
                  type="button"
                  onClick={() => {
                    setOpenMenu(null);
                    setShowAboutModal(true);
                  }}
                  className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-mac-blue hover:text-white transition flex items-center justify-between"
                >
                  <span>Sobre o EstoqueOS WMS</span>
                  <span className="text-[10px] opacity-75">v4.5 Google Sites</span>
                </button>
                <div className="border-t border-black/10 dark:border-white/10 my-1" />
                <button
                  type="button"
                  onClick={() => {
                    setOpenMenu(null);
                    setIsDark(d => !d);
                  }}
                  className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-mac-blue hover:text-white transition flex items-center justify-between"
                >
                  <span>Alternar Modo Claro / Escuro</span>
                  <span>🌓</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpenMenu(null);
                    setWallpaperIdx(i => (i + 1) % WALLPAPERS.length);
                  }}
                  className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-mac-blue hover:text-white transition flex items-center justify-between"
                >
                  <span>Trocar Wallpaper macOS</span>
                  <span>🖼️</span>
                </button>
                <div className="border-t border-black/10 dark:border-white/10 my-1" />
                <button
                  type="button"
                  onClick={() => {
                    setOpenMenu(null);
                    setSkus([]);
                    setBarraItems([]);
                    persistCurrentState([], movedSkusRegistry, transbordoRegistry, false);
                    showToast('Mapa WMS Limpo', 'Todas as posições voltaram ao status Livre.', '✈️');
                  }}
                  className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-rose-500 hover:text-white text-rose-500 transition flex items-center justify-between"
                >
                  <span>Limpar Todos os Endereços</span>
                  <span>🗑️</span>
                </button>
              </div>
            )}

            {/* File Menu Dropdown */}
            {openMenu === 'file' && (
              <div
                onClick={e => e.stopPropagation()}
                className="absolute left-20 top-7 w-72 mac-window rounded-xl p-1.5 shadow-2xl z-50 text-xs space-y-1"
              >
                <button
                  type="button"
                  onClick={() => {
                    setOpenMenu(null);
                    setShowImportModal(true);
                  }}
                  className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-mac-blue hover:text-white transition flex justify-between font-semibold text-emerald-500"
                >
                  <span>📥 Importar Planilha CSV...</span>
                  <span className="font-mono text-[10px] opacity-70">⌘O</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpenMenu(null);
                    openAllocateOrEditSkuModal(null);
                  }}
                  className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-mac-blue hover:text-white transition flex justify-between"
                >
                  <span>+ Alocar SKU em Endereço</span>
                  <span className="font-mono text-[10px] opacity-70">⌘N</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpenMenu(null);
                    openRelocateModalWithSku(null);
                  }}
                  className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-mac-blue hover:text-white transition flex justify-between text-amber-500 font-semibold"
                >
                  <span>⇄ Remanejar SKU de Endereço...</span>
                  <span className="font-mono text-[10px] opacity-70">⌘R</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpenMenu(null);
                    setTransbordoSelectMode(true);
                  }}
                  className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-yellow-500 hover:text-slate-950 transition flex justify-between text-yellow-600 dark:text-yellow-400 font-bold"
                >
                  <span>⚡ Selecionar Colmeias p/ Transbordo</span>
                  <span className="font-mono text-[10px] opacity-80">Mini Pulmão</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpenMenu(null);
                    exportTransbordoCsv();
                  }}
                  className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-yellow-500 hover:text-slate-950 transition flex justify-between text-yellow-600 dark:text-yellow-400 font-semibold"
                >
                  <span>📤 Exportar Colmeias Transbordo (.CSV)</span>
                  <span className="font-mono text-[10px] opacity-80">CSV</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpenMenu(null);
                    exportDraggedChangesCsv(false);
                  }}
                  className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-purple-600 hover:text-white transition flex justify-between text-purple-600 dark:text-purple-400 font-bold"
                >
                  <span>✋ Exportar Alterações de Arraste (SISPLAN)</span>
                  <span className="font-mono text-[10px] opacity-70">⌘D</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpenMenu(null);
                    exportDraggedChangesCsv(true);
                  }}
                  className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-purple-600 hover:text-white transition flex justify-between text-purple-500"
                >
                  <span>📋 Relatório De → Para (Arraste)</span>
                  <span className="font-mono text-[10px] opacity-70">CSV</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpenMenu(null);
                    exportBarraInvadersGuideCsv();
                  }}
                  className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-rose-600 hover:text-white transition flex justify-between text-rose-600 dark:text-rose-400 font-bold"
                >
                  <span>🚨 Guia Operador: SKUs Invasores (.CSV)</span>
                  <span className="font-mono text-[10px] opacity-80">BARRA</span>
                </button>
                <div className="border-t border-black/10 dark:border-white/10 my-1" />
                <button
                  type="button"
                  onClick={() => {
                    setOpenMenu(null);
                    executeManualSave();
                  }}
                  className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-blue-600 hover:text-white transition flex justify-between font-bold text-blue-600 dark:text-blue-400"
                >
                  <span className="flex items-center gap-1.5">
                    <span>💾</span>
                    <span>Salvar Progresso Agora</span>
                  </span>
                  <span className="font-mono text-[10px] opacity-80">⌘S</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpenMenu(null);
                    executeSaveAndReload();
                  }}
                  className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-blue-600 hover:text-white transition flex justify-between text-slate-700 dark:text-slate-200"
                >
                  <span className="flex items-center gap-1.5">
                    <span>🔄</span>
                    <span>Salvar & Recarregar Página</span>
                  </span>
                  <span className="font-mono text-[10px] opacity-70">Reload</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpenMenu(null);
                    setShowAutoSaveModal(true);
                  }}
                  className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-mac-blue hover:text-white transition flex justify-between text-slate-700 dark:text-slate-200"
                >
                  <span className="flex items-center gap-1.5">
                    <span>⚙️</span>
                    <span>Automação de Salvamento (2 min)</span>
                  </span>
                  <span className="font-mono text-[10px] opacity-75">{isAutoSaveEnabled ? 'Ativo' : 'Pausado'}</span>
                </button>
                <div className="border-t border-black/10 dark:border-white/10 my-1" />
                <button
                  type="button"
                  onClick={() => {
                    setOpenMenu(null);
                    setShowCloudModal(true);
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg bg-mac-blue/15 hover:bg-mac-blue hover:text-white transition flex justify-between font-extrabold text-mac-blue"
                >
                  <span>☁️ Sincronizar Google Sheets / Sites...</span>
                  <span className="font-mono text-[10px] opacity-80">Nuvem</span>
                </button>
                <div className="border-t border-black/10 dark:border-white/10 my-1" />
                <button
                  type="button"
                  onClick={() => {
                    setOpenMenu(null);
                    exportCurrentMapCsv('grouped');
                  }}
                  className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-mac-blue hover:text-white transition flex justify-between font-semibold"
                >
                  <span>📤 Exportar CSV Atualizado (SISPLAN)</span>
                  <span className="font-mono text-[10px] opacity-70">⌘E</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpenMenu(null);
                    exportCurrentMapCsv('flat');
                  }}
                  className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-mac-blue hover:text-white transition flex justify-between"
                >
                  <span>📄 Exportar CSV Detalhado (1 Nível/Linha)</span>
                  <span className="font-mono text-[10px] opacity-70">CSV</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpenMenu(null);
                    triggerCsvDownload(SAMPLE_CSV_DATA, 'modelo_sisplan_wms.csv');
                  }}
                  className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-mac-blue hover:text-white transition flex justify-between"
                >
                  <span>📋 Baixar Modelo CSV de Exemplo</span>
                  <span className="font-mono text-[10px] opacity-70">CSV</span>
                </button>
              </div>
            )}

            {/* View Menu Dropdown */}
            {openMenu === 'view' && (
              <div
                onClick={e => e.stopPropagation()}
                className="absolute left-36 top-7 w-64 mac-window rounded-xl p-1.5 shadow-2xl z-50 text-xs space-y-1"
              >
                <button
                  type="button"
                  onClick={() => {
                    setOpenMenu(null);
                    setMapMode('cards');
                  }}
                  className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-mac-blue hover:text-white transition"
                >
                  🃏 Modo Cards de Endereço (Colmeia)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpenMenu(null);
                    setMapMode('rack');
                  }}
                  className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-mac-blue hover:text-white transition"
                >
                  🏢 Modo Matriz Porta-Paletes (N1–N7)
                </button>
                <div className="border-t border-black/10 dark:border-white/10 my-1" />
                <button
                  type="button"
                  onClick={() => {
                    setOpenMenu(null);
                    setShowReportModal(true);
                  }}
                  className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-mac-blue hover:text-white transition flex items-center justify-between font-bold text-mac-blue"
                >
                  <span className="flex items-center gap-1.5">
                    <span>📊</span>
                    <span>Gerar Relatório</span>
                  </span>
                  <span className="font-mono text-[10px] opacity-75">D3 Analytics</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpenMenu(null);
                    setShowAuditModal(true);
                  }}
                  className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-mac-blue hover:text-white transition flex items-center justify-between font-bold text-rose-600 dark:text-rose-400 hover:text-white"
                >
                  <span className="flex items-center gap-1.5">
                    <span>📋</span>
                    <span>Auditoria de Inventário</span>
                  </span>
                  <span className="font-mono text-[9px] px-1.5 py-0.2 rounded-full bg-rose-500/20 text-rose-600 dark:text-rose-400 font-extrabold">
                    {conflictAnalysis.allConflictSlots.size + conflictAnalysis.invaderSlots.size} Alertas
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpenMenu(null);
                    setShowAutoSaveModal(true);
                  }}
                  className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-mac-blue hover:text-white transition flex items-center justify-between text-blue-600 dark:text-blue-400 font-semibold"
                >
                  <span className="flex items-center gap-1.5">
                    <span>💾</span>
                    <span>Status do Auto-Salvamento</span>
                  </span>
                  <span className="font-mono text-[10px] opacity-75">{Math.floor(autoSaveCountdown / 60)}m {autoSaveCountdown % 60}s</span>
                </button>
                <div className="border-t border-black/10 dark:border-white/10 my-1" />
                <button
                  type="button"
                  onClick={() => {
                    setOpenMenu(null);
                    setIsFullscreen(f => !f);
                  }}
                  className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-mac-blue hover:text-white transition flex items-center justify-between font-semibold text-mac-blue"
                >
                  <span>⛶ Modo Mapa Tela Cheia</span>
                  <span className="font-mono text-[10px] opacity-75">Foco 100%</span>
                </button>
              </div>
            )}
          </div>

          {/* Right Status Icons */}
          <div className="flex items-center space-x-2">
            {/* Auto-Save Status Pill Button */}
            <button
              type="button"
              onClick={() => setShowAutoSaveModal(true)}
              className="flex items-center space-x-1.5 px-2 py-0.5 rounded-md bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 text-blue-700 dark:text-blue-300 font-semibold transition text-[10px]"
              title="Automação de Salvamento a cada 2 minutos • Clique para gerenciar ou salvar/recarregar a página"
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isAutoSaving
                    ? 'bg-amber-400 animate-ping'
                    : isAutoSaveEnabled
                      ? 'bg-blue-500'
                      : 'bg-slate-400'
                }`}
              />
              <span className="font-mono hidden sm:inline">
                {isAutoSaveEnabled
                  ? `Auto-Save: ${String(Math.floor(autoSaveCountdown / 60)).padStart(2, '0')}:${String(autoSaveCountdown % 60).padStart(2, '0')}`
                  : 'Auto-Save: Pausado'}
              </span>
              <span className="sm:hidden font-mono">💾 2m</span>
            </button>

            <button
              type="button"
              onClick={() => setShowCloudModal(true)}
              className="flex items-center space-x-1.5 px-2 py-0.5 rounded-md bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-semibold transition"
              title="Sincronização em Tempo Real com Planilha Google / Exportar para Google Sites"
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  cloudStatus === 'syncing'
                    ? 'bg-amber-400 animate-ping'
                    : cloudStatus === 'error'
                      ? 'bg-rose-500'
                      : 'bg-emerald-500'
                }`}
              />
              <span className="text-[10px] hidden sm:inline">{cloudStatusText}</span>
            </button>

            <button
              type="button"
              onClick={() => setSoundEnabled(s => !s)}
              className="hover:bg-black/10 dark:hover:bg-white/15 px-1.5 py-0.5 rounded transition"
              title="Ativar/Desativar Sons do Sistema"
            >
              {soundEnabled ? '🔊' : '🔇'}
            </button>

            <button
              type="button"
              onClick={() => setShowSpotlight(true)}
              className="flex items-center space-x-1 hover:bg-black/10 dark:hover:bg-white/15 px-2 py-0.5 rounded transition"
              title="Spotlight Search (⌘K)"
            >
              <span>🔍</span>
              <span className="hidden md:inline text-[11px] opacity-80">Spotlight</span>
            </button>

            <button
              type="button"
              onClick={() => setShowReportModal(true)}
              className="flex items-center space-x-1.5 px-2.5 py-0.5 rounded-md bg-mac-blue/15 hover:bg-mac-blue/25 border border-mac-blue/30 text-mac-blue font-bold text-xs transition"
              title="Gerar Relatório de Ocupação & Tendências D3"
            >
              <span>📊</span>
              <span className="hidden md:inline text-[11px]">Relatório D3</span>
            </button>

            <button
              type="button"
              onClick={() => setIsDark(d => !d)}
              className="hover:bg-black/10 dark:hover:bg-white/15 px-1.5 py-0.5 rounded transition"
              title="Alternar Tema Claro/Escuro"
            >
              🌓
            </button>

            <span className="font-mono text-[11px] tracking-tight pl-1 hidden sm:inline">
              {clockText}
            </span>
          </div>
        </header>
      )}

      {/* ==================================================================== */}
      {/* MAIN WORKSPACE AREA                                                  */}
      {/* ==================================================================== */}
      <main
        className={`flex-1 flex flex-col items-center justify-center overflow-hidden min-h-0 relative ${
          isFullscreen ? 'p-0' : 'px-1.5 pt-1 pb-1 sm:px-2.5 sm:pt-1.5 sm:pb-1.5'
        }`}
      >
        <div
          className={`mac-window w-full h-full flex flex-col overflow-hidden relative ${
            isFullscreen ? 'max-w-full rounded-none border-none' : 'max-w-[1600px] rounded-2xl'
          } ${isMinimized ? 'scale-95 opacity-0 pointer-events-none' : ''}`}
        >
          {/* Window Titlebar & Global Warehouse KPIs */}
          <div className="h-11 px-3.5 flex items-center justify-between border-b border-black/10 dark:border-white/10 shrink-0 bg-white/40 dark:bg-black/20">
            <div className="flex items-center space-x-3">
              <div className="traffic-group flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setIsMinimized(true)}
                  className="w-3 h-3 rounded-full bg-mac-red flex items-center justify-center shadow-inner"
                  title="Minimizar para o Dock"
                >
                  <span className="traffic-icon text-[8px] font-bold text-black/80">✕</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsMinimized(true)}
                  className="w-3 h-3 rounded-full bg-mac-yellow flex items-center justify-center shadow-inner"
                  title="Minimizar"
                >
                  <span className="traffic-icon text-[8px] font-bold text-black/80">−</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsFullscreen(f => !f)}
                  className="w-3 h-3 rounded-full bg-mac-green flex items-center justify-center shadow-inner"
                  title="Tela Cheia (Foco no Mapa)"
                >
                  <span className="traffic-icon text-[8px] font-bold text-black/80">+</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                    setSidebarOpenMobile(o => !o);
                  } else {
                    setSidebarCollapsedDesktop(c => !c);
                  }
                }}
                className={`px-2 py-1 rounded-lg text-xs font-semibold transition flex items-center space-x-1.5 ${
                  sidebarOpenMobile || !sidebarCollapsedDesktop
                    ? 'bg-black/10 dark:bg-white/15 text-mac-blue font-bold'
                    : 'bg-black/5 dark:bg-white/10 hover:bg-mac-blue hover:text-white text-slate-600 dark:text-slate-300'
                }`}
                title="Alternar Barra Lateral (Filtros e Ruas)"
              >
                <span>☰</span>
                <span className="hidden sm:inline">Filtros</span>
              </button>

              <div className="h-4 w-[1px] bg-black/10 dark:bg-white/10 mx-1 hidden sm:block" />

              <div className="flex items-center space-x-2">
                <span className="text-base">🗺️</span>
                <div>
                  <h1 className="font-display font-bold text-xs sm:text-sm leading-none">
                    Mapa Visual de Endereçamento WMS
                  </h1>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                    Ruas RA–RH • Col. 35 (RF–RH) • Acessórios (AA–AF) • Pulmão (PA–PI)
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="hidden xl:flex items-center space-x-2 text-xs font-mono">
              <div className="px-2.5 py-1 rounded-lg bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-slate-400" />
                <span className="text-slate-500 dark:text-slate-400">Posições:</span>
                <strong className="font-bold">
                  {streetStats.grandTotalSlots.toLocaleString('pt-BR')}
                </strong>
              </div>
              <div className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-emerald-600 dark:text-emerald-400">Ocupados:</span>
                <strong className="font-bold text-emerald-600 dark:text-emerald-300">
                  {streetStats.grandOccupiedSlots.toLocaleString('pt-BR')}
                </strong>
              </div>
              <div className="px-2.5 py-1 rounded-lg bg-mac-blue/10 border border-mac-blue/30 flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-mac-blue" />
                <span className="text-mac-blue">Livres:</span>
                <strong className="font-bold text-mac-blue">
                  {streetStats.grandFreeSlots.toLocaleString('pt-BR')}
                </strong>
              </div>
              {conflictAnalysis.allConflictSlots.size > 0 && (
                <button
                  type="button"
                  onClick={() => navigateToConflict()}
                  title="Clique para ir direto ao endereço exato onde o conflito ocorre"
                  className="px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 flex items-center space-x-1.5 transition"
                >
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                  <span className="text-rose-600 dark:text-rose-300 font-semibold">Conflitos:</span>
                  <strong className="font-extrabold text-rose-600 dark:text-rose-300">
                    {conflictAnalysis.allConflictSlots.size}
                  </strong>
                  <span className="text-[10px] bg-rose-500 text-white px-1.5 py-0.2 rounded font-bold">Ir ➜</span>
                </button>
              )}
              <div className="px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/40 flex items-center space-x-1.5">
                <span>⭐</span>
                <span className="text-amber-600 dark:text-amber-300 font-semibold">
                  RF • RG • RH:
                </span>
                <strong className="font-bold text-amber-600 dark:text-amber-300">Col. 35</strong>
              </div>
            </div>

            {/* Action Toolbar */}
            <div className="flex items-center space-x-1.5">
              <div className="flex bg-black/10 dark:bg-white/10 p-0.5 rounded-lg text-xs">
                <button
                  type="button"
                  onClick={() => setMapMode('cards')}
                  className={`px-2.5 py-1 rounded-md font-medium transition ${
                    mapMode === 'cards'
                      ? 'bg-mac-blue text-white shadow'
                      : 'hover:bg-black/5 dark:hover:bg-white/10'
                  }`}
                >
                  🃏 Cards
                </button>
                <button
                  type="button"
                  onClick={() => setMapMode('rack')}
                  className={`px-2.5 py-1 rounded-md font-medium transition ${
                    mapMode === 'rack'
                      ? 'bg-mac-blue text-white shadow'
                      : 'hover:bg-black/5 dark:hover:bg-white/10'
                  }`}
                >
                  🏢 Porta-Paletes
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsFullscreen(f => !f)}
                className={`px-2.5 py-1.5 rounded-lg font-semibold text-xs border transition flex items-center space-x-1 ${
                  isFullscreen
                    ? 'bg-mac-blue text-white border-mac-blue'
                    : 'bg-black/10 dark:bg-white/10 hover:bg-mac-blue hover:text-white border-black/10 dark:border-white/15'
                }`}
                title="Expandir Mapa em Tela Cheia"
              >
                <span>{isFullscreen ? '🗗' : '⛶'}</span>
                <span className="hidden md:inline">
                  {isFullscreen ? 'Sair Tela Cheia' : 'Mapa Tela Cheia'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setHighlightLowStockGreen(h => !h)}
                className={`px-2.5 py-1.5 rounded-lg font-extrabold text-xs border transition flex items-center space-x-1 ${
                  highlightLowStockGreen
                    ? 'bg-emerald-500 text-white border-emerald-600 shadow-sm'
                    : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40'
                }`}
                title="Destacar em Verde Vivo caixas com menos de 5 peças"
              >
                <span>🟢</span>
                <span className="hidden xl:inline">&lt; 5 Peças</span>
              </button>

              <button
                type="button"
                onClick={() => setPulseAlertsEnabled(p => !p)}
                className={`px-2.5 py-1.5 rounded-lg font-extrabold text-xs border transition flex items-center space-x-1 ${
                  pulseAlertsEnabled
                    ? 'bg-rose-500 text-white border-rose-600 shadow-sm'
                    : 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/40'
                }`}
                title="Ativar/Desativar animação sutil pulsante (fading) para Conflitos e Invasores"
              >
                <span className={pulseAlertsEnabled ? 'inline-block animate-pulse' : ''}>🚨</span>
                <span className="hidden xl:inline">Pulso Alertas: {pulseAlertsEnabled ? 'ON' : 'OFF'}</span>
              </button>

              <button
                type="button"
                onClick={() => setTransbordoSelectMode(m => !m)}
                className={`px-2.5 py-1.5 rounded-lg font-extrabold text-xs border transition flex items-center space-x-1 ${
                  transbordoSelectMode
                    ? 'bg-yellow-400 text-slate-950 border-yellow-600 ring-2 ring-yellow-500'
                    : 'bg-yellow-400/25 hover:bg-yellow-400 text-yellow-900 dark:text-yellow-200 hover:text-slate-950 border-yellow-500/50'
                }`}
                title="Selecionar Colmeias Livres para Transbordo (Mini Pulmão)"
              >
                <span>⚡</span>
                <span className="hidden md:inline">Transbordo</span>
                {transbordoCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-yellow-400 text-slate-950 font-mono text-[10px] font-extrabold">
                    {transbordoCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setShowImportModal(true)}
                className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-sm transition flex items-center space-x-1"
              >
                <span>📥</span>
                <span className="hidden sm:inline">Importar CSV</span>
              </button>

              {movedCount > 0 && (
                <button
                  type="button"
                  onClick={() => exportDraggedChangesCsv(false)}
                  className="px-2.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs shadow-sm transition flex items-center space-x-1"
                >
                  <span>✋</span>
                  <span className="hidden sm:inline">Exportar Arraste</span>
                  <span className="px-1.5 py-0.2 rounded-full bg-white/25 text-white font-mono text-[10px] font-extrabold">
                    {movedCount}
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowCloudModal(true)}
                className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs shadow-sm transition flex items-center space-x-1"
                title="Salvar no Google Sites / Gerar HTML Otimizado"
              >
                <span>☁️</span>
                <span className="hidden sm:inline">Google Sites</span>
              </button>

              <button
                type="button"
                onClick={() => openAllocateOrEditSkuModal(null)}
                className="px-2.5 py-1.5 rounded-lg bg-mac-blue hover:bg-blue-500 text-white font-semibold text-xs shadow-sm transition flex items-center space-x-1"
              >
                <span>＋</span>
                <span className="hidden sm:inline">Alocar SKU</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                    setInspectorOpenMobile(o => !o);
                  } else {
                    setInspectorCollapsedDesktop(c => !c);
                  }
                }}
                className={`px-2 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1 ${
                  inspectorOpenMobile || !inspectorCollapsedDesktop
                    ? 'bg-black/10 dark:bg-white/15 text-mac-blue font-bold'
                    : 'bg-black/5 dark:bg-white/10 hover:bg-mac-blue hover:text-white text-slate-600 dark:text-slate-300'
                }`}
                title="Alternar Inspetor Lateral de Endereço"
              >
                <span>ℹ️</span>
                <span className="hidden xl:inline text-[11px] font-semibold">Inspetor</span>
              </button>
            </div>
          </div>

          {/* ================================================================ */}
          {/* MACRO STREETS OVERVIEW STRIP                                     */}
          {/* ================================================================ */}
          {!isFullscreen && (
            <div className="px-3.5 py-2 border-b border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/[0.02] shrink-0 space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1 bg-black/10 dark:bg-white/10 p-0.5 rounded-xl text-[11px] overflow-x-auto no-scrollbar flex-nowrap shrink-0 max-w-full">
                  <button
                    type="button"
                    onClick={() => {
                      setMacroSectorFilter('ruas_all');
                      if (isAccessoriesStreet(selectedStreet) || isPulmaoStreet(selectedStreet)) {
                        selectStreet('RG');
                      }
                    }}
                    className={`px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1 whitespace-nowrap shrink-0 ${
                      macroSectorFilter === 'ruas_all'
                        ? 'bg-mac-blue text-white shadow'
                        : 'hover:bg-black/5 dark:hover:bg-white/10'
                    }`}
                  >
                    <span>🏢 Ruas Gerais + Col. 35</span>
                    <span className="font-mono text-[9px] opacity-80">(RA a RH)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMacroSectorFilter('acessorios');
                      if (!isAccessoriesStreet(selectedStreet)) selectStreet('AA');
                    }}
                    className={`px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1 whitespace-nowrap shrink-0 ${
                      macroSectorFilter === 'acessorios'
                        ? 'bg-cyan-600 text-white shadow'
                        : 'hover:bg-black/5 dark:hover:bg-white/10 text-cyan-700 dark:text-cyan-300'
                    }`}
                  >
                    <span>🧣 Ala de Acessórios</span>
                    <span className="font-mono text-[9px] opacity-80">(AA a AF)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMacroSectorFilter('pulmao');
                      if (!isPulmaoStreet(selectedStreet)) selectStreet('PA');
                    }}
                    className={`px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1 whitespace-nowrap shrink-0 ${
                      macroSectorFilter === 'pulmao'
                        ? 'bg-indigo-600 text-white shadow'
                        : 'hover:bg-black/5 dark:hover:bg-white/10 text-indigo-700 dark:text-indigo-300'
                    }`}
                  >
                    <span>📦 Pulmão (Temporário)</span>
                    <span className="font-mono text-[9px] opacity-80">(PA a PI • 5N)</span>
                  </button>
                </div>

                <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 hidden md:inline">
                  Dica: Arraste qualquer SKU sobre o botão de uma Rua para alocar automaticamente na primeira torre livre.
                </span>
              </div>

              <div className="flex sm:grid sm:grid-cols-4 md:grid-cols-8 lg:grid-cols-9 gap-1.5 overflow-x-auto sm:overflow-visible no-scrollbar pb-1 sm:pb-0 touch-pan-x">
                {visibleMacroStreets.map(rua => {
                  const st = streetStats.byStreet[rua];
                  const meta = STREET_META[rua];
                  const isSelected = selectedStreet === rua;
                  const isCol35 = isReservedCol35Street(rua);
                  const isAcc = isAccessoriesStreet(rua);
                  const isPul = isPulmaoStreet(rua);

                  return (
                    <button
                      key={rua}
                      type="button"
                      onClick={() => selectStreet(rua)}
                      onDragOver={e => {
                        e.preventDefault();
                        setDragOverKey(`STREET:${rua}`);
                      }}
                      onDragLeave={() => setDragOverKey(null)}
                      onDrop={e => {
                        e.preventDefault();
                        handleDropOnStreet(rua);
                      }}
                      title={meta.desc}
                      className={`mac-card rounded-xl p-2 text-left transition flex flex-col justify-between shrink-0 w-24 sm:w-auto ${
                        dragOverKey === `STREET:${rua}` ? 'ring-2 ring-purple-500 scale-105' : ''
                      } ${
                        isSelected
                          ? isCol35
                            ? 'ring-2 ring-amber-500 bg-amber-500/15'
                            : isAcc
                              ? 'ring-2 ring-cyan-500 bg-cyan-500/15'
                              : isPul
                                ? 'ring-2 ring-indigo-500 bg-indigo-500/15'
                                : 'ring-2 ring-mac-blue bg-mac-blue/15'
                          : isCol35
                            ? 'bg-amber-500/5 border-amber-500/30'
                            : ''
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className={`font-display font-extrabold text-xs ${
                            isCol35
                              ? 'text-amber-600 dark:text-amber-300'
                              : isAcc
                                ? 'text-cyan-600 dark:text-cyan-300'
                                : isPul
                                  ? 'text-indigo-600 dark:text-indigo-300'
                                  : 'text-mac-blue'
                          }`}
                        >
                          {rua} {isCol35 ? '★' : isAcc ? '🧣' : isPul ? '📦' : ''}
                        </span>
                        <span className="font-mono text-[9px] px-1.5 py-0.5 rounded truncate bg-black/10 dark:bg-white/10 text-slate-500 dark:text-slate-300">
                          {meta.badge}
                        </span>
                      </div>
                      <div className="mt-1.5">
                        <div className="flex justify-between items-center text-[10px] font-mono">
                          <span className="text-slate-500 dark:text-slate-400">
                            {st.occupied}/{st.total}
                          </span>
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">
                            {st.pct}%
                          </span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden mt-1">
                          <div
                            className={`h-full rounded-full ${
                              isCol35
                                ? 'bg-amber-500'
                                : isAcc
                                  ? 'bg-cyan-500'
                                  : isPul
                                    ? 'bg-indigo-500'
                                    : 'bg-mac-blue'
                            }`}
                            style={{ width: `${st.pct}%` }}
                          />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* PERSPECTIVES BAR (Aba Local SKU vs Aba Local Barra)              */}
          {/* ================================================================ */}
          <div className="px-3.5 py-1.5 border-b border-black/10 dark:border-white/10 bg-gradient-to-r from-slate-100/90 via-white/80 to-slate-100/90 dark:from-slate-900 dark:via-slate-900/95 dark:to-slate-900 flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 hidden sm:inline">
                Perspectiva do Mapa:
              </span>
              <div className="flex bg-black/10 dark:bg-white/10 p-0.5 rounded-xl text-xs">
                <button
                  type="button"
                  onClick={() => setWmsPerspective('sku')}
                  className={`px-3 py-1 rounded-lg font-extrabold transition flex items-center space-x-1.5 ${
                    wmsPerspective === 'sku'
                      ? 'bg-mac-blue text-white shadow'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/10'
                  }`}
                >
                  <span>📍</span>
                  <span>Aba Local SKU (Local Cadastrado)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setWmsPerspective('barra')}
                  className={`px-3 py-1 rounded-lg font-extrabold transition flex items-center space-x-1.5 ${
                    wmsPerspective === 'barra'
                      ? 'bg-mac-blue text-white shadow'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/10'
                  }`}
                >
                  <span>🏷️</span>
                  <span>Aba Local Barra (Local Atual da Peça)</span>
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className="text-slate-600 dark:text-slate-300 font-medium hidden md:inline">
                {wmsPerspective === 'sku'
                  ? 'Exibindo Local Cadastrado (destaca sobreposições e alocações multinível).'
                  : 'Exibindo Local Atual da Peça (auditoria física de caixas e SKUs invasores).'}
              </span>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPulseAlertsEnabled(p => !p)}
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border transition flex items-center gap-1 ${
                    pulseAlertsEnabled
                      ? 'bg-rose-500 text-white border-rose-600 shadow-sm'
                      : 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30'
                  }`}
                  title="Fading pulsante sutil para destacar visualmente conflitos e invasores"
                >
                  <span className={pulseAlertsEnabled ? 'inline-block animate-pulse' : ''}>🚨</span>
                  <span>Pulso de Alerta: {pulseAlertsEnabled ? 'ON' : 'OFF'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setHighlightLowStockGreen(h => !h)}
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border transition flex items-center gap-1 ${
                    highlightLowStockGreen
                      ? 'bg-emerald-500 text-white border-emerald-600 shadow-sm'
                      : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                  }`}
                >
                  <span>🟢 &lt; 5 Peças em Verde: {highlightLowStockGreen ? 'ON' : 'OFF'}</span>
                  <span className="px-1.5 py-0.2 rounded-full bg-black/20 text-white font-mono text-[9px]">
                    {conflictAnalysis.lowStockSlots.size}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (occupancyFilter === 'LOW_STOCK_LT5') {
                      setOccupancyFilter('ALL');
                      setSelectedRangeId('1-20');
                    } else {
                      setOccupancyFilter('LOW_STOCK_LT5');
                      setHighlightLowStockGreen(true);
                      setSelectedRangeId('ALL-OCCUPIED');
                    }
                  }}
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition ${
                    occupancyFilter === 'LOW_STOCK_LT5'
                      ? 'bg-emerald-700 text-white border-emerald-800'
                      : 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 border-emerald-500/40'
                  }`}
                >
                  🔍 Filtrar &lt; 5 pçs
                </button>
              </div>

              {transbordoCount > 0 && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setOccupancyFilter(prev => (prev === 'TRANSBORDO' ? 'ALL' : 'TRANSBORDO'));
                      setSelectedRangeId('ALL-OCCUPIED');
                    }}
                    className="px-2.5 py-0.5 rounded-full bg-yellow-400 text-slate-950 font-mono text-[10px] font-extrabold border border-yellow-600 shadow-sm"
                  >
                    ⚡ {transbordoCount} Transbordo
                  </button>
                  <button
                    type="button"
                    onClick={exportTransbordoCsv}
                    className="px-2 py-0.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-[10px] font-bold shadow-sm transition"
                  >
                    📤 CSV
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ================================================================ */}
          {/* TRANSBORDO INTERACTIVE SELECTION BANNER                          */}
          {/* ================================================================ */}
          {transbordoSelectMode && (
            <div className="px-3.5 py-2 bg-gradient-to-r from-yellow-400/25 via-amber-300/20 to-yellow-400/25 border-b-2 border-yellow-500 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="flex items-center space-x-2.5">
                <span className="w-7 h-7 rounded-xl bg-yellow-400 text-slate-950 flex items-center justify-center font-extrabold text-sm shadow border border-yellow-600">
                  ⚡
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-display font-extrabold text-xs text-yellow-900 dark:text-yellow-200">
                      MODO DE SELEÇÃO DE COLMEIAS DE TRANSBORDO (MINI PULMÃO)
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-yellow-400 text-slate-950 font-mono text-[10px] font-extrabold border border-yellow-600">
                      {transbordoSelectedWms.length} selecionada(s)
                    </span>
                  </div>
                  <p className="text-[11px] text-yellow-800 dark:text-yellow-300/90">
                    Clique nas colmeias livres no mapa para selecioná-las, informe o SKU abaixo e clique em{' '}
                    <strong>Travar em Amarelo</strong>.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <input
                  type="text"
                  value={transbordoTargetSku}
                  onChange={e => setTransbordoTargetSku(e.target.value)}
                  placeholder="SKU (Ex: 11060127 - 102 - M)"
                  className="w-52 px-2.5 py-1 rounded-xl bg-white/90 dark:bg-slate-900 border border-yellow-600/60 font-mono text-xs font-bold focus:outline-none focus:ring-2 focus:ring-yellow-500"
                />
                <input
                  type="text"
                  value={transbordoNoteInput}
                  onChange={e => setTransbordoNoteInput(e.target.value)}
                  placeholder="Obs (Ex: Excedente > 6 colmeias)"
                  className="w-48 px-2.5 py-1 rounded-xl bg-white/90 dark:bg-slate-900 border border-yellow-600/40 text-xs focus:outline-none hidden xl:block"
                />
                <button
                  type="button"
                  onClick={() => {
                    const parsed = parseAddressString(selectedAddressKey) || {
                      rua: selectedStreet,
                      pos: 1
                    };
                    const maxLv = getMaxLevelsForStreet(parsed.rua, parsed.pos);
                    const toAdd: string[] = [];
                    for (let lv = 1; lv <= maxLv; lv++) {
                      const k = formatWmsAddress(parsed.rua, parsed.pos, lv);
                      const occ = (addressMap.get(k) || []).filter(i => !i.isTransbordo);
                      if (occ.length === 0 && !transbordoSelectedWms.includes(k)) {
                        toAdd.push(k);
                      }
                    }
                    setTransbordoSelectedWms(prev => [...prev, ...toAdd]);
                    playMacSound(toAdd.length > 0 ? 'success' : 'alert', soundEnabled);
                  }}
                  className="px-2.5 py-1 rounded-xl bg-yellow-500/20 hover:bg-yellow-500/35 text-yellow-950 dark:text-yellow-200 border border-yellow-600/50 font-bold text-xs transition"
                >
                  + Livres da Torre Atual
                </button>
                <button
                  type="button"
                  onClick={() =>
                    registerColmeiasAsTransbordo(
                      transbordoSelectedWms,
                      transbordoTargetSku,
                      transbordoNoteInput
                    )
                  }
                  className="px-3 py-1 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-extrabold text-xs border border-yellow-600 shadow transition"
                >
                  ⚡ Travar em Amarelo
                </button>
                <button
                  type="button"
                  onClick={() => setTransbordoSelectedWms([])}
                  className="px-2.5 py-1 rounded-xl bg-black/10 dark:bg-white/10 text-xs font-semibold transition"
                >
                  Limpar
                </button>
                <button
                  type="button"
                  onClick={() => setTransbordoSelectMode(false)}
                  className="px-2.5 py-1 rounded-xl bg-rose-500/20 hover:bg-rose-500 text-rose-700 dark:text-rose-200 hover:text-white text-xs font-bold transition"
                >
                  ✕ Sair
                </button>
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* 3-COLUMN BODY (SIDEBAR + MAP CANVAS + INSPECTOR)                 */}
          {/* ================================================================ */}
          <div className="flex-1 flex overflow-hidden min-h-0 relative">
            {/* Mobile Backdrop for Left Sidebar */}
            {sidebarOpenMobile && (
              <div
                onClick={() => setSidebarOpenMobile(false)}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
              />
            )}
            {/* LEFT SIDEBAR */}
            <aside
              className={`mac-sidebar shrink-0 flex flex-col justify-between p-3.5 overflow-y-auto select-none transition-all duration-300 z-50 ${
                sidebarOpenMobile
                  ? 'fixed inset-y-0 left-0 w-80 max-w-[85vw] shadow-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-r border-black/15 dark:border-white/15'
                  : sidebarCollapsedDesktop
                    ? 'hidden'
                    : 'hidden lg:flex w-72 sm:w-80'
              }`}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-black/10 dark:border-white/10">
                  <span className="font-display font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Navegação e Filtros
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setSidebarOpenMobile(false);
                      setSidebarCollapsedDesktop(true);
                    }}
                    className="px-2 py-0.5 rounded-lg bg-black/10 dark:bg-white/10 hover:bg-rose-500 hover:text-white text-xs font-bold transition flex items-center gap-1"
                    title="Recolher barra lateral"
                  >
                    <span>✕</span>
                    <span className="text-[10px]">Ocultar</span>
                  </button>
                </div>

                {/* Search Input */}
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">
                    🔍
                  </span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Buscar SKU, Cor ou RG.015.2..."
                    className="w-full pl-8 pr-6 py-1.5 text-xs rounded-lg bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-mac-blue transition"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 hover:text-slate-200"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Street Selector */}
                <div>
                  <div className="flex items-center justify-between px-2 mb-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Selecionar Rua
                    </p>
                    <span className="text-[10px] font-mono text-mac-blue font-bold">
                      {selectedStreet}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1">
                    {STREETS.map(r => {
                      const active = selectedStreet === r;
                      const col35 = isReservedCol35Street(r);
                      return (
                        <button
                          key={r}
                          type="button"
                          onClick={() => selectStreet(r)}
                          className={`py-1 px-1.5 rounded-lg font-mono text-[11px] font-bold transition ${
                            active
                              ? 'bg-mac-blue text-white shadow'
                              : col35
                                ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 hover:bg-amber-500/25'
                                : 'bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10'
                          }`}
                        >
                          {r}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Address Range Pagination */}
                <div>
                  <div className="flex items-center justify-between px-2 mb-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Faixa de Endereços
                    </p>
                    <span className="text-[10px] font-mono text-slate-400">
                      1–{getMaxPosForStreet(selectedStreet)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-xs">
                    {ADDRESS_RANGES.map(rg => (
                      <button
                        key={rg.id}
                        type="button"
                        onClick={() => setSelectedRangeId(rg.id)}
                        className={`px-2 py-1 rounded-lg text-left font-mono text-[10px] font-semibold transition truncate ${
                          rg.id.startsWith('ALL') ? 'col-span-2 text-center' : ''
                        } ${
                          selectedRangeId === rg.id
                            ? 'bg-mac-blue text-white shadow'
                            : 'bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10'
                        }`}
                      >
                        {rg.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Level Filter */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 mb-1.5">
                    Filtrar por Nível (1 a 7)
                  </p>
                  <div className="grid grid-cols-4 gap-1 text-xs font-mono">
                    {['ALL', '1', '2', '3', '4', '5', '6', '7'].map(lv => (
                      <button
                        key={lv}
                        type="button"
                        onClick={() => setSelectedLevel(lv)}
                        className={`py-1 rounded-lg font-bold transition ${
                          selectedLevel === lv
                            ? 'bg-mac-blue text-white'
                            : 'bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10'
                        }`}
                      >
                        {lv === 'ALL' ? 'Todos' : `N${lv}`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Occupancy & Status Filter */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 mb-1.5">
                    Status do Endereço
                  </p>
                  <div className="space-y-1 text-xs">
                    {(
                      [
                        { id: 'ALL', label: 'Todos da Faixa', dot: 'bg-slate-400' },
                        { id: 'OCCUPIED', label: 'Apenas Ocupados', dot: 'bg-emerald-500' },
                        { id: 'FREE', label: 'Apenas Livres (Vazios)', dot: 'bg-mac-blue' },
                        {
                          id: 'OVERLAPPED',
                          label:
                            wmsPerspective === 'barra'
                              ? '📦 2+ SKUs na Caixa'
                              : '🚨 Conflito de Cadastro',
                          dot: 'bg-rose-500',
                          count: conflictAnalysis.allConflictSlots.size
                        },
                        {
                          id: 'OUTSIDE_LOCAL',
                          label: '🚨 SKUs Invasores (Fora)',
                          dot: 'bg-amber-500',
                          count: conflictAnalysis.invaderSlots.size
                        },
                        {
                          id: 'LOW_STOCK_LT5',
                          label: '🟢 Poucas Peças (< 5 pçs)',
                          dot: 'bg-emerald-400',
                          count: conflictAnalysis.lowStockSlots.size
                        },
                        {
                          id: 'TRANSBORDO',
                          label: '⚡ Colmeias de Transbordo',
                          dot: 'bg-yellow-400',
                          count: transbordoCount
                        }
                      ] as const
                    ).map(f => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => {
                          setOccupancyFilter(f.id);
                          if (f.id === 'OVERLAPPED') {
                            navigateToConflict();
                          } else if (f.id !== 'ALL' && f.id !== 'FREE') {
                            setSelectedRangeId('ALL-OCCUPIED');
                          }
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg font-medium transition ${
                          occupancyFilter === f.id
                            ? 'bg-mac-blue text-white'
                            : 'hover:bg-black/5 dark:hover:bg-white/10'
                        }`}
                      >
                        <span className="flex items-center space-x-2 truncate">
                          <span className="relative flex h-2 w-2 shrink-0">
                            {pulseAlertsEnabled && (f.id === 'OVERLAPPED' || f.id === 'OUTSIDE_LOCAL') && (
                              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${f.dot}`} />
                            )}
                            <span className={`relative inline-flex rounded-full h-2 w-2 ${f.dot}`} />
                          </span>
                          <span className="truncate">{f.label}</span>
                        </span>
                        {'count' in f && typeof f.count === 'number' && (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-black/15 dark:bg-white/15 font-bold">
                            {f.count}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Bottom Street Rule Callout */}
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500/15 to-orange-500/10 border border-amber-500/30 text-[11px] space-y-1 mt-4">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-600 dark:text-amber-300">
                    ★ Topologia {selectedStreet}
                  </span>
                  <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-600 dark:text-amber-300 font-bold">
                    {STREET_META[selectedStreet]?.badge}
                  </span>
                </div>
                <p className="text-[10px] text-slate-600 dark:text-slate-300 leading-relaxed">
                  {getStreetPositionRuleDescription(selectedStreet)}
                </p>
              </div>
            </aside>

            {/* ============================================================== */}
            {/* CENTER WMS MAP CANVAS                                          */}
            {/* ============================================================== */}
            <section className="flex-1 min-w-0 flex flex-col overflow-hidden bg-white/30 dark:bg-black/10 relative">
              {/* Sub-header Breadcrumb */}
              <div className="px-4 py-2 border-b border-black/10 dark:border-white/10 flex flex-wrap items-center justify-between gap-2 bg-white/40 dark:bg-white/[0.02] shrink-0">
                <div className="flex items-center space-x-2">
                  <span className="px-2.5 py-1 rounded-lg bg-mac-blue text-white font-display font-extrabold text-xs shadow-sm">
                    RUA {selectedStreet}
                  </span>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h2 className="font-display font-bold text-xs sm:text-sm">
                        {filteredViewData.isGlobalSearch
                          ? `Busca Global: "${searchQuery}"`
                          : `Corredor ${selectedStreet} — ${filteredViewData.rangeObj.label}`}
                      </h2>
                      {isReservedCol35Street(selectedStreet) && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/40">
                          ★ Reserva Coleção 35
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                      Exibindo {filteredViewData.slots.length} posição(ões) • Clique em uma colmeia para inspecionar ou arraste para mover
                    </p>
                  </div>
                </div>

                {/* Legend */}
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-[10px] sm:text-[11px] font-mono">
                  <span className="flex items-center space-x-1">
                    <span className="w-2.5 h-2.5 rounded bg-emerald-500 inline-block" />
                    <span>Ocupado</span>
                  </span>
                  <span className="flex items-center space-x-1">
                    <span className="w-2.5 h-2.5 rounded bg-emerald-400 ring-2 ring-emerald-500 inline-block" />
                    <span className="text-emerald-700 dark:text-emerald-300 font-bold">
                      &lt; 5 pçs
                    </span>
                  </span>
                  <span className="flex items-center space-x-1">
                    <span className="w-2.5 h-2.5 rounded bg-yellow-400 border border-yellow-600 inline-block" />
                    <span className="text-yellow-700 dark:text-yellow-300 font-bold">
                      ⚡ Transbordo
                    </span>
                  </span>
                  <span className="flex items-center space-x-1">
                    <span className="w-2.5 h-2.5 rounded bg-rose-500 inline-block" />
                    <span className="text-rose-500 font-bold">Conflito</span>
                  </span>
                </div>
              </div>

              {/* Interactive Target Selection Banner */}
              {interactiveTargetMode !== 'none' && (
                <div className="mx-4 mt-3 p-3 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white shadow-xl flex items-center justify-between gap-3 border border-white/30 z-20 animate-pulse">
                  <div className="flex items-center space-x-2.5">
                    <span className="text-xl">
                      {interactiveTargetMode === 'pick_empty' ? '🎯' : '⇄'}
                    </span>
                    <div>
                      <p className="font-bold text-xs sm:text-sm">
                        {interactiveTargetMode === 'pick_empty'
                          ? 'Modo Seleção Ativo: Clique em qualquer célula VAZIA no mapa para mover'
                          : 'Modo Permuta Ativo: Clique na célula de DESTINO no mapa para trocar de lugar'}
                      </p>
                      <p className="text-[11px] text-blue-100">
                        Remanejando SKU{' '}
                        <strong className="underline font-mono">
                          {inspectedSlot.items.find(it => it.id === selectedSkuId)?.code || inspectedSlot.items[0]?.code}
                        </strong>{' '}
                        (de {inspectedSlot.parsed.wms})
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setInteractiveTargetMode('none');
                      setQuickActionPanel('none');
                    }}
                    className="px-3 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white font-bold text-xs transition border border-white/20 shrink-0"
                  >
                    ✕ Cancelar
                  </button>
                </div>
              )}

              {/* Scrollable Map Grid */}
              <div className="flex-1 overflow-y-auto p-3.5 pb-24 lg:pb-3.5">
                {filteredViewData.slots.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8">
                    <div className="w-14 h-14 rounded-2xl bg-mac-blue/15 text-mac-blue flex items-center justify-center text-3xl mb-3">
                      🗺️
                    </div>
                    <h3 className="font-display font-bold text-base">
                      Nenhuma Posição Encontrada com Estes Filtros
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mt-1">
                      Experimente mudar a faixa de endereços na barra lateral ou limpar o filtro de status.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setOccupancyFilter('ALL');
                        setSelectedLevel('ALL');
                        setSearchQuery('');
                        setSelectedRangeId('1-20');
                      }}
                      className="mt-4 px-4 py-2 rounded-xl bg-mac-blue text-white text-xs font-bold shadow"
                    >
                      Restaurar Visualização Padrão
                    </button>
                  </div>
                ) : mapMode === 'cards' ? (
                  <div className="grid grid-cols-1 min-[420px]:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2.5 sm:gap-3">
                    {filteredViewData.slots.map(slot => {
                      const primary = slot.items[0] || null;
                      const isSelected = selectedAddressKey === slot.wms;
                      const isTrbSelected = transbordoSelectedWms.includes(slot.wms);
                      const isLowGreen = highlightLowStockGreen && slot.isLowStock && !slot.isTransbordo;
                      const totalSlotQty = slot.items
                        .filter(i => !i.isTransbordo)
                        .reduce((acc, it) => acc + (typeof it.qty === 'number' ? it.qty : 1), 0);

                      return (
                        <div
                          key={slot.wms}
                          draggable={Boolean(primary && !slot.isTransbordo)}
                          onDragStart={() => {
                            if (primary && !slot.isTransbordo) {
                              setDragPayload({
                                skuId: primary.id,
                                fromWms: slot.wms,
                                mode: 'group'
                              });
                            }
                          }}
                          onDragOver={e => {
                            e.preventDefault();
                            setDragOverKey(slot.wms);
                          }}
                          onDragLeave={() => setDragOverKey(null)}
                          onDrop={e => {
                            e.preventDefault();
                            handleDropOnSlot(slot.wms);
                          }}
                          onClick={() => {
                            if (interactiveTargetMode === 'pick_empty') {
                              const activeItem = inspectedSlot.items.find(it => it.id === selectedSkuId) || inspectedSlot.items[0];
                              if (activeItem) {
                                handleQuickMoveToEmpty(activeItem, slot.wms);
                              }
                              return;
                            }
                            if (interactiveTargetMode === 'pick_swap') {
                              const activeItem = inspectedSlot.items.find(it => it.id === selectedSkuId) || inspectedSlot.items[0];
                              if (activeItem) {
                                handleSwapSlots(activeItem, slot.wms);
                              }
                              return;
                            }
                            if (transbordoSelectMode) {
                              handleToggleTransbordoSlotSelection(slot.wms);
                            } else {
                              setSelectedAddressKey(slot.wms);
                              if (primary) setSelectedSkuId(primary.id);
                              if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                                setInspectorOpenMobile(true);
                              }
                            }
                          }}
                          className={`mac-card rounded-2xl p-3 cursor-pointer flex flex-col justify-between min-h-[120px] relative ${
                            slot.isTransbordo
                              ? 'transbordo-card'
                              : isLowGreen
                                ? 'low-stock-green-card'
                                : slot.isConflict
                                  ? pulseAlertsEnabled
                                    ? 'slot-conflict-pulse'
                                    : 'border-2 border-rose-500 bg-rose-500/10'
                                  : slot.isInvader
                                    ? pulseAlertsEnabled
                                      ? 'slot-invader-pulse'
                                      : 'border-2 border-amber-500 bg-amber-500/10'
                                    : primary
                                      ? 'border-emerald-500/35 bg-emerald-500/[0.04]'
                                      : ''
                          } ${isSelected ? 'ring-2 ring-mac-blue shadow-lg' : ''} ${
                            isTrbSelected ? 'transbordo-selected-slot' : ''
                          } ${dragOverKey === slot.wms ? 'ring-2 ring-purple-500 scale-[1.02]' : ''}`}
                        >
                          {/* Top Row: WMS Address Badge + Status */}
                          <div className="flex items-center justify-between gap-1">
                            <span
                              className={`font-mono text-xs font-extrabold px-2 py-0.5 rounded-md ${
                                slot.isTransbordo
                                  ? 'bg-yellow-400 text-slate-950 border border-yellow-600'
                                  : slot.isConflict
                                    ? 'bg-rose-600 text-white'
                                    : primary
                                      ? 'bg-mac-blue text-white'
                                      : 'bg-black/10 dark:bg-white/10 text-slate-600 dark:text-slate-300'
                              }`}
                            >
                              {slot.wms}
                            </span>

                            {slot.isTransbordo ? (
                              <span className="text-[10px] font-mono font-extrabold px-2 py-0.5 rounded-full bg-yellow-400 text-slate-950 border border-yellow-600">
                                ⚡ BLOQUEADO
                              </span>
                            ) : slot.isConflict ? (
                              <span className="text-[10px] font-mono font-extrabold px-2 py-0.5 rounded-full bg-rose-600 text-white flex items-center gap-1 shadow-sm">
                                <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                                <span>🚨 {slot.items.length > 1 ? `${slot.items.length} SKUs` : 'DIVIDIDO'}</span>
                              </span>
                            ) : slot.isInvader ? (
                              <span className="text-[10px] font-mono font-extrabold px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 flex items-center gap-1 shadow-sm">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-950/70 animate-ping" />
                                <span>⚠️ INVASOR</span>
                              </span>
                            ) : isLowGreen ? (
                              <span className="text-[10px] font-mono font-extrabold px-2 py-0.5 rounded-full bg-emerald-600 text-white">
                                🟢 {totalSlotQty} pçs
                              </span>
                            ) : primary ? (
                              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                                {totalSlotQty} pçs
                              </span>
                            ) : (
                              <span className="text-[10px] font-mono text-slate-400">LIVRE</span>
                            )}
                          </div>

                          {/* Body Content */}
                          {primary ? (
                            <div className="my-2 space-y-1">
                              <div className="flex items-center space-x-1.5">
                                <span className="text-sm">{primary.icon || '📦'}</span>
                                <span className="font-mono text-xs font-extrabold tracking-tight truncate">
                                  {primary.code}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-600 dark:text-slate-300 truncate font-medium">
                                {primary.name}
                              </p>
                            </div>
                          ) : (
                            <div className="my-3 text-center">
                              <p className="text-[11px] text-slate-400 font-medium">
                                Colmeia Disponível
                              </p>
                            </div>
                          )}

                          {/* Bottom Row: Color Swatch & Raw Local */}
                          <div className="flex items-center justify-between text-[10px] font-mono pt-1 border-t border-black/5 dark:border-white/5">
                            {primary ? (
                              <>
                                <span className="flex items-center space-x-1.5 truncate">
                                  <span
                                    className="w-2.5 h-2.5 rounded-full border border-black/20 shrink-0"
                                    style={{ backgroundColor: primary.colorHex }}
                                  />
                                  <span className="truncate text-slate-500 dark:text-slate-400">
                                    {primary.colorName} • {primary.size}
                                  </span>
                                </span>
                                <span className="text-mac-blue font-bold truncate ml-1">
                                  {primary.rawLocal}
                                </span>
                              </>
                            ) : (
                              <>
                                <span className="text-slate-400">Torre {slot.pos}</span>
                                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                  + Alocar
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* VISTA DO PORTA-PALETES (MÓDULOS DE TORRES VERTICAIS / MATRIZ PANORÂMICA) */
                  (() => {
                    const uniquePositions = Array.from(
                      new Set(filteredViewData.slots.map(s => s.pos))
                    ).sort((a, b) => a - b);

                    const maxStreetLevel = Math.max(
                      ...uniquePositions.map(p => getMaxLevelsForStreet(selectedStreet, p)),
                      1
                    );

                    const levelsDescending = Array.from(
                      { length: maxStreetLevel },
                      (_, i) => maxStreetLevel - i
                    );

                    // Sub-faixas de 5 em 5 torres para visualização focada e ágil
                    const towerSubchunks: Array<{ id: string; label: string; positions: number[] }> = [
                      { id: 'ALL', label: `Todas as Torres (${uniquePositions.length})`, positions: uniquePositions }
                    ];
                    if (uniquePositions.length > 5) {
                      for (let i = 0; i < uniquePositions.length; i += 5) {
                        const chunk = uniquePositions.slice(i, i + 5);
                        const first = chunk[0];
                        const last = chunk[chunk.length - 1];
                        towerSubchunks.push({
                          id: `${first}-${last}`,
                          label: `Torres ${String(first).padStart(3, '0')}–${String(last).padStart(3, '0')}`,
                          positions: chunk
                        });
                      }
                    }

                    const activePositions = rackTowerFilter === 'ALL'
                      ? uniquePositions
                      : (towerSubchunks.find(c => c.id === rackTowerFilter)?.positions || uniquePositions);

                    const handleCellClick = (wms: string, primary: any) => {
                      if (interactiveTargetMode === 'pick_empty') {
                        const activeItem = inspectedSlot.items.find(it => it.id === selectedSkuId) || inspectedSlot.items[0];
                        if (activeItem) {
                          handleQuickMoveToEmpty(activeItem, wms);
                        }
                        return;
                      }
                      if (interactiveTargetMode === 'pick_swap') {
                        const activeItem = inspectedSlot.items.find(it => it.id === selectedSkuId) || inspectedSlot.items[0];
                        if (activeItem) {
                          handleSwapSlots(activeItem, wms);
                        }
                        return;
                      }
                      if (transbordoSelectMode) {
                        handleToggleTransbordoSlotSelection(wms);
                      } else {
                        setSelectedAddressKey(wms);
                        if (primary) setSelectedSkuId(primary.id);
                        if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                          setInspectorOpenMobile(true);
                        }
                      }
                    };

                    return (
                      <div className="space-y-3">
                        {/* Header informativo do Porta-Paletes + Seletor de Modo Responsivo */}
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 px-1 bg-white/40 dark:bg-white/[0.02] p-2.5 rounded-2xl border border-black/5 dark:border-white/5">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-display font-extrabold text-xs sm:text-sm text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                                <span>🏢 Porta-Paletes Vertical — Rua {selectedStreet}</span>
                              </h3>
                              <span className="font-mono text-[10px] sm:text-[11px] font-semibold text-mac-blue px-2 py-0.5 rounded-full bg-mac-blue/10">
                                {activePositions.length} Torre(s) • Níveis {maxStreetLevel} ao 1
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                              {rackLayoutMode === 'columns'
                                ? 'Visualização em módulos verticais por torre — adaptado para telas mobile sem rolagem lateral excessiva'
                                : 'Matriz panorâmica clássica do corredor — visualize todos os andares e prumadas horizontalmente'}
                            </p>
                          </div>

                          {/* Seletor de Modo: Por Torres (Sem Scroll) vs Matriz Panorâmica */}
                          <div className="flex items-center gap-1.5 self-start sm:self-auto bg-black/5 dark:bg-white/10 p-1 rounded-xl text-xs font-semibold shrink-0">
                            <button
                              type="button"
                              onClick={() => setRackLayoutMode('columns')}
                              className={`px-2.5 py-1 rounded-lg transition flex items-center gap-1.5 ${
                                rackLayoutMode === 'columns'
                                  ? 'bg-mac-blue text-white shadow-sm font-bold'
                                  : 'hover:bg-black/5 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300'
                              }`}
                              title="Ver em módulos verticais por torre (Sem Scroll Horizontal, ideal para celular)"
                            >
                              <span>🏢</span>
                              <span>Por Torres (Sem Scroll)</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setRackLayoutMode('matrix')}
                              className={`px-2.5 py-1 rounded-lg transition flex items-center gap-1.5 ${
                                rackLayoutMode === 'matrix'
                                  ? 'bg-mac-blue text-white shadow-sm font-bold'
                                  : 'hover:bg-black/5 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300'
                              }`}
                              title="Ver matriz completa horizontal clássica"
                            >
                              <span>📑</span>
                              <span>Matriz Panorâmica</span>
                            </button>
                          </div>
                        </div>

                        {/* Barra de Sub-Faixas de Torres (Se houver mais de 5 posições) */}
                        {towerSubchunks.length > 2 && (
                          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 px-1 touch-pan-x">
                            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1">
                              Foco:
                            </span>
                            {towerSubchunks.map(chunk => (
                              <button
                                key={chunk.id}
                                type="button"
                                onClick={() => setRackTowerFilter(chunk.id)}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-mono whitespace-nowrap transition shrink-0 ${
                                  rackTowerFilter === chunk.id
                                    ? 'bg-mac-blue text-white font-bold shadow-sm'
                                    : 'bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300'
                                }`}
                              >
                                {chunk.label}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* ============================================================== */}
                        {/* OPÇÃO 1: MÓDULOS DE TORRES VERTICAIS (RESPONSIVO SEM SCROLL)  */}
                        {/* ============================================================== */}
                        {rackLayoutMode === 'columns' ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
                            {activePositions.map(pos => {
                              const maxLvTower = getMaxLevelsForStreet(selectedStreet, pos);
                              const towerLevelsDesc = Array.from(
                                { length: maxLvTower },
                                (_, i) => maxLvTower - i
                              );

                              let towerOccupied = 0;
                              let towerAlerts = 0;
                              towerLevelsDesc.forEach(lv => {
                                const w = formatWmsAddress(selectedStreet, pos, lv);
                                const itms = addressMap.get(w) || [];
                                if (itms.length > 0) towerOccupied++;
                                if (conflictAnalysis.allConflictSlots.has(w) || conflictAnalysis.invaderSlots.has(w)) {
                                  towerAlerts++;
                                }
                              });

                              return (
                                <div
                                  key={pos}
                                  className="mac-card rounded-2xl overflow-hidden border border-black/10 dark:border-white/10 shadow-sm flex flex-col bg-white/60 dark:bg-slate-900/40 hover:border-mac-blue/40 transition"
                                >
                                  {/* Tower Top Header */}
                                  <div className="px-3 py-2 bg-black/[0.03] dark:bg-white/[0.04] border-b border-black/10 dark:border-white/10 flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-mono text-xs font-black text-slate-800 dark:text-slate-100">
                                        Torre {String(pos).padStart(3, '0')}
                                      </span>
                                      <span className="font-mono text-[10px] text-mac-blue font-bold px-1.5 py-0.2 rounded bg-mac-blue/10">
                                        {maxLvTower} Andares
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1 text-[10px] font-mono">
                                      {towerAlerts > 0 ? (
                                        <span className="px-1.5 py-0.5 rounded-full bg-rose-500/20 text-rose-600 dark:text-rose-400 font-extrabold flex items-center gap-1">
                                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping inline-block" />
                                          <span>{towerAlerts} Alerta{towerAlerts > 1 ? 's' : ''}</span>
                                        </span>
                                      ) : (
                                        <span className="text-slate-500 dark:text-slate-400 font-semibold">
                                          {towerOccupied}/{maxLvTower} ocup.
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {/* Vertical Levels Stack (Topo down to Piso) */}
                                  <div className="p-2 space-y-1.5 flex-1 flex flex-col justify-between">
                                    {towerLevelsDesc.map(lv => {
                                      const wms = formatWmsAddress(selectedStreet, pos, lv);
                                      const items = addressMap.get(wms) || [];
                                      const primary = items[0] || null;
                                      const isSelected = selectedAddressKey === wms;
                                      const isTrb = Boolean(transbordoRegistry[wms]);
                                      const isTrbSelected = transbordoSelectedWms.includes(wms);
                                      const isLow = highlightLowStockGreen && conflictAnalysis.lowStockSlots.has(wms) && !isTrb;
                                      const isConflict = conflictAnalysis.allConflictSlots.has(wms);
                                      const isInvader = conflictAnalysis.invaderSlots.has(wms);
                                      const totalQty = items
                                        .filter(i => !i.isTransbordo)
                                        .reduce((acc, it) => acc + (typeof it.qty === 'number' ? it.qty : 1), 0);

                                      return (
                                        <div
                                          key={lv}
                                          draggable={Boolean(primary && !isTrb)}
                                          onDragStart={() => {
                                            if (primary && !isTrb) {
                                              setDragPayload({
                                                skuId: primary.id,
                                                fromWms: wms,
                                                mode: 'group'
                                              });
                                            }
                                          }}
                                          onDragOver={e => {
                                            e.preventDefault();
                                            setDragOverKey(wms);
                                          }}
                                          onDragLeave={() => setDragOverKey(null)}
                                          onDrop={e => {
                                            e.preventDefault();
                                            handleDropOnSlot(wms);
                                          }}
                                          onClick={() => handleCellClick(wms, primary)}
                                          className={`min-h-[50px] rounded-xl p-2 flex items-center justify-between gap-2.5 cursor-pointer transition relative text-[11px] font-mono border ${
                                            isTrb
                                              ? 'transbordo-rack-cell'
                                              : isLow
                                                ? 'low-stock-green-rack-cell shadow-sm'
                                                : isConflict
                                                  ? pulseAlertsEnabled
                                                    ? 'rack-conflict-pulse'
                                                    : 'bg-rose-500/20 border-2 border-rose-500 text-rose-700 dark:text-rose-200'
                                                  : isInvader
                                                    ? pulseAlertsEnabled
                                                      ? 'rack-invader-pulse'
                                                      : 'bg-amber-500/20 border-2 border-amber-500 text-amber-800 dark:text-amber-200'
                                                    : primary
                                                      ? 'bg-emerald-500/10 border-emerald-500/35 hover:border-emerald-500 text-emerald-950 dark:text-emerald-100'
                                                      : 'bg-black/[0.02] dark:bg-white/[0.02] border-dashed border-black/15 dark:border-white/15 hover:border-mac-blue text-slate-400'
                                          } ${
                                            isSelected
                                              ? 'ring-2 ring-mac-blue shadow-md border-mac-blue bg-mac-blue/10'
                                              : ''
                                          } ${isTrbSelected ? 'transbordo-selected-slot' : ''} ${
                                            dragOverKey === wms
                                              ? 'ring-2 ring-purple-500 scale-[1.02]'
                                              : ''
                                          }`}
                                        >
                                          {/* Level Indicator Pill */}
                                          <div
                                            className={`px-2 py-1 rounded-lg font-mono text-[10px] font-extrabold flex flex-col items-center justify-center shrink-0 min-w-[44px] ${
                                              lv === maxLvTower
                                                ? 'bg-mac-blue/15 text-mac-blue border border-mac-blue/30'
                                                : lv === 1
                                                  ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                                                  : 'bg-black/5 dark:bg-white/10 text-slate-500 dark:text-slate-400'
                                            }`}
                                          >
                                            <span>N{lv}</span>
                                            <span className="text-[8px] font-normal opacity-80 leading-none">
                                              {lv === maxLvTower ? 'Topo' : lv === 1 ? 'Piso' : 'Andar'}
                                            </span>
                                          </div>

                                          {/* Center SKU & Item Details */}
                                          <div className="flex-1 min-w-0 flex flex-col justify-center">
                                            {primary ? (
                                              <>
                                                <div className="flex items-center justify-between gap-1 leading-tight">
                                                  <span className="font-extrabold text-xs text-slate-900 dark:text-slate-100 truncate">
                                                    {isTrb ? 'TRANSBORDO' : primary.code.split(' - ')[0]}
                                                  </span>
                                                  <span className="font-bold text-[10px] px-1.5 py-0.2 rounded bg-black/5 dark:bg-white/10 text-slate-700 dark:text-slate-200 shrink-0">
                                                    {totalQty} pç{totalQty === 1 ? '' : 's'}
                                                  </span>
                                                </div>
                                                <div className="flex items-center justify-between gap-1 mt-0.5 text-[9px] text-slate-500 dark:text-slate-400">
                                                  <div className="flex items-center gap-1 truncate">
                                                    <span
                                                      className="w-2.5 h-2.5 rounded-full border border-black/30 shrink-0"
                                                      style={{ backgroundColor: primary.colorHex }}
                                                    />
                                                    <span className="truncate font-semibold">
                                                      {primary.colorCode} • {primary.size}
                                                    </span>
                                                  </div>
                                                  <span className="opacity-70 font-mono shrink-0">
                                                    {wms}
                                                  </span>
                                                </div>
                                              </>
                                            ) : (
                                              <div className="flex items-center justify-between text-slate-400 dark:text-slate-500">
                                                <span className="text-xs font-semibold">+ Livre / Disponível</span>
                                                <span className="text-[9px] font-mono opacity-60">{wms}</span>
                                              </div>
                                            )}
                                          </div>

                                          {/* Status Icon Indicator */}
                                          <div className="shrink-0 flex items-center">
                                            {isTrb ? (
                                              <span className="text-base" title="Transbordo Bloqueado">⚡</span>
                                            ) : isConflict ? (
                                              <span className="text-rose-600 font-extrabold text-xs flex items-center gap-1" title="Conflito / Sobreposição">
                                                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping inline-block" />
                                                <span>🚨</span>
                                              </span>
                                            ) : isInvader ? (
                                              <span className="text-amber-600 font-extrabold text-xs flex items-center gap-1" title="SKU Invasor">
                                                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping inline-block" />
                                                <span>⚠️</span>
                                              </span>
                                            ) : isLow ? (
                                              <span className="text-[9px] font-bold text-emerald-700 dark:text-emerald-300 px-1 py-0.2 rounded bg-emerald-500/20">
                                                &lt;5pç
                                              </span>
                                            ) : null}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          /* ============================================================== */
                          /* OPÇÃO 2: TABELA MATRIZ PANORÂMICA (HORIZONTAL CLÁSSICA)        */
                          /* ============================================================== */
                          <div className="mac-card rounded-2xl overflow-hidden border border-black/10 dark:border-white/10 shadow-sm">
                            <div className="overflow-x-auto">
                              <table className="w-full text-left border-collapse min-w-[700px]">
                                <thead>
                                  <tr className="border-b border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 text-[11px] font-mono">
                                    <th className="py-2.5 px-3 font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 sticky left-0 bg-slate-100/95 dark:bg-slate-900/95 z-20 w-32 shrink-0 border-r border-black/10 dark:border-white/10">
                                      ANDAR / NÍVEL
                                    </th>
                                    {activePositions.map(pos => {
                                      const maxLvTower = getMaxLevelsForStreet(selectedStreet, pos);
                                      return (
                                        <th
                                          key={pos}
                                          className="py-2.5 px-2 text-center font-bold text-slate-600 dark:text-slate-300 min-w-[76px] border-r border-black/5 dark:border-white/5"
                                        >
                                          <div className="font-mono text-xs font-extrabold text-slate-700 dark:text-slate-200">
                                            End. {String(pos).padStart(3, '0')}
                                          </div>
                                          <div className="text-[9px] text-slate-400 font-normal">
                                            {maxLvTower}N
                                          </div>
                                        </th>
                                      );
                                    })}
                                  </tr>
                                </thead>
                                <tbody>
                                  {levelsDescending.map((lv, rowIdx) => {
                                    const isTop = rowIdx === 0;
                                    const isBottom = lv === 1;
                                    const levelLabel = isTop
                                      ? `Nível ${lv} (Topo)`
                                      : isBottom
                                        ? `Nível ${lv} (Piso)`
                                        : `Nível ${lv}`;

                                    return (
                                      <tr
                                        key={lv}
                                        className="border-b border-black/10 dark:border-white/10 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition"
                                      >
                                        {/* Etiqueta vertical do andar (Coluna Fixa à esquerda) */}
                                        <td className="py-3 px-3 font-display font-bold text-xs text-mac-blue sticky left-0 bg-slate-100/95 dark:bg-slate-900/95 z-10 border-r border-black/10 dark:border-white/10 shadow-sm whitespace-nowrap">
                                          <span className="flex items-center gap-1.5">
                                            <span className="w-1.5 h-1.5 rounded-full bg-mac-blue" />
                                            <span>{levelLabel}</span>
                                          </span>
                                        </td>

                                        {/* Células de cada coluna/torre para este nível */}
                                        {activePositions.map(pos => {
                                          const maxLvTower = getMaxLevelsForStreet(selectedStreet, pos);
                                          const existsAtThisTower = lv <= maxLvTower;
                                          const wms = formatWmsAddress(selectedStreet, pos, lv);
                                          const items = existsAtThisTower ? addressMap.get(wms) || [] : [];
                                          const primary = items[0] || null;
                                          const isSelected = selectedAddressKey === wms;
                                          const isTrb = Boolean(transbordoRegistry[wms]);
                                          const isTrbSelected = transbordoSelectedWms.includes(wms);
                                          const isLow =
                                            highlightLowStockGreen &&
                                            conflictAnalysis.lowStockSlots.has(wms) &&
                                            !isTrb;
                                          const isConflict = conflictAnalysis.allConflictSlots.has(wms);
                                          const isInvader = conflictAnalysis.invaderSlots.has(wms);
                                          const totalQty = items
                                            .filter(i => !i.isTransbordo)
                                            .reduce((acc, it) => acc + (typeof it.qty === 'number' ? it.qty : 1), 0);

                                          if (!existsAtThisTower) {
                                            return (
                                              <td
                                                key={pos}
                                                className="p-1.5 text-center bg-black/5 dark:bg-white/[0.02] border-r border-black/5 dark:border-white/5 opacity-30 select-none"
                                              >
                                                <span className="text-[10px] font-mono text-slate-400">
                                                  —
                                                </span>
                                              </td>
                                            );
                                          }

                                          return (
                                            <td
                                              key={pos}
                                              className="p-1 border-r border-black/5 dark:border-white/5"
                                            >
                                              <div
                                                draggable={Boolean(primary && !isTrb)}
                                                onDragStart={() => {
                                                  if (primary && !isTrb) {
                                                    setDragPayload({
                                                      skuId: primary.id,
                                                      fromWms: wms,
                                                      mode: 'group'
                                                    });
                                                  }
                                                }}
                                                onDragOver={e => {
                                                  e.preventDefault();
                                                  setDragOverKey(wms);
                                                }}
                                                onDragLeave={() => setDragOverKey(null)}
                                                onDrop={e => {
                                                  e.preventDefault();
                                                  handleDropOnSlot(wms);
                                                }}
                                                onClick={() => handleCellClick(wms, primary)}
                                                className={`h-16 rounded-xl p-1.5 flex flex-col justify-between cursor-pointer transition relative text-[10px] font-mono ${
                                                  isTrb
                                                    ? 'transbordo-rack-cell'
                                                    : isLow
                                                      ? 'low-stock-green-rack-cell shadow-sm'
                                                      : isConflict
                                                        ? pulseAlertsEnabled
                                                          ? 'rack-conflict-pulse'
                                                          : 'bg-rose-500/20 border-2 border-rose-500 text-rose-700 dark:text-rose-200'
                                                        : isInvader
                                                          ? pulseAlertsEnabled
                                                            ? 'rack-invader-pulse'
                                                            : 'bg-amber-500/20 border-2 border-amber-500 text-amber-800 dark:text-amber-200'
                                                          : primary
                                                            ? 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-900 dark:text-emerald-200'
                                                            : 'bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 hover:border-mac-blue text-slate-400'
                                                } ${
                                                  isSelected
                                                    ? 'ring-2 ring-mac-blue shadow-md border-mac-blue'
                                                    : ''
                                                } ${isTrbSelected ? 'transbordo-selected-slot' : ''} ${
                                                  dragOverKey === wms
                                                    ? 'ring-2 ring-purple-500 scale-[1.04]'
                                                    : ''
                                                }`}
                                              >
                                                {/* Endereço resumido no topo */}
                                                <div className="flex items-center justify-between font-bold leading-tight">
                                                  <span className="opacity-75 text-[9px]">
                                                    {String(pos).padStart(3, '0')}-N{lv}
                                                  </span>
                                                  {isTrb ? (
                                                    <span className="text-[10px]" title="Transbordo Bloqueado">⚡</span>
                                                  ) : isConflict ? (
                                                    <span className="text-rose-600 dark:text-rose-400 font-extrabold text-[9px] flex items-center gap-0.5" title="Conflito / Sobreposição">
                                                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping inline-block" />
                                                      <span>🚨</span>
                                                    </span>
                                                  ) : isInvader ? (
                                                    <span className="text-amber-600 dark:text-amber-400 font-extrabold text-[9px] flex items-center gap-0.5" title="SKU Invasor (fora do local)">
                                                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping inline-block" />
                                                      <span>⚠️</span>
                                                    </span>
                                                  ) : primary ? (
                                                    <span className="font-bold text-[9px]">
                                                      {totalQty}pç
                                                    </span>
                                                  ) : (
                                                    <span className="text-slate-400 text-[8px] font-normal">
                                                      Livre
                                                    </span>
                                                  )}
                                                </div>

                                                {/* SKU ou Status no meio */}
                                                {primary ? (
                                                  <div className="truncate font-extrabold text-[10px] leading-tight my-auto text-center">
                                                    {isTrb ? (
                                                      <span className="text-slate-950 dark:text-yellow-100">TRANSBORDO</span>
                                                    ) : (
                                                      <span>{primary.code.split(' - ')[0]}</span>
                                                    )}
                                                  </div>
                                                ) : (
                                                  <div className="text-center opacity-40 text-[9px] my-auto">
                                                    + Vazio
                                                  </div>
                                                )}

                                                {/* Cor e Tam ou Detalhe na base */}
                                                {primary ? (
                                                  <div className="flex items-center justify-between text-[8px] opacity-85 truncate">
                                                    <span
                                                      className="w-2 h-2 rounded-full border border-black/30 shrink-0"
                                                      style={{ backgroundColor: primary.colorHex }}
                                                    />
                                                    <span className="truncate ml-1 font-semibold">
                                                      {primary.colorCode} • {primary.size}
                                                    </span>
                                                  </div>
                                                ) : (
                                                  <div className="text-[8px] text-center text-slate-400">
                                                    {wms}
                                                  </div>
                                                )}
                                              </div>
                                            </td>
                                          );
                                        })}
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()
                )}
              </div>
            </section>

            {/* Mobile Backdrop for Right Inspector */}
            {inspectorOpenMobile && (
              <div
                onClick={() => setInspectorOpenMobile(false)}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
              />
            )}
            {/* RIGHT INSPECTOR PANEL */}
            <aside
              className={`shrink-0 border-l border-black/10 dark:border-white/10 p-3.5 overflow-y-auto flex flex-col justify-between transition-all duration-300 z-50 ${
                inspectorOpenMobile
                  ? 'fixed inset-y-0 right-0 w-88 max-w-[92vw] shadow-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-l border-black/15 dark:border-white/15'
                  : inspectorCollapsedDesktop
                    ? 'hidden'
                    : 'hidden lg:flex w-88 max-w-[92vw] bg-white/45 dark:bg-black/25'
              }`}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-2">
                  <h3 className="font-display font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Inspetor de Endereço
                  </h3>
                  <div className="flex items-center space-x-1.5">
                    <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-mac-blue/15 text-mac-blue font-bold">
                      {inspectedSlot.parsed.wms}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setInspectorOpenMobile(false);
                        setInspectorCollapsedDesktop(true);
                      }}
                      className="px-2 py-0.5 rounded-lg bg-black/10 dark:bg-white/10 hover:bg-rose-500 hover:text-white text-xs font-bold transition flex items-center gap-1"
                      title="Fechar ou recolher inspetor"
                    >
                      <span>✕</span>
                      <span className="text-[10px]">Fechar</span>
                    </button>
                  </div>
                </div>

                {/* CASE 1: TRANSBORDO SLOT */}
                {inspectedSlot.trbEntry ? (
                  <div className="space-y-3">
                    <div className="p-4 rounded-2xl transbordo-card text-center space-y-2">
                      <span className="inline-block px-2.5 py-0.5 rounded-full bg-yellow-400 text-slate-950 font-mono text-[10px] font-extrabold border border-yellow-600">
                        ⚡ MINI PULMÃO DE TRANSBORDO
                      </span>
                      <p className="font-mono text-sm font-extrabold text-slate-950 dark:text-yellow-100">
                        {inspectedSlot.trbEntry.code}
                      </p>
                      <p className="text-xs text-slate-800 dark:text-yellow-200">
                        {inspectedSlot.trbEntry.note}
                      </p>
                    </div>

                    <div className="mac-card rounded-2xl p-3 space-y-2">
                      <button
                        type="button"
                        onClick={() => {
                          setTransbordoTargetSku(inspectedSlot.trbEntry!.code);
                          setTransbordoSelectMode(true);
                        }}
                        className="w-full py-2 px-3 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-extrabold text-xs border border-yellow-600 shadow-sm transition"
                      >
                        ⚡ + Selecionar Mais Colmeias p/ este SKU
                      </button>
                      <button
                        type="button"
                        onClick={exportTransbordoCsv}
                        className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm transition"
                      >
                        📤 Exportar Transbordo (.CSV)
                      </button>
                      <button
                        type="button"
                        onClick={() => releaseTransbordoColmeia(inspectedSlot.parsed.wms)}
                        className="w-full py-1.5 px-3 rounded-xl bg-rose-500/15 hover:bg-rose-600 text-rose-600 dark:text-rose-300 hover:text-white font-semibold text-xs transition"
                      >
                        🧹 Liberar Apenas {inspectedSlot.parsed.wms}
                      </button>
                      <button
                        type="button"
                        onClick={() => releaseAllTransbordoForSku(inspectedSlot.trbEntry!.code)}
                        className="w-full py-1.5 px-3 rounded-xl bg-rose-600/20 hover:bg-rose-600 text-rose-700 dark:text-rose-200 hover:text-white font-bold text-xs transition"
                      >
                        🗑️ Liberar Todas deste SKU
                      </button>
                    </div>
                  </div>
                ) : isPulmaoStreet(inspectedSlot.parsed.rua) ? (
                  /* CASE 2: PULMÃO TEMPORÁRIO (PA a PI) */
                  <div className="space-y-3">
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-500/20 via-purple-500/15 to-sky-500/10 border border-indigo-500/30 text-center space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-extrabold px-2.5 py-0.5 rounded bg-indigo-600 text-white">
                          {inspectedSlot.parsed.wms}
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-700 dark:text-indigo-200 font-bold">
                          📦 Pulmão (5N)
                        </span>
                      </div>
                      <p className="text-xs font-bold">
                        {inspectedSlot.parsed.rua} • Torre {inspectedSlot.parsed.pos} • Nível{' '}
                        {inspectedSlot.parsed.nivel}
                      </p>
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          inspectedSlot.items.length > 0
                            ? 'bg-indigo-600 text-white'
                            : 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                        }`}
                      >
                        {inspectedSlot.items.length > 0
                          ? '📦 OCUPADO TEMPORARIAMENTE'
                          : '✓ POSIÇÃO LIVRE NO PULMÃO'}
                      </span>
                    </div>

                    <div className="mac-card rounded-2xl p-3.5 space-y-2.5 text-xs">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600 dark:text-indigo-300 block">
                        🏢 Níveis da Torre {inspectedSlot.parsed.rua}.
                        {String(inspectedSlot.parsed.pos).padStart(3, '0')} (1 Clique):
                      </span>
                      <div className="grid grid-cols-5 gap-1.5 text-center font-mono text-[10px]">
                        {Array.from({ length: inspectedSlot.maxLv }, (_, idx) => idx + 1).map(lv => {
                          const slotWms = formatWmsAddress(
                            inspectedSlot.parsed.rua,
                            inspectedSlot.parsed.pos,
                            lv
                          );
                          const occ = (addressMap.get(slotWms) || []).length > 0;
                          return (
                            <button
                              key={lv}
                              type="button"
                              onClick={() =>
                                togglePulmaoPosition(
                                  inspectedSlot.parsed.rua,
                                  inspectedSlot.parsed.pos,
                                  lv,
                                  occ ? null : pulmaoTempNote,
                                  pulmaoTempQty
                                )
                              }
                              className={`p-1.5 rounded-xl border font-bold transition ${
                                occ
                                  ? 'bg-indigo-600 text-white border-indigo-500'
                                  : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                              }`}
                            >
                              <span className="block">N{lv}</span>
                              <span className="block text-[8px]">{occ ? '📦 Ocup.' : '+ Livre'}</span>
                            </button>
                          );
                        })}
                      </div>

                      <div className="grid grid-cols-2 gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() =>
                            setPulmaoTowerAllLevels(
                              inspectedSlot.parsed.rua,
                              inspectedSlot.parsed.pos,
                              true,
                              pulmaoTempNote,
                              pulmaoTempQty
                            )
                          }
                          className="py-1.5 px-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-[11px] transition"
                        >
                          📦 Ocupar Torre (5N)
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setPulmaoTowerAllLevels(
                              inspectedSlot.parsed.rua,
                              inspectedSlot.parsed.pos,
                              false
                            )
                          }
                          className="py-1.5 px-2 rounded-xl bg-rose-500/15 hover:bg-rose-600 text-rose-600 dark:text-rose-300 hover:text-white font-semibold text-[11px] transition"
                        >
                          🧹 Liberar Torre
                        </button>
                      </div>
                    </div>

                    <div className="mac-card rounded-2xl p-3.5 space-y-2.5 text-xs">
                      <label className="block text-[10px] text-slate-400">
                        Descrição do Volume / Lote Temporário
                      </label>
                      <input
                        type="text"
                        value={pulmaoTempNote}
                        onChange={e => setPulmaoTempNote(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-xl bg-black/5 dark:bg-white/10 border border-black/15 dark:border-white/15 text-xs"
                      />
                      <label className="block text-[10px] text-slate-400">Qtd. Volumes</label>
                      <input
                        type="number"
                        min={1}
                        value={pulmaoTempQty}
                        onChange={e => setPulmaoTempQty(parseInt(e.target.value, 10) || 1)}
                        className="w-full px-2.5 py-1.5 rounded-xl bg-black/5 dark:bg-white/10 border border-black/15 dark:border-white/15 font-mono text-xs"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          togglePulmaoPosition(
                            inspectedSlot.parsed.rua,
                            inspectedSlot.parsed.pos,
                            inspectedSlot.parsed.nivel,
                            pulmaoTempNote,
                            pulmaoTempQty
                          )
                        }
                        className="w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow transition"
                      >
                        💾 Salvar Posição Temporária
                      </button>
                    </div>
                  </div>
                ) : inspectedSlot.items.length === 0 ? (
                  /* CASE 3: FREE SLOT */
                  <div className="space-y-3">
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-mac-blue/15 via-indigo-500/10 to-purple-500/15 border border-black/10 dark:border-white/15 text-center space-y-2">
                      <div className="w-12 h-12 mx-auto rounded-2xl bg-white/60 dark:bg-white/10 flex items-center justify-center text-2xl shadow-inner">
                        📍
                      </div>
                      <p className="font-mono text-sm font-extrabold text-mac-blue">
                        {inspectedSlot.parsed.wms}
                      </p>
                      <p className="text-xs font-semibold">
                        Rua {inspectedSlot.parsed.rua} • Endereço {inspectedSlot.parsed.pos} • Nível{' '}
                        {inspectedSlot.parsed.nivel}
                      </p>
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                        Posição Livre Disponível
                      </span>
                    </div>

                    <div className="mac-card rounded-2xl p-4 space-y-2.5 text-center">
                      <button
                        type="button"
                        onClick={() => openAllocateOrEditSkuModal(null, inspectedSlot.parsed.wms)}
                        className="w-full py-2 rounded-xl bg-mac-blue hover:bg-blue-500 text-white font-semibold text-xs shadow-md transition"
                      >
                        + Alocar SKU Fixo em {inspectedSlot.parsed.wms}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setTransbordoSelectMode(true);
                          setTransbordoSelectedWms([inspectedSlot.parsed.wms]);
                        }}
                        className="w-full py-2 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-extrabold text-xs border border-yellow-600 shadow-md transition"
                      >
                        ⚡ Cadastrar Transbordo Aqui
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowImportModal(true)}
                        className="w-full py-2 rounded-xl bg-emerald-600/15 hover:bg-emerald-600 text-emerald-700 dark:text-emerald-300 hover:text-white border border-emerald-500/30 font-semibold text-xs transition"
                      >
                        📥 Importar Arquivo CSV
                      </button>
                    </div>
                  </div>
                ) : (
                  /* CASE 4: OCCUPIED SLOT */
                  (() => {
                    const activeItem =
                      inspectedSlot.items.find(i => i.id === selectedSkuId) ||
                      inspectedSlot.items[0];
                    const multi = getSkuMultiLevelInfo(activeItem);

                    return (
                      <div className="space-y-3">
                        {/* If multiple SKUs in same slot, show tabs */}
                        {inspectedSlot.items.length > 1 && (
                          <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/40 space-y-1.5">
                            <p className="text-[10px] font-extrabold text-rose-600 dark:text-rose-300 uppercase">
                              🚨 {inspectedSlot.items.length} SKUs neste Endereço:
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {inspectedSlot.items.map(it => (
                                <button
                                  key={it.id}
                                  type="button"
                                  onClick={() => setSelectedSkuId(it.id)}
                                  className={`px-2 py-1 rounded-lg font-mono text-[10px] font-bold transition ${
                                    activeItem.id === it.id
                                      ? 'bg-rose-600 text-white'
                                      : 'bg-white/60 dark:bg-white/10'
                                  }`}
                                >
                                  {it.code}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Primary SKU Card */}
                        <div className="mac-card rounded-2xl p-3.5 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-xs font-extrabold px-2 py-0.5 rounded bg-mac-blue text-white">
                              {activeItem.code}
                            </span>
                            <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold">
                              {activeItem.qty} pçs
                            </span>
                          </div>

                          <p className="text-xs font-bold leading-snug">{activeItem.name}</p>

                          <div className="grid grid-cols-2 gap-1.5 text-[11px] font-mono pt-1">
                            <div className="p-2 rounded-xl bg-black/5 dark:bg-white/5">
                              <span className="text-[9px] text-slate-400 block">LOCAL AGRUPADO</span>
                              <strong className="text-mac-blue">{multi.groupedWms}</strong>
                            </div>
                            <div className="p-2 rounded-xl bg-black/5 dark:bg-white/5">
                              <span className="text-[9px] text-slate-400 block">COR / TAMANHO</span>
                              <span className="flex items-center space-x-1 font-bold">
                                <span
                                  className="w-2.5 h-2.5 rounded-full border border-black/20"
                                  style={{ backgroundColor: activeItem.colorHex }}
                                />
                                <span>
                                  {activeItem.colorCode} • {activeItem.size}
                                </span>
                              </span>
                            </div>
                          </div>

                          {activeItem.isOutsideRegisteredLocal && (
                            <div className="p-2.5 rounded-xl bg-amber-500/20 border border-amber-500/40 space-y-1.5">
                              <p className="text-[10px] font-extrabold text-amber-800 dark:text-amber-200">
                                ⚠️ SKU INVASOR (Fora do Local Cadastrado: {activeItem.localCadastroRaw})
                              </p>
                              <button
                                type="button"
                                onClick={() => returnBarraItemToRegisteredLocal(activeItem)}
                                className="w-full py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-[11px] transition"
                              >
                                ↩️ Devolver p/ {activeItem.localCadastroRaw}
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Interactive Tower Levels Grid (1-Click Multi-level Toggle) */}
                        <div className="mac-card rounded-2xl p-3.5 space-y-2 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                              🏢 Níveis na Torre {activeItem.rua}.
                              {String(activeItem.pos).padStart(3, '0')}:
                            </span>
                            <span className="font-mono text-[10px] font-bold text-mac-blue">
                              {multi.levels.length} nível(is)
                            </span>
                          </div>
                          <div className="grid grid-cols-4 gap-1.5 font-mono text-[10px]">
                            {Array.from({ length: inspectedSlot.maxLv }, (_, idx) => idx + 1).map(
                              lv => {
                                const isOwn = multi.levels.includes(lv);
                                return (
                                  <button
                                    key={lv}
                                    type="button"
                                    onClick={() => handleToggleSkuLevelInTower(activeItem, lv)}
                                    className={`p-1.5 rounded-xl border font-bold transition ${
                                      isOwn
                                        ? 'bg-mac-blue text-white border-mac-blue shadow-sm'
                                        : 'bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10 hover:border-mac-blue'
                                    }`}
                                  >
                                    N{lv} {isOwn ? '✓' : '+'}
                                  </button>
                                );
                              }
                            )}
                          </div>
                        </div>

                        {/* 1-Click Fast Relocation Actions */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                              ⚡ Ações Rápidas (1 Clique):
                            </span>
                            {(quickActionPanel !== 'none' || interactiveTargetMode !== 'none') && (
                              <button
                                type="button"
                                onClick={() => {
                                  setQuickActionPanel('none');
                                  setInteractiveTargetMode('none');
                                }}
                                className="text-[10px] text-slate-400 hover:text-slate-200"
                              >
                                Fechar ✕
                              </button>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                if (quickActionPanel === 'move_empty') {
                                  setQuickActionPanel('none');
                                  setInteractiveTargetMode('none');
                                } else {
                                  setQuickActionPanel('move_empty');
                                  setInteractiveTargetMode('none');
                                }
                              }}
                              className={`py-2 px-2 rounded-xl font-bold text-xs shadow-sm flex items-center justify-center space-x-1.5 transition ${
                                quickActionPanel === 'move_empty'
                                  ? 'bg-emerald-600 text-white ring-2 ring-emerald-400'
                                  : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                              }`}
                              title="Mover este SKU diretamente para um endereço livre"
                            >
                              <span>📍</span>
                              <span>Mover p/ Vazio</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                if (quickActionPanel === 'swap') {
                                  setQuickActionPanel('none');
                                  setInteractiveTargetMode('none');
                                } else {
                                  setQuickActionPanel('swap');
                                  setInteractiveTargetMode('none');
                                }
                              }}
                              className={`py-2 px-2 rounded-xl font-bold text-xs shadow-sm flex items-center justify-center space-x-1.5 transition ${
                                quickActionPanel === 'swap'
                                  ? 'bg-purple-600 text-white ring-2 ring-purple-400'
                                  : 'bg-purple-500/15 hover:bg-purple-500/25 text-purple-700 dark:text-purple-300 border border-purple-500/30'
                              }`}
                              title="Permuta direta: inverter endereço com outro SKU ocupado"
                            >
                              <span>⇄</span>
                              <span>Trocar c/ Destino</span>
                            </button>
                          </div>

                          {/* Quick Panel: Mover p/ Vazio */}
                          {quickActionPanel === 'move_empty' && (
                            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-2.5 text-xs animate-in fade-in duration-150">
                              <div className="flex items-center justify-between">
                                <span className="font-extrabold text-[11px] text-emerald-700 dark:text-emerald-300 flex items-center space-x-1">
                                  <span>📍</span>
                                  <span>Locais Vazios Sugeridos:</span>
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono">1 toque</span>
                              </div>

                              {nearbyFreeSlots.length > 0 ? (
                                <div className="grid grid-cols-2 gap-1.5 font-mono text-[11px]">
                                  {nearbyFreeSlots.map(w => (
                                    <button
                                      key={w}
                                      type="button"
                                      onClick={() => handleQuickMoveToEmpty(activeItem, w)}
                                      className="py-1.5 px-2 rounded-xl bg-white dark:bg-white/10 hover:bg-emerald-600 hover:text-white border border-emerald-500/30 font-bold transition shadow-sm text-left truncate flex items-center justify-between"
                                      title={`Mover para ${w}`}
                                    >
                                      <span>{w}</span>
                                      <span className="text-[9px] opacity-75">Livre</span>
                                    </button>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-[11px] text-slate-400 italic">
                                  Nenhuma célula livre na vizinhança direta.
                                </p>
                              )}

                              <div className="pt-1 border-t border-emerald-500/20 space-y-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setInteractiveTargetMode(m => m === 'pick_empty' ? 'none' : 'pick_empty');
                                  }}
                                  className={`w-full py-1.5 rounded-xl font-bold text-[11px] transition flex items-center justify-center space-x-1 ${
                                    interactiveTargetMode === 'pick_empty'
                                      ? 'bg-emerald-600 text-white animate-pulse'
                                      : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-800 dark:text-emerald-200'
                                  }`}
                                >
                                  <span>🎯</span>
                                  <span>
                                    {interactiveTargetMode === 'pick_empty'
                                      ? 'Aguardando clique no mapa...'
                                      : 'Clicar na Célula Vazia no Mapa'}
                                  </span>
                                </button>

                                <div className="flex items-center space-x-1.5">
                                  <input
                                    type="text"
                                    value={quickTargetAddressInput}
                                    onChange={e => setQuickTargetAddressInput(e.target.value.toUpperCase())}
                                    placeholder="Ex: RF.029.2"
                                    className="flex-1 px-2.5 py-1.5 rounded-xl bg-white dark:bg-white/10 border border-black/10 dark:border-white/10 text-xs font-mono"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (!quickTargetAddressInput.trim()) return;
                                      handleQuickMoveToEmpty(activeItem, quickTargetAddressInput.trim());
                                      setQuickTargetAddressInput('');
                                    }}
                                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition shrink-0"
                                  >
                                    Mover
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Quick Panel: Trocar c/ Destino */}
                          {quickActionPanel === 'swap' && (
                            <div className="p-3 rounded-2xl bg-purple-500/10 border border-purple-500/30 space-y-2.5 text-xs animate-in fade-in duration-150">
                              <div className="flex items-center justify-between">
                                <span className="font-extrabold text-[11px] text-purple-700 dark:text-purple-300 flex items-center space-x-1">
                                  <span>⇄</span>
                                  <span>Permutar com SKU Vizinho:</span>
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono">1 toque</span>
                              </div>

                              {nearbyOccupiedSlots.length > 0 ? (
                                <div className="space-y-1 font-mono text-[11px]">
                                  {nearbyOccupiedSlots.map(occ => (
                                    <button
                                      key={occ.wms}
                                      type="button"
                                      onClick={() => handleSwapSlots(activeItem, occ.wms)}
                                      className="w-full py-1.5 px-2.5 rounded-xl bg-white dark:bg-white/10 hover:bg-purple-600 hover:text-white border border-purple-500/30 font-bold transition shadow-sm text-left flex items-center justify-between group"
                                      title={`Trocar posições com ${occ.skuCode} em ${occ.wms}`}
                                    >
                                      <span className="flex items-center space-x-1.5 truncate">
                                        <span className="text-mac-blue group-hover:text-white font-bold">{occ.wms}</span>
                                        <span className="font-sans text-[10px] opacity-80 truncate">({occ.skuCode})</span>
                                      </span>
                                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-500/20 group-hover:bg-purple-700 group-hover:text-white shrink-0 font-bold">
                                        {occ.qty} pçs
                                      </span>
                                    </button>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-[11px] text-slate-400 italic">
                                  Nenhum SKU ocupado na vizinhança direta.
                                </p>
                              )}

                              <div className="pt-1 border-t border-purple-500/20 space-y-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setInteractiveTargetMode(m => m === 'pick_swap' ? 'none' : 'pick_swap');
                                  }}
                                  className={`w-full py-1.5 rounded-xl font-bold text-[11px] transition flex items-center justify-center space-x-1 ${
                                    interactiveTargetMode === 'pick_swap'
                                      ? 'bg-purple-600 text-white animate-pulse'
                                      : 'bg-purple-500/20 hover:bg-purple-500/30 text-purple-800 dark:text-purple-200'
                                  }`}
                                >
                                  <span>🎯</span>
                                  <span>
                                    {interactiveTargetMode === 'pick_swap'
                                      ? 'Aguardando clique na célula de destino...'
                                      : 'Clicar na Célula de Destino no Mapa'}
                                  </span>
                                </button>

                                <div className="flex items-center space-x-1.5">
                                  <input
                                    type="text"
                                    value={quickTargetAddressInput}
                                    onChange={e => setQuickTargetAddressInput(e.target.value.toUpperCase())}
                                    placeholder="Ex: RF.030.1"
                                    className="flex-1 px-2.5 py-1.5 rounded-xl bg-white dark:bg-white/10 border border-black/10 dark:border-white/10 text-xs font-mono"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (!quickTargetAddressInput.trim()) return;
                                      handleSwapSlots(activeItem, quickTargetAddressInput.trim());
                                      setQuickTargetAddressInput('');
                                    }}
                                    className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition shrink-0"
                                  >
                                    Trocar
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Standard Action Buttons */}
                        <div className="space-y-1.5">
                          <button
                            type="button"
                            onClick={() => openRelocateModalWithSku(activeItem)}
                            className="w-full py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs shadow transition"
                          >
                            ⇄ Remanejar Manualmente (Multi-níveis) (⌘R)
                          </button>
                          <button
                            type="button"
                            onClick={() => openAllocateOrEditSkuModal(activeItem)}
                            className="w-full py-2 rounded-xl bg-mac-blue hover:bg-blue-500 text-white font-semibold text-xs shadow transition"
                          >
                            ✏️ Editar Cadastro / Níveis
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const nextSkus = skus.filter(s => s.id !== activeItem.id);
                              setSkus(nextSkus);
                              persistCurrentState(nextSkus, movedSkusRegistry, transbordoRegistry);
                              playMacSound('pop', soundEnabled);
                              showToast(
                                'SKU Removido do Nível',
                                `${activeItem.code} liberou ${activeItem.wms}`,
                                '🗑️'
                              );
                            }}
                            className="w-full py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-600 text-rose-600 dark:text-rose-300 hover:text-white font-semibold text-xs transition"
                          >
                            🗑️ Liberar Apenas Este Nível ({activeItem.wms})
                          </button>
                        </div>
                      </div>
                    );
                  })()
                )}
              </div>

              {/* Bottom Google Sites Cloud Sync Banner */}
              <div className="pt-3 border-t border-black/10 dark:border-white/10 text-[11px] flex items-center justify-between text-slate-400">
                <span>Google Sites Ready</span>
                <button
                  type="button"
                  onClick={() => setShowCloudModal(true)}
                  className="text-mac-blue hover:underline font-bold"
                >
                  ☁️ Sincronizar / Exportar HTML
                </button>
              </div>
            </aside>
          </div>

          {/* ================================================================ */}
          {/* WINDOW FOOTER BAR                                                */}
          {/* ================================================================ */}
          {!isFullscreen && (
            <footer className="h-7 px-4 border-t border-black/10 dark:border-white/10 bg-white/40 dark:bg-black/25 flex items-center justify-between text-[11px] font-mono text-slate-500 dark:text-slate-400 shrink-0">
              <div className="flex items-center space-x-3">
                <span className="flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>WMS Ativo • {skus.length} Alocações</span>
                </span>
                <span className="hidden sm:inline">|</span>
                <span className="hidden sm:inline">
                  Selecionado: <strong className="text-mac-blue">{inspectedSlot.parsed.wms}</strong>
                </span>
              </div>
              <div className="flex items-center space-x-3">
                <span className="hidden md:inline">Atalhos: ⌘O Importar • ⌘R Remanejar • ⌘K Spotlight</span>
              </div>
            </footer>
          )}
        </div>
      </main>

      {/* ==================================================================== */}
      {/* MOBILE BOTTOM NAVIGATION BAR (TOUCH-OPTIMIZED, LG:HIDDEN)             */}
      {/* ==================================================================== */}
      {!isFullscreen && (
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-black/10 dark:border-white/10 px-2 py-1.5 pb-safe flex items-center justify-around shadow-2xl">
          {/* Tab 1: Ruas e Filtros */}
          <button
            type="button"
            onClick={() => {
              setSidebarOpenMobile(s => !s);
              setInspectorOpenMobile(false);
            }}
            className={`flex flex-col items-center justify-center min-w-[56px] min-h-[44px] py-1 px-2 rounded-xl transition ${
              sidebarOpenMobile ? 'text-mac-blue font-bold bg-mac-blue/15' : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            <span className="text-lg">🗂️</span>
            <span className="text-[10px] font-semibold mt-0.5 truncate max-w-[64px]">
              Rua {selectedStreet}
            </span>
          </button>

          {/* Tab 2: Modo de Visão (Cards vs Porta-Paletes) */}
          <button
            type="button"
            onClick={() => setMapMode(m => m === 'cards' ? 'rack' : 'cards')}
            className="flex flex-col items-center justify-center min-w-[56px] min-h-[44px] py-1 px-2 rounded-xl text-slate-600 dark:text-slate-300 hover:text-mac-blue transition"
          >
            <span className="text-lg">{mapMode === 'cards' ? '🏢' : '🃏'}</span>
            <span className="text-[10px] font-semibold mt-0.5">
              {mapMode === 'cards' ? 'P.-Paletes' : 'Cards'}
            </span>
          </button>

          {/* Tab 3: Transbordo Mini Pulmão */}
          <button
            type="button"
            onClick={() => setTransbordoSelectMode(t => !t)}
            className={`flex flex-col items-center justify-center min-w-[56px] min-h-[44px] py-1 px-2 rounded-xl transition relative ${
              transbordoSelectMode ? 'text-yellow-600 dark:text-yellow-300 font-bold bg-yellow-400/20' : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            <span className="text-lg">⚡</span>
            <span className="text-[10px] font-semibold mt-0.5">Transbordo</span>
            {transbordoCount > 0 && (
              <span className="absolute top-1 right-2 w-4 h-4 rounded-full bg-yellow-400 text-slate-950 font-bold text-[9px] flex items-center justify-center shadow">
                {transbordoCount}
              </span>
            )}
          </button>

          {/* Tab 4: Relatório D3 */}
          <button
            type="button"
            onClick={() => setShowReportModal(true)}
            className="flex flex-col items-center justify-center min-w-[56px] min-h-[44px] py-1 px-2 rounded-xl text-slate-600 dark:text-slate-300 hover:text-mac-blue transition"
          >
            <span className="text-lg">📊</span>
            <span className="text-[10px] font-semibold mt-0.5">Relatório</span>
          </button>

          {/* Tab 5: Inspetor Lateral */}
          <button
            type="button"
            onClick={() => {
              setInspectorOpenMobile(i => !i);
              setSidebarOpenMobile(false);
            }}
            className={`flex flex-col items-center justify-center min-w-[56px] min-h-[44px] py-1 px-2 rounded-xl transition relative ${
              inspectorOpenMobile ? 'text-mac-blue font-bold bg-mac-blue/15' : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            <span className="text-lg">ℹ️</span>
            <span className="text-[10px] font-semibold mt-0.5 truncate max-w-[64px]">
              {inspectedSlot.parsed.wms.split('.')[1] || 'Inspetor'}
            </span>
            {inspectedSlot.items.length > 0 && (
              <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-emerald-500" />
            )}
          </button>
        </nav>
      )}

      {/* ==================================================================== */}
      {/* RETRACTABLE MACOS DOCK (DESKTOP ONLY)                                */}
      {/* ==================================================================== */}
      {!isFullscreen && (
        <div className="hidden lg:flex fixed bottom-1.5 left-1/2 -translate-x-1/2 z-40 flex-col items-center pointer-events-none">
          <button
            type="button"
            onClick={() => setIsDockCollapsed(c => !c)}
            className="pointer-events-auto mb-1 px-3 py-0.5 rounded-full bg-black/55 dark:bg-slate-900/80 text-white text-[10px] font-mono font-semibold backdrop-blur-md border border-white/15 shadow hover:bg-mac-blue transition"
          >
            {isDockCollapsed ? '▲ Mostrar Dock' : '▼ Ocultar Dock'}
          </button>

          {!isDockCollapsed && (
            <nav className="mac-dock px-3 py-1.5 rounded-2xl flex items-center space-x-2 pointer-events-auto">
              <button
                type="button"
                onClick={() => {
                  setIsMinimized(false);
                  setMapMode('cards');
                }}
                className="dock-item w-10 h-10 rounded-xl bg-gradient-to-b from-sky-400 to-blue-600 flex items-center justify-center text-lg shadow-lg text-white"
                title="Modo Cards (Colmeias)"
              >
                🗺️
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsMinimized(false);
                  setMapMode('rack');
                }}
                className="dock-item w-10 h-10 rounded-xl bg-gradient-to-b from-indigo-400 to-indigo-700 flex items-center justify-center text-lg shadow-lg text-white"
                title="Modo Matriz Porta-Paletes"
              >
                🏢
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsMinimized(false);
                  selectStreet('RF');
                }}
                className="dock-item w-10 h-10 rounded-xl bg-gradient-to-b from-amber-400 to-orange-600 flex items-center justify-center text-lg shadow-lg text-white"
                title="Reserva Coleção 35 (RF a RH)"
              >
                ⭐
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsMinimized(false);
                  selectStreet('AA');
                }}
                className="dock-item w-10 h-10 rounded-xl bg-gradient-to-b from-cyan-400 to-teal-700 flex items-center justify-center text-lg shadow-lg text-white"
                title="Ala de Acessórios (AA a AF)"
              >
                🧣
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsMinimized(false);
                  selectStreet('PA');
                }}
                className="dock-item w-10 h-10 rounded-xl bg-gradient-to-b from-violet-400 to-indigo-700 flex items-center justify-center text-lg shadow-lg text-white"
                title="Pulmão Temporário (PA a PI)"
              >
                📦
              </button>
              <button
                type="button"
                onClick={() => setTransbordoSelectMode(m => !m)}
                className="dock-item w-10 h-10 rounded-xl bg-gradient-to-b from-yellow-300 to-amber-500 flex items-center justify-center text-lg shadow-lg text-slate-950 font-extrabold"
                title="Modo Transbordo (Mini Pulmão)"
              >
                ⚡
              </button>
              <div className="h-7 w-[1px] bg-black/15 dark:bg-white/20 mx-1" />
              <button
                type="button"
                onClick={() => setShowImportModal(true)}
                className="dock-item w-10 h-10 rounded-xl bg-gradient-to-b from-emerald-400 to-teal-600 flex items-center justify-center text-lg shadow-lg text-white"
                title="Importar Planilha CSV (⌘O)"
              >
                📥
              </button>
              <button
                type="button"
                onClick={() => openAllocateOrEditSkuModal(null)}
                className="dock-item w-10 h-10 rounded-xl bg-gradient-to-b from-blue-500 to-blue-700 flex items-center justify-center text-lg shadow-lg text-white"
                title="Alocar Novo SKU (⌘N)"
              >
                ➕
              </button>
              <button
                type="button"
                onClick={() => openRelocateModalWithSku(null)}
                className="dock-item w-10 h-10 rounded-xl bg-gradient-to-b from-purple-400 to-fuchsia-700 flex items-center justify-center text-lg shadow-lg text-white"
                title="Remanejar SKU (⌘R)"
              >
                ⇄
              </button>
              <button
                type="button"
                onClick={() => setShowCloudModal(true)}
                className="dock-item w-10 h-10 rounded-xl bg-gradient-to-b from-slate-600 to-slate-800 flex items-center justify-center text-lg shadow-lg text-white"
                title="Salvar no Google Sites / Nuvem"
              >
                ☁️
              </button>
            </nav>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 1: IMPORT CSV                                                  */}
      {/* ==================================================================== */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="mac-window mac-sheet w-full max-w-xl rounded-2xl overflow-hidden shadow-2xl border border-white/20">
            <div className="px-5 py-3.5 border-b border-black/10 dark:border-white/10 flex items-center justify-between bg-emerald-500/10">
              <div className="flex items-center space-x-2">
                <span className="text-lg">📥</span>
                <div>
                  <h3 className="font-display font-bold text-sm">
                    Importar Planilha de Endereçamento (.CSV)
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Compatível com SISPLAN (CODIGO;COR;TAMANHO;DEPOSITO;LOCAL) e Mapa CSV (8 colunas)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="text-slate-400 hover:text-slate-200 text-sm"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs max-h-[82vh] overflow-y-auto">
              <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-emerald-500/40 rounded-2xl bg-emerald-500/5 hover:bg-emerald-500/10 cursor-pointer transition text-center">
                <span className="text-2xl mb-1">📄</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-300">
                  {csvFileName}
                </span>
                <input
                  type="file"
                  accept=".csv,.txt"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setCsvFileName(`Arquivo carregado: ${file.name}`);
                    const reader = new FileReader();
                    reader.onload = ev => {
                      setCsvPasteText(String(ev.target?.result || ''));
                    };
                    reader.readAsText(file, 'UTF-8');
                  }}
                />
              </label>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-semibold text-slate-400">
                    Ou cole as linhas do CSV abaixo:
                  </label>
                  <button
                    type="button"
                    onClick={() => setCsvPasteText(SAMPLE_CSV_DATA)}
                    className="text-[11px] text-mac-blue hover:underline font-semibold"
                  >
                    ⚡ Carregar Planilha de Exemplo
                  </button>
                </div>
                <textarea
                  rows={5}
                  value={csvPasteText}
                  onChange={e => setCsvPasteText(e.target.value)}
                  placeholder={'CODIGO;COR;TAMANHO;DEPOSITO;LOCAL\n11060127;102;M;2;RF.001.1 - 4'}
                  className="w-full p-3 rounded-xl bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/15 font-mono text-[11px] focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center justify-between bg-black/5 dark:bg-white/5 p-3 rounded-xl">
                <div className="flex items-center space-x-4">
                  <label className="flex items-center space-x-1.5 cursor-pointer">
                    <input
                      type="radio"
                      checked={csvImportMode === 'merge'}
                      onChange={() => setCsvImportMode('merge')}
                    />
                    <span>Mesclar ao mapa atual</span>
                  </label>
                  <label className="flex items-center space-x-1.5 cursor-pointer">
                    <input
                      type="radio"
                      checked={csvImportMode === 'replace'}
                      onChange={() => setCsvImportMode('replace')}
                    />
                    <span>Substituir todo o mapa</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-black/10 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="px-4 py-2 rounded-xl bg-black/5 dark:bg-white/10 font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const res = parseCsvData(
                      csvPasteText,
                      skus,
                      barraItems,
                      transbordoRegistry,
                      csvImportMode
                    );
                    setSkus(res.skus);
                    setBarraItems(res.barraItems);
                    setTransbordoRegistry(res.transbordoRegistry);
                    const nextMoved = csvImportMode === 'replace' ? {} : movedSkusRegistry;
                    if (csvImportMode === 'replace') {
                      setOriginalBaselineLocations(buildBaselineFromSkus(res.skus));
                      setMovedSkusRegistry({});
                    }
                    if (res.firstRua) selectStreet(res.firstRua);
                    if (res.firstWms) setSelectedAddressKey(res.firstWms);
                    setRawImportedCsv(csvPasteText);
                    persistCurrentState(
                      res.skus,
                      nextMoved,
                      res.transbordoRegistry,
                      res.barraItems,
                      csvPasteText
                    );
                    setShowImportModal(false);
                    playMacSound('success', soundEnabled);
                    showToast(
                      'Importação Concluída',
                      `${res.importedCount} posições e quantidades de peças carregadas.`,
                      '📥'
                    );
                  }}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-lg transition"
                >
                  Processar e Mapear CSV
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 2: ALLOCATE / EDIT SKU                                         */}
      {/* ==================================================================== */}
      {showSkuModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="mac-window mac-sheet w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl border border-white/20">
            <div className="px-5 py-3.5 border-b border-black/10 dark:border-white/10 flex items-center justify-between bg-white/30 dark:bg-black/20">
              <div className="flex items-center space-x-2">
                <span>📦</span>
                <h3 className="font-display font-bold text-sm">
                  {skuFormEditId ? 'Editar SKU no Endereço' : 'Alocar SKU em Endereço WMS'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSkuModal(false)}
                className="text-slate-400 hover:text-slate-200 text-sm"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={e => {
                e.preventDefault();
                if (!isValidPositionInStreet(skuFormRua, skuFormPos)) {
                  playMacSound('alert', soundEnabled);
                  showToast(
                    `Torre ${skuFormPos} Inválida na Rua ${skuFormRua}!`,
                    getStreetPositionRuleDescription(skuFormRua),
                    '🚨'
                  );
                  return;
                }
                const dec = decodeSkuPrefix(skuFormCode, skuFormColor, skuFormSize);
                const groupedLocal = formatLevelsToSisplanLocal(
                  skuFormRua,
                  skuFormPos,
                  skuFormSelectedLevels
                );
                const skuKey = getCanonicalSkuKey(skuFormCode);
                const filtered = skus.filter(
                  s => getCanonicalSkuKey(s.code) !== skuKey && s.id !== skuFormEditId
                );

                const created: SkuItem[] = skuFormSelectedLevels.map((lv, idx) => ({
                  id: idx === 0 && skuFormEditId ? skuFormEditId : `sku-${Date.now()}-${lv}-${idx}`,
                  code: skuFormCode.trim().toUpperCase(),
                  codigoBase: dec.dMarca + dec.dEtiqueta + dec.dGrupo + dec.modelSeq,
                  name: skuFormName.trim() || dec.autoName,
                  brand: dec.marca,
                  label: dec.etiqueta,
                  groupCode: dec.dGrupo,
                  groupName: dec.grupo,
                  colorCode: dec.colorCode,
                  colorName: dec.colorName,
                  colorHex: dec.colorHex,
                  size: dec.size,
                  deposito: skuFormDeposito || '2',
                  rua: skuFormRua,
                  pos: skuFormPos,
                  nivel: lv,
                  wms: formatWmsAddress(skuFormRua, skuFormPos, lv),
                  rawLocal: groupedLocal,
                  colecao: skuFormColecao,
                  qty: skuFormQty,
                  icon: dec.icon
                }));

                const nextSkus = [...created, ...filtered];
                setSkus(nextSkus);
                selectStreet(skuFormRua);
                setSelectedAddressKey(created[0].wms);
                setSelectedSkuId(created[0].id);
                persistCurrentState(nextSkus, movedSkusRegistry, transbordoRegistry);
                setShowSkuModal(false);
                playMacSound('success', soundEnabled);
                showToast('SKU Alocado no Mapa', `${skuFormCode} salvo em ${groupedLocal}`, '🏢');
              }}
              className="p-5 space-y-3.5 text-xs max-h-[82vh] overflow-y-auto"
            >
              {/* Aero Taxonomy Builder */}
              <div className="p-3 rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 space-y-2.5">
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">1º Díg. Marca</label>
                    <select
                      value={skuFormBrand}
                      onChange={e => {
                        const b = e.target.value;
                        setSkuFormBrand(b);
                        setSkuFormCode(
                          `${b}${skuFormLabel}${skuFormGroup}${skuFormSeq} - ${skuFormColor} - ${skuFormSize}`
                        );
                      }}
                      className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-black/10 dark:border-white/15 font-mono text-[11px]"
                    >
                      {Object.entries(AERO_BRANDS).map(([k, v]) => (
                        <option key={k} value={k}>
                          {k} - {v}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">2º Etiqueta</label>
                    <select
                      value={skuFormLabel}
                      onChange={e => {
                        const l = e.target.value;
                        setSkuFormLabel(l);
                        setSkuFormCode(
                          `${skuFormBrand}${l}${skuFormGroup}${skuFormSeq} - ${skuFormColor} - ${skuFormSize}`
                        );
                      }}
                      className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-black/10 dark:border-white/15 font-mono text-[11px]"
                    >
                      {Object.entries(AERO_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>
                          {k} - {v}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">3º–4º Grupo</label>
                    <select
                      value={skuFormGroup}
                      onChange={e => {
                        const g = e.target.value;
                        setSkuFormGroup(g);
                        setSkuFormCode(
                          `${skuFormBrand}${skuFormLabel}${g}${skuFormSeq} - ${skuFormColor} - ${skuFormSize}`
                        );
                      }}
                      className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-black/10 dark:border-white/15 font-mono text-[11px]"
                    >
                      {Object.entries(AERO_GROUPS).map(([k, v]) => (
                        <option key={k} value={k}>
                          {k} - {v.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">5º–8º Seq.</label>
                    <input
                      type="text"
                      maxLength={4}
                      value={skuFormSeq}
                      onChange={e => {
                        const sq = e.target.value.replace(/\D/g, '').padStart(4, '0');
                        setSkuFormSeq(e.target.value);
                        setSkuFormCode(
                          `${skuFormBrand}${skuFormLabel}${skuFormGroup}${sq} - ${skuFormColor} - ${skuFormSize}`
                        );
                      }}
                      className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-black/10 dark:border-white/15 font-mono text-[11px] font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">Cor Oficial</label>
                    <select
                      value={skuFormColor}
                      onChange={e => {
                        const c = e.target.value;
                        setSkuFormColor(c);
                        setSkuFormCode(
                          `${skuFormBrand}${skuFormLabel}${skuFormGroup}${skuFormSeq} - ${c} - ${skuFormSize}`
                        );
                      }}
                      className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-black/10 dark:border-white/15 font-mono text-[11px]"
                    >
                      {Object.entries(OFFICIAL_COLORS).map(([k, v]) => (
                        <option key={k} value={k}>
                          {k} - {v.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">Tamanho</label>
                    <input
                      type="text"
                      value={skuFormSize}
                      onChange={e => {
                        const sz = e.target.value.toUpperCase();
                        setSkuFormSize(sz);
                        setSkuFormCode(
                          `${skuFormBrand}${skuFormLabel}${skuFormGroup}${skuFormSeq} - ${skuFormColor} - ${sz}`
                        );
                      }}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-black/10 dark:border-white/15 font-mono text-[11px] font-bold"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-[11px] font-semibold mb-1 text-slate-400">
                    SKU Completo (CODIGO - COR - TAMANHO)
                  </label>
                  <input
                    type="text"
                    required
                    value={skuFormCode}
                    onChange={e => setSkuFormCode(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/15 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold mb-1 text-slate-400">
                    Qtd Peças
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={skuFormQty}
                    onChange={e => setSkuFormQty(parseInt(e.target.value, 10) || 1)}
                    className="w-full px-3 py-2 rounded-xl bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/15 font-mono font-bold"
                  />
                </div>
              </div>

              {/* Address & Multi-level Selector */}
              <div className="p-3 rounded-xl bg-mac-blue/10 border border-mac-blue/30 space-y-2.5">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold text-mac-blue">
                    📍 Endereço Físico (Mesma Torre p/ Todos os Níveis)
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      const sug = findMultiLevelFreeColumnInStreet(
                        skuFormRua,
                        Math.max(1, skuFormSelectedLevels.length),
                        skuFormPos + 1
                      );
                      if (sug) {
                        setSkuFormPos(sug.pos);
                        setSkuFormSelectedLevels(sug.levels);
                        playMacSound('pop', soundEnabled);
                      }
                    }}
                    className="px-2 py-0.5 rounded-lg bg-mac-blue text-white text-[10px] font-semibold"
                  >
                    ✨ Sugerir Torre Livre
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-semibold mb-1 text-slate-400">
                      Rua
                    </label>
                    <select
                      value={skuFormRua}
                      onChange={e => setSkuFormRua(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-black/10 dark:border-white/15 font-mono font-bold"
                    >
                      {STREETS.map(r => (
                        <option key={r} value={r}>
                          Rua {r} ({STREET_META[r].badge})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold mb-1 text-slate-400">
                      Posição / Torre
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={175}
                      value={skuFormPos}
                      onChange={e => setSkuFormPos(parseInt(e.target.value, 10) || 1)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-black/10 dark:border-white/15 font-mono font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-300 mb-1">
                    🏢 Selecione 1 ou mais Níveis na Torre:
                  </label>
                  <div className="grid grid-cols-7 gap-1 font-mono text-[10px]">
                    {Array.from(
                      { length: getMaxLevelsForStreet(skuFormRua, skuFormPos) },
                      (_, i) => i + 1
                    ).map(lv => {
                      const sel = skuFormSelectedLevels.includes(lv);
                      return (
                        <button
                          key={lv}
                          type="button"
                          onClick={() => {
                            setSkuFormSelectedLevels(prev =>
                              prev.includes(lv)
                                ? prev.length > 1
                                  ? prev.filter(x => x !== lv)
                                  : prev
                                : [...prev, lv].sort((a, b) => a - b)
                            );
                          }}
                          className={`py-1.5 rounded-lg border font-bold transition ${
                            sel
                              ? 'bg-mac-blue text-white border-mac-blue'
                              : 'bg-white/60 dark:bg-slate-800 border-black/10 dark:border-white/10'
                          }`}
                        >
                          N{lv}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-black/10 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setShowSkuModal(false)}
                  className="px-4 py-2 rounded-xl bg-black/5 dark:bg-white/10 font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-mac-blue hover:bg-blue-500 text-white font-semibold shadow-lg transition"
                >
                  Salvar no Endereço
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 3: RELOCATE SKU (⌘R)                                           */}
      {/* ==================================================================== */}
      {showRelocateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="mac-window mac-sheet w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl border border-white/20">
            <div className="px-5 py-3.5 border-b border-black/10 dark:border-white/10 flex items-center justify-between bg-amber-500/15">
              <div className="flex items-center space-x-2">
                <span className="text-lg">⇄</span>
                <div>
                  <h3 className="font-display font-bold text-sm">
                    Remanejar SKU de Endereço
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Move todos os níveis do SKU juntos para outra torre ou rua
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowRelocateModal(false)}
                className="text-slate-400 hover:text-slate-200 text-sm"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={e => {
                e.preventDefault();
                const targetSku =
                  skus.find(s => s.id === relocateSkuId) ||
                  skus.find(s => s.code.toUpperCase().includes(relocateSearchInput.toUpperCase()));
                if (!targetSku) return;

                if (!isValidPositionInStreet(relocateNewRua, relocateNewPos)) {
                  playMacSound('alert', soundEnabled);
                  showToast(
                    `Torre ${relocateNewPos} Inválida na Rua ${relocateNewRua}!`,
                    getStreetPositionRuleDescription(relocateNewRua),
                    '🚨'
                  );
                  return;
                }

                const multi = getSkuMultiLevelInfo(targetSku);
                const levelsToUse =
                  relocateMoveAllLevels && relocateSelectedLevels.length > 0
                    ? relocateSelectedLevels
                    : [relocateNewNivel];
                const newRawLocal = formatLevelsToSisplanLocal(
                  relocateNewRua,
                  relocateNewPos,
                  levelsToUse
                );
                const oldRaw = targetSku.rawLocal || targetSku.wms;
                const sibIds = new Set(multi.siblingItems.map(s => s.id));

                const nextSkus = skus.map(item => {
                  if (!sibIds.has(item.id)) return item;
                  const idx = multi.siblingItems.findIndex(s => s.id === item.id);
                  const lv = levelsToUse[idx] || levelsToUse[0];
                  return {
                    ...item,
                    lastRelocatedFrom: item.wms,
                    rua: relocateNewRua,
                    pos: relocateNewPos,
                    nivel: lv,
                    wms: formatWmsAddress(relocateNewRua, relocateNewPos, lv),
                    rawLocal: newRawLocal,
                    colecao: isReservedCol35Street(relocateNewRua) ? '35' : item.colecao
                  };
                });

                const { nextMoved } = recordSkuMoved(
                  targetSku,
                  oldRaw,
                  newRawLocal,
                  'relocate',
                  movedSkusRegistry
                );
                setSkus(nextSkus);
                setMovedSkusRegistry(nextMoved);
                selectStreet(relocateNewRua);
                setSelectedAddressKey(formatWmsAddress(relocateNewRua, relocateNewPos, levelsToUse[0]));
                persistCurrentState(nextSkus, nextMoved, transbordoRegistry);
                setShowRelocateModal(false);
                playMacSound('success', soundEnabled);
                showToast('SKU Remanejado', `${targetSku.code}: ${oldRaw} → ${newRawLocal}`, '⇄');
              }}
              className="p-5 space-y-4 text-xs"
            >
              <div>
                <label className="block text-[11px] font-semibold mb-1 text-slate-400">
                  Selecionar SKU Cadastrado
                </label>
                <select
                  value={relocateSkuId}
                  onChange={e => {
                    const id = e.target.value;
                    setRelocateSkuId(id);
                    const found = skus.find(s => s.id === id);
                    if (found) {
                      const m = getSkuMultiLevelInfo(found);
                      setRelocateSearchInput(found.code);
                      setRelocateNewRua(found.rua);
                      setRelocateNewPos(found.pos);
                      setRelocateSelectedLevels(m.levels);
                    }
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/15 font-mono text-xs"
                >
                  {skus.slice(0, 300).map(s => (
                    <option key={s.id} value={s.id}>
                      {s.wms} — {s.code} ({s.name})
                    </option>
                  ))}
                </select>
              </div>

              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                    2. Novo Endereço de Destino
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      const sug = findMultiLevelFreeColumnInStreet(
                        relocateNewRua,
                        Math.max(1, relocateSelectedLevels.length),
                        relocateNewPos + 1
                      );
                      if (sug) {
                        setRelocateNewPos(sug.pos);
                        setRelocateSelectedLevels(sug.levels);
                        setRelocateNewNivel(sug.levels[0]);
                        playMacSound('pop', soundEnabled);
                      }
                    }}
                    className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[10px] font-semibold"
                  >
                    ✨ Sugerir Coluna Livre
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] font-semibold mb-1 text-slate-400">
                      Nova Rua
                    </label>
                    <select
                      value={relocateNewRua}
                      onChange={e => setRelocateNewRua(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-black/10 dark:border-white/15 font-mono font-bold"
                    >
                      {STREETS.map(r => (
                        <option key={r} value={r}>
                          Rua {r}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold mb-1 text-slate-400">
                      Nova Posição
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={175}
                      value={relocateNewPos}
                      onChange={e => setRelocateNewPos(parseInt(e.target.value, 10) || 1)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-black/10 dark:border-white/15 font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold mb-1 text-slate-400">
                      Nível Principal
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={7}
                      value={relocateNewNivel}
                      onChange={e => setRelocateNewNivel(parseInt(e.target.value, 10) || 1)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-black/10 dark:border-white/15 font-mono font-bold"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-black/10 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setShowRelocateModal(false)}
                  className="px-4 py-2 rounded-xl bg-black/5 dark:bg-white/10 font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow-lg transition"
                >
                  Confirmar Remanejamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 4: GOOGLE SITES CLOUD SYNC & CLEAN HTML EXPORTER               */}
      {/* ==================================================================== */}
      {showCloudModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="mac-window mac-sheet w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl border border-white/20">
            <div className="px-5 py-3.5 border-b border-black/10 dark:border-white/10 flex items-center justify-between bg-amber-500/15">
              <div className="flex items-center space-x-2.5">
                <span className="text-xl">☁️</span>
                <div>
                  <h3 className="font-display font-extrabold text-sm">
                    Central Google Sites — Sincronização & Exportação HTML Otimizada
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Sincronize em tempo real via Google Apps Script ou baixe o HTML limpo para Incorporar Código
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCloudModal(false)}
                className="text-slate-400 hover:text-slate-200 text-sm"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs max-h-[82vh] overflow-y-auto">
              {/* Real-Time Google Sheets Cloud Sync */}
              <div className="p-4 rounded-2xl bg-emerald-500/10 border-2 border-emerald-500/40 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-display font-extrabold text-xs sm:text-sm text-emerald-700 dark:text-emerald-300">
                    ☁️ 1. Sincronização Automática em Nuvem (Planilha Google)
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white font-mono text-[10px] font-bold">
                    {cloudStatusText}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                  Com a URL do Google Apps Script abaixo, qualquer alteração ou importação de CSV é salva automaticamente na Planilha Google e compartilhada com todos os operadores no Google Sites (com fallback JSONP anti-CORS).
                </p>

                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="url"
                    value={cloudSyncUrl}
                    onChange={e => {
                      setCloudSyncUrl(e.target.value);
                      setSavedCloudSyncUrl(e.target.value);
                    }}
                    placeholder="https://script.google.com/macros/s/.../exec"
                    className="flex-1 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-emerald-500/40 font-mono text-[11px]"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      setCloudStatus('syncing');
                      setCloudStatusText('Enviando...');
                      const csv = buildSisplanCsvString(skus, transbordoRegistry);
                      const ok = await pushStateToCloud(cloudSyncUrl, csv);
                      setCloudStatus(ok ? 'ok' : 'error');
                      setCloudStatusText(ok ? 'Sincronizado!' : 'Falha na Rede');
                      playMacSound(ok ? 'success' : 'alert', soundEnabled);
                      showToast(
                        ok ? 'Nuvem Google Atualizada!' : 'Aviso de Conexão',
                        ok
                          ? 'Todos os dados foram gravados na Planilha Google.'
                          : 'Salvo no navegador local.',
                        '☁️'
                      );
                    }}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow transition shrink-0"
                  >
                    ☁️ Sincronizar Agora
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      setCloudStatus('syncing');
                      setCloudStatusText('Baixando...');
                      const data = await pullStateFromCloud(cloudSyncUrl);
                      if (data && data.csv) {
                        const res = parseCsvData(data.csv, [], [], transbordoRegistry, 'replace');
                        setSkus(res.skus);
                        setBarraItems(res.barraItems);
                        setTransbordoRegistry(res.transbordoRegistry);
                        setCloudStatus('ok');
                        setCloudStatusText('Atualizado da Nuvem');
                        playMacSound('success', soundEnabled);
                        showToast('Dados Recebidos da Nuvem', `${res.skus.length} posições carregadas.`, '📥');
                      } else {
                        setCloudStatus('error');
                        setCloudStatusText('Sem Dados Novos');
                      }
                    }}
                    className="px-3 py-2 rounded-xl bg-mac-blue hover:bg-blue-500 text-white font-bold text-xs shadow transition shrink-0"
                  >
                    🔄 Puxar da Nuvem
                  </button>
                </div>
              </div>

              {/* Clean Single-File HTML Exporter for Google Sites */}
              <div className="p-4 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-display font-bold text-xs text-amber-600 dark:text-amber-300">
                    📄 2. Gerador de Código HTML Otimizado p/ Google Sites (Incorporar Código)
                  </span>
                  <span className="font-mono text-[10px] text-slate-400">
                    Limpo de lixo DOM • 85% mais leve
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Gera o arquivo único `.HTML` com todos os seus SKUs, Colmeias de Transbordo e URL da Nuvem embutidos no código-fonte, removendo tags duplicadas do Google Sites.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    disabled={isGeneratingHtml}
                    onClick={async () => {
                      setIsGeneratingHtml(true);
                      const html = await generateCleanStandaloneHtml(
                        skus,
                        transbordoRegistry,
                        cloudSyncUrl
                      );
                      setGeneratedHtmlCode(html);
                      setIsGeneratingHtml(false);
                      try {
                        await navigator.clipboard.writeText(html);
                        playMacSound('success', soundEnabled);
                        showToast(
                          'Código HTML Copiado!',
                          'Cole em Google Sites -> Incorporar -> Incorporar código.',
                          '📋'
                        );
                      } catch {
                        playMacSound('pop', soundEnabled);
                      }
                    }}
                    className="py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs shadow-lg transition flex items-center justify-center space-x-2"
                  >
                    <span>📋</span>
                    <span>
                      {isGeneratingHtml
                        ? 'Gerando HTML Otimizado...'
                        : 'Copiar Código HTML Atualizado'}
                    </span>
                  </button>

                  <button
                    type="button"
                    disabled={isGeneratingHtml}
                    onClick={async () => {
                      setIsGeneratingHtml(true);
                      const html = await generateCleanStandaloneHtml(
                        skus,
                        transbordoRegistry,
                        cloudSyncUrl
                      );
                      setGeneratedHtmlCode(html);
                      setIsGeneratingHtml(false);
                      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `estoque_macos_otimizado_${new Date().toISOString().slice(0, 10)}.html`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                      playMacSound('success', soundEnabled);
                      showToast('HTML Otimizado Baixado!', 'Pronto para o Google Sites.', '💾');
                    }}
                    className="py-2.5 px-4 rounded-xl bg-mac-blue hover:bg-blue-500 text-white font-bold text-xs shadow-lg transition flex items-center justify-center space-x-2"
                  >
                    <span>💾</span>
                    <span>Baixar Arquivo .HTML Otimizado</span>
                  </button>
                </div>

                {generatedHtmlCode && (
                  <textarea
                    readOnly
                    rows={3}
                    value={generatedHtmlCode}
                    onClick={e => (e.target as HTMLTextAreaElement).select()}
                    className="w-full p-2.5 rounded-xl bg-black/10 dark:bg-white/10 border border-black/15 dark:border-white/15 font-mono text-[10px] text-slate-500"
                  />
                )}
              </div>

              <div className="flex justify-end pt-2 border-t border-black/10 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setShowCloudModal(false)}
                  className="px-5 py-2 rounded-xl bg-black/10 dark:bg-white/10 font-semibold"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 5: SPOTLIGHT SEARCH (⌘K)                                       */}
      {/* ==================================================================== */}
      {showSpotlight && (
        <div
          onClick={() => setShowSpotlight(false)}
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-start justify-center pt-20 p-4"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="mac-window mac-sheet w-full max-w-xl rounded-2xl overflow-hidden shadow-2xl border border-white/25"
          >
            <div className="px-4 py-3 flex items-center space-x-3 border-b border-black/10 dark:border-white/10">
              <span className="text-xl text-mac-blue">🔍</span>
              <input
                type="text"
                autoFocus
                value={spotlightQuery}
                onChange={e => setSpotlightQuery(e.target.value)}
                placeholder="Spotlight WMS: Digite um endereço (ex: RG.015.2) ou SKU..."
                className="w-full bg-transparent text-base font-medium focus:outline-none"
              />
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 text-slate-400">
                ESC
              </span>
            </div>
            <div className="max-h-80 overflow-y-auto p-2 divide-y divide-black/5 dark:divide-white/5 text-xs">
              {skus
                .filter(s => {
                  const q = spotlightQuery.trim().toUpperCase();
                  if (!q) return true;
                  return (
                    s.code.toUpperCase().includes(q) ||
                    s.wms.toUpperCase().includes(q) ||
                    s.name.toUpperCase().includes(q)
                  );
                })
                .slice(0, 25)
                .map(s => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      selectStreet(s.rua);
                      setSelectedAddressKey(s.wms);
                      setSelectedSkuId(s.id);
                      setSelectedRangeId('ALL-OCCUPIED');
                      setShowSpotlight(false);
                    }}
                    className="w-full px-3 py-2 text-left hover:bg-mac-blue hover:text-white rounded-xl transition flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-2 truncate">
                      <span>{s.icon || '📦'}</span>
                      <span className="font-mono font-bold">{s.code}</span>
                      <span className="opacity-75 truncate">{s.name}</span>
                    </div>
                    <span className="font-mono font-extrabold text-[11px] px-2 py-0.5 rounded bg-black/10 dark:bg-white/10">
                      {s.wms}
                    </span>
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 6: ABOUT / QUICK LOOK                                          */}
      {/* ==================================================================== */}
      {showAboutModal && (
        <div
          onClick={() => setShowAboutModal(false)}
          className="fixed inset-0 bg-black/45 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="mac-window mac-sheet w-full max-w-md rounded-2xl overflow-hidden shadow-2xl border border-white/25 p-6 text-center space-y-3"
          >
            <div className="w-14 h-14 mx-auto rounded-2xl bg-mac-blue text-white flex items-center justify-center text-2xl shadow-lg">
              ✈️
            </div>
            <h3 className="font-display font-extrabold text-base">
              EstoqueOS Sequoia — Mapa Visual WMS
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Ruas RA a RH • Reserva Coleção 35 (RF–RH) • Ala de Acessórios (AA–AF) • Pulmão Temporário (PA–PI)
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Otimizado para incorporação direta no Google Sites com trava zero-scroll, sincronização em nuvem via Google Apps Script (JSONP/CORS-free) e exportador de código HTML limpo.
            </p>
            <button
              type="button"
              onClick={() => setShowAboutModal(false)}
              className="px-5 py-1.5 rounded-xl bg-mac-blue text-white text-xs font-semibold"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 7: D3 ANALYTICS REPORT MODAL                                   */}
      {/* ==================================================================== */}
      <ErrorBoundary fallbackTitle="Falha ao renderizar Relatório Executivo D3">
        <ReportModal
          isOpen={showReportModal}
          onClose={() => setShowReportModal(false)}
          skus={skus}
          barraItems={barraItems}
          transbordoRegistry={transbordoRegistry}
          wmsPerspective={wmsPerspective}
          onSelectStreet={rua => {
            setSelectedStreet(rua);
            setSelectedRangeId('1-20');
          }}
        />
      </ErrorBoundary>

      {/* ==================================================================== */}
      {/* MODAL 8: INVENTORY AUDIT MODAL (CONFLICTS & INVADERS TABLE)          */}
      {/* ==================================================================== */}
      <ErrorBoundary fallbackTitle="Falha ao renderizar Painel de Auditoria de Inventário">
        <InventoryAuditModal
          isOpen={showAuditModal}
          onClose={() => setShowAuditModal(false)}
          skus={skus}
          barraItems={barraItems}
          wmsPerspective={wmsPerspective}
          conflictAnalysis={conflictAnalysis}
          addressMap={addressMap}
          onNavigateToSlot={(wms, rua) => {
            setShowAuditModal(false);
            setSelectedStreet(rua);
            const parts = wms.split('.');
            const pos = parseInt(parts[1], 10);
            if (!isNaN(pos)) {
              if (pos >= 1 && pos <= 20) setSelectedRangeId('1-20');
              else if (pos >= 21 && pos <= 40) setSelectedRangeId('21-40');
              else if (pos >= 41 && pos <= 60) setSelectedRangeId('41-60');
              else if (pos >= 61 && pos <= 80) setSelectedRangeId('61-80');
              else if (pos >= 81 && pos <= 100) setSelectedRangeId('81-100');
              else if (pos >= 101 && pos <= 120) setSelectedRangeId('101-120');
              else if (pos >= 121 && pos <= 140) setSelectedRangeId('121-140');
              else setSelectedRangeId('ALL-OCCUPIED');
            }
            setSelectedAddressKey(wms);
            const items = addressMap.get(wms) || [];
            if (items[0]) setSelectedSkuId(items[0].id);
            setInspectorOpenMobile(true);
            setInspectorCollapsedDesktop(false);
            showToast(`Endereço ${wms} Selecionado`, `Localizado na Rua ${rua}.`, '🎯');
          }}
        />
      </ErrorBoundary>

      {/* ==================================================================== */}
      {/* MODAL 9: AUTOSAVE & AUTO-REFRESH AUTOMATION MODAL                    */}
      {/* ==================================================================== */}
      <ErrorBoundary fallbackTitle="Falha ao carregar Painel de Auto-Salvamento">
        <AutoSaveModal
          isOpen={showAutoSaveModal}
          onClose={() => setShowAutoSaveModal(false)}
          isAutoSaveEnabled={isAutoSaveEnabled}
          onToggleAutoSave={setIsAutoSaveEnabled}
          autoSaveIntervalSeconds={autoSaveIntervalSeconds}
          onChangeInterval={sec => {
            setAutoSaveIntervalSeconds(sec);
            setAutoSaveCountdown(sec);
            showToast('Intervalo Atualizado', `Auto-salvamento ajustado para ${Math.round(sec / 60)} min.`, '⏱️');
          }}
          autoRefreshMode={autoRefreshMode}
          onChangeRefreshMode={setAutoRefreshMode}
          countdownSeconds={autoSaveCountdown}
          lastSavedAt={lastSavedTimestamp}
          onSaveNow={() => {
            executeManualSave();
            setShowAutoSaveModal(false);
          }}
          onSaveAndReloadNow={() => {
            setShowAutoSaveModal(false);
            executeSaveAndReload();
          }}
          cloudSyncConfigured={Boolean(cloudSyncUrl)}
          cloudStatusText={cloudStatusText}
        />
      </ErrorBoundary>

      {/* ==================================================================== */}
      {/* TOAST NOTIFICATION                                                   */}
      {/* ==================================================================== */}
      <div
        className={`fixed top-10 right-4 z-50 transition-all duration-300 pointer-events-none ${
          toast.visible ? 'translate-x-0 opacity-100' : 'translate-x-8 opacity-0'
        }`}
      >
        <div className="mac-window px-4 py-2.5 rounded-2xl shadow-xl flex items-center space-x-3 text-xs border border-white/20">
          <span className="text-lg">{toast.icon}</span>
          <div>
            <p className="font-bold">{toast.title}</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">{toast.subtitle}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
