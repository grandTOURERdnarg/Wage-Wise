import { CONFIG, calculatePay, projectIncomeAndPension } from './core.js';

const $ = id => document.getElementById(id);
const q = (selector, root = document) => root.querySelector(selector);
const qa = (selector, root = document) => [...root.querySelectorAll(selector)];
const n = id => Number($(id)?.value) || 0;
const cash = (amount, digits = 0) => new Intl.NumberFormat('en-GB', {
  style: 'currency', currency: 'GBP', minimumFractionDigits: digits, maximumFractionDigits: digits
}).format(Number.isFinite(Number(amount)) ? Number(amount) : 0);
const pc = amount => `${Number.isFinite(Number(amount)) ? Number(amount).toFixed(1) : '0.0'}%`;

let selectedPeriod = 'month';
let selectedFocus = 'pay';
let selectedFutureMetric = 'net';
let selectedFutureRange = 5;

function setOriginal(id, value) {
  if (!$(id)) return;
  $(id).value = Number.isFinite(Number(value)) ? Number(value) : value;
  $(id).dispatchEvent(new Event('input', { bubbles: true }));
}

function gatherPay() {
  return {
    payType: $('payType').value,
    payAmount: n('payAmount'),
    payFrequency: $('payFrequency').value,
    hoursPerWeek: n('hoursPerWeek'),
    daysPerWeek: n('daysPerWeek'),
    paidWeeks: n('paidWeeks'),
    overtimeHours: n('overtimeHours'),
    overtimeRate: n('overtimeRate'),
    overtimeWeeks: n('overtimeWeeks'),
    leaveWeeks: n('leaveWeeks'),
    leavePaid: $('leavePaid').value === 'yes',
    expenses: {
      housing: n('expHousing'), councilTax: n('expCouncilTax'), utilities: n('expUtilities'),
      food: n('expFood'), transport: n('expTransport'), living: n('expLiving'), debt: n('expDebt'),
      finance: n('expFinance'), subscriptions: n('expSubscriptions'), optional: n('expOptional'), other: n('expOther')
    }
  };
}

function gatherProjection() {
  return {
    pensionSchemeType: $('pensionSchemeType').value,
    pensionBasis: $('pensionBasis').value,
    pensionablePay: n('pensionablePay'),
    pensionMethod: $('pensionMethod').value,
    employeePensionPct: n('employeePensionPct'),
    employerPensionPct: n('employerPensionPct'),
    currentPension: n('currentPension'),
    currentAge: n('currentAge'),
    retirementAge: n('retirementAge'),
    pensionGrowthPct: n('pensionGrowthPct'),
    pensionFeePct: n('pensionFeePct'),
    desiredRetirementIncome: n('desiredRetirementIncome'),
    statePensionAnnual: n('statePensionAnnual'),
    includeStatePension: n('statePensionAnnual') > 0,
    drawdownPct: n('drawdownPct'),
    wageGrowthPct: n('wageGrowthPct'),
    expenseGrowthPct: n('expenseGrowthPct'),
    overtimeGrowthPct: n('overtimeGrowthPct'),
    inflationPct: n('inflationPct'),
    projectionYears: Math.max(10, n('projectionYears'))
  };
}

function currentData() {
  const payInput = gatherPay();
  const pay = calculatePay(payInput);
  const projection = projectIncomeAndPension(payInput, gatherProjection());
  return pay.valid && projection.valid ? { pay, projection } : null;
}

