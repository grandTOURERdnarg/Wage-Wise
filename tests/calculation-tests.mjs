import assert from 'node:assert/strict';
import {
  CONFIG, incomeTaxAnnual, niForPeriod, calculatePay, projectIncomeAndPension,
  calculateCarAffordability, calculateMortgageEstimate, mortgagePayment
} from '../core.js';

const close = (actual, expected, tolerance = 0.02, label = '') => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: expected ${expected}, got ${actual}`);
};

close(incomeTaxAnnual(0), 0, 0.01, 'zero income tax');
close(incomeTaxAnnual(12570), 0, 0.01, 'personal allowance');
close(incomeTaxAnnual(50270), 7540, 0.01, 'higher-rate threshold');
close(incomeTaxAnnual(100000), 27432, 0.01, 'allowance taper start');
close(incomeTaxAnnual(125140), 42516, 0.01, 'allowance exhausted');
close(incomeTaxAnnual(125141), 42516.45, 0.01, 'additional-rate boundary');
close(niForPeriod(1048, 'monthly'), 0, 0.01, 'monthly NI primary threshold');
close(niForPeriod(4189, 'monthly'), 251.28, 0.01, 'monthly NI UEL');
close(niForPeriod(5000, 'monthly'), 267.50, 0.01, 'monthly NI above UEL');
close(niForPeriod(242, 'weekly'), 0, 0.01, 'weekly NI primary threshold');
close(niForPeriod(967, 'weekly'), 58, 0.01, 'weekly NI UEL');

const expenses = { housing: 800, councilTax: 150, utilities: 180, food: 300, transport: 120, debt: 0, subscriptions: 30, optional: 80, other: 40 };
const scenarios = [
  { name: 'Part-time retail employee', input: { payType:'hourly',payAmount:12.5,hoursPerWeek:20,daysPerWeek:4,paidWeeks:52,leaveWeeks:5.6,leavePaid:true,payFrequency:'weekly',overtimeHours:0,overtimeRate:0,overtimeWeeks:0,expenses:{} } },
  { name: 'Warehouse employee with overtime', input: { payType:'hourly',payAmount:13.5,hoursPerWeek:37.5,daysPerWeek:5,paidWeeks:52,leaveWeeks:5.6,leavePaid:true,payFrequency:'weekly',overtimeHours:5,overtimeRate:20.25,overtimeWeeks:40,expenses } },
  { name: 'Office administrator', input: { payType:'annual',payAmount:30000,hoursPerWeek:37.5,daysPerWeek:5,paidWeeks:52,leaveWeeks:5.6,leavePaid:true,payFrequency:'monthly',overtimeHours:0,overtimeRate:0,overtimeWeeks:0,expenses } },
  { name: 'Skilled professional', input: { payType:'annual',payAmount:49500,hoursPerWeek:37.5,daysPerWeek:5,paidWeeks:52,leaveWeeks:5.6,leavePaid:true,payFrequency:'monthly',overtimeHours:3,overtimeRate:35,overtimeWeeks:35,expenses } },
  { name: 'Senior manager', input: { payType:'annual',payAmount:115000,hoursPerWeek:45,daysPerWeek:5,paidWeeks:52,leaveWeeks:6,leavePaid:true,payFrequency:'monthly',overtimeHours:0,overtimeRate:0,overtimeWeeks:0,expenses } },
  { name: 'Employee with unpaid leave', input: { payType:'annual',payAmount:36000,hoursPerWeek:37.5,daysPerWeek:5,paidWeeks:52,leaveWeeks:4,leavePaid:false,payFrequency:'monthly',overtimeHours:0,overtimeRate:0,overtimeWeeks:0,expenses } },
  { name: 'Public-sector defined-benefit warning', input: { payType:'annual',payAmount:42000,hoursPerWeek:37,daysPerWeek:5,paidWeeks:52,leaveWeeks:6,leavePaid:true,payFrequency:'monthly',overtimeHours:0,overtimeRate:0,overtimeWeeks:0,expenses:{} } }
];

const report = [];
for (const scenario of scenarios) {
  const result = calculatePay(scenario.input);
  assert.equal(result.valid, true, `${scenario.name} should be valid`);
  ['gross','tax','ni','net','remainingYear','actualHours','actualDays'].forEach(key => assert.ok(Number.isFinite(result[key]), `${scenario.name} ${key} finite`));
  close(result.net, result.gross - result.tax - result.ni, 0.03, `${scenario.name} net identity`);
  close(result.expensesYear, result.expensesMonth * 12, 0.03, `${scenario.name} expense annualisation`);
  if (result.overtimeGross > 0) close(result.overtimeNet, result.overtimeGross - result.overtimeExtraTax - result.overtimeExtraNI, 0.03, `${scenario.name} overtime identity`);
  if (!scenario.input.leavePaid) assert.ok(result.unpaidLeaveLostGross > 0 && result.unpaidLeaveLostNet > 0, 'unpaid leave loss should be positive');
  report.push({ name:scenario.name,gross:result.gross,tax:result.tax,ni:result.ni,net:result.net,overtime:result.overtimeGross,leaveLoss:result.unpaidLeaveLostGross,remaining:result.remainingYear });
}

const projection = projectIncomeAndPension(scenarios[3].input, {
  projectionYears: 10,currentAge:30,retirementAge:68,wageGrowthPct:3,expenseGrowthPct:2,
  overtimeGrowthPct:1,inflationPct:2,pensionGrowthPct:5,pensionFeePct:0.5,
  employeePensionPct:7,employerPensionPct:5,currentPension:15000,pensionBasis:'full',
  desiredRetirementIncome:30000,statePensionAnnual:CONFIG.pension.fullNewStatePensionWeekly*52,
  includeStatePension:true,drawdownPct:4
});
assert.equal(projection.valid, true);
assert.equal(projection.rows.length, 38);
assert.ok(projection.rows[1].gross > projection.rows[0].gross);
assert.ok(projection.fiveYear.gross > projection.rows[0].gross * 5);
assert.ok(projection.pension.balanceAtRetirement > 15000);
assert.ok(projection.pension.fees > 0);
assert.ok(projection.pension.investmentGrowth > 0);

const car = calculateCarAffordability({
  purchaseType:'finance',vehiclePrice:24000,deposit:3000,aprPct:7.9,termMonths:48,balloonPayment:7000,
  insurance:90,fuel:160,vehicleTax:20,maintenance:60,parking:25,otherCarCosts:10
}, calculatePay(scenarios[2].input));
assert.ok(car.financePayment > 0 && car.totalRepaid > 24000 && car.interestPaid > 0);
assert.ok(Number.isFinite(car.remainingAfterCar));

close(mortgagePayment(200000, 5, 25), 1169.18, 0.2, 'mortgage payment');
const mortgage = calculateMortgageEstimate({
  applicantIncome:45000,secondApplicantIncome:30000,propertyPrice:300000,depositAmount:45000,
  minIncomeMultiple:4,maxIncomeMultiple:4.5,termYears:30,interestRatePct:5,
  existingDebtPayments:100,carFinancePayments:250,creditLoanPayments:0,childcareCosts:0,otherCommitments:50,useExistingSpending:true
}, calculatePay(scenarios[3].input));
assert.equal(mortgage.loanRequired, 255000);
assert.equal(mortgage.mortgageRange.max, 337500);
assert.ok(Number.isFinite(mortgage.payment) && mortgage.payment > 0);

assert.equal(calculatePay({ ...scenarios[0].input, paidWeeks:53 }).valid, false);
assert.equal(calculatePay({ ...scenarios[0].input, leaveWeeks:53 }).valid, false);
assert.equal(calculatePay({ ...scenarios[0].input, overtimeWeeks:52, leaveWeeks:5.6 }).valid, false);
const zero = calculatePay({ ...scenarios[0].input, payAmount:0, expenses:{} });
assert.equal(zero.valid, true);
assert.ok(Object.values(zero).every(value => typeof value !== 'number' || Number.isFinite(value)));
const overspend = calculatePay({ ...scenarios[2].input, expenses:{housing:5000} });
assert.ok(overspend.remainingYear < 0);

for (const threshold of [12570, 50270, 100000, 125140]) {
  const below = incomeTaxAnnual(threshold - 1);
  const at = incomeTaxAnnual(threshold);
  const above = incomeTaxAnnual(threshold + 1);
  assert.ok(below <= at && at <= above, `tax should be non-decreasing around ${threshold}`);
}

const oneYearPension = projectIncomeAndPension(scenarios[2].input, {
  projectionYears:1,currentAge:67,retirementAge:68,wageGrowthPct:0,expenseGrowthPct:0,overtimeGrowthPct:0,
  inflationPct:0,pensionGrowthPct:0,pensionFeePct:0,employeePensionPct:0,employerPensionPct:0,currentPension:10000,
  pensionBasis:'full',desiredRetirementIncome:0,statePensionAnnual:0,includeStatePension:false,drawdownPct:4
});
assert.equal(oneYearPension.pension.balanceAtRetirement, 10000);
const longPension = projectIncomeAndPension(scenarios[2].input, {
  projectionYears:60,currentAge:18,retirementAge:78,wageGrowthPct:2,expenseGrowthPct:2,overtimeGrowthPct:0,
  inflationPct:2,pensionGrowthPct:5,pensionFeePct:.5,employeePensionPct:10,employerPensionPct:10,currentPension:0,
  pensionBasis:'qualifying',desiredRetirementIncome:40000,statePensionAnnual:0,includeStatePension:false,drawdownPct:4
});
assert.ok(Number.isFinite(longPension.pension.balanceAtRetirement) && longPension.pension.balanceAtRetirement > 0);
assert.equal(longPension.rows.length, 60);

const cashCar = calculateCarAffordability({purchaseType:'cash',vehiclePrice:12000,deposit:0,ownershipMonths:60,insurance:70,fuel:100,vehicleTax:15,maintenance:50,parking:0,otherCarCosts:0}, calculatePay(scenarios[2].input));
close(cashCar.cashEquivalent, 200, 0.01, 'cash car monthly equivalent');
assert.equal(cashCar.financePayment, 0);
const balloonCar = calculateCarAffordability({purchaseType:'finance',vehiclePrice:30000,deposit:3000,aprPct:8,termMonths:48,balloonPayment:10000,insurance:100,fuel:150,vehicleTax:25,maintenance:60,parking:20,otherCarCosts:0}, calculatePay(scenarios[3].input));
assert.ok(balloonCar.financePayment > 0 && balloonCar.balloon === 10000 && balloonCar.interestPaid > 0);

const singleMortgage = calculateMortgageEstimate({applicantIncome:35000,secondApplicantIncome:0,propertyPrice:180000,depositAmount:18000,minIncomeMultiple:4,maxIncomeMultiple:4.5,termYears:30,interestRatePct:5,existingDebtPayments:0,carFinancePayments:0,creditLoanPayments:0,childcareCosts:0,otherCommitments:0,useExistingSpending:false}, calculatePay(scenarios[2].input));
assert.equal(singleMortgage.loanRequired, 162000);
assert.equal(singleMortgage.mortgageRange.max, 157500);
assert.ok(['red','yellow'].includes(singleMortgage.status.code));
const stretchedMortgage = calculateMortgageEstimate({applicantIncome:30000,secondApplicantIncome:0,propertyPrice:350000,depositAmount:10000,minIncomeMultiple:4,maxIncomeMultiple:4.5,termYears:25,interestRatePct:7,existingDebtPayments:500,carFinancePayments:500,creditLoanPayments:300,childcareCosts:600,otherCommitments:200,useExistingSpending:true}, calculatePay(scenarios[2].input));
assert.equal(stretchedMortgage.status.code, 'red');

console.table(report);
console.log('PASS: career simulations, threshold continuity, pension edges, car cash/balloon and mortgage stress tests.');
