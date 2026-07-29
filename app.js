const TAX = {
  personalAllowance: 12570,
  allowanceTaperStarts: 100000,
  basicBand: 37700,
  additionalThreshold: 125140,
  basicRate: 0.20,
  higherRate: 0.40,
  additionalRate: 0.45,
  niPrimaryThreshold: 12570,
  niUpperEarningsLimit: 50270,
  niMainRate: 0.08,
  niUpperRate: 0.02
};

const defaults = {
  payType: 'annual',
  payAmount: 30000,
  hoursPerWeek: 37.5,
  weeksPerYear: 52,
  overtimeHours: 0,
  overtimeRate: 0,
  leaveWeeks: 5.6,
  leavePaid: 'yes',
  housingCost: 0,
  councilTaxCost: 0,
  foodCost: 0,
  utilitiesCost: 0,
  transportCost: 0,
  debtCost: 0,
  subscriptionsCost: 0,
  otherCost: 0
};

const inputIds = Object.keys(defaults);
const costIds = [
  'housingCost', 'councilTaxCost', 'foodCost', 'utilitiesCost',
  'transportCost', 'debtCost', 'subscriptionsCost', 'otherCost'
];
const essentialCostIds = [
  'housingCost', 'councilTaxCost', 'foodCost', 'utilitiesCost',
  'transportCost', 'debtCost'
];

const element = id => document.getElementById(id);
const rawNumber = id => Number(element(id).value) || 0;
const value = id => Math.max(0, rawNumber(id));
const clamp = (number, min, max) => Math.min(max, Math.max(min, number));
const money = (amount, digits = 0) => new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  minimumFractionDigits: digits,
  maximumFractionDigits: digits
}).format(Number.isFinite(amount) ? amount : 0);

let hasCalculated = false;

function setText(id, text) {
  element(id).textContent = text;
}

function updatePayLabel() {
  const labels = {
    annual: 'Annual salary (£)',
    monthly: 'Monthly salary (£)',
    weekly: 'Weekly wage (£)',
    hourly: 'Hourly wage (£)'
  };
  element('payAmountLabel').childNodes[0].textContent = `${labels[element('payType').value]}\n              `;
}

function monthlyCosts() {
  return costIds.reduce((total, id) => total + value(id), 0);
}

function essentialCosts() {
  return essentialCostIds.reduce((total, id) => total + value(id), 0);
}

function basePayDetails() {
  const type = element('payType').value;
  const amount = value('payAmount');
  const hours = Math.max(1, value('hoursPerWeek'));
  const paidWeeks = clamp(value('weeksPerYear'), 1, 52);
  const leaveWeeks = clamp(value('leaveWeeks'), 0, paidWeeks);
  const leaveIsPaid = element('leavePaid').value === 'yes';
  const actualWorkingWeeks = Math.max(0, paidWeeks - leaveWeeks);
  const payableWeeks = leaveIsPaid ? paidWeeks : actualWorkingWeeks;

  let fullYearBase;
  let standardHourly;

  if (type === 'monthly') {
    fullYearBase = amount * 12;
    standardHourly = fullYearBase / Math.max(1, hours * paidWeeks);
  } else if (type === 'weekly') {
    fullYearBase = amount * paidWeeks;
    standardHourly = amount / hours;
  } else if (type === 'hourly') {
    fullYearBase = amount * hours * paidWeeks;
    standardHourly = amount;
  } else {
    fullYearBase = amount;
    standardHourly = fullYearBase / Math.max(1, hours * paidWeeks);
  }

  const baseGross = fullYearBase * (payableWeeks / paidWeeks);
  const leaveValue = standardHourly * hours * leaveWeeks;
  const unpaidLeaveLost = leaveIsPaid ? 0 : leaveValue;

  return {
    type,
    amount,
    hours,
    paidWeeks,
    leaveWeeks,
    leaveIsPaid,
    actualWorkingWeeks,
    payableWeeks,
    fullYearBase,
    baseGross,
    standardHourly,
    leaveValue,
    unpaidLeaveLost
  };
}

function incomeTax(gross) {
  let allowance = TAX.personalAllowance;
  if (gross > TAX.allowanceTaperStarts) {
    allowance = Math.max(0, allowance - ((gross - TAX.allowanceTaperStarts) / 2));
  }

  const taxable = Math.max(0, gross - allowance);
  const basic = Math.min(taxable, TAX.basicBand) * TAX.basicRate;
  const higherBandLimit = Math.max(0, TAX.additionalThreshold - allowance - TAX.basicBand);
  const higher = Math.min(Math.max(0, taxable - TAX.basicBand), higherBandLimit) * TAX.higherRate;
  const additional = Math.max(0, gross - TAX.additionalThreshold) * TAX.additionalRate;
  return basic + higher + additional;
}

