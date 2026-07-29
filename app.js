const TAX = {
  year: '2026/27',
  personalAllowance: 12570,
  allowanceTaperStarts: 100000,
  allowanceGoneAt: 125140,
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
  payType: 'annual', payAmount: 30000, hoursPerWeek: 37.5, weeksPerYear: 52, daysPerWeek: 5,
  expenses: [
    ['Council Tax', 140, true], ['Rent or mortgage', 750, true], ['Electricity and gas', 120, true],
    ['Water', 35, true], ['Internet', 28, true], ['Phone bill', 20, true], ['Transport', 120, true],
    ['Food', 220, true], ['Insurance', 45, true], ['Subscriptions', 25, false], ['Loan repayments', 0, true], ['Other', 50, false]
  ],
  budget: [['Essential bills', 40], ['Food', 10], ['Transport', 8], ['Savings', 12], ['Emergency fund', 8], ['Entertainment', 10], ['Personal spending', 8], ['Other', 4]],
  goalName: 'Emergency fund', goalTarget: 3000, goalSaved: 500, goalMonthly: 200
};
let state = loadState();

function loadState() { try { return { ...defaults, ...JSON.parse(localStorage.getItem('wagewise-state') || '{}') }; } catch { return structuredClone(defaults); } }
function saveState() { localStorage.setItem('wagewise-state', JSON.stringify(state)); }
const money = (n, digits = 0) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Number.isFinite(n) ? n : 0);
const num = id => Math.max(0, Number(document.getElementById(id).value) || 0);

function annualGross() {
  const amount = state.payAmount;
  if (state.payType === 'monthly') return amount * 12;
  if (state.payType === 'weekly') return amount * state.weeksPerYear;
  if (state.payType === 'hourly') return amount * state.hoursPerWeek * state.weeksPerYear;
  return amount;
}
function incomeTax(gross) {
  let allowance = TAX.personalAllowance;
  if (gross > TAX.allowanceTaperStarts) allowance = Math.max(0, TAX.personalAllowance - (gross - TAX.allowanceTaperStarts) / 2);
  const taxable = Math.max(0, gross - allowance);
  const basic = Math.min(taxable, TAX.basicBand) * TAX.basicRate;
  const higherLimitTaxable = Math.max(0, TAX.additionalThreshold - allowance - TAX.basicBand);
  const higher = Math.min(Math.max(0, taxable - TAX.basicBand), higherLimitTaxable) * TAX.higherRate;
  const additional = Math.max(0, gross - TAX.additionalThreshold) * TAX.additionalRate;
  return basic + higher + additional;
}
function nationalInsurance(gross) {
  const main = Math.min(Math.max(0, gross - TAX.niPrimaryThreshold), TAX.niUpperEarningsLimit - TAX.niPrimaryThreshold) * TAX.niMainRate;
  const upper = Math.max(0, gross - TAX.niUpperEarningsLimit) * TAX.niUpperRate;
  return main + upper;
}
function calculations() {
  const gross = annualGross(); const tax = incomeTax(gross); const ni = nationalInsurance(gross); const net = Math.max(0, gross - tax - ni);
  const hoursYear = Math.max(1, state.hoursPerWeek * state.weeksPerYear); const daysYear = Math.max(1, state.daysPerWeek * state.weeksPerYear);
  const expensesMonth = state.expenses.reduce((sum, x) => sum + Number(x[1] || 0), 0); const expensesYear = expensesMonth * 12;
  const essentialMonth = state.expenses.filter(x => x[2]).reduce((sum, x) => sum + Number(x[1] || 0), 0);
  return { gross, tax, ni, net, hoursYear, daysYear, expensesMonth, expensesYear, essentialMonth, remainingMonth: net / 12 - expensesMonth, remainingYear: net - expensesYear, effectiveHourly: (net - expensesYear) / hoursYear };
}

