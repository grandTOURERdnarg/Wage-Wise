const TAX = {
  year: '2026/27', personalAllowance: 12570, allowanceTaperStarts: 100000,
  basicBand: 37700, additionalThreshold: 125140, basicRate: 0.20,
  higherRate: 0.40, additionalRate: 0.45, niPrimaryThreshold: 12570,
  niUpperEarningsLimit: 50270, niMainRate: 0.08, niUpperRate: 0.02
};

const defaults = {
  payType: 'annual', payAmount: 30000, hoursPerWeek: 37.5, daysPerWeek: 5,
  weeksPerYear: 52, overtimeHours: 0, overtimeRate: 0, leaveWeeks: 5.6,
  leavePaid: 'yes', housingCost: 0, councilTaxCost: 0, foodCost: 0,
  utilitiesCost: 0, transportCost: 0, debtCost: 0, subscriptionsCost: 0,
  otherCost: 0, employeePensionPct: 5, employerPensionPct: 3,
  currentPension: 0, wageGrowthPct: 2, pensionGrowthPct: 5,
  yearsToRetirement: 35
};

const costIds = ['housingCost','councilTaxCost','foodCost','utilitiesCost','transportCost','debtCost','subscriptionsCost','otherCost'];
const essentialIds = ['housingCost','councilTaxCost','foodCost','utilitiesCost','transportCost'];
const optionalIds = ['subscriptionsCost','otherCost'];
const el = id => document.getElementById(id);
const clamp = (number, min, max) => Math.min(max, Math.max(min, number));
const value = id => Math.max(0, Number(el(id)?.value) || 0);
const money = (amount, digits = 0) => new Intl.NumberFormat('en-GB', {
  style: 'currency', currency: 'GBP', minimumFractionDigits: digits,
  maximumFractionDigits: digits
}).format(Number.isFinite(amount) ? amount : 0);
const setText = (id, text) => { if (el(id)) el(id).textContent = text; };

let latest = null;
let activePeriod = 'hour';
let hasCalculated = false;

function sumInputs(ids) { return ids.reduce((sum, id) => sum + value(id), 0); }
function monthlyCosts() { return sumInputs(costIds); }
function essentialCosts() { return sumInputs(essentialIds); }
function optionalCosts() { return sumInputs(optionalIds); }

function updatePayLabel() {
  const labels = { annual: 'Annual salary (£)', monthly: 'Monthly salary (£)', weekly: 'Weekly wage (£)', hourly: 'Hourly wage (£)' };
  const label = el('payAmountLabel');
  if (label?.childNodes[0]) label.childNodes[0].textContent = `${labels[el('payType').value]}\n              `;
}

function basePayDetails() {
  const type = el('payType').value;
  const amount = value('payAmount');
  const hours = Math.max(1, value('hoursPerWeek'));
  const days = clamp(value('daysPerWeek'), 1, 7);
  const paidWeeks = clamp(value('weeksPerYear'), 1, 52);
  const leaveWeeks = clamp(value('leaveWeeks'), 0, paidWeeks);
  const leaveIsPaid = el('leavePaid').value === 'yes';
  const actualWorkingWeeks = Math.max(0, paidWeeks - leaveWeeks);
  const payableWeeks = leaveIsPaid ? paidWeeks : actualWorkingWeeks;
  let fullYearBase = amount;
  let standardHourly = 0;

  if (type === 'monthly') fullYearBase = amount * 12;
  if (type === 'weekly') fullYearBase = amount * paidWeeks;
  if (type === 'hourly') fullYearBase = amount * hours * paidWeeks;
  standardHourly = type === 'hourly' ? amount : fullYearBase / Math.max(1, hours * paidWeeks);

  const baseGross = fullYearBase * (payableWeeks / paidWeeks);
  const leaveValue = standardHourly * hours * leaveWeeks;
  const unpaidLeaveLost = leaveIsPaid ? 0 : leaveValue;
  return { type, amount, hours, days, paidWeeks, leaveWeeks, leaveIsPaid, actualWorkingWeeks, payableWeeks, fullYearBase, standardHourly, baseGross, leaveValue, unpaidLeaveLost };
}