function nationalInsurance(gross) {
  const mainBand = TAX.niUpperEarningsLimit - TAX.niPrimaryThreshold;
  const main = Math.min(Math.max(0, gross - TAX.niPrimaryThreshold), mainBand) * TAX.niMainRate;
  const upper = Math.max(0, gross - TAX.niUpperEarningsLimit) * TAX.niUpperRate;
  return main + upper;
}

function calculations() {
  const base = basePayDetails();
  const overtimeHours = value('overtimeHours');
  const overtimeRate = value('overtimeRate');
  const overtimeGross = overtimeHours * overtimeRate * base.actualWorkingWeeks;
  const gross = base.baseGross + overtimeGross;
  const tax = incomeTax(gross);
  const ni = nationalInsurance(gross);
  const net = Math.max(0, gross - tax - ni);

  const taxWithoutOvertime = incomeTax(base.baseGross);
  const niWithoutOvertime = nationalInsurance(base.baseGross);
  const overtimeTaxAndNi = Math.max(0, (tax - taxWithoutOvertime) + (ni - niWithoutOvertime));
  const overtimeNet = Math.max(0, overtimeGross - overtimeTaxAndNi);

  const costsMonth = monthlyCosts();
  const essentialsMonth = essentialCosts();
  const costsYear = costsMonth * 12;
  const remainingYear = net - costsYear;
  const remainingMonth = remainingYear / 12;
  const actualHours = Math.max(1, (base.hours + overtimeHours) * base.actualWorkingWeeks);
  const paidHours = Math.max(1, (base.hours * base.payableWeeks) + (overtimeHours * base.actualWorkingWeeks));
  const deductions = tax + ni;
  const grossMonth = gross / 12;
  const netMonth = net / 12;

  return {
    ...base,
    overtimeHours,
    overtimeRate,
    overtimeGross,
    overtimeNet,
    overtimeTaxAndNi,
    gross,
    tax,
    ni,
    net,
    costsMonth,
    essentialsMonth,
    costsYear,
    remainingYear,
    remainingMonth,
    actualHours,
    paidHours,
    deductions,
    grossMonth,
    netMonth,
    netWeekly: net / base.paidWeeks,
    netPerPaidHour: net / paidHours,
    realHourly: remainingYear / actualHours
  };
}

function markPending() {
  setText('monthlyCostsPreview', money(monthlyCosts()));
  if (!hasCalculated) return;
  element('calculationStatus').classList.add('pending');
  setText('calculationStatus', 'Changes not applied yet. Press update.');
  setText('calculateButton', 'Update calculation');
}

function renderMainResults(c) {
  setText('baseGrossYear', money(c.baseGross));
  setText('overtimeGrossYear', money(c.overtimeGross));
  setText('grossYear', money(c.gross));
  setText('taxYear', `−${money(c.tax)}`);
  setText('niYear', `−${money(c.ni)}`);
  setText('netYear', money(c.net));
  setText('netMonth', money(c.netMonth));
  setText('netMonthAfterCosts', `${money(c.remainingMonth)} after entered monthly costs`);
  setText('netWeek', money(c.netWeekly));
  setText('netHour', money(c.netPerPaidHour, 2));
  setText('realHour', money(c.realHourly, 2));
  setText('deductionPercent', `${c.gross > 0 ? (c.deductions / c.gross * 100).toFixed(1) : '0.0'}%`);
  setText('costPercent', `${c.net > 0 ? (c.costsYear / c.net * 100).toFixed(1) : '0.0'}%`);
  setText('remainingMonth', money(c.remainingMonth));
  setText('monthlyCostsPreview', money(c.costsMonth));
}

function renderSnapshot(c) {
  setText('grossMonthBox', money(c.grossMonth));
  setText('overtimeNetBox', money(c.overtimeNet));
  setText('leaveValueBox', money(c.leaveIsPaid ? c.leaveValue : c.unpaidLeaveLost));
  setText('leaveValueNote', c.leaveIsPaid ? 'estimated pay received during leave' : 'estimated gross pay lost to unpaid leave');
  setText('essentialCostsBox', money(c.essentialsMonth));
  setText('availableBox', money(c.remainingMonth));
  setText('emergencyFundBox', money(c.essentialsMonth * 3));
}

