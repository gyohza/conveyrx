import { MATERIALS } from '../sim/content/materials';
import type { MaterialId } from '../sim/content/materials';
import { RECIPES } from '../sim/content/recipes';
import type { MachineEntity, SinkEntity, SourceEntity } from '../sim/core/entities';
import { traceSourceChain } from '../sim/core/routing';
import type { SimState } from '../sim/core/state';

const MATERIAL_EMOJI: Record<MaterialId, string> = {
  carbon: '⚫',
  diamond: '💎',
  slag: '🟤',
  ice: '🧊',
};

const LINE_WIDTH = 40;

function wrapArray(items: string[]): string {
  const oneLine = `[${items.join(', ')}]`;
  if (oneLine.length <= LINE_WIDTH) return oneLine;
  const inner = items.map((item) => `  ${item},`).join('\n');
  return `[\n${inner}\n]`;
}

function operatorFor(machine: MachineEntity): string {
  if (machine.kind === 'map') {
    const recipe = RECIPES[machine.config.recipeId];
    const fromLabel = MATERIALS[recipe.from].label.toLowerCase();
    const toLabel = MATERIALS[recipe.to].label;
    return `map(${fromLabel} => new ${toLabel}(${fromLabel}))`;
  }
  if (machine.kind === 'filter') {
    const allowLabels = machine.config.allow.map((material) => MATERIALS[material].label);
    if (allowLabels.length === 1) return `filter(value => value instanceof ${allowLabels[0]})`;
    return `filter(value => [${allowLabels.join(', ')}].some(T => value instanceof T))`;
  }
  return `take(${machine.config.count})`;
}

function sinkConsumer(sink: SinkEntity): string {
  return sink.sinkType === 'cash' ? 'lunarBase.sell(value)' : 'research(value)';
}

function sourceVarBase(sequence: MaterialId[]): string {
  const distinct = new Set(sequence);
  return distinct.size === 1 ? MATERIALS[sequence[0]].label.toLowerCase() : 'ore';
}

function sourceSuffix(state: SimState, source: SourceEntity): string {
  const sources = Object.values(state.sources);
  const index = sources.findIndex((s) => s.id === source.id);
  return sources.length > 1 ? `${index + 1}` : '';
}

/** Stable `X$` variable name for a source, numbered only when more than one source exists. */
export function sourceVarName(state: SimState, source: SourceEntity): string {
  return `${sourceVarBase(source.sequence)}${sourceSuffix(state, source)}$`;
}

/** `sub`, numbered only when more than one source exists — paired 1:1 with {@link sourceVarName}. */
export function subVarName(state: SimState, source: SourceEntity): string {
  return `sub${sourceSuffix(state, source)}`;
}

/**
 * The always-current shape of a source's stream — its emitted items and any operators between it
 * and wherever the chain currently ends — with no `.subscribe()`. Pure function of topology, so
 * it's safe to regenerate on every layout edit without touching the separate activity log.
 */
export function declareSource(state: SimState, source: SourceEntity, varName: string): string {
  const items = source.sequence.map((material) => MATERIAL_EMOJI[material]);
  const from = `from(${wrapArray(items)})`;
  const { machines } = traceSourceChain(state, source);
  if (machines.length === 0) return `const ${varName} = ${from};`;

  const ops = machines.map((machine) => `    ${operatorFor(machine)}`).join(',\n');
  return `const ${varName} = ${from}.pipe(\n${ops}\n);`;
}

export function subscribeStatement(
  state: SimState,
  source: SourceEntity,
  varName: string,
  subName: string,
  first: boolean,
): string {
  const { sink } = traceSourceChain(state, source);
  const arg = sink ? `value => ${sinkConsumer(sink)}` : '';
  const keyword = first ? 'let ' : '';
  return `${keyword}${subName} = ${varName}.subscribe(${arg});`;
}

export function unsubscribeStatement(subName: string): string {
  return `${subName}.unsubscribe();`;
}

export function declareAllSources(state: SimState): string {
  const sources = Object.values(state.sources);
  if (sources.length === 0) return '// build a `from` source onto a mine to get started';
  return sources
    .map((source) => declareSource(state, source, sourceVarName(state, source)))
    .join('\n\n');
}
