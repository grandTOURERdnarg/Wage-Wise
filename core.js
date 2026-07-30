export const CONFIG = Object.freeze({
  taxYear: '2026/27',
  region: 'England, Wales and Northern Ireland',
  tax: {
    personalAllowance: 12570,
    allowanceTaperStarts: 100000,
    basicBand: 37700,
    additionalThresholdTaxable: 125140,
    basicRate: 0.20,
    higherRate: 0.40,
    additionalRate: 0.45
  },
  ni: {
    weekly: { primaryThreshold: 242, upperEarningsLimit: 967 },
    monthly: { primaryThreshold: 1048, upperEarningsLimit: 4189 },
    mainRate: 0.08,
    upperRate: 0.02
  },
  pension: {
    qualifyingLower: 6240,
    qualifyingUpper: 50270,
    fullNewStatePensionWeekly: 241.30
  },
  mortgage: {
    defaultMinMultiple: 4.0,
    defaultMaxMultiple: 4.5
  }
});

export const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));
export const finite = value => Number.isFinite(Number(value)) ? Number(value) : 0;
export const roundMoney = value => Math.round((finite(value) + Number.EPSILON) * 100) / 100;

export function personalAllowance(income) {
  const gross = Math.max(0, finite(income));
  const reduction = Math.max(0, gross - CONFIG.tax.allowanceTaperStarts) / 2;
  return Math.max(0, CONFIG.tax.personalAllowance - reduction);
}

export function incomeTaxAnnual(income) {
  const gross = Math.max(0, finite(income));
  const allowance = personalAllowance(gross);
  const taxable = Math.max(0, gross - allowance);
  const basic = Math.min(taxable, CONFIG.tax.basicBand) * CONFIG.tax.basicRate;
  const higherBandSize = CONFIG.tax.additionalThresholdTaxable - CONFIG.tax.basicBand;
  const higher = Math.min(Math.max(0, taxable - CONFIG.tax.basicBand), higherBandSize) * CONFIG.tax.higherRate;
  const additional = Math.max(0, taxable - CONFIG.tax.additionalThresholdTaxable) * CONFIG.tax.additionalRate;
  return roundMoney(basic + higher + additional);
}

export function niForPeriod(periodGross, frequency = 'monthly') {
  const gross = Math.max(0, finite(periodGross));
  const band = CONFIG.ni[frequency] || CONFIG.ni.monthly;
  const main = Math.min(Math.max(0, gross - band.primaryThreshold), band.upperEarningsLimit - band.primaryThreshold) * CONFIG.ni.mainRate;
  const upper = Math.max(0, gross - band.upperEarningsLimit) * CONFIG.ni.upperRate;
  return roundMoney(main + upper);
}

function annualNIFromPattern({ payFrequency, standardWeeklyGross, payableWeeks, overtimeWeeks, overtimeWeeklyGross, annualGross }) {
  if (payFrequency === 'weekly') {
    const paidWeeks = clamp(payableWeeks, 0, 52);
    const overtimePaidWeeks = clamp(overtimeWeeks, 0, paidWeeks);
    const ordinaryWeeks = Math.max(0, paidWeeks - overtimePaidWeeks);
    return roundMoney(
      ordinaryWeeks * niForPeriod(standardWeeklyGross, 'weekly') +
      overtimePaidWeeks * niForPeriod(standardWeeklyGross + overtimeWeeklyGross, 'weekly')
    );
  }
  const monthlyGross = Math.max(0, finite(annualGross)) / 12;
  return roundMoney(niForPeriod(monthlyGross, 'monthly') * 12);
}

