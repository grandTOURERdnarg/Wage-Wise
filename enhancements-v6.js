import { calculatePay, projectIncomeAndPension } from './core.js';

const $ = id => document.getElementById(id);
const q = (selector, root = document) => root.querySelector(selector);
const qa = (selector, root = document) => [...root.querySelectorAll(selector)];
const num = id => Number($(id)?.value) || 0;
const money = value => new Intl.NumberFormat('en-GB', {
  style: 'currency', currency: 'GBP', maximumFractionDigits: 0
}).format(Number.isFinite(Number(value)) ? Number(value) : 0);

let pensionRangeV6 = 'retirement';

function gatherPayInput() {
  return {
    payType: $('payType').value,
    payAmount: num('payAmount'),
    payFrequency: $('payFrequency').value,
    hoursPerWeek: num('hoursPerWeek'),
    daysPerWeek: num('daysPerWeek'),
    paidWeeks: num('paidWeeks'),
    overtimeHours: num('overtimeHours'),
    overtimeRate: num('overtimeRate'),
    overtimeWeeks: num('overtimeWeeks'),
    leaveWeeks: num('leaveWeeks'),
    leavePaid: $('leavePaid').value === 'yes',
    expenses: {
      housing: num('expHousing'), councilTax: num('expCouncilTax'), utilities: num('expUtilities'),
      food: num('expFood'), transport: num('expTransport'), living: num('expLiving'), debt: num('expDebt'),
      finance: num('expFinance'), subscriptions: num('expSubscriptions'), optional: num('expOptional'), other: num('expOther')
    }
  };
}

function gatherProjectionSettings() {
  return {
    pensionSchemeType: $('pensionSchemeType').value,
    pensionBasis: $('pensionBasis').value,
    pensionablePay: num('pensionablePay'),
    pensionMethod: $('pensionMethod').value,
    employeePensionPct: num('employeePensionPct'),
    employerPensionPct: num('employerPensionPct'),
    currentPension: num('currentPension'),
    currentAge: num('currentAge'),
    retirementAge: num('retirementAge'),
    pensionGrowthPct: num('pensionGrowthPct'),
    pensionFeePct: num('pensionFeePct'),
    desiredRetirementIncome: num('desiredRetirementIncome'),
    statePensionAnnual: num('statePensionAnnual'),
    includeStatePension: num('statePensionAnnual') > 0,
    drawdownPct: num('drawdownPct'),
    wageGrowthPct: num('wageGrowthPct'),
    expenseGrowthPct: num('expenseGrowthPct'),
    overtimeGrowthPct: num('overtimeGrowthPct'),
    inflationPct: num('inflationPct'),
    projectionYears: Math.max(10, num('retirementAge') - num('currentAge'))
  };
}

function getProjection() {
  const payInput = gatherPayInput();
  const pay = calculatePay(payInput);
  const projection = projectIncomeAndPension(payInput, gatherProjectionSettings());
  return pay.valid && projection.valid ? projection : null;
}

function buildPensionYearView() {
  const panel = q('[data-panel="pension"]');
  if (!panel || $('pensionYearViewV6')) return;

  const section = document.createElement('section');
  section.id = 'pensionYearViewV6';
  section.className = 'pension-year-view-v6';
  section.innerHTML = `
    <header class="pension-year-head-v6">
      <div>
        <p class="eyebrow">Year-by-year pension</p>
        <h3>See what your pension could be worth after each year of work.</h3>
        <p>Each point is the estimated balance at the end of that year.</p>
      </div>
      <label>Show
        <select id="pensionRangeV6">
          <option value="5">First 5 years</option>
          <option value="10">First 10 years</option>
          <option value="20">First 20 years</option>
          <option value="retirement" selected>Until retirement</option>
        </select>
      </label>
    </header>
    <div class="pension-key-v6">
      <article><span>After 1 year</span><strong id="pensionAfter1V6">—</strong></article>
      <article><span>After 5 years</span><strong id="pensionAfter5V6">—</strong></article>
      <article class="pension-key-main-v6"><span>At retirement</span><strong id="pensionAtRetirementV6">—</strong></article>
    </div>
    <div id="pensionAnnualChartV6" class="pension-annual-chart-v6" aria-live="polite"></div>
    <div class="annual-strip-head-v6"><strong>Every year</strong><span>Scroll sideways to compare annual balances</span></div>
    <div id="pensionAnnualStripV6" class="pension-annual-strip-v6"></div>
    <p id="pensionModelNoteV6" class="pension-model-note-v6"></p>`;

  const firstCard = q('.input-card', panel);
  if (firstCard) firstCard.before(section);
  else q('.panel-heading', panel)?.after(section);

  $('pensionRangeV6').addEventListener('change', () => {
    pensionRangeV6 = $('pensionRangeV6').value;
    renderPensionYearView();
  });
}

