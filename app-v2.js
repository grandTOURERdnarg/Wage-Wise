import {
  CONFIG, calculatePay, projectIncomeAndPension, calculateCarAffordability,
  calculateMortgageEstimate, validateInputs
} from './core.js';

const $ = id => document.getElementById(id);
const money = (value, digits = 0) => new Intl.NumberFormat('en-GB', {
  style: 'currency', currency: 'GBP', minimumFractionDigits: digits, maximumFractionDigits: digits
}).format(Number.isFinite(Number(value)) ? Number(value) : 0);
const pct = value => `${Number.isFinite(Number(value)) ? Number(value).toFixed(1) : '0.0'}%`;
const num = id => Number($(id)?.value) || 0;

let payResult = null;
let projectionResult = null;
let activePeriod = 'hour';
let activeEstimate = 'standard';
let chartYears = 5;
let chartMode = 'yearly';
let chartMoney = 'nominal';

const defaults = {
  payType:'annual',payAmount:30000,payFrequency:'monthly',hoursPerWeek:37.5,daysPerWeek:5,paidWeeks:52,
  overtimeHours:0,overtimeRate:0,overtimeWeeks:0,leaveWeeks:5.6,leavePaid:'yes',
  expHousing:0,expCouncilTax:0,expUtilities:0,expFood:0,expTransport:0,expLiving:0,expDebt:0,expFinance:0,expSubscriptions:0,expOptional:0,expOther:0,
  pensionSchemeType:'definedContribution',pensionBasis:'full',pensionablePay:30000,pensionMethod:'simple',employeePensionPct:5,employerPensionPct:3,currentPension:0,currentAge:30,retirementAge:68,pensionGrowthPct:5,pensionFeePct:.5,desiredRetirementIncome:30000,statePensionAnnual:0,drawdownPct:4,
  wageGrowthPct:2,expenseGrowthPct:2,overtimeGrowthPct:0,inflationPct:2,projectionYears:10
};

const expenseIds = ['expHousing','expCouncilTax','expUtilities','expFood','expTransport','expLiving','expDebt','expFinance','expSubscriptions','expOptional','expOther'];
const inputIds = Object.keys(defaults);

function showMessage(text, type = 'error') {
  $('messageArea').innerHTML = text ? `<div class="${type}">${text}</div>` : '';
}

function showTab(name) {
  document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.toggle('active', panel.dataset.panel === name));
  document.querySelectorAll('.nav-tab').forEach(button => button.classList.toggle('active', button.dataset.tab === name));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function updatePayLabel() {
  const labels = {
    annual:['Annual salary (£)','Your yearly contractual salary before deductions.'],
    monthly:['Monthly salary (£)','Your normal gross monthly pay before deductions.'],
    weekly:['Weekly wage (£)','Your normal gross pay for each paid or contract week.'],
    hourly:['Hourly wage (£)','Your standard hourly rate before overtime.']
  };
  const [label, help] = labels[$('payType').value];
  $('payAmountLabel').childNodes[0].textContent = `${label}\n              `;
  $('payAmountHelp').textContent = help;
}

function expensesObject() {
  return {
    housing:num('expHousing'), councilTax:num('expCouncilTax'), utilities:num('expUtilities'),
    food:num('expFood'), transport:num('expTransport'), living:num('expLiving'), debt:num('expDebt'),
    finance:num('expFinance'), subscriptions:num('expSubscriptions'), optional:num('expOptional'), other:num('expOther')
  };
}

function updateExpensePreview() {
  const total = Object.values(expensesObject()).reduce((sum, value) => sum + value, 0);
  $('expensePreview').textContent = money(total);
}

function gatherPayInput() {
  return {
    payType:$('payType').value,
    payAmount:num('payAmount'),
    payFrequency:$('payFrequency').value,
    hoursPerWeek:num('hoursPerWeek'),
    daysPerWeek:num('daysPerWeek'),
    paidWeeks:num('paidWeeks'),
    overtimeHours:num('overtimeHours'),
    overtimeRate:num('overtimeRate'),
    overtimeWeeks:num('overtimeWeeks'),
    leaveWeeks:num('leaveWeeks'),
    leavePaid:$('leavePaid').value === 'yes',
    expenses:expensesObject()
  };
}

function gatherProjectionSettings() {
  return {
    pensionSchemeType:$('pensionSchemeType').value,
    pensionBasis:$('pensionBasis').value,
    pensionablePay:num('pensionablePay'),
    pensionMethod:$('pensionMethod').value,
    employeePensionPct:num('employeePensionPct'),
    employerPensionPct:num('employerPensionPct'),
    currentPension:num('currentPension'),
    currentAge:num('currentAge'),
    retirementAge:num('retirementAge'),
    pensionGrowthPct:num('pensionGrowthPct'),
    pensionFeePct:num('pensionFeePct'),
    desiredRetirementIncome:num('desiredRetirementIncome'),
    statePensionAnnual:num('statePensionAnnual'),
    includeStatePension:num('statePensionAnnual') > 0,
    drawdownPct:num('drawdownPct'),
    wageGrowthPct:num('wageGrowthPct'),
    expenseGrowthPct:num('expenseGrowthPct'),
    overtimeGrowthPct:num('overtimeGrowthPct'),
    inflationPct:num('inflationPct'),
    projectionYears:num('projectionYears')
  };
}

function validationSummary(payInput, settings) {
  const validation = validateInputs({ ...payInput, ...settings });
  const extraErrors = [];
  if (settings.currentAge < 16 || settings.currentAge >= settings.retirementAge) extraErrors.push('Current age must be at least 16 and below retirement age.');
  if (settings.projectionYears < 1 || settings.projectionYears > 60) extraErrors.push('Projection years must be between 1 and 60.');
  if (settings.pensionFeePct > 5) extraErrors.push('Annual pension fees must be 5% or below for this estimator.');
  return { errors:[...validation.errors,...extraErrors], warnings:validation.warnings };
}

function calculateAll(targetTab = 'results') {
  const payInput = gatherPayInput();
  const settings = gatherProjectionSettings();
  const validation = validationSummary(payInput, settings);
  if (validation.errors.length) {
    showMessage(`<strong>Please correct these inputs:</strong><br>${validation.errors.join('<br>')}`);
    return false;
  }
  showMessage('');
  payResult = calculatePay(payInput);
  projectionResult = projectIncomeAndPension(payInput, settings);
  if (!payResult.valid || !projectionResult.valid) {
    showMessage('The calculation could not be completed. Check the values entered.');
    return false;
  }
  if (validation.warnings.length) showMessage(`<strong>Please review:</strong><br>${validation.warnings.join('<br>')}`, 'success');
  $('mortgageIncome1').value = Math.round(payResult.gross);
  renderAll();
  showTab(targetTab);
  return true;
}

function periodValues() {
  if (!payResult || !projectionResult) return null;
  const p = payResult;
  const yearly = {
    gross:p.gross,tax:p.tax,ni:p.ni,net:p.net,expenses:p.expensesYear,remaining:p.remainingYear,
    label:'Take-home per year',digits:0
  };
  if (activePeriod === 'hour') return { gross:p.grossHourly,tax:p.tax/p.actualHours,ni:p.ni/p.actualHours,net:p.netHourly,expenses:p.expensesYear/p.actualHours,remaining:p.remainingHourly,label:'Take-home per worked hour',digits:2 };
  if (activePeriod === 'day') return { gross:p.grossDaily,tax:p.tax/p.actualDays,ni:p.ni/p.actualDays,net:p.netDaily,expenses:p.expensesYear/p.actualDays,remaining:p.remainingDaily,label:'Take-home per working day',digits:2 };
  if (activePeriod === 'week') return { gross:p.grossWeekly,tax:p.tax/p.paidWeeks,ni:p.ni/p.paidWeeks,net:p.netWeekly,expenses:p.expensesYear/p.paidWeeks,remaining:p.remainingWeekly,label:'Take-home per paid or contract week',digits:2 };
  if (activePeriod === 'month') return { gross:p.grossMonthly,tax:p.tax/12,ni:p.ni/12,net:p.netMonthly,expenses:p.expensesMonth,remaining:p.remainingMonthly,label:'Take-home per month',digits:2 };
  if (activePeriod === 'five') return { gross:projectionResult.fiveYear.gross,tax:projectionResult.fiveYear.tax,ni:projectionResult.fiveYear.ni,net:projectionResult.fiveYear.net,expenses:projectionResult.fiveYear.expenses,remaining:projectionResult.fiveYear.remaining,label:'Take-home across five separately calculated years',digits:0 };
  return yearly;
}

