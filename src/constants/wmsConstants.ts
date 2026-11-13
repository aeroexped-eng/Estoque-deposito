export interface SkuItem {
  id: string;
  code: string;
  codigoBase: string;
  name: string;
  brand: string;
  label: string;
  groupCode: string;
  groupName: string;
  colorCode: string;
  colorName: string;
  colorHex: string;
  size: string;
  deposito: string;
  rua: string;
  pos: number;
  nivel: number;
  wms: string;
  rawLocal: string;
  localCadastroRaw?: string;
  localAtualRaw?: string;
  qtdForaDoLocal?: number;
  isOutsideRegisteredLocal?: boolean;
  colecao: string;
  qty: number;
  icon: string;
  isTransbordo?: boolean;
  transbordoNote?: string;
  transbordoCreatedAt?: string;
  lastRelocatedFrom?: string;
}

export interface TransbordoEntry {
  wms: string;
  rua: string;
  pos: number;
  nivel: number;
  code: string;
  deposito: string;
  note: string;
  createdAt: string;
}

export interface MovedSkuEntry {
  skuKey: string;
  code: string;
  codigoBase: string;
  colorCode: string;
  size: string;
  deposito: string;
  oldLocal: string;
  newLocal: string;
  movedAt: string;
  timestamp?: number;
  source: 'drag' | 'relocate' | 'modal';
  name: string;
  qty?: number;
  ruaOrigem?: string;
  ruaDestino?: string;
}

export interface ParsedWmsAddress {
  rua: string;
  pos: number;
  nivel: number;
  wms: string;
}

export interface StreetMeta {
  maxPos: number;
  maxLevels: number;
  evenLevels?: number;
  oddLevels?: number;
  maxEvenPos?: number;
  evenLowMaxPos?: number;
  evenLowLevels?: number;
  evenHighMaxPos?: number;
  evenHighLevels?: number;
  oddMaxPos?: number;
  missingPositions?: number[];
  evenOnly?: boolean;
  oddOnly?: boolean;
  badge: string;
  desc: string;
}

export const STREETS = [
  'RA', 'RB', 'RC', 'RD', 'RE', 'RF', 'RG', 'RH',
  'AA', 'AB', 'AC', 'AD', 'AE', 'AF',
  'PA', 'PB', 'PC', 'PD', 'PE', 'PF', 'PG', 'PH', 'PI'
] as const;

export const RESERVED_COL35_STREETS = ['RF', 'RG', 'RH'];
export const ACCESSORIES_STREETS = ['AA', 'AB', 'AC', 'AD', 'AE', 'AF'];
export const PULMAO_STREETS = ['PA', 'PB', 'PC', 'PD', 'PE', 'PF', 'PG', 'PH', 'PI'];
export const TOTAL_ADDRESSES_PER_STREET = 175;
export const TOTAL_LEVELS = 7;

