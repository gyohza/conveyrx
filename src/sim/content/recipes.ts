import type { MaterialId } from './materials';

export type RecipeId = 'crystallize';

export interface RecipeDef {
  id: RecipeId;
  label: string;
  from: MaterialId;
  to: MaterialId;
  cost: number;
}

export const RECIPES: Record<RecipeId, RecipeDef> = {
  crystallize: { id: 'crystallize', label: 'Crystallize', from: 'carbon', to: 'diamond', cost: 35 },
};