function redesignOvertime() {
  const card = q('.income-extra-details .two-card-grid article:first-child');
  if (!card) return;
  card.classList.add('overtime-card-v5');
  const oldPreset = $('overtimePreset')?.closest('label');
  if (oldPreset) oldPreset.classList.add('legacy-overtime-v5');
  qa('.conditional-overtime', card).forEach(label => label.classList.add('legacy-overtime-v5'));

  const form = q('.form-grid', card);
  const chooser = document.createElement('div');
  chooser.className = 'overtime-builder-v5';
  chooser.innerHTML = `
    <label>How do you want to enter overtime?
      <select id="overtimeEntryMode">
        <option value="none">I do not receive overtime</option>
        <option value="weekly">I know roughly how much I receive each week</option>
        <option value="hours">Calculate it from hours and hourly rate</option>
        <option value="variable">My overtime varies</option>
      </select>
      <small>Only the fields needed for your choice will appear.</small>
    </label>
    <div id="overtimeWeeklyFields" class="overtime-mode-fields hidden">
      <label>Approximate overtime pay each week (£)<input id="overtimeWeeklyAmount" type="number" min="0" step="1" value="0"><small>Enter gross overtime before tax and NI.</small></label>
      <label>Weeks per year you normally receive it<input id="overtimeWeeklyWeeks" type="number" min="0" max="52" step="1" value="0"></label>
    </div>
    <div id="overtimeHoursFields" class="overtime-mode-fields hidden">
      <label>Overtime hours in a typical week<input id="overtimeHoursV5" type="number" min="0" max="80" step="0.5" value="0"></label>
      <label>Overtime hourly rate (£)<input id="overtimeRateV5" type="number" min="0" step="0.01" value="0"></label>
      <label>Weeks per year you normally work overtime<input id="overtimeWeeksV5" type="number" min="0" max="52" step="1" value="0"></label>
    </div>
    <div id="overtimeVariableFields" class="overtime-mode-fields hidden">
      <label>How would you like to estimate it?
        <select id="overtimeVariableMethod"><option value="weekly">Average weekly amount</option><option value="yearly">Estimated yearly total</option></select>
      </label>
      <label id="variableWeeklyLabel">Average overtime pay each week (£)<input id="overtimeVariableWeekly" type="number" min="0" step="1" value="0"></label>
      <label id="variableWeeksLabel">Approximate weeks receiving overtime<input id="overtimeVariableWeeks" type="number" min="0" max="52" step="1" value="0"></label>
      <label id="variableYearlyLabel" class="hidden">Estimated overtime total for the year (£)<input id="overtimeVariableYearly" type="number" min="0" step="10" value="0"></label>
    </div>
    <p id="overtimeNeutralMessage" class="neutral-note-v5">No overtime included.</p>`;
  form.prepend(chooser);

  const ids = ['overtimeEntryMode','overtimeWeeklyAmount','overtimeWeeklyWeeks','overtimeHoursV5','overtimeRateV5','overtimeWeeksV5','overtimeVariableMethod','overtimeVariableWeekly','overtimeVariableWeeks','overtimeVariableYearly'];
  ids.forEach(id => $(id)?.addEventListener('input', syncOvertime));
  $('overtimeEntryMode').addEventListener('change', syncOvertime);
  $('overtimeVariableMethod').addEventListener('change', syncOvertime);
  syncOvertime();
}

function syncOvertime() {
  const mode = $('overtimeEntryMode')?.value || 'none';
  ['overtimeWeeklyFields','overtimeHoursFields','overtimeVariableFields'].forEach(id => $(id)?.classList.add('hidden'));
  $('overtimeNeutralMessage')?.classList.toggle('hidden', mode !== 'none');
  if (mode === 'none') {
    setOriginal('overtimeHours', 0); setOriginal('overtimeRate', 0); setOriginal('overtimeWeeks', 0);
    return;
  }
  if (mode === 'weekly') {
    $('overtimeWeeklyFields').classList.remove('hidden');
    setOriginal('overtimeHours', 1);
    setOriginal('overtimeRate', n('overtimeWeeklyAmount'));
    setOriginal('overtimeWeeks', n('overtimeWeeklyWeeks'));
    return;
  }
  if (mode === 'hours') {
    $('overtimeHoursFields').classList.remove('hidden');
    setOriginal('overtimeHours', n('overtimeHoursV5'));
    setOriginal('overtimeRate', n('overtimeRateV5'));
    setOriginal('overtimeWeeks', n('overtimeWeeksV5'));
    return;
  }
  $('overtimeVariableFields').classList.remove('hidden');
  const method = $('overtimeVariableMethod').value;
  $('variableWeeklyLabel').classList.toggle('hidden', method !== 'weekly');
  $('variableWeeksLabel').classList.toggle('hidden', method !== 'weekly');
  $('variableYearlyLabel').classList.toggle('hidden', method !== 'yearly');
  if (method === 'weekly') {
    setOriginal('overtimeHours', 1);
    setOriginal('overtimeRate', n('overtimeVariableWeekly'));
    setOriginal('overtimeWeeks', n('overtimeVariableWeeks'));
  } else {
    setOriginal('overtimeHours', 1);
    setOriginal('overtimeRate', n('overtimeVariableYearly'));
    setOriginal('overtimeWeeks', n('overtimeVariableYearly') > 0 ? 1 : 0);
  }
}

function improveHeroCopy() {
  const heading = q('.hero-copy-v4 h1');
  const intro = q('.hero-copy-v4 > p:not(.eyebrow)');
  if (heading) heading.textContent = 'See where your pay goes — and what it could become.';
  if (intro) intro.textContent = 'Understand your take-home pay, monthly costs, pension and future income in minutes.';
  const closingHeading = q('.closing-v4 h2');
  const closingText = q('.closing-v4 > p:last-child');
  if (closingHeading) closingHeading.textContent = 'Make every payslip easier to understand.';
  if (closingText) closingText.textContent = 'Use Wage Wise to compare your pay today, your costs each month and the future you are building.';
}

function buildCompactResults() {
  const panel = q('[data-panel="results"]');
  if (!panel) return;
  panel.classList.add('results-v5');
  q('.panel-heading h2', panel).textContent = 'Your money, clearly.';
  const headingText = q('.panel-heading div > p:last-child', panel);
  if (headingText) headingText.textContent = 'Choose a period and one topic. The important figures stay at the top.';

  const compact = document.createElement('section');
  compact.className = 'compact-report-v5';
  compact.innerHTML = `
    <div class="period-control-v5" role="tablist" aria-label="Income period">
      ${[['hour','Hour'],['day','Day'],['week','Week'],['month','Month'],['year','Year'],['five','5 years'],['ten','10 years']].map(([key,label]) => `<button type="button" data-v5-period="${key}" class="${key === selectedPeriod ? 'active' : ''}">${label}</button>`).join('')}
    </div>
    <div class="main-result-v5">
      <div class="primary-result-v5"><span id="v5MainLabel">Take-home each month</span><strong id="v5MainValue">—</strong></div>
      <div class="support-result-v5"><span>Gross</span><strong id="v5GrossValue">—</strong></div>
      <div class="support-result-v5 positive"><span>After entered costs</span><strong id="v5RemainingValue">—</strong></div>
    </div>
    <div class="report-focus-v5">
      <label>Show me
        <select id="v5FocusSelect">
          <option value="pay">Pay summary</option><option value="tax">Tax and NI</option><option value="overtime">Overtime</option><option value="costs">Monthly costs</option><option value="pension">Pension</option><option value="future">Future outlook</option>
        </select>
      </label>
      <div id="v5FocusContent" class="focus-content-v5"></div>
    </div>
    <article class="period-visual-v5">
      <header><div><span>Pay-period comparison</span><strong id="v5PeriodChartTitle">Take-home income</strong></div><label>Compare<select id="v5PeriodMetric"><option value="net">Take-home</option><option value="gross">Gross</option><option value="remaining">After costs</option></select></label></header>
      <div id="v5PeriodChart" class="period-chart-simple-v5"></div>
    </article>`;
  const oldTabs = q('.period-tabs', panel);
  oldTabs.before(compact);

  qa('[data-v5-period]').forEach(button => button.addEventListener('click', () => {
    selectedPeriod = button.dataset.v5Period;
    qa('[data-v5-period]').forEach(item => item.classList.toggle('active', item === button));
    renderCompactResults();
  }));
  $('v5FocusSelect').addEventListener('change', () => { selectedFocus = $('v5FocusSelect').value; renderCompactResults(); });
  $('v5PeriodMetric').addEventListener('change', renderCompactResults);

  const moneyCard = q('.donut-grid .chart-card:first-child', panel);
  const chartHeading = q('.visual-heading', panel);
  if (moneyCard && chartHeading) {
    const wrapper = document.createElement('section');
    wrapper.className = 'single-money-chart-v5';
    wrapper.innerHTML = '<div><p class="eyebrow">Gross income</p><h3>Where your money goes</h3><p>One chart shows tax, NI, entered costs and what remains.</p></div>';
    wrapper.append(moneyCard);
    compact.after(wrapper);
  }
}

function periodData(pay, projection, period) {
  const sums = years => projection.rows.slice(0, Math.min(years, projection.rows.length)).reduce((out, row) => ({
    gross: out.gross + row.gross, net: out.net + row.net, remaining: out.remaining + row.remaining
  }), { gross: 0, net: 0, remaining: 0 });
  if (period === 'hour') return { label: 'Take-home per worked hour', gross: pay.grossHourly, net: pay.netHourly, remaining: pay.remainingHourly, digits: 2 };
  if (period === 'day') return { label: 'Take-home per working day', gross: pay.grossDaily, net: pay.netDaily, remaining: pay.remainingDaily, digits: 2 };
  if (period === 'week') return { label: 'Take-home per paid week', gross: pay.grossWeekly, net: pay.netWeekly, remaining: pay.remainingWeekly, digits: 2 };
  if (period === 'month') return { label: 'Take-home each month', gross: pay.grossMonthly, net: pay.netMonthly, remaining: pay.remainingMonth, digits: 0 };
  if (period === 'five') return { label: 'Take-home across 5 projected years', ...sums(5), digits: 0 };
  if (period === 'ten') return { label: 'Take-home across 10 projected years', ...sums(10), digits: 0 };
  return { label: 'Take-home each year', gross: pay.gross, net: pay.net, remaining: pay.remainingYear, digits: 0 };
}

function renderCompactResults() {
  const data = currentData();
  if (!data || !$('v5MainValue')) return;
  const { pay, projection } = data;
  const current = periodData(pay, projection, selectedPeriod);
  $('v5MainLabel').textContent = current.label;
  $('v5MainValue').textContent = cash(current.net, current.digits);
  $('v5GrossValue').textContent = cash(current.gross, current.digits);
  $('v5RemainingValue').textContent = cash(current.remaining, current.digits);
  renderFocus(pay, projection);
  renderPeriodVisual(pay, projection);
}

function threeStats(title, primary, secondary, tertiary, details = '') {
  return `<div class="focus-heading-v5"><span>${title}</span></div><div class="three-stat-v5"><article class="primary"><span>${primary[0]}</span><strong>${primary[1]}</strong></article><article><span>${secondary[0]}</span><strong>${secondary[1]}</strong></article><article><span>${tertiary[0]}</span><strong>${tertiary[1]}</strong></article></div>${details ? `<details class="breakdown-v5"><summary>View breakdown</summary><div>${details}</div></details>` : ''}`;
}

function renderFocus(pay, projection) {
  const pension = projection.pension;
  const grossDeduction = pay.gross ? (pay.tax + pay.ni) / pay.gross * 100 : 0;
  const costShare = pay.netMonthly ? pay.expensesMonth / pay.netMonthly * 100 : 0;
  const overtimeMode = $('overtimeEntryMode')?.value || 'none';
  const overtimeSupport = overtimeMode === 'hours'
    ? ['Effective take-home hourly rate', cash(pay.overtimeNetRate, 2)]
    : ['Average kept per overtime week', cash(pay.overtimeWeeks ? pay.overtimeNet / pay.overtimeWeeks : 0)];
  const fiveNet = projection.rows.slice(0, 5).reduce((sum, row) => sum + row.net, 0);
  const tenNet = projection.rows.slice(0, 10).reduce((sum, row) => sum + row.net, 0);
  const content = {
    pay: threeStats('Pay summary', ['Monthly take-home', cash(pay.netMonthly)], ['Real hourly income', cash(pay.remainingHourly, 2)], ['Yearly take-home', cash(pay.net)], `<p>Gross yearly pay: <strong>${cash(pay.gross)}</strong></p><p>Actual hours used: <strong>${pay.actualHours.toFixed(1)}</strong></p>`),
    tax: threeStats('Tax and National Insurance', ['Total deductions', cash(pay.tax + pay.ni)], ['Effective deduction rate', pc(grossDeduction)], ['Take-home pay', cash(pay.net)], `<p>Income Tax: <strong>${cash(pay.tax)}</strong></p><p>Employee NI: <strong>${cash(pay.ni)}</strong></p><p>${CONFIG.taxYear} · ${CONFIG.region} · Personal Allowance ${cash(CONFIG.tax.personalAllowance)}</p>`),
    overtime: pay.overtimeGross > 0
      ? threeStats('Overtime', ['Overtime after tax and NI', cash(pay.overtimeNet)], overtimeSupport, ['Overtime income kept', pc(pay.overtimeKeptPct)], `<p>Gross overtime: <strong>${cash(pay.overtimeGross)}</strong></p><p>Extra tax and NI: <strong>${cash(pay.overtimeExtraTax + pay.overtimeExtraNI)}</strong></p>`)
      : '<div class="empty-focus-v5"><strong>No overtime included.</strong><span>Add an approximate weekly amount or calculate it from hours and rate.</span></div>',
    costs: threeStats('Monthly costs', ['Total monthly costs', cash(pay.expensesMonth)], ['Money remaining', cash(pay.remainingMonth)], ['Share of take-home used', pc(costShare)], `<p>Yearly costs: <strong>${cash(pay.expensesYear)}</strong></p><p>Real income after costs: <strong>${cash(pay.remainingHourly, 2)} per worked hour</strong></p>`),
    pension: threeStats('Pension', ['Projected retirement balance', cash(pension.balanceAtRetirement)], ['Estimated yearly retirement income', cash(pension.combinedRetirementIncome)], ['Target reached', pc(pension.targetRatio * 100)], `<p>Your deposits: <strong>${cash(pension.employeeDeposits)}</strong></p><p>Employer deposits: <strong>${cash(pension.employerDeposits)}</strong></p><p>Estimated investment growth: <strong>${cash(pension.investmentGrowth)}</strong></p>`),
    future: threeStats('Future outlook', ['5-year take-home', cash(fiveNet)], ['10-year take-home', cash(tenNet)], ['Pension at retirement', cash(pension.balanceAtRetirement)], '<p>Future values depend on wage growth, costs, tax thresholds, pension returns and inflation.</p>')
  };
  $('v5FocusContent').innerHTML = content[selectedFocus];
}

function renderPeriodVisual(pay, projection) {
  const metric = $('v5PeriodMetric')?.value || 'net';
  const periods = ['hour','day','week','month','year','five','ten'].map(key => ({ key, ...periodData(pay, projection, key) }));
  const max = Math.max(...periods.map(item => Math.max(0, item[metric])), 1);
  $('v5PeriodChartTitle').textContent = metric === 'gross' ? 'Gross income' : metric === 'remaining' ? 'Money remaining after costs' : 'Take-home income';
  $('v5PeriodChart').innerHTML = periods.map(item => {
    const height = Math.max(5, Math.sqrt(Math.max(0, item[metric]) / max) * 100);
    const label = {hour:'Hour',day:'Day',week:'Week',month:'Month',year:'Year',five:'5Y',ten:'10Y'}[item.key];
    return `<div><strong>${cash(item[metric], item.key === 'hour' ? 2 : 0)}</strong><span class="bar-track-v5"><i style="height:${height}%"></i></span><small>${label}</small></div>`;
  }).join('');
}

function buildFutureFocus() {
  const panel = q('[data-panel="projections"]');
  if (!panel) return;
  panel.classList.add('future-v5');
  q('.panel-heading h2', panel).textContent = 'See how your money could change.';
  const headingText = q('.panel-heading div > p:last-child', panel);
  if (headingText) headingText.textContent = 'Choose one figure and one time range. Assumptions stay out of the way until you need them.';

  const focus = document.createElement('section');
  focus.className = 'future-focus-v5';
  focus.innerHTML = `
    <div class="future-toolbar-v5">
      <label>Show<select id="futureMetricV5"><option value="gross">Gross income</option><option value="net" selected>Take-home income</option><option value="remaining">Money remaining</option><option value="pension">Pension balance</option></select></label>
      <div class="future-range-v5" role="tablist">${[[1,'1Y'],[5,'5Y'],[10,'10Y'],['retirement','Retirement']].map(([value,label]) => `<button type="button" data-future-range="${value}" class="${value === 5 ? 'active' : ''}">${label}</button>`).join('')}</div>
    </div>
    <div class="future-three-v5"><article><span>Starting value</span><strong id="futureStartV5">—</strong></article><article><span>Ending value</span><strong id="futureEndV5">—</strong></article><article><span>Change</span><strong id="futureChangeV5">—</strong></article></div>
    <div id="futureChartV5" class="future-chart-v5"></div>
    <div id="pensionLinesV5" class="pension-lines-v5 hidden"><label><input id="showEmployeeLineV5" type="checkbox"> Money paid in by you</label><label><input id="showEmployerLineV5" type="checkbox"> Money paid in by your employer</label></div>
    <div id="pensionSummaryV5" class="pension-summary-v5"></div>`;
  q('.projection-assumptions', panel).before(focus);
  $('futureMetricV5').addEventListener('change', () => { selectedFutureMetric = $('futureMetricV5').value; renderFutureFocus(); });
  qa('[data-future-range]').forEach(button => button.addEventListener('click', () => {
    selectedFutureRange = button.dataset.futureRange === 'retirement' ? 'retirement' : Number(button.dataset.futureRange);
    qa('[data-future-range]').forEach(item => item.classList.toggle('active', item === button));
    renderFutureFocus();
  }));
  $('showEmployeeLineV5').addEventListener('change', renderFutureFocus);
  $('showEmployerLineV5').addEventListener('change', renderFutureFocus);

  const assumptions = q('.projection-assumptions', panel);
  if (assumptions) {
    const details = document.createElement('details');
    details.className = 'future-assumptions-v5';
    details.innerHTML = '<summary>Projection assumptions</summary>';
    assumptions.before(details);
    details.append(assumptions);
  }
}

function linePath(points) {
  if (!points.length) return '';
  return points.reduce((path, point, index) => `${path}${index ? ' L' : 'M'} ${point[0]} ${point[1]}`, '');
}

function renderFutureFocus() {
  const data = currentData();
  if (!data || !$('futureChartV5')) return;
  const { projection } = data;
  const count = selectedFutureRange === 'retirement' ? projection.retirementYears : selectedFutureRange;
  const rows = projection.rows.slice(0, Math.max(1, Math.min(count, projection.rows.length)));
  const key = selectedFutureMetric === 'pension' ? 'pensionBalance' : selectedFutureMetric;
  const values = rows.map(row => Math.max(0, Number(row[key]) || 0));
  const start = values[0] || 0;
  const end = values.at(-1) || 0;
  const change = start ? (end - start) / Math.abs(start) * 100 : 0;
  $('futureStartV5').textContent = cash(start);
  $('futureEndV5').textContent = cash(end);
  $('futureChangeV5').textContent = `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;
  $('futureChangeV5').className = change >= 0 ? 'positive-text' : 'negative-text';
  $('pensionLinesV5').classList.toggle('hidden', selectedFutureMetric !== 'pension');

  const width = 900, height = 350, pad = { l: 60, r: 24, t: 28, b: 42 };
  const allSeries = [{ name: selectedFutureMetric === 'pension' ? 'Your projected pension pot' : $('futureMetricV5').selectedOptions[0].textContent, values, colour: selectedFutureMetric === 'pension' ? '#40208e' : '#1557d5' }];
  if (selectedFutureMetric === 'pension' && $('showEmployeeLineV5').checked) {
    let total = 0; allSeries.push({ name: 'Money paid in by you', values: rows.map(row => total += row.employeePension), colour: '#34765a' });
  }
  if (selectedFutureMetric === 'pension' && $('showEmployerLineV5').checked) {
    let total = 0; allSeries.push({ name: 'Money paid in by your employer', values: rows.map(row => total += row.employerPension), colour: '#f1bb19' });
  }
  const all = allSeries.flatMap(series => series.values);
  const max = Math.max(...all, 1);
  const x = index => rows.length === 1 ? width / 2 : pad.l + index * (width - pad.l - pad.r) / (rows.length - 1);
  const y = amount => pad.t + (max - amount) / max * (height - pad.t - pad.b);
  let svg = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Selected financial projection"><defs><linearGradient id="futureAreaV5" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${allSeries[0].colour}" stop-opacity=".25"/><stop offset="1" stop-color="${allSeries[0].colour}" stop-opacity="0"/></linearGradient></defs>`;
  for (let i = 0; i < 5; i += 1) {
    const yy = pad.t + i * (height - pad.t - pad.b) / 4;
    svg += `<line x1="${pad.l}" y1="${yy}" x2="${width-pad.r}" y2="${yy}" class="future-gridline-v5"/><text x="4" y="${yy+4}" class="future-label-v5">${cash(max - i * max / 4)}</text>`;
  }
  allSeries.forEach((series, index) => {
    const points = series.values.map((amount, i) => [x(i), y(amount)]);
    const path = linePath(points);
    if (index === 0 && points.length > 1) svg += `<path d="${path} L ${points.at(-1)[0]} ${height-pad.b} L ${points[0][0]} ${height-pad.b} Z" fill="url(#futureAreaV5)"/>`;
    svg += `<path d="${path}" fill="none" stroke="${series.colour}" stroke-width="${index === 0 ? 4 : 2.5}" stroke-linecap="round" stroke-linejoin="round"/>`;
    points.forEach((point, i) => { svg += `<circle cx="${point[0]}" cy="${point[1]}" r="4" fill="${series.colour}"><title>${series.name}, Year ${rows[i].year}: ${cash(series.values[i])}</title></circle>`; });
  });
  rows.forEach((row, index) => {
    if (rows.length <= 10 || index === 0 || index === rows.length - 1 || index % Math.ceil(rows.length / 8) === 0) svg += `<text x="${x(index)}" y="${height-13}" text-anchor="middle" class="future-label-v5">Y${row.year}</text>`;
  });
  svg += '</svg>';
  $('futureChartV5').innerHTML = svg + `<div class="future-legend-v5">${allSeries.map(series => `<span><i style="background:${series.colour}"></i>${series.name}</span>`).join('')}</div>`;

  const pension = projection.pension;
  const ratio = pension.targetRatio * 100;
  const code = ratio < 60 ? 'red' : ratio < 90 ? 'yellow' : ratio < 120 ? 'green' : 'bright';
  const label = code === 'red' ? 'Significantly below your target' : code === 'yellow' ? 'Below your target' : code === 'green' ? 'Close to or above your target' : 'Comfortably above your target';
  $('pensionSummaryV5').innerHTML = `<div class="pension-rating-v5 ${code}"><span>${label}</span><strong>${pc(ratio)} of your target</strong><small>This compares the estimate with the retirement income you entered.</small></div><div class="three-stat-v5"><article class="primary"><span>Estimated balance at retirement</span><strong>${cash(pension.balanceAtRetirement)}</strong></article><article><span>Estimated yearly retirement income</span><strong>${cash(pension.combinedRetirementIncome)}</strong></article><article><span>Target reached</span><strong>${pc(ratio)}</strong></article></div><details class="breakdown-v5"><summary>View pension breakdown</summary><div><p>Money paid in by you: <strong>${cash(pension.employeeDeposits)}</strong></p><p>Money paid in by your employer: <strong>${cash(pension.employerDeposits)}</strong></p><p>Estimated investment growth: <strong>${cash(pension.investmentGrowth)}</strong></p><p>Modelled fees: <strong>${cash(pension.fees)}</strong></p><p>State Pension entered: <strong>${cash(pension.statePensionAnnual)}</strong></p></div></details>`;
}