export const STREET_META: Record<string, StreetMeta> = {
  RA: { maxPos: 90, maxLevels: 4, badge: '1–90 • 4N', desc: 'End. 1 a 90 • 4 Níveis' },
  RB: { maxPos: 119, maxLevels: 7, badge: '1–119 • 7N', desc: 'End. 1 a 119 • 7 Níveis' },
  RC: { maxPos: 112, maxLevels: 7, badge: '1–112 • 7N', desc: 'End. 1 a 112 • 7 Níveis' },
  RD: { maxPos: 159, maxLevels: 7, evenLevels: 7, oddLevels: 6, maxEvenPos: 112, badge: 'P:7N | I:6N', desc: 'Lado Par 2–112 (7N) • Lado Ímpar 1–159 (6N)' },
  RE: { maxPos: 160, maxLevels: 6, badge: '1–160 • 6N', desc: 'End. 1 a 160 • 6 Níveis' },
  RF: { maxPos: 160, maxLevels: 6, badge: 'Col.35 • 1–160 (6N)', desc: 'Reservado Coleção 35 (1–160 • 6N)' },
  RG: { maxPos: 160, maxLevels: 6, missingPositions: [79], badge: 'Col.35 • 1–160 s/79 (6N)', desc: 'Reserva Col. 35 • 1–160 s/ 79 (77, 78, 80, 81 • 6N)' },
  RH: {
    maxPos: 175,
    maxLevels: 6,
    evenLowMaxPos: 80,
    evenLowLevels: 6,
    evenHighMaxPos: 168,
    evenHighLevels: 5,
    oddMaxPos: 175,
    oddLevels: 5,
    missingPositions: [79],
    badge: 'P:2–168 | I:1–175(s/79)',
    desc: 'Reserva Col. 35 • Par 2–80 (6N) e 82–168 (5N) • Ímpar 1–175 s/ 79 (5N)'
  },
  // ALA DE ACESSÓRIOS (AA a AF)
  AA: { maxPos: 70, maxLevels: 7, evenOnly: true, badge: 'Acess. • Pares 2–70 (7N)', desc: 'Ala de Acessórios • Apenas Pares 2 a 70 • 7 Níveis' },
  AB: { maxPos: 13, maxLevels: 4, badge: 'Acess. • 1–13 (4N)', desc: 'Ala de Acessórios • End. 1 a 13 • 4 Níveis' },
  AC: { maxPos: 22, maxLevels: 5, badge: 'Acess. • 1–22 (5N)', desc: 'Ala de Acessórios • End. 1 a 22 • 5 Níveis' },
  AD: { maxPos: 22, maxLevels: 5, badge: 'Acess. • 1–22 (5N)', desc: 'Ala de Acessórios • End. 1 a 22 • 5 Níveis' },
  AE: { maxPos: 22, maxLevels: 5, badge: 'Acess. • 1–22 (5N)', desc: 'Ala de Acessórios • End. 1 a 22 • 5 Níveis' },
  AF: { maxPos: 22, maxLevels: 5, badge: 'Acess. • 1–22 (5N)', desc: 'Ala de Acessórios • End. 1 a 22 • 5 Níveis' },
  // PULMÃO TEMPORÁRIO (PA a PI — Sem SKU Cadastrado Fixo)
  PA: { maxPos: 39, maxLevels: 5, oddOnly: true, badge: 'Pulmão • Ímpares 1–39 (5N)', desc: 'Pulmão Temporário • Apenas Ímpares 1 a 39 • 5 Níveis (Sem SKU fixo)' },
  PB: { maxPos: 40, maxLevels: 5, badge: 'Pulmão • 1–40 (5N)', desc: 'Pulmão Temporário • End. 1 a 40 • 5 Níveis (Sem SKU fixo)' },
  PC: { maxPos: 40, maxLevels: 5, badge: 'Pulmão • 1–40 (5N)', desc: 'Pulmão Temporário • End. 1 a 40 • 5 Níveis (Sem SKU fixo)' },
  PD: { maxPos: 40, maxLevels: 5, badge: 'Pulmão • 1–40 (5N)', desc: 'Pulmão Temporário • End. 1 a 40 • 5 Níveis (Sem SKU fixo)' },
  PE: { maxPos: 40, maxLevels: 5, badge: 'Pulmão • 1–40 (5N)', desc: 'Pulmão Temporário • End. 1 a 40 • 5 Níveis (Sem SKU fixo)' },
  PF: { maxPos: 40, maxLevels: 5, badge: 'Pulmão • 1–40 (5N)', desc: 'Pulmão Temporário • End. 1 a 40 • 5 Níveis (Sem SKU fixo)' },
  PG: { maxPos: 40, maxLevels: 5, badge: 'Pulmão • 1–40 (5N)', desc: 'Pulmão Temporário • End. 1 a 40 • 5 Níveis (Sem SKU fixo)' },
  PH: { maxPos: 40, maxLevels: 5, badge: 'Pulmão • 1–40 (5N)', desc: 'Pulmão Temporário • End. 1 a 40 • 5 Níveis (Sem SKU fixo)' },
  PI: { maxPos: 40, maxLevels: 5, badge: 'Pulmão • 1–40 (5N)', desc: 'Pulmão Temporário • End. 1 a 40 • 5 Níveis (Sem SKU fixo)' }
};

export const ADDRESS_RANGES = [
  { id: '1-20', start: 1, end: 20, label: 'End. 001–020' },
  { id: '21-40', start: 21, end: 40, label: 'End. 021–040' },
  { id: '41-60', start: 41, end: 60, label: 'End. 041–060' },
  { id: '61-80', start: 61, end: 80, label: 'End. 061–080' },
  { id: '81-100', start: 81, end: 100, label: 'End. 081–100' },
  { id: '101-120', start: 101, end: 120, label: 'End. 101–120' },
  { id: '121-140', start: 121, end: 140, label: 'End. 121–140' },
  { id: '141-160', start: 141, end: 160, label: 'End. 141–160' },
  { id: '161-175', start: 161, end: 175, label: 'End. 161–175' },
  { id: 'ALL-OCCUPIED', start: 1, end: 175, label: 'Todos Ocupados da Rua' },
  { id: 'ALL', start: 1, end: 175, label: 'Toda a Rua' },
];

export const AERO_BRANDS: Record<string, string> = {
  '1': 'Aero',
  '2': 'Aero Perene',
  '3': 'Troya'
};

export const AERO_LABELS: Record<string, string> = {
  '1': 'Masculino',
  '2': 'Feminino',
  '3': 'Infantil',
  '4': 'Marketing'
};

