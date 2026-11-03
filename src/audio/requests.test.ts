import { describe, expect, it } from 'vitest';
import {
  cued,
  cueOf,
  handedOver,
  released,
  requested,
  type TrackRequest,
  topRequest,
  wanted,
  withdrawn,
  withIntensity,
} from './requests.ts';

type R = TrackRequest<string>;
const none: readonly R[] = [];

describe('topRequest', () => {
  it('頼みが無ければ null', () => expect(topRequest(none)).toBeNull());

  it('じかの頼みだけなら、その頼み', () => expect(topRequest(wanted(none, 1, 'a'))?.track).toBe('a'));

  it('優先度の高い頼みを流す。足した順には依らない', () => {
    const over = requested(none, 1, 'over', 1, 0);
    expect(topRequest(wanted(over, 2, 'base'))?.track).toBe('over');
    expect(topRequest(requested(wanted(none, 1, 'base'), 2, 'over', 1, 0))?.track).toBe('over');
  });

  it('同じ優先度なら、新しい頼みを流す', () => {
    const two = requested(requested(none, 1, 'a', 0, 0), 2, 'b', 0, 0);
    expect(topRequest(two)?.track).toBe('b');
  });

  it('曲の無い頼みが上にあれば、止める（track が null）', () => {
    const silent = requested(wanted(none, 1, 'a'), 2, null, 1, 0);
    expect(topRequest(silent)).toMatchObject({ track: null });
  });
});

describe('wanted と released（じかの頼み）', () => {
  it('じかの頼みは1つだけで、want のたびに新しい id になり、優先度0の中でいちばん新しくなる', () => {
    const screen = requested(wanted(none, 1, 'a'), 2, 'b', 0, 0);
    expect(topRequest(screen)?.track).toBe('b');
    const again = wanted(screen, 3, 'a');
    expect(again.filter((r) => r.kind === 'direct')).toHaveLength(1);
    expect(topRequest(again)?.track).toBe('a');
  });

  it('同じ曲なら山場の強さを残し、違う曲なら0に戻す', () => {
    const tense = withIntensity(wanted(none, 1, 'a'), 1, 1);
    expect(topRequest(wanted(tense, 2, 'a'))?.intensity).toBe(1);
    expect(topRequest(wanted(tense, 2, 'b'))?.intensity).toBe(0);
  });

  it('want は、待たせた曲を捨てる', () => {
    const waiting = cued(wanted(none, 1, 'a'), 2, 'b', 'a');
    expect(cueOf(waiting, 'a')).toBe('b');
    expect(cueOf(wanted(waiting, 3, 'a'), 'a')).toBeNull();
  });

  it('release は、じかの頼みが同じ曲なら外し、下の頼みに戻る', () => {
    const base = requested(none, 1, 'base', 0, 0);
    const both = wanted(base, 2, 'a');
    expect(topRequest(released(both, 'a'))?.track).toBe('base');
  });

  it('release は、違う曲なら何もしない', () => {
    const one = wanted(none, 1, 'a');
    expect(released(one, 'b')).toBe(one);
    expect(released(none, 'a')).toBe(none);
  });

  it('want(null) は、じかの頼みで止める', () => {
    expect(topRequest(wanted(wanted(none, 1, 'a'), 2, null))).toMatchObject({ kind: 'direct', track: null });
  });
});

describe('cued と cueOf と handedOver（ループの終わりで替える）', () => {
  it('じかの頼みの曲を流しているときは、ループの終わりに替える曲として待たせる', () => {
    const waiting = cued(wanted(none, 1, 'a'), 2, 'b', 'a');
    expect(topRequest(waiting)?.track).toBe('a');
    expect(cueOf(waiting, 'a')).toBe('b');
  });

  it('今の曲と同じ曲は待たせない', () => {
    expect(cueOf(cued(wanted(none, 1, 'a'), 2, 'a', 'a'), 'a')).toBeNull();
  });

  it('曲を流していなければ、want と同じ（すぐに替える）', () => {
    const now = cued(wanted(none, 1, 'a'), 2, 'b', null);
    expect(topRequest(now)?.track).toBe('b');
    expect(cueOf(now, 'b')).toBeNull();
  });

  it('上に重ねた頼みがあれば、じかの頼みの曲だけを替え、上の頼みの曲はそのまま', () => {
    const over = requested(wanted(none, 1, 'a'), 2, 'over', 1, 0);
    const later = cued(over, 3, 'b', 'over');
    expect(topRequest(later)?.track).toBe('over');
    expect(cueOf(later, 'over')).toBeNull();
    expect(topRequest(withdrawn(later, 2))?.track).toBe('b');
  });

  it('上に重ねた頼みの曲を流している間は、待たせた曲に替えない', () => {
    const waiting = cued(wanted(none, 1, 'a'), 2, 'b', 'a');
    expect(cueOf(requested(waiting, 3, 'over', 1, 0), 'over')).toBeNull();
  });

  it('替えた後は、じかの頼みが新しい曲になり、山場の強さは0に戻る', () => {
    const tense = withIntensity(cued(wanted(none, 1, 'a'), 2, 'b', 'a'), 1, 1);
    const after = handedOver(tense, 'b');
    expect(topRequest(after)).toMatchObject({ kind: 'direct', track: 'b', intensity: 0, next: null });
  });
});

describe('requested と withdrawn と withIntensity（重ねた画面ごとの頼み）', () => {
  it('上の頼みを外すと、下の頼みの曲に戻る', () => {
    const stack = requested(requested(none, 1, 'base', 0, 0), 2, 'over', 2, 0);
    expect(topRequest(withdrawn(stack, 2))?.track).toBe('base');
    expect(topRequest(withdrawn(withdrawn(stack, 2), 1))).toBeNull();
  });

  it('無い id を外しても、頼みは変わらない', () => {
    const one = requested(none, 1, 'a', 0, 0);
    expect(withdrawn(one, 9)).toEqual(one);
  });

  it('足すときに山場の強さを決められる', () => {
    expect(topRequest(requested(none, 1, 'a', 0, 1))?.intensity).toBe(1);
  });

  it('上に無い頼みの強さは残り、上の頼みが外れて戻ったときに効く', () => {
    const base = requested(none, 1, 'base', 0, 0);
    const over = requested(base, 2, 'over', 1, 0);
    const tense = withIntensity(over, 1, 1);
    expect(topRequest(tense)?.intensity).toBe(0);
    expect(topRequest(withdrawn(tense, 2))).toMatchObject({ track: 'base', intensity: 1 });
  });

  it('上の頼みの強さは、そのまま流す曲の強さ', () => {
    expect(topRequest(withIntensity(requested(none, 1, 'a', 0, 0), 1, 1))?.intensity).toBe(1);
  });
});