export function validateInputs(input) {
  const errors = [];
  const warnings = [];
  const numberFields = [
    'payAmount','hoursPerWeek','daysPerWeek','paidWeeks','leaveWeeks','overtimeHours','overtimeRate','overtimeWeeks',
    'employeePensionPct','employerPensionPct','currentPension','currentAge','retirementAge','pensionGrowthPct','pensionFeePct',
    'wageGrowthPct','expenseGrowthPct','overtimeGrowthPct','inflationPct','desiredRetirementIncome','statePensionAnnual',
    'projectionYears','pensionablePay','drawdownPct'
  ];
  numberFields.forEach(key => {
    if (input[key] !== undefined && (!Number.isFinite(Number(input[key])) || Number(input[key]) < 0)) errors.push(`${key} must be a valid non-negative number.`);
  });
  if (finite(input.hoursPerWeek) <= 0) errors.push('Weekly hours must be greater than zero.');
  if (finite(input.daysPerWeek) < 1 || finite(input.daysPerWeek) > 7) errors.push('Working days must be between 1 and 7.');
  if (finite(input.paidWeeks) < 1 || finite(input.paidWeeks) > 52) errors.push('Paid or contract weeks must be between 1 and 52.');
  if (finite(input.leaveWeeks) > finite(input.paidWeeks)) errors.push('Leave weeks cannot exceed paid or contract weeks.');
  if (finite(input.overtimeWeeks) > Math.max(0, finite(input.paidWeeks) - finite(input.leaveWeeks))) errors.push('Overtime weeks cannot exceed the weeks actually worked.');
  if (input.payType === 'hourly' && finite(input.payAmount) > 0 && finite(input.hoursPerWeek) <= 0) errors.push('Hourly pay requires weekly hours greater than zero.');
  if (input.retirementAge !== undefined || input.currentAge !== undefined) {
    if (finite(input.retirementAge) <= finite(input.currentAge)) errors.push('Retirement age must be greater than current age.');
    if (finite(input.retirementAge) > 90) errors.push('Retirement age must be 90 or below for this estimator.');
  }
  if (finite(input.employerPensionPct) >= 25) warnings.push('The employer pension percentage is unusually high. Confirm it is a contribution rate rather than a total scheme cost or defined-benefit accrual figure.');
  if (finite(input.pensionGrowthPct) > 10) warnings.push('The pension growth assumption is high and should be treated as an optimistic illustration.');
  if (finite(input.inflationPct) > 8) warnings.push('The inflation assumption is unusually high for a long-term projection.');
  if (input.pensionSchemeType === 'definedBenefit') warnings.push('Defined-benefit pensions cannot be reliably valued with this contribution-and-investment-growth model.');
  return { errors, warnings };
}

function basePayDetails(input) {
  const payType = input.payType || 'annual';
  const payAmount = Math.max(0, finite(input.payAmount));
  const hoursPerWeek = Math.max(0.01, finite(input.hoursPerWeek));
  const daysPerWeek = clamp(input.daysPerWeek, 1, 7);
  const paidWeeks = clamp(input.paidWeeks, 1, 52);
  const leaveWeeks = clamp(input.leaveWeeks, 0, paidWeeks);
  const paidLeave = input.leavePaid !== false && input.leavePaid !== 'no';
  const actualWorkingWeeks = Math.max(0, paidWeeks - leaveWeeks);

  let fullYearBase = payAmount;
  if (payType === 'monthly') fullYearBase = payAmount * 12;
  if (payType === 'weekly') fullYearBase = payAmount * paidWeeks;
  if (payType === 'hourly') fullYearBase = payAmount * hoursPerWeek * paidWeeks;

  const standardWeeklyGross = fullYearBase / paidWeeks;
  const standardHourly = payType === 'hourly' ? payAmount : standardWeeklyGross / hoursPerWeek;
  const leaveGrossValue = standardWeeklyGross * leaveWeeks;
  const unpaidLeaveLostGross = paidLeave ? 0 : leaveGrossValue;
  const baseGross = paidLeave ? fullYearBase : Math.max(0, fullYearBase - leaveGrossValue);
  const payableWeeks = paidLeave ? paidWeeks : actualWorkingWeeks;

  return {
    payType, payAmount, hoursPerWeek, daysPerWeek, paidWeeks, leaveWeeks, paidLeave,
    actualWorkingWeeks, payableWeeks, fullYearBase, standardWeeklyGross, standardHourly,
    leaveGrossValue, unpaidLeaveLostGross, baseGross,
    actualStandardHours: hoursPerWeek * actualWorkingWeeks,
    actualWorkingDays: daysPerWeek * actualWorkingWeeks
  };
}