// Conforme documento oficial "Como é formado o código de produto Aero?"
export const AERO_GROUPS: Record<string, { name: string; icon: string }> = {
  '01': { name: 'Bermuda', icon: '🩳' },
  '1': { name: 'Bermuda', icon: '🩳' },
  '02': { name: 'Blazer', icon: '🧥' },
  '2': { name: 'Blazer', icon: '🧥' },
  '03': { name: 'Blusão', icon: '👕' },
  '3': { name: 'Blusão', icon: '👕' },
  '04': { name: 'Calça', icon: '👖' },
  '4': { name: 'Calça', icon: '👖' },
  '05': { name: 'Camisa', icon: '👔' },
  '5': { name: 'Camisa', icon: '👔' },
  '06': { name: 'Camiseta', icon: '👕' },
  '6': { name: 'Camiseta', icon: '👕' },
  '07': { name: 'Bata', icon: '👚' },
  '7': { name: 'Bata', icon: '👚' },
  '08': { name: 'Cueca', icon: '🩲' },
  '8': { name: 'Cueca', icon: '🩲' },
  '09': { name: 'Jaqueta', icon: '🧥' },
  '9': { name: 'Jaqueta', icon: '🧥' },
  '10': { name: 'Meia', icon: '🧦' },
  '11': { name: 'Polo', icon: '👕' },
  '12': { name: 'Saia', icon: '👗' },
  '13': { name: 'Calçados', icon: '👟' },
  '14': { name: 'Short', icon: '🩳' },
  '15': { name: 'Tricot', icon: '🧶' },
  '16': { name: 'Vestido', icon: '👗' },
  '17': { name: 'Sunga', icon: '🩲' },
  '18': { name: 'Baby Look', icon: '👚' },
  '19': { name: 'Cropped', icon: '👚' },
  '21': { name: 'Regata', icon: '🎽' },
  '22': { name: 'Acessórios', icon: '🎒' },
  '23': { name: 'Boné', icon: '🧢' },
  '24': { name: 'Óculos', icon: '🕶️' },
  '25': { name: 'Marketing', icon: '📢' },
  '26': { name: 'Bermuda Jeans', icon: '🩳' },
  '27': { name: 'Calça Jeans', icon: '👖' },
  '28': { name: 'Jaqueta Jeans', icon: '🧥' },
  '29': { name: 'Camisa Jeans', icon: '👔' },
  '30': { name: 'Colete', icon: '🦺' },
  '32': { name: 'Short Jeans', icon: '🩳' },
  '33': { name: 'Perfume', icon: '🧴' },
  '34': { name: 'Mochila', icon: '🎒' },
  '35': { name: 'Bolsa', icon: '👜' },
  '36': { name: 'Copo', icon: '🥤' },
  '37': { name: 'Embalagem Aero', icon: '📦' },
  '38': { name: 'Garrafa', icon: '🍼' },
  '39': { name: 'Mala', icon: '🧳' },
  '40': { name: 'PDV', icon: '🏪' }
};