function selectedRows(projection) {
  const currentAge = num('currentAge');
  const starting = { year: 0, pensionBalance: num('currentPension'), age: currentAge };
  const full = [starting, ...projection.rows.map(row => ({
    ...row,
    age: currentAge + row.year
  }))];
  if (pensionRangeV6 === 'retirement') return full;
  return full.slice(0, Math.min(Number(pensionRangeV6) + 1, full.length));
}

function compact(value) {
  const amount = Math.abs(value);
  if (amount >= 1_000_000) return `£${(amount / 1_000_000).toFixed(1)}m`;
  if (amount >= 1_000) return `£${Math.round(amount / 1_000)}k`;
  return `£${Math.round(amount)}`;
}

function renderPensionChart(rows) {
  const target = $('pensionAnnualChartV6');
  if (!target || !rows.length) return;

  const width = 980;
  const height = 390;
  const pad = { l: 68, r: 26, t: 34, b: 54 };
  const values = rows.map(row => Math.max(0, Number(row.pensionBalance) || 0));
  const max = Math.max(...values, 1);
  const x = index => rows.length === 1 ? width / 2 : pad.l + index * (width - pad.l - pad.r) / (rows.length - 1);
  const y = value => pad.t + (max - value) / max * (height - pad.t - pad.b);
  const points = rows.map((row, index) => [x(index), y(values[index])]);
  const path = points.map((point, index) => `${index ? 'L' : 'M'} ${point[0]} ${point[1]}`).join(' ');
  const area = `${path} L ${points.at(-1)[0]} ${height - pad.b} L ${points[0][0]} ${height - pad.b} Z`;

  let svg = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Estimated pension balance after every year of work">
    <defs>
      <linearGradient id="pensionAreaV6" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#5d38d4" stop-opacity=".36"/>
        <stop offset="100%" stop-color="#5d38d4" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="pensionLineV6" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#1557d5"/>
        <stop offset="55%" stop-color="#5d38d4"/>
        <stop offset="100%" stop-color="#34765a"/>
      </linearGradient>
    </defs>`;

  for (let i = 0; i < 5; i += 1) {
    const yy = pad.t + i * (height - pad.t - pad.b) / 4;
    const amount = max - i * max / 4;
    svg += `<line x1="${pad.l}" y1="${yy}" x2="${width - pad.r}" y2="${yy}" class="pension-grid-v6"/>
      <text x="6" y="${yy + 4}" class="pension-axis-v6">${compact(amount)}</text>`;
  }

  svg += `<path d="${area}" fill="url(#pensionAreaV6)"/>
    <path d="${path}" fill="none" stroke="url(#pensionLineV6)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`;

  const labelEvery = Math.max(1, Math.ceil(rows.length / 8));
  rows.forEach((row, index) => {
    const [cx, cy] = points[index];
    const milestone = index === 0 || index === rows.length - 1 || row.year === 5 || row.year === 10 || row.year === 20;
    svg += `<circle cx="${cx}" cy="${cy}" r="${milestone ? 6 : 3.3}" class="${milestone ? 'pension-point-major-v6' : 'pension-point-v6'}">
      <title>End of year ${row.year}, age ${row.age}: ${money(row.pensionBalance)}</title>
    </circle>`;
    if (index % labelEvery === 0 || index === rows.length - 1) {
      svg += `<text x="${cx}" y="${height - 18}" text-anchor="middle" class="pension-axis-v6">Age ${row.age}</text>`;
    }
    if (milestone && row.year > 0) {
      svg += `<g class="pension-callout-v6"><rect x="${Math.min(width - 122, Math.max(4, cx - 50))}" y="${Math.max(8, cy - 38)}" width="100" height="25" rx="12"/>
        <text x="${Math.min(width - 72, Math.max(54, cx))}" y="${Math.max(25, cy - 21)}" text-anchor="middle">${money(row.pensionBalance)}</text></g>`;
    }
  });

  svg += '</svg>';
  target.innerHTML = svg;
}

function renderPensionStrip(rows) {
  const strip = $('pensionAnnualStripV6');
  if (!strip) return;
  strip.innerHTML = rows.map(row => `
    <article class="annual-card-v6 ${row.year === 0 ? 'start' : ''}">
      <span>${row.year === 0 ? 'Starting point' : `End of year ${row.year}`}</span>
      <strong>${money(row.pensionBalance)}</strong>
      <small>Age ${row.age}</small>
    </article>`).join('');
}

