/* 육아맨 계산기(2026-11-04, 앱개발부). 화면 없는 순수 계산만 둔다(test/calc-test.js로 시험).
   기준은 2026-11-04에 국가법령정보센터 원문으로 확인했다. 법이 바뀌면 RULES만 고치고 시험을 다시 돌린다.
   - 육아휴직 급여: 고용보험법 시행령 제95조(일반) · 제95조의3(부모 모두 18개월 특례 = 6+6, 한부모) · 제98조(회사 금품 감액). [시행 2026.9.18.]
     6+6: 고용노동부 답변(2024-05·2024-08·2025-02·2025-03)대로 "공무원(교원 등)·근로자 부부는 부부 중 근로자에 대해서만 적용"한다. 배우자가 공무원·교원이어도 근로자인 아빠는 6+6이다.
     배우자가 육아휴직을 쓸 수 없으면(자영업·프리랜서·전업) 부모가 모두 쓰는 경우가 아니라 일반 기준(opts.spouseLeave = false). 이 계산은 고용보험 근로자용이다. 공무원·교원 본인은 공무원수당 규정을 따른다.
   - 나눠 쓰기: 제95조 제2항 합산. 앞서 쓴 개월은 opts.usedMonths로 받아 이어서 센다.
   - 6+6 공통 기간: 고용노동부 답변 "부모가 공통으로 사용한 기간을 기준", "개시 시점에 생후 18개월 이내", "겹치지 않아도 적용".
   - 급여 요건: 고용보험법 제70조 제1항 — 육아휴직 30일 이상(단기 육아휴직은 7일 이상), 시작 전 피보험 단위기간 합산 180일. 제2항 — 시작 1개월 뒤부터 끝난 뒤 12개월 안 신청.
   - 육아기 근로시간 단축 급여: 고용보험법 시행령 제104조의2(2026.1.1.부터 상한 250만·160만, 하한 50만).
   - 배우자 출산전후휴가: 남녀고용평등법 제18조의2(20일 유급, 예정일 50일 전~출산 후 120일, 3회 분할). 급여 상한 20일 1,684,210원 · 1일 84,210원(고용노동부 2026).
   - 대상 기간: 남녀고용평등법 제19조(만 8세 이하 또는 초2 이하) · 제19조의2(만 12세 이하 또는 초6 이하). 시행령 제11조(30일 전 신청). 고용보험법 제70조(시작 1개월 뒤~끝난 뒤 12개월 안 신청). */
