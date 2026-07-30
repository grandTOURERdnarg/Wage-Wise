import { calculatePay, projectIncomeAndPension } from './core.js';
import { CAREERS, CAREER_DATA_DATE, CAREER_SOURCE_NAME, CAREER_SOURCE_NOTE } from './career-data.js';

const $ = id => document.getElementById(id);
const q = (selector, root = document) => root.querySelector(selector);
const qa = (selector, root = document) => [...root.querySelectorAll(selector)];
const value = id => Number($(id)?.value) || 0;
const money = (amount, digits = 0) => new Intl.NumberFormat('en-GB', {
  style: 'currency', currency: 'GBP', minimumFractionDigits: digits, maximumFractionDigits: digits
}).format(Number.isFinite(Number(amount)) ? Number(amount) : 0);
const percent = amount => `${Number.isFinite(Number(amount)) ? Number(amount).toFixed(1) : '0.0'}%`;
const escapeHtml = text => String(text ?? '').replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const chartColours = ['#1557d5','#34765a','#f1bb19','#40208e','#d45b45','#3f8fc7','#87992b','#8a6fd1'];

const showPanel = name => {
  qa('.tab-panel').forEach(panel => panel.classList.toggle('active', panel.dataset.panel === name));
  qa('.nav-tab').forEach(button => button.classList.toggle('active', button.dataset.tab === name));
  q('.app-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

function redesignHeaderAndHero() {
  const header = q('.header-inner');
  header.innerHTML = `
    <a class="brand" href="/" aria-label="Wage Wise home"><span class="brand-mark-v4">W</span><span><strong>Wage Wise</strong><small>Income intelligence</small></span></a>
    <nav class="marketing-nav" aria-label="Page links"><button type="button" data-open="pay">Calculator</button><button type="button" data-open="projections">Future</button><button type="button" data-open="career">Career</button><button type="button" data-open="resources">Guides</button></nav>
    <div class="header-actions"><span class="privacy-badge">Nothing saved</span><button id="resetButtonV4" class="button secondary" type="button">Reset</button><button class="gold-button" type="button" data-open="pay">Calculate</button></div>`;

  const hero = q('.hero');
  hero.className = 'hero hero-v4';
  hero.innerHTML = `
    <div class="hero-copy-v4"><p class="eyebrow hero-eyebrow">Income, explained properly</p><h1>See what your work is really worth.</h1><p>Turn your wage into clear take-home figures, real hourly value, future projections and sourced career options — without making an account.</p><div class="hero-actions-v4"><button class="gold-button hero-button" type="button" data-open="pay">Calculate your income</button><button class="hero-link" type="button" data-open="career">Explore higher-paying paths <span>→</span></button></div><div class="hero-privacy"><span>●</span> Your figures stay in this browser and disappear when the page refreshes.</div></div>
    <div class="hero-terminal-v4" aria-label="Example Wage Wise projection dashboard"><div class="terminal-bar"><span>WAGE / OUTLOOK</span><span class="terminal-status">● Example estimate</span></div><div class="terminal-value"><span>Monthly take-home</span><strong>£2,093</strong><small>Example only</small></div><svg viewBox="0 0 600 220" role="img" aria-label="Example income projection"><defs><linearGradient id="v4heroArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ffd33d" stop-opacity=".35"/><stop offset="100%" stop-color="#ffd33d" stop-opacity="0"/></linearGradient></defs><path class="terminal-grid" d="M25 45H575M25 90H575M25 135H575M25 180H575"/><path class="terminal-area" d="M25 175 C90 170 120 155 180 158 S280 130 338 132 S430 95 485 98 S548 55 575 48 L575 190 L25 190Z"/><path class="terminal-line" d="M25 175 C90 170 120 155 180 158 S280 130 338 132 S430 95 485 98 S548 55 575 48"/><circle class="terminal-point" cx="575" cy="48" r="6"/></svg><div class="terminal-metrics"><div><span>Real hourly</span><strong>£13.41</strong></div><div><span>5-year take-home</span><strong>£132k</strong></div><div><span>Pension target</span><strong>74%</strong></div></div><div class="career-float"><span>Career signal</span><strong>Related roles may pay more</strong><small>Compare official UK salary guides</small></div></div>`;

  qa('[data-open]').forEach(button => button.addEventListener('click', () => showPanel(button.dataset.open)));
  $('resetButtonV4').addEventListener('click', () => location.reload());
}

function simplifyNavigation() {
  const nav = q('.tab-nav');
  const labels = {
    pay:['1','Income','Pay, overtime and leave'],
    spending:['2','Monthly costs','Where your money goes'],
    results:['3','Results','Real pay and breakdowns'],
    projections:['4','Future','Income and pension charts'],
    pension:['5','Pension','Retirement outlook'],
    budget:['6','Career','Higher-paying paths'],
    mortgage:['7','Mortgage','Illustrative position'],
    resources:['8','Resources','Useful UK support']
  };
  qa('.nav-tab', nav).forEach(button => {
    if (['overtime','car'].includes(button.dataset.tab)) {
      button.classList.add('removed-tab');
      button.setAttribute('aria-hidden','true');
      return;
    }
    const original = button.dataset.tab;
    const [number,title,subtitle] = labels[original];
    if (original === 'budget') button.dataset.tab = 'career';
    button.innerHTML = `<span>${number}</span><strong>${title}</strong><small>${subtitle}</small>`;
  });
  const ordered = ['pay','spending','results','projections','pension','career','mortgage','resources'];
  ordered.forEach(name => {
    const button = q(`.nav-tab[data-tab="${name}"]`, nav);
    if (button) nav.append(button);
  });
}

function combineIncomeSections() {
  const payPanel = q('[data-panel="pay"]');
  const overtimePanel = q('[data-panel="overtime"]');
  payPanel.classList.add('income-panel-v4');
  q('.panel-heading h2', payPanel).textContent = 'Build your income picture.';
  q('.panel-heading p:last-child', payPanel).textContent = 'Use common choices for speed, then open exact settings only when your work pattern needs them.';
  q('.section-badge', payPanel).textContent = 'Step 1 of 2';

  const primaryGrid = q('.primary-inputs .form-grid', payPanel);
  const hoursLabel = $('hoursPerWeek').closest('label');
  const patternLabel = document.createElement('label');
  patternLabel.className = 'guided-control';
  patternLabel.innerHTML = `Working pattern<select id="workingPattern"><option value="37.5">Full-time — 37.5 hours</option><option value="40">Full-time — 40 hours</option><option value="20">Part-time — 20 hours</option><option value="variable">Variable hours</option><option value="custom">Other — enter it myself</option></select><small>Sets weekly hours; exact figures remain editable.</small>`;
  primaryGrid.insertBefore(patternLabel, hoursLabel);

  const workPattern = $('workingPattern');
  workPattern.addEventListener('change', () => {
    const presets = {'37.5':[37.5,5],'40':[40,5],'20':[20,3]};
    if (presets[workPattern.value]) {
      $('hoursPerWeek').value = presets[workPattern.value][0];
      $('daysPerWeek').value = presets[workPattern.value][1];
      $('hoursPerWeek').dispatchEvent(new Event('input',{bubbles:true}));
    }
    hoursLabel.classList.toggle('soft-highlight', ['variable','custom'].includes(workPattern.value));
  });

  const exactSettings = q('.advanced-details', payPanel);
  exactSettings.querySelector('summary').textContent = 'Exact pay and working settings';
  const detailsBody = q('.details-body', exactSettings);
  detailsBody.classList.add('form-grid');
  detailsBody.append($('daysPerWeek').closest('label'), $('paidWeeks').closest('label'));

  const overtimeDetails = document.createElement('details');
  overtimeDetails.className = 'advanced-details income-extra-details';
  overtimeDetails.innerHTML = '<summary>Overtime and leave</summary><div class="details-body"></div>';
  const overtimeBody = q('.details-body', overtimeDetails);
  const overtimeCards = q('.two-card-grid', overtimePanel);
  overtimeBody.append(overtimeCards, q('.formula-note', overtimePanel));
  payPanel.insertBefore(overtimeDetails, q('.action-row', payPanel));
  overtimePanel.classList.add('retired-panel');

  const overtimeCard = overtimeCards.children[0];
  const overtimePreset = document.createElement('label');
  overtimePreset.innerHTML = `Overtime pattern<select id="overtimePreset"><option value="none">No overtime</option><option value="occasional">Occasional — 4 hours in 12 weeks</option><option value="regular">Regular — 5 hours in 46 weeks</option><option value="custom">Enter exact figures</option></select><small>Presets can be edited after selection.</small>`;
  q('.form-grid', overtimeCard).prepend(overtimePreset);
  const exactOvertimeLabels = qa('label', q('.form-grid', overtimeCard)).slice(1);
  exactOvertimeLabels.forEach(label => label.classList.add('conditional-overtime','hidden'));
  $('overtimePreset').addEventListener('change', () => {
    const preset = $('overtimePreset').value;
    const estimatedRate = estimateNormalHourlyRate();
    if (preset === 'none') setValues({overtimeHours:0,overtimeRate:0,overtimeWeeks:0});
    if (preset === 'occasional') setValues({overtimeHours:4,overtimeRate:estimatedRate,overtimeWeeks:12});
    if (preset === 'regular') setValues({overtimeHours:5,overtimeRate:estimatedRate,overtimeWeeks:46});
    exactOvertimeLabels.forEach(label => label.classList.toggle('hidden', preset === 'none'));
  });
  const rateButton = document.createElement('button');
  rateButton.type = 'button'; rateButton.className = 'inline-action'; rateButton.textContent = 'Use estimated normal hourly rate';
  $('overtimeRate').after(rateButton);
  rateButton.addEventListener('click', () => { $('overtimeRate').value = estimateNormalHourlyRate().toFixed(2); $('overtimeRate').dispatchEvent(new Event('input',{bubbles:true})); });

  const leaveCard = overtimeCards.children[1];
  const leavePreset = document.createElement('label');
  leavePreset.innerHTML = `Leave arrangement<select id="leavePreset"><option value="standard">Standard paid leave — 5.6 weeks</option><option value="paidCustom">Paid leave — enter weeks</option><option value="unpaid">Some unpaid leave</option><option value="none">No leave entered</option></select>`;
  q('.form-grid', leaveCard).prepend(leavePreset);
  $('leavePreset').addEventListener('change', () => {
    const preset = $('leavePreset').value;
    if (preset === 'standard') setValues({leaveWeeks:5.6,leavePaid:'yes'});
    if (preset === 'unpaid') setValues({leaveWeeks:1,leavePaid:'no'});
    if (preset === 'none') setValues({leaveWeeks:0,leavePaid:'yes'});
    $('leaveWeeks').closest('label').classList.toggle('soft-highlight', preset === 'paidCustom' || preset === 'unpaid');
  });

  const payNext = q('.action-row .next-tab', payPanel);
  payNext.dataset.next = 'spending';
  payNext.textContent = 'Next: monthly costs';
  const spendingBack = q('[data-panel="spending"] .prev-tab');
  spendingBack.dataset.prev = 'pay';
  spendingBack.textContent = 'Back to income';
}

function estimateNormalHourlyRate() {
  const amount = value('payAmount');
  const hours = Math.max(.1, value('hoursPerWeek'));
  const weeks = Math.max(1, value('paidWeeks'));
  const type = $('payType').value;
  if (type === 'hourly') return amount;
  const yearly = type === 'annual' ? amount : type === 'monthly' ? amount * 12 : amount * weeks;
  return yearly / (hours * weeks);
}

function setValues(values) {
  Object.entries(values).forEach(([id,newValue]) => {
    if (!$(id)) return;
    $(id).value = newValue;
    $(id).dispatchEvent(new Event('input',{bubbles:true}));
    $(id).dispatchEvent(new Event('change',{bubbles:true}));
  });
}

const transportIds = ['carFinanceCost','carInsuranceCost','carFuelCost','carTaxCost','carMaintenanceCost','carParkingCost','publicTransportCost','otherTransportCost'];
const livingIds = ['phoneCost','childcareCost','careCost'];

function redesignCosts() {
  const panel = q('[data-panel="spending"]');
  panel.classList.add('costs-panel-v4');
  q('.panel-heading h2', panel).textContent = 'Your monthly costs.';
  q('.panel-heading p:last-child', panel).textContent = 'Open only the categories that apply. Each section shows what belongs there and its running total.';
  const grid = q('.expense-grid', panel);
  grid.className = 'cost-accordion';
  const cards = [...grid.children];
  const names = ['Home and bills','Everyday living','Debt and repayments','Lifestyle'];
  cards.forEach((card,index) => {
    card.className = 'cost-section';
    const title = q('h3', card);
    if (title) title.textContent = names[index];
    const total = document.createElement('strong');
    total.className = 'category-total'; total.dataset.category = ['home','living','debt','lifestyle'][index]; total.textContent = '£0';
    q('.card-title', card).append(total);
  });

  const transportProxy = $('expTransport').closest('label');
  const financeProxy = $('expFinance').closest('label');
  const livingProxy = $('expLiving').closest('label');
  [transportProxy,financeProxy,livingProxy].forEach(label => label.classList.add('calculation-proxy'));

  const livingForm = q('.form-grid', cards[1]);
  livingForm.insertAdjacentHTML('beforeend', `
    <label>Phone and mobile (£)<input id="phoneCost" type="number" min="0" value="0"></label>
    <label>Childcare (£)<input id="childcareCost" type="number" min="0" value="0"></label>
    <label>Medical or care costs (£)<input id="careCost" type="number" min="0" value="0"></label>`);

  const transport = document.createElement('article');
  transport.className = 'cost-section cost-transport';
  transport.innerHTML = `<div class="card-title"><span class="card-icon">↗</span><div><h3>Car and transport</h3><p>Finance, insurance, fuel, maintenance, parking and public transport.</p></div><strong class="category-total" data-category="transport">£0</strong></div><div class="form-grid transport-grid"><label>Car-finance payment (£)<input id="carFinanceCost" type="number" min="0" value="0"></label><label>Car insurance (£)<input id="carInsuranceCost" type="number" min="0" value="0"></label><label>Fuel or charging (£)<input id="carFuelCost" type="number" min="0" value="0"></label><label>Vehicle tax (£)<input id="carTaxCost" type="number" min="0" value="0"></label><label>Maintenance (£)<input id="carMaintenanceCost" type="number" min="0" value="0"></label><label>Parking (£)<input id="carParkingCost" type="number" min="0" value="0"></label><label>Public transport (£)<input id="publicTransportCost" type="number" min="0" value="0"></label><label>Other transport (£)<input id="otherTransportCost" type="number" min="0" value="0"></label></div>`;
  grid.insertBefore(transport, cards[2]);

  const homeCard = cards[0];
  const housingLabel = $('expHousing').closest('label');
  const housingChoice = document.createElement('label');
  housingChoice.innerHTML = `Housing arrangement<select id="housingPreset"><option value="rent">Renting</option><option value="mortgage">Paying a mortgage</option><option value="family">Living with family</option><option value="none">No housing payment</option><option value="custom">Other — enter it myself</option></select><small>Choose a type, then enter the actual monthly amount.</small>`;
  q('.form-grid', homeCard).insertBefore(housingChoice, housingLabel);
  $('housingPreset').addEventListener('change', () => {
    if (['family','none'].includes($('housingPreset').value)) setValues({expHousing:0});
    housingLabel.classList.toggle('hidden', $('housingPreset').value === 'none');
  });

  [...transportIds,...livingIds].forEach(id => $(id).addEventListener('input', syncDetailedCosts));
  qa('input', grid).forEach(input => input.addEventListener('input', updateCategoryTotals));
  syncDetailedCosts();
  updateCategoryTotals();

  const next = q('.next-tab', panel);
  next.dataset.next = 'pension';
  next.textContent = 'Next: pension estimate';
}

function syncDetailedCosts() {
  const transportRunning = transportIds.slice(1).reduce((sum,id) => sum + value(id), 0);
  const living = livingIds.reduce((sum,id) => sum + value(id), 0);
  syncProxy('expTransport', transportRunning);
  syncProxy('expFinance', value('carFinanceCost'));
  syncProxy('expLiving', living);
  if ($('mortgageCarFinance')) $('mortgageCarFinance').value = value('carFinanceCost');
  if ($('mortgageDebt')) $('mortgageDebt').value = value('expDebt');
  if ($('mortgageChildcare')) $('mortgageChildcare').value = value('childcareCost');
  updateCategoryTotals();
}

function syncProxy(id, newValue) {
  if (!$(id)) return;
  if (Number($(id).value) === Number(newValue)) return;
  $(id).value = newValue;
  $(id).dispatchEvent(new Event('input',{bubbles:true}));
}

function updateCategoryTotals() {
  const totals = {
    home:value('expHousing')+value('expCouncilTax')+value('expUtilities'),
    living:value('expFood')+livingIds.reduce((s,id)=>s+value(id),0),
    transport:transportIds.reduce((s,id)=>s+value(id),0),
    debt:value('expDebt'),
    lifestyle:value('expSubscriptions')+value('expOptional')+value('expOther')
  };
  qa('.category-total').forEach(node => node.textContent = money(totals[node.dataset.category] || 0));
}

function enhancePensionInputs() {
  const panel = q('[data-panel="pension"]');
  q('.panel-heading h2',panel).textContent = 'Your pension outlook.';
  q('.panel-heading p:last-child',panel).textContent = 'Choose a common pension type first. Exact contribution and growth settings remain available underneath.';
  const mainCard = q('.input-card',panel);
  const preset = document.createElement('label');
  preset.className = 'pension-preset';
  preset.innerHTML = `Pension arrangement<select id="pensionPreset"><option value="standard">Standard workplace pension — 5% you, 3% employer</option><option value="public">Public-sector or defined-benefit pension</option><option value="personal">Personal pension — no employer contribution</option><option value="none">No pension contributions</option><option value="custom">Enter exact details</option></select><small>Defined-benefit pensions cannot be valued accurately with a simple pension-pot model.</small>`;
  q('.form-grid',mainCard).prepend(preset);
  $('pensionPreset').addEventListener('change', () => {
    const selected = $('pensionPreset').value;
    if (selected === 'standard') setValues({employeePensionPct:5,employerPensionPct:3,pensionSchemeType:'definedContribution'});
    if (selected === 'public') setValues({pensionSchemeType:'definedBenefit'});
    if (selected === 'personal') setValues({employeePensionPct:5,employerPensionPct:0,pensionSchemeType:'definedContribution'});
    if (selected === 'none') setValues({employeePensionPct:0,employerPensionPct:0,pensionSchemeType:'definedContribution'});
  });
}

function moveBudgetIntoResultsAndBuildCareer() {
  const results = q('[data-panel="results"]');
  const budgetPanel = q('[data-panel="budget"]');
  const guidance = document.createElement('section');
  guidance.className = 'results-guidance-v4';
  guidance.innerHTML = '<div class="visual-heading"><div><p class="eyebrow">Personal guidance</p><h3>What your figures suggest</h3></div><small>Based only on this browser session.</small></div>';
  guidance.append($('budgetDashboard'), q('.budget-columns',budgetPanel));
  results.append(guidance);

  budgetPanel.dataset.panel = 'career';
  budgetPanel.className = 'tab-panel career-panel-v4';
  budgetPanel.innerHTML = `
    <div class="panel-heading"><div><p class="eyebrow">Career progression</p><h2>Compare your role with related higher-paying paths.</h2><p>Suggestions use title, description and skill overlap, then compare official National Careers Service salary guides.</p></div><span class="source-chip">Checked ${escapeHtml(CAREER_DATA_DATE)}</span></div>
    <div class="career-layout"><article class="career-form"><div class="form-grid"><label>Current job title<input id="careerTitle" type="text" list="careerTitles" placeholder="For example, admin assistant"><datalist id="careerTitles"></datalist></label><label>Current yearly salary (£)<input id="careerSalary" type="number" min="0" value="30000"></label><label>Region<select id="careerRegion"><option>United Kingdom</option><option>Yorkshire and the Humber</option><option>North East</option><option>North West</option><option>East Midlands</option><option>West Midlands</option><option>East of England</option><option>London</option><option>South East</option><option>South West</option><option>Wales</option><option>Scotland</option><option>Northern Ireland</option></select></label><label>Experience<select id="careerExperience"><option value="starter">Starting or changing career</option><option value="developing" selected>Some experience</option><option value="experienced">Experienced</option></select></label><label>Industry<select id="careerSector"><option value="">Any industry</option>${[...new Set(CAREERS.map(role=>role.sector))].sort().map(sector=>`<option>${escapeHtml(sector)}</option>`).join('')}</select></label><label>Qualifications or skills<input id="careerSkills" type="text" placeholder="Excel, customer service, coding, leadership…"></label></div><label>Paste a job description or advert<textarea id="careerDescription" rows="6" placeholder="Paste the role description here. It is analysed only in this browser session."></textarea></label><label class="file-label">Or import a plain-text description<input id="careerFile" type="file" accept=".txt,.md,text/plain,text/markdown"><small id="careerFileStatus">TXT and Markdown files are read temporarily in your browser and are not uploaded.</small></label><button id="careerFind" class="button primary career-find" type="button">Find career progression ideas</button></article><aside class="career-method"><p class="eyebrow hero-eyebrow">How it works</p><h3>Skills first. Salary second.</h3><p>Wage Wise finds related roles, then prioritises those with a higher official salary-range midpoint.</p><ul><li>No invented employers or vacancies</li><li>Source and date shown</li><li>Official profile links</li><li>Live searches open GOV.UK Find a Job</li></ul></aside></div>
    <div id="careerResults" class="career-results muted"><p>Enter a title or paste a description to see progression ideas.</p></div>
    <article id="careerChartPanel" class="career-chart-panel hidden"><header><div><p class="eyebrow">Income comparison</p><h3>Current role versus selected paths</h3></div><small>Alternative salary uses the midpoint of the sourced range.</small></header><div id="careerChart" class="career-chart"></div></article>
    <p class="career-source-note">${escapeHtml(CAREER_SOURCE_NOTE)}</p>`;

  $('careerTitles').innerHTML = CAREERS.map(role => `<option value="${escapeHtml(role.title)}"></option>`).join('');
  $('careerSalary').value = Math.round(currentCalculation()?.gross || value('payAmount') || 30000);
  $('careerFind').addEventListener('click', renderCareerSuggestions);
  $('careerFile').addEventListener('change', readCareerFile);
}

function readCareerFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (!/\.(txt|md)$/i.test(file.name) && !['text/plain','text/markdown'].includes(file.type)) {
    $('careerFileStatus').textContent = 'This browser-only version supports TXT or Markdown. Paste other document text into the box.';
    return;
  }
  if (file.size > 1_000_000) {
    $('careerFileStatus').textContent = 'Choose a text file smaller than 1 MB.';
    return;
  }
  const reader = new FileReader();
  reader.onload = () => { $('careerDescription').value = String(reader.result || '').slice(0,30000); $('careerFileStatus').textContent = `${file.name} loaded locally. Nothing was uploaded.`; };
  reader.onerror = () => { $('careerFileStatus').textContent = 'The file could not be read. Paste the text instead.'; };
  reader.readAsText(file);
}

function tokenise(text) {
  return [...new Set(String(text).toLowerCase().replace(/[^a-z0-9+# ]/g,' ').split(/\s+/).filter(word => word.length > 2))];
}

function roleScore(role, queryText, selectedSector) {
  const query = String(queryText).toLowerCase();
  const words = tokenise(query);
  const titleText = [role.title,...role.aliases].join(' ').toLowerCase();
  const roleText = `${titleText} ${role.description} ${role.skills.join(' ')} ${role.sector}`.toLowerCase();
  let score = 0;
  if (query.includes(role.title.toLowerCase())) score += 30;
  if (role.aliases.some(alias => query.includes(alias))) score += 22;
  words.forEach(word => { if (titleText.includes(word)) score += 4; else if (role.skills.some(skill => skill.includes(word) || word.includes(skill))) score += 3; else if (roleText.includes(word)) score += 1; });
  if (selectedSector && role.sector === selectedSector) score += 6;
  return score;
}

function renderCareerSuggestions() {
  const currentSalary = Math.max(0,value('careerSalary')) || currentCalculation()?.gross || 0;
  const queryText = `${$('careerTitle').value} ${$('careerSkills').value} ${$('careerDescription').value}`.trim();
  const selectedSector = $('careerSector').value;
  if (!queryText && !selectedSector) {
    $('careerResults').className = 'career-results muted';
    $('careerResults').innerHTML = '<p>Add a job title, industry, skills or job description first.</p>';
    $('careerChartPanel').classList.add('hidden');
    return;
  }
  const ranked = CAREERS.map(role => ({role,score:roleScore(role,queryText,selectedSector)})).sort((a,b)=>b.score-a.score || midpoint(b.role)-midpoint(a.role));
  const matched = ranked[0]?.score > 0 ? ranked[0].role : null;
  const progressionIds = matched?.progression || [];
  const suggestions = CAREERS.filter(role => role.id !== matched?.id).map(role => {
    const direct = progressionIds.includes(role.id) ? 24 : 0;
    const shared = matched ? role.skills.filter(skill => matched.skills.some(existing => existing.includes(skill) || skill.includes(existing))).length * 5 : 0;
    const query = roleScore(role,queryText,selectedSector);
    const payLift = midpoint(role) > currentSalary ? Math.min(10,(midpoint(role)-currentSalary)/3000) : -4;
    return {role,score:direct+shared+query+payLift};
  }).filter(item => item.score > 0 && midpoint(item.role) > currentSalary * .95).sort((a,b)=>b.score-a.score || midpoint(b.role)-midpoint(a.role)).slice(0,5);

  if (!suggestions.length) {
    $('careerResults').className = 'career-results muted';
    $('careerResults').innerHTML = `<p>No clear progression match was found in the curated dataset. Try adding more skills or selecting an industry.</p>`;
    $('careerChartPanel').classList.add('hidden');
    return;
  }
  const currentTitle = matched?.title || $('careerTitle').value || 'Current role';
  $('careerResults').className = 'career-results';
  $('careerResults').innerHTML = `<div class="career-summary"><div><span>Closest match</span><strong>${escapeHtml(currentTitle)}</strong><small>${matched ? `${money(matched.minSalary)}–${money(matched.maxSalary)} guide` : 'Your entered role'}</small></div><div><span>Your entered salary</span><strong>${money(currentSalary)}</strong><small>${escapeHtml($('careerRegion').value)}</small></div><div><span>Salary source</span><strong>${escapeHtml(CAREER_SOURCE_NAME)}</strong><small>Checked ${escapeHtml(CAREER_DATA_DATE)}</small></div></div><div class="career-card-grid">${suggestions.map(({role},index)=>careerCard(role,index,currentSalary)).join('')}</div>`;
  qa('.career-compare').forEach(box => box.addEventListener('change', () => renderCareerChart(currentTitle,currentSalary,suggestions.map(item=>item.role))));
  renderCareerChart(currentTitle,currentSalary,suggestions.map(item=>item.role));
}

const midpoint = role => (role.minSalary + role.maxSalary) / 2;

function careerCard(role,index,currentSalary) {
  const middle = midpoint(role);
  const currentNet = estimateNetForSalary(currentSalary);
  const alternativeNet = estimateNetForSalary(middle);
  const monthlyLift = (alternativeNet.net-currentNet.net)/12;
  const search = `https://findajob.dwp.gov.uk/search?q=${encodeURIComponent(role.title)}`;
  return `<article class="career-card ${index===0?'featured':''}"><div class="career-card-top"><span>${index===0?'Strongest progression match':'Related path'}</span><label class="compare-label"><input class="career-compare" type="checkbox" value="${escapeHtml(role.id)}" ${index<3?'checked':''}> Compare</label></div><h3>${escapeHtml(role.title)}</h3><p>${escapeHtml(role.description)}</p><div class="career-salary"><div><span>Official guide</span><strong>${money(role.minSalary)}–${money(role.maxSalary)}</strong></div><div><span>Estimated monthly take-home change</span><strong class="${monthlyLift>=0?'positive-text':'negative-text'}">${monthlyLift>=0?'+':''}${money(monthlyLift)}</strong></div></div><div class="career-skills">${role.skills.slice(0,4).map(skill=>`<span>${escapeHtml(skill)}</span>`).join('')}</div><div class="career-links"><a href="${escapeHtml(role.sourceUrl)}" target="_blank" rel="noopener noreferrer">Official role profile ↗</a><a href="${search}" target="_blank" rel="noopener noreferrer">Search current jobs ↗</a></div></article>`;
}

function estimateNetForSalary(salary) {
  const base = gatherPayInput();
  return calculatePay({...base,payType:'annual',payAmount:Math.max(0,salary),overtimeHours:0,overtimeRate:0,overtimeWeeks:0,leavePaid:true});
}

function renderCareerChart(currentTitle,currentSalary,roles) {
  const selected = new Set(qa('.career-compare:checked').map(input=>input.value));
  const compared = roles.filter(role => selected.has(role.id)).slice(0,4);
  if (!compared.length) { $('careerChartPanel').classList.add('hidden'); return; }
  $('careerChartPanel').classList.remove('hidden');
  const items = [{title:currentTitle,salary:currentSalary,current:true},...compared.map(role=>({title:role.title,salary:midpoint(role),current:false}))];
  const values = items.map(item => ({...item,result:estimateNetForSalary(item.salary)}));
  const maxGross = Math.max(...values.map(item=>item.salary),1);
  $('careerChart').innerHTML = `<div class="career-chart-legend"><span><i class="gross-key"></i>Gross salary</span><span><i class="net-key"></i>Estimated take-home</span></div>${values.map(item => `<div class="career-chart-row"><strong>${escapeHtml(item.title)}</strong><div class="career-bars"><div class="career-bar gross" style="width:${Math.max(3,item.salary/maxGross*100)}%"><span>${money(item.salary)}</span></div><div class="career-bar net" style="width:${Math.max(3,item.result.net/maxGross*100)}%"><span>${money(item.result.net)}</span></div></div><small>${money(item.result.net/12)}/month take-home</small></div>`).join('')}<p class="chart-note">Alternative salaries use the midpoint of a starter-to-experienced guide, not a promised salary. Five-year take-home at unchanged pay: ${values.slice(1).map(item=>`${escapeHtml(item.title)} ${money(item.result.net*5)}`).join(' · ')}</p>`;
}

function gatherPayInput() {
  return {
    payType:$('payType').value,payAmount:value('payAmount'),payFrequency:$('payFrequency').value,
    hoursPerWeek:value('hoursPerWeek'),daysPerWeek:value('daysPerWeek'),paidWeeks:value('paidWeeks'),
    overtimeHours:value('overtimeHours'),overtimeRate:value('overtimeRate'),overtimeWeeks:value('overtimeWeeks'),
    leaveWeeks:value('leaveWeeks'),leavePaid:$('leavePaid').value === 'yes',
    expenses:{housing:value('expHousing'),councilTax:value('expCouncilTax'),utilities:value('expUtilities'),food:value('expFood'),transport:value('expTransport'),living:value('expLiving'),debt:value('expDebt'),finance:value('expFinance'),subscriptions:value('expSubscriptions'),optional:value('expOptional'),other:value('expOther')}
  };
}

function gatherProjectionSettings() {
  return {
    pensionSchemeType:$('pensionSchemeType').value,pensionBasis:$('pensionBasis').value,pensionablePay:value('pensionablePay'),pensionMethod:$('pensionMethod').value,
    employeePensionPct:value('employeePensionPct'),employerPensionPct:value('employerPensionPct'),currentPension:value('currentPension'),currentAge:value('currentAge'),retirementAge:value('retirementAge'),
    pensionGrowthPct:value('pensionGrowthPct'),pensionFeePct:value('pensionFeePct'),desiredRetirementIncome:value('desiredRetirementIncome'),statePensionAnnual:value('statePensionAnnual'),includeStatePension:value('statePensionAnnual')>0,drawdownPct:value('drawdownPct'),
    wageGrowthPct:value('wageGrowthPct'),expenseGrowthPct:value('expenseGrowthPct'),overtimeGrowthPct:value('overtimeGrowthPct'),inflationPct:value('inflationPct'),projectionYears:value('projectionYears')
  };
}

function currentCalculation() {
  syncDetailedCosts();
  const result = calculatePay(gatherPayInput());
  return result.valid ? result : null;
}

function currentProjection() {
  const result = projectIncomeAndPension(gatherPayInput(),gatherProjectionSettings());
  return result.valid ? result : null;
}

function addPeriodComparison() {
  const results = q('[data-panel="results"]');
  const visualHeading = q('.visual-heading',results);
  const section = document.createElement('article');
  section.className = 'period-comparison-v4';
  section.innerHTML = `<header><div><p class="eyebrow">Pay-period comparison</p><h3>One income, viewed across each period.</h3></div><label>Compare<select id="periodMetric"><option value="net">Take-home</option><option value="gross">Gross income</option><option value="remaining">Remaining after costs</option></select></label></header><div id="periodComparisonChart" class="period-chart-v4"><p>Update the calculation to view the chart.</p></div><p class="chart-note">Bar heights use square-root scaling so smaller periods remain visible. The printed figures are the exact estimates.</p>`;
  results.insertBefore(section,visualHeading);
  $('periodMetric').addEventListener('change',renderEnhancements);
}

function renderPeriodComparison(pay) {
  if (!pay) return;
  const metric = $('periodMetric')?.value || 'net';
  const sets = {
    gross:[pay.grossHourly,pay.grossDaily,pay.grossWeekly,pay.grossMonthly,pay.gross],
    net:[pay.netHourly,pay.netDaily,pay.netWeekly,pay.netMonthly,pay.net],
    remaining:[pay.remainingHourly,pay.remainingDaily,pay.remainingWeekly,pay.remainingMonthly,pay.remainingYear]
  };
  const labels = ['Hour','Working day','Paid week','Month','Year'];
  const figures = sets[metric];
  const max = Math.max(...figures.map(number=>Math.max(0,number)),1);
  $('periodComparisonChart').innerHTML = figures.map((figure,index) => {
    const height = Math.max(5,Math.sqrt(Math.max(0,figure)/max)*100);
    return `<div class="period-column"><strong>${money(figure,index===0?2:0)}</strong><div class="period-track"><div class="period-fill" style="height:${height}%"></div></div><span>${labels[index]}</span></div>`;
  }).join('');
}

function renderEnhancedDonuts(pay,projection) {
  if (!pay || !projection) return;
  const expenseShown = Math.min(Math.max(0,pay.expensesYear),Math.max(0,pay.net));
  const remaining = Math.max(0,pay.remainingYear);
  renderDonut('moneyDonut','moneyDonutCentre','moneyLegend',[
    ['Income Tax',pay.tax,'#1557d5'],['Employee NI',pay.ni,'#40208e'],['Entered costs',expenseShown,'#f1bb19'],['Money remaining',remaining,'#34765a']
  ], percent(pay.gross ? remaining/pay.gross*100 : 0));
  const expenseNames = {housing:'Housing',councilTax:'Council Tax',utilities:'Utilities',food:'Food',transport:'Car & transport',living:'Phone, childcare & care',debt:'Debt',finance:'Car finance',subscriptions:'Subscriptions',optional:'Lifestyle',other:'Other'};
  renderDonut('spendingDonut','spendingDonutCentre','spendingLegend',Object.entries(pay.expenses).map(([key,amount],index)=>[expenseNames[key]||key,amount,chartColours[index%chartColours.length]]),money(pay.expensesMonth));
  const pension = projection.pension;
  renderDonut('pensionDonut','pensionDonutCentre','pensionLegend',[
    ['Current balance',value('currentPension'),'#1557d5'],['Your deposits',pension.employeeDeposits,'#34765a'],['Employer deposits',pension.employerDeposits,'#f1bb19'],['Net estimated growth',Math.max(0,pension.investmentGrowth-pension.fees),'#40208e']
  ],money(pension.balanceAtRetirement));
}

function renderDonut(donutId,centreId,legendId,rawSlices,centreText) {
  const slices = rawSlices.map(([label,amount,colour])=>({label,amount:Math.max(0,Number(amount)||0),colour})).filter(item=>item.amount>0);
  const total = slices.reduce((sum,item)=>sum+item.amount,0);
  $(centreId).textContent = centreText;
  if (!total) { $(donutId).style.background='#e5eaf0'; $(legendId).innerHTML='<div><i style="background:#cbd5e1"></i><span>No figures entered</span><strong>—</strong></div>'; return; }
  let start=0;
  $(donutId).style.background=`conic-gradient(${slices.map(item=>{const from=start;start+=item.amount/total*100;return `${item.colour} ${from}% ${start}%`;}).join(',')})`;
  $(legendId).innerHTML=slices.map(item=>`<div><i style="background:${item.colour}"></i><span>${escapeHtml(item.label)} <small>${percent(item.amount/total*100)}</small></span><strong>${money(item.amount)}</strong></div>`).join('');
}

function simplifyMortgage() {
  const panel = q('[data-panel="mortgage"]');
  q('.panel-heading h2',panel).textContent = 'A simpler mortgage position estimate.';
  q('.panel-heading p:last-child',panel).textContent = 'Essential figures appear first. Car finance, debt and childcare are brought across from monthly costs.';
  const details = q('.advanced-details',panel);
  details.querySelector('summary').textContent = 'Review commitments and lending assumptions';
  $('mortgageCalculate').addEventListener('click',syncDetailedCosts,{capture:true});
}

function addTrustStripAndClosing() {
  const trust = document.createElement('section');
  trust.className='trust-strip-v4';
  trust.innerHTML='<div><strong>2026/27 estimate</strong><span>England, Wales and Northern Ireland</span></div><div><strong>No account</strong><span>No stored salary or job-description data</span></div><div><strong>Career ranges sourced</strong><span>National Careers Service guides</span></div>';
  q('.app-card').before(trust);
  const closing=document.createElement('section');
  closing.className='closing-v4';
  closing.innerHTML='<p class="eyebrow hero-eyebrow">Designed for clarity</p><h2>Finance-first data without the finance-industry fog.</h2><p>Professional visualisation for ordinary working income — not an attempt to turn your salary into an investment product.</p>';
  q('.legal-note').before(closing);
}

function renderEnhancements() {
  const pay=currentCalculation();
  const projection=currentProjection();
  if (!pay || !projection) return;
  renderPeriodComparison(pay);
  setTimeout(()=>renderEnhancedDonuts(pay,projection),0);
  $('careerSalary').value = $('careerSalary').dataset.edited === 'yes' ? $('careerSalary').value : Math.round(pay.gross);
  $('mortgageIncome1').value = Math.round(pay.gross);
}

function wireRendering() {
  $('careerSalary').addEventListener('input',()=>{$('careerSalary').dataset.edited='yes';});
  const triggers=[
    $('calculateButton'),...qa('.recalculate'),$('mortgageCalculate')
  ].filter(Boolean);
  triggers.forEach(button=>button.addEventListener('click',()=>{syncDetailedCosts();setTimeout(renderEnhancements,20);},{capture:true}));
  const observer=new MutationObserver(()=>renderEnhancements());
  observer.observe($('resultStatus'),{childList:true,subtree:true,characterData:true});
}

function init() {
  redesignHeaderAndHero();
  simplifyNavigation();
  combineIncomeSections();
  redesignCosts();
  enhancePensionInputs();
  moveBudgetIntoResultsAndBuildCareer();
  addPeriodComparison();
  simplifyMortgage();
  addTrustStripAndClosing();
  wireRendering();
  q('[data-panel="car"]').classList.add('retired-panel');
  q('[data-panel="resources"] .panel-heading h2').textContent='Useful UK tools and next steps.';
  q('[data-panel="resources"] .panel-heading p:last-child').textContent='Independent resources are shown first. Any future commercial placement will be clearly labelled.';
  renderEnhancements();
}

init();