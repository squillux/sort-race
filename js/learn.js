// 배우기 모드: 규칙 카드 → 보면서 배우기(자동 재생) → 직접 해 보기 → 확인 문제
import { ALGOS, ALGO_KEYS, createGame, makeArray, compareAll } from './sorts.js';
import { createBoard, missText } from './board.js';
import { sfx } from './sound.js';
import { $, esc, toast, store, segButtons } from './ui.js';

const QUIZ = {
  bubble: { q: '[4, 2, 7, 1]을 버블 정렬할 때, 첫 번째 바퀴가 끝나면 맨 끝에 고정되는 막대는?', o: ['1', '4', '7'], a: 2, e: '한 바퀴 동안 큰 막대가 계속 뒤로 밀려나서, 가장 큰 7이 맨 끝에 고정돼요.' },
  selection: { q: '[6, 3, 8, 2]를 선택 정렬할 때, 첫 단계에서 맨 앞으로 보내는 막대는?', o: ['6', '3', '2'], a: 2, e: '정리 안 된 막대 전체에서 가장 작은 2를 찾아 맨 앞으로 보내요.' },
  insertion: { q: '정리된 구역이 [2, 5, 9]일 때, 다음 막대 6을 끼워 넣으면?', o: ['[2, 6, 5, 9]', '[2, 5, 6, 9]', '[2, 5, 9, 6]'], a: 1, e: '5보다 크고 9보다 작으니 5와 9 사이에 끼워요.' },
  merge: { q: '[3, 8] 묶음과 [1, 5] 묶음을 합칠 때, 가장 먼저 아래 줄로 내려가는 막대는?', o: ['3', '1', '5'], a: 1, e: '두 묶음의 맨 앞 3과 1을 비교해 더 작은 1이 먼저 내려가요.' },
};
const SEEDS = { bubble: 11, selection: 23, insertion: 37, merge: 41 };
const DONE_KEY = 'sr-learned';