(function (root) {
  'use strict';
  const RULES = {
    checkedAt: '2026-11-04',
    leave: {
      floor: 700000,
      general: [{ to: 3, rate: 1, cap: 2500000 }, { to: 6, rate: 1, cap: 2000000 }, { to: Infinity, rate: 0.8, cap: 1600000 }],
      single: [{ to: 3, rate: 1, cap: 3000000 }, { to: 6, rate: 1, cap: 2000000 }, { to: Infinity, rate: 0.8, cap: 1600000 }],
      both: [2500000, 2500000, 3000000, 3500000, 4000000, 4500000],
      minDays: 30, shortMinDays: 7, maxMonths: 18, baseMonths: 12, applyBeforeDays: 30
    },
    reduce: { firstHours: 10, firstCap: 2500000, restCap: 1600000, floor: 500000, restRate: 0.8, afterMin: 15, afterMax: 35, baseMonths: 12, maxMonths: 36 },
    paternity: { days: 20, dailyCap: 84210, fullCap: 1684210, hoursPerDay: 8, monthlyHours: 209, beforeDue: 50, afterBirth: 120, splits: 3, minHourly: 10320 }   // 하한 = 최저임금(2026년 시급 10,320원, 정부24 "지급 금액 하한: 최저임금액")
  };

  // ----- 날짜(시간대 영향이 없도록 'YYYY-MM-DD' 문자열과 UTC만 쓴다) -----
  const DAY = 86400000;
  const pad = n => String(n).padStart(2, '0');
  function parse(s) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
    if (!m) return null;
    const t = Date.UTC(+m[1], +m[2] - 1, +m[3]);
    const d = new Date(t);
    return d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3] ? t : null;
  }
  function fmt(t) { const d = new Date(t); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); }
  function addDays(s, n) { const t = parse(s); return t == null ? '' : fmt(t + n * DAY); }
  function addMonths(s, n) {
    const t = parse(s); if (t == null) return '';
    const d = new Date(t), y = d.getUTCFullYear(), m = d.getUTCMonth() + n, day = d.getUTCDate();
    const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    return fmt(Date.UTC(y, m, Math.min(day, last)));
  }
  const addYears = (s, n) => addMonths(s, n * 12);
  const daysBetween = (a, b) => Math.round((parse(b) - parse(a)) / DAY) + 1;   // 양 끝 포함
  const lastFeb = y => fmt(Date.UTC(y, 2, 0));
  const later = (a, b) => (a > b ? a : b);
  const yearOf = s => +String(s).slice(0, 4);

  // ----- 육아휴직 급여 -----
  function leaveBand(month, mode) {
    const list = mode === 'single' ? RULES.leave.single : RULES.leave.general;
    return list.find(b => month <= b.to);
  }
  // 한 달 몫(1개월을 다 채웠을 때). month = 1부터, common = 6+6을 적용할 공통 개월 수
  function leaveMonthly(ordinary, month, mode, common) {
    let rate, cap, special = false;
    if (mode === 'both' && month <= Math.min(common || 0, 6)) { rate = 1; cap = RULES.leave.both[month - 1]; special = true; }
    else { const b = leaveBand(month, mode); rate = b.rate; cap = b.cap; }
    const raw = ordinary * rate;
    const amount = Math.max(Math.min(raw, cap), RULES.leave.floor);
    return { amount, rate, cap, special, atFloor: raw < RULES.leave.floor, atCap: raw > cap };
  }
  // 시작일부터 한 달씩 끊는다. 마지막 조각이 한 달을 못 채우면 그 기간 일수에 비례(제95조 제3항)
  function monthlyPeriods(start, end) {
    const out = [];
    if (parse(start) == null || parse(end) == null || end < start) return out;
    for (let i = 0; i < 240; i++) {
      const from = addMonths(start, i);
      if (from > end) break;
      const fullTo = addDays(addMonths(start, i + 1), -1);
      const to = end < fullTo ? end : fullTo;
      out.push({ no: i + 1, from, to, days: daysBetween(from, to), span: daysBetween(from, fullTo), full: to === fullTo });
    }
    return out;
  }
  // opts: {ordinary(원), start, end, mode:'general'|'both'|'single', spouseMonths, spouseLeave(배우자가 육아휴직을 쓸 수 있으면 true, 기본 true), usedMonths(같은 자녀로 앞서 쓴 개월), companyPay(원/월)}
  function leaveBenefit(opts) {
    const ordinary = Math.max(0, Math.floor(+opts.ordinary || 0));
    const mode = opts.mode === 'both' || opts.mode === 'single' ? opts.mode : 'general';
    const company = Math.max(0, Math.floor(+opts.companyPay || 0));
    const spouseLeave = opts.spouseLeave !== false;
    const used = Math.max(0, Math.floor(+opts.usedMonths || 0));
    const periods = monthlyPeriods(opts.start, opts.end);
    const fullMonths = periods.filter(p => p.full).length;
    const common = mode === 'both' && spouseLeave ? Math.min(6, used + fullMonths, Math.max(0, Math.floor(+opts.spouseMonths || 0))) : 0;
    let total = 0, deducted = 0;
    const rows = periods.map(p => {
      const no = p.no + used;                           // 나눠 쓰면 앞서 쓴 달에 이어서 센다(제95조 제2항)
      const m = leaveMonthly(ordinary, no, mode, common);
      const ratio = p.full ? 1 : p.days / p.span;
      const base = Math.floor(m.amount * ratio);
      const limit = Math.floor(ordinary * ratio);       // 제98조: 금품 + 급여가 통상임금(일수 비례)을 넘으면 넘는 만큼 뺀다
      const cut = company > 0 ? Math.max(0, Math.min(base, company + base - limit)) : 0;
      const paid = base - cut;
      total += paid; deducted += cut;
      return { no, from: p.from, to: p.to, days: p.days, span: p.span, full: p.full, rate: m.rate, cap: m.cap, special: m.special, atFloor: m.atFloor, base, cut, paid };
    });
    const days = periods.reduce((s, p) => s + p.days, 0);
    const warnings = [];
    if (!ordinary) warnings.push('pay');                   // 통상임금 0이면 하한 70만원으로 계산되어 버리니 화면은 결과를 숨긴다
    if (!periods.length) warnings.push('dates');
    else {
      if (days < RULES.leave.minDays && !used) warnings.push('short');
      if (used + periods.length > RULES.leave.maxMonths) warnings.push('over18');
      else if (used + fullMonths > RULES.leave.baseMonths || (used + fullMonths === RULES.leave.baseMonths && periods.length > fullMonths)) warnings.push('over12');
      if (mode === 'both' && !spouseLeave) warnings.push('spouseNoLeave');
      else if (mode === 'both' && common < 1) warnings.push('noCommon');
    }
    return {
      ordinary, mode, common, spouseLeave, used, rows, total, deducted, days, months: periods.length, fullMonths, warnings,
      applyBy: periods.length ? addDays(opts.start, -RULES.leave.applyBeforeDays) : '',
      claimFrom: periods.length ? addMonths(opts.start, 1) : '',
      claimTo: periods.length ? addMonths(opts.end, 12) : ''
    };
  }

  // ----- 육아기 근로시간 단축 급여(제104조의2) -----
  // opts: {ordinary(원), before(단축 전 주 소정시간), after(단축 후), months, lastDays(마지막 달이 한 달을 못 채우면 그 일수, 선택)}
  function reduceBenefit(opts) {
    const R = RULES.reduce;
    const ordinary = Math.max(0, Math.floor(+opts.ordinary || 0));
    const before = +opts.before || 0, after = +opts.after || 0, months = Math.max(1, Math.floor(+opts.months || R.baseMonths));
    const lastDays = Math.min(30, Math.max(0, Math.floor(+opts.lastDays || 0)));   // 0이면 모든 달이 온달
    const cut = before - after;
    const warnings = [];
    if (!ordinary) warnings.push('pay');
    if (before <= 0 || cut <= 0) warnings.push('hours');
    if (after < R.afterMin || after > R.afterMax) warnings.push('range');
    if (months > R.maxMonths) warnings.push('over36');
    if (before <= 0 || cut <= 0) return { ordinary, before, after, cut: 0, months, first: 0, rest: 0, gov: 0, wage: ordinary, monthly: ordinary, totalGov: 0, lost: 0, warnings };
    const firstHours = Math.min(R.firstHours, cut), restHours = Math.max(0, cut - R.firstHours);
    const firstBase = Math.max(Math.min(ordinary, R.firstCap), R.floor);
    const restBase = Math.max(Math.min(ordinary * R.restRate, R.restCap), R.floor);
    const first = Math.floor(firstBase * firstHours / before);
    const rest = restHours > 0 ? Math.floor(restBase * restHours / before) : 0;
    const wage = Math.floor(ordinary * after / before);     // 회사 임금: 일한 시간에 비례한다고 본 어림값
    const over = Math.max(0, wage + first + rest - ordinary);   // 임금 + 급여가 통상임금을 넘으면 넘는 만큼 뺀다(찾기쉬운 생활법령 '감액')
    const gov = Math.max(0, first + rest - over);
    // 한 달을 못 채운 마지막 달은 그 달의 일수로 나눈다(제104조의2 제2항). 어느 달인지 모르니 많게 나오지 않도록 31일로 나눈 어림값이다
    const lastGov = lastDays ? Math.floor(gov * lastDays / 31) : gov;
    const totalGov = lastDays ? gov * (months - 1) + lastGov : gov * months;
    return { ordinary, before, after, cut, months, lastDays, firstHours, restHours, firstBase, restBase, first, rest, reduced: over, gov, lastGov, wage, monthly: wage + gov, totalGov, lost: ordinary - wage - gov, warnings };
  }

  // ----- 배우자 출산전후휴가 -----
  // opts: {ordinary(원), days(기본 20), priority(우선지원대상기업이면 true), monthlyHours(기본 209)}
  function paternityPay(opts) {
    const P = RULES.paternity;
    const ordinary = Math.max(0, Math.floor(+opts.ordinary || 0));
    const days = Math.min(P.days, Math.max(1, Math.floor(+opts.days || P.days)));
    const hours = +opts.monthlyHours > 0 ? +opts.monthlyHours : P.monthlyHours;
    const daily = ordinary / hours * P.hoursPerDay;
    const total = Math.floor(daily * days);
    const capAll = days === P.days ? P.fullCap : P.dailyCap * days;
    const floorAll = P.minHourly * P.hoursPerDay * days;         // 통상임금이 최저임금보다 낮아도 정부 급여는 최저임금만큼은 준다
    const gov = opts.priority ? Math.max(Math.min(total, capAll), floorAll) : 0;
    return { ordinary, days, daily: Math.floor(daily), total, gov, company: Math.max(0, total - gov), capAll, floorAll, atFloor: opts.priority && total < floorAll, warnings: ordinary ? [] : ['pay'] };
  }

  // ----- 내 아이 기준 날짜 -----
  // opts: {birth:'YYYY-MM-DD'(태어난 날), due:'YYYY-MM-DD'(출산 예정일)} — 둘 다 있으면 예정일로 휴가 시작, 태어난 날로 휴가 끝
  function childDates(opts) {
    const birth = parse(opts.birth) != null ? opts.birth : '', due = parse(opts.due) != null ? opts.due : '';
    const P = RULES.paternity, out = { birth, due };
    if (due) out.paternityFrom = addDays(due, -P.beforeDue);   // 예정일을 알 때만. 태어난 날에서 거꾸로 세면 조문과 다른 날이 된다(11-04 재검토)
    const base = birth || due;
    if (base) out.paternityTo = addDays(base, P.afterBirth);
    if (base) {
      out.bothStartBy = addDays(addMonths(base, 18), -1);                                    // 6+6: 휴직을 시작해야 하는 마지막 날(고용노동부 예시 24.12.5생 → 26.6.4.)
      out.leaveAgeEnd = addDays(addYears(base, 9), -1);                                      // 만 8세 이하 = 만 9세 생일 전날까지
      out.leaveGradeEnd = lastFeb(yearOf(base) + 9);                                         // 초2 이하 = 7년 뒤 3월 입학 기준 초2의 끝
      out.leaveStartBy = later(out.leaveAgeEnd, out.leaveGradeEnd);
      out.reduceAgeEnd = addDays(addYears(base, 13), -1);
      out.reduceGradeEnd = lastFeb(yearOf(base) + 13);
      out.reduceStartBy = later(out.reduceAgeEnd, out.reduceGradeEnd);
    }
    // 태어난 뒤 기한(검수 10). 예정일만 있으면 계산하지 않는다
    if (birth) {
      out.birthReportBy = addMonths(birth, 1);        // 출생신고: 출생 후 1개월 이내(가족관계등록법 제44조)
      out.parentPayBy = addDays(birth, 59);           // 부모급여: 출생일을 포함해 60일 안에 신청하면 태어난 달부터(복지부, 60일째가 토·일·공휴일이면 다음 날까지)
      out.bcgBy = addDays(birth, 28);                 // BCG: 생후 4주 이내
      out.check1From = addDays(birth, 14);            // 영유아 건강검진 1차: 생후 14~35일
      out.check1To = addDays(birth, 35);
      out.firstVoucherBy = addYears(birth, 2);        // 첫만남이용권: 2년 안에 신청·사용(2024년 이후 출생아)
    }
    return out;
  }

  const api = { RULES, leaveMonthly, monthlyPeriods, leaveBenefit, reduceBenefit, paternityPay, childDates, addDays, addMonths, addYears, parse, fmt };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.YK_CALC = api;
})(typeof window !== 'undefined' ? window : this);