export const OFFICIAL_COLORS: Record<string, { name: string; hex: string; border: string }> = {
  // Grupo 1: Neutros Básicos
  '101': { name: 'TRANSLUCIDO', hex: '#F8FAFC', border: '#CBD5E1' },
  '102': { name: 'BRANCO', hex: '#FFFFFF', border: '#E2E8F0' },
  '105': { name: 'SORTIDA', hex: '#A855F7', border: '#9333EA' },
  '108': { name: 'EM CRU DENIN', hex: '#EDE8D0', border: '#D6CEB2' },
  '109': { name: 'PRETO', hex: '#18181B', border: '#27272A' },

  // Grupo 2: Bege (BG) e Marrom (MR)
  '201': { name: 'BG SUAVE OFF WHITE', hex: '#FAF7F0', border: '#E4DEC9' },
  '202': { name: 'BG CLARO NATURAL AREIA', hex: '#E8DCB8', border: '#D2C396' },
  '203': { name: 'BG TRANSITION', hex: '#D6C4A5', border: '#B8A381' },
  '204': { name: 'BG MESCLA', hex: '#C2B29A', border: '#A6947A' },
  '205': { name: 'BG MEDIO', hex: '#B59F84', border: '#967F63' },
  '206': { name: 'BG VIBRANTE', hex: '#C99355', border: '#A87438' },
  '207': { name: 'BG OLD COURO', hex: '#8C5835', border: '#6E4021' },
  '208': { name: 'MR INTENSO MARRON', hex: '#5C3826', border: '#422516' },
  '209': { name: 'MR DARK MARROM', hex: '#3B2219', border: '#25130D' },

  // Grupo 3: Laranja (LJ)
  '302': { name: 'LJ CLARO', hex: '#FDBA74', border: '#FB923C' },
  '304': { name: 'LJ MESCLA', hex: '#FB923C', border: '#EA580C' },
  '305': { name: 'LJ MEDIO', hex: '#F97316', border: '#C2410C' },
  '307': { name: 'LJ OLD COBRE', hex: '#C25E2E', border: '#9A441B' },
  '308': { name: 'LJ INTENSO', hex: '#EA580C', border: '#9A3412' },
  '309': { name: 'LJ DARK', hex: '#9A3412', border: '#7C2D12' },

  // Grupo 4: Azul (AZ)
  '401': { name: 'AZ SUAVE DELAVE', hex: '#BAE6FD', border: '#7DD3FC' },
  '402': { name: 'AZ CLARO', hex: '#60A5FA', border: '#3B82F6' },
  '403': { name: 'AZ TRANSITION', hex: '#38BDF8', border: '#0284C7' },
  '404': { name: 'AZ MESCLA', hex: '#64748B', border: '#475569' },
  '405': { name: 'AZ MEDIO', hex: '#2563EB', border: '#1D4ED8' },
  '406': { name: 'AZ VIBRANTE', hex: '#0284C7', border: '#0369A1' },
  '408': { name: 'AZ INTENSO', hex: '#1D4ED8', border: '#1E40AF' },
  '409': { name: 'AZ DARK MARINHO INDIGO', hex: '#0F172A', border: '#1E293B' },

  // Grupo 5: Verde (VD)
  '501': { name: 'VD SUAVE', hex: '#A7F3D0', border: '#6EE7B7' },
  '502': { name: 'VD CLARO', hex: '#86EFAC', border: '#4ADE80' },
  '503': { name: 'VD TRANSITION', hex: '#4ADE80', border: '#22C55E' },
  '504': { name: 'VERDE LIGHT', hex: '#84CC16', border: '#65A30D' },
  '505': { name: 'VD MEDIO', hex: '#16A34A', border: '#15803D' },
  '506': { name: 'VD VIBRANTE', hex: '#10B981', border: '#059669' },
  '507': { name: 'VD OLD', hex: '#4D7C0F', border: '#3F6212' },
  '508': { name: 'VD INTENSO', hex: '#15803D', border: '#166534' },
  '509': { name: 'VD DARK', hex: '#14532D', border: '#052E16' },

  // Grupo 6: Amarelo (AM)
  '601': { name: 'AM SUAVE', hex: '#FEF08A', border: '#FDE047' },
  '602': { name: 'AM CLARO', hex: '#FACC15', border: '#EAB308' },
  '604': { name: 'AM MESCLA', hex: '#EAB308', border: '#CA8A04' },
  '605': { name: 'AM MEDIO', hex: '#D97706', border: '#B45309' },
  '607': { name: 'AM OLD OURO VELHO', hex: '#B45309', border: '#92400E' },
  '609': { name: 'AM DARK', hex: '#78350F', border: '#451A03' },

  // Grupo 7: Rosa (RS) e Roxo (RX)
  '701': { name: 'RS SUAVE', hex: '#FCE7F3', border: '#FBCFE8' },
  '702': { name: 'RS CLARO', hex: '#F9A8D4', border: '#F472B6' },
  '703': { name: 'RX TRANSITION', hex: '#C084FC', border: '#A855F7' },
  '704': { name: 'RS MESCLA', hex: '#F472B6', border: '#EC4899' },
  '705': { name: 'RS MEDIO', hex: '#EC4899', border: '#DB2777' },

  // Grupo 8: Vermelho (VM)
  '804': { name: 'VM MESCLA', hex: '#FB7185', border: '#F43F5E' },
  '805': { name: 'VM MEDIO CARMIM', hex: '#E11D48', border: '#BE123C' },
  '806': { name: 'VM VIBRANTE', hex: '#DC2626', border: '#B91C1C' },
  '807': { name: 'VM OLD', hex: '#991B1B', border: '#7F1D1D' },
  '808': { name: 'VM INTENSO', hex: '#B91C1C', border: '#881337' },
  '809': { name: 'VM DARK VINHO', hex: '#58111A', border: '#3D0A11' },

  // Grupo 9: Cinza (CZ)
  '901': { name: 'CZ SUAVE', hex: '#E2E8F0', border: '#CBD5E1' },
  '902': { name: 'CZ CLARO', hex: '#CBD5E1', border: '#94A3B8' },
  '904': { name: 'CZ MESCLA MEDIO', hex: '#94A3B8', border: '#64748B' },
  '905': { name: 'CZ MEDIO', hex: '#64748B', border: '#475569' },
  '907': { name: 'CZ OLD PRATA VELHO', hex: '#71717A', border: '#52525B' },
  '908': { name: 'CZ INTENSO MESCLA ESCURO', hex: '#475569', border: '#334155' },
  '909': { name: 'CZ DARK', hex: '#1E293B', border: '#0F172A' }
};

export function isReservedCol35Street(rua: string): boolean {
  return RESERVED_COL35_STREETS.includes(rua);
}

export function isAccessoriesStreet(rua: string): boolean {
  return ACCESSORIES_STREETS.includes(rua);
}

export function isPulmaoStreet(rua: string): boolean {
  return PULMAO_STREETS.includes(rua);
}

export function getMaxPosForStreet(rua: string): number {
  return STREET_META[rua]?.maxPos || 160;
}

export function isValidPositionInStreet(rua: string, pos: number): boolean {
  const meta = STREET_META[rua];
  if (!meta) return pos >= 1 && pos <= 160;
  if (pos < 1 || pos > meta.maxPos) return false;
  if (meta.evenOnly && pos % 2 !== 0) return false;
  if (meta.oddOnly && pos % 2 === 0) return false;
  if (meta.missingPositions && meta.missingPositions.includes(pos)) return false;
  if (rua === 'RD' && pos % 2 === 0 && pos > (meta.maxEvenPos || 112)) return false;
  if (rua === 'RH' && pos % 2 === 0 && pos > (meta.evenHighMaxPos || 168)) return false;
  return true;
}

export function getMaxLevelsForStreet(rua: string, pos?: number): number {
  const meta = STREET_META[rua];
  if (!meta) return 6;
  if (rua === 'RD' && typeof pos === 'number' && !isNaN(pos)) {
    return pos % 2 === 0 ? (meta.evenLevels || 7) : (meta.oddLevels || 6);
  }
  if (rua === 'RH' && typeof pos === 'number' && !isNaN(pos)) {
    if (pos % 2 === 0) {
      return pos <= (meta.evenLowMaxPos || 80) ? (meta.evenLowLevels || 6) : (meta.evenHighLevels || 5);
    }
    return meta.oddLevels || 5;
  }
  return meta.maxLevels;
}

