#!/usr/bin/env node
/**
 * Expense Tracking & Tax Categorization
 * Sprint 2 Task 17 — Cortex Freelancer
 *
 * Track business expenses, auto-categorize for tax purposes,
 * generate tax reports, receipt management, mileage tracking,
 * and deduction optimization. Built for freelancer tax compliance.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ─── Storage ────────────────────────────────────────────────────────────────

const DATA_DIR = path.join(
  process.env.HOME || process.env.USERPROFILE || '.',
  '.cortex-freelancer',
  'expenses'
);

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readJSON(file, fallback = []) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return fallback; }
}

function writeJSON(file, data) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

const PATHS = {
  expenses:   () => path.join(DATA_DIR, 'expenses.json'),
  categories: () => path.join(DATA_DIR, 'categories.json'),
  rules:      () => path.join(DATA_DIR, 'rules.json'),
  mileage:    () => path.join(DATA_DIR, 'mileage.json'),
  receipts:   () => path.join(DATA_DIR, 'receipts.json'),
  settings:   () => path.join(DATA_DIR, 'settings.json'),
};

// ─── Tax Categories (IRS Schedule C aligned) ────────────────────────────────

const DEFAULT_CATEGORIES = [
  { id: 'advertising', name: 'Advertising & Marketing', schedule_c_line: 8, deductible: true, examples: ['Google Ads', 'Facebook Ads', 'business cards', 'website hosting for marketing'] },
  { id: 'car_expenses', name: 'Car & Vehicle Expenses', schedule_c_line: 9, deductible: true, examples: ['gas for business trips', 'car maintenance (business use)', 'parking fees'] },
  { id: 'commissions', name: 'Commissions & Fees', schedule_c_line: 10, deductible: true, examples: ['platform fees', 'payment processing fees', 'referral fees'] },
  { id: 'contract_labor', name: 'Contract Labor', schedule_c_line: 11, deductible: true, examples: ['subcontractor payments', 'freelance help', 'virtual assistant'] },
  { id: 'depreciation', name: 'Depreciation', schedule_c_line: 13, deductible: true, examples: ['computer depreciation', 'office furniture depreciation'] },
  { id: 'insurance', name: 'Insurance', schedule_c_line: 15, deductible: true, examples: ['professional liability', 'health insurance (self-employed)', 'equipment insurance'] },
  { id: 'interest', name: 'Interest (Business)', schedule_c_line: 16, deductible: true, examples: ['business credit card interest', 'business loan interest'] },
  { id: 'legal_professional', name: 'Legal & Professional Services', schedule_c_line: 17, deductible: true, examples: ['accountant fees', 'lawyer fees', 'tax preparation'] },
  { id: 'office_expense', name: 'Office Expenses', schedule_c_line: 18, deductible: true, examples: ['printer ink', 'paper', 'postage', 'office supplies'] },
  { id: 'rent_lease', name: 'Rent or Lease', schedule_c_line: 20, deductible: true, examples: ['coworking space', 'office rent', 'equipment rental'] },
  { id: 'repairs', name: 'Repairs & Maintenance', schedule_c_line: 21, deductible: true, examples: ['computer repair', 'office equipment repair'] },
  { id: 'supplies', name: 'Supplies', schedule_c_line: 22, deductible: true, examples: ['raw materials', 'project supplies'] },
  { id: 'taxes_licenses', name: 'Taxes & Licenses', schedule_c_line: 23, deductible: true, examples: ['business license', 'state taxes', 'professional certifications'] },
  { id: 'travel', name: 'Travel', schedule_c_line: 24, deductible: true, examples: ['flights', 'hotels', 'rental cars', 'conference travel'] },
  { id: 'meals', name: 'Meals (Business)', schedule_c_line: 24, deductible: true, deduction_pct: 50, examples: ['client meals', 'business meeting meals'] },
  { id: 'utilities', name: 'Utilities', schedule_c_line: 25, deductible: true, examples: ['phone bill (business %)', 'internet (business %)'] },
  { id: 'home_office', name: 'Home Office', schedule_c_line: 30, deductible: true, examples: ['rent portion', 'utilities portion', 'home office supplies'] },
  { id: 'education', name: 'Education & Training', schedule_c_line: 27, deductible: true, examples: ['courses', 'books', 'conferences', 'certifications'] },
  { id: 'software', name: 'Software & Subscriptions', schedule_c_line: 27, deductible: true, examples: ['SaaS subscriptions', 'design software', 'project management tools'] },
  { id: 'equipment', name: 'Equipment & Tools', schedule_c_line: 13, deductible: true, examples: ['computer', 'monitor', 'camera', 'microphone'] },
  { id: 'health', name: 'Health Insurance', schedule_c_line: 0, deductible: true, examples: ['health insurance premiums', 'dental', 'vision'] },
  { id: 'retirement', name: 'Retirement Contributions', schedule_c_line: 0, deductible: true, examples: ['SEP IRA', 'Solo 401k'] },
  { id: 'personal', name: 'Personal (Non-Deductible)', schedule_c_line: 0, deductible: false, examples: ['personal purchases', 'non-business items'] },
  { id: 'other', name: 'Other Business Expenses', schedule_c_line: 27, deductible: true, examples: ['bank fees', 'miscellaneous business expenses'] },
];

// ─── Auto-categorization Rules ──────────────────────────────────────────────

const DEFAULT_RULES = [
  { pattern: /aws|azure|digital.?ocean|heroku|vercel|netlify|cloudflare/i, category: 'software' },
  { pattern: /github|gitlab|bitbucket|jira|asana|notion|slack|zoom|figma|canva/i, category: 'software' },
  { pattern: /adobe|photoshop|illustrator|premiere|after.?effects/i, category: 'software' },
  { pattern: /google.?ads|facebook.?ads|meta.?ads|linkedin.?ads|twitter.?ads/i, category: 'advertising' },
  { pattern: /mailchimp|convertkit|sendgrid|hubspot/i, category: 'advertising' },
  { pattern: /wework|regus|coworking/i, category: 'rent_lease' },
  { pattern: /uber|lyft|taxi|parking|gas.?station|shell|bp|chevron/i, category: 'car_expenses' },
  { pattern: /airline|flight|hotel|airbnb|booking\.com|expedia/i, category: 'travel' },
  { pattern: /restaurant|cafe|coffee|lunch|dinner|doordash|uber.?eats/i, category: 'meals' },
  { pattern: /amazon|staples|office.?depot|best.?buy/i, category: 'office_expense' },
  { pattern: /att|verizon|t-mobile|comcast|spectrum|internet|phone/i, category: 'utilities' },
  { pattern: /stripe|paypal|square|wise|revolut.*fee/i, category: 'commissions' },
  { pattern: /udemy|coursera|skillshare|masterclass|book|kindle/i, category: 'education' },
  { pattern: /accountant|lawyer|attorney|legal|tax.?prep/i, category: 'legal_professional' },
  { pattern: /insurance|geico|state.?farm|liability/i, category: 'insurance' },
  { pattern: /apple|dell|lenovo|macbook|ipad|monitor|keyboard|mouse/i, category: 'equipment' },
  { pattern: /upwork|fiverr|toptal|subcontract/i, category: 'contract_labor' },
];

// ─── Core Functions ─────────────────────────────────────────────────────────

function addExpense(description, amount, opts = {}) {
  const expenses = readJSON(PATHS.expenses());
  const categories = readJSON(PATHS.categories(), DEFAULT_CATEGORIES);

  const amountNum = parseFloat(amount);
  if (isNaN(amountNum) || amountNum <= 0) return { error: 'Invalid amount' };

  // Auto-categorize if no category provided
  let categoryId = opts.category || autoCategorizeTx(description);
  const category = categories.find(c => c.id === categoryId);

  const expense = {
    id: crypto.randomUUID(),
    date: opts.date || new Date().toISOString().split('T')[0],
    description,
    amount: amountNum,
    currency: opts.currency || 'USD',
    category_id: categoryId,
    category_name: category ? category.name : 'Uncategorized',
    deductible: category ? category.deductible : false,
    deduction_pct: category ? (category.deduction_pct || 100) : 0,
    deductible_amount: category
      ? amountNum * ((category.deduction_pct || 100) / 100)
      : 0,
    vendor: opts.vendor || extractVendor(description),
    project: opts.project || null,
    client: opts.client || null,
    receipt_path: opts.receipt || null,
    payment_method: opts.payment || null,
    is_recurring: opts.recurring === 'true' || opts.recurring === true,
    recurring_frequency: opts.frequency || null,
    notes: opts.notes || '',
    tags: opts.tags ? opts.tags.split(',').map(t => t.trim()) : [],
    tax_year: parseInt(opts.date ? opts.date.substring(0, 4) : new Date().getFullYear()),
    created_at: new Date().toISOString(),
    auto_categorized: !opts.category
  };

  expenses.push(expense);
  writeJSON(PATHS.expenses(), expenses);

  const icon = expense.deductible ? '✅' : '⚠️';
  return {
    success: true,
    expense_id: expense.id,
    message: `${icon} Expense logged: $${amountNum.toFixed(2)} — ${description}\n` +
             `📁 Category: ${expense.category_name}${expense.auto_categorized ? ' (auto)' : ''}\n` +
             `💰 Deductible: ${expense.deductible ? `$${expense.deductible_amount.toFixed(2)}` : 'No'}` +
             (expense.deduction_pct < 100 ? ` (${expense.deduction_pct}%)` : ''),
    expense
  };
}

function autoCategorizeTx(description) {
  const customRules = readJSON(PATHS.rules(), []);
  // Check custom rules first
  for (const rule of customRules) {
    if (new RegExp(rule.pattern, 'i').test(description)) return rule.category;
  }
  // Then default rules
  for (const rule of DEFAULT_RULES) {
    if (rule.pattern.test(description)) return rule.category;
  }
  return 'other';
}

function extractVendor(description) {
  // Try to extract a vendor name from the description
  const words = description.split(/\s+/);
  return words[0] || description;
}

function listExpenses(opts = {}) {
  const expenses = readJSON(PATHS.expenses());
  let filtered = [...expenses];

  // Filters
  if (opts.category) filtered = filtered.filter(e => e.category_id === opts.category);
  if (opts.year) filtered = filtered.filter(e => e.tax_year === parseInt(opts.year));
  if (opts.month) {
    const month = opts.month.padStart(2, '0');
    const year = opts.year || new Date().getFullYear().toString();
    filtered = filtered.filter(e => e.date.startsWith(`${year}-${month}`));
  }
  if (opts.client) filtered = filtered.filter(e => e.client && e.client.toLowerCase().includes(opts.client.toLowerCase()));
  if (opts.project) filtered = filtered.filter(e => e.project && e.project.toLowerCase().includes(opts.project.toLowerCase()));
  if (opts.deductible === 'true') filtered = filtered.filter(e => e.deductible);
  if (opts.deductible === 'false') filtered = filtered.filter(e => !e.deductible);
  if (opts.min) filtered = filtered.filter(e => e.amount >= parseFloat(opts.min));
  if (opts.max) filtered = filtered.filter(e => e.amount <= parseFloat(opts.max));
  if (opts.search) {
    const q = opts.search.toLowerCase();
    filtered = filtered.filter(e =>
      e.description.toLowerCase().includes(q) ||
      (e.vendor && e.vendor.toLowerCase().includes(q)) ||
      (e.notes && e.notes.toLowerCase().includes(q))
    );
  }

  // Sort
  filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

  // Limit
  const limit = opts.limit ? parseInt(opts.limit) : 50;
  const page = filtered.slice(0, limit);

  const totalAmount = filtered.reduce((sum, e) => sum + e.amount, 0);
  const deductibleAmount = filtered.reduce((sum, e) => sum + e.deductible_amount, 0);

  return {
    total_expenses: filtered.length,
    showing: page.length,
    total_amount: `$${totalAmount.toFixed(2)}`,
    deductible_amount: `$${deductibleAmount.toFixed(2)}`,
    potential_savings: `$${(deductibleAmount * 0.25).toFixed(2)} — $${(deductibleAmount * 0.37).toFixed(2)}`,
    expenses: page.map(e => ({
      id: e.id.substring(0, 8),
      date: e.date,
      description: e.description,
      amount: `$${e.amount.toFixed(2)}`,
      category: e.category_name,
      deductible: e.deductible ? '✅' : '❌',
      auto: e.auto_categorized ? '🤖' : '',
    }))
  };
}

function generateTaxReport(opts = {}) {
  const expenses = readJSON(PATHS.expenses());
  const categories = readJSON(PATHS.categories(), DEFAULT_CATEGORIES);
  const year = parseInt(opts.year) || new Date().getFullYear();
  const yearExpenses = expenses.filter(e => e.tax_year === year);

  if (yearExpenses.length === 0) {
    return { error: `No expenses found for tax year ${year}` };
  }

  // Group by category
  const byCategory = {};
  for (const exp of yearExpenses) {
    if (!byCategory[exp.category_id]) {
      byCategory[exp.category_id] = {
        category_id: exp.category_id,
        category_name: exp.category_name,
        total: 0,
        deductible_total: 0,
        count: 0,
        expenses: []
      };
    }
    byCategory[exp.category_id].total += exp.amount;
    byCategory[exp.category_id].deductible_total += exp.deductible_amount;
    byCategory[exp.category_id].count += 1;
    byCategory[exp.category_id].expenses.push(exp);
  }

  const categorySummary = Object.values(byCategory)
    .sort((a, b) => b.total - a.total)
    .map(c => ({
      category: c.category_name,
      total: `$${c.total.toFixed(2)}`,
      deductible: `$${c.deductible_total.toFixed(2)}`,
      count: c.count,
      pct_of_total: `${((c.total / yearExpenses.reduce((s, e) => s + e.amount, 0)) * 100).toFixed(1)}%`
    }));

  const totalExpenses = yearExpenses.reduce((sum, e) => sum + e.amount, 0);
  const totalDeductible = yearExpenses.reduce((sum, e) => sum + e.deductible_amount, 0);
  const nonDeductible = totalExpenses - totalDeductible;

  // Monthly breakdown
  const monthly = {};
  for (let m = 1; m <= 12; m++) {
    const monthStr = m.toString().padStart(2, '0');
    const monthExps = yearExpenses.filter(e => e.date.substring(5, 7) === monthStr);
    if (monthExps.length > 0) {
      monthly[monthStr] = {
        month: new Date(year, m - 1).toLocaleString('en', { month: 'long' }),
        total: `$${monthExps.reduce((s, e) => s + e.amount, 0).toFixed(2)}`,
        count: monthExps.length
      };
    }
  }

  // Schedule C approximation
  const scheduleC = {};
  for (const cat of categories) {
    if (cat.schedule_c_line > 0 && byCategory[cat.id]) {
      const line = `Line ${cat.schedule_c_line}`;
      if (!scheduleC[line]) scheduleC[line] = { line, categories: [], total: 0 };
      scheduleC[line].categories.push(cat.name);
      scheduleC[line].total += byCategory[cat.id].deductible_total;
    }
  }

  const scheduleCLines = Object.values(scheduleC)
    .filter(l => l.total > 0)
    .sort((a, b) => parseInt(a.line.replace('Line ', '')) - parseInt(b.line.replace('Line ', '')))
    .map(l => ({
      line: l.line,
      categories: l.categories.join(', '),
      amount: `$${l.total.toFixed(2)}`
    }));

  // Quarterly estimated tax helper
  const q1 = yearExpenses.filter(e => { const m = parseInt(e.date.substring(5, 7)); return m >= 1 && m <= 3; }).reduce((s, e) => s + e.deductible_amount, 0);
  const q2 = yearExpenses.filter(e => { const m = parseInt(e.date.substring(5, 7)); return m >= 4 && m <= 6; }).reduce((s, e) => s + e.deductible_amount, 0);
  const q3 = yearExpenses.filter(e => { const m = parseInt(e.date.substring(5, 7)); return m >= 7 && m <= 9; }).reduce((s, e) => s + e.deductible_amount, 0);
  const q4 = yearExpenses.filter(e => { const m = parseInt(e.date.substring(5, 7)); return m >= 10 && m <= 12; }).reduce((s, e) => s + e.deductible_amount, 0);

  return {
    tax_year: year,
    summary: {
      total_expenses: `$${totalExpenses.toFixed(2)}`,
      total_deductible: `$${totalDeductible.toFixed(2)}`,
      non_deductible: `$${nonDeductible.toFixed(2)}`,
      expense_count: yearExpenses.length,
      potential_tax_savings_25pct: `$${(totalDeductible * 0.25).toFixed(2)}`,
      potential_tax_savings_37pct: `$${(totalDeductible * 0.37).toFixed(2)}`,
    },
    by_category: categorySummary,
    monthly_breakdown: monthly,
    schedule_c_approximation: scheduleCLines,
    quarterly_deductions: {
      Q1: `$${q1.toFixed(2)}`,
      Q2: `$${q2.toFixed(2)}`,
      Q3: `$${q3.toFixed(2)}`,
      Q4: `$${q4.toFixed(2)}`
    },
    uncategorized: yearExpenses.filter(e => e.category_id === 'other' || !e.category_id).length,
    auto_categorized: yearExpenses.filter(e => e.auto_categorized).length,
  };
}

function addMileage(date, miles, purpose, opts = {}) {
  const mileageLog = readJSON(PATHS.mileage());
  const settings = readJSON(PATHS.settings(), {});
  const ratePerMile = settings.mileage_rate || 0.67; // 2024 IRS standard rate

  const milesNum = parseFloat(miles);
  if (isNaN(milesNum) || milesNum <= 0) return { error: 'Invalid mileage' };

  const entry = {
    id: crypto.randomUUID(),
    date: date || new Date().toISOString().split('T')[0],
    miles: milesNum,
    purpose,
    from: opts.from || null,
    to: opts.to || null,
    round_trip: opts.round_trip === 'true',
    rate_per_mile: ratePerMile,
    deduction: milesNum * ratePerMile,
    client: opts.client || null,
    project: opts.project || null,
    notes: opts.notes || '',
    created_at: new Date().toISOString()
  };

  if (entry.round_trip) {
    entry.miles *= 2;
    entry.deduction *= 2;
  }

  mileageLog.push(entry);
  writeJSON(PATHS.mileage(), mileageLog);

  // Also log as expense
  addExpense(`Mileage: ${purpose}`, entry.deduction, {
    category: 'car_expenses',
    date: entry.date,
    client: opts.client,
    project: opts.project,
    notes: `${entry.miles} miles @ $${ratePerMile}/mi`,
  });

  return {
    success: true,
    mileage_id: entry.id,
    message: `🚗 Mileage logged: ${entry.miles} mi — $${entry.deduction.toFixed(2)} deduction\n` +
             `📍 Purpose: ${purpose}`,
    entry
  };
}

function getMileageSummary(opts = {}) {
  const mileageLog = readJSON(PATHS.mileage());
  const year = parseInt(opts.year) || new Date().getFullYear();
  const yearMileage = mileageLog.filter(m => m.date.startsWith(year.toString()));

  const totalMiles = yearMileage.reduce((sum, m) => sum + m.miles, 0);
  const totalDeduction = yearMileage.reduce((sum, m) => sum + m.deduction, 0);

  return {
    year,
    total_miles: totalMiles.toFixed(1),
    total_deduction: `$${totalDeduction.toFixed(2)}`,
    trip_count: yearMileage.length,
    avg_trip_miles: yearMileage.length > 0 ? (totalMiles / yearMileage.length).toFixed(1) : 0,
    recent: yearMileage.slice(-10).reverse().map(m => ({
      date: m.date,
      miles: m.miles,
      purpose: m.purpose,
      deduction: `$${m.deduction.toFixed(2)}`
    }))
  };
}

function recategorize(expenseId, newCategory) {
  const expenses = readJSON(PATHS.expenses());
  const categories = readJSON(PATHS.categories(), DEFAULT_CATEGORIES);
  const exp = expenses.find(e => e.id === expenseId || e.id.startsWith(expenseId));

  if (!exp) return { error: 'Expense not found' };

  const category = categories.find(c => c.id === newCategory);
  if (!category) return { error: `Category "${newCategory}" not found`, available: categories.map(c => c.id) };

  const oldCategory = exp.category_name;
  exp.category_id = category.id;
  exp.category_name = category.name;
  exp.deductible = category.deductible;
  exp.deduction_pct = category.deduction_pct || 100;
  exp.deductible_amount = exp.amount * (exp.deduction_pct / 100);
  exp.auto_categorized = false;

  writeJSON(PATHS.expenses(), expenses);

  return {
    success: true,
    expense_id: exp.id,
    description: exp.description,
    old_category: oldCategory,
    new_category: category.name,
    deductible: exp.deductible,
    message: `🔄 Recategorized: "${exp.description}"\n  ${oldCategory} → ${category.name}`
  };
}

function getSpendingInsights(opts = {}) {
  const expenses = readJSON(PATHS.expenses());
  const year = parseInt(opts.year) || new Date().getFullYear();
  const yearExpenses = expenses.filter(e => e.tax_year === year);

  if (yearExpenses.length === 0) {
    return { message: 'No expenses to analyze.' };
  }

  const totalSpend = yearExpenses.reduce((sum, e) => sum + e.amount, 0);
  const monthlyAvg = totalSpend / 12;

  // Find biggest expense
  const biggest = yearExpenses.reduce((max, e) => e.amount > max.amount ? e : max, yearExpenses[0]);

  // Find most frequent vendor
  const vendorCounts = {};
  for (const e of yearExpenses) {
    const v = e.vendor || 'Unknown';
    vendorCounts[v] = (vendorCounts[v] || 0) + 1;
  }
  const topVendor = Object.entries(vendorCounts).sort((a, b) => b[1] - a[1])[0];

  // Find recurring expenses
  const recurring = yearExpenses.filter(e => e.is_recurring);
  const recurringMonthly = recurring.reduce((sum, e) => sum + e.amount, 0) / 12;

  // Missing deductions check
  const uncategorized = yearExpenses.filter(e => e.category_id === 'other' || e.auto_categorized);
  const nonDeductible = yearExpenses.filter(e => !e.deductible);

  // Month-over-month trend
  const monthTotals = [];
  for (let m = 1; m <= 12; m++) {
    const monthStr = m.toString().padStart(2, '0');
    const total = yearExpenses.filter(e => e.date.substring(5, 7) === monthStr).reduce((s, e) => s + e.amount, 0);
    if (total > 0) monthTotals.push({ month: m, total });
  }

  let trend = 'stable';
  if (monthTotals.length >= 3) {
    const last3 = monthTotals.slice(-3);
    if (last3[2].total > last3[0].total * 1.2) trend = 'increasing ↗️';
    else if (last3[2].total < last3[0].total * 0.8) trend = 'decreasing ↘️';
  }

  const insights = [];
  if (uncategorized.length > 5) {
    insights.push(`⚠️ ${uncategorized.length} expenses need review — potential missed deductions`);
  }
  if (nonDeductible.length > 0) {
    const nonDedTotal = nonDeductible.reduce((s, e) => s + e.amount, 0);
    insights.push(`💡 $${nonDedTotal.toFixed(2)} in non-deductible expenses — review if any are business-related`);
  }
  if (recurringMonthly > monthlyAvg * 0.5) {
    insights.push(`📊 Recurring costs are ${((recurringMonthly / monthlyAvg) * 100).toFixed(0)}% of monthly spend — review subscriptions`);
  }

  // Check for common missed deductions
  const catIds = new Set(yearExpenses.map(e => e.category_id));
  const commonMissed = ['home_office', 'education', 'health', 'retirement'];
  const missing = commonMissed.filter(c => !catIds.has(c));
  if (missing.length > 0) {
    insights.push(`💡 Common deductions not tracked: ${missing.join(', ')} — are you claiming these?`);
  }

  return {
    year,
    total_spend: `$${totalSpend.toFixed(2)}`,
    monthly_average: `$${monthlyAvg.toFixed(2)}`,
    expense_count: yearExpenses.length,
    spending_trend: trend,
    biggest_expense: {
      description: biggest.description,
      amount: `$${biggest.amount.toFixed(2)}`,
      date: biggest.date,
      category: biggest.category_name
    },
    top_vendor: topVendor ? { name: topVendor[0], transactions: topVendor[1] } : null,
    recurring_monthly: `$${recurringMonthly.toFixed(2)}`,
    needs_review: uncategorized.length,
    insights,
    deduction_summary: {
      total_deductible: `$${yearExpenses.reduce((s, e) => s + e.deductible_amount, 0).toFixed(2)}`,
      tax_savings_estimate: `$${(yearExpenses.reduce((s, e) => s + e.deductible_amount, 0) * 0.30).toFixed(2)} (at 30% rate)`
    }
  };
}

function deleteExpense(expenseId) {
  const expenses = readJSON(PATHS.expenses());
  const idx = expenses.findIndex(e => e.id === expenseId || e.id.startsWith(expenseId));
  if (idx === -1) return { error: 'Expense not found' };

  const removed = expenses.splice(idx, 1)[0];
  writeJSON(PATHS.expenses(), expenses);

  return {
    success: true,
    message: `🗑️ Deleted: $${removed.amount.toFixed(2)} — ${removed.description}`,
    deleted: { id: removed.id, description: removed.description, amount: removed.amount }
  };
}

function listCategories() {
  const categories = readJSON(PATHS.categories(), DEFAULT_CATEGORIES);
  return {
    categories: categories.map(c => ({
      id: c.id,
      name: c.name,
      deductible: c.deductible ? '✅' : '❌',
      deduction_pct: c.deduction_pct || 100,
      schedule_c: c.schedule_c_line > 0 ? `Line ${c.schedule_c_line}` : '—',
      examples: c.examples.slice(0, 3).join(', ')
    }))
  };
}

function configureSettings(opts = {}) {
  const settings = readJSON(PATHS.settings(), {});
  if (opts.mileage_rate) settings.mileage_rate = parseFloat(opts.mileage_rate);
  if (opts.currency) settings.default_currency = opts.currency;
  if (opts.tax_rate) settings.estimated_tax_rate = parseFloat(opts.tax_rate);
  if (opts.fiscal_year) settings.fiscal_year_start = opts.fiscal_year;
  if (opts.country) settings.tax_country = opts.country;
  settings.updated_at = new Date().toISOString();
  writeJSON(PATHS.settings(), settings);
  return { success: true, settings };
}

function exportCSV(opts = {}) {
  const expenses = readJSON(PATHS.expenses());
  const year = parseInt(opts.year) || new Date().getFullYear();
  const yearExpenses = expenses.filter(e => e.tax_year === year);

  if (yearExpenses.length === 0) return { error: `No expenses for ${year}` };

  const headers = ['Date', 'Description', 'Amount', 'Category', 'Deductible', 'Deductible Amount', 'Vendor', 'Client', 'Project', 'Payment Method', 'Notes'];
  const rows = yearExpenses.map(e => [
    e.date, `"${e.description}"`, e.amount.toFixed(2), `"${e.category_name}"`,
    e.deductible ? 'Yes' : 'No', e.deductible_amount.toFixed(2),
    `"${e.vendor || ''}"`, `"${e.client || ''}"`, `"${e.project || ''}"`,
    `"${e.payment_method || ''}"`, `"${(e.notes || '').replace(/"/g, '""')}"`
  ]);

  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const outPath = opts.output || path.join(DATA_DIR, `expenses_${year}.csv`);
  ensureDir(path.dirname(outPath));
  fs.writeFileSync(outPath, csv);

  return {
    success: true,
    file: outPath,
    rows: yearExpenses.length,
    message: `📄 Exported ${yearExpenses.length} expenses to ${outPath}`
  };
}

// ─── CLI ────────────────────────────────────────────────────────────────────

function printHelp() {
  console.log(`
💰 Expense Tracking & Tax Categorization
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

COMMANDS:
  add <description> <amount>   Log a new expense
    --category <id>            Category (auto-detected if omitted)
    --date <YYYY-MM-DD>        Date (default: today)
    --vendor <name>            Vendor name
    --client <name>            Associated client
    --project <name>           Associated project
    --payment <method>         Payment method
    --receipt <path>           Receipt file path
    --recurring <true>         Mark as recurring
    --frequency <freq>         Recurring frequency (monthly/weekly/yearly)
    --tags <tag1,tag2>         Comma-separated tags
    --notes <text>             Notes

  list                         List expenses
    --category <id>            Filter by category
    --year <YYYY>              Filter by year
    --month <MM>               Filter by month
    --client <name>            Filter by client
    --deductible <true|false>  Filter by deductibility
    --search <query>           Search descriptions
    --limit <n>                Max results (default: 50)

  tax-report                   Generate tax report
    --year <YYYY>              Tax year (default: current)

  mileage <date> <miles> <purpose>   Log business mileage
    --from <location>          Start location
    --to <location>            End location
    --round-trip <true>        Round trip (doubles miles)
    --client <name>            Client
    --project <name>           Project

  mileage-summary              View mileage summary
    --year <YYYY>              Year

  recategorize <id> <cat>      Change expense category
  delete <id>                  Delete an expense
  categories                   List all tax categories
  insights                     Get spending insights
    --year <YYYY>              Year
  export                       Export to CSV
    --year <YYYY>              Year
    --output <path>            Output file path

  settings                     Configure settings
    --mileage-rate <rate>      IRS mileage rate
    --currency <code>          Default currency
    --tax-rate <rate>          Estimated tax rate
    --country <code>           Tax country

  help                         Show this help

EXAMPLES:
  node expense-tracker.js add "Figma Pro subscription" 15 --recurring true --frequency monthly
  node expense-tracker.js add "Client lunch at Olive Garden" 45.80 --client "Acme" --category meals
  node expense-tracker.js mileage 2024-01-15 32 "Client meeting" --round-trip true
  node expense-tracker.js tax-report --year 2024
  node expense-tracker.js insights
`);
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args[0] === 'help' || args[0] === '--help') {
    printHelp();
    return;
  }

  const command = args[0];
  const getFlag = (flag) => {
    const idx = args.indexOf(flag);
    return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : null;
  };

  let result;

  switch (command) {
    case 'add':
      result = addExpense(args[1], args[2], {
        category: getFlag('--category'),
        date: getFlag('--date'),
        vendor: getFlag('--vendor'),
        client: getFlag('--client'),
        project: getFlag('--project'),
        payment: getFlag('--payment'),
        receipt: getFlag('--receipt'),
        recurring: getFlag('--recurring'),
        frequency: getFlag('--frequency'),
        tags: getFlag('--tags'),
        notes: getFlag('--notes'),
        currency: getFlag('--currency'),
      });
      break;

    case 'list':
      result = listExpenses({
        category: getFlag('--category'),
        year: getFlag('--year'),
        month: getFlag('--month'),
        client: getFlag('--client'),
        project: getFlag('--project'),
        deductible: getFlag('--deductible'),
        search: getFlag('--search'),
        limit: getFlag('--limit'),
        min: getFlag('--min'),
        max: getFlag('--max'),
      });
      break;

    case 'tax-report':
      result = generateTaxReport({ year: getFlag('--year') });
      break;

    case 'mileage':
      result = addMileage(args[1], args[2], args[3], {
        from: getFlag('--from'),
        to: getFlag('--to'),
        round_trip: getFlag('--round-trip'),
        client: getFlag('--client'),
        project: getFlag('--project'),
        notes: getFlag('--notes'),
      });
      break;

    case 'mileage-summary':
      result = getMileageSummary({ year: getFlag('--year') });
      break;

    case 'recategorize':
      result = recategorize(args[1], args[2]);
      break;

    case 'delete':
      result = deleteExpense(args[1]);
      break;

    case 'categories':
      result = listCategories();
      break;

    case 'insights':
      result = getSpendingInsights({ year: getFlag('--year') });
      break;

    case 'export':
      result = exportCSV({
        year: getFlag('--year'),
        output: getFlag('--output'),
      });
      break;

    case 'settings':
      result = configureSettings({
        mileage_rate: getFlag('--mileage-rate'),
        currency: getFlag('--currency'),
        tax_rate: getFlag('--tax-rate'),
        country: getFlag('--country'),
      });
      break;

    default:
      console.error(`Unknown command: ${command}`);
      printHelp();
      process.exit(1);
  }

  console.log(JSON.stringify(result, null, 2));
}

main();