function update() {
  const c = calculations(); saveState();
  const set = (id, value) => document.getElementById(id).textContent = value;
  set('heroTakeHome', money(c.net / 12)); set('heroHourly', money(c.effectiveHourly, 2)); set('heroSubtext', `${money(c.net)} estimated take-home each year after Income Tax and National Insurance.`);
  set('dashGrossYear', money(c.gross)); set('dashTax', money(c.tax)); set('dashNI', money(c.ni)); set('dashExpenses', money(c.expensesMonth)); set('dashRemaining', money(c.remainingMonth));
  const savingsBudget = state.budget.filter(x => /saving|emergency/i.test(x[0])).reduce((s,x)=>s+Number(x[1]||0),0); set('dashSavings', money(c.net / 12 * savingsBudget / 100));
  set('grossYear', money(c.gross)); set('grossMonth', money(c.gross / 12)); set('grossWeek', money(c.gross / state.weeksPerYear)); set('grossDay', money(c.gross / c.daysYear)); set('grossHour', money(c.gross / c.hoursYear, 2));
  set('taxYear', `−${money(c.tax)}`); set('niYear', `−${money(c.ni)}`); set('netYear', money(c.net)); set('netMonth', money(c.net / 12)); set('netWeek', money(c.net / state.weeksPerYear)); set('netDay', money(c.net / c.daysYear)); set('netHour', money(c.net / c.hoursYear, 2));
  set('expenseTotalMonth', money(c.expensesMonth)); set('expenseTotalYear', money(c.expensesYear)); set('expenseRemainingMonth', money(c.remainingMonth)); set('effectiveHourly', money(c.effectiveHourly, 2));
  set('legendIncome', money(c.net / 12)); set('legendExpense', money(c.expensesMonth)); set('legendRemain', money(c.remainingMonth));
  const spentPct = c.net > 0 ? Math.min(100, Math.max(0, c.expensesYear / c.net * 100)) : 0; set('donutPercent', `${spentPct.toFixed(0)}%`); document.getElementById('expenseDonut').style.background = `conic-gradient(var(--blue) ${spentPct * 3.6}deg, #e8edf5 0deg)`;
  renderIncomeBars(c); updateBudget(c); updateGoal();
}
function renderIncomeBars(c) {
  const values = [['Take-home', c.net], ['Income Tax', c.tax], ['National Insurance', c.ni], ['Expenses', c.expensesYear]];
  const max = Math.max(c.gross, 1); const el = document.getElementById('incomeBars'); el.innerHTML = '';
  values.forEach(([name, value]) => { const row = document.createElement('div'); row.className = 'bar-row'; row.innerHTML = `<span>${name}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.min(100,value/max*100)}%"></div></div><strong>${money(value)}</strong>`; el.append(row); });
}
function renderExpenses() {
  const list = document.getElementById('expenseList'); list.innerHTML = '';
  state.expenses.forEach((expense, i) => {
    const row = document.getElementById('expenseTemplate').content.firstElementChild.cloneNode(true);
    const name = row.querySelector('.expense-name'), amount = row.querySelector('.expense-amount'), essential = row.querySelector('.expense-essential');
    name.value = expense[0]; amount.value = expense[1]; essential.checked = !!expense[2];
    name.oninput = e => { state.expenses[i][0] = e.target.value; update(); };
    amount.oninput = e => { state.expenses[i][1] = Number(e.target.value); update(); };
    essential.onchange = e => { state.expenses[i][2] = e.target.checked; update(); };
    row.querySelector('.remove-expense').onclick = () => { state.expenses.splice(i,1); renderExpenses(); update(); };
    list.append(row);
  });
}
function renderBudget() {
  const list = document.getElementById('budgetList'); list.innerHTML = '';
  state.budget.forEach((item, i) => {
    const row = document.getElementById('budgetTemplate').content.firstElementChild.cloneNode(true);
    const name = row.querySelector('.budget-name'), pct = row.querySelector('.budget-percent'); name.value = item[0]; pct.value = item[1];
    name.oninput = e => { state.budget[i][0] = e.target.value; update(); };
    pct.oninput = e => { state.budget[i][1] = Number(e.target.value); update(); };
    row.querySelector('.remove-budget').onclick = () => { state.budget.splice(i,1); renderBudget(); update(); };
    list.append(row);
  });
  update();
}
function updateBudget(c = calculations()) {
  const available = c.net / 12; let totalPct = 0;
  document.querySelectorAll('.budget-row').forEach((row, i) => { const pct = Number(state.budget[i]?.[1] || 0); totalPct += pct; row.querySelector('.budget-amount').textContent = money(available * pct / 100); });
  const planned = available * totalPct / 100, unallocated = available - planned;
  document.getElementById('budgetAvailable').textContent = money(available); document.getElementById('budgetPlanned').textContent = money(planned); document.getElementById('budgetUnallocated').textContent = money(unallocated); document.getElementById('budgetPercentage').textContent = `${totalPct.toFixed(0)}%`;
  document.getElementById('budgetProgress').style.width = `${Math.min(100,totalPct)}%`; document.getElementById('budgetWarning').classList.toggle('hidden', totalPct <= 100);
}
function updateGoal() {
  const target = state.goalTarget, saved = Math.min(state.goalSaved, target || state.goalSaved), monthly = state.goalMonthly, remaining = Math.max(0, target - saved), pct = target > 0 ? Math.min(100, saved / target * 100) : 0, months = monthly > 0 ? Math.ceil(remaining / monthly) : 0;
  document.getElementById('goalDisplayName').textContent = state.goalName || 'Savings goal'; document.getElementById('goalPercent').textContent = `${pct.toFixed(0)}%`; document.getElementById('goalRemaining').textContent = money(remaining); document.getElementById('goalMonths').textContent = remaining === 0 ? 'Complete' : monthly > 0 ? `${months} month${months===1?'':'s'}` : 'Set a contribution';
  const date = new Date(); date.setMonth(date.getMonth() + months); document.getElementById('goalDate').textContent = remaining === 0 ? 'Already reached' : monthly > 0 ? date.toLocaleDateString('en-GB',{month:'long',year:'numeric'}) : '—';
  document.getElementById('goalRing').style.background = `conic-gradient(var(--blue) ${pct * 3.6}deg, #e8edf5 0deg)`;
}
function bindInputs() {
  ['payType','payAmount','hoursPerWeek','weeksPerYear','daysPerWeek'].forEach(id => document.getElementById(id).addEventListener('input', e => { state[id] = id === 'payType' ? e.target.value : Number(e.target.value); if(id==='payType') updatePayLabel(); update(); }));
  ['goalName','goalTarget','goalSaved','goalMonthly'].forEach(id => document.getElementById(id).addEventListener('input', e => { state[id] = id === 'goalName' ? e.target.value : Number(e.target.value); update(); }));
}
function updatePayLabel() { const labels = {annual:'Annual salary (£)',monthly:'Monthly salary (£)',weekly:'Weekly wage (£)',hourly:'Hourly wage (£)'}; document.getElementById('payAmountLabel').childNodes[0].textContent = labels[state.payType]; }
function hydrate() { ['payType','payAmount','hoursPerWeek','weeksPerYear','daysPerWeek','goalName','goalTarget','goalSaved','goalMonthly'].forEach(id => document.getElementById(id).value = state[id]); updatePayLabel(); }

