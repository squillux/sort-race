// Firebase 웹 설정값 (공개되어도 되는 값이에요. 보안은 firebase/database.rules.json이 지켜요.)
export const FIREBASE = {
  apiKey: 'AIzaSyBDJwwdXFQeRkgfcWjEHvsgZuGtgO2p4bM',
  authDomain: 'sort-race.firebaseapp.com',
  databaseURL: 'https://sort-race-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'sort-race',
  storageBucket: 'sort-race.firebasestorage.app',
  messagingSenderId: '483956623722',
  appId: '1:483956623722:web:b1620c84237cfb87907d13',
};

// 에뮬레이터 테스트용(주소에 ?emu=1)
export const EMU = { projectId: 'demo-sortrace', db: '127.0.0.1:9000', auth: 'http://127.0.0.1:9099' };
