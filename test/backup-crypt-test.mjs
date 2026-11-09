// 백업 암호화 도구 시험(2026-11-09, 서버 없이): node test/backup-crypt-test.mjs
// 임시 폴더에 시험 열쇠를 만들어 쓰고 끝나면 지운다. 진짜 열쇠와 backups/는 건드리지 않는다.
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const TOOL = join(dirname(fileURLToPath(import.meta.url)), '..', 'tools', 'backup-crypt.mjs');
const dir = mkdtempSync(join(tmpdir(), 'yk-crypt-'));
let n = 0;
const ok = (cond, what) => { n++; assert.ok(cond, what); };
const run = (args, input) => execFileSync(process.execPath, [TOOL, ...args], { input, stdio: ['pipe', 'pipe', 'pipe'] });
const fails = (args, input) => { try { run(args, input); return false; } catch (e) { return true; } };
const at = name => join(dir, name);

try {
  writeFileSync(at('key.txt'), randomBytes(32).toString('base64') + '\n');
  writeFileSync(at('key2.txt'), randomBytes(32).toString('base64'));
  const plain = JSON.stringify({ users: [{ id: 1, nick: '든든이/청주/24', naver_hash: 'k1:' + 'a'.repeat(64) }], posts: [{ id: 2, title: '첫 글', body: '줄\n바꿈' }] });
  run(['seal', at('key.txt'), at('b.json.enc')], plain);
  const text = readFileSync(at('b.json.enc'), 'utf8'), box = JSON.parse(text);
  ok(box.v === 1 && box.alg === 'aes-256-gcm' && box.iv && box.tag && box.data, '저장 형식');
  ok(!text.includes('든든이') && !text.includes('naver_hash') && !text.includes('첫 글'), '파일에 평문이 보이지 않음');
  ok(run(['open', at('key.txt'), at('b.json.enc')]).toString('utf8') === plain, '풀면 그대로(한글 · 줄바꿈 포함)');
  ok(fails(['open', at('key2.txt'), at('b.json.enc')]), '다른 열쇠로는 못 풂');

  const flip = Buffer.from(box.data, 'base64');
  flip[3] ^= 1;
  writeFileSync(at('bad.enc'), JSON.stringify({ ...box, data: flip.toString('base64') }));
  ok(fails(['open', at('key.txt'), at('bad.enc')]), '바뀐 파일은 못 풂');
  writeFileSync(at('short.enc'), JSON.stringify({ ...box, tag: Buffer.from(box.tag, 'base64').subarray(0, 4).toString('base64') }));
  ok(fails(['open', at('key.txt'), at('short.enc')]), '짧게 자른 태그는 거절');
  writeFileSync(at('plain.json'), plain);
  ok(fails(['open', at('key.txt'), at('plain.json')]), '암호화하지 않은 파일은 거절');

  writeFileSync(at('k31.txt'), randomBytes(31).toString('base64'));
  ok(fails(['seal', at('k31.txt'), at('x.enc')], plain), '열쇠 길이 확인');
  ok(fails(['what', at('key.txt'), at('x.enc')], plain), '모르는 명령 거절');

  run(['seal', at('key.txt'), at('c.json.enc')], plain);
  const box2 = JSON.parse(readFileSync(at('c.json.enc'), 'utf8'));
  ok(box2.iv !== box.iv && box2.data !== box.data, '같은 내용도 매번 다른 결과');
  console.log('통과', n, '건');
} finally {
  rmSync(dir, { recursive: true, force: true });
}
