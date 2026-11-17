// 막대 정렬 레이스 · 정렬 규칙 엔진 (화면과 분리한 순수 로직)
// 각 정렬 방법은 "지금 해야 할 올바른 조작(expected)"을 알려 주는 상태 기계예요.
// 학생 조작이 expected와 같으면 진행하고, 다르면 위반(miss)으로 세고 상태는 그대로 둬요.

export const ALGOS = {
  bubble: {
    name: '버블 정렬', short: '버블', icon: '🫧', level: '심화',
    rule: '이웃한 두 막대를 비교해서 앞이 더 크면 자리를 바꿔요. 한 바퀴 돌면 가장 큰 막대가 맨 끝에 고정돼요.',
    like: '키 순서로 줄 설 때 바로 옆 친구와만 키를 비교해 자리를 바꾸는 것과 같아요.',
    how: '노란색 두 막대를 보고 [바꾸기] 또는 [그대로]를 눌러요.',
  },
  selection: {
    name: '선택 정렬', short: '선택', icon: '👆', level: '심화',
    rule: '아직 정리 안 된 막대 중에서 가장 작은 막대를 찾아 맨 앞으로 보내요. 이것을 끝까지 반복해요.',
    like: '줄 서기에서 남은 친구 중 가장 작은 친구를 불러 맨 앞에 세우는 것과 같아요.',
    how: '정리 안 된 구역(흰 배경)에서 가장 작은 막대를 클릭해요.',
  },
  insertion: {
    name: '삽입 정렬', short: '삽입', icon: '🃏', level: '심화',
    rule: '앞쪽은 이미 정리된 구역이에요. 다음 막대를 하나 들어서 정리된 구역의 알맞은 자리에 끼워 넣어요.',
    like: '카드 게임에서 새로 받은 카드를 손에 든 카드 사이 알맞은 곳에 끼우는 것과 같아요.',
    how: '들어 올린 분홍 막대가 들어갈 틈(▼)을 클릭해요.',
  },
  merge: {
    name: '병합 정렬', short: '병합', icon: '🧩', level: '도전',
    rule: '막대를 작은 묶음으로 나눈 뒤, 두 묶음의 맨 앞 막대끼리 비교해 더 작은 것부터 아래 줄로 내려 합쳐요. 묶음이 1 → 2 → 4 → 8개로 커져요.',
    like: '섞인 시험지를 몇 묶음으로 나눠 각각 정리한 뒤 하나로 합치는 것과 같아요. (참고: 비상교육 중학교 정보 105쪽)',
    how: '왼쪽·오른쪽 묶음의 맨 앞(테두리) 막대 중 더 작은 것을 클릭해요.',
  },
};
export const ALGO_KEYS = ['bubble', 'selection', 'insertion', 'merge'];

// 시드 난수(mulberry32): 같은 시드면 모든 모둠이 같은 배열을 받아요.
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function isSorted(a) { for (let i = 1; i < a.length; i++) if (a[i - 1] > a[i]) return false; return true; }

// 5~99 사이 서로 다른 값 n개. 이미 정렬된 배열은 피해요.
export function makeArray(n, seed) {
  const r = rng(seed);
  for (let tries = 0; ; tries++) {
    const pool = [];
    for (let v = 5; v <= 99; v++) pool.push(v);
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    const a = pool.slice(0, n);
    if (n < 2 || !isSorted(a) || tries > 20) return a;
  }
}

/* ---------- 정렬 방법별 상태 기계 ---------- */

class Bubble {
  constructor(a) { this.a = a; this.n = a.length; this.p = 0; this.j = 0; this.sw = false; this.done = this.n < 2; }
  expected() { return { t: 'bubble', swap: this.a[this.j] > this.a[this.j + 1] }; }
  same(x, e) { return x && x.t === 'bubble' && !!x.swap === e.swap; }
  step(x, c, ev) {
    const { a } = this; c.cmp++;
    if (x.swap) { [a[this.j], a[this.j + 1]] = [a[this.j + 1], a[this.j]]; c.moves++; this.sw = true; ev.push('swap'); }
    else ev.push('keep');
    this.j++;
    if (this.j > this.n - 2 - this.p) {
      ev.push('lock');
      const clean = !this.sw;
      this.p++; this.j = 0; this.sw = false;
      if (clean || this.p >= this.n - 1) { this.done = true; this.p = this.n; ev.push(clean ? 'early' : 'end'); }
      else ev.push('pass');
    }
  }
  view() {
    const lockedFrom = this.done ? 0 : this.n - this.p;
    return { kind: 'bubble', pair: this.done ? null : [this.j, this.j + 1], lockedFrom, pass: Math.min(this.p + 1, this.n - 1) };
  }
}

class Selection {
  constructor(a) { this.a = a; this.n = a.length; this.lo = 0; this.done = this.n < 2; }
  argmin() { let m = this.lo; for (let i = this.lo + 1; i < this.n; i++) if (this.a[i] < this.a[m]) m = i; return m; }
  expected() { return { t: 'pick', i: this.argmin() }; }
  same(x, e) { return x && x.t === 'pick' && x.i === e.i; }
  step(x, c, ev) {
    const { a } = this; c.cmp += this.n - 1 - this.lo;
    if (x.i !== this.lo) { [a[x.i], a[this.lo]] = [a[this.lo], a[x.i]]; c.moves++; ev.push('swap'); }
    else ev.push('keep');
    ev.push('lock');
    this.lo++;
    if (this.lo >= this.n - 1) { this.lo = this.n; this.done = true; ev.push('end'); }
  }
  view() { return { kind: 'selection', lo: this.lo, lockedBefore: this.lo }; }
}