export function getValidPositionsForStreet(rua: string): number[] {
  const maxPos = getMaxPosForStreet(rua);
  const positions: number[] = [];
  for (let p = 1; p <= maxPos; p++) {
    if (isValidPositionInStreet(rua, p)) positions.push(p);
  }
  return positions;
}

export function getTotalSlotsForStreet(rua: string): number {
  const positions = getValidPositionsForStreet(rua);
  let total = 0;
  for (const p of positions) {
    total += getMaxLevelsForStreet(rua, p);
  }
  return total;
}

export function getStreetPositionRuleDescription(rua: string): string {
  if (rua === 'AA') return 'A Rua AA (Acessórios) possui apenas posições PARES de 2 a 70 (7 níveis).';
  if (rua === 'PA') return 'A Rua PA (Pulmão) possui apenas posições ÍMPARES de 1 a 39 (5 níveis).';
  if (rua === 'RG') return 'A Rua RG não possui a posição 079 (salta de 077/078 para 080/081).';
  if (rua === 'RH') return 'A Rua RH não possui a posição 079 e o lado PAR vai apenas até 168 (não existem 170, 172, 174).';
  if (rua === 'RD') return 'Na Rua RD, o lado PAR vai até 112 (7N) e o lado ÍMPAR vai até 159 (6N).';
  const meta = STREET_META[rua];
  return meta ? meta.desc : `Posições válidas de 1 a ${getMaxPosForStreet(rua)}.`;
}

export function formatWmsAddress(rua: string, pos: number, nivel: number): string {
  const p = String(Math.max(1, Math.min(175, parseInt(String(pos), 10) || 1))).padStart(3, '0');
  const maxLv = getMaxLevelsForStreet(rua, parseInt(String(pos), 10) || 1);
  const n = Math.max(1, Math.min(maxLv, parseInt(String(nivel), 10) || 1));
  return `${rua}.${p}.${n}`;
}

export function parseAddressString(rawStr: string | null | undefined): ParsedWmsAddress | null {
  if (!rawStr) return null;
  const s = String(rawStr).trim().toUpperCase();

  let m = s.match(/^([RAP][A-I]|A[A-F])[\.\-\s](\d{1,3})[\.\-\s]N?(\d)$/i);
  if (!m) {
    m = s.match(/([RAP][A-I]|A[A-F])\D+(\d{1,3})\D+(\d)/i);
  }
  if (!m) return null;

  const rua = m[1].toUpperCase();
  if (!(STREETS as readonly string[]).includes(rua)) return null;

  const maxPos = getMaxPosForStreet(rua);
  let pos = Math.max(1, Math.min(maxPos, parseInt(m[2], 10)));
  if (!isValidPositionInStreet(rua, pos)) {
    if (rua === 'AA') pos = Math.min(70, Math.max(2, pos % 2 !== 0 ? pos + 1 : pos));
    else if (rua === 'PA') pos = Math.min(39, Math.max(1, pos % 2 === 0 ? pos - 1 : pos));
    else if ((rua === 'RG' || rua === 'RH') && pos === 79) pos = 81;
    else if (rua === 'RH' && pos % 2 === 0 && pos > 168) pos = 168;
    else if (rua === 'RD' && pos % 2 === 0 && pos > 112) pos = 112;
  }
  const maxLv = getMaxLevelsForStreet(rua, pos);
  const nivel = Math.max(1, Math.min(maxLv, parseInt(m[3], 10)));
  return { rua, pos, nivel, wms: formatWmsAddress(rua, pos, nivel) };
}

