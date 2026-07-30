# Wage Wise calculation audit

Audit date: 30 July 2026  
Calculator tax year: 2026/27  
Supported Income Tax region: England, Wales and Northern Ireland

## Official rates used

- Personal Allowance: £12,570.
- Personal Allowance taper: reduced by £1 for every £2 of income above £100,000; exhausted at £125,140.
- Basic-rate taxable band: first £37,700 at 20%.
- Higher-rate taxable band: £37,701 to £125,140 at 40%.
- Additional-rate taxable income above £125,140 at 45%.
- Employee Class 1 NI category A: 8% between the Primary Threshold and Upper Earnings Limit, then 2% above the Upper Earnings Limit.
- Weekly NI thresholds: £242 and £967.
- Monthly NI thresholds: £1,048 and £4,189.
- Automatic-enrolment qualifying earnings band: £6,240 to £50,270.
- Full new State Pension reference amount: £241.30 per week for 2026/27. The app does not assume the user receives this amount; it must be entered or selected.

Primary sources:

- https://www.gov.uk/government/publications/rates-and-allowances-income-tax/income-tax-rates-and-allowances-current-and-past
- https://www.gov.uk/guidance/rates-and-thresholds-for-employers-2026-to-2027
- https://www.gov.uk/national-insurance-rates-letters/contribution-rates
- https://www.gov.uk/government/publications/review-of-the-automatic-enrolment-earnings-trigger-and-qualifying-earnings-band-for-202627
- https://www.gov.uk/government/publications/your-new-state-pension-explained/your-state-pension-explained

## Core formulas

### Pay conversion

- Annual salary: entered amount.
- Monthly salary: monthly amount × 12.
- Weekly wage: weekly amount × paid/contract weeks.
- Hourly wage: hourly rate × weekly hours × paid/contract weeks.

Paid leave keeps normal base pay and reduces actual worked weeks. Unpaid leave reduces gross base pay by normal weekly gross pay × unpaid leave weeks.

### Income Tax

1. Calculate the Personal Allowance after tapering above £100,000.
2. Deduct the allowance from gross employment income.
3. Apply 20%, 40% and 45% to the applicable taxable-income bands.

### National Insurance

- Monthly payroll: calculate NI from monthly gross pay and multiply by 12.
- Weekly payroll: calculate ordinary paid weeks and overtime weeks separately using weekly thresholds.
- Monthly overtime is assumed to be spread evenly across the year; a real payslip can differ when overtime is irregular.

### Overtime

- Gross overtime = overtime hours × overtime hourly rate × overtime weeks.
- Extra overtime deductions = tax and NI with overtime minus tax and NI without overtime.
- Overtime take-home estimate = gross overtime minus the extra tax and NI attributed to overtime.

### Expenses

- Yearly expenses = monthly expenses × 12.
- Money remaining = take-home pay minus entered expenses.
- Hourly and daily real-income figures divide yearly money remaining by actual worked hours or days.
- Weekly results divide by paid or contract weeks and are labelled accordingly.

### Pension

- Contributions can be based on full gross pay, entered pensionable pay or the 2026/27 qualifying-earnings band.
- Contributions, investment growth and fees are applied monthly.
- Employee and employer deposits are tracked separately.
- Pension health compares estimated retirement income with the user’s own retirement-income target.
- Defined-benefit schemes receive a warning because this pension-pot model is not suitable for valuing promised scheme benefits.

### Car finance

The finance payment uses a standard amortisation calculation. Where a final balloon payment is entered, its discounted value is removed from the instalment calculation and added back at the end of the agreement.

### Mortgage

- Repayment uses the standard capital-and-interest annuity formula.
- The borrowing range uses configurable illustrative income multiples, defaulting to 4.0–4.5 times combined gross income.
- The result also considers the deposit, loan-to-value, monthly repayment and entered commitments.
- It is not an eligibility decision or lender approval.

## Career simulations

Career names are labels for testing only and are not claims about typical salaries.

