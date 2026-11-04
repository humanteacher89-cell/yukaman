// /api/* 모두 → 서버(../../server/app.js). Pages Functions가 이 파일을 Worker로 묶는다.
import { handleApi } from '../../server/app.js';

export const onRequest = ({ request, env }) => handleApi(request, env);