function renderPeriod() {
  const values = periodValues();
  if (!values) return;
  $('periodLabel').textContent = values.label;
  $('periodNet').textContent = money(values.net, values.digits);
  $('periodRemaining').textContent = `Money remaining after entered expenses: ${money(values.remaining, values.digits)}`;
  $('metricGross').textContent = money(values.gross, values.digits);
  $('metricTax').textContent = money(values.tax, values.digits);
  $('metricNi').textContent = money(values.ni, values.digits);
  $('metricNet').textContent = money(values.net, values.digits);
  $('metricExpenses').textContent = money(values.expenses, values.digits);
  $('metricRemaining').textContent = money(values.remaining, values.digits);
  $('effectiveDeduction').textContent = pct(payResult.gross > 0 ? (payResult.tax + payResult.ni) / payResult.gross * 100 : 0);
}

function estimateCard(title, items, note = '') {
  return `<h2>${title}</h2><div class="estimate-grid">${items.map(item => `<div><span>${item[0]}</span><strong>${item[1]}</strong>${item[2] ? `<small>${item[2]}</small>` : ''}</div>`).join('')}</div>${note ? `<p class="clarification">${note}</p>` : ''}`;
}

function renderEstimate() {
  if (!payResult || !projectionResult) return;
  const p = payResult;
  const pension = projectionResult.pension;
  const content = {
    standard: estimateCard('Standard pay', [
      ['Base gross yearly',money(p.baseGross)],['Gross hourly',money(p.grossHourly,2)],['Gross per working day',money(p.grossDaily,2)],['Take-home yearly',money(p.net)],['Actual hours worked',`${p.actualHours.toFixed(1)} hrs`],['Actual working days',`${p.actualDays.toFixed(1)} days`]
    ], 'Hourly and daily figures use actual worked hours and days. Weekly figures use paid or contract weeks.'),
    overtimeEstimate: estimateCard('Overtime estimate', [
      ['Overtime weeks',`${p.overtimeWeeks}`],['Extra hours yearly',`${p.overtimeHoursYear.toFixed(1)} hrs`],['Gross overtime',money(p.overtimeGross)],['Extra Income Tax',money(p.overtimeExtraTax)],['Extra employee NI',money(p.overtimeExtraNI)],['Overtime kept',money(p.overtimeNet)],['Effective take-home rate',money(p.overtimeNetRate,2)],['Percentage kept',pct(p.overtimeKeptPct)]
    ], 'Overtime deductions are calculated by comparing tax and NI with overtime against the same calculation without overtime.'),
    leaveImpact: estimateCard('Leave impact', [
      ['Leave type',p.paidLeave?'Paid leave':'Unpaid leave'],['Leave weeks',p.leaveWeeks.toFixed(1)],['Actual working weeks',p.actualWorkingWeeks.toFixed(1)],['Gross value of leave',money(p.leaveGrossValue)],['Gross pay lost',money(p.unpaidLeaveLostGross)],['Estimated take-home lost',money(p.unpaidLeaveLostNet)]
    ], p.paidLeave ? 'Paid leave keeps normal contractual pay while reducing actual worked hours.' : 'Unpaid leave is estimated as the normal weekly gross amount multiplied by unpaid leave weeks. Real payroll methods can differ by contract.'),
    taxNi: estimateCard('Tax and National Insurance', [
      ['Tax year',CONFIG.taxYear],['Region',CONFIG.region],['Personal Allowance',money(CONFIG.tax.personalAllowance)],['Income Tax',money(p.tax)],['Employee NI',money(p.ni)],['Total deductions',money(p.tax+p.ni)],['Effective rate',pct(p.gross?((p.tax+p.ni)/p.gross*100):0)],['Payroll frequency',p.payFrequency]
    ], 'Income Tax is an annual liability estimate. NI uses the selected weekly or monthly pay period and assumes overtime is spread according to the entered overtime weeks.'),
    expenseResult: estimateCard('Expenses and real income', [
      ['Monthly expenses',money(p.expensesMonth)],['Yearly expenses',money(p.expensesYear)],['Take-home before expenses',money(p.netMonthly)],['Money remaining monthly',money(p.remainingMonth)],['Expense impact per hour',money(p.expensesYear/p.actualHours,2)],['Real income per hour',money(p.remainingHourly,2)]
    ], 'Money remaining after expenses is not payslip take-home pay. It is the amount left after subtracting the costs you entered.'),
    pensionResult: estimateCard('Pension estimate', [
      ['Projected pot at retirement',money(pension.balanceAtRetirement)],['Employee deposits',money(pension.employeeDeposits)],['Employer deposits',money(pension.employerDeposits)],['Estimated investment growth',money(pension.investmentGrowth)],['Estimated fees',money(pension.fees)],['Combined retirement income',money(pension.combinedRetirementIncome)],['Target achieved',pct(pension.targetRatio*100)],['Gap or surplus',money(pension.gapOrSurplus)]
    ], $('pensionSchemeType').value === 'definedBenefit' ? 'Defined-benefit pensions cannot be reliably estimated from contribution percentages and investment growth.' : 'The pot is a monthly contribution-and-growth illustration. Returns, fees, inflation and withdrawal choices can change the result.'),
    fiveProjection: estimateCard('Five-year projection', [
      ['Total gross',money(projectionResult.fiveYear.gross)],['Total Income Tax',money(projectionResult.fiveYear.tax)],['Total employee NI',money(projectionResult.fiveYear.ni)],['Total take-home',money(projectionResult.fiveYear.net)],['Total overtime',money(projectionResult.fiveYear.overtime)],['Total expenses',money(projectionResult.fiveYear.expenses)],['Money remaining',money(projectionResult.fiveYear.remaining)],['Pension balance after five years',money(projectionResult.fiveYear.pensionBalance)]
    ], 'Each year is calculated separately using your growth assumptions. Tax and NI thresholds are held fixed at 2026/27 levels.')
  };
  $('estimateContent').innerHTML = content[activeEstimate];
}

