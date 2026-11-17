// 연습하기 모드: 서버 없이 모둠 기기에서 시간 재며 연습 (최고 기록은 이 기기에만 저장)
import { ALGOS, ALGO_KEYS, makeArray, compareAll } from './sorts.js';
import { createRunner } from './runner.js';
import { unlock } from './sound.js';
import { $, esc, fmt, store, segButtons, countdown } from './ui.js';

const BEST_KEY = 'sr-best';

export function mountPractice(root) {
  let algo = 'bubble', n = 8, members = 4, hint = false, relay = false, runner = null;
  const best = store(BEST_KEY) || {};

  root.innerHTML = `
    <h1>🏃 연습하기</h1>
    <p class="lead">대항전 전에 모둠끼리 연습해요. 규칙을 어기면 3초가 더해져요.</p>
    <div class="card setup">
      <div class="row"><b>정렬 방법</b><span class="algos"></span></div>
      <div class="row" style="margin-top:8px"><b>막대 수</b><span class="ns"></span></div>
      <div class="row" style="margin-top:8px"><label><input type="checkbox" class="relaychk"> 🎮 릴레이 교대 알림 (5번 조작마다 다음 사람에게)</label><span class="memwrap" hidden><b>모둠 인원</b> <span class="mem"></span></span></div>
      <div class="row" style="margin-top:8px"><label><input type="checkbox" class="hintchk"> 💡 힌트 켜기 (힌트를 켜면 최고 기록에는 남지 않아요)</label></div>
      <p class="bestline small muted"></p>
      <button class="btn lg start">▶ 시작</button>
    </div>
    <div class="play"></div>
    <div class="result"></div>`;

  const paintBest = () => {
    const b = best[`${algo}-${n}`];
    $('.bestline', root).textContent = b ? `🏅 이 기기 최고 기록 (${ALGOS[algo].name}, 막대 ${n}개): ${fmt(b.score)} (위반 ${b.miss}회 포함)` : '아직 이 기기 최고 기록이 없어요.';
  };
  segButtons($('.algos', root), ALGO_KEYS.map(k => ({ v: k, html: `${ALGOS[k].icon} ${ALGOS[k].short}${k === 'merge' ? ' <span class="tag dare">도전</span>' : ''}` })), algo, v => { algo = v; paintBest(); });
  segButtons($('.ns', root), [6, 8, 10].map(x => ({ v: String(x), label: x + '개' })), String(n), v => { n = +v; paintBest(); });
  segButtons($('.mem', root), [1, 2, 3, 4, 5, 6].map(x => ({ v: String(x), label: x + '명' })), String(members), v => { members = +v; });
  $('.hintchk', root).addEventListener('change', e => { hint = e.target.checked; runner?.setHint(hint); });
  $('.relaychk', root).addEventListener('change', e => { relay = e.target.checked; $('.memwrap', root).hidden = !relay; });
  paintBest();

  $('.start', root).addEventListener('click', async () => {
    unlock();
    runner?.destroy(); $('.result', root).innerHTML = '';
    const arr = makeArray(n, Math.floor(Math.random() * 1e9));
    $('.setup', root).hidden = true;
    const startAt = performance.now() + 3000;
    const usedHint = hint;
    runner = createRunner($('.play', root), { algo, arr, members, relay, hint, startAt, now: () => performance.now(), onDone: s => done(s, arr, usedHint || runner?.hintUsed) });
    await countdown(startAt, () => performance.now());
  });

  function done(s, arr, usedHint) {
    const k = `${algo}-${n}`, prev = best[k];
    let rec = '';
    if (!usedHint && (!prev || s.score < prev.score)) { best[k] = { score: s.score, miss: s.miss, at: Date.now() }; store(BEST_KEY, best); rec = '<p style="font-size:1.2rem">🏅 <b>이 기기 최고 기록!</b></p>'; }
    const r = compareAll(arr), max = Math.max(...ALGO_KEYS.map(a => r[a].cmp));
    $('.result', root).innerHTML = `<div class="card">
      <h2>🎉 완료!</h2>${rec}
      <p>기록 <b style="font-size:1.4rem;color:var(--brand)">${fmt(s.score)}</b> = 시간 ${fmt(s.ms)} + 위반 ${s.miss}회 × 3초 ${usedHint ? '<span class="tag more">힌트 사용</span>' : ''}</p>
      <p class="small muted">비교 ${s.cmp}번 · 이동 ${s.moves}번</p>
      <h3>🤔 같은 배열을 다른 방법으로 정렬했다면?</h3>
      ${ALGO_KEYS.map(a => `<div class="cmpbar"><span>${ALGOS[a].icon} ${ALGOS[a].short}${a === algo ? ' ★' : ''}</span><i style="width:${Math.max(2, r[a].cmp / max * 70)}%;${a === algo ? 'background:var(--on)' : ''}"></i><em>비교 ${r[a].cmp}번</em></div>`).join('')}
      <div class="row" style="margin-top:12px"><button class="btn again">↺ 다시 하기</button><button class="btn sub change">⚙ 설정 바꾸기</button></div></div>`;
    $('.again', root).addEventListener('click', () => $('.start', root).click());
    $('.change', root).addEventListener('click', () => { runner?.destroy(); runner = null; $('.result', root).innerHTML = ''; $('.setup', root).hidden = false; paintBest(); });
  }

  return { destroy() { runner?.destroy(); } };
}