function renderDonut(c) {
  const gross = Math.max(c.gross, 1);
  const taxPct = clamp(c.tax / gross * 100, 0, 100);
  const niPct = clamp(c.ni / gross * 100, 0, 100 - taxPct);
  const costsPct = clamp(c.costsYear / gross * 100, 0, 100 - taxPct - niPct);
  const remainingPct = Math.max(0, 100 - taxPct - niPct - costsPct);
  const taxEnd = taxPct;
  const niEnd = taxEnd + niPct;
  const costsEnd = niEnd + costsPct;

  element('incomeDonut').style.background = `conic-gradient(
    #2563eb 0 ${taxEnd}%,
    #14b8a6 ${taxEnd}% ${niEnd}%,
    #f59e0b ${niEnd}% ${costsEnd}%,
    #22c55e ${costsEnd}% 100%
  )`;
  setText('donutRemaining', `${remainingPct.toFixed(0)}%`);

  const items = [
    ['Income Tax', c.tax, '#2563eb'],
    ['National Insurance', c.ni, '#14b8a6'],
    ['Entered costs', c.costsYear, '#f59e0b'],
    ['Left after costs', Math.max(0, c.remainingYear), '#22c55e']
  ];
  const legend = element('incomeLegend');
  legend.innerHTML = '';
  for (const [label, amount, colour] of items) {
    const row = document.createElement('div');
    row.innerHTML = `<span class="legend-dot" style="background:${colour}"></span><span>${label}</span><strong>${money(amount)}</strong>`;
    legend.append(row);
  }
}

function renderBars(c) {
  const values = [
    ['Gross pay', c.grossMonth],
    ['Take-home', c.netMonth],
    ['Monthly costs', c.costsMonth],
    ['Left after costs', Math.max(0, c.remainingMonth)]
  ];
  const max = Math.max(...values.map(item => item[1]), 1);
  const chart = element('monthlyBars');
  chart.innerHTML = '';
  for (const [label, amount] of values) {
    const row = document.createElement('div');
    row.className = 'bar-row';
    row.innerHTML = `<div class="bar-label"><span>${label}</span><strong>${money(amount)}</strong></div><div class="bar-track"><span style="width:${clamp(amount / max * 100, 0, 100)}%"></span></div>`;
    chart.append(row);
  }
}

function renderOvertimeChart(c) {
  const keptPercentage = c.overtimeGross > 0 ? clamp(c.overtimeNet / c.overtimeGross * 100, 0, 100) : 0;
  setText('overtimeGrossChart', money(c.overtimeGross));
  setText('overtimeNetChart', money(c.overtimeNet));
  element('overtimeKeepBar').style.width = `${keptPercentage}%`;
}

function renderBudget(c) {
  const remainingPositive = Math.max(0, c.remainingMonth);
  const suggestedSavings = c.netMonth > 0
    ? Math.min(c.netMonth * 0.20, remainingPositive * 0.60)
    : 0;
  const flexible = Math.max(0, remainingPositive - suggestedSavings);
  const emergency = c.essentialsMonth * 3;
  const essentialsPct = c.netMonth > 0 ? c.essentialsMonth / c.netMonth * 100 : 0;
  const costsPct = c.netMonth > 0 ? clamp(c.costsMonth / c.netMonth * 100, 0, 100) : 0;
  const savingsPct = c.netMonth > 0 ? clamp(suggestedSavings / c.netMonth * 100, 0, 100 - costsPct) : 0;
  const flexiblePct = Math.max(0, 100 - costsPct - savingsPct);

  setText('budgetEssentials', money(c.essentialsMonth));
  setText('budgetEssentialsPct', `${essentialsPct.toFixed(1)}% of take-home`);
  setText('budgetSavings', money(suggestedSavings));
  setText('budgetFlexible', money(flexible));
  setText('budgetEmergency', money(emergency));
  element('budgetNeedsBar').style.width = `${costsPct}%`;
  element('budgetWantsBar').style.width = `${flexiblePct}%`;
  element('budgetSavingsBar').style.width = `${savingsPct}%`;

  const tips = [];
  const housing = value('housingCost');
  const subscriptions = value('subscriptionsCost');
  const debt = value('debtCost');

  if (c.costsMonth === 0) {
    tips.push('Add your monthly costs to turn this into a personal budget rather than only a wage estimate.');
  }
  if (c.remainingMonth < 0) {
    tips.push(`Your entered spending is ${money(Math.abs(c.remainingMonth))} above your monthly take-home. Start by checking flexible costs and any figures that may have been entered twice.`);
  } else if (c.remainingMonth === 0) {
    tips.push('Your entered costs use all of your estimated take-home pay, leaving no monthly buffer.');
  } else {
    tips.push(`You currently have about ${money(c.remainingMonth)} left each month after the costs entered.`);
    if (suggestedSavings > 0) {
      tips.push(`A cautious starting savings amount is ${money(suggestedSavings)} a month, while leaving about ${money(flexible)} for flexible spending and unexpected costs.`);
    }
  }
  if (c.netMonth > 0 && housing / c.netMonth > 0.35) {
    tips.push(`Housing uses ${(housing / c.netMonth * 100).toFixed(0)}% of take-home pay, so it is the biggest pressure point in this budget.`);
  }
  if (c.netMonth > 0 && subscriptions / c.netMonth > 0.05) {
    tips.push(`Subscriptions and entertainment use ${(subscriptions / c.netMonth * 100).toFixed(0)}% of take-home pay. Reviewing these could create quick monthly room.`);
  }
  if (debt > 0 && c.remainingMonth > 0) {
    tips.push('Because debt repayments are included, consider keeping a small emergency buffer before directing every spare pound towards extra repayments.');
  }
  if (c.overtimeGross > 0) {
    tips.push(`Your overtime is estimated to add ${money(c.overtimeNet)} a year after the extra Income Tax and National Insurance caused by it.`);
  }
  if (emergency > 0) {
    tips.push(`Three months of your entered essential costs is about ${money(emergency)}. This is shown as a planning target, not a requirement.`);
  }

  const list = element('personalTips');
  list.innerHTML = '';
  tips.slice(0, 6).forEach(tip => {
    const item = document.createElement('li');
    item.textContent = tip;
    list.append(item);
  });
}

