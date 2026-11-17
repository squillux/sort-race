// 정렬 엔진 테스트: node tests/sorts.test.mjs
import { ALGO_KEYS, createGame, makeArray, solve, isSorted } from '../js/sorts.js';

let fail = 0, pass = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('✗', msg); } };

// 1) 모든 방법이 여러 크기·시드에서 정렬을 완료하는지
for (const algo of ALGO_KEYS) {
  for (const n of [2, 3, 5, 6, 7, 8, 10, 12]) {
    for (let seed = 1; seed <= 60; seed++) {
      const arr = makeArray(n, seed * 7919 + n);
      const r = solve(algo, arr);
      ok(isSorted(r.result), `${algo} n=${n} seed=${seed} 정렬 실패 ${r.result}`);
      ok(r.result.slice().sort((a, b) => a - b).join() === arr.slice().sort((a, b) => a - b).join(), `${algo} 값 보존 실패`);
    }
  }
}

// 2) 같은 시드 → 같은 배열, 값은 서로 다름, 정렬된 배열이 아님
for (let s = 0; s < 200; s++) {
  const a = makeArray(8, s), b = makeArray(8, s);
  ok(a.join() === b.join(), '시드 재현성');
  ok(new Set(a).size === 8, '값 중복');
  ok(!isSorted(a), '이미 정렬된 배열');
}

// 3) 틀린 조작은 위반으로 세고 상태를 바꾸지 않음 / 올바른 조작만으로 완료
function wrongOf(g) {
  const e = g.expected();
  switch (e.t) {
    case 'bubble': return { t: 'bubble', swap: !e.swap };
    case 'pick': return { t: 'pick', i: e.i === g.view().lo ? g.view().lo + 1 : g.view().lo };
    case 'slot': return { t: 'slot', s: e.s === 0 ? 1 : 0 };
    case 'take': return { t: 'take', side: e.side === 'L' ? 'R' : 'L' };
  }
}
for (const algo of ALGO_KEYS) {
  for (let seed = 1; seed <= 40; seed++) {
    const arr = makeArray(8, seed);
    const g = createGame(algo, arr);
    let misses = 0, guard = 0;
    while (!g.done && guard++ < 1000) {
      if (guard % 3 === 0) {
        const before = g.a.join(), w = wrongOf(g);
        // 선택 정렬에서 lo+1이 정답일 수도 있으니 정답과 다를 때만 검사
        const e = g.expected();
        if (JSON.stringify(w) !== JSON.stringify(e)) {
          const r = g.apply(w); misses++;
          ok(!r.ok && r.ev[0] === 'miss', `${algo} 틀린 조작이 통과됨`);
          ok(g.a.join() === before, `${algo} 틀린 조작으로 상태 변경`);
        }
      }
      const r = g.apply(g.expected());
      ok(r.ok, `${algo} 올바른 조작 거부`);
    }
    ok(g.done && isSorted(g.a), `${algo} 완료 실패`);
    ok(g.c.miss === misses, `${algo} 위반 횟수 ${g.c.miss} != ${misses}`);
    ok(g.progress() === 1, `${algo} 진행률 1 아님`);
    ok(g.c.steps === g.total, `${algo} 단계 수 불일치`);
  }
}

// 4) 비교 횟수 상식 검사 (n=8)
for (let seed = 1; seed <= 50; seed++) {
  const arr = makeArray(8, seed);
  const sel = solve('selection', arr), bub = solve('bubble', arr), ins = solve('insertion', arr), mer = solve('merge', arr);
  ok(sel.cmp === 28, `선택 정렬 비교 횟수는 항상 n(n-1)/2=28 (${sel.cmp})`);
  ok(bub.cmp <= 28 && bub.cmp >= 7, `버블 비교 범위 ${bub.cmp}`);
  ok(ins.cmp <= 28 && ins.cmp >= 7, `삽입 비교 범위 ${ins.cmp}`);
  ok(mer.cmp <= 17, `병합 비교 상한 ${mer.cmp}`);
}

// 5) 손으로 확인한 예시: [5,1,4,2,8] 버블
{
  const r = solve('bubble', [5, 1, 4, 2, 8]);
  ok(r.cmp === 4 + 3 + 2 && r.moves === 4, `버블 예시 cmp=${r.cmp} moves=${r.moves}`);
  const s = solve('insertion', [3, 1, 2]);
  ok(s.moves === 2 && s.result.join() === '1,2,3', `삽입 예시 moves=${s.moves}`);
}

console.log(`통과 ${pass}개, 실패 ${fail}개`);
process.exit(fail ? 1 : 0);