function simplifyLegacyReports() {
  const results = q('[data-panel="results"]');
  if (results) {
    ['.period-tabs','.headline-result','.metric-grid','.period-comparison-v4','.visual-heading','.estimate-tabs','.estimate-content','.audit-explanation'].forEach(selector => q(selector, results)?.classList.add('legacy-report-v5'));
    qa('.donut-grid .chart-card', results).slice(1).forEach(card => card.classList.add('legacy-report-v5'));
  }
  const future = q('[data-panel="projections"]');
  if (future) ['.chart-controls','.market-summary','.projection-chart-grid','.pension-health'].forEach(selector => q(selector, future)?.classList.add('legacy-report-v5'));
}

function compactMortgage() {
  const target = $('mortgageResults');
  if (!target) return;
  const grid = q('.dashboard-grid', target);
  if (!grid || grid.dataset.compacted === 'yes') return;
  const cells = [...grid.children];
  if (cells.length < 4) return;
  grid.dataset.compacted = 'yes';
  const important = [cells[2], cells[6], cells[10]].filter(Boolean);
  const details = document.createElement('details');
  details.className = 'breakdown-v5 mortgage-breakdown-v5';
  details.innerHTML = '<summary>View full mortgage breakdown</summary>';
  const full = document.createElement('div');
  full.className = 'dashboard-grid full-breakdown-grid-v5';
  cells.forEach(cell => full.append(cell.cloneNode(true)));
  details.append(full);
  grid.replaceChildren(...important);
  target.append(details);
}

function wireUpdates() {
  const rerender = () => setTimeout(() => { renderCompactResults(); renderFutureFocus(); compactMortgage(); }, 60);
  [$('calculateButton'), ...qa('.recalculate'), $('mortgageCalculate')].filter(Boolean).forEach(button => button.addEventListener('click', rerender));
  const status = $('resultStatus');
  if (status) new MutationObserver(rerender).observe(status, { childList: true, subtree: true, characterData: true });
  if ($('mortgageResults')) new MutationObserver(() => setTimeout(compactMortgage, 0)).observe($('mortgageResults'), { childList: true, subtree: true });
}

function addColourClasses() {
  const map = { pay:'income-theme-v5', spending:'cost-theme-v5', results:'result-theme-v5', projections:'future-theme-v5', pension:'pension-theme-v5', career:'career-theme-v5', mortgage:'mortgage-theme-v5', resources:'resource-theme-v5' };
  Object.entries(map).forEach(([panel, className]) => q(`[data-panel="${panel}"]`)?.classList.add(className));
}

function init() {
  improveHeroCopy();
  redesignOvertime();
  buildCompactResults();
  buildFutureFocus();
  simplifyLegacyReports();
  addColourClasses();
  wireUpdates();
  renderCompactResults();
  renderFutureFocus();
}

init();
