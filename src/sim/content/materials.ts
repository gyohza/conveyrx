export type MaterialId = 'carbon' | 'diamond' | 'slag' | 'ice';

export interface MaterialDef {
  id: MaterialId;
  label: string;
  shortLabel: string;
  color: number;
  sellPrice: number;
}

export const MATERIALS: Record<MaterialId, MaterialDef> = {
  carbon: { id: 'carbon', label: 'Carbon', shortLabel: 'C', color: 0x9ca3af, sellPrice: 1 },
  diamond: { id: 'diamond', label: 'Diamond', shortLabel: 'D', color: 0x7dd3fc, sellPrice: 10 },
  slag: { id: 'slag', label: 'Slag', shortLabel: 'X', color: 0x57534e, sellPrice: -3 },
  ice: { id: 'ice', label: 'Ice', shortLabel: 'I', color: 0xbae6fd, sellPrice: 4 },
};

export function countMaterials(sequence: MaterialId[]): Map<MaterialId, number> {
  const counts = new Map<MaterialId, number>();
  for (const material of sequence) counts.set(material, (counts.get(material) ?? 0) + 1);
  return counts;
}