function incomeTax(gross) {
  let allowance = TAX.personalAllowance;
  if (gross > TAX.allowanceTaperStarts) allowance = Math.max(0, allowance - (gross - TAX.allowanceTaperStarts) / 2);
  const taxable = Math.max(0, gross - allowance);
  const basic = Math.min(taxable, TAX.basicBand) * TAX.basicRate;
  const higherLimit = Math.max(0, TAX.additionalThreshold - allowance - TAX.basicBand);
  const higher = Math.min(Math.max(0, taxable - TAX.basicBand), higherLimit) * TAX.higherRate;
  const additional = Math.max(0, gross - TAX.additionalThreshold) * TAX.additionalRate;
  return basic + higher + additional;
}

function nationalInsurance(gross) {
  const mainBand = TAX.niUpperEarningsLimit - TAX.niPrimaryThreshold;
  const main = Math.min(Math.max(0, gross - TAX.niPrimaryThreshold), mainBand) * TAX.niMainRate;
  const upper = Math.max(0, gross - TAX.niUpperEarningsLimit) * TAX.niUpperRate;
  return main + upper;
}

function projectPension(gross, employeePctOverride = value('employeePensionPct')) {
  const employerPct = value('employerPensionPct');
  const wageGrowth = value('wageGrowthPct') / 100;
  const growth = value('pensionGrowthPct') / 100;
  const retirementYears = clamp(value('yearsToRetirement'), 1, 60);
  const totalYears = Math.max(5, retirementYears);
  const monthlyGrowth = Math.pow(1 + growth, 1 / 12) - 1;
  let existingPot = value('currentPension');
  let employeePot = 0;
  let employerPot = 0;
  let employeeDeposits = 0;
  let employerDeposits = 0;
  let firstFiveDeposits = 0;
  const snapshots = [{ year: 0, total: existingPot }];
  let fiveYearBalance = existingPot;
  let retirementBalance = existingPot;
  let retirementEmployerPot = 0;

  for (let month = 0; month < totalYears * 12; month += 1) {
    const yearIndex = Math.floor(month / 12);
    const salary = gross * Math.pow(1 + wageGrowth, yearIndex);
    const employeeContribution = salary * employeePctOverride / 100 / 12;
    const employerContribution = salary * employerPct / 100 / 12;
    employeeDeposits += employeeContribution;
    employerDeposits += employerContribution;
    if (month < 60) firstFiveDeposits += employeeContribution + employerContribution;
    existingPot *= (1 + monthlyGrowth);
    employeePot = (employeePot + employeeContribution) * (1 + monthlyGrowth);
    employerPot = (employerPot + employerContribution) * (1 + monthlyGrowth);

    if ((month + 1) % 12 === 0) {
      const year = (month + 1) / 12;
      const total = existingPot + employeePot + employerPot;
      snapshots.push({ year, total });
      if (year === 5) fiveYearBalance = total;
      if (year === retirementYears) {
        retirementBalance = total;
        retirementEmployerPot = employerPot;
      }
    }
  }

  return {
    employeePct: employeePctOverride, employerPct, retirementYears,
    employeeMonth: gross * employeePctOverride / 100 / 12,
    employerMonth: gross * employerPct / 100 / 12,
    totalYear: gross * (employeePctOverride + employerPct) / 100,
    fiveYearBalance, retirementBalance, retirementEmployerPot,
    employeeDeposits, employerDeposits, firstFiveDeposits, snapshots
  };
}