function renderExplanation() {
  const p = payResult;
  const lines = [
    `Your normal pay converts to ${money(p.fullYearBase)} gross for a full paid year.`,
    p.paidLeave ? `${p.leaveWeeks.toFixed(1)} weeks of paid leave keep normal pay but reduce actual hours worked.` : `${p.leaveWeeks.toFixed(1)} weeks of unpaid leave reduce gross pay by approximately ${money(p.unpaidLeaveLostGross)}.`,
    p.overtimeGross > 0 ? `${p.overtimeHoursYear.toFixed(1)} overtime hours add ${money(p.overtimeGross)} gross; approximately ${money(p.overtimeNet)} remains after the extra tax and NI attributed to overtime.` : 'No overtime income is included because overtime hours, rate or weeks are zero.',
    `Estimated yearly Income Tax is ${money(p.tax)} and employee NI is ${money(p.ni)}.`,
    `Entered expenses total ${money(p.expensesMonth)} per month, leaving ${money(p.remainingMonth)} per month after those costs.`
  ];
  $('calculationExplanation').innerHTML = `<ul>${lines.map(line=>`<li>${line}</li>`).join('')}</ul>`;
}

function lineChart(container, labels, series) {
  const width = 720, height = 290, pad = {l:52,r:18,t:24,b:38};
  const all = series.flatMap(item => item.values).filter(Number.isFinite);
  const minValue = Math.min(0, ...all), maxValue = Math.max(1, ...all);
  const range = maxValue - minValue || 1;
  const x = i => labels.length === 1 ? width/2 : pad.l + i * (width-pad.l-pad.r)/(labels.length-1);
  const y = value => pad.t + (maxValue-value)/range*(height-pad.t-pad.b);
  const colours = ['#2563eb','#0f9f8f','#16a34a','#d97706','#7c3aed'];
  let svg = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Financial projection line chart">`;
  for(let i=0;i<5;i++){const yy=pad.t+i*(height-pad.t-pad.b)/4;const val=maxValue-i*range/4;svg+=`<line class="chart-gridline" x1="${pad.l}" y1="${yy}" x2="${width-pad.r}" y2="${yy}"/><text class="chart-label" x="4" y="${yy+4}">${compactMoney(val)}</text>`;}
  svg+=`<line class="chart-axis" x1="${pad.l}" y1="${height-pad.b}" x2="${width-pad.r}" y2="${height-pad.b}"/>`;
  labels.forEach((label,i)=>{if(labels.length<=10||i===0||i===labels.length-1||i%Math.ceil(labels.length/8)===0)svg+=`<text class="chart-label" text-anchor="middle" x="${x(i)}" y="${height-12}">${label}</text>`;});
  series.forEach((item,sIndex)=>{
    const colour=item.colour||colours[sIndex%colours.length];
    const points=item.values.map((value,i)=>`${x(i)},${y(value)}`).join(' ');
    const area=`${pad.l},${height-pad.b} ${points} ${x(labels.length-1)},${height-pad.b}`;
    svg+=`<polygon class="chart-area" fill="${colour}" points="${area}"/><polyline class="chart-line" stroke="${colour}" points="${points}"/>`;
    item.values.forEach((value,i)=>{svg+=`<circle class="chart-point" fill="${colour}" cx="${x(i)}" cy="${y(value)}" r="4"><title>${item.name}, ${labels[i]}: ${money(value)}</title></circle>`;});
  });
  svg+='</svg>';
  const legend=`<div class="chart-legend">${series.map((item,i)=>`<span><i style="background:${item.colour||colours[i%colours.length]}"></i>${item.name}</span>`).join('')}</div>`;
  container.innerHTML=svg+legend;
}