const titles = { dashboard:['Overview','Your money dashboard'], wage:['Pay calculator','Understand your wage'], expenses:['Real earnings','Track regular expenses'], budget:['Plan your money','Build a monthly budget'], savings:['Financial goals','Plan your savings'], settings:['App settings','Calculation assumptions'] };
document.querySelectorAll('.nav-item').forEach(btn => btn.onclick = () => { document.querySelectorAll('.nav-item,.page').forEach(x=>x.classList.remove('active')); btn.classList.add('active'); document.getElementById(`${btn.dataset.page}Page`).classList.add('active'); document.getElementById('pageEyebrow').textContent = titles[btn.dataset.page][0]; document.getElementById('pageTitle').textContent = titles[btn.dataset.page][1]; document.getElementById('sidebar').classList.remove('open'); });
document.getElementById('menuButton').onclick = () => document.getElementById('sidebar').classList.toggle('open');
document.getElementById('addExpenseButton').onclick = () => { state.expenses.push(['New expense',0,false]); renderExpenses(); update(); };
document.getElementById('addBudgetButton').onclick = () => { state.budget.push(['New category',0]); renderBudget(); };
document.getElementById('applyBudgetTemplate').onclick = () => { state.budget = [['Essential bills',40],['Food',10],['Transport',8],['Savings',12],['Emergency fund',8],['Entertainment',10],['Personal spending',8],['Other',4]]; renderBudget(); };
document.getElementById('resetButton').onclick = () => { if(confirm('Reset all wage, expense, budget and savings data?')) { state = structuredClone(defaults); hydrate(); renderExpenses(); renderBudget(); update(); } };

hydrate(); bindInputs(); renderExpenses(); renderBudget(); update();