export function expandSisplanLocal(rawStr: string | null | undefined): ParsedWmsAddress[] {
  if (!rawStr) return [];
  const s = String(rawStr).trim().toUpperCase();

  const m = s.match(/^([RAP][A-I]|A[A-F])\.(\d{1,3})\.(.+)$/i);
  if (!m) {
    const single = parseAddressString(s);
    return single ? [single] : [];
  }

  const rua = m[1].toUpperCase();
  if (!(STREETS as readonly string[]).includes(rua)) return [];

  const maxPos = getMaxPosForStreet(rua);
  const rawPos = parseInt(m[2], 10);
  if (isNaN(rawPos) || rawPos < 1) return [];
  let pos = Math.min(maxPos, rawPos);
  if (!isValidPositionInStreet(rua, pos)) {
    if (rua === 'AA') pos = Math.min(70, Math.max(2, pos % 2 !== 0 ? pos + 1 : pos));
    else if (rua === 'PA') pos = Math.min(39, Math.max(1, pos % 2 === 0 ? pos - 1 : pos));
    else if ((rua === 'RG' || rua === 'RH') && pos === 79) pos = 81;
    else if (rua === 'RH' && pos % 2 === 0 && pos > 168) pos = 168;
    else if (rua === 'RD' && pos % 2 === 0 && pos > 112) pos = 112;
  }
  const maxLv = getMaxLevelsForStreet(rua, pos);
  const levelSpec = m[3].trim();

  const levels = new Set<number>();

  const rangeMatch = levelSpec.match(/^(\d)\s*-\s*(\d)$/);
  if (rangeMatch) {
    const start = Math.max(1, Math.min(maxLv, parseInt(rangeMatch[1], 10)));
    const end = Math.max(1, Math.min(maxLv, parseInt(rangeMatch[2], 10)));
    for (let lv = Math.min(start, end); lv <= Math.max(start, end); lv++) {
      levels.add(lv);
    }
  } else if (levelSpec.includes('|') || levelSpec.includes('/') || levelSpec.includes(',')) {
    const parts = levelSpec.split(/[\|\/,]/);
    for (const p of parts) {
      const rm = p.trim().match(/^(\d)\s*-\s*(\d)$/);
      if (rm) {
        const st = Math.max(1, Math.min(maxLv, parseInt(rm[1], 10)));
        const en = Math.max(1, Math.min(maxLv, parseInt(rm[2], 10)));
        for (let lv = Math.min(st, en); lv <= Math.max(st, en); lv++) levels.add(lv);
      } else {
        const n = parseInt(p.trim(), 10);
        if (!isNaN(n) && n >= 1 && n <= maxLv) levels.add(n);
      }
    }
  } else {
    const n = parseInt(levelSpec.replace(/\D/g, ''), 10);
    if (!isNaN(n) && n >= 1 && n <= maxLv) levels.add(n);
  }

  return Array.from(levels)
    .sort((a, b) => a - b)
    .map(nivel => ({
      rua,
      pos,
      nivel,
      wms: formatWmsAddress(rua, pos, nivel)
    }));
}

export function formatLevelsToSisplanLocal(rua: string, pos: number, levelsArray: number[]): string {
  const p = String(pos).padStart(3, '0');
  const sorted = Array.from(new Set(levelsArray)).sort((a, b) => a - b);
  if (sorted.length === 0) return `${rua}.${p}.1`;
  if (sorted.length === 1) return `${rua}.${p}.${sorted[0]}`;

  let isContiguous = true;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] !== sorted[i - 1] + 1) {
      isContiguous = false;
      break;
    }
  }
  if (isContiguous) {
    return `${rua}.${p}.${sorted[0]} - ${sorted[sorted.length - 1]}`;
  }
  return `${rua}.${p}.${sorted.join('|')}`;
}

export function pickBestLevelsInColumn(freeLevels: number[], count: number): number[] {
  const sorted = [...freeLevels].sort((a, b) => a - b);
  if (sorted.length < count) return [];
  if (count === 1) return [sorted[0]];
  for (let i = 0; i <= sorted.length - count; i++) {
    if (sorted[i + count - 1] - sorted[i] === count - 1) {
      return sorted.slice(i, i + count);
    }
  }
  return sorted.slice(0, count);
}

export function getCanonicalSkuKey(codeStr: string | null | undefined): string {
  const raw = String(codeStr || '').trim().toUpperCase();
  if (!raw) return '';
  const parts = raw.split(/\s*-\s*|\s*;\s*/).filter(Boolean);
  if (parts.length >= 3) {
    const cod = parts[0].replace(/\D/g, '') || parts[0];
    const cor = (parts[1].replace(/\D/g, '') || parts[1]).padStart(3, '0');
    const tam = parts[2].trim();
    return `${cod}|${cor}|${tam}`;
  }
  return raw.replace(/\s+/g, '');
}

export function formatCanonicalSkuDisplay(rawSkuStr: string | null | undefined): string {
  const raw = String(rawSkuStr || '').trim().toUpperCase();
  if (!raw) return '';
  const parts = raw.split(/\s*-\s*|\s*;\s*|\s+/).filter(Boolean);
  if (parts.length >= 3 && /^\d{6,9}$/.test(parts[0])) {
    const cod = parts[0];
    const cor = parts[1].replace(/\D/g, '').padStart(3, '0');
    const tam = parts.slice(2).join(' ');
    return `${cod} - ${cor} - ${tam}`;
  }
  return raw;
}