function computeScenario({ base, overtimeHours, overtimeRate, overtimeWeeks, payFrequency, forcePaidLeave = null, includeOvertime = true }) {
  const paidLeave = forcePaidLeave === null ? base.paidLeave : forcePaidLeave;
  const baseGross = paidLeave ? base.fullYearBase : Math.max(0, base.fullYearBase - base.leaveGrossValue);
  const payableWeeks = paidLeave ? base.paidWeeks : base.actualWorkingWeeks;
  const otWeeks = includeOvertime ? clamp(overtimeWeeks, 0, base.actualWorkingWeeks) : 0;
  const otHours = includeOvertime ? Math.max(0, finite(overtimeHours)) : 0;
  const otRate = includeOvertime ? Math.max(0, finite(overtimeRate)) : 0;
  const overtimeWeeklyGross = otHours * otRate;
  const overtimeGross = overtimeWeeklyGross * otWeeks;
  const annualGross = baseGross + overtimeGross;
  const tax = incomeTaxAnnual(annualGross);
  const ni = annualNIFromPattern({
    payFrequency,
    standardWeeklyGross: base.standardWeeklyGross,
    payableWeeks,
    overtimeWeeks: otWeeks,
    overtimeWeeklyGross,
    annualGross
  });
  return { annualGross, tax, ni, net: roundMoney(annualGross - tax - ni), baseGross, payableWeeks, overtimeGross, overtimeWeeklyGross, overtimeWeeks: otWeeks };
}

export function calculatePay(input) {
  const validation = validateInputs(input);
  if (validation.errors.length) return { validation, valid: false };

  const base = basePayDetails(input);
  const overtimeHours = Math.max(0, finite(input.overtimeHours));
  const overtimeRate = Math.max(0, finite(input.overtimeRate));
  const overtimeWeeks = clamp(input.overtimeWeeks, 0, base.actualWorkingWeeks);
  const payFrequency = input.payFrequency === 'weekly' ? 'weekly' : 'monthly';

  const current = computeScenario({ base, overtimeHours, overtimeRate, overtimeWeeks, payFrequency });
  const noOvertime = computeScenario({ base, overtimeHours, overtimeRate, overtimeWeeks, payFrequency, includeOvertime: false });
  const overtimeExtraTax = roundMoney(Math.max(0, current.tax - noOvertime.tax));
  const overtimeExtraNI = roundMoney(Math.max(0, current.ni - noOvertime.ni));
  const overtimeNet = roundMoney(Math.max(0, current.overtimeGross - overtimeExtraTax - overtimeExtraNI));
  const overtimeHoursYear = roundMoney(overtimeHours * overtimeWeeks);

  let unpaidLeaveLostNet = 0;
  if (!base.paidLeave && base.leaveWeeks > 0) {
    const paidCounterfactual = computeScenario({ base, overtimeHours, overtimeRate, overtimeWeeks, payFrequency, forcePaidLeave: true });
    unpaidLeaveLostNet = roundMoney(Math.max(0, paidCounterfactual.net - current.net));
  }

  const expenses = input.expenses || {};
  const expenseValues = Object.fromEntries(Object.entries(expenses).map(([key, amount]) => [key, Math.max(0, finite(amount))]));
  const expensesMonth = roundMoney(Object.values(expenseValues).reduce((sum, amount) => sum + amount, 0));
  const expensesYear = roundMoney(expensesMonth * 12);
  const remainingYear = roundMoney(current.net - expensesYear);
  const actualHours = Math.max(1, base.actualStandardHours + overtimeHoursYear);
  const actualDays = Math.max(1, base.actualWorkingDays);

  return {
    valid: true,
    validation,
    ...base,
    payFrequency,
    overtimeHours,
    overtimeRate,
    overtimeWeeks,
    overtimeHoursYear,
    overtimeGross: current.overtimeGross,
    overtimeExtraTax,
    overtimeExtraNI,
    overtimeNet,
    overtimeNetRate: overtimeHoursYear > 0 ? roundMoney(overtimeNet / overtimeHoursYear) : 0,
    overtimeKeptPct: current.overtimeGross > 0 ? overtimeNet / current.overtimeGross * 100 : 0,
    overtimeLostPct: current.overtimeGross > 0 ? (overtimeExtraTax + overtimeExtraNI) / current.overtimeGross * 100 : 0,
    gross: current.annualGross,
    tax: current.tax,
    ni: current.ni,
    net: current.net,
    unpaidLeaveLostNet,
    expenses: expenseValues,
    expensesMonth,
    expensesYear,
    remainingYear,
    remainingMonth: roundMoney(remainingYear / 12),
    actualHours,
    actualDays,
    grossHourly: roundMoney(current.annualGross / actualHours),
    netHourly: roundMoney(current.net / actualHours),
    remainingHourly: roundMoney(remainingYear / actualHours),
    grossDaily: roundMoney(current.annualGross / actualDays),
    netDaily: roundMoney(current.net / actualDays),
    remainingDaily: roundMoney(remainingYear / actualDays),
    grossWeekly: roundMoney(current.annualGross / base.paidWeeks),
    netWeekly: roundMoney(current.net / base.paidWeeks),
    remainingWeekly: roundMoney(remainingYear / base.paidWeeks),
    grossMonthly: roundMoney(current.annualGross / 12),
    netMonthly: roundMoney(current.net / 12),
    remainingMonthly: roundMoney(remainingYear / 12)
  };
}