export function mountLearn(root, { algo: first = 'bubble' } = {}) {
  let algo = ALGO_KEYS.includes(first) ? first : 'bubble';
  let learned = store(DONE_KEY) || {};
  let timer = null, speed = 900, demo = null, demoBoard = null, tryGame = null, tryBoard = null, hint = true;

  root.innerHTML = `
    <h1>📘 배우기</h1>
    <p class="lead">정렬 방법(규칙)을 하나씩 익혀요. 규칙을 읽고 → 움직이는 모습을 보고 → 직접 해 본 뒤 → 확인 문제를 풀어요.</p>
    <div class="algos"></div>
    <div class="rulebox"></div>
    <div class="card">
      <h2>① 보면서 배우기</h2>
      <div class="row ctl">
        <button class="btn play">▶ 재생</button>
        <button class="btn sub step">한 단계 ▶|</button>
        <button class="btn ghost reset">↺ 처음부터</button>
        <span class="muted small">속도</span><span class="speed"></span>
      </div>
      <p class="say small muted" aria-live="polite"></p>
      <div class="demo"></div>
    </div>
    <div class="card">
      <h2>② 직접 해 보기</h2>
      <div class="row"><label class="small"><input type="checkbox" class="hintchk" checked> 💡 힌트 보기</label>
        <button class="btn ghost small newtry">🔀 새 막대</button>
        <span class="small muted tstat"></span></div>
      <div class="try"></div>
    </div>
    <div class="card quiz"></div>
    <div class="card">
      <h2>📊 한눈에 비교 <span class="tag std">[9문제02-02] 효율 비교</span></h2>
      <p class="small muted">같은 막대 8개를 네 가지 방법으로 정렬하면 비교를 몇 번 할까요? 막대 수를 바꿔 보며 어떤 방법이 효율적인지 이야기해 봐요.</p>
      <div class="row"><span class="small">막대 수</span><span class="ncmp"></span><button class="btn ghost small reroll">🔀 다른 배열</button></div>
      <div class="cmp"></div>
    </div>
    <p style="text-align:center;margin-top:18px"><a class="btn mint lg" href="#/practice">🏃 연습하기로 가기</a></p>`;

  function paintAlgos() {
    segButtons($('.algos', root), ALGO_KEYS.map(k => ({ v: k, html: `${ALGOS[k].icon} ${ALGOS[k].name} ${learned[k] ? '<span class="ok">✅</span>' : ''}` })), algo, v => { algo = v; load(); });
  }

  function load() {
    stop();
    const A = ALGOS[algo];
    paintAlgos();
    $('.rulebox', root).innerHTML = `<div class="rule"><div class="big-ic">${A.icon}</div>
      <p><b style="font-family:var(--cute);font-size:1.3rem">${A.name}</b> <span class="tag ${A.level === '도전' ? 'dare' : 'more'}">${A.level}</span></p>
      <p>📏 <b>규칙</b> · ${esc(A.rule)}</p><p class="like">💡 ${esc(A.like)}</p></div>`;
    resetDemo(); newTry(); paintQuiz();
  }

  // ① 자동 재생
  function resetDemo() {
    stop();
    demoBoard?.destroy();
    demo = createGame(algo, makeArray(6, SEEDS[algo]));
    demoBoard = createBoard($('.demo', root), { onAction: () => {} });
    demoBoard.setLocked(true);
    demoBoard.render(demo, { hint: true });
    say();
  }
  function say(ev) {
    const v = demo.view(), a = demo.a;
    let s = '';
    if (demo.done) s = '🎉 정렬 완료! 비교 ' + demo.c.cmp + '번, 이동 ' + demo.c.moves + '번이었어요.';
    else {
      const e = demo.expected();
      if (e.t === 'bubble') s = `${a[v.pair[0]]}와(과) ${a[v.pair[1]]} 비교 → ${e.swap ? '앞이 더 크니까 바꿔요.' : '앞이 더 작으니까 그대로 둬요.'}`;
      if (e.t === 'pick') s = `정리 안 된 구역에서 가장 작은 막대는 ${a[e.i]} → 맨 앞(${v.lo + 1}번째)으로 보내요.`;
      if (e.t === 'slot') s = `${a[v.k]}을(를) 들어서, 정리된 구역에서 ${e.s + 1}번째 자리에 끼워요.`;
      if (e.t === 'take') s = `왼쪽 맨 앞 ${a[v.li]}, 오른쪽 맨 앞 ${a[v.ri]} → 더 작은 ${Math.min(a[v.li], a[v.ri])}을(를) 아래로 내려요.`;
    }
    if (ev?.includes('lock') && !demo.done && algo === 'bubble') s = '🔒 한 바퀴 끝! 가장 큰 막대가 끝에 고정됐어요. ' + s;
    if (ev?.includes('level')) s = '🧩 묶음이 두 배로 커졌어요. ' + s;
    $('.say', root).textContent = s;
  }
  function stepDemo() {
    if (demo.done) return false;
    const r = demo.apply(demo.expected());
    demoBoard.render(demo, { hint: true }); say(r.ev);
    if (r.ev.includes('lock') || r.ev.includes('merged')) sfx.ding(); else sfx.pop();
    if (r.done) sfx.fanfare();
    return !r.done;
  }
  function play() {
    if (timer) return stop();
    if (demo.done) resetDemo();
    $('.play', root).textContent = '⏸ 멈춤';
    const loop = () => { if (stepDemo()) timer = setTimeout(loop, speed); else stop(); };
    timer = setTimeout(loop, 200);
  }
  function stop() { clearTimeout(timer); timer = null; const p = $('.play', root); if (p) p.textContent = '▶ 재생'; }

  // ② 직접 해 보기
  function newTry() {
    tryBoard?.destroy();
    tryGame = createGame(algo, makeArray(6, (Date.now() & 0xffff) + 7));
    tryBoard = createBoard($('.try', root), { onAction: x => {
      const r = tryGame.apply(x);
      if (!r.ok) { sfx.buzz(); tryBoard.shake(); toast('🤔 ' + missText(tryGame, r.expected), true, 3000); }
      else if (r.ev.includes('lock') || r.ev.includes('merged')) sfx.ding(); else sfx.pop();
      tryBoard.render(tryGame, { hint });
      tstat();
      if (r.done) { sfx.fanfare(); toast('🎉 성공! 아래 확인 문제도 풀어 봐요.'); }
    } });
    tryBoard.render(tryGame, { hint }); tstat();
  }
  function tstat() { $('.tstat', root).textContent = `비교 ${tryGame.c.cmp} · 이동 ${tryGame.c.moves} · 실수 ${tryGame.c.miss}`; }

  // ③ 확인 문제
  function paintQuiz() {
    const Q = QUIZ[algo];
    $('.quiz', root).innerHTML = `<h2>③ 확인 문제 ${learned[algo] ? '✅' : ''}</h2><p><b>${esc(Q.q)}</b></p>
      <div class="row">${Q.o.map((o, i) => `<button class="btn sub" data-i="${i}">${esc(o)}</button>`).join('')}</div><p class="fb small" aria-live="polite"></p>`;
    root.querySelectorAll('.quiz [data-i]').forEach(b => b.addEventListener('click', () => {
      const right = +b.dataset.i === Q.a, fb = $('.quiz .fb', root);
      fb.innerHTML = (right ? '⭕ 정답! ' : '❌ 다시 생각해 봐요. ') + esc(right ? Q.e : '');
      if (right) { sfx.fanfare(); learned[algo] = true; store(DONE_KEY, learned); paintAlgos(); $('.quiz h2', root).textContent = '③ 확인 문제 ✅'; }
      else sfx.buzz();
    }));
  }

  // 📊 비교
  let cmpN = 8, cmpSeed = 5;
  function paintCmp() {
    const arr = makeArray(cmpN, cmpSeed), r = compareAll(arr), max = Math.max(...ALGO_KEYS.map(k => r[k].cmp));
    $('.cmp', root).innerHTML = `<p class="small mono">배열: [${arr.join(', ')}]</p>` + ALGO_KEYS.map(k =>
      `<div class="cmpbar"><span>${ALGOS[k].icon} ${ALGOS[k].short}</span><i style="width:${Math.max(2, r[k].cmp / max * 70)}%"></i><em>비교 ${r[k].cmp}번 · 이동 ${r[k].moves}번</em></div>`).join('');
  }
  segButtons($('.ncmp', root), [6, 8, 10, 16, 32].map(n => ({ v: String(n), label: n + '개' })), '8', v => { cmpN = +v; paintCmp(); });
  $('.reroll', root).addEventListener('click', () => { cmpSeed = Math.floor(Math.random() * 1e6); paintCmp(); });

  segButtons($('.speed', root), [{ v: '1500', label: '느리게' }, { v: '900', label: '보통' }, { v: '400', label: '빠르게' }], '900', v => { speed = +v; });
  $('.play', root).addEventListener('click', play);
  $('.step', root).addEventListener('click', () => { stop(); if (demo.done) resetDemo(); else stepDemo(); });
  $('.reset', root).addEventListener('click', resetDemo);
  $('.hintchk', root).addEventListener('change', e => { hint = e.target.checked; tryBoard.render(tryGame, { hint }); });
  $('.newtry', root).addEventListener('click', newTry);

  load(); paintCmp();
  return { destroy() { stop(); demoBoard?.destroy(); tryBoard?.destroy(); } };
}