class Insertion {
  constructor(a) { this.a = a; this.n = a.length; this.k = 1; this.done = this.n < 2; }
  expected() { const key = this.a[this.k]; let s = 0; for (let i = 0; i < this.k; i++) if (this.a[i] < key) s++; return { t: 'slot', s }; }
  same(x, e) { return x && x.t === 'slot' && x.s === e.s; }
  step(x, c, ev) {
    const { a } = this; const k = this.k, s = x.s;
    c.cmp += (k - s) + (s > 0 ? 1 : 0);
    if (s !== k) { const [v] = a.splice(k, 1); a.splice(s, 0, v); c.moves += k - s; ev.push('insert'); }
    else ev.push('keep');
    this.k++;
    if (this.k >= this.n) { this.done = true; ev.push('end'); }
  }
  view() { return { kind: 'insertion', k: this.done ? this.n : this.k, sortedUpTo: this.done ? this.n : this.k }; }
}

class Merge {
  constructor(a) { this.a = a; this.n = a.length; this.w = 1; this.lo = 0; this.done = this.n < 2; if (!this.done) this.nextPair(); }
  nextPair() {
    for (;;) {
      while (this.lo < this.n) {
        const mid = Math.min(this.lo + this.w, this.n), hi = Math.min(this.lo + 2 * this.w, this.n);
        if (mid < hi) { Object.assign(this, { mid, hi, li: this.lo, ri: mid, out: [] }); return; }
        this.lo = hi;
      }
      this.w *= 2; this.lo = 0;
      if (this.w >= this.n) { this.done = true; return; }
    }
  }
  expected() { return { t: 'take', side: this.a[this.li] <= this.a[this.ri] ? 'L' : 'R' }; }
  same(x, e) { return x && x.t === 'take' && x.side === e.side; }
  step(x, c, ev) {
    const { a } = this; c.cmp++; c.moves++;
    if (x.side === 'L') this.out.push(a[this.li++]); else this.out.push(a[this.ri++]);
    ev.push('take');
    if (this.li >= this.mid || this.ri >= this.hi) {
      while (this.li < this.mid) { this.out.push(a[this.li++]); c.moves++; }
      while (this.ri < this.hi) { this.out.push(a[this.ri++]); c.moves++; }
      for (let i = 0; i < this.out.length; i++) a[this.lo + i] = this.out[i];
      ev.push('merged');
      const w = this.w;
      this.lo = this.hi; this.nextPair();
      if (this.done) ev.push('end'); else if (this.w !== w) ev.push('level');
    }
  }
  view() {
    if (this.done) return { kind: 'merge', w: this.n, done: true };
    return { kind: 'merge', w: this.w, lo: this.lo, mid: this.mid, hi: this.hi, li: this.li, ri: this.ri, out: this.out.slice() };
  }
}

const MAKERS = { bubble: Bubble, selection: Selection, insertion: Insertion, merge: Merge };

/* ---------- 공통 게임 래퍼 ---------- */

export function createGame(algo, arr, opt = {}) {
  if (!MAKERS[algo]) throw new Error('unknown algo ' + algo);
  const m = new MAKERS[algo](arr.slice());
  const c = { cmp: 0, moves: 0, miss: 0, steps: 0 };
  const g = {
    algo, c,
    get a() { return m.a; },
    get done() { return m.done; },
    total: opt.total ?? null,
    expected() { return m.done ? null : m.expected(); },
    view() { return m.view(); },
    // 학생 조작 적용: {ok, done, ev}
    apply(x) {
      if (m.done) return { ok: false, done: true, ev: [] };
      const e = m.expected();
      if (!m.same(x, e)) { c.miss++; return { ok: false, done: false, ev: ['miss'], expected: e }; }
      const ev = []; m.step(e, c, ev); c.steps++;
      return { ok: true, done: m.done, ev };
    },
    progress() { return m.done ? 1 : (g.total ? Math.min(0.99, c.steps / g.total) : 0); },
  };
  if (g.total == null) g.total = solve(algo, arr).steps;
  return g;
}

// 올바른 조작만 계속해서 끝까지 풀어 봐요. (전체 단계 수, 이론 비교·이동 횟수 계산용)
export function solve(algo, arr) {
  const m = new MAKERS[algo](arr.slice());
  const c = { cmp: 0, moves: 0, miss: 0, steps: 0 };
  let guard = 0;
  while (!m.done && guard++ < 100000) { const e = m.expected(); m.step(e, c, []); c.steps++; }
  return { steps: c.steps, cmp: c.cmp, moves: c.moves, result: m.a };
}

export function compareAll(arr) {
  const out = {};
  for (const k of ALGO_KEYS) out[k] = solve(k, arr);
  return out;
}
