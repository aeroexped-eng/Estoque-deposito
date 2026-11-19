import {
  SkuItem,
  getCanonicalSkuKey,
  isPulmaoStreet,
  formatLevelsToSisplanLocal
} from '../constants/wmsConstants';

export interface DuplicateSkuLocationGroup {
  towerKey: string;
  rua: string;
  pos: number;
  levels: number[];
  addresses: string[];
  formattedRange: string;
  totalQty: number;
  items: SkuItem[];
}

export type DuplicateSkuSeverity =
  | 'cross_street'
  | 'same_street_diff_tower'
  | 'same_slot_duplicate';

export interface DuplicateSkuAlertEntry {
  skuKey: string;
  skuCode: string;
  skuName: string;
  brand: string;
  colorCode: string;
  colorName: string;
  colorHex: string;
  size: string;
  colecao: string;
  deposito: string;
  totalQty: number;
  severity: DuplicateSkuSeverity;
  severityLabel: string;
  locations: DuplicateSkuLocationGroup[];
  allAddresses: string[];
  distinctStreets: string[];
  distinctTowersCount: number;
  hasSameSlotDuplicate: boolean;
}

export interface AddressMapDuplicateScanResult {
  duplicates: DuplicateSkuAlertEntry[];
  duplicateSkuKeys: Set<string>;
  affectedSlots: Set<string>;
  bySkuKey: Map<string, DuplicateSkuAlertEntry>;
  scannedSlotsCount: number;
  uniqueSkusScanned: number;
  multiLevelSameTowerCount: number;
  scannedAtIso: string;
}

interface InternalTowerAcc {
  towerKey: string;
  rua: string;
  pos: number;
  levels: Set<number>;
  addresses: Set<string>;
  totalQty: number;
  items: SkuItem[];
}

interface InternalSkuAcc {
  skuKey: string;
  sampleItem: SkuItem;
  towers: Map<string, InternalTowerAcc>;
  streets: Set<string>;
  allAddresses: Set<string>;
  slotCounts: Map<string, number>;
  totalQty: number;
}

function parseSlotMeta(wmsKey: string, item: SkuItem): { rua: string; pos: number; nivel: number } {
  const parts = String(wmsKey || item.wms || '').trim().toUpperCase().split('.');
  const rua = (item.rua || parts[0] || '').trim().toUpperCase();
  const pos = Number.isFinite(item.pos) && item.pos > 0 ? item.pos : parseInt(parts[1] || '0', 10) || 0;
  const nivel =
    Number.isFinite(item.nivel) && item.nivel > 0 ? item.nivel : parseInt(parts[2] || '1', 10) || 1;
  return { rua, pos, nivel };
}

/**
 * Escaneia automaticamente todo o `addressMap` em busca de códigos de SKU idênticos
 * salvos em endereços/torres diferentes (ou duplicados no mesmo endereço).
 *
 * Regras de negócio WMS:
 * - Ignora marcações virtuais de Transbordo (`isTransbordo`) e células genéricas de Pulmão.
 * - Alocações verticais de um mesmo SKU em múltiplos níveis da MESMA torre (ex: RF.001.1 - 4)
 *   são reconhecidas como alocação multinível regular e contabilizadas separadamente.
 * - Qualquer SKU idêntico presente em 2+ torres/endereços distintos (mesma rua ou ruas diferentes)
 *   ou repetido dentro do mesmo slot gera um alerta estruturado para a interface de auditoria.
 */
