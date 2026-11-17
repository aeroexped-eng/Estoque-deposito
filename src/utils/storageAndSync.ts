import {
  SkuItem,
  TransbordoEntry,
  MovedSkuEntry,
  expandSisplanLocal,
  formatCanonicalSkuDisplay,
  decodeSkuPrefix,
  isReservedCol35Street,
  getCanonicalSkuKey,
  formatLevelsToSisplanLocal,
  formatWmsAddress
} from '../constants/wmsConstants';

export const EMBEDDED_CLOUD_SYNC_URL =
  'https://script.google.com/macros/s/AKfycbxCE7MUpWPE4JyNbO6IRvL2yWGQlgZHYAcZiqRUf3Zr7XeGj0OXcPapqY1eSkXg-C1i/exec';

export const EMBEDDED_TRANSBORDO_DATA: TransbordoEntry[] = [
  {
    wms: 'RH.049.1',
    rua: 'RH',
    pos: 49,
    nivel: 1,
    code: '11050001 - 201 - M',
    deposito: '2',
    note: 'Excedente > 6 colmeias (Mini Pulmão)',
    createdAt: '2026-11-04T14:47:41.412Z'
  },
  {
    wms: 'RH.049.2',
    rua: 'RH',
    pos: 49,
    nivel: 2,
    code: '11050001 - 201 - M',
    deposito: '2',
    note: 'Excedente > 6 colmeias (Mini Pulmão)',
    createdAt: '2026-11-04T14:47:41.412Z'
  },
  {
    wms: 'RH.049.3',
    rua: 'RH',
    pos: 49,
    nivel: 3,
    code: '11050001 - 201 - M',
    deposito: '2',
    note: 'Excedente > 6 colmeias (Mini Pulmão)',
    createdAt: '2026-11-04T14:47:41.412Z'
  }
];

export const SAMPLE_CSV_DATA = [
  'CODIGO;COR;TAMANHO;DEPOSITO;LOCAL',
  '11060127;102;M;2;RF.001.1 - 4',
  '11040102;409;38;2;RF.001.5',
  '11040047;409;44;2;RF.001.6',
  '13060127;109;12;2;RF.002.5',
  '12140004;109;GG;2;RF.002.6',
  '11040047;409;40;2;RF.003.1',
  '11210015;408;M;2;RF.003.2|4|6',
  '11040047;409;42;2;RF.003.3',
  '11060600;409;GG;2;RF.003.5',
  '11050070;209;GG;2;RF.004.1',
  '11060128;101;G;2;RG.001.1 - 3',
  '11080045;405;M;2;RG.002.1 - 2',
  '12030110;703;P;2;RG.003.1',
  '11010088;203;42;2;RH.001.1 - 2',
  '11050001;201;M;2-TRANSBORDO;RH.049.1 - 3'
].join('\n');

export const EMBEDDED_SISPLAN_CSV = SAMPLE_CSV_DATA;

const STORAGE_KEY = 'estoque_os_sequoia_wms_v8_react';
const CLOUD_URL_STORAGE_KEY = 'estoque_os_cloud_sync_url_v1';
const IDB_NAME = 'EstoqueOS_Sequoia_WMS_DB';
const IDB_STORE = 'wms_state_store';
const IDB_RECORD_KEY = 'active_wms_snapshot';

let audioCtx: AudioContext | null = null;
export function playMacSound(
  type: 'pop' | 'success' | 'alert' | 'search' | 'empty' | 'select' | 'open' = 'pop',
  enabled = true
) {
  if (!enabled) return;
  try {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    const now = audioCtx.currentTime;

    if (type === 'pop') {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(760, now + 0.055);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);
      osc.start(now);
      osc.stop(now + 0.07);
    } else if (type === 'success') {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.setValueAtTime(659.25, now + 0.07);
      osc.frequency.setValueAtTime(783.99, now + 0.14);
      gain.gain.setValueAtTime(0.07, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      osc.start(now);
      osc.stop(now + 0.29);
    } else if (type === 'alert') {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.setValueAtTime(175, now + 0.09);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.start(now);
      osc.stop(now + 0.23);
    } else if (type === 'search') {
      // Crisp 2-tone harmonic chime confirming Spotlight results found
      const osc1 = audioCtx.createOscillator();
      const gain1 = audioCtx.createGain();
      osc1.connect(gain1);
      gain1.connect(audioCtx.destination);
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(659.25, now); // E5
      gain1.gain.setValueAtTime(0.045, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc1.start(now);
      osc1.stop(now + 0.085);

      const osc2 = audioCtx.createOscillator();
      const gain2 = audioCtx.createGain();
      osc2.connect(gain2);
      gain2.connect(audioCtx.destination);
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880.00, now + 0.075); // A5
      gain2.gain.setValueAtTime(0.001, now);
      gain2.gain.setValueAtTime(0.05, now + 0.075);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.17);
      osc2.start(now + 0.075);
      osc2.stop(now + 0.175);
    } else if (type === 'empty') {
      // Gentle soft low blip when 0 results are found
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(261.63, now); // C4
      osc.frequency.exponentialRampToValueAtTime(196.00, now + 0.11); // G3
      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.start(now);
      osc.stop(now + 0.125);
    } else if (type === 'select') {
      // High-resolution confirmation chime when selecting / navigating to cell
      const osc1 = audioCtx.createOscillator();
      const gain1 = audioCtx.createGain();
      osc1.connect(gain1);
      gain1.connect(audioCtx.destination);
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(783.99, now); // G5
      gain1.gain.setValueAtTime(0.05, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
      osc1.start(now);
      osc1.stop(now + 0.095);

      const osc2 = audioCtx.createOscillator();
      const gain2 = audioCtx.createGain();
      osc2.connect(gain2);
      gain2.connect(audioCtx.destination);
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1046.50, now + 0.08); // C6
      gain2.gain.setValueAtTime(0.001, now);
      gain2.gain.setValueAtTime(0.06, now + 0.08);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc2.start(now + 0.08);
      osc2.stop(now + 0.225);
    } else if (type === 'open') {
      // Quick subtle opening swoosh
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(680, now + 0.045);
      gain.gain.setValueAtTime(0.035, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
      osc.start(now);
      osc.stop(now + 0.06);
    }
  } catch {
    // Ignore audio context errors when user hasn't interacted yet
  }
}

export interface ParsedCsvResult {
  skus: SkuItem[];
  barraItems: SkuItem[];
  transbordoRegistry: Record<string, TransbordoEntry>;
  importedCount: number;
  importedBarraCount: number;
  importedTransbordoCount: number;
  firstRua: string | null;
  firstWms: string | null;
  firstId: string | null;
}

/**
 * Garante que nunca existam registros duplicados para o mesmo SKU no mesmo endereço WMS
 * (ou registros de Pulmão duplicados no mesmo slot). Mantém apenas 1 entrada canônica por SKU@@WMS.
 */
export function deduplicateSkuItems(items: SkuItem[]): {
  items: SkuItem[];
  removedDuplicatesCount: number;
} {
  const seen = new Map<string, SkuItem>();
  let removedDuplicatesCount = 0;

  for (const item of items) {
    if (!item || !item.wms) continue;
    const isPulmaoItem =
      item.codigoBase === 'PULMAO' || String(item.code || '').toUpperCase().startsWith('PULMAO-');
    const skuPart = isPulmaoItem ? `PULMAO` : getCanonicalSkuKey(item.code);
    const dedupeKey = `${skuPart}@@${item.wms.toUpperCase()}`;

    const existing = seen.get(dedupeKey);
    if (existing) {
      removedDuplicatesCount++;
      const nextQty = Math.max(existing.qty || 0, typeof item.qty === 'number' ? item.qty : 0);
      seen.set(dedupeKey, {
        ...existing,
        ...item,
        id: existing.id || item.id,
        qty: nextQty,
        name: item.name || existing.name
      });
    } else {
      seen.set(dedupeKey, { ...item });
    }
  }

  return {
    items: Array.from(seen.values()),
    removedDuplicatesCount
  };
}