function compactMoney(value) {
  const abs=Math.abs(value); const sign=value<0?'-':'';
  if(abs>=1_000_000)return `${sign}£${(abs/1_000_000).toFixed(1)}m`;
  if(abs>=1_000)return `${sign}£${(abs/1_000).toFixed(0)}k`;
  return `${sign}£${abs.toFixed(0)}`;
}

function selectedRows() {
  if (!projectionResult) return [];
  let count = chartYears === 'retirement' ? projectionResult.retirementYears : Number(chartYears);
  count = Math.min(count, projectionResult.rows.length);
  return projectionResult.rows.slice(0, Math.max(1,count));
}

function seriesValues(rows, key, realKey) {
  const values = rows.map(row => chartMoney === 'real' && realKey ? row[realKey] : row[key]);
  if (chartMode === 'cumulative') {
    let sum=0; return values.map(value => (sum += value));
  }
  return values;
}

function renderCharts() {
  if (!projectionResult) return;
  const rows=selectedRows();
  const labels=rows.map(row=>`Y${row.year}`);
  lineChart($('incomeChart'),labels,[
    {name:'Gross pay',values:seriesValues(rows,'gross','realGross'),colour:'#2563eb'},
    {name:'Take-home',values:seriesValues(rows,'net','realNet'),colour:'#0f9f8f'},
    {name:'Money remaining',values:seriesValues(rows,'remaining','realRemaining'),colour:'#16a34a'}
  ]);
  let emp=0, employer=0;
  const employeeValues=rows.map(row=>chartMode==='cumulative'?(emp+=row.employeePension):row.employeePension);
  const employerValues=rows.map(row=>chartMode==='cumulative'?(employer+=row.employerPension):row.employerPension);
  const potValues=rows.map(row=>chartMoney==='real'?row.realPensionBalance:row.pensionBalance);
  lineChart($('pensionChart'),labels,[
    {name:'Pension balance',values:potValues,colour:'#2563eb'},
    {name:chartMode==='cumulative'?'Employee deposits total':'Employee contribution',values:employeeValues,colour:'#0f9f8f'},
    {name:chartMode==='cumulative'?'Employer deposits total':'Employer contribution',values:employerValues,colour:'#d97706'}
  ]);
  const end=rows.at(-1);
  $('incomeChartHeadline').textContent=money(chartMode==='cumulative'?seriesValues(rows,'net','realNet').at(-1):end.net);
  $('pensionChartHeadline').textContent=money(chartMoney==='real'?end.realPensionBalance:end.pensionBalance);
}

