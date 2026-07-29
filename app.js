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
  housingCost: 0,
  councilTaxCost: 0,
  livingCost: 0,
  otherCost: 0
};

const ids = Object.keys(defaults);
const element = id => document.getElementById(id);
const value = id => Math.max(0, Number(element(id).value) || 0);
const money = (amount, digits = 0) => new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  minimumFractionDigits: digits,
  maximumFractionDigits: digits
}).format(Number.isFinite(amount) ? amount : 0);

function annualGross() {
  const type = element('payType').value;
  const amount = value('payAmount');
  const hours = value('hoursPerWeek');
  const weeks = Math.max(1, value('weeksPerYear'));

  if (type === 'monthly') return amount * 12;
  if (type === 'weekly') return amount * weeks;
  if (type === 'hourly') return amount * hours * weeks;
  return amount;
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

function monthlyCosts() {
  return value('housingCost') + value('councilTaxCost') + value('livingCost') + value('otherCost');
}

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
  element('payAmountLabel').childNodes[0].textContent = `${labels[element('payType').value]}\n            `;
}

function calculate() {
  const gross = annualGross();
  const tax = incomeTax(gross);
  const ni = nationalInsurance(gross);
  const net = Math.max(0, gross - tax - ni);
  const weeks = Math.max(1, value('weeksPerYear'));
  const hoursYear = Math.max(1, value('hoursPerWeek') * weeks);
  const costsMonth = monthlyCosts();
  const costsYear = costsMonth * 12;
  const remaining = net - costsYear;
  const deductions = tax + ni;

  setText('monthlyCostsTotal', money(costsMonth));
  setText('grossYear', money(gross));
  setText('taxYear', `−${money(tax)}`);
  setText('niYear', `−${money(ni)}`);
  setText('netYear', money(net));
  setText('netMonth', money(net / 12));
  setText('netMonthAfterCosts', `${money(net / 12 - costsMonth)} after monthly costs`);
  setText('netWeek', money(net / weeks));
  setText('netHour', money(net / hoursYear, 2));
  setText('realHour', money(remaining / hoursYear, 2));
  setText('deductionPercent', `${gross > 0 ? (deductions / gross * 100).toFixed(1) : '0.0'}%`);
  setText('costPercent', `${net > 0 ? (costsYear / net * 100).toFixed(1) : '0.0'}%`);
  setText('remainingYear', `${money(remaining)}/year`);
}

function resetCalculator() {
  for (const [id, defaultValue] of Object.entries(defaults)) {
    element(id).value = defaultValue;
  }
  updatePayLabel();
  calculate();
}

for (const id of ids) {
  element(id).addEventListener('input', () => {
    if (id === 'payType') updatePayLabel();
    calculate();
  });
}

element('resetButton').addEventListener('click', resetCalculator);
updatePayLabel();
calculate();