export function parseCsvData(
  rawText: string,
  existingSkus: SkuItem[] = [],
  existingBarraItems: SkuItem[] = [],
  existingTransbordo: Record<string, TransbordoEntry> = {},
  mode: 'merge' | 'replace' = 'merge'
): ParsedCsvResult {
  const normalizedRawText = String(rawText || '')
    .replace(/p\uFFFD+s/gi, 'pçs')
    .replace(/p\x87s/gi, 'pçs');

  const lines = normalizedRawText
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0 && !l.startsWith('<!DOCTYPE') && !l.startsWith('<html'));

  const nextTransbordo: Record<string, TransbordoEntry> =
    mode === 'replace' ? {} : { ...existingTransbordo };

  if (lines.length === 0) {
    return {
      skus: existingSkus,
      barraItems: existingBarraItems,
      transbordoRegistry: nextTransbordo,
      importedCount: 0,
      importedBarraCount: 0,
      importedTransbordoCount: 0,
      firstRua: null,
      firstWms: null,
      firstId: null
    };
  }

  const firstLine = lines[0];
  const delimiter = firstLine.includes(';') ? ';' : firstLine.includes('\t') ? '\t' : ',';
  const splitRow = (rowStr: string) =>
    rowStr.split(delimiter).map(c => c.trim().replace(/^"|"$/g, ''));

  const firstCols = splitRow(firstLine).map(c =>
    c.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  );

  const hasHeader = firstCols.some(c =>
    [
      'CODIGO',
      'SKU',
      'COR',
      'TAMANHO',
      'DEPOSITO',
      'LOCAL',
      'LOCAL CADASTRO',
      'LOCAL ATUAL',
      'COLMEIA_TRANSBORDO',
      'TIPO',
      'RUA',
      'ENDERECO',
      'WMS'
    ].includes(c)
  );

  // Formato exclusivo legado COLMEIA_TRANSBORDO
  const isLegacyTransbordoCsv =
    hasHeader && firstCols.includes('COLMEIA_TRANSBORDO') && firstCols.includes('SKU');

  if (isLegacyTransbordoCsv) {
    const wmsIdx = firstCols.indexOf('COLMEIA_TRANSBORDO');
    const skuIdx = firstCols.indexOf('SKU');
    const obsIdx = firstCols.indexOf('OBSERVACAO');
    let trbImported = 0;
    let firstRua: string | null = null;
    let firstWms: string | null = null;

    for (let i = 1; i < lines.length; i++) {
      const cols = splitRow(lines[i]);
      if (cols.length < 2) continue;
      const rawWms = cols[wmsIdx] || '';
      const rawSku = cols[skuIdx] || '';
      const note =
        obsIdx !== -1 && cols[obsIdx]
          ? cols[obsIdx]
          : 'Excedente > 6 colmeias (Mini Pulmão)';
      const expanded = expandSisplanLocal(rawWms);
      const fullSku = formatCanonicalSkuDisplay(rawSku);
      if (!fullSku || expanded.length === 0) continue;
      for (const loc of expanded) {
        nextTransbordo[loc.wms] = {
          wms: loc.wms,
          rua: loc.rua,
          pos: loc.pos,
          nivel: loc.nivel,
          code: fullSku,
          deposito: '2',
          note,
          createdAt: new Date().toISOString()
        };
        if (!firstWms) {
          firstRua = loc.rua;
          firstWms = loc.wms;
        }
        trbImported++;
      }
    }

    return {
      skus: existingSkus,
      barraItems: existingBarraItems,
      transbordoRegistry: nextTransbordo,
      importedCount: 0,
      importedBarraCount: 0,
      importedTransbordoCount: trbImported,
      firstRua,
      firstWms,
      firstId: null
    };
  }

  const cleanHeader = (s: string) =>
    s
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');

  const cleanedCols = splitRow(firstLine).map(cleanHeader);

  let idxCodigo = 0;
  let idxCor = 1;
  let idxTam = 2;
  let idxDep = 3;
  let idxLocal = 4;
  let idxLocalAtual = -1;
  let idxLocaisBarras = -1;
  let idxColecao = -1;
  let idxQtd = -1;
  let idxTipo = -1;
  let idxObs = -1;
  let isEightColFormat = false;

  if (hasHeader) {
    const findColByPattern = (regex: RegExp) =>
      cleanedCols.findIndex(c => regex.test(c));

    const cCod = findColByPattern(/^(?:CODIGO|SKU|PRODUTO|REF|REFERENCIA|MODELO)$/);
    const cCor = findColByPattern(/^(?:COR|COD_COR|COLOR)$/);
    const cTam = findColByPattern(/^(?:TAMANHO|TAM|SIZE|GRADE)$/);
    const cDep = findColByPattern(/^(?:DEPOSITO|DEP|DEPOSIT)$/);
    const cLocCad = findColByPattern(/^(?:LOCAL_CADASTRO|LOCAL_CADA|LOCAL_SKU|LOCAL_SKUS|ENDERECO_CADASTRO|LOCAL_REGISTRADO)$/);
    const cLocBarras = findColByPattern(/^(?:LOCAIS?_BARRAS?.*|CAIXAS?_BARRAS?.*|ENDERECOS?_BARRAS?.*|LOCAL_BARRA.*)$/);
    const cLocAtual = findColByPattern(/^(?:LOCAL_ATUAL|ENDERECO_ATUAL|LOCAL_FISICO|CAIXA_ATUAL)$/);
    const cLoc = findColByPattern(/^(?:LOCAL|ENDERECO|WMS|POSICAO)$/);
    const cCol = findColByPattern(/^(?:COLECAO|COL|ESTACAO)$/);
    const cQtd = findColByPattern(/^(?:TOTAL.*PECAS?|TOTAL.*ITEN?S?|QTD.*ITEMS?|QTD.*ITENS?|QTD.*PECAS?|QUANTIDADE.*|TOTAL|QTD|QTY|PECAS?|SALDO.*|ITENS?|ITEMS?)$/);
    const cTipo = findColByPattern(/^(?:TIPO|MODALIDADE|STATUS_COLMEIA)$/);
    const cObs = findColByPattern(/^(?:OBSERVACAO|OBS|NOTA)$/);

    if (cCod !== -1) idxCodigo = cCod;
    if (cCor !== -1) idxCor = cCor;
    if (cTam !== -1) idxTam = cTam;
    if (cDep !== -1) idxDep = cDep;
    if (cTipo !== -1) idxTipo = cTipo;
    if (cObs !== -1) idxObs = cObs;
    if (cCol !== -1) idxColecao = cCol;
    if (cLocBarras !== -1) idxLocaisBarras = cLocBarras;
    if (cQtd !== -1) idxQtd = cQtd;

    if (cLocCad !== -1 || cLocBarras !== -1 || cLocAtual !== -1) {
      isEightColFormat = true;
      idxLocal = cLocCad !== -1 ? cLocCad : cLoc !== -1 ? cLoc : 4;
      idxLocalAtual = cLocAtual !== -1 ? cLocAtual : idxLocal;
    } else if (cLoc !== -1) {
      idxLocal = cLoc;
    }
  } else {
    const sampleCols = splitRow(lines[0]);
    if (
      sampleCols.length >= 8 &&
      /^[RAP][A-I]|^A[A-F]/i.test(sampleCols[0]) &&
      /^\d+$/.test(sampleCols[1])
    ) {
      isEightColFormat = true;
      idxLocal = 2;
      idxLocalAtual = 3;
      idxCodigo = 4;
      idxCor = 5;
      idxTam = 6;
      idxQtd = 7;
      idxDep = -1;
    }
  }

  const startIdx = hasHeader ? 1 : 0;
  const importedItems: SkuItem[] = [];
  const importedBarraItems: SkuItem[] = [];
  let importedTransbordoCount = 0;

  for (let i = startIdx; i < lines.length; i++) {
    const cols = splitRow(lines[i]);
    if (cols.length < 2) continue;

    let rawCodigo = '';
    let rawCor = '';
    let rawTam = '';
    let rawDep = '2';
    let rawColecao = '';
    let rawLocal = '';
    let rawLocalAtual = '';
    let rawLocaisBarras = '';
    let parsedQty = 1;

    if (isEightColFormat) {
      rawCodigo = cols[idxCodigo] || '';
      rawCor = cols[idxCor] || '';
      rawTam = cols[idxTam] || '';
      rawLocal = cols[idxLocal] || '';
      rawDep = idxDep !== -1 && cols[idxDep] ? cols[idxDep] : '2';
      rawColecao = idxColecao !== -1 && cols[idxColecao] ? cols[idxColecao] : '';
      rawLocaisBarras = idxLocaisBarras !== -1 && cols[idxLocaisBarras] ? cols[idxLocaisBarras] : '';
      rawLocalAtual = idxLocalAtual !== -1 && cols[idxLocalAtual] ? cols[idxLocalAtual] : rawLocaisBarras || rawLocal;
      const rawQtyStr = idxQtd !== -1 && cols[idxQtd] ? cols[idxQtd] : '1';
      parsedQty = Math.max(
        1,
        parseInt(String(rawQtyStr).replace(/\D/g, ''), 10) || 1
      );
    } else if (cols.length >= 5) {
      rawCodigo = cols[idxCodigo] || cols[0];
      rawCor = cols[idxCor] || cols[1];
      rawTam = cols[idxTam] || cols[2];
      rawDep = idxDep !== -1 && cols[idxDep] ? cols[idxDep] : '2';
      rawLocal = cols[idxLocal] || cols[4];
      rawLocalAtual = rawLocal;
      if (idxQtd !== -1 && cols[idxQtd]) {
        parsedQty = Math.max(
          1,
          parseInt(String(cols[idxQtd]).replace(/\D/g, ''), 10) || 1
        );
      }
    } else {
      rawCodigo = cols[0];
      rawLocal = cols[cols.length - 1];
      rawLocalAtual = rawLocal;
    }

    const rowTipo = idxTipo !== -1 && cols[idxTipo] ? cols[idxTipo].toUpperCase() : '';
    const rowObs = idxObs !== -1 && cols[idxObs] ? cols[idxObs] : '';
    const isTransbordoRow =
      String(rawDep).toUpperCase().includes('TRANSBORDO') ||
      rowTipo.includes('TRANSBORDO') ||
      String(rawLocal).toUpperCase().includes('TRANSBORDO');

    if (isTransbordoRow) {
      const cleanLocalStr = String(rawLocal)
        .replace(/\(?\s*TRANSBORDO\s*\)?/gi, '')
        .trim();
      const trbAddresses = expandSisplanLocal(cleanLocalStr);
      const decTrb = decodeSkuPrefix(rawCodigo, rawCor, rawTam);
      const fullCodeTrb =
        rawCor && rawTam
          ? `${rawCodigo} - ${decTrb.colorCode} - ${decTrb.size}`
          : formatCanonicalSkuDisplay(rawCodigo);

      for (const addr of trbAddresses) {
        nextTransbordo[addr.wms] = {
          wms: addr.wms,
          rua: addr.rua,
          pos: addr.pos,
          nivel: addr.nivel,
          code: fullCodeTrb,
          deposito: String(rawDep).replace(/-?TRANSBORDO/gi, '').trim() || '2',
          note: rowObs || 'Excedente > 6 colmeias (Mini Pulmão)',
          createdAt: new Date().toISOString()
        };
        importedTransbordoCount++;
      }
      continue;
    }

    let cleanLocalCadastro = String(rawLocal || '').trim();
    let qtdForaFromParen = 0;
    const parenMatch = cleanLocalCadastro.match(
      /^([A-Z]{2}\.\d{1,3}\.[^\(\)]+?)\s*\(\s*(\d+)\s*p(?:ç|c|\uFFFD+)?s?\s*\)/i
    );
    if (parenMatch) {
      cleanLocalCadastro = parenMatch[1].trim();
      qtdForaFromParen = parseInt(parenMatch[2], 10) || parsedQty;
    }

    const dec = decodeSkuPrefix(rawCodigo, rawCor, rawTam);
    const fullCode =
      rawCor && rawTam ? `${rawCodigo} - ${dec.colorCode} - ${dec.size}` : rawCodigo;

    const expandedCadastro = expandSisplanLocal(cleanLocalCadastro);

    // Mapeia quantidades individuais por endereço a partir de Locais_Barras
    // Exemplo: "RF.029.6 (46 pçs) | RF.029.3 (40 pçs) | RF.029.1 (39 pçs) | RF.029.2 (49 pçs) | Sem Local (6 pçs) | RF."
    const slotQtyFromLocaisBarras = new Map<string, number>();
    const parsedSubBoxes: { wms: string; rua: string; pos: number; nivel: number; qty: number; raw: string }[] = [];

    if (rawLocaisBarras) {
      const subLocations = rawLocaisBarras.split(/\s*\|\s*/).map(s => s.trim()).filter(Boolean);

      for (const sub of subLocations) {
        if (/sem\s*local/i.test(sub)) continue;

        // Extrai endereço WMS e quantidade com suporte amplo a acentuações e formatos:
        // ex: "RF.029.6 (46 pçs)", "RF.029.6 (46pcs)", "RF.029.6(46)", "RF.029.6 46 pçs"
        const addrMatch = sub.match(/(?:^|\b)([RAP][A-I]|A[A-F])[\.\-\s](\d{1,3})[\.\-\s](\d{1,2})/i);
        if (!addrMatch) continue;

        const rua = addrMatch[1].toUpperCase();
        const pos = parseInt(addrMatch[2], 10);
        const nivel = parseInt(addrMatch[3], 10);
        const wmsKey = formatWmsAddress(rua, pos, nivel);

        let boxQty = 1;
        const qtyMatch = sub.match(/\(?\s*(\d+)\s*(?:p(?:ç|c|\uFFFD+)?s?|pecas|peças|un|vol)?\s*\)?$/i) ||
                         sub.match(/\(\s*(\d+)\s*(?:p(?:ç|c|\uFFFD+)?s?|pecas|peças|un|vol)?\s*\)/i);
        if (qtyMatch) {
          boxQty = parseInt(qtyMatch[1], 10) || 1;
        }

        slotQtyFromLocaisBarras.set(wmsKey, (slotQtyFromLocaisBarras.get(wmsKey) || 0) + boxQty);
        parsedSubBoxes.push({ wms: wmsKey, rua, pos, nivel, qty: boxQty, raw: sub });
      }
    }

    // 1. Processa Local Cadastro para a Aba SKU
    if (expandedCadastro.length > 0) {
      for (const addr of expandedCadastro) {
        const autoCol = rawColecao || (isReservedCol35Street(addr.rua) ? '35' : '51');
        // Se houver quantidade específica para este nível em Locais_Barras, usa-a;
        // Se Locais_Barras foi preenchido na linha mas não contém este nível, a quantidade física é 0
        const itemLevelQty = slotQtyFromLocaisBarras.has(addr.wms)
          ? slotQtyFromLocaisBarras.get(addr.wms)!
          : (slotQtyFromLocaisBarras.size > 0 ? 0 : parsedQty);

        importedItems.push({
          id: `csv-sku-${Date.now()}-${i}-${addr.nivel}-${Math.random().toString(36).slice(2, 6)}`,
          code: fullCode,
          codigoBase: rawCodigo,
          name: dec.autoName,
          brand: dec.marca,
          label: dec.etiqueta,
          groupCode: dec.dGrupo,
          groupName: dec.grupo,
          colorCode: dec.colorCode,
          colorName: dec.colorName,
          colorHex: dec.colorHex,
          size: dec.size,
          deposito: String(rawDep || '2'),
          rua: addr.rua,
          pos: addr.pos,
          nivel: addr.nivel,
          wms: addr.wms,
          rawLocal: cleanLocalCadastro,
          localCadastroRaw: cleanLocalCadastro,
          localAtualRaw: rawLocaisBarras || rawLocalAtual || cleanLocalCadastro,
          qtdForaDoLocal: qtdForaFromParen,
          colecao: autoCol,
          qty: itemLevelQty,
          icon: dec.icon
        });
      }
    }

    // 2. Processa Locais_Barras para a Aba Barra (Local Atual Físico com Qtd de Peças Exata por Caixa)
    const cadSet = new Set(expandedCadastro.map(a => a.wms));

    if (parsedSubBoxes.length > 0) {
      for (const box of parsedSubBoxes) {
        const isOutside = expandedCadastro.length > 0 && !cadSet.has(box.wms);
        const autoCol = rawColecao || (isReservedCol35Street(box.rua) ? '35' : '51');

        importedBarraItems.push({
          id: `csv-bar-${Date.now()}-${i}-${box.wms}-${Math.random().toString(36).slice(2, 6)}`,
          code: fullCode,
          codigoBase: rawCodigo,
          name: dec.autoName,
          brand: dec.marca,
          label: dec.etiqueta,
          groupCode: dec.dGrupo,
          groupName: dec.grupo,
          colorCode: dec.colorCode,
          colorName: dec.colorName,
          colorHex: dec.colorHex,
          size: dec.size,
          deposito: String(rawDep || '2'),
          rua: box.rua,
          pos: box.pos,
          nivel: box.nivel,
          wms: box.wms,
          rawLocal: box.raw,
          localCadastroRaw: cleanLocalCadastro,
          localAtualRaw: box.raw,
          isOutsideRegisteredLocal: isOutside,
          qtdForaDoLocal: isOutside ? box.qty : 0,
          colecao: autoCol,
          qty: box.qty,
          icon: dec.icon
        });
      }
    } else {
      // Fallback para arquivos CSV normais onde não há coluna Locais_Barras explícita
      const targetBarraAddrs = expandSisplanLocal(rawLocalAtual);
      const addrsToUse = targetBarraAddrs.length > 0 ? targetBarraAddrs : expandedCadastro;

      if (addrsToUse.length > 0) {
        for (const addr of addrsToUse) {
          const isOutsideCadastro = expandedCadastro.length > 0 && !cadSet.has(addr.wms);
          const autoCol = rawColecao || (isReservedCol35Street(addr.rua) ? '35' : '51');
          importedBarraItems.push({
            id: `csv-bar-${Date.now()}-${i}-${addr.nivel}-${Math.random().toString(36).slice(2, 6)}`,
            code: fullCode,
            codigoBase: rawCodigo,
            name: dec.autoName,
            brand: dec.marca,
            label: dec.etiqueta,
            groupCode: dec.dGrupo,
            groupName: dec.grupo,
            colorCode: dec.colorCode,
            colorName: dec.colorName,
            colorHex: dec.colorHex,
            size: dec.size,
            deposito: String(rawDep || '2'),
            rua: addr.rua,
            pos: addr.pos,
            nivel: addr.nivel,
            wms: addr.wms,
            rawLocal: rawLocalAtual || cleanLocalCadastro,
            localCadastroRaw: cleanLocalCadastro || rawLocalAtual,
            localAtualRaw: rawLocalAtual || cleanLocalCadastro,
            isOutsideRegisteredLocal: isOutsideCadastro,
            qtdForaDoLocal: isOutsideCadastro ? qtdForaFromParen || parsedQty : 0,
            colecao: autoCol,
            qty: parsedQty,
            icon: dec.icon
          });
        }
      }
    }
  }

  let finalSkus: SkuItem[] = [];
  if (mode === 'replace') {
    finalSkus = deduplicateSkuItems(importedItems).items;
  } else {
    const mergedMap = new Map<string, SkuItem>();
    for (const existing of existingSkus) {
      mergedMap.set(`${getCanonicalSkuKey(existing.code)}@@${existing.wms}`, existing);
    }
    for (const item of importedItems) {
      mergedMap.set(`${getCanonicalSkuKey(item.code)}@@${item.wms}`, item);
    }
    finalSkus = deduplicateSkuItems(Array.from(mergedMap.values())).items;
  }

  let finalBarra: SkuItem[] = [];
  if (mode === 'replace') {
    finalBarra = deduplicateSkuItems(importedBarraItems).items;
  } else {
    const barraMap = new Map<string, SkuItem>();
    for (const existing of existingBarraItems) {
      barraMap.set(`${getCanonicalSkuKey(existing.code)}@@${existing.wms}`, { ...existing });
    }
    for (const bItem of importedBarraItems) {
      const key = `${getCanonicalSkuKey(bItem.code)}@@${bItem.wms}`;
      const prev = barraMap.get(key);
      if (prev) {
        prev.qty = bItem.qty;
        prev.localCadastroRaw = bItem.localCadastroRaw;
        prev.isOutsideRegisteredLocal = bItem.isOutsideRegisteredLocal;
      } else {
        barraMap.set(key, { ...bItem });
      }
    }
    finalBarra = deduplicateSkuItems(Array.from(barraMap.values())).items;
  }

  const first = finalSkus[0] || finalBarra[0] || null;
  return {
    skus: finalSkus,
    barraItems: finalBarra,
    transbordoRegistry: nextTransbordo,
    importedCount: importedItems.length,
    importedBarraCount: importedBarraItems.length,
    importedTransbordoCount,
    firstRua: first ? first.rua : null,
    firstWms: first ? first.wms : null,
    firstId: first ? first.id : null
  };
}