function renderPensionHealth() {
  const pension=projectionResult.pension;
  const box=$('pensionHealthIndicator');
  box.className=`health-indicator ${pension.health.code}`;
  $('pensionHealthLabel').textContent=pension.health.label;
  $('pensionHealthDetail').textContent=pension.health.detail;
  $('healthPot').textContent=money(pension.balanceAtRetirement);
  $('healthPrivateIncome').textContent=money(pension.privateAnnualIncome);
  $('healthStateIncome').textContent=money(pension.statePensionAnnual);
  $('healthCombined').textContent=money(pension.combinedRetirementIncome);
  $('healthGap').textContent=money(pension.gapOrSurplus);
  const definedBenefit=$('pensionSchemeType').value==='definedBenefit';
  $('pensionWarning').classList.toggle('hidden',!definedBenefit && num('employerPensionPct')<25);
  if(definedBenefit)$('pensionWarning').textContent='Defined-benefit pension selected: the pot projection is not a reliable valuation of your promised scheme income. Use your scheme statement instead.';
  else if(num('employerPensionPct')>=25)$('pensionWarning').textContent='The employer contribution looks unusually high. Confirm this is a real contribution percentage and not a scheme cost or defined-benefit figure.';
}

function renderBudget() {
  const p=payResult, remaining=Math.max(0,p.remainingMonth);
  const emergency=p.expensesMonth>0?Math.min(remaining*.15,p.expensesMonth*.1):remaining*.1;
  const savings=Math.min(p.netMonthly*.2,remaining*.4);
  const flexible=Math.max(0,p.remainingMonth-emergency-savings);
  const items=[
    ['Monthly take-home',money(p.netMonthly)],['Essential and entered costs',money(p.expensesMonth)],['Money remaining',money(p.remainingMonth)],
    ['Suggested emergency payment',money(emergency)],['Suggested savings',money(savings)],['Flexible after suggestions',money(flexible)],
    ['Real hourly income',money(p.remainingHourly,2)],['Three-month cost buffer',money(p.expensesMonth*3)],['Overtime share of gross',pct(p.gross?p.overtimeGross/p.gross*100:0)],['Expenses share of take-home',pct(p.netMonthly?p.expensesMonth/p.netMonthly*100:0)]
  ];
  $('budgetDashboard').innerHTML=items.map(item=>`<article><span>${item[0]}</span><strong>${item[1]}</strong></article>`).join('');
  const tips=[];
  if(p.expensesMonth===0)tips.push('Add monthly spending to make this guidance more personal.');
  if(p.remainingMonth<0)tips.push(`Entered costs exceed estimated take-home by ${money(Math.abs(p.remainingMonth))} a month. Review required bills first and consider free debt support if payments are difficult.`);
  else tips.push(`About ${money(p.remainingMonth)} remains each month after the costs entered.`);
  const housingPct=p.netMonthly?num('expHousing')/p.netMonthly*100:0;
  if(housingPct>35)tips.push(`Housing uses about ${housingPct.toFixed(0)}% of take-home, so it is one of the strongest pressures on the budget.`);
  const subscriptionsPct=p.netMonthly?num('expSubscriptions')/p.netMonthly*100:0;
  if(subscriptionsPct>5)tips.push('Subscriptions exceed 5% of take-home. Reviewing unused services could release money quickly.');
  if(p.overtimeGross/p.gross>.2)tips.push('More than 20% of gross income comes from overtime. Avoid making essential commitments that require overtime to continue.');
  if(!p.paidLeave&&p.unpaidLeaveLostGross>0)tips.push(`Unpaid leave reduces estimated gross pay by ${money(p.unpaidLeaveLostGross)}. A leave buffer could smooth lower-pay periods.`);
  tips.push(`A three-month buffer based on all entered costs would be about ${money(p.expensesMonth*3)}.`);
  $('budgetTips').innerHTML=tips.map(t=>`<li>${t}</li>`).join('');
  const f=projectionResult.fiveYear;
  $('fiveYearSummary').innerHTML=[['Gross income',f.gross],['Income Tax',f.tax],['Employee NI',f.ni],['Take-home',f.net],['Expenses',f.expenses],['Money remaining',f.remaining],['Pension contributions',f.pensionContributions],['Pension balance after five years',f.pensionBalance]].map(([label,value])=>`<div><span>${label}</span><strong>${money(value)}</strong></div>`).join('');
}

