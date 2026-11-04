/* 육아맨 계산기(2026-11-04, 앱개발부). 화면 없는 순수 계산만 둔다(test/calc-test.js로 시험).
   기준은 2026-11-04에 국가법령정보센터 원문으로 확인했다. 법이 바뀌면 RULES만 고치고 시험을 다시 돌린다.
   - 육아휴직 급여: 고용보험법 시행령 제95조(일반) · 제95조의3(부모 모두 18개월 특례 = 6+6, 한부모) · 제98조(회사 금품 감액). [시행 2026.9.18.]
     6+6은 제95조의3 제1항 "피보험자인 부모가 모두 육아휴직을 하는 경우"에만 — 배우자가 고용보험 피보험자가 아니면(공무원·자영업·전업주부) 일반 기준(opts.spouseInsured = false, 11-04 검수 2).
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
    paternity: { days: 20, dailyCap: 84210, fullCap: 1684210, hoursPerDay: 8, monthlyHours: 209, beforeDue: 50, afterBirth: 120, splits: 3 }
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
  // opts: {ordinary(원), start, end, mode:'general'|'both'|'single', spouseMonths, spouseInsured(기본 true), companyPay(원/월)}
  function leaveBenefit(opts) {
    const ordinary = Math.max(0, Math.floor(+opts.ordinary || 0));
    const mode = opts.mode === 'both' || opts.mode === 'single' ? opts.mode : 'general';
    const company = Math.max(0, Math.floor(+opts.companyPay || 0));
    const insured = opts.spouseInsured !== false;         // 6+6은 부모 모두 피보험자일 때만(제95조의3 제1항)
    const periods = monthlyPeriods(opts.start, opts.end);
    const fullMonths = periods.filter(p => p.full).length;
    const common = mode === 'both' && insured ? Math.min(6, fullMonths, Math.max(0, Math.floor(+opts.spouseMonths || 0))) : 0;
    let total = 0, deducted = 0;
    const rows = periods.map(p => {
      const m = leaveMonthly(ordinary, p.no, mode, common);
      const ratio = p.full ? 1 : p.days / p.span;
      const base = Math.floor(m.amount * ratio);
      const limit = Math.floor(ordinary * ratio);       // 제98조: 금품 + 급여가 통상임금(일수 비례)을 넘으면 넘는 만큼 뺀다
      const cut = company > 0 ? Math.max(0, Math.min(base, company + base - limit)) : 0;
      const paid = base - cut;
      total += paid; deducted += cut;
      return { no: p.no, from: p.from, to: p.to, days: p.days, span: p.span, full: p.full, rate: m.rate, cap: m.cap, special: m.special, atFloor: m.atFloor, base, cut, paid };
    });
    const days = periods.reduce((s, p) => s + p.days, 0);
    const warnings = [];
    if (!ordinary) warnings.push('pay');                   // 통상임금 0이면 하한 70만원으로 계산되어 버리니 화면은 결과를 숨긴다
    if (!periods.length) warnings.push('dates');
    else {
      if (days < RULES.leave.minDays) warnings.push('short');
      if (periods.length > RULES.leave.maxMonths || (periods.length === RULES.leave.maxMonths && !periods[periods.length - 1].full && false)) warnings.push('over18');
      else if (fullMonths > RULES.leave.baseMonths || (fullMonths === RULES.leave.baseMonths && periods.length > fullMonths)) warnings.push('over12');
      if (mode === 'both' && !insured) warnings.push('spouseNotInsured');
      else if (mode === 'both' && common < 1) warnings.push('noCommon');
    }
    return {
      ordinary, mode, common, insured, rows, total, deducted, days, months: periods.length, fullMonths, warnings,
      applyBy: periods.length ? addDays(opts.start, -RULES.leave.applyBeforeDays) : '',
      claimFrom: periods.length ? addMonths(opts.start, 1) : '',
      claimTo: periods.length ? addMonths(opts.end, 12) : ''
    };
  }

  // ----- 육아기 근로시간 단축 급여(제104조의2) -----
  // opts: {ordinary(원), before(단축 전 주 소정시간), after(단축 후), months}
  function reduceBenefit(opts) {
    const R = RULES.reduce;
    const ordinary = Math.max(0, Math.floor(+opts.ordinary || 0));
    const before = +opts.before || 0, after = +opts.after || 0, months = Math.max(1, Math.floor(+opts.months || R.baseMonths));
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
    return { ordinary, before, after, cut, months, firstHours, restHours, firstBase, restBase, first, rest, reduced: over, gov, wage, monthly: wage + gov, totalGov: gov * months, lost: ordinary - wage - gov, warnings };
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
    const gov = opts.priority ? Math.min(total, capAll) : 0;
    return { ordinary, days, daily: Math.floor(daily), total, gov, company: total - gov, capAll, warnings: ordinary ? [] : ['pay'] };
  }

  // ----- 내 아이 기준 날짜 -----
  // opts: {birth:'YYYY-MM-DD'(태어난 날), due:'YYYY-MM-DD'(출산 예정일)} — 둘 다 있으면 예정일로 휴가 시작, 태어난 날로 휴가 끝
  function childDates(opts) {
    const birth = parse(opts.birth) != null ? opts.birth : '', due = parse(opts.due) != null ? opts.due : '';
    const P = RULES.paternity, out = { birth, due };
    if (due || birth) out.paternityFrom = addDays(due || birth, -P.beforeDue);
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
    return out;
  }

  const api = { RULES, leaveMonthly, monthlyPeriods, leaveBenefit, reduceBenefit, paternityPay, childDates, addDays, addMonths, addYears, parse, fmt };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.YK_CALC = api;
})(typeof window !== 'undefined' ? window : this);
