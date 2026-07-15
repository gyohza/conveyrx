import type {
  ConveyorEntity,
  FilterConfig,
  MachineEntity,
  MachineKind,
  MapConfig,
  SinkEntity,
  SinkType,
  SourceEntity,
} from '../core/entities';
import { computeEvalOrder } from '../core/eval-order';
import { createPort } from '../core/port';
import type { SimState } from '../core/state';
import type { Direction, GridPos } from '../core/types';
import type { Packet } from '../core/packet';
import type { MaterialId } from '../content/materials';
import type { RecipeId } from '../content/recipes';
import { SOURCE_KINDS } from '../content/source-kinds';
import type { SourceKind } from '../content/source-kinds';

export function emptyState(width = 8, height = 4, cash = 100): SimState {
  return {
    tick: 0,
    nextPacketId: 1,
    nextEntityId: 1,
    grid: { width, height },
    machines: {},
    conveyors: {},
    sources: {},
    sinks: {},
    packets: {},
    mines: [],
    economy: { cash, research: 0, peakCash: cash, saleCount: 0 },
    evalOrder: [],
    base: { min: { x: 0, y: 0 }, max: { x: 0, y: 0 } },
  };
}

export function addSource(
  state: SimState,
  pos: GridPos,
  opts?: {
    kind?: SourceKind;
    sequence?: MaterialId[];
    subscribed?: boolean;
    outputCapacity?: number;
  },
): SourceEntity {
  const kind = opts?.kind ?? 'of';
  const source: SourceEntity = {
    id: state.nextEntityId++,
    position: pos,
    kind,
    sequence:
      opts?.sequence ?? Array.from({ length: SOURCE_KINDS[kind].sequenceLength }, () => 'carbon'),
    subscribed: opts?.subscribed ?? true,
    cursor: 0,
    ticksSinceLastSpawn: 0,
    output: createPort(opts?.outputCapacity ?? 1),
  };
  state.sources[source.id] = source;
  return source;
}

export function addSink(
  state: SimState,
  pos: GridPos,
  opts?: { sinkType?: SinkType; capacity?: number },
): SinkEntity {
  const sink: SinkEntity = {
    id: state.nextEntityId++,
    position: pos,
    sinkType: opts?.sinkType ?? 'cash',
    input: createPort(opts?.capacity ?? 4),
  };
  state.sinks[sink.id] = sink;
  return sink;
}

export function addConveyor(state: SimState, pos: GridPos, direction: Direction): ConveyorEntity {
  const conveyor: ConveyorEntity = {
    id: state.nextEntityId++,
    position: pos,
    direction,
    slot: null,
  };
  state.conveyors[conveyor.id] = conveyor;
  return conveyor;
}

export function addMachine(
  state: SimState,
  kind: MachineKind,
  pos: GridPos,
  config?: RecipeId | MaterialId[] | number,
): MachineEntity {
  const id = state.nextEntityId++;
  const base = { id, position: pos, inputs: [createPort(1)], outputs: [createPort(1)] };
  let machine: MachineEntity;
  if (kind === 'map') {
    machine = {
      ...base,
      internal: undefined,
      kind,
      config: { recipeId: (config as RecipeId) ?? 'crystallize' } as MapConfig,
    };
  } else if (kind === 'filter') {
    machine = {
      ...base,
      internal: undefined,
      kind,
      config: { allow: (config as MaterialId[]) ?? ['carbon'] } as FilterConfig,
    };
  } else {
    machine = {
      ...base,
      kind,
      config: { count: (config as number) ?? 1 },
      internal: { passed: 0, sourceWasSubscribed: false },
    };
  }
  state.machines[machine.id] = machine;
  return machine;
}

export function addPacket(state: SimState, material: MaterialId = 'carbon'): Packet {
  const packet: Packet = { id: state.nextPacketId++, material, bornTick: 0 };
  state.packets[packet.id] = packet;
  return packet;
}

export function refreshEvalOrder(state: SimState): void {
  state.evalOrder = computeEvalOrder(state);
}
