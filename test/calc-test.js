// 육아맨 계산기 시험: node test/calc-test.js
// 기대값은 법령 조문 숫자로 손으로 계산한 값이다. 출처는 public/calc.js 맨 위 주석.
const assert = require('assert');
const C = require('../public/calc.js');
const MAN = 10000;
let n = 0;
const eq = (a, b, what) => { n++; assert.deepStrictEqual(a, b, what); };
const paid = r => r.rows.map(x => x.paid);
const span = months => ({ start: '2027-01-01', end: C.addDays(C.addMonths('2027-01-01', months), -1) });

// 일반 육아휴직(제95조)
let r = C.leaveBenefit({ ordinary: 350 * MAN, ...span(12) });
eq(paid(r), [250, 250, 250, 200, 200, 200, 160, 160, 160, 160, 160, 160].map(x => x * MAN), '일반 350만원 달별');
eq(r.total, 2310 * MAN, '일반 350만원 12개월 합계');
r = C.leaveBenefit({ ordinary: 150 * MAN, ...span(8) });
eq(paid(r), [150, 150, 150, 150, 150, 150, 120, 120].map(x => x * MAN), '낮은 통상임금은 그대로, 7개월째부터 80%');
r = C.leaveBenefit({ ordinary: 60 * MAN, ...span(7) });
eq(paid(r), [70, 70, 70, 70, 70, 70, 70].map(x => x * MAN), '하한 70만원');
r = C.leaveBenefit({ ordinary: 80 * MAN, ...span(7) });
eq(r.rows[6].paid, 70 * MAN, '80%가 64만원이면 하한 70만원');

// 6+6(제95조의3 제1항)
r = C.leaveBenefit({ ordinary: 500 * MAN, ...span(6), mode: 'both', spouseMonths: 6 });
eq(paid(r), [250, 250, 300, 350, 400, 450].map(x => x * MAN), '6+6 상한표');
eq(r.total, 2000 * MAN, '6+6 6개월 합계');
r = C.leaveBenefit({ ordinary: 400 * MAN, ...span(12), mode: 'both', spouseMonths: 6 });
eq(r.total, 2910 * MAN, '6+6 400만원 12개월');
r = C.leaveBenefit({ ordinary: 450 * MAN, ...span(6), mode: 'both', spouseMonths: 3 });
eq(paid(r), [250, 250, 300, 200, 200, 200].map(x => x * MAN), '배우자 3개월이면 공통 3개월만 특례, 뒤는 일반');
eq(r.common, 3, '공통 개월');
r = C.leaveBenefit({ ordinary: 500 * MAN, ...span(3), mode: 'both', spouseMonths: 6 });
eq(paid(r), [250, 250, 300].map(x => x * MAN), '내가 3개월이면 3개월까지');
r = C.leaveBenefit({ ordinary: 500 * MAN, ...span(4), mode: 'both', spouseMonths: 0 });
eq(r.warnings.includes('noCommon'), true, '배우자 사용 없음 경고');
eq(paid(r), [250, 250, 250, 200].map(x => x * MAN), '배우자 안 쓰면 일반');
// 제95조의3 제1항 "피보험자인 부모가 모두": 배우자가 고용보험 피보험자가 아니면(공무원·자영업·전업주부) 6+6이 아니다
r = C.leaveBenefit({ ordinary: 500 * MAN, ...span(6), mode: 'both', spouseMonths: 6, spouseInsured: false });
eq(paid(r), [250, 250, 250, 200, 200, 200].map(x => x * MAN), '배우자 미가입이면 일반 기준');
eq(r.common, 0, '배우자 미가입 공통 0');
eq(r.warnings.includes('spouseNotInsured') && !r.warnings.includes('noCommon'), true, '배우자 미가입 경고 하나만');
r = C.leaveBenefit({ ordinary: 500 * MAN, ...span(6), mode: 'both', spouseMonths: 6, spouseInsured: true });
eq(r.total, 2000 * MAN, 'spouseInsured true는 기본과 같다');

// 통상임금 0은 하한 70만원으로 계산되지 않게 경고
r = C.leaveBenefit({ ordinary: 0, ...span(12) });
eq(r.warnings.includes('pay'), true, '통상임금 0 경고(육아휴직)');
eq(C.reduceBenefit({ ordinary: 0, before: 40, after: 30 }).warnings.includes('pay'), true, '통상임금 0 경고(단축)');
eq(C.paternityPay({ ordinary: 0, priority: true }).warnings, ['pay'], '통상임금 0 경고(배우자 출산휴가)');
eq(C.paternityPay({ ordinary: 350 * MAN, priority: true }).warnings, [], '통상임금 있으면 경고 없음');

// 한부모(제95조의3 제3항)
r = C.leaveBenefit({ ordinary: 350 * MAN, ...span(8), mode: 'single' });
eq(paid(r), [300, 300, 300, 200, 200, 200, 160, 160].map(x => x * MAN), '한부모');