export function buildSisplanCsvString(
  skus: SkuItem[],
  transbordoRegistry: Record<string, TransbordoEntry>,
  barraItems: SkuItem[] = []
): string {
  const lines = ['CODIGO;COR;TAMANHO;DEPOSITO;LOCAL_CADASTRO;COLECAO;LOCAIS_BARRAS;TOTAL_PECAS'];

  // Agrupa SKUs pelo código canônico
  const skuMap = new Map<
    string,
    {
      codigo: string;
      cor: string;
      tam: string;
      dep: string;
      colecao: string;
      items: SkuItem[];
    }
  >();

  for (const s of skus) {
    if (s.isTransbordo) continue;
    const dec = decodeSkuPrefix(s.code);
    const codigo = s.codigoBase || dec.dMarca + dec.dEtiqueta + dec.dGrupo + dec.modelSeq;
    const cor = s.colorCode || dec.colorCode;
    const tam = s.size || dec.size;
    const dep = s.deposito || '2';
    const key = `${codigo}|${cor}|${tam}|${dep}`;
    if (!skuMap.has(key)) {
      skuMap.set(key, {
        codigo,
        cor,
        tam,
        dep,
        colecao: s.colecao || (isReservedCol35Street(s.rua) ? '35' : '51'),
        items: []
      });
    }
    skuMap.get(key)!.items.push(s);
  }

  // Mapeia barraItems por SKU key
  const barraMap = new Map<string, SkuItem[]>();
  for (const b of barraItems) {
    if (b.isTransbordo) continue;
    const dec = decodeSkuPrefix(b.code);
    const codigo = b.codigoBase || dec.dMarca + dec.dEtiqueta + dec.dGrupo + dec.modelSeq;
    const cor = b.colorCode || dec.colorCode;
    const tam = b.size || dec.size;
    const dep = b.deposito || '2';
    const key = `${codigo}|${cor}|${tam}|${dep}`;
    if (!barraMap.has(key)) {
      barraMap.set(key, []);
    }
    barraMap.get(key)!.push(b);
  }

  for (const group of skuMap.values()) {
    // 1. Constrói LOCAL_CADASTRO agrupando colunas sem níveis duplicados (ex: RF.029.1 - 6)
    const colGrouped = new Map<string, { rua: string; pos: number; levels: number[] }>();
    const seenWmsInGroup = new Set<string>();
    const uniqueGroupItems: SkuItem[] = [];
    for (const item of group.items) {
      const wmsUpper = String(item.wms || '').toUpperCase();
      if (seenWmsInGroup.has(wmsUpper)) continue;
      seenWmsInGroup.add(wmsUpper);
      uniqueGroupItems.push(item);

      const colKey = `${item.rua}|${item.pos}`;
      if (!colGrouped.has(colKey)) {
        colGrouped.set(colKey, { rua: item.rua, pos: item.pos, levels: [] });
      }
      const lvlList = colGrouped.get(colKey)!.levels;
      if (!lvlList.includes(item.nivel)) {
        lvlList.push(item.nivel);
      }
    }
    const localCadastroParts = Array.from(colGrouped.values()).map(cg =>
      formatLevelsToSisplanLocal(cg.rua, cg.pos, cg.levels)
    );
    const localCadastro = localCadastroParts.join(' / ') || uniqueGroupItems[0]?.rawLocal || 'Sem Local';

    // 2. Constrói LOCAIS_BARRAS com quantidades individuais exatas por caixa (ex: RF.029.6 (46 pçs) | ...)
    const key = `${group.codigo}|${group.cor}|${group.tam}|${group.dep}`;
    const matchingBoxes = barraMap.get(key) || [];

    let locaisBarras = '';
    let totalPecas = 0;

    if (matchingBoxes.length > 0) {
      locaisBarras = matchingBoxes
        .map(b => `${b.wms} (${b.qty || 1} pçs)`)
        .join(' | ');
      totalPecas = matchingBoxes.reduce((acc, b) => acc + (b.qty || 1), 0);
    } else {
      const activeLevels = group.items.filter(it => (it.qty || 0) > 0);
      if (activeLevels.length > 0) {
        locaisBarras = activeLevels
          .map(it => `${it.wms} (${it.qty || 1} pçs)`)
          .join(' | ');
        totalPecas = activeLevels.reduce((acc, it) => acc + (it.qty || 1), 0);
      } else {
        locaisBarras = group.items.map(it => `${it.wms} (1 pçs)`).join(' | ');
        totalPecas = group.items.length;
      }
    }

    lines.push(
      `${group.codigo};${group.cor};${group.tam};${group.dep};${localCadastro};${group.colecao};${locaisBarras};${totalPecas}`
    );
  }

  // Anexa colmeias de Transbordo
  const trbValues = Object.values(transbordoRegistry || {});
  if (trbValues.length > 0) {
    const trbGrouped = new Map<
      string,
      { codigo: string; cor: string; tam: string; rua: string; pos: number; levels: number[] }
    >();
    for (const trb of trbValues) {
      const dec = decodeSkuPrefix(trb.code);
      const parts = String(trb.code || '').split(/\s*-\s*/);
      const codigo = parts[0] || dec.dMarca + dec.dEtiqueta + dec.dGrupo + dec.modelSeq;
      const cor = parts[1] || dec.colorCode;
      const tam = parts[2] || dec.size;
      const key = `TRB|${codigo}|${cor}|${tam}|${trb.rua}|${trb.pos}`;
      if (!trbGrouped.has(key)) {
        trbGrouped.set(key, { codigo, cor, tam, rua: trb.rua, pos: trb.pos, levels: [] });
      }
      trbGrouped.get(key)!.levels.push(trb.nivel);
    }
    for (const tg of trbGrouped.values()) {
      const localStr = formatLevelsToSisplanLocal(tg.rua, tg.pos, tg.levels);
      lines.push(`${tg.codigo};${tg.cor};${tg.tam};2-TRANSBORDO;${localStr};35;${localStr} (1 pçs);${tg.levels.length}`);
    }
  }

  return lines.join('\n');
}