function renderAll() {
  $('resultStatus').textContent=`Updated. Estimated yearly take-home: ${money(payResult.net)}.`;
  renderPeriod();renderEstimate();renderExplanation();renderCharts();renderPensionHealth();renderBudget();
}

function carInput() {
  return {purchaseType:$('carPurchaseType').value,vehiclePrice:num('vehiclePrice'),deposit:num('carDeposit'),aprPct:num('carApr'),termMonths:num('carTerm'),balloonPayment:num('carBalloon'),ownershipMonths:num('carOwnershipMonths'),insurance:num('carInsurance'),fuel:num('carFuel'),vehicleTax:num('carTax'),maintenance:num('carMaintenance'),parking:num('carParking'),otherCarCosts:num('carOther')};
}
function renderCar() {
  if(!payResult&&!calculateAll('car'))return;
  const r=calculateCarAffordability(carInput(),payResult);
  $('mortgageCarFinance').value=Math.round(r.financePayment);
  $('carResults').className='result-dashboard';
  $('carResults').innerHTML=`<div class="dashboard-head"><div><strong>Car affordability result</strong><p>This rating uses your entered take-home, expenses and the full car cost.</p></div><span class="rating ${r.status.code}">${r.status.label}</span></div><div class="dashboard-grid">${[
    ['Finance payment',money(r.financePayment)],['Running costs monthly',money(r.monthlyRunning)],['Cash purchase monthly equivalent',money(r.cashEquivalent)],['Total monthly car cost',money(r.totalMonthly)],['Total yearly car cost',money(r.totalYearly)],['Total amount repaid',money(r.totalRepaid)],['Estimated interest',money(r.interestPaid)],['Final payment',money(r.balloon)],['Share of take-home',pct(r.pctNet)],['Share of disposable income',Number.isFinite(r.pctDisposable)?pct(r.pctDisposable):'Not available'],['Money left after car',money(r.remainingAfterCar)],['Work time needed monthly',`${r.workHoursNeeded.toFixed(1)} hrs`]
  ].map(([a,b])=>`<div><span>${a}</span><strong>${b}</strong></div>`).join('')}</div><p class="clarification">This does not predict finance approval. Lenders consider age, credit history, income stability, debts and their own rules. Remove existing car costs from monthly spending if this estimate would replace them.</p>`;
}

function mortgageInput() {
  return {applicantIncome:num('mortgageIncome1'),secondApplicantIncome:num('mortgageIncome2'),propertyPrice:num('propertyPrice'),depositAmount:num('mortgageDeposit'),termYears:num('mortgageTerm'),interestRatePct:num('mortgageRate'),minIncomeMultiple:num('mortgageMinMultiple'),maxIncomeMultiple:num('mortgageMaxMultiple'),existingDebtPayments:num('mortgageDebt'),carFinancePayments:num('mortgageCarFinance'),creditLoanPayments:num('mortgageCredit'),childcareCosts:num('mortgageChildcare'),otherCommitments:num('mortgageOther'),useExistingSpending:$('mortgageUseSpending').checked};
}
function renderMortgage() {
  if(!payResult&&!calculateAll('mortgage'))return;
  const r=calculateMortgageEstimate(mortgageInput(),payResult);
  $('mortgageResults').className='result-dashboard';
  $('mortgageResults').innerHTML=`<div class="dashboard-head"><div><strong>Illustrative mortgage position</strong><p>This is not an approval or guarantee.</p></div><span class="rating ${r.status.code}">${r.status.label}</span></div><div class="dashboard-grid">${[
    ['Combined gross income',money(r.combinedGross)],['Deposit percentage',pct(r.depositPct)],['Loan required',money(r.loanRequired)],['Loan-to-value',pct(r.ltv)],['Illustrative range low',money(r.mortgageRange.min)],['Illustrative range high',money(r.mortgageRange.max)],['Estimated monthly repayment',money(r.payment)],['Repayment share of take-home',Number.isFinite(r.repaymentPct)?pct(r.repaymentPct):'Not available'],['Monthly commitments',money(r.commitments)],['Non-housing spending included',money(r.nonHousingSpending)],['Money left after mortgage',money(r.remainingAfterMortgage)],['Deposit shortfall to 10%',money(r.depositShortfallFor10Pct)]
  ].map(([a,b])=>`<div><span>${a}</span><strong>${b}</strong></div>`).join('')}</div><p class="clarification">This is an illustrative estimate only. Real lenders assess credit history, employment stability, debts, dependants, expenses, property type, deposit source and their own affordability rules.</p>`;
}