function calculations() {
  const base = basePayDetails();
  const overtimeHours = value('overtimeHours');
  const overtimeRate = value('overtimeRate');
  const overtimeHoursYear = overtimeHours * base.actualWorkingWeeks;
  const overtimeGross = overtimeHoursYear * overtimeRate;
  const gross = base.baseGross + overtimeGross;
  const tax = incomeTax(gross);
  const ni = nationalInsurance(gross);
  const net = Math.max(0, gross - tax - ni);
  const taxWithoutOvertime = incomeTax(base.baseGross);
  const niWithoutOvertime = nationalInsurance(base.baseGross);
  const overtimeTaxAndNi = Math.max(0, (tax - taxWithoutOvertime) + (ni - niWithoutOvertime));
  const overtimeNet = Math.max(0, overtimeGross - overtimeTaxAndNi);
  const costsMonth = monthlyCosts();
  const essentialMonth = essentialCosts();
  const optionalMonth = optionalCosts();
  const debtMonth = value('debtCost');
  const costsYear = costsMonth * 12;
  const remainingYear = net - costsYear;
  const actualHours = Math.max(1, (base.hours * base.actualWorkingWeeks) + overtimeHoursYear);
  const actualDays = Math.max(1, base.days * base.actualWorkingWeeks);
  const pension = projectPension(gross);
  const extraOne = projectPension(gross, value('employeePensionPct') + 1);

  return {
    ...base, overtimeHours, overtimeRate, overtimeHoursYear, overtimeGross,
    overtimeTaxAndNi, overtimeNet, overtimeNetRate: overtimeHoursYear > 0 ? overtimeNet / overtimeHoursYear : 0,
    gross, tax, ni, net, costsMonth, essentialMonth, optionalMonth, debtMonth,
    costsYear, remainingYear, remainingMonth: remainingYear / 12,
    actualHours, actualDays, deductions: tax + ni, pension,
    extraOnePercentDifference: Math.max(0, extraOne.retirementBalance - pension.retirementBalance)
  };
}