function renderReasons(c) {
  const reasons = [];
  const payTypeLabels = {
    annual: 'annual salary',
    monthly: 'monthly salary',
    weekly: 'weekly wage',
    hourly: 'hourly wage'
  };

  reasons.push(`Your base pay starts from the ${payTypeLabels[c.type]} you entered and is converted into an annual figure.`);

  if (c.leaveWeeks > 0) {
    if (c.leaveIsPaid) {
      reasons.push(`${c.leaveWeeks.toFixed(1)} weeks of paid leave remain included in base pay. Overtime is only counted across the estimated ${c.actualWorkingWeeks.toFixed(1)} weeks actually worked.`);
    } else {
      reasons.push(`${c.leaveWeeks.toFixed(1)} weeks of unpaid leave reduce estimated base gross pay by about ${money(c.unpaidLeaveLost)}.`);
    }
  } else {
    reasons.push('No leave weeks were entered, so no leave adjustment was applied.');
  }

  if (c.overtimeGross > 0) {
    reasons.push(`${c.overtimeHours.toFixed(1)} overtime hours at ${money(c.overtimeRate, 2)} across working weeks add ${money(c.overtimeGross)} to gross yearly pay.`);
  } else {
    reasons.push('No overtime income was added because overtime hours or the overtime rate is zero.');
  }

  reasons.push(`${money(c.tax)} of Income Tax and ${money(c.ni)} of employee National Insurance are estimated from total gross pay.`);

  if (c.costsMonth > 0) {
    reasons.push(`${money(c.costsMonth)} of monthly costs becomes ${money(c.costsYear)} over a year and is deducted from estimated take-home pay to show money left.`);
  } else {
    reasons.push('No monthly spending has been deducted, so real hourly pay currently reflects take-home pay only.');
  }

  reasons.push(`Real hourly pay is based on money left after tax and entered costs divided by about ${Math.round(c.actualHours).toLocaleString('en-GB')} hours actually worked during the year.`);

  const list = element('calculationReasons');
  list.innerHTML = '';
  reasons.forEach(reason => {
    const item = document.createElement('li');
    item.textContent = reason;
    list.append(item);
  });
}

function calculate() {
  const c = calculations();
  hasCalculated = true;
  renderMainResults(c);
  renderSnapshot(c);
  renderDonut(c);
  renderBars(c);
  renderOvertimeChart(c);
  renderBudget(c);
  renderReasons(c);

  element('insightsSection').classList.remove('hidden');
  element('calculationStatus').classList.remove('pending');
  setText('calculationStatus', 'Calculation updated using the current figures.');
  setText('calculateButton', 'Update calculation');
}

function resetCalculator() {
  for (const [id, defaultValue] of Object.entries(defaults)) {
    element(id).value = defaultValue;
  }
  hasCalculated = false;
  updatePayLabel();
  setText('monthlyCostsPreview', money(0));
  element('insightsSection').classList.add('hidden');
  setText('calculationStatus', 'Enter your figures, then update.');
  element('calculationStatus').classList.remove('pending');

  const resultIds = [
    'baseGrossYear', 'overtimeGrossYear', 'grossYear', 'taxYear', 'niYear',
    'netYear', 'netMonth', 'netWeek', 'netHour', 'realHour',
    'deductionPercent', 'costPercent', 'remainingMonth'
  ];
  resultIds.forEach(id => setText(id, '—'));
  setText('netMonthAfterCosts', 'Press update to calculate');
}

for (const id of inputIds) {
  const eventName = element(id).tagName === 'SELECT' ? 'change' : 'input';
  element(id).addEventListener(eventName, () => {
    if (id === 'payType') updatePayLabel();
    markPending();
  });
}

element('calculateButton').addEventListener('click', calculate);
element('resetButton').addEventListener('click', resetCalculator);
updatePayLabel();
setText('monthlyCostsPreview', money(monthlyCosts()));