function resetAll() {
  Object.entries(defaults).forEach(([id,value])=>{if($(id))$(id).value=value;});
  $('mortgageUseSpending').checked=true;
  payResult=null;projectionResult=null;activePeriod='hour';activeEstimate='standard';chartYears=5;chartMode='yearly';chartMoney='nominal';
  updatePayLabel();updateExpensePreview();showMessage('');showTab('pay');
  $('resultStatus').textContent='Press “Update all calculations” after entering your figures.';
  ['periodNet','metricGross','metricTax','metricNi','metricNet','metricExpenses','metricRemaining'].forEach(id=>$(id).textContent='—');
  $('estimateContent').innerHTML='<p>Calculation details will appear here.</p>';
  $('calculationExplanation').innerHTML='';
  $('incomeChart').innerHTML='';$('pensionChart').innerHTML='';
  $('carResults').className='result-dashboard muted';$('carResults').innerHTML='<p>Calculate your pay first, then run the car estimate.</p>';
  $('mortgageResults').className='result-dashboard muted';$('mortgageResults').innerHTML='<p>Calculate your pay first, then run the mortgage estimate.</p>';
}

document.querySelectorAll('.nav-tab').forEach(button=>button.addEventListener('click',()=>showTab(button.dataset.tab)));
document.querySelectorAll('.next-tab').forEach(button=>button.addEventListener('click',()=>showTab(button.dataset.next)));
document.querySelectorAll('.prev-tab').forEach(button=>button.addEventListener('click',()=>showTab(button.dataset.prev)));
document.querySelectorAll('.recalculate').forEach(button=>button.addEventListener('click',()=>calculateAll(button.closest('[data-panel]').dataset.panel)));
document.querySelectorAll('.period').forEach(button=>button.addEventListener('click',()=>{activePeriod=button.dataset.period;document.querySelectorAll('.period').forEach(b=>b.classList.toggle('active',b===button));renderPeriod();}));
document.querySelectorAll('.estimate-tab').forEach(button=>button.addEventListener('click',()=>{activeEstimate=button.dataset.estimate;document.querySelectorAll('.estimate-tab').forEach(b=>b.classList.toggle('active',b===button));renderEstimate();}));
document.querySelectorAll('.chart-range').forEach(button=>button.addEventListener('click',()=>{chartYears=button.dataset.years;document.querySelectorAll('.chart-range').forEach(b=>b.classList.toggle('active',b===button));renderCharts();}));
document.querySelectorAll('.chart-mode').forEach(button=>button.addEventListener('click',()=>{chartMode=button.dataset.mode;document.querySelectorAll('.chart-mode').forEach(b=>b.classList.toggle('active',b===button));renderCharts();}));
document.querySelectorAll('.chart-money').forEach(button=>button.addEventListener('click',()=>{chartMoney=button.dataset.money;document.querySelectorAll('.chart-money').forEach(b=>b.classList.toggle('active',b===button));renderCharts();}));
document.querySelectorAll('.preset').forEach(button=>button.addEventListener('click',()=>{$('pensionGrowthPct').value=button.dataset.value;}));
inputIds.forEach(id=>$(id)?.addEventListener('input',()=>{if(id==='payType')updatePayLabel();if(expenseIds.includes(id))updateExpensePreview();if(payResult)$('resultStatus').textContent='Inputs changed. Press Update calculation to apply them.';}));
$('calculateButton').addEventListener('click',()=>calculateAll('results'));
$('carCalculate').addEventListener('click',renderCar);
$('mortgageCalculate').addEventListener('click',renderMortgage);
$('useFullStatePension').addEventListener('click',()=>{$('statePensionAnnual').value=(CONFIG.pension.fullNewStatePensionWeekly*52).toFixed(2);});
$('resetButton').addEventListener('click',resetAll);

updatePayLabel();updateExpensePreview();
