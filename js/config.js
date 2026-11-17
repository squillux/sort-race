// Firebase 웹 설정값 (공개되어도 되는 값이에요. 보안은 database.rules.json이 지켜요.)
// 새 프로젝트를 만든 뒤 콘솔 > 프로젝트 설정 > 내 앱(웹)에서 복사한 값으로 바꿔 주세요.
export const FIREBASE = {
  apiKey: '',
  authDomain: '',
  databaseURL: '',
  projectId: '',
  appId: '',
};

// 에뮬레이터 테스트용(주소에 ?emu=1 또는 #/host?emu=1)
export const EMU = { projectId: 'demo-sortrace', db: '127.0.0.1:9000', auth: 'http://127.0.0.1:9099' };
