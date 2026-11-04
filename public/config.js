// 육아맨 설정. API_URL = 서버 주소(화면과 같은 Pages 프로젝트의 /api). 비우면 시험 모드(견본 글 + 이 폰에만 저장)로만 돈다.
// 정적 서버(python http.server 등)로 열어 /api가 없으면 화면이 알아서 시험 모드로 바뀐다.
window.YK_CONFIG = {
  APP_NAME: '육아맨',
  API_URL: '/api',
  VERSION: '0.1.0'
};