export function pensionContributionBasis(gross, settings) {
  const basis = settings.pensionBasis || 'full';
  if (basis === 'qualifying') return Math.max(0, Math.min(gross, CONFIG.pension.qualifyingUpper) - CONFIG.pension.qualifyingLower);
  if (basis === 'pensionable') return Math.max(0, Math.min(gross, finite(settings.pensionablePay) || gross));
  return Math.max(0, gross);
}

export function projectIncomeAndPension(payInput, settings = {}) {
  const firstYear = calculatePay(payInput);
  if (!firstYear.valid) return { valid: false, validation: firstYear.validation };

  const projectionYears = clamp(settings.projectionYears || 5, 1, 60);
  const retirementYears = clamp((finite(settings.retirementAge) || 68) - (finite(settings.currentAge) || 30), 1, 60);
  const years = Math.max(projectionYears, retirementYears, 5);
  const wageGrowth = finite(settings.wageGrowthPct) / 100;
  const expenseGrowth = finite(settings.expenseGrowthPct) / 100;
  const overtimeGrowth = finite(settings.overtimeGrowthPct) / 100;
  const inflation = finite(settings.inflationPct) / 100;
  const pensionGrowth = finite(settings.pensionGrowthPct) / 100;
  const pensionFee = finite(settings.pensionFeePct) / 100;
  const employeePct = finite(settings.employeePensionPct);
  const employerPct = finite(settings.employerPensionPct);
  const monthlyGrowth = Math.pow(1 + pensionGrowth, 1 / 12) - 1;
  const monthlyFee = 1 - Math.pow(Math.max(0.000001, 1 - pensionFee), 1 / 12);

  let existingPot = Math.max(0, finite(settings.currentPension));
  let employeePot = 0;
  let employerPot = 0;
  let employeeDeposits = 0;
  let employerDeposits = 0;
  let investmentGrowth = 0;
  let fees = 0;
  const rows = [];

  for (let yearIndex = 0; yearIndex < years; yearIndex += 1) {
    const baseGrowthFactor = Math.pow(1 + wageGrowth, yearIndex);
    const overtimeFactor = Math.pow(1 + overtimeGrowth, yearIndex);
    const grossBase = firstYear.baseGross * baseGrowthFactor;
    const overtimeGross = firstYear.overtimeGross * overtimeFactor;
    const gross = roundMoney(grossBase + overtimeGross);
    const tax = incomeTaxAnnual(gross);

    let ni;
    if (firstYear.payFrequency === 'weekly') {
      const standardWeeklyGross = firstYear.standardWeeklyGross * baseGrowthFactor;
      const overtimeWeeklyGross = firstYear.overtimeHours * firstYear.overtimeRate * overtimeFactor;
      ni = annualNIFromPattern({
        payFrequency: 'weekly', standardWeeklyGross, payableWeeks: firstYear.payableWeeks,
        overtimeWeeks: firstYear.overtimeWeeks, overtimeWeeklyGross, annualGross: gross
      });
    } else {
      ni = annualNIFromPattern({ payFrequency: 'monthly', annualGross: gross });
    }

    const net = roundMoney(gross - tax - ni);
    const expenses = roundMoney(firstYear.expensesYear * Math.pow(1 + expenseGrowth, yearIndex));
    const remaining = roundMoney(net - expenses);
    const basis = pensionContributionBasis(gross, settings);
    const employeeAnnual = roundMoney(basis * employeePct / 100);
    const employerAnnual = roundMoney(basis * employerPct / 100);
    const employeeMonthly = employeeAnnual / 12;
    const employerMonthly = employerAnnual / 12;

    let yearGrowth = 0;
    let yearFees = 0;
    for (let month = 0; month < 12; month += 1) {
      const pots = [
        { name: 'existing', value: existingPot, contribution: 0 },
        { name: 'employee', value: employeePot, contribution: employeeMonthly },
        { name: 'employer', value: employerPot, contribution: employerMonthly }
      ];
      const updated = {};
      pots.forEach(pot => {
        const afterContribution = pot.value + pot.contribution;
        const growthAmount = afterContribution * monthlyGrowth;
        const feeAmount = (afterContribution + growthAmount) * monthlyFee;
        updated[pot.name] = Math.max(0, afterContribution + growthAmount - feeAmount);
        yearGrowth += growthAmount;
        yearFees += feeAmount;
      });
      existingPot = updated.existing;
      employeePot = updated.employee;
      employerPot = updated.employer;
      employeeDeposits += employeeMonthly;
      employerDeposits += employerMonthly;
    }
    investmentGrowth += yearGrowth;
    fees += yearFees;
    const pensionBalance = roundMoney(existingPot + employeePot + employerPot);
    const discount = Math.pow(1 + inflation, yearIndex + 1);
    rows.push({
      year: yearIndex + 1,
      gross, overtimeGross, tax, ni, net, expenses, remaining,
      employeePension: employeeAnnual,
      employerPension: employerAnnual,
      cumulativeEmployeeDeposits: roundMoney(employeeDeposits),
      cumulativeEmployerDeposits: roundMoney(employerDeposits),
      cumulativeInvestmentGrowth: roundMoney(investmentGrowth),
      cumulativeFees: roundMoney(fees),
      employerFundedBalance: roundMoney(employerPot),
      pensionBalance,
      realGross: roundMoney(gross / discount),
      realNet: roundMoney(net / discount),
      realRemaining: roundMoney(remaining / discount),
      realPensionBalance: roundMoney(pensionBalance / discount)
    });
  }

  const fiveRows = rows.slice(0, 5);
  const retirementRow = rows[Math.min(retirementYears, rows.length) - 1];
  const withdrawalRate = finite(settings.drawdownPct || 4) / 100;
  const privateAnnualIncome = roundMoney((retirementRow?.pensionBalance || 0) * withdrawalRate);
  const statePensionAnnual = settings.includeStatePension === false ? 0 : Math.max(0, finite(settings.statePensionAnnual));
  const combinedRetirementIncome = roundMoney(privateAnnualIncome + statePensionAnnual);
  const target = Math.max(0, finite(settings.desiredRetirementIncome));
  const targetRatio = target > 0 ? combinedRetirementIncome / target : 0;
  let pensionHealth = { code: 'neutral', label: 'Set a retirement target', detail: 'Enter a desired annual retirement income to assess this projection.' };
  if (settings.pensionSchemeType === 'definedBenefit') {
    pensionHealth = { code: 'neutral', label: 'Defined-benefit scheme', detail: 'Use your scheme statement; a pension-pot model cannot reliably assess this pension.' };
  } else if (target > 0) {
    if (targetRatio < 0.60) pensionHealth = { code: 'red', label: 'Large projected shortfall', detail: `The estimate reaches ${Math.round(targetRatio * 100)}% of your target.` };
    else if (targetRatio < 0.90) pensionHealth = { code: 'yellow', label: 'Below your target', detail: `The estimate reaches ${Math.round(targetRatio * 100)}% of your target.` };
    else if (targetRatio < 1.10) pensionHealth = { code: 'green', label: 'Close to your target', detail: `The estimate reaches ${Math.round(targetRatio * 100)}% of your target.` };
    else pensionHealth = { code: 'bright-green', label: 'Above your target', detail: `The estimate reaches ${Math.round(targetRatio * 100)}% of your target.` };
  }

  return {
    valid: true,
    firstYear,
    rows,
    projectionYears,
    retirementYears,
    fiveYear: {
      gross: roundMoney(fiveRows.reduce((sum, row) => sum + row.gross, 0)),
      tax: roundMoney(fiveRows.reduce((sum, row) => sum + row.tax, 0)),
      ni: roundMoney(fiveRows.reduce((sum, row) => sum + row.ni, 0)),
      net: roundMoney(fiveRows.reduce((sum, row) => sum + row.net, 0)),
      expenses: roundMoney(fiveRows.reduce((sum, row) => sum + row.expenses, 0)),
      remaining: roundMoney(fiveRows.reduce((sum, row) => sum + row.remaining, 0)),
      overtime: roundMoney(fiveRows.reduce((sum, row) => sum + row.overtimeGross, 0)),
      pensionContributions: roundMoney(fiveRows.reduce((sum, row) => sum + row.employeePension + row.employerPension, 0)),
      pensionBalance: fiveRows.at(-1)?.pensionBalance || 0
    },
    pension: {
      balanceAtRetirement: retirementRow?.pensionBalance || 0,
      employeeDeposits: retirementRow?.cumulativeEmployeeDeposits || 0,
      employerDeposits: retirementRow?.cumulativeEmployerDeposits || 0,
      employerFundedBalance: retirementRow?.employerFundedBalance || 0,
      investmentGrowth: retirementRow?.cumulativeInvestmentGrowth || 0,
      fees: retirementRow?.cumulativeFees || 0,
      privateAnnualIncome,
      statePensionAnnual,
      combinedRetirementIncome,
      target,
      targetRatio,
      gapOrSurplus: roundMoney(combinedRetirementIncome - target),
      health: pensionHealth
    }
  };
}