// ============================================================================
// PERSISTENCE (LocalStorage + SessionStorage + window.name + IndexedDB)
// ============================================================================
export interface WmsPersistedSnapshot {
  csv: string;
  rawImportedCsv?: string;
  skusData?: SkuItem[];
  barraItemsData?: SkuItem[];
  movedSkus: Record<string, MovedSkuEntry>;
  transbordo: TransbordoEntry[];
  wmsPerspective?: 'sku' | 'barra';
  updatedAt: string;
}

function saveToIndexedDB(payloadStr: string) {
  try {
    if (!window.indexedDB) return;
    const req = window.indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = e => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = e => {
      try {
        const db = (e.target as IDBOpenDBRequest).result;
        const tx = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).put(payloadStr, IDB_RECORD_KEY);
      } catch {
        // ignore
      }
    };
  } catch {
    // ignore
  }
}

export function loadFromIndexedDB(): Promise<string | null> {
  return new Promise(resolve => {
    try {
      if (!window.indexedDB) return resolve(null);
      const req = window.indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = e => {
        const db = (e.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = e => {
        try {
          const db = (e.target as IDBOpenDBRequest).result;
          const tx = db.transaction(IDB_STORE, 'readonly');
          const getReq = tx.objectStore(IDB_STORE).get(IDB_RECORD_KEY);
          getReq.onsuccess = () => resolve((getReq.result as string) || null);
          getReq.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export function saveWmsStateLocally(
  skus: SkuItem[],
  movedSkusRegistry: Record<string, MovedSkuEntry>,
  transbordoRegistry: Record<string, TransbordoEntry>,
  barraItems: SkuItem[] = [],
  rawImportedCsv = '',
  wmsPerspective: 'sku' | 'barra' = 'sku',
  trackOfflineDiff = true
): string {
  const prevSnap = trackOfflineDiff ? loadLocalWmsSnapshotSync() : null;
  const cleanSkus = deduplicateSkuItems(skus).items;
  const cleanBarra = deduplicateSkuItems(barraItems).items;
  const csvStr = buildSisplanCsvString(cleanSkus, transbordoRegistry, cleanBarra);

  if (trackOfflineDiff) {
    recordOfflineSkuTimestamps(prevSnap?.csv || null, csvStr);
  }

  const payloadObj: WmsPersistedSnapshot = {
    csv: csvStr,
    rawImportedCsv: rawImportedCsv || undefined,
    skusData: cleanSkus,
    barraItemsData: cleanBarra,
    movedSkus: movedSkusRegistry,
    transbordo: Object.values(transbordoRegistry || {}),
    wmsPerspective,
    updatedAt: new Date().toISOString()
  };
  const payloadStr = JSON.stringify(payloadObj);

  try {
    localStorage.setItem(STORAGE_KEY, payloadStr);
  } catch {
    // ignore
  }
  try {
    sessionStorage.setItem(STORAGE_KEY, payloadStr);
  } catch {
    // ignore
  }
  try {
    window.name = 'WMS_STATE_V8:' + payloadStr;
  } catch {
    // ignore
  }
  saveToIndexedDB(payloadStr);
  return csvStr;
}

export function loadLocalWmsSnapshotSync(): WmsPersistedSnapshot | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  if (!raw) {
    try {
      raw = sessionStorage.getItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }
  if (!raw) {
    try {
      if (window.name && window.name.startsWith('WMS_STATE_V8:')) {
        raw = window.name.slice('WMS_STATE_V8:'.length);
      }
    } catch {
      // ignore
    }
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && (typeof parsed.csv === 'string' || Array.isArray(parsed.skusData))) {
      return parsed as WmsPersistedSnapshot;
    }
  } catch {
    // ignore
  }
  return null;
}

// ============================================================================
// OFFLINE SYNC QUEUE + 3-WAY MULTI-DEVICE MERGE & CONFLICT PROTECTION
// ============================================================================
const OFFLINE_SYNC_QUEUE_KEY = 'estoque_os_pending_offline_sync_v1';
const IDB_SYNC_QUEUE_KEY = 'pending_offline_sync_record';
const SYNC_DEVICE_ID_KEY = 'estoque_os_sync_device_id_v1';
const CLOUD_SYNC_BASE_CSV_KEY = 'estoque_os_cloud_sync_base_csv_v1';
const IDB_SYNC_BASE_CSV_KEY = 'cloud_sync_base_csv';
const OFFLINE_SKU_TIMESTAMPS_KEY = 'estoque_os_offline_sku_ts_v1';

export interface OfflineSkuTimestampEntry {
  updatedAt: number;
  updatedAtIso: string;
  deviceId: string;
  wmsSignature: string;
}

export type OfflineSkuTimestampMap = Record<string, OfflineSkuTimestampEntry>;

export interface PendingOfflineSyncRecord {
  csv: string;
  updatedAt: string;
  pendingChangesCount: number;
  cloudUrl?: string;
  baseCsv?: string;
  deviceId?: string;
  skuTimestamps?: OfflineSkuTimestampMap;
}

export function getOrCreateSyncDeviceId(): string {
  try {
    const existing = localStorage.getItem(SYNC_DEVICE_ID_KEY);
    if (existing && existing.trim()) return existing;
    const generated = `DEV-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    localStorage.setItem(SYNC_DEVICE_ID_KEY, generated);
    return generated;
  } catch {
    return 'DEV-LOCAL';
  }
}

function saveIdbKeyValue(key: string, value: string | null) {
  try {
    if (!window.indexedDB) return;
    const req = window.indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = e => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = e => {
      try {
        const db = (e.target as IDBOpenDBRequest).result;
        const tx = db.transaction(IDB_STORE, 'readwrite');
        const store = tx.objectStore(IDB_STORE);
        if (value === null) {
          store.delete(key);
        } else {
          store.put(value, key);
        }
      } catch {
        // ignore
      }
    };
  } catch {
    // ignore
  }
}

function loadIdbKeyValue(key: string): Promise<string | null> {
  return new Promise(resolve => {
    try {
      if (!window.indexedDB) return resolve(null);
      const req = window.indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = e => {
        const db = (e.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = e => {
        try {
          const db = (e.target as IDBOpenDBRequest).result;
          const tx = db.transaction(IDB_STORE, 'readonly');
          const getReq = tx.objectStore(IDB_STORE).get(key);
          getReq.onsuccess = () => resolve((getReq.result as string) || null);
          getReq.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export function loadCloudSyncBaseCsv(): string | null {
  try {
    return localStorage.getItem(CLOUD_SYNC_BASE_CSV_KEY);
  } catch {
    return null;
  }
}

export async function loadCloudSyncBaseCsvFromIDB(): Promise<string | null> {
  const syncVal = loadCloudSyncBaseCsv();
  if (syncVal) return syncVal;
  return loadIdbKeyValue(IDB_SYNC_BASE_CSV_KEY);
}

export function saveCloudSyncBaseCsv(csvStr: string) {
  if (!csvStr || !csvStr.trim()) return;
  try {
    localStorage.setItem(CLOUD_SYNC_BASE_CSV_KEY, csvStr);
  } catch {
    // ignore
  }
  saveIdbKeyValue(IDB_SYNC_BASE_CSV_KEY, csvStr);
}

export function loadOfflineSkuTimestamps(): OfflineSkuTimestampMap {
  try {
    const raw = localStorage.getItem(OFFLINE_SKU_TIMESTAMPS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as OfflineSkuTimestampMap) : {};
  } catch {
    return {};
  }
}

export function clearOfflineSkuTimestamps() {
  try {
    localStorage.removeItem(OFFLINE_SKU_TIMESTAMPS_KEY);
  } catch {
    // ignore
  }
}

function saveQueueToIndexedDB(payloadStr: string | null) {
  saveIdbKeyValue(IDB_SYNC_QUEUE_KEY, payloadStr);
}

export function loadPendingOfflineSync(): PendingOfflineSyncRecord | null {
  try {
    const raw = localStorage.getItem(OFFLINE_SYNC_QUEUE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.csv === 'string') {
      return {
        csv: parsed.csv,
        updatedAt: parsed.updatedAt || new Date().toISOString(),
        pendingChangesCount: Math.max(1, Number(parsed.pendingChangesCount) || 1),
        cloudUrl: parsed.cloudUrl,
        baseCsv: typeof parsed.baseCsv === 'string' ? parsed.baseCsv : undefined,
        deviceId: parsed.deviceId,
        skuTimestamps: parsed.skuTimestamps
      };
    }
  } catch {
    // ignore
  }
  return null;
}

export function loadPendingOfflineSyncFromIDB(): Promise<PendingOfflineSyncRecord | null> {
  return new Promise(resolve => {
    try {
      if (!window.indexedDB) return resolve(loadPendingOfflineSync());
      const req = window.indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = e => {
        const db = (e.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = e => {
        try {
          const db = (e.target as IDBOpenDBRequest).result;
          const tx = db.transaction(IDB_STORE, 'readonly');
          const getReq = tx.objectStore(IDB_STORE).get(IDB_SYNC_QUEUE_KEY);
          getReq.onsuccess = () => {
            try {
              const raw = getReq.result as string | undefined;
              if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && typeof parsed.csv === 'string') {
                  return resolve(parsed as PendingOfflineSyncRecord);
                }
              }
            } catch {
              // fallback
            }
            resolve(loadPendingOfflineSync());
          };
          getReq.onerror = () => resolve(loadPendingOfflineSync());
        } catch {
          resolve(loadPendingOfflineSync());
        }
      };
      req.onerror = () => resolve(loadPendingOfflineSync());
    } catch {
      resolve(loadPendingOfflineSync());
    }
  });
}

export function savePendingOfflineSync(
  csvStr: string,
  cloudUrl?: string
): PendingOfflineSyncRecord {
  const existing = loadPendingOfflineSync();
  const baseCsv = existing?.baseCsv || loadCloudSyncBaseCsv() || undefined;
  const deviceId = getOrCreateSyncDeviceId();
  const skuTimestamps = loadOfflineSkuTimestamps();
  const nextRecord: PendingOfflineSyncRecord = {
    csv: csvStr,
    updatedAt: new Date().toISOString(),
    pendingChangesCount: (existing?.pendingChangesCount || 0) + 1,
    cloudUrl,
    baseCsv,
    deviceId,
    skuTimestamps
  };
  const str = JSON.stringify(nextRecord);
  try {
    localStorage.setItem(OFFLINE_SYNC_QUEUE_KEY, str);
  } catch {
    // ignore
  }
  saveQueueToIndexedDB(str);
  return nextRecord;
}

export function clearPendingOfflineSync() {
  try {
    localStorage.removeItem(OFFLINE_SYNC_QUEUE_KEY);
  } catch {
    // ignore
  }
  saveQueueToIndexedDB(null);
  clearOfflineSkuTimestamps();
}

interface IndexedCsvSkuGroup {
  skuKey: string;
  code: string;
  name: string;
  colorHex: string;
  localDisplay: string;
  wmsList: string[];
  wmsSignature: string;
  items: SkuItem[];
}

function indexCsvByCanonicalSku(csvStr: string): {
  skuGroups: Map<string, IndexedCsvSkuGroup>;
  barraItems: SkuItem[];
  transbordo: Record<string, TransbordoEntry>;
} {
  if (!csvStr || !csvStr.trim()) {
    return { skuGroups: new Map(), barraItems: [], transbordo: {} };
  }
  const parsed = parseCsvData(csvStr, [], [], {}, 'replace');
  const grouped = new Map<string, SkuItem[]>();

  for (const item of parsed.skus) {
    if (item.isTransbordo) continue;
    const skuKey = getCanonicalSkuKey(item.code);
    const list = grouped.get(skuKey);
    if (list) list.push(item);
    else grouped.set(skuKey, [item]);
  }

  const skuGroups = new Map<string, IndexedCsvSkuGroup>();
  for (const [skuKey, list] of grouped.entries()) {
    const sortedWms = Array.from(new Set(list.map(i => i.wms.toUpperCase()))).sort();
    const towerMap = new Map<string, { rua: string; pos: number; levels: number[] }>();
    for (const it of list) {
      const tk = `${it.rua}.${it.pos}`;
      const existing = towerMap.get(tk);
      if (existing) {
        if (!existing.levels.includes(it.nivel)) existing.levels.push(it.nivel);
      } else {
        towerMap.set(tk, { rua: it.rua, pos: it.pos, levels: [it.nivel] });
      }
    }
    const groupedDisplay = Array.from(towerMap.values())
      .map(t => formatLevelsToSisplanLocal(t.rua, t.pos, t.levels))
      .join(' / ');

    skuGroups.set(skuKey, {
      skuKey,
      code: list[0].code,
      name: list[0].name,
      colorHex: list[0].colorHex,
      localDisplay: groupedDisplay || list[0].rawLocal || sortedWms.join(', '),
      wmsList: sortedWms,
      wmsSignature: sortedWms.join('|'),
      items: list
    });
  }

  return {
    skuGroups,
    barraItems: parsed.barraItems,
    transbordo: parsed.transbordoRegistry
  };
}

function mapCsvLinesBySkuKey(csvStr: string): Map<string, { fullLine: string; localField: string }> {
  const map = new Map<string, { fullLine: string; localField: string }>();
  if (!csvStr) return map;
  const lines = csvStr.split(/\r?\n/);
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = line.split(';');
    if (cols.length < 5) continue;
    if (String(cols[3] || '').toUpperCase().includes('TRANSBORDO')) continue;
    const key = getCanonicalSkuKey(`${cols[0]} - ${cols[1]} - ${cols[2]}`);
    const localField = String(cols[4] || '').trim().toUpperCase();
    const prev = map.get(key);
    if (prev) {
      map.set(key, {
        fullLine: `${prev.fullLine}\n${line}`,
        localField: `${prev.localField}|${localField}`
      });
    } else {
      map.set(key, { fullLine: line, localField });
    }
  }
  return map;
}

/**
 * Registra timestamps por SKU sempre que o estado local muda em relação ao snapshot anterior,
 * permitindo detectar quais SKUs este dispositivo alterou offline e resolver conflitos por recência.
 */
export function recordOfflineSkuTimestamps(
  prevCsv: string | null,
  nextCsv: string
): OfflineSkuTimestampMap {
  if (!prevCsv || prevCsv === nextCsv) {
    return loadOfflineSkuTimestamps();
  }
  const existing = loadOfflineSkuTimestamps();
  const deviceId = getOrCreateSyncDeviceId();
  const now = Date.now();
  const nowIso = new Date(now).toISOString();

  const prevMap = mapCsvLinesBySkuKey(prevCsv);
  const nextMap = mapCsvLinesBySkuKey(nextCsv);

  const allKeys = new Set<string>([...Array.from(prevMap.keys()), ...Array.from(nextMap.keys())]);

  let changed = false;
  const updated: OfflineSkuTimestampMap = { ...existing };
  for (const key of allKeys) {
    const prevEntry = prevMap.get(key);
    const nextEntry = nextMap.get(key);
    const prevLine = prevEntry?.fullLine || '';
    const nextLine = nextEntry?.fullLine || 'DELETED';

    if (prevLine !== nextLine) {
      changed = true;
      updated[key] = {
        updatedAt: now,
        updatedAtIso: nowIso,
        deviceId,
        wmsSignature: nextEntry?.localField || 'DELETED'
      };
    }
  }

  if (changed) {
    try {
      localStorage.setItem(OFFLINE_SKU_TIMESTAMPS_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }
  }
  return updated;
}

export interface SyncConflictItem {
  skuKey: string;
  code: string;
  name: string;
  colorHex: string;
  baseLocal: string;
  localLocal: string;
  localWmsList: string[];
  localIsDeleted: boolean;
  localUpdatedAt: string;
  localDeviceId: string;
  cloudLocal: string;
  cloudWmsList: string[];
  cloudIsDeleted: boolean;
  cloudUpdatedAt: string;
  recommendedChoice: 'local' | 'cloud';
}

export interface ThreeWayMergeResult {
  status: 'merged_clean' | 'conflicts_detected';
  mergedCsv: string;
  conflicts: SyncConflictItem[];
  summary: {
    preservedCloudEdits: number;
    preservedLocalEdits: number;
    deduplicatedMatches: number;
    conflictsCount: number;
  };
  buildResolvedCsv: (choices: Record<string, 'local' | 'cloud'>) => string;
}

/**
 * Mesclagem inteligente 3-vias (BASE vs LOCAL vs CLOUD):
 * - Preserva alterações offline de outros usuários em SKUs diferentes dos seus.
 * - Deduplica automaticamente se dois dispositivos salvaram o mesmo SKU no mesmo endereço.
 * - Detecta conflito quando dois dispositivos salvaram o mesmo SKU em endereços DIFERENTES,
 *   garantindo que o SKU NUNCA seja duplicado em dois locais distintos.
 */
export function mergeThreeWayWmsCsv(params: {
  baseCsv?: string | null;
  localCsv: string;
  cloudCsv: string;
  localUpdatedAt?: string;
  cloudUpdatedAt?: string;
  localSkuTimestamps?: OfflineSkuTimestampMap;
}): ThreeWayMergeResult {
  const {
    baseCsv,
    localCsv,
    cloudCsv,
    localUpdatedAt = new Date().toISOString(),
    cloudUpdatedAt = '',
    localSkuTimestamps = loadOfflineSkuTimestamps()
  } = params;

  const baseIdx = baseCsv ? indexCsvByCanonicalSku(baseCsv) : null;
  const localIdx = indexCsvByCanonicalSku(localCsv);
  const cloudIdx = indexCsvByCanonicalSku(cloudCsv);

  const allSkuKeys = new Set<string>([
    ...(baseIdx ? Array.from(baseIdx.skuGroups.keys()) : []),
    ...Array.from(localIdx.skuGroups.keys()),
    ...Array.from(cloudIdx.skuGroups.keys())
  ]);

  const resolvedGroups = new Map<string, SkuItem[]>();
  const conflicts: SyncConflictItem[] = [];
  const conflictGroupPairs = new Map<string, { localItems: SkuItem[]; cloudItems: SkuItem[] }>();

  let preservedCloudEdits = 0;
  let preservedLocalEdits = 0;
  let deduplicatedMatches = 0;

  const cloudTsMs = cloudUpdatedAt ? Date.parse(cloudUpdatedAt) || 0 : 0;

  for (const skuKey of allSkuKeys) {
    const baseG = baseIdx?.skuGroups.get(skuKey);
    const localG = localIdx.skuGroups.get(skuKey);
    const cloudG = cloudIdx.skuGroups.get(skuKey);

    const baseSig = baseG ? baseG.wmsSignature : '';
    const localSig = localG ? localG.wmsSignature : '';
    const cloudSig = cloudG ? cloudG.wmsSignature : '';

    // 1. Ambos possuem o mesmo endereço (ou ambos removeram) -> Sem conflito e sem duplicação!
    if (localSig === cloudSig) {
      deduplicatedMatches++;
      if (localG && cloudG) {
        // Mescla itens por wms exato sem duplicar, preferindo o mais completo/recente
        const localTsEntry = localSkuTimestamps[skuKey];
        const useLocal = !localTsEntry || localTsEntry.updatedAt >= cloudTsMs;
        resolvedGroups.set(
          skuKey,
          deduplicateSkuItems(useLocal ? localG.items : cloudG.items).items
        );
      } else if (localG) {
        resolvedGroups.set(skuKey, deduplicateSkuItems(localG.items).items);
      }
      continue;
    }

    // 2. Existe BASE conhecida para comparação 3-vias exata
    if (baseIdx) {
      const cloudChanged = cloudSig !== baseSig;
      const localChanged = localSig !== baseSig;

      if (localChanged && !cloudChanged) {
        // Apenas este dispositivo alterou este SKU offline -> preserva alteração local
        preservedLocalEdits++;
        if (localG) resolvedGroups.set(skuKey, deduplicateSkuItems(localG.items).items);
        continue;
      }

      if (cloudChanged && !localChanged) {
        // Apenas outro dispositivo alterou este SKU na nuvem -> preserva alteração da nuvem
        preservedCloudEdits++;
        if (cloudG) resolvedGroups.set(skuKey, deduplicateSkuItems(cloudG.items).items);
        continue;
      }
    } else {
      // Sem BASE conhecida: usa o diário local de timestamps para saber se este dispositivo realmente editou este SKU
      const localTouched = Boolean(localSkuTimestamps[skuKey]);
      if (!localTouched && cloudG) {
        // Este dispositivo não editou esse SKU; nuvem trouxe atualização de outro usuário
        preservedCloudEdits++;
        resolvedGroups.set(skuKey, deduplicateSkuItems(cloudG.items).items);
        continue;
      }
      if (localTouched && !cloudG && localG) {
        // SKU recém-criado localmente que ainda não existe na nuvem
        preservedLocalEdits++;
        resolvedGroups.set(skuKey, deduplicateSkuItems(localG.items).items);
        continue;
      }
    }

    // 3. CONFLITO REAL: Ambos alteraram o mesmo SKU para endereços DIFERENTES!
    // Regra de ouro: NUNCA deixar o SKU salvo em dois endereços diferentes!
    const tsEntry = localSkuTimestamps[skuKey];
    const localTsMs = tsEntry?.updatedAt || (localUpdatedAt ? Date.parse(localUpdatedAt) || 0 : 0);
    const recommendedChoice: 'local' | 'cloud' = localTsMs >= cloudTsMs ? 'local' : 'cloud';

    const ref = localG || cloudG || baseG!;
    conflicts.push({
      skuKey,
      code: ref.code,
      name: ref.name,
      colorHex: ref.colorHex || '#0A84FF',
      baseLocal: baseG ? baseG.localDisplay : 'Não existia (SKU novo)',
      localLocal: localG ? localG.localDisplay : 'Removido neste dispositivo',
      localWmsList: localG ? localG.wmsList : [],
      localIsDeleted: !localG,
      localUpdatedAt: tsEntry?.updatedAtIso || localUpdatedAt,
      localDeviceId: tsEntry?.deviceId || getOrCreateSyncDeviceId(),
      cloudLocal: cloudG ? cloudG.localDisplay : 'Removido na nuvem',
      cloudWmsList: cloudG ? cloudG.wmsList : [],
      cloudIsDeleted: !cloudG,
      cloudUpdatedAt: cloudUpdatedAt || 'Nuvem (mais recente)',
      recommendedChoice
    });

    conflictGroupPairs.set(skuKey, {
      localItems: localG ? deduplicateSkuItems(localG.items).items : [],
      cloudItems: cloudG ? deduplicateSkuItems(cloudG.items).items : []
    });
  }

  // Mescla colmeias de Transbordo sem duplicatas
  const mergedTransbordo: Record<string, TransbordoEntry> = {
    ...cloudIdx.transbordo,
    ...localIdx.transbordo
  };

  // Mescla barraItems deduplicados por skuKey@@wms
  const mergedBarra = deduplicateSkuItems([...cloudIdx.barraItems, ...localIdx.barraItems]).items;

  const buildResolvedCsv = (choices: Record<string, 'local' | 'cloud'>): string => {
    const finalItems: SkuItem[] = [];
    for (const items of resolvedGroups.values()) {
      finalItems.push(...items);
    }
    for (const conflict of conflicts) {
      const pair = conflictGroupPairs.get(conflict.skuKey);
      if (!pair) continue;
      const choice = choices[conflict.skuKey] || conflict.recommendedChoice;
      const picked = choice === 'local' ? pair.localItems : pair.cloudItems;
      finalItems.push(...picked);
    }
    const cleanSkus = deduplicateSkuItems(finalItems).items;
    return buildSisplanCsvString(cleanSkus, mergedTransbordo, mergedBarra);
  };

  const defaultChoices: Record<string, 'local' | 'cloud'> = {};
  for (const c of conflicts) {
    defaultChoices[c.skuKey] = c.recommendedChoice;
  }

  return {
    status: conflicts.length > 0 ? 'conflicts_detected' : 'merged_clean',
    mergedCsv: buildResolvedCsv(defaultChoices),
    conflicts,
    summary: {
      preservedCloudEdits,
      preservedLocalEdits,
      deduplicatedMatches,
      conflictsCount: conflicts.length
    },
    buildResolvedCsv
  };
}

// ============================================================================
// GOOGLE APPS SCRIPT CLOUD SYNC (FETCH + JSONP FALLBACK FOR GOOGLE SITES)
// ============================================================================
export function getSavedCloudSyncUrl(): string {
  try {
    return localStorage.getItem(CLOUD_URL_STORAGE_KEY) || EMBEDDED_CLOUD_SYNC_URL;
  } catch {
    return EMBEDDED_CLOUD_SYNC_URL;
  }
}

export function setSavedCloudSyncUrl(url: string) {
  try {
    localStorage.setItem(CLOUD_URL_STORAGE_KEY, url.trim());
  } catch {
    // ignore
  }
}

function callCloudViaJsonp(
  urlStr: string,
  paramsObj: Record<string, string> = {},
  timeoutMs = 12000
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const cbName =
      'wmsCloudCb_' + Date.now() + '_' + Math.floor(Math.random() * 100000);
    const script = document.createElement('script');
    let timer: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      if (timer) clearTimeout(timer);
      try {
        delete (window as unknown as Record<string, unknown>)[cbName];
      } catch {
        (window as unknown as Record<string, unknown>)[cbName] = undefined;
      }
      if (script.parentNode) script.parentNode.removeChild(script);
    };

    (window as unknown as Record<string, unknown>)[cbName] = (data: Record<string, unknown>) => {
      cleanup();
      resolve(data);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error('Falha de conexão JSONP com o Google Apps Script'));
    };

    timer = setTimeout(() => {
      cleanup();
      reject(new Error('Tempo limite excedido ao conectar com a Planilha Google'));
    }, timeoutMs);

    const q = new URLSearchParams({
      ...paramsObj,
      callback: cbName,
      t: String(Date.now())
    });
    const sep = urlStr.includes('?') ? '&' : '?';
    script.src = `${urlStr}${sep}${q.toString()}`;
    document.head.appendChild(script);
  });
}

export async function pullStateFromCloud(
  cloudUrl: string
): Promise<{ csv: string; updatedAt?: string } | null> {
  const url = cloudUrl.trim();
  if (!url) return null;

  const sep = url.includes('?') ? '&' : '?';
  try {
    const res = await fetch(`${url}${sep}action=get&t=${Date.now()}`, {
      method: 'GET',
      redirect: 'follow'
    });
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data.csv === 'string' && data.csv.includes(';')) {
        return { csv: data.csv, updatedAt: data.updatedAt };
      }
    }
  } catch {
    // Fallback to JSONP for Google Sites iframe CORS restrictions
  }

  try {
    const data = await callCloudViaJsonp(url, { action: 'get' });
    if (data && typeof data.csv === 'string' && String(data.csv).includes(';')) {
      return { csv: String(data.csv), updatedAt: String(data.updatedAt || '') };
    }
  } catch {
    // ignore
  }
  return null;
}

export async function pushStateToCloud(
  cloudUrl: string,
  csvStr: string
): Promise<boolean> {
  const url = cloudUrl.trim();
  if (!url) return false;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'save',
        csv: csvStr,
        updatedAt: new Date().toISOString()
      })
    });
    if (res.ok) return true;
  } catch {
    // Fallback to JSONP/no-cors
    try {
      await fetch(url, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'save',
          csv: csvStr,
          updatedAt: new Date().toISOString()
        })
      });
      return true;
    } catch {
      // ignore
    }
  }
  return false;
}

// ============================================================================
// STANDALONE GOOGLE SITES HTML GENERATOR (CLEAN & OPTIMIZED)
// ============================================================================
export async function generateCleanStandaloneHtml(
  skus: SkuItem[],
  transbordoRegistry: Record<string, TransbordoEntry>,
  cloudSyncUrl: string
): Promise<string> {
  const csvStr = buildSisplanCsvString(skus, transbordoRegistry);
  const trbList = Object.values(transbordoRegistry);

  try {
    const res = await fetch('/assets/aistudio/estoque_macos_atualizado_2026-11-04__1__231bc99e.html');
    if (res.ok) {
      let rawHtml = await res.text();

      // 1. Remove duplicate Google Sites Atari <base> tags & scripts injected by old iframe exports
      rawHtml = rawHtml.replace(/<base[^>]*atari-embeds[^>]*>[\s\S]*?<\/script>/gi, '');

      // 2. Clean out the 3,500 lines of static pre-rendered cards inside #wmsMapCanvas and #macroStreetsStrip
      rawHtml = rawHtml.replace(
        /(<div id="macroStreetsStrip"[^>]*>)[\s\S]*?(<\/div>\s*<\/div>\s*<!-- Perspectives Bar)/i,
        '$1</div>$2'
      );

      // 3. Inject updated EMBEDDED_SISPLAN_CSV, EMBEDDED_TRANSBORDO_DATA, and EMBEDDED_CLOUD_SYNC_URL
      rawHtml = rawHtml.replace(
        /\/\*__CSV_DATA_START__\*\/[\s\S]*?\/\*__CSV_DATA_END__\*\//,
        `/*__CSV_DATA_START__*/const EMBEDDED_SISPLAN_CSV = ${JSON.stringify(csvStr)};/*__CSV_DATA_END__*/`
      );
      rawHtml = rawHtml.replace(
        /\/\*__TRANSBORDO_START__\*\/[\s\S]*?\/\*__TRANSBORDO_END__\*\//,
        `/*__TRANSBORDO_START__*/const EMBEDDED_TRANSBORDO_DATA = ${JSON.stringify(trbList)};/*__TRANSBORDO_END__*/`
      );
      rawHtml = rawHtml.replace(
        /\/\*__CLOUD_URL_START__\*\/[\s\S]*?\/\*__CLOUD_URL_END__\*\//,
        `/*__CLOUD_URL_START__*/const EMBEDDED_CLOUD_SYNC_URL = ${JSON.stringify(cloudSyncUrl.trim())};/*__CLOUD_URL_END__*/`
      );

      return '<!DOCTYPE html>\n' + rawHtml.trim();
    }
  } catch {
    // Fallback if template fetch fails
  }

  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>EstoqueOS Sequoia WMS</title></head><body><pre>${csvStr}</pre></body></html>`;
}

export function triggerCsvDownload(csvContent: string, filename: string) {
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Constrói o CSV de Guia do Operador para Peças Fora do Lugar (Remanejamento).
 * Indica de onde tirar, quantidade, SKU e onde guardar no cadastro oficial (ou S/Cadastro).
 */
export function buildOperatorMisplacedGuideCsv(
  skus: SkuItem[],
  barraItems: SkuItem[] = [],
  conflictSlots?: Set<string>
): { csv: string; count: number; totalPieces: number } {
  const headers = [
    'ONDE_TIRAR_WMS',
    'RUA_ORIGEM',
    'POSICAO_ORIGEM',
    'NIVEL_ORIGEM',
    'QTD_PECAS_A_TIRAR',
    'ONDE_GUARDAR_DESTINO',
    'STATUS_LOCAL',
    'SKU_COMPLETO',
    'CODIGO_PRODUTO',
    'DESCRICAO_PRODUTO',
    'GRUPO',
    'COR',
    'TAMANHO',
    'COLECAO',
    'INSTRUCAO_OPERADOR',
    'DATA_EXPORTACAO'
  ];

  // Combina itens de ambas as perspectivas para nunca deixar nenhuma peça incorreta de fora
  const candidateItems: SkuItem[] = [];
  const seenCandidateIds = new Set<string>();

  for (const item of [...barraItems, ...skus]) {
    if (!item || item.isTransbordo) continue;
    // Identificador para evitar duplicatas entre barraItems e skus
    const uniqueKey = `${item.wms}|${getCanonicalSkuKey(item.code)}`;
    if (seenCandidateIds.has(uniqueKey)) continue;
    seenCandidateIds.add(uniqueKey);
    candidateItems.push(item);
  }

  const misplacedRows: {
    wms: string;
    rua: string;
    pos: number;
    nivel: number;
    qty: number;
    destino: string;
    skuCode: string;
    codigoBase: string;
    grupo: string;
    nome: string;
    cor: string;
    tam: string;
    colecao: string;
    instrucao: string;
    status: string;
  }[] = [];

  const seenKeys = new Set<string>();
  let totalPieces = 0;
  const nowIso = new Date().toISOString().replace('T', ' ').slice(0, 19);

  for (const item of candidateItems) {
    const rawCad = (item.localCadastroRaw || item.rawLocal || '').trim();
    const hasNoCad =
      !rawCad ||
      /^(sem\s*local|s\/?cadastro|s\/?local|null|undefined|nao\s*cadastrado|n\/?a|vazio)$/i.test(rawCad) ||
      rawCad === '-' ||
      rawCad === '—';

    // Endereço normalizado do cadastro
    const cleanCad = hasNoCad ? 'S/Cadastro' : rawCad;

    // Verifica se a colmeia atual não bate com o local cadastrado
    const isMismatch = Boolean(rawCad && !hasNoCad && !rawCad.toUpperCase().includes(item.wms.toUpperCase()));
    const isConflict = Boolean(conflictSlots && conflictSlots.has(item.wms));
    const isMisplaced = Boolean(item.isOutsideRegisteredLocal || hasNoCad || isMismatch || isConflict);

    if (!isMisplaced) continue;

    const dec = decodeSkuPrefix(item.code, item.colorCode, item.size);
    const codigoBase = item.codigoBase || dec.dMarca + dec.dEtiqueta + dec.dGrupo + dec.modelSeq;
    const destinoLocal = hasNoCad ? 'S/Cadastro' : cleanCad;
    const qty = item.qtdForaDoLocal || item.qty || 1;

    const dedupeKey = `${item.wms}|${codigoBase}|${dec.colorCode}|${dec.size}|${destinoLocal}`;
    if (seenKeys.has(dedupeKey)) continue;
    seenKeys.add(dedupeKey);

    const instrucao = hasNoCad
      ? `Retirar ${qty} pçs de ${item.wms} -> Item S/Cadastro: encaminhar para Triagem/Pulmão de Cadastro`
      : `Retirar ${qty} pçs de ${item.wms} e alocar no endereço cadastrado ${destinoLocal}`;

    const status = hasNoCad
      ? 'Item S/Cadastro (Sem Local Definido)'
      : isConflict
      ? 'Conflito de Sobreposição / Fora do Local'
      : 'Fora do Local Cadastrado';

    totalPieces += qty;

    misplacedRows.push({
      wms: item.wms,
      rua: item.rua,
      pos: item.pos,
      nivel: item.nivel,
      qty,
      destino: destinoLocal,
      skuCode: item.code,
      codigoBase,
      grupo: dec.grupo,
      nome: dec.autoName,
      cor: `${dec.colorCode} - ${dec.colorName}`,
      tam: dec.size,
      colecao: item.colecao || '—',
      instrucao,
      status
    });
  }

  // Ordena por Rua, Posição e Nível para criar rota lógica de corredor físico para o operador
  misplacedRows.sort((a, b) => {
    if (a.rua !== b.rua) return a.rua.localeCompare(b.rua);
    if (a.pos !== b.pos) return a.pos - b.pos;
    return a.nivel - b.nivel;
  });

  const lines = [headers.join(';')];
  for (const r of misplacedRows) {
    lines.push(
      [
        r.wms,
        r.rua,
        r.pos,
        r.nivel,
        r.qty,
        `"${r.destino.replace(/"/g, '""')}"`,
        `"${r.status.replace(/"/g, '""')}"`,
        `"${r.skuCode.replace(/"/g, '""')}"`,
        r.codigoBase,
        `"${r.nome.replace(/"/g, '""')}"`,
        `"${r.grupo.replace(/"/g, '""')}"`,
        `"${r.cor.replace(/"/g, '""')}"`,
        r.tam,
        r.colecao,
        `"${r.instrucao.replace(/"/g, '""')}"`,
        `"${nowIso}"`
      ].join(';')
    );
  }

  return {
    csv: '\uFEFF' + lines.join('\r\n'),
    count: misplacedRows.length,
    totalPieces
  };
}

export const IMPORT_HISTORY_STORAGE_KEY = 'estoque_os_import_occupancy_history_v1';

export function loadStoredImportHistory(): any[] {
  try {
    const raw = localStorage.getItem(IMPORT_HISTORY_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // fallback
  }
  return [];
}

export function saveStoredImportHistory(history: any[]) {
  try {
    localStorage.setItem(IMPORT_HISTORY_STORAGE_KEY, JSON.stringify(history.slice(-20)));
  } catch (err) {
    console.warn('Erro ao salvar histórico de importações:', err);
  }
}

export function generateDefaultImportHistory(
  currentByStreet: Record<string, { pct: number }>,
  currentGlobalPct: number,
  currentTotalPieces: number,
  currentTotalSkus: number
) {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  const checkpoints = [
    { daysAgo: 6, offsetFactor: -18, label: 'Importação #1 (Base Sisplan)' },
    { daysAgo: 4, offsetFactor: -11, label: 'Importação #2 (Reposição)' },
    { daysAgo: 2, offsetFactor: -4, label: 'Importação #3 (Movimentação)' },
    { daysAgo: 1, offsetFactor: 2, label: 'Importação #4 (Ajuste Corredores)' },
    { daysAgo: 0, offsetFactor: 0, label: 'Importação #5 (Atual)' }
  ];

  return checkpoints.map((cp, idx) => {
    const ts = now - cp.daysAgo * dayMs;
    const d = new Date(ts);
    const dateStr = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    const fullDateTime =
      d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
      ' ' +
      d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const streetMap: Record<string, number> = {};
    for (const [rua, data] of Object.entries(currentByStreet)) {
      const basePct = data.pct || 0;
      if (idx === checkpoints.length - 1) {
        streetMap[rua] = basePct;
      } else {
        const pseudoVariance = ((rua.charCodeAt(0) * 7 + (rua.charCodeAt(1) || 0) * 3 + idx * 5) % 9) - 4;
        const val = Math.max(8, Math.min(98, Math.round(basePct + cp.offsetFactor + pseudoVariance)));
        streetMap[rua] = val;
      }
    }

    const globPct =
      idx === checkpoints.length - 1
        ? currentGlobalPct
        : Math.max(10, Math.min(95, Math.round(currentGlobalPct + cp.offsetFactor)));

    const pcs = Math.round(currentTotalPieces * (globPct / Math.max(1, currentGlobalPct)));

    return {
      id: `snap-${idx + 1}-${ts}`,
      importIndex: idx + 1,
      label: cp.label,
      dateStr,
      fullDateTime,
      timestamp: ts,
      streetOccupancyMap: streetMap,
      globalOccupancyPct: globPct,
      totalPieces: pcs,
      totalSkus: currentTotalSkus
    };
  });
}

export function appendImportHistorySnapshot(
  existingHistory: any[],
  byStreetStats: Record<string, { pct: number }>,
  globalPct: number,
  totalPieces: number,
  totalSkus: number,
  fileName?: string
) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  const fullDateTime =
    now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
    ' ' +
    now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const streetMap: Record<string, number> = {};
  for (const [rua, data] of Object.entries(byStreetStats)) {
    streetMap[rua] = data.pct || 0;
  }

  const nextIndex = existingHistory.length + 1;
  const newSnapshot = {
    id: `snap-${nextIndex}-${Date.now()}`,
    importIndex: nextIndex,
    label: `Importação #${nextIndex}${fileName ? ` (${fileName})` : ' (Nova Carga)'}`,
    dateStr,
    fullDateTime,
    timestamp: Date.now(),
    fileName,
    streetOccupancyMap: streetMap,
    globalOccupancyPct: globalPct,
    totalPieces,
    totalSkus
  };

  const updated = [...existingHistory, newSnapshot].slice(-20);
  saveStoredImportHistory(updated);
  return updated;
}

