// 화면 전환(#/learn, #/practice, #/join, #/host, #/records)
import { initSound, volButton, unlock } from './sound.js';
import { $ } from './ui.js';

const app = $('#app');
let current = null;

const HOME = `
  <section class="hero">
    <h1>📊 막대 정렬 레이스</h1>
    <p class="lead" style="margin:.3em 0 0">정렬 규칙을 배우고, 모둠끼리 같은 막대를 누가 더 빨리 정렬하는지 겨뤄요!</p>
  </section>
  <div class="modes">
    <a class="mode m1" href="#/learn"><div class="ic">📘</div><h2>배우기</h2><p>버블·선택·삽입·병합 정렬의 규칙을 움직이는 그림으로 보고 직접 해 봐요.</p></a>
    <a class="mode m2" href="#/practice"><div class="ic">🏃</div><h2>연습하기</h2><p>모둠 노트북으로 시간을 재며 연습해요. 5번마다 다음 사람에게 차례가 넘어가요.</p></a>
    <a class="mode m3" href="#/join"><div class="ic">🏁</div><h2>대항전 참여</h2><p>선생님 화면의 방 코드를 입력하고, 모든 모둠이 동시에 출발해요.</p></a>
    <a class="mode m4" href="#/host"><div class="ic">📺</div><h2>교사용</h2><p>대항전 방 만들기, 실시간 순위, 반별 기록을 관리해요.</p></a>
  </div>
  <div class="basis">
    <b>교과 연계</b> · 문제해결과 프로그래밍 Ⅱ. 알고리즘 <b>[9문제02-02]</b> 동일한 문제를 해결하는 다양한 알고리즘 간의 효율을 비교하고, 효율적인 알고리즘의 가치를 인식한다. · <b>[9문제02-01]</b> 나누어 생각하기 등 다양한 방법으로 알고리즘을 설계한다.<br>
    <b>교과서</b> · 미래엔 중학교 정보 94~95쪽(정렬 알고리즘과 탐색) · 참고: 비상교육 중학교 정보 105쪽(문제 나누기: 시험지 정리), 천재교육 중학교 정보 97쪽(분할 정복)<br>
    버블·선택·삽입 정렬은 교과서 본문 밖의 <span class="tag more">심화</span> 체험이고, 병합 정렬은 <span class="tag dare">도전</span> 활동이에요.
  </div>`;

async function route() {
  current?.destroy?.(); current = null;
  const [path, query] = (location.hash.slice(1) || '/').split('?');
  const q = new URLSearchParams(query || '');
  window.scrollTo(0, 0);
  // 저장된 소리 설정이 없으면: 교사 화면은 켜짐, 학생 기기는 꺼짐
  initSound(/^\/(host|records)/.test(path) ? 0.7 : 0); $('.vol').__paint?.();
  if (path === '/learn') { const m = await import('./learn.js'); current = m.mountLearn(app, { algo: q.get('a') }); }
  else if (path === '/practice') { const m = await import('./practice.js'); current = m.mountPractice(app); }
  else if (path === '/join') { const m = await import('./team.js'); current = m.mountTeam(app, { code: q.get('c') }); }
  else if (path === '/host') { const m = await import('./host.js'); current = m.mountHost(app); }
  else if (path === '/records') { const m = await import('./records.js'); current = m.mountRecords(app); }
  else app.innerHTML = HOME;
}

initSound(/^#\/(host|records)/.test(location.hash) ? 0.7 : 0); // 컴퓨터실에서 여러 대가 동시에 울리지 않게 학생 기기는 기본 꺼짐
volButton($('.vol'));
document.addEventListener('pointerdown', unlock, { once: true });
window.addEventListener('hashchange', route);
route().catch(e => { app.innerHTML = `<div class="card"><h2>⚠ 화면을 불러오지 못했어요</h2><p class="small mono">${String(e && e.message || e)}</p><p>잠시 뒤 새로 고침해 주세요.</p></div>`; console.error(e); });