export function normalizeSearchText(str: string | null | undefined): string {
  return String(str || '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export interface ParsedFullSku {
  baseDigits: string;
  hasBrand: boolean;
  hasLabel: boolean;
  hasGroup: boolean;
  hasSeq: boolean;
  hasColor: boolean;
  hasSize: boolean;
  dMarca: string;
  dEtiqueta: string;
  dGrupo: string;
  seqRaw: string;
  modelSeq: string;
  colorCode: string;
  size: string;
  isComplete: boolean;
}

export function parseFullSkuString(rawCode: string): ParsedFullSku {
  const str = String(rawCode || '').trim().toUpperCase();
  if (!str) {
    return {
      baseDigits: '',
      hasBrand: false,
      hasLabel: false,
      hasGroup: false,
      hasSeq: false,
      hasColor: false,
      hasSize: false,
      dMarca: '1',
      dEtiqueta: '1',
      dGrupo: '06',
      seqRaw: '',
      modelSeq: '0001',
      colorCode: '101',
      size: 'U',
      isComplete: false
    };
  }

  // Split by '-' or ';' or whitespace
  const parts = str.split(/\s*[-;]\s*|\s+/).filter(Boolean);
  let baseToken = parts[0] || '';
  let colorToken = parts[1] || '';
  let sizeToken = parts.slice(2).join('').trim();

  // Support compact glued input like "11060127102M" or "11060127102GG"
  if (parts.length === 1) {
    const compactMatch = baseToken.match(/^(\d{8})(\d{3})([A-Z0-9]+)?$/);
    if (compactMatch) {
      baseToken = compactMatch[1];
      colorToken = compactMatch[2];
      sizeToken = compactMatch[3] || '';
    }
  }

  const baseDigits = baseToken.replace(/\D/g, '');
  const hasBrand = baseDigits.length >= 1;
  const hasLabel = baseDigits.length >= 2;
  const hasGroup = baseDigits.length >= 4;
  const hasSeq = baseDigits.length >= 5;

  const dMarca = baseDigits.charAt(0) || '1';
  const dEtiqueta = baseDigits.charAt(1) || '1';
  const dGrupoRaw = baseDigits.substring(2, 4) || '06';
  const dGrupo = dGrupoRaw.padStart(2, '0');
  const seqRaw = baseDigits.substring(4, 8);
  const modelSeq = (seqRaw || '0001').padStart(4, '0');

  const colorDigits = colorToken.replace(/\D/g, '');
  const hasColor = colorDigits.length > 0;
  const colorCode = hasColor ? colorDigits.padStart(3, '0') : '';

  const cleanSize = sizeToken.trim().toUpperCase();
  const hasSize = cleanSize.length > 0;

  return {
    baseDigits,
    hasBrand,
    hasLabel,
    hasGroup,
    hasSeq,
    hasColor,
    hasSize,
    dMarca,
    dEtiqueta,
    dGrupo,
    seqRaw,
    modelSeq,
    colorCode,
    size: cleanSize,
    isComplete: baseDigits.length >= 8 && hasColor && hasSize
  };
}

export function decodeSkuPrefix(rawCode: string, explicitColor = '', explicitSize = '') {
  const parsed = parseFullSkuString(rawCode);

  const dMarca = parsed.dMarca;
  const dEtiqueta = parsed.dEtiqueta;
  const dGrupo = parsed.dGrupo;
  const modelSeq = parsed.modelSeq;

  const marca = AERO_BRANDS[dMarca] || `Marca ${dMarca}`;
  const etiqueta = AERO_LABELS[dEtiqueta] || `Etiqueta ${dEtiqueta}`;
  const groupObj =
    AERO_GROUPS[dGrupo] ||
    AERO_GROUPS[String(parseInt(dGrupo, 10))] ||
    { name: `Grupo ${dGrupo}`, icon: '📦' };

  // Prefer parsed color/size embedded inside rawCode; only fall back to explicitColor/explicitSize when missing
  const resolvedColor = parsed.hasColor
    ? parsed.colorCode
    : String(explicitColor || '101').trim().replace(/\D/g, '').padStart(3, '0') || '101';
  const resolvedSize = parsed.hasSize
    ? parsed.size
    : String(explicitSize || 'U').trim().toUpperCase() || 'U';

  const colorObj = OFFICIAL_COLORS[resolvedColor] || {
    name: `Cor ${resolvedColor}`,
    hex: '#64748B',
    border: '#475569'
  };

  return {
    dMarca,
    dEtiqueta,
    dGrupo,
    modelSeq,
    marca,
    etiqueta,
    grupo: groupObj.name,
    icon: groupObj.icon,
    colorCode: resolvedColor,
    colorName: colorObj.name,
    colorHex: colorObj.hex,
    colorBorder: colorObj.border,
    size: resolvedSize,
    autoName: `${groupObj.name} ${marca} ${etiqueta} • Ref. ${modelSeq} • ${colorObj.name} (${resolvedSize})`
  };
}

export interface HeatmapColorInfo {
  pct: number;
  label: string;
  badgeEmoji: string;
  badgeClass: string;
  borderClass: string;
  bgGradient: string;
  cardBgStyle: React.CSSProperties;
  mapBgStyle: React.CSSProperties;
  barGradient: string;
  textClass: string;
  isCritical: boolean;
}

/**
 * Mapeia a taxa de ocupação percentual (0 a 100%) para intensidade térmica e estilo visual.
 * Permite identificar áreas críticas de estoque (>85%) e ruas com capacidade disponível.
 */
export function getHeatmapColorInfo(pct: number): HeatmapColorInfo {
  const p = Math.max(0, Math.min(100, Math.round(pct)));

  // Opacidade proporcional à taxa de ocupação (mais cheia = cor mais intensa e viva)
  const alphaLow = (0.10 + (p / 100) * 0.32).toFixed(2);
  const alphaHigh = (0.20 + (p / 100) * 0.42).toFixed(2);

  if (p >= 88) {
    // Crítica / Saturada (Vermelho Carmesim / Ruby)
    return {
      pct: p,
      label: 'Crítica (Saturada)',
      badgeEmoji: '🚨',
      badgeClass: 'bg-rose-500/25 text-rose-700 dark:text-rose-200 border-rose-500/50',
      borderClass: 'border-rose-500/70 shadow-[0_0_15px_rgba(244,63,94,0.35)]',
      bgGradient: 'bg-gradient-to-br from-rose-500/35 via-rose-600/25 to-red-600/35',
      cardBgStyle: {
        background: `linear-gradient(135deg, rgba(239, 68, 68, ${alphaHigh}) 0%, rgba(185, 28, 28, ${alphaLow}) 100%)`
      },
      mapBgStyle: {
        background: `radial-gradient(ellipse at top, rgba(239, 68, 68, 0.22) 0%, rgba(185, 28, 28, 0.10) 50%, transparent 85%)`
      },
      barGradient: 'bg-gradient-to-r from-orange-500 to-rose-600',
      textClass: 'text-rose-600 dark:text-rose-400 font-black',
      isCritical: true
    };
  }

  if (p >= 70) {
    // Alta Ocupação (Laranja / Coral)
    return {
      pct: p,
      label: 'Alta Ocupação',
      badgeEmoji: '🔥',
      badgeClass: 'bg-orange-500/25 text-orange-700 dark:text-orange-200 border-orange-500/50',
      borderClass: 'border-orange-500/60 shadow-[0_0_12px_rgba(249,115,22,0.25)]',
      bgGradient: 'bg-gradient-to-br from-orange-500/30 via-orange-600/20 to-amber-600/30',
      cardBgStyle: {
        background: `linear-gradient(135deg, rgba(249, 115, 22, ${alphaHigh}) 0%, rgba(217, 119, 6, ${alphaLow}) 100%)`
      },
      mapBgStyle: {
        background: `radial-gradient(ellipse at top, rgba(249, 115, 22, 0.16) 0%, rgba(217, 119, 6, 0.08) 50%, transparent 85%)`
      },
      barGradient: 'bg-gradient-to-r from-amber-500 to-orange-500',
      textClass: 'text-orange-600 dark:text-orange-400 font-bold',
      isCritical: false
    };
  }

  if (p >= 45) {
    // Média / Balanceada (Amarelo / Âmbar)
    return {
      pct: p,
      label: 'Média / Balanceada',
      badgeEmoji: '🟡',
      badgeClass: 'bg-amber-500/20 text-amber-700 dark:text-amber-200 border-amber-500/40',
      borderClass: 'border-amber-500/45',
      bgGradient: 'bg-gradient-to-br from-amber-500/25 via-amber-600/15 to-yellow-600/20',
      cardBgStyle: {
        background: `linear-gradient(135deg, rgba(245, 158, 11, ${alphaHigh}) 0%, rgba(202, 138, 4, ${alphaLow}) 100%)`
      },
      mapBgStyle: {
        background: `radial-gradient(ellipse at top, rgba(245, 158, 11, 0.12) 0%, rgba(202, 138, 4, 0.06) 50%, transparent 85%)`
      },
      barGradient: 'bg-gradient-to-r from-yellow-400 to-amber-500',
      textClass: 'text-amber-600 dark:text-amber-400 font-bold',
      isCritical: false
    };
  }

  if (p >= 20) {
    // Baixa / Disponível (Verde Esmeralda)
    return {
      pct: p,
      label: 'Baixa / Disponível',
      badgeEmoji: '🟢',
      badgeClass: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-200 border-emerald-500/40',
      borderClass: 'border-emerald-500/35',
      bgGradient: 'bg-gradient-to-br from-emerald-500/20 via-teal-600/15 to-cyan-600/20',
      cardBgStyle: {
        background: `linear-gradient(135deg, rgba(16, 185, 129, ${alphaHigh}) 0%, rgba(5, 150, 105, ${alphaLow}) 100%)`
      },
      mapBgStyle: {
        background: `radial-gradient(ellipse at top, rgba(16, 185, 129, 0.10) 0%, rgba(5, 150, 105, 0.05) 50%, transparent 85%)`
      },
      barGradient: 'bg-gradient-to-r from-teal-400 to-emerald-500',
      textClass: 'text-emerald-600 dark:text-emerald-400 font-bold',
      isCritical: false
    };
  }

  // Muito Baixa / Livre (<20% - Azul Glacial)
  return {
    pct: p,
    label: 'Muito Baixa (Livre)',
    badgeEmoji: '❄️',
    badgeClass: 'bg-blue-500/15 text-blue-700 dark:text-blue-200 border-blue-500/30',
    borderClass: 'border-blue-500/30',
    bgGradient: 'bg-gradient-to-br from-blue-500/15 via-cyan-600/10 to-indigo-600/15',
    cardBgStyle: {
      background: `linear-gradient(135deg, rgba(59, 130, 246, ${alphaHigh}) 0%, rgba(37, 99, 235, ${alphaLow}) 100%)`
    },
    mapBgStyle: {
      background: `radial-gradient(ellipse at top, rgba(59, 130, 246, 0.08) 0%, rgba(37, 99, 235, 0.04) 50%, transparent 85%)`
    },
    barGradient: 'bg-gradient-to-r from-blue-400 to-indigo-500',
    textClass: 'text-blue-600 dark:text-blue-400 font-bold',
    isCritical: false
  };
}