export function calculateCarAffordability(input, payResult) {
  const price = Math.max(0, finite(input.vehiclePrice));
  const deposit = clamp(input.deposit, 0, price);
  const months = clamp(input.termMonths || 48, 1, 120);
  const apr = Math.max(0, finite(input.aprPct)) / 100;
  const balloon = clamp(input.balloonPayment, 0, Math.max(0, price - deposit));
  const financed = Math.max(0, price - deposit);
  const monthlyRate = apr / 12;
  let financePayment = 0;
  if (input.purchaseType !== 'cash' && financed > 0) {
    if (monthlyRate === 0) financePayment = Math.max(0, (financed - balloon) / months);
    else {
      const balloonPV = balloon / Math.pow(1 + monthlyRate, months);
      financePayment = Math.max(0, (financed - balloonPV) * monthlyRate / (1 - Math.pow(1 + monthlyRate, -months)));
    }
  }
  const monthlyRunning = ['insurance','fuel','vehicleTax','maintenance','parking','otherCarCosts']
    .reduce((sum, key) => sum + Math.max(0, finite(input[key])), 0);
  const ownershipMonths = clamp(input.ownershipMonths || months, 1, 180);
  const cashEquivalent = input.purchaseType === 'cash' ? price / ownershipMonths : 0;
  const totalMonthly = roundMoney(monthlyRunning + financePayment + cashEquivalent);
  const totalRepaid = input.purchaseType === 'cash' ? price : roundMoney(deposit + financePayment * months + balloon);
  const interestPaid = input.purchaseType === 'cash' ? 0 : roundMoney(Math.max(0, totalRepaid - price));
  const netMonth = Math.max(0, payResult?.netMonthly || 0);
  const disposableBeforeCar = (payResult?.netMonthly || 0) - (payResult?.expensesMonth || 0);
  const remainingAfterCar = roundMoney(disposableBeforeCar - totalMonthly);
  const pctNet = netMonth > 0 ? totalMonthly / netMonth * 100 : 0;
  const pctDisposable = disposableBeforeCar > 0 ? totalMonthly / disposableBeforeCar * 100 : Infinity;
  let status;
  if (remainingAfterCar < 0 || totalMonthly > disposableBeforeCar) status = { code: 'red', label: 'Exceeds available monthly income' };
  else if (pctNet <= 10 && pctDisposable <= 30) status = { code: 'bright-green', label: 'Comfortable within the entered budget' };
  else if (pctNet <= 20 && pctDisposable <= 50) status = { code: 'green', label: 'Manageable but significant' };
  else status = { code: 'yellow', label: 'High financial pressure' };
  return {
    financePayment: roundMoney(financePayment), monthlyRunning: roundMoney(monthlyRunning), cashEquivalent: roundMoney(cashEquivalent),
    totalMonthly, totalYearly: roundMoney(totalMonthly * 12), totalRepaid, interestPaid, balloon,
    pctNet, pctDisposable, remainingAfterCar,
    workHoursNeeded: payResult?.remainingHourly > 0 ? roundMoney(totalMonthly / payResult.remainingHourly) : 0,
    status
  };
}

