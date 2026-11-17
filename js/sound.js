// 효과음: Web Audio API로 직접 합성 (음원 파일 없음)
// 볼륨은 기기별로 기억해요. 교사 TV는 보통, 모둠 노트북은 작게가 기본이에요.
const KEY = 'sr-vol';
let ctx = null, master = null;
let vol = 0.35;

function load(def) {
  try { const v = localStorage.getItem(KEY); if (v !== null && !isNaN(+v)) return +v; } catch (e) {}
  return def;
}
function save() { try { localStorage.setItem(KEY, String(vol)); } catch (e) {} }

export function initSound(defVol = 0.35) { vol = load(defVol); }
export function getVol() { return vol; }
export function setVol(v) { vol = Math.max(0, Math.min(1, v)); if (master) master.gain.value = vol; save(); }

function ac() {
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    ctx = new C(); master = ctx.createGain(); master.gain.value = vol; master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
// 첫 클릭 때 오디오를 깨워 둬요(브라우저 자동 재생 제한).
export function unlock() { ac(); }

function tone(freq, dur, { type = 'sine', at = 0, gain = 0.6, slide = 0 } = {}) {
  const c = ac(); if (!c || vol <= 0) return;
  const t0 = c.currentTime + at;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + dur + 0.02);
}
function noise(dur, { at = 0, gain = 0.4 } = {}) {
  const c = ac(); if (!c || vol <= 0) return;
  const t0 = c.currentTime + at, len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const s = c.createBufferSource(), g = c.createGain(), f = c.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = 900;
  s.buffer = buf; g.gain.value = gain; s.connect(f); f.connect(g); g.connect(master); s.start(t0);
}

export const sfx = {
  tick() { tone(660, 0.12, { type: 'square', gain: 0.25 }); },          // 카운트다운 삑
  go() { tone(990, 0.35, { type: 'square', gain: 0.3 }); },             // 출발
  pop() { tone(520, 0.09, { type: 'triangle', gain: 0.5, slide: 380 }); }, // 올바른 이동 뿅
  keep() { tone(440, 0.06, { type: 'triangle', gain: 0.35 }); },        // 그대로
  ding() { tone(1320, 0.25, { gain: 0.35 }); tone(1980, 0.3, { gain: 0.15, at: 0.02 }); }, // 막대 고정 띵
  buzz() { tone(150, 0.28, { type: 'sawtooth', gain: 0.3 }); },        // 위반 삐-
  relay() { tone(784, 0.1, { type: 'triangle' }); tone(1047, 0.16, { type: 'triangle', at: 0.11 }); }, // 다음 사람!
  fanfare() { [523, 659, 784, 1047].forEach((f, i) => tone(f, i === 3 ? 0.5 : 0.14, { type: 'square', gain: 0.22, at: i * 0.13 })); },
  drum() { for (let i = 0; i < 10; i++) noise(0.06, { at: i * 0.07, gain: 0.25 }); tone(880, 0.4, { type: 'square', gain: 0.25, at: 0.75 }); },
  join() { tone(660, 0.08, { type: 'triangle' }); tone(880, 0.1, { type: 'triangle', at: 0.08 }); },
};

// 볼륨 버튼(🔇/🔈/🔊 순환)
export function volButton(el) {
  const steps = [0, 0.15, 0.35, 0.7];
  const paint = () => { el.textContent = vol <= 0 ? '🔇 소리 끔' : vol < 0.25 ? '🔈 작게' : vol < 0.5 ? '🔉 보통' : '🔊 크게'; };
  el.__paint = paint;
  el.addEventListener('click', () => {
    const i = steps.findIndex(s => s >= vol - 0.001);
    setVol(steps[(i + 1) % steps.length]); paint(); unlock(); sfx.pop();
  });
  paint();
}
