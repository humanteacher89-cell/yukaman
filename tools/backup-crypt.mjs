// 육아맨 백업 암호화(2026-11-09 보안 보강). AES-256-GCM, Node 기본 crypto만 쓴다. deploy.py backup · backup-seal · backup-open이 부른다.
//   node tools/backup-crypt.mjs seal <열쇠 파일> <저장할 .enc>   표준 입력의 평문을 암호화해 저장한다(평문은 디스크에 쓰지 않는다)
//   node tools/backup-crypt.mjs open <열쇠 파일> <.enc>          풀어서 표준 출력으로 낸다(열쇠가 다르거나 파일이 바뀌었으면 실패)
// 열쇠 파일 = 32바이트를 base64로 적은 한 줄(deploy.py keys가 만든다). 저장 형식은 JSON {v, alg, iv, tag, data}(모두 base64).
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const AAD = Buffer.from('yukaman-backup-v1');
const TAG = { authTagLength: 16 };      // 짧게 자른 태그를 받지 않는다
const [cmd, keyFile, file] = process.argv.slice(2);
const die = msg => { process.stderr.write(msg + '\n'); process.exit(1); };
if (!['seal', 'open'].includes(cmd) || !keyFile || !file) die('사용법: seal|open <열쇠 파일> <파일>');
const key = Buffer.from(readFileSync(keyFile, 'utf8').trim(), 'base64');
if (key.length !== 32) die('열쇠는 32바이트여야 해요');

if (cmd === 'seal') {
  const plain = readFileSync(0);      // 표준 입력 전부
  const iv = randomBytes(12), c = createCipheriv('aes-256-gcm', key, iv, TAG);
  c.setAAD(AAD);
  const data = Buffer.concat([c.update(plain), c.final()]);
  writeFileSync(file, JSON.stringify({ v: 1, alg: 'aes-256-gcm', iv: iv.toString('base64'), tag: c.getAuthTag().toString('base64'), data: data.toString('base64') }));
} else {
  let box;
  try { box = JSON.parse(readFileSync(file, 'utf8')); } catch (e) { die('암호화한 백업 파일이 아니에요'); }
  if (!box || box.v !== 1 || box.alg !== 'aes-256-gcm') die('모르는 형식이에요');
  let plain;
  try {
    const d = createDecipheriv('aes-256-gcm', key, Buffer.from(box.iv, 'base64'), TAG);
    d.setAAD(AAD);
    d.setAuthTag(Buffer.from(box.tag, 'base64'));
    plain = Buffer.concat([d.update(Buffer.from(box.data, 'base64')), d.final()]);
  } catch (e) { die('풀지 못했어요(열쇠가 다르거나 파일이 바뀜)'); }
  process.stdout.write(plain);
}