| Scenario | Gross | Income Tax | Employee NI | Take-home | Overtime gross | Unpaid leave gross loss | Money remaining after entered yearly expenses |
|---|---:|---:|---:|---:|---:|---:|---:|
| Part-time retail employee | £13,000.00 | £86.00 | £33.28 | £12,880.72 | £0.00 | £0.00 | £12,880.72 |
| Warehouse employee with overtime | £30,375.00 | £3,561.00 | £1,423.28 | £25,390.72 | £4,050.00 | £0.00 | £4,990.72 |
| Office administrator | £30,000.00 | £3,486.00 | £1,393.92 | £25,120.08 | £0.00 | £0.00 | £4,720.08 |
| Skilled professional | £53,175.00 | £8,702.00 | £3,073.56 | £41,399.44 | £3,675.00 | £0.00 | £20,999.44 |
| Senior manager | £115,000.00 | £36,432.00 | £4,310.04 | £74,257.96 | £0.00 | £0.00 | £53,857.96 |
| Employee with four weeks unpaid leave | £33,230.77 | £4,132.15 | £1,652.40 | £27,446.22 | £0.00 | £2,769.23 | £7,046.22 |
| Public-sector worker warning case | £42,000.00 | £5,886.00 | £2,353.92 | £33,760.08 | £0.00 | £0.00 | £33,760.08 |

## Boundary and error tests completed

- £0 income.
- Immediately below, at and above £12,570.
- Immediately below, at and above £50,270.
- Immediately below, at and above £100,000.
- Immediately below, at and above £125,140.
- Weekly and monthly NI Primary Thresholds and Upper Earnings Limits.
- Paid leave and unpaid leave.
- No overtime and regular overtime.
- No expenses and expenses above take-home pay.
- Zero pension contributions.
- One year to retirement and a 60-year projection.
- Qualifying-earnings pension basis.
- Cash vehicle purchase.
- Finance with a final balloon payment.
- Single and joint mortgage estimates.
- High debt and mortgage-stress cases.
- Invalid weeks, leave and overtime-week entries.
- No NaN or Infinity values in tested calculation outputs.

Test command:

```bash
node tests/calculation-tests.mjs
```

## Errors found and corrected

- Overtime previously assumed it occurred during every working week. A separate overtime-weeks input is now used.
- Five-year results previously risked multiplying year one by five. Each year is now calculated separately using wage, expense and overtime growth assumptions.
- Pension contribution basis was previously fixed to gross pay. Full pay, pensionable pay and qualifying earnings are now supported.
- Pension investment growth and fees are now tracked separately, with employee and employer money kept separate.
- Pension deposits displayed at retirement now stop at the retirement year rather than continuing to a longer selected projection horizon.
- Defined-benefit pensions now receive a clear warning and neutral health result.
- Cash vehicle affordability now spreads the full cash purchase price over the selected ownership period.
- Mortgage comparisons exclude existing housing, debt and finance categories that would otherwise be double-counted when separate mortgage commitments are entered.
- Expense-adjusted results are labelled “money remaining” rather than “take-home pay”.
- Input ranges and unusual pension contribution assumptions now produce visible warnings.

## Remaining limitations

- Scottish Income Tax is not supported.
- Income Tax is an annual liability estimate and does not reproduce every PAYE tax-code or payroll-rounding outcome.
- Monthly NI assumes gross pay is spread evenly across the year; irregular monthly overtime can change real deductions.
- Student loans, benefits, bonuses, salary sacrifice, tax-code changes and other payroll deductions are not included in take-home pay.
- Pension tax relief, salary sacrifice and scheme-specific definitions of pensionable pay can change the real cost to the employee.
- Investment returns, fees, inflation and retirement withdrawals are uncertain.
- Car-finance results do not predict lender approval or include depreciation unless the user uses the cash-equivalent view.
- Mortgage results do not model credit history, lender stress rates, property criteria or every household expense.
