// 曲の頼み（docs/design.md#sound）。どの曲を流し、山場の強さをどうするかを、頼みの並びから決める。DOM と Web Audio には触れない。
// 画面の上に画面を重ねると、上の画面の曲を流し、上の画面が閉じたら下の画面の曲に戻す。
// 頼みは優先度（priority。上に重ねる画面ほど高くする）を持ち、いちばん高い優先度の、いちばん新しい頼みの曲を流す。山場の強さも頼みごとに持つので、
// 上に重ねた頼みが外れて戻ると、下の頼みの強さで鳴る。
// want・cue・release で動かす「じかの頼み」は、優先度0に1つだけ置く。cue で待たせた曲も、じかの頼みに持つ。

/** 山場の強さ。1 なら山場の層が鳴り、山場の速さの曲は速くなる。 */
export type Intensity = 0 | 1;

/** 曲の頼み。track が null の頼みは、上にある間は止める。 */
export type TrackRequest<Track> =
  | {
      /** want・cue・release で動かす頼み。優先度は0 */
      readonly kind: 'direct';
      readonly id: number;
      readonly track: Track | null;
      readonly intensity: Intensity;
      /** cue で待たせた曲。今の曲のループの終わりで替える */
      readonly next: Track | null;
    }
  | {
      /** request で足した、画面ごとの頼み */
      readonly kind: 'screen';
      readonly id: number;
      readonly track: Track | null;
      readonly priority: number;
      readonly intensity: Intensity;
    };

const priorityOf = <Track>(r: TrackRequest<Track>): number => (r.kind === 'direct' ? 0 : r.priority);

/** 流す頼み。いちばん高い優先度の、いちばん新しい（id の大きい）頼み。頼みが無ければ null。 */
export const topRequest = <Track>(requests: readonly TrackRequest<Track>[]): TrackRequest<Track> | null =>
  requests.reduce<TrackRequest<Track> | null>((top, r) => {
    if (top === null) return r;
    const [a, b] = [priorityOf(r), priorityOf(top)];
    return a > b || (a === b && r.id > top.id) ? r : top;
  }, null);

const directOf = <Track>(requests: readonly TrackRequest<Track>[]): Extract<TrackRequest<Track>, { kind: 'direct' }> | undefined =>
  requests.find((r) => r.kind === 'direct');

/**
 * want。じかの頼みを、新しい id で track にする（優先度0の中でいちばん新しくなる）。待たせた曲は捨てる。
 * 同じ曲なら山場の強さを残し、違う曲なら0に戻す。
 */
export const wanted = <Track>(
  requests: readonly TrackRequest<Track>[],
  id: number,
  track: Track | null,
): readonly TrackRequest<Track>[] => {
  const old = directOf(requests);
  const intensity = old && old.track === track ? old.intensity : 0;
  return [...requests.filter((r) => r.kind !== 'direct'), { kind: 'direct', id, track, intensity, next: null }];
};

/** release。じかの頼みが track なら外す。違う曲なら何もしない。 */
export const released = <Track>(requests: readonly TrackRequest<Track>[], track: Track | null): readonly TrackRequest<Track>[] => {
  const old = directOf(requests);
  return old && old.track === track ? requests.filter((r) => r !== old) : requests;
};

/**
 * cue。じかの頼みが上にあり、その曲を流している（playing）なら、ループの終わりに替える曲として待たせる（今の曲と同じなら待たせない）。
 * そうでなければ want と同じ（上に重ねた頼みがあれば、それが外れたときに流す）。
 */
export const cued = <Track>(
  requests: readonly TrackRequest<Track>[],
  id: number,
  track: Track,
  playing: Track | null,
): readonly TrackRequest<Track>[] => {
  const top = topRequest(requests);
  if (top?.kind !== 'direct' || top.track === null || top.track !== playing) return wanted(requests, id, track);
  const next = track === top.track ? null : track;
  return requests.map((r) => (r === top ? { ...top, next } : r));
};

/** ループの頭で替える曲。上の頼みがじかの頼みで、playing を流していて、待たせた曲があるときだけ。 */
export const cueOf = <Track>(requests: readonly TrackRequest<Track>[], playing: Track): Track | null => {
  const top = topRequest(requests);
  return top?.kind === 'direct' && top.track === playing ? top.next : null;
};

/** ループの頭で替えた後。じかの頼みを track にし、山場の強さを0に戻す。 */
export const handedOver = <Track>(requests: readonly TrackRequest<Track>[], track: Track): readonly TrackRequest<Track>[] =>
  requests.map((r) => (r.kind === 'direct' ? { ...r, track, intensity: 0, next: null } : r));

/** request。画面ごとの頼みを足す。 */
export const requested = <Track>(
  requests: readonly TrackRequest<Track>[],
  id: number,
  track: Track | null,
  priority: number,
  intensity: Intensity,
): readonly TrackRequest<Track>[] => [...requests, { kind: 'screen', id, track, priority, intensity }];

/** 頼みを外す。 */
export const withdrawn = <Track>(requests: readonly TrackRequest<Track>[], id: number): readonly TrackRequest<Track>[] =>
  requests.filter((r) => r.id !== id);

/** 頼み id の山場の強さを変える。上に無い頼みでも、強さは残り、上に戻ったときに効く。 */
export const withIntensity = <Track>(
  requests: readonly TrackRequest<Track>[],
  id: number,
  level: Intensity,
): readonly TrackRequest<Track>[] => requests.map((r) => (r.id === id ? { ...r, intensity: level } : r));
