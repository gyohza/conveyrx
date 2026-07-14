/** interval is intentionally absent: it never completes on its own, so it's introduced later, after the subscription/leak lesson from of/from is established. */
export type SourceKind = 'of' | 'from';

export interface SourceKindDef {
  kind: SourceKind;
  label: string;
  upgradeCost: number;
  sequenceLength: number;
  rateTicks: number;
  description: string;
  expandedDescription: string;
  docsUrl: string;
}

export const SOURCE_KINDS: Record<SourceKind, SourceKindDef> = {
  of: {
    kind: 'of',
    label: 'of',
    upgradeCost: 0,
    sequenceLength: 3,
    rateTicks: 20,
    description: 'starts a stream from fixed items',
    expandedDescription:
      'Emits the exact items it was given, in order, then completes. Nothing is emitted until you subscribe.',
    docsUrl: 'https://rxjs.dev/api/index/function/of',
  },
  from: {
    kind: 'from',
    label: 'from',
    upgradeCost: 10,
    sequenceLength: 6,
    rateTicks: 20,
    description: 'starts a stream from an iterable',
    expandedDescription:
      'A source operator — RxJS calls this category "source" operators. Emits each item of the mine\'s yield in order, then completes. Nothing is extracted until you subscribe, and a forgotten subscription keeps draining upkeep even once it\'s done producing.',
    docsUrl: 'https://rxjs.dev/api/index/function/from',
  },
};