function renderPensionYearView() {
  const projection = getProjection();
  if (!projection || !$('pensionYearViewV6')) return;
  const rows = selectedRows(projection);
  const allRows = [{ year: 0, pensionBalance: num('currentPension'), age: num('currentAge') }, ...projection.rows.map(row => ({ ...row, age: num('currentAge') + row.year }))];
  const after1 = allRows.find(row => row.year === 1) || allRows.at(-1);
  const after5 = allRows.find(row => row.year === 5) || allRows.at(-1);
  const retirement = allRows.at(-1);

  $('pensionAfter1V6').textContent = money(after1?.pensionBalance || 0);
  $('pensionAfter5V6').textContent = money(after5?.pensionBalance || 0);
  $('pensionAtRetirementV6').textContent = money(retirement?.pensionBalance || 0);
  renderPensionChart(rows);
  renderPensionStrip(rows);

  const definedBenefit = $('pensionSchemeType').value === 'definedBenefit';
  $('pensionModelNoteV6').textContent = definedBenefit
    ? 'Defined-benefit pension selected: this is only an illustrative balance-style projection, not the value of your guaranteed scheme pension. Use your scheme statement for the real annual benefit.'
    : 'Estimate only. It uses the wage growth, contribution, investment-growth and fee assumptions entered above.';
  $('pensionModelNoteV6').classList.toggle('warning', definedBenefit);
}

function simplifyFuturePensionView() {
  const metric = $('futureMetricV5');
  if (!metric || metric.value !== 'pension') return;
  const projection = getProjection();
  if (!projection) return;
  const activeRange = q('[data-future-range].active')?.dataset.futureRange || '5';
  const currentAge = num('currentAge');
  const fullRows = [{ year: 0, pensionBalance: num('currentPension'), age: currentAge }, ...projection.rows.map(row => ({ ...row, age: currentAge + row.year }))];
  const rows = activeRange === 'retirement' ? fullRows : fullRows.slice(0, Math.min(Number(activeRange) + 1, fullRows.length));
  const chart = $('futureChartV5');
  if (!chart) return;
  chart.classList.add('future-pension-replaced-v6');
  renderPensionChartInto(chart, rows);
  $('pensionLinesV5')?.classList.add('hidden');
}

function renderPensionChartInto(target, rows) {
  const width = 900;
  const height = 340;
  const pad = { l: 64, r: 22, t: 30, b: 46 };
  const values = rows.map(row => Math.max(0, Number(row.pensionBalance) || 0));
  const max = Math.max(...values, 1);
  const x = index => rows.length === 1 ? width / 2 : pad.l + index * (width - pad.l - pad.r) / (rows.length - 1);
  const y = value => pad.t + (max - value) / max * (height - pad.t - pad.b);
  const points = rows.map((row, index) => [x(index), y(values[index])]);
  const path = points.map((point, index) => `${index ? 'L' : 'M'} ${point[0]} ${point[1]}`).join(' ');
  const area = `${path} L ${points.at(-1)[0]} ${height - pad.b} L ${points[0][0]} ${height - pad.b} Z`;
  const every = Math.max(1, Math.ceil(rows.length / 7));

  let svg = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Estimated pension value after each year">
    <defs><linearGradient id="futurePensionAreaV6" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#5d38d4" stop-opacity=".35"/><stop offset="100%" stop-color="#5d38d4" stop-opacity="0"/></linearGradient></defs>`;
  for (let i = 0; i < 5; i += 1) {
    const yy = pad.t + i * (height - pad.t - pad.b) / 4;
    svg += `<line x1="${pad.l}" y1="${yy}" x2="${width - pad.r}" y2="${yy}" class="pension-grid-v6"/><text x="4" y="${yy + 4}" class="pension-axis-v6">${compact(max - i * max / 4)}</text>`;
  }
  svg += `<path d="${area}" fill="url(#futurePensionAreaV6)"/><path d="${path}" fill="none" stroke="#5d38d4" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`;
  rows.forEach((row, index) => {
    const [cx, cy] = points[index];
    svg += `<circle cx="${cx}" cy="${cy}" r="4" class="pension-point-major-v6"><title>End of year ${row.year}: ${money(row.pensionBalance)}</title></circle>`;
    if (index % every === 0 || index === rows.length - 1) svg += `<text x="${cx}" y="${height - 15}" text-anchor="middle" class="pension-axis-v6">Y${row.year}</text>`;
  });
  svg += '</svg>';
  target.innerHTML = svg + '<p class="future-pension-caption-v6">Estimated pension balance at the end of each year.</p>';
}

function wirePensionUpdates() {
  const rerender = () => setTimeout(() => {
    renderPensionYearView();
    simplifyFuturePensionView();
  }, 80);

  [$('calculateButton'), ...qa('.recalculate')].filter(Boolean).forEach(button => button.addEventListener('click', rerender));
  ['employeePensionPct','employerPensionPct','currentPension','currentAge','retirementAge','pensionGrowthPct','pensionFeePct','wageGrowthPct','pensionSchemeType'].forEach(id => {
    $(id)?.addEventListener('input', () => {
      const status = $('resultStatus');
      if (status) status.textContent = 'Pension inputs changed. Press Update calculation to refresh the projection.';
    });
  });
  $('futureMetricV5')?.addEventListener('change', () => setTimeout(simplifyFuturePensionView, 40));
  qa('[data-future-range]').forEach(button => button.addEventListener('click', () => setTimeout(simplifyFuturePensionView, 40)));
}

function init() {
  buildPensionYearView();
  wirePensionUpdates();
  renderPensionYearView();
  simplifyFuturePensionView();
}

init();
