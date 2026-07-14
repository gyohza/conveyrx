import type { MachineKind } from '../core/entities';
import { FILTER_COST } from './economy';
import type { MaterialId } from './materials';
import type { RecipeId } from './recipes';

export interface MachineDef {
  kind: MachineKind;
  label: string;
  /** Absent when price instead depends on the instance's own config — see {@link RecipeDef.cost} for map, {@link takeCost} for take. */
  cost?: number;
  description: string;
  expandedDescription: string;
  docsUrl: string;
  availableRecipes?: RecipeId[];
  filterableMaterials?: MaterialId[];
  availableCounts?: number[];
}

export const MACHINE_DEFS: Record<MachineKind, MachineDef> = {
  map: {
    kind: 'map',
    label: 'map',
    description: 'transforms items in a stream',
    expandedDescription:
      "Applies a function to every item as it passes through, producing a new value from each one using the machine's chosen recipe. The source stream is untouched — map always produces a new one.",
    docsUrl: 'https://rxjs.dev/api/index/function/map',
    availableRecipes: ['crystallize'],
  },
  filter: {
    kind: 'filter',
    label: 'filter',
    cost: FILTER_COST,
    description: 'only lets certain items through',
    expandedDescription:
      'Tests every item against a predicate, passing through only the ones that satisfy it. Anything that fails the test is dropped entirely, not delayed or rerouted.',
    docsUrl: 'https://rxjs.dev/api/index/function/filter',
    filterableMaterials: ['carbon', 'diamond', 'ice', 'slag'],
  },
  take: {
    kind: 'take',
    label: 'take',
    description: 'unsubscribes after N items',
    expandedDescription:
      'Takes only the first N items from the stream, then completes and unsubscribes automatically — the subscription cleans itself up, no manual .unsubscribe() needed.',
    docsUrl: 'https://rxjs.dev/api/index/function/take',
    availableCounts: [1, 2, 3, 4, 5, 6, 7, 8, 9],
  },
};