// 한 달 미만 일수 비례(제95조 제3항)
r = C.leaveBenefit({ ordinary: 300 * MAN, start: '2027-03-01', end: '2027-03-20' });
eq(r.rows[0].paid, Math.floor(250 * MAN * 20 / 31), '20일 비례');
eq(r.warnings.includes('short'), true, '30일 미만 경고');
r = C.leaveBenefit({ ordinary: 300 * MAN, start: '2027-01-15', end: '2027-03-14' });
eq(r.rows.length, 2, '중간 시작 2개월');
eq(r.rows[0].full && r.rows[1].full, true, '1/15~2/14, 2/15~3/14은 온달');

// 회사 금품 감액(제98조)
r = C.leaveBenefit({ ordinary: 300 * MAN, ...span(1), companyPay: 100 * MAN });
eq(r.rows[0].paid, 200 * MAN, '금품 100 + 급여 250 = 350, 통상임금 300 넘는 50 감액');
r = C.leaveBenefit({ ordinary: 300 * MAN, ...span(1), companyPay: 50 * MAN });
eq(r.rows[0].paid, 250 * MAN, '합이 통상임금 안이면 감액 없음');

// 날짜
r = C.leaveBenefit({ ordinary: 300 * MAN, start: '2027-03-01', end: '2028-02-29' });
eq(r.fullMonths, 12, '12개월');
eq(r.applyBy, '2027-01-30', '30일 전 신청');
eq(r.claimFrom, '2027-04-01', '급여 신청 시작');
eq(r.claimTo, '2029-02-28', '끝난 뒤 12개월');
r = C.leaveBenefit({ ordinary: 300 * MAN, start: '2027-01-01', end: '2028-06-30' });
eq(r.fullMonths, 18, '18개월');
eq(r.warnings.includes('over12'), true, '12개월 넘음 안내');
eq(r.warnings.includes('over18'), false, '18개월은 초과 아님');
r = C.leaveBenefit({ ordinary: 300 * MAN, start: '2027-01-01', end: '2028-07-31' });
eq(r.warnings.includes('over18'), true, '19개월은 초과');

// 근로시간 단축(제104조의2)
r = C.reduceBenefit({ ordinary: 300 * MAN, before: 40, after: 30, months: 12 });
eq(r.gov, 625000, '300만원 40→30: 250만 × 10/40');
eq(r.wage, 225 * MAN, '회사 임금 비례');
r = C.reduceBenefit({ ordinary: 300 * MAN, before: 40, after: 25 });
eq(r.gov, 625000 + 200000, '300만원 40→25: 62.5 + 160×5/40');
r = C.reduceBenefit({ ordinary: 150 * MAN, before: 40, after: 20 });
eq(r.gov, 375000 + 300000, '150만원 40→20: 37.5 + 120×10/40');
r = C.reduceBenefit({ ordinary: 30 * MAN, before: 40, after: 30 });
eq(r.first, 125000, '하한 50만 × 10/40');
eq(r.gov, 75000, '임금 22.5 + 급여 12.5 = 35만원, 통상임금 30만원 넘는 5만원 감액');
r = C.reduceBenefit({ ordinary: 300 * MAN, before: 40, after: 35 });
eq(r.gov, 312500, '5시간만 줄이면 실제 시간');
r = C.reduceBenefit({ ordinary: 300 * MAN, before: 40, after: 10 });
eq(r.warnings.includes('range'), true, '15시간 미만 경고');
r = C.reduceBenefit({ ordinary: 300 * MAN, before: 40, after: 40 });
eq(r.warnings.includes('hours'), true, '안 줄이면 경고');

// 배우자 출산전후휴가
r = C.paternityPay({ ordinary: 350 * MAN, priority: true });
eq(r.total, Math.floor(350 * MAN / 209 * 8 * 20), '20일 통상임금');
eq(r.gov, 1684210, '정부 상한 20일');
eq(r.company, r.total - 1684210, '나머지는 회사');
r = C.paternityPay({ ordinary: 350 * MAN, priority: false });
eq(r.gov, 0, '우선지원 아니면 회사 전액');
r = C.paternityPay({ ordinary: 350 * MAN, priority: true, days: 3 });
eq(r.capAll, 252630, '3일 상한(고용노동부 표)');
r = C.paternityPay({ ordinary: 200 * MAN, priority: true });
eq(r.gov, r.total, '상한 아래면 전부 정부');

// 아이 기준 날짜
r = C.childDates({ birth: '2024-12-05' });
eq(r.bothStartBy, '2026-06-04', '고용노동부 예시: 24.12.5생 18개월은 26.6.4까지');
eq(r.leaveAgeEnd, '2033-12-04', '만 9세 생일 전날');
eq(r.leaveGradeEnd, '2033-02-28', '초2 끝');
eq(r.leaveStartBy, '2033-12-04', '둘 중 늦은 날');
eq(r.reduceStartBy, '2037-12-04', '단축: 만 13세 생일 전날');
r = C.childDates({ birth: '2026-01-10' });
eq(r.leaveStartBy, '2035-02-28', '1월생은 초2 끝이 더 늦다');
r = C.childDates({ due: '2027-03-01' });
eq(r.paternityFrom, '2027-01-10', '예정일 50일 전');
r = C.childDates({ due: '2027-03-01', birth: '2027-02-20' });
eq(r.paternityFrom, '2027-01-10', '시작은 예정일 기준');
eq(r.paternityTo, '2027-06-20', '끝은 태어난 날 + 120일');

console.log('통과', n, '건');