export function mortgagePayment(principal, annualRatePct, years) {
  const loan = Math.max(0, finite(principal));
  const months = clamp(years, 1, 50) * 12;
  const rate = Math.max(0, finite(annualRatePct)) / 100 / 12;
  if (loan === 0) return 0;
  if (rate === 0) return roundMoney(loan / months);
  return roundMoney(loan * rate / (1 - Math.pow(1 + rate, -months)));
}

export function calculateMortgageEstimate(input, applicantPayResult) {
  const applicantIncome = Math.max(0, finite(input.applicantIncome || applicantPayResult?.gross));
  const secondIncome = Math.max(0, finite(input.secondApplicantIncome));
  const combinedGross = applicantIncome + secondIncome;
  const propertyPrice = Math.max(0, finite(input.propertyPrice));
  const deposit = clamp(input.depositAmount, 0, propertyPrice);
  const loanRequired = Math.max(0, propertyPrice - deposit);
  const minMultiple = clamp(input.minIncomeMultiple || CONFIG.mortgage.defaultMinMultiple, 1, 10);
  const maxMultiple = Math.max(minMultiple, clamp(input.maxIncomeMultiple || CONFIG.mortgage.defaultMaxMultiple, minMultiple, 10));
  const mortgageRange = { min: roundMoney(combinedGross * minMultiple), max: roundMoney(combinedGross * maxMultiple) };
  const ltv = propertyPrice > 0 ? loanRequired / propertyPrice * 100 : 0;
  const payment = mortgagePayment(loanRequired, input.interestRatePct || 5, input.termYears || 25);

  const applicantNetMonth = applicantPayResult?.netMonthly ?? roundMoney((applicantIncome - incomeTaxAnnual(applicantIncome) - annualNIFromPattern({ payFrequency: 'monthly', annualGross: applicantIncome })) / 12);
  const secondNetMonth = roundMoney((secondIncome - incomeTaxAnnual(secondIncome) - annualNIFromPattern({ payFrequency: 'monthly', annualGross: secondIncome })) / 12);
  const combinedNetMonth = applicantNetMonth + secondNetMonth;
  const commitments = ['existingDebtPayments','carFinancePayments','creditLoanPayments','childcareCosts','otherCommitments']
    .reduce((sum, key) => sum + Math.max(0, finite(input[key])), 0);
  const nonHousingSpending = input.useExistingSpending === false ? 0 : Math.max(0,
    (applicantPayResult?.expensesMonth || 0)
    - Math.max(0, finite(applicantPayResult?.expenses?.housing))
    - Math.max(0, finite(applicantPayResult?.expenses?.debt))
    - Math.max(0, finite(applicantPayResult?.expenses?.finance))
  );
  const remainingAfterMortgage = roundMoney(combinedNetMonth - payment - commitments - nonHousingSpending);
  const repaymentPct = combinedNetMonth > 0 ? payment / combinedNetMonth * 100 : Infinity;
  const depositPct = propertyPrice > 0 ? deposit / propertyPrice * 100 : 0;
  const depositShortfallFor10Pct = Math.max(0, propertyPrice * 0.10 - deposit);

  let status;
  if (loanRequired > mortgageRange.max || remainingAfterMortgage < 0) status = { code: 'red', label: 'Unlikely within the entered assumptions' };
  else if (repaymentPct > 40 || ltv > 95) status = { code: 'yellow', label: 'Monthly affordability appears stretched' };
  else if (loanRequired > mortgageRange.min || ltv > 90) status = { code: 'yellow', label: 'May require a larger deposit or lower property price' };
  else status = { code: 'green', label: 'Potentially within an illustrative range' };

  return {
    combinedGross, depositPct, loanRequired, ltv, mortgageRange, payment,
    combinedNetMonth, commitments, nonHousingSpending, repaymentPct,
    remainingAfterMortgage, depositShortfallFor10Pct, status
  };
}