export function scanAddressMapForDuplicateSkus(
  addressMap: Map<string, SkuItem[]>
): AddressMapDuplicateScanResult {
  const skuMap = new Map<string, InternalSkuAcc>();
  let scannedSlotsCount = 0;

  for (const [wmsKey, rawItems] of addressMap.entries()) {
    scannedSlotsCount++;
    if (!rawItems || rawItems.length === 0) continue;

    for (const item of rawItems) {
      if (!item || item.isTransbordo) continue;

      const { rua, pos, nivel } = parseSlotMeta(wmsKey, item);
      const isPulmaoItem =
        isPulmaoStreet(rua) ||
        item.codigoBase === 'PULMAO' ||
        String(item.code || '').toUpperCase().startsWith('PULMAO-');
      if (isPulmaoItem) continue;

      const skuKey = getCanonicalSkuKey(item.code);
      if (!skuKey) continue;

      const normalizedWms = String(wmsKey || item.wms || '').trim().toUpperCase();
      const towerKey = `${rua}.${String(pos).padStart(3, '0')}`;
      const qty = typeof item.qty === 'number' && !Number.isNaN(item.qty) ? item.qty : 1;

      let acc = skuMap.get(skuKey);
      if (!acc) {
        acc = {
          skuKey,
          sampleItem: item,
          towers: new Map(),
          streets: new Set(),
          allAddresses: new Set(),
          slotCounts: new Map(),
          totalQty: 0
        };
        skuMap.set(skuKey, acc);
      }

      acc.streets.add(rua);
      acc.allAddresses.add(normalizedWms);
      acc.slotCounts.set(normalizedWms, (acc.slotCounts.get(normalizedWms) || 0) + 1);
      acc.totalQty += qty;

      let towerAcc = acc.towers.get(towerKey);
      if (!towerAcc) {
        towerAcc = {
          towerKey,
          rua,
          pos,
          levels: new Set(),
          addresses: new Set(),
          totalQty: 0,
          items: []
        };
        acc.towers.set(towerKey, towerAcc);
      }

      towerAcc.levels.add(nivel);
      towerAcc.addresses.add(normalizedWms);
      towerAcc.totalQty += qty;
      towerAcc.items.push(item);
    }
  }

  const duplicates: DuplicateSkuAlertEntry[] = [];
  const duplicateSkuKeys = new Set<string>();
  const affectedSlots = new Set<string>();
  const bySkuKey = new Map<string, DuplicateSkuAlertEntry>();
  let multiLevelSameTowerCount = 0;

  for (const [skuKey, acc] of skuMap.entries()) {
    const distinctTowersCount = acc.towers.size;
    let hasSameSlotDuplicate = false;
    for (const count of acc.slotCounts.values()) {
      if (count > 1) {
        hasSameSlotDuplicate = true;
        break;
      }
    }

    if (distinctTowersCount === 1 && acc.allAddresses.size > 1 && !hasSameSlotDuplicate) {
      multiLevelSameTowerCount++;
      continue;
    }

    if (distinctTowersCount > 1 || hasSameSlotDuplicate) {
      const locations: DuplicateSkuLocationGroup[] = Array.from(acc.towers.values())
        .sort((a, b) => a.rua.localeCompare(b.rua) || a.pos - b.pos)
        .map(t => {
          const sortedLevels = Array.from(t.levels).sort((a, b) => a - b);
          const sortedAddresses = Array.from(t.addresses).sort();
          const formattedRange = formatLevelsToSisplanLocal(t.rua, t.pos, sortedLevels);
          return {
            towerKey: t.towerKey,
            rua: t.rua,
            pos: t.pos,
            levels: sortedLevels,
            addresses: sortedAddresses,
            formattedRange,
            totalQty: t.totalQty,
            items: t.items
          };
        });

      const distinctStreets = Array.from(acc.streets).sort();
      const allAddresses = Array.from(acc.allAddresses).sort();

      let severity: DuplicateSkuSeverity = 'same_slot_duplicate';
      let severityLabel = 'Duplicado no Mesmo Slot';
      if (distinctStreets.length > 1) {
        severity = 'cross_street';
        severityLabel = `Ruas Diferentes (${distinctStreets.join(' × ')})`;
      } else if (distinctTowersCount > 1) {
        severity = 'same_street_diff_tower';
        severityLabel = `${distinctTowersCount} Torres na Rua ${distinctStreets[0]}`;
      }

      const sample = acc.sampleItem;
      const entry: DuplicateSkuAlertEntry = {
        skuKey,
        skuCode: sample.code,
        skuName: sample.name || 'Produto sem descrição',
        brand: sample.brand || '—',
        colorCode: sample.colorCode || '—',
        colorName: sample.colorName || '—',
        colorHex: sample.colorHex || '#94A3B8',
        size: sample.size || '—',
        colecao: sample.colecao || '—',
        deposito: sample.deposito || '2',
        totalQty: acc.totalQty,
        severity,
        severityLabel,
        locations,
        allAddresses,
        distinctStreets,
        distinctTowersCount,
        hasSameSlotDuplicate
      };

      duplicates.push(entry);
      duplicateSkuKeys.add(skuKey);
      bySkuKey.set(skuKey, entry);
      for (const wms of allAddresses) {
        affectedSlots.add(wms);
      }
    }
  }

  const severityOrder: Record<DuplicateSkuSeverity, number> = {
    cross_street: 0,
    same_street_diff_tower: 1,
    same_slot_duplicate: 2
  };

  duplicates.sort((a, b) => {
    const sevDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (sevDiff !== 0) return sevDiff;
    const locDiff = b.locations.length - a.locations.length;
    if (locDiff !== 0) return locDiff;
    return a.skuCode.localeCompare(b.skuCode);
  });

  return {
    duplicates,
    duplicateSkuKeys,
    affectedSlots,
    bySkuKey,
    scannedSlotsCount,
    uniqueSkusScanned: skuMap.size,
    multiLevelSameTowerCount,
    scannedAtIso: new Date().toISOString()
  };
}