function showStep(step) {
  document.querySelectorAll('.step-panel').forEach(panel => panel.classList.toggle('active', panel.dataset.panel === step));
  document.querySelectorAll('.step-button').forEach(button => {
    const active = button.dataset.step === step;
    button.classList.toggle('active', active);
    if (active) button.setAttribute('aria-current', 'step'); else button.removeAttribute('aria-current');
  });
  document.querySelector('.app-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function markCompletedThrough(step) {
  const order = ['pay','overtime','spending','pension','results','budget'];
  const index = order.indexOf(step);
  document.querySelectorAll('.step-button').forEach(button => button.classList.toggle('completed', order.indexOf(button.dataset.step) < index));
}

function markPending() {
  setText('monthlyCostsPreview', money(monthlyCosts()));
  if (!hasCalculated) return;
  setText('resultsStatus', 'You have unapplied changes. Press Update calculation.');
  el('resultsStatus')?.classList.add('pending-badge');
}

function periodData(c, period) {
  const definitions = {
    hour: { title: 'Take-home per worked hour', divisor: c.actualHours },
    day: { title: 'Take-home per working day', divisor: c.actualDays },
    week: { title: 'Take-home per paid week', divisor: c.paidWeeks },
    month: { title: 'Take-home per month', divisor: 12 },
    year: { title: 'Take-home per year', divisor: 1 },
    fiveYear: { title: 'Take-home over five years', multiplier: 5 }
  };
  const definition = definitions[period];
  const transform = annual => definition.multiplier ? annual * definition.multiplier : annual / Math.max(1, definition.divisor);
  return {
    title: definition.title, gross: transform(c.gross), tax: transform(c.tax), ni: transform(c.ni),
    net: transform(c.net), expenses: transform(c.costsYear), remaining: transform(c.remainingYear),
    overtime: transform(c.overtimeGross)
  };
}

function renderPeriod(c) {
  const data = periodData(c, activePeriod);
  setText('periodTitle', data.title);
  setText('periodTakeHome', money(data.net, activePeriod === 'hour' ? 2 : 0));
  setText('periodAfterCosts', `${money(data.remaining, activePeriod === 'hour' ? 2 : 0)} left after entered expenses`);
  setText('periodGross', money(data.gross, activePeriod === 'hour' ? 2 : 0));
  setText('periodTax', money(data.tax, activePeriod === 'hour' ? 2 : 0));
  setText('periodNi', money(data.ni, activePeriod === 'hour' ? 2 : 0));
  setText('periodNet', money(data.net, activePeriod === 'hour' ? 2 : 0));
  setText('periodExpenses', money(data.expenses, activePeriod === 'hour' ? 2 : 0));
  setText('periodRemaining', money(data.remaining, activePeriod === 'hour' ? 2 : 0));
  setText('periodReal', money(data.remaining, activePeriod === 'hour' ? 2 : 0));
  setText('periodOvertime', money(data.overtime, activePeriod === 'hour' ? 2 : 0));
  el('resultHero').classList.remove('placeholder');
}

function renderOvertimeAndLeave(c) {
  setText('extraHoursYear', `${c.overtimeHoursYear.toFixed(1)} hours`);
  setText('overtimeNetYear', money(c.overtimeNet));
  setText('overtimeNetRate', money(c.overtimeNetRate, 2));
  setText('leaveImpactLabel', c.leaveIsPaid ? 'Paid leave value' : 'Income lost to unpaid leave');
  setText('leaveImpactValue', money(c.leaveIsPaid ? c.leaveValue : c.unpaidLeaveLost));
}

function renderExplanation(c) {
  const items = [];
  items.push(`Your standard pay produces estimated base gross income of ${money(c.baseGross)} a year.`);
  if (c.overtimeGross > 0) items.push(`${c.overtimeHoursYear.toFixed(1)} overtime hours add ${money(c.overtimeGross)} gross; an estimated ${money(c.overtimeNet)} remains after the extra Income Tax and National Insurance caused by that overtime.`);
  else items.push('No overtime income was included because overtime hours or the overtime rate was zero.');
  items.push(`Estimated Income Tax is ${money(c.tax)} and employee National Insurance is ${money(c.ni)} using standard ${TAX.year} rates.`);
  if (c.leaveIsPaid) items.push(`${c.leaveWeeks} weeks of paid leave are valued at about ${money(c.leaveValue)}. They reduce hours actually worked without reducing estimated base pay.`);
  else items.push(`${c.leaveWeeks} weeks of unpaid leave reduce estimated gross pay by about ${money(c.unpaidLeaveLost)}.`);
  if (c.costsMonth > 0) items.push(`Your entered spending totals ${money(c.costsMonth)} a month, leaving approximately ${money(c.remainingMonth)} each month after tax and those costs.`);
  else items.push('No monthly spending was entered, so the after-cost result currently matches take-home pay.');
  items.push('Pension figures are shown separately and are not deducted from take-home because workplace pension tax relief and salary-sacrifice methods differ.');
  const list = el('calculationReasons'); list.innerHTML = '';
  items.forEach(text => { const li = document.createElement('li'); li.textContent = text; list.append(li); });
}

function renderPayPeriodChart(c) {
  const values = [
    ['Hour', c.net / c.actualHours, 2], ['Day', c.net / c.actualDays, 0],
    ['Week', c.net / c.paidWeeks, 0], ['Month', c.net / 12, 0], ['Year', c.net, 0]
  ];
  const max = Math.max(...values.map(item => item[1]), 1);
  const chart = el('payPeriodChart'); chart.innerHTML = '';
  values.forEach(([label, amount, digits]) => {
    const width = clamp(Math.sqrt(Math.max(0, amount) / max) * 100, amount > 0 ? 5 : 0, 100);
    const row = document.createElement('div'); row.className = 'chart-row';
    row.innerHTML = `<span>${label}</span><div class="chart-track"><i style="width:${width}%"></i></div><strong>${money(amount,digits)}</strong>`;
    chart.append(row);
  });
}

function renderMoneySplit(c) {
  const gross = Math.max(c.gross, 1);
  const taxPct = clamp(c.tax / gross * 100, 0, 100);
  const niPct = clamp(c.ni / gross * 100, 0, 100 - taxPct);
  const expenseAmountShown = Math.min(Math.max(0, c.costsYear), Math.max(0, c.net));
  const expensePct = clamp(expenseAmountShown / gross * 100, 0, 100 - taxPct - niPct);
  const remainingPct = Math.max(0, 100 - taxPct - niPct - expensePct);
  const a = taxPct, b = a + niPct, d = b + expensePct;
  el('moneyDonut').style.background = `conic-gradient(#2563eb 0 ${a}%,#14b8a6 ${a}% ${b}%,#f59e0b ${b}% ${d}%,#22c55e ${d}% 100%)`;
  setText('donutValue', `${remainingPct.toFixed(0)}%`);
  const items = [['Income Tax',c.tax,'#2563eb'],['National Insurance',c.ni,'#14b8a6'],['Entered expenses',c.costsYear,'#f59e0b'],['Left after expenses',Math.max(0,c.remainingYear),'#22c55e']];
  const legend = el('moneyLegend'); legend.innerHTML = '';
  items.forEach(([label,amount,colour]) => { const row = document.createElement('div'); row.innerHTML = `<i class="legend-dot" style="background:${colour}"></i><span>${label}</span><strong>${money(amount)}</strong>`; legend.append(row); });
}

function renderColumns(containerId, items) {
  const max = Math.max(...items.map(item => Math.abs(item.value)), 1);
  const container = el(containerId); container.innerHTML = '';
  items.forEach(item => {
    const height = clamp(Math.abs(item.value) / max * 100, item.value !== 0 ? 4 : 0, 100);
    const column = document.createElement('div'); column.className = 'column-item';
    const colour = item.value < 0 ? 'linear-gradient(#fca5a5,#dc2626)' : (item.colour || 'linear-gradient(var(--teal),var(--blue))');
    column.innerHTML = `<strong>${money(item.value)}</strong><div class="column-track"><i style="height:${height}%;background:${colour}"></i></div><span>${item.label}</span>`;
    container.append(column);
  });
}

function renderFiveYearChart(c) {
  renderColumns('fiveYearChart', [1,2,3,4,5].map(year => ({ label: `Year ${year}`, value: c.remainingYear * year })));
}

function renderPensionChart(c) {
  const maxYear = c.pension.retirementYears;
  const candidateYears = [0,1,5,10,20,maxYear].filter(year => year <= Math.max(5,maxYear));
  const years = [...new Set(candidateYears)].sort((a,b) => a-b);
  const items = years.map(year => {
    const snapshot = c.pension.snapshots.find(item => item.year === year) || c.pension.snapshots[c.pension.snapshots.length - 1];
    return { label: year === 0 ? 'Now' : `Year ${year}`, value: snapshot.total, colour: 'linear-gradient(#60a5fa,#1d4ed8)' };
  });
  renderColumns('pensionChart', items);
}

function renderSpendingChart(c) {
  const items = [
    ['Housing',value('housingCost')],['Council Tax',value('councilTaxCost')],['Food',value('foodCost')],
    ['Utilities',value('utilitiesCost')],['Transport',value('transportCost')],['Debt',value('debtCost')],
    ['Subscriptions',value('subscriptionsCost')],['Other',value('otherCost')]
  ].filter(item => item[1] > 0);
  const chart = el('spendingChart'); chart.innerHTML = '';
  if (!items.length) { chart.innerHTML = '<div class="spending-empty">Add monthly spending in Step 3 to see this graph.</div>'; return; }
  const max = Math.max(...items.map(item => item[1]),1);
  items.forEach(([label,amount]) => { const row = document.createElement('div'); row.className = 'chart-row'; row.innerHTML = `<span>${label}</span><div class="chart-track"><i style="width:${amount/max*100}%"></i></div><strong>${money(amount)}</strong>`; chart.append(row); });
}

function renderPension(c) {
  setText('employeePensionMonth', money(c.pension.employeeMonth));
  setText('employerPensionMonth', money(c.pension.employerMonth));
  setText('totalPensionYear', money(c.pension.totalYear));
  setText('pensionFiveYear', money(c.pension.fiveYearBalance));
  setText('pensionRetirement', money(c.pension.retirementBalance));
  setText('employerFundedRetirement', money(c.pension.retirementEmployerPot));
  setText('extraOnePercent', money(c.extraOnePercentDifference));
}

function renderBudget(c) {
  const netMonth = c.net / 12;
  const remainingPositive = Math.max(0, c.remainingMonth);
  const emergencyPayment = c.essentialMonth > 0 ? Math.min(remainingPositive * .15, c.essentialMonth * .10) : Math.min(remainingPositive * .10, netMonth * .05);
  const suggestedSavings = Math.min(netMonth * .20, remainingPositive * .45);
  const suggestedPensionPct = Math.max(5, value('employeePensionPct'));
  const suggestedPension = c.gross * suggestedPensionPct / 100 / 12;
  const flexible = Math.max(0, remainingPositive - emergencyPayment - suggestedSavings);
  const expensePct = netMonth > 0 ? c.costsMonth / netMonth * 100 : 0;

  setText('budgetTakeHome', money(netMonth));
  setText('budgetEssential', money(c.essentialMonth));
  setText('budgetOptional', money(c.optionalMonth));
  setText('budgetDebt', money(c.debtMonth));
  setText('budgetEmergencyPayment', money(emergencyPayment));
  setText('budgetPensionSuggestion', `${money(suggestedPension)} gross`);
  setText('budgetSavings', money(suggestedSavings));
  setText('budgetFlexible', money(flexible));
  setText('budgetRemaining', money(c.remainingMonth));
  setText('budgetExpensePct', `${expensePct.toFixed(1)}%`);

  const costBar = netMonth > 0 ? clamp(c.costsMonth / netMonth * 100,0,100) : 0;
  const saveBar = netMonth > 0 ? clamp((suggestedSavings + emergencyPayment) / netMonth * 100,0,100-costBar) : 0;
  const flexBar = Math.max(0,100-costBar-saveBar);
  el('budgetCostsBar').style.width = `${costBar}%`;
  el('budgetSaveBar').style.width = `${saveBar}%`;
  el('budgetFlexibleBar').style.width = `${flexBar}%`;

  const tips = [];
  const housingPct = netMonth > 0 ? value('housingCost') / netMonth * 100 : 0;
  const debtPct = netMonth > 0 ? c.debtMonth / netMonth * 100 : 0;
  const subscriptionsPct = netMonth > 0 ? value('subscriptionsCost') / netMonth * 100 : 0;
  const overtimeShare = c.gross > 0 ? c.overtimeGross / c.gross * 100 : 0;
  if (c.costsMonth === 0) tips.push('Add your regular spending in Step 3 for genuinely personalised budgeting guidance.');
  if (c.remainingMonth < 0) tips.push(`Your entered costs exceed estimated take-home by ${money(Math.abs(c.remainingMonth))} a month. Review essential bills first and consider free debt guidance if payments are difficult.`);
  else if (c.remainingMonth > 0) tips.push(`You currently have about ${money(c.remainingMonth)} left each month after entered costs. A possible starting split is ${money(emergencyPayment)} toward an emergency fund and ${money(suggestedSavings)} toward other savings.`);
  if (housingPct > 35) tips.push(`Housing uses about ${housingPct.toFixed(0)}% of take-home pay, which is a large share. Checking housing support, bills and future pay progression may be worthwhile.`);
  if (debtPct > 10) tips.push(`Debt repayments use about ${debtPct.toFixed(0)}% of take-home pay. Prioritise required payments and use free debt support rather than taking expensive new credit.`);
  if (subscriptionsPct > 5) tips.push(`Subscriptions and entertainment use about ${subscriptionsPct.toFixed(0)}% of take-home pay. Reviewing unused subscriptions could release money quickly.`);
  if (overtimeShare > 20) tips.push(`Overtime supplies about ${overtimeShare.toFixed(0)}% of gross income. Avoid making essential commitments that depend entirely on overtime continuing.`);
  if (!c.leaveIsPaid && c.unpaidLeaveLost > 0) tips.push(`Unpaid leave reduces estimated yearly gross income by ${money(c.unpaidLeaveLost)}. Building a leave buffer could smooth those lower-pay periods.`);
  if (value('employeePensionPct') < 5) tips.push('Your entered personal pension rate is below 5%. Check your scheme rules and whether increasing it would unlock more employer matching before changing anything.');
  if (value('employerPensionPct') > 0) tips.push(`Your employer contribution is worth about ${money(c.pension.employerMonth)} a month at the current wage. Check whether your employer will match a higher personal contribution.`);
  if (c.essentialMonth > 0) tips.push(`A three-month emergency-fund target based on entered essentials is roughly ${money(c.essentialMonth * 3)}.`);
  const list = el('personalTips'); list.innerHTML = '';
  tips.slice(0,7).forEach(text => { const li = document.createElement('li'); li.textContent = text; list.append(li); });

  setText('fiveGross', money(c.gross * 5)); setText('fiveTax', money(c.tax * 5)); setText('fiveNi', money(c.ni * 5));
  setText('fiveNet', money(c.net * 5)); setText('fiveOvertime', money(c.overtimeGross * 5));
  setText('fiveExpenses', money(c.costsYear * 5)); setText('fiveRemaining', money(c.remainingYear * 5));
  setText('fivePensionContributions', money(c.pension.firstFiveDeposits));
}

function renderAll(c) {
  renderPeriod(c); renderOvertimeAndLeave(c); renderExplanation(c);
  renderPayPeriodChart(c); renderMoneySplit(c); renderFiveYearChart(c);
  renderPensionChart(c); renderSpendingChart(c); renderPension(c); renderBudget(c);
  setText('resultsStatus', `Updated using your current figures. Estimated yearly take-home: ${money(c.net)}.`);
  el('resultsStatus')?.classList.remove('pending-badge');
}

function calculateAndShow(target = 'results') {
  latest = calculations();
  hasCalculated = true;
  renderAll(latest);
  markCompletedThrough(target);
  showStep(target);
}

function resetCalculator() {
  Object.entries(defaults).forEach(([id, defaultValue]) => { if (el(id)) el(id).value = defaultValue; });
  latest = null; hasCalculated = false; activePeriod = 'hour'; updatePayLabel();
  setText('monthlyCostsPreview', money(0));
  setText('resultsStatus', 'Complete the first four steps, then press Update calculation.');
  el('resultsStatus')?.classList.remove('pending-badge');
  document.querySelectorAll('.period-tab').forEach(button => { const active = button.dataset.period === 'hour'; button.classList.toggle('active',active); button.setAttribute('aria-selected',String(active)); });
  document.querySelectorAll('.step-button').forEach(button => button.classList.remove('completed'));
  document.querySelectorAll('.result-metrics strong,.overtime-summary strong,.pension-grid strong,.budget-dashboard strong,.five-year-list strong').forEach(node => node.textContent = '—');
  setText('periodTitle','Take-home per worked hour'); setText('periodTakeHome','—'); setText('periodAfterCosts','Press Update calculation to see your result.');
  el('resultHero').classList.add('placeholder');
  el('calculationReasons').innerHTML = '<li>Your explanation will appear after calculation.</li>';
  el('personalTips').innerHTML = '<li>Calculate your figures to receive personalised ideas.</li>';
  ['payPeriodChart','fiveYearChart','pensionChart','spendingChart','moneyLegend'].forEach(id => { if (el(id)) el(id).innerHTML = ''; });
  el('moneyDonut').style.background = '#e5eaf1'; setText('donutValue','0%');
  showStep('pay');
}

Object.keys(defaults).forEach(id => {
  el(id)?.addEventListener('input', () => { if (id === 'payType') updatePayLabel(); markPending(); });
});

document.querySelectorAll('.step-button').forEach(button => button.addEventListener('click', () => showStep(button.dataset.step)));
document.querySelectorAll('[data-next]').forEach(button => button.addEventListener('click', () => { markCompletedThrough(button.dataset.next); showStep(button.dataset.next); }));
document.querySelectorAll('[data-back]').forEach(button => button.addEventListener('click', () => showStep(button.dataset.back)));
document.querySelectorAll('.period-tab').forEach(button => button.addEventListener('click', () => {
  activePeriod = button.dataset.period;
  document.querySelectorAll('.period-tab').forEach(item => { const active = item === button; item.classList.toggle('active',active); item.setAttribute('aria-selected',String(active)); });
  if (latest) renderPeriod(latest);
}));
document.querySelectorAll('.chart-tab').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('.chart-tab').forEach(item => { const active = item === button; item.classList.toggle('active',active); item.setAttribute('aria-selected',String(active)); });
  document.querySelectorAll('.chart-panel').forEach(panel => panel.classList.toggle('active', panel.dataset.chartPanel === button.dataset.chart));
}));

el('calculateButton').addEventListener('click', () => calculateAndShow('results'));
el('recalculateButton').addEventListener('click', () => calculateAndShow('results'));
el('budgetRecalculateButton').addEventListener('click', () => calculateAndShow('budget'));
el('resetButton').addEventListener('click', resetCalculator);
el('startAgainButton').addEventListener('click', resetCalculator);

updatePayLabel();
setText('monthlyCostsPreview', money(monthlyCosts()));
