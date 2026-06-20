import mongoose from 'mongoose';
import { Transaction } from '../models/Transaction.model.js';
import { Account } from '../models/Account.model.js';
import { FraudAlert } from '../models/FraudAlert.model.js';
import { Transfer } from '../models/Transfer.model.js';

// ─────────────────────────────────────────────────────────────
// HELPER: convert userId string to ObjectId safely
// Reused across all pipelines
// ─────────────────────────────────────────────────────────────
const toObjectId = (id) => new mongoose.Types.ObjectId(id);

// ─────────────────────────────────────────────────────────────
// 1. DASHBOARD SUMMARY
// One API call powers the entire dashboard header:
// total balance, income, expenses, net savings, account count
// ─────────────────────────────────────────────────────────────
export const getDashboardSummary = async (userId) => {
  const currentMonthStart = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1
  );

  // Run all aggregations concurrently — none depend on each other
  const [accountSummary, monthlySummary, recentTransactions, fraudCount] =
    await Promise.all([

      // Total balance and account count from accounts collection
      Account.aggregate([
        { $match: { userId: toObjectId(userId), isActive: true } },
        {
          $group: {
            _id: null,
            totalBalance: { $sum: '$balance' },
            totalAccounts: { $sum: 1 },
          },
        },
      ]),

      // This month's income and expenses from transactions collection
      Transaction.aggregate([
        {
          $match: {
            userId: toObjectId(userId),
            status: 'success',
            createdAt: { $gte: currentMonthStart },
            // Exclude internal transfers from income/expense calc
            // WHY? A transfer isn't income or expense — it's just moving money
            category: { $ne: 'transfer' },
          },
        },
        {
          $group: {
            _id: '$type',        // group by 'credit' or 'debit'
            total: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
      ]),

      // 5 most recent transactions across all accounts
      Transaction.find({ userId, status: 'success' })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('accountId', 'bankName accountNumberLast4'),

      // Count of open fraud alerts
      FraudAlert.countDocuments({ userId, alertStatus: 'open' }),
    ]);

  // Shape account data
  const accounts = accountSummary[0] || { totalBalance: 0, totalAccounts: 0 };

  // Shape monthly income/expense data
  // monthlySummary is an array like: [{ _id: 'credit', total: X }, { _id: 'debit', total: Y }]
  const monthly = monthlySummary.reduce(
    (acc, item) => {
      acc[item._id === 'credit' ? 'monthlyIncome' : 'monthlyExpenses'] = item.total;
      return acc;
    },
    { monthlyIncome: 0, monthlyExpenses: 0 }
  );

  return {
    totalBalance: accounts.totalBalance,
    totalAccounts: accounts.totalAccounts,
    monthlyIncome: monthly.monthlyIncome,
    monthlyExpenses: monthly.monthlyExpenses,
    netSavings: monthly.monthlyIncome - monthly.monthlyExpenses,
    savingsRate: monthly.monthlyIncome > 0
      ? Math.round(
          ((monthly.monthlyIncome - monthly.monthlyExpenses) / monthly.monthlyIncome) * 100
        )
      : 0,
    openFraudAlerts: fraudCount,
    recentTransactions,
  };
};

// ─────────────────────────────────────────────────────────────
// 2. MONTHLY INCOME VS EXPENSES
// Powers the bar/line chart showing 12-month trend
// ─────────────────────────────────────────────────────────────
export const getMonthlyAnalytics = async (userId, year) => {
  const targetYear = parseInt(year) || new Date().getFullYear();

  const pipeline = [
    {
      // Stage 1: Filter to this user, this year, successful, non-transfer
      $match: {
        userId: toObjectId(userId),
        status: 'success',
        category: { $ne: 'transfer' },
        createdAt: {
          $gte: new Date(`${targetYear}-01-01`),
          $lte: new Date(`${targetYear}-12-31T23:59:59`),
        },
      },
    },
    {
      // Stage 2: Group by month AND type
      // $month extracts the month number (1-12) from a date field
      $group: {
        _id: {
          month: { $month: '$createdAt' },
          type: '$type',
        },
        total: { $sum: '$amount' },
        count: { $sum: 1 },
      },
    },
    {
      // Stage 3: Sort by month ascending
      $sort: { '_id.month': 1 },
    },
    {
      // Stage 4: Group again by month to combine credit and debit
      // This collapses { month: 3, type: credit } and { month: 3, type: debit }
      // into a single month-3 object with both values
      $group: {
        _id: '$_id.month',
        data: {
          $push: {
            type: '$_id.type',
            total: '$total',
            count: '$count',
          },
        },
      },
    },
    { $sort: { _id: 1 } },
  ];

  const rawData = await Transaction.aggregate(pipeline);

  // Transform into chart-friendly format
  // Fill in all 12 months even if no data — charts need complete series
  const MONTH_NAMES = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];

  const monthMap = {};
  rawData.forEach((item) => {
    const monthIndex = item._id - 1; // 1-indexed to 0-indexed
    monthMap[monthIndex] = {
      income: 0,
      expenses: 0,
      incomeCount: 0,
      expenseCount: 0,
    };
    item.data.forEach((d) => {
      if (d.type === 'credit') {
        monthMap[monthIndex].income = d.total;
        monthMap[monthIndex].incomeCount = d.count;
      } else {
        monthMap[monthIndex].expenses = d.total;
        monthMap[monthIndex].expenseCount = d.count;
      }
    });
  });

  // Build complete 12-month array
  const chartData = MONTH_NAMES.map((month, index) => ({
    month,
    income: monthMap[index]?.income || 0,
    expenses: monthMap[index]?.expenses || 0,
    net: (monthMap[index]?.income || 0) - (monthMap[index]?.expenses || 0),
    incomeCount: monthMap[index]?.incomeCount || 0,
    expenseCount: monthMap[index]?.expenseCount || 0,
  }));

  // Annual totals for summary cards
  const annualIncome = chartData.reduce((s, m) => s + m.income, 0);
  const annualExpenses = chartData.reduce((s, m) => s + m.expenses, 0);

  return {
    year: targetYear,
    chartData,
    annualSummary: {
      totalIncome: annualIncome,
      totalExpenses: annualExpenses,
      netSavings: annualIncome - annualExpenses,
      savingsRate: annualIncome > 0
        ? Math.round(((annualIncome - annualExpenses) / annualIncome) * 100)
        : 0,
    },
  };
};

// ─────────────────────────────────────────────────────────────
// 3. CATEGORY-WISE EXPENSE BREAKDOWN
// Powers the pie/donut chart
// ─────────────────────────────────────────────────────────────
export const getCategoryAnalytics = async (userId, period = '30') => {
  const days = parseInt(period);
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const pipeline = [
    {
      $match: {
        userId: toObjectId(userId),
        type: 'debit',
        status: 'success',
        category: { $ne: 'transfer' },
        createdAt: { $gte: startDate },
      },
    },
    {
      $group: {
        _id: '$category',
        totalAmount: { $sum: '$amount' },
        transactionCount: { $sum: 1 },
        avgAmount: { $avg: '$amount' },
      },
    },
    { $sort: { totalAmount: -1 } }, // highest spending first
  ];

  const rawData = await Transaction.aggregate(pipeline);
  const grandTotal = rawData.reduce((sum, item) => sum + item.totalAmount, 0);

  // Add percentage to each category
  const categories = rawData.map((item) => ({
    category: item._id,
    totalAmount: Math.round(item.totalAmount),
    transactionCount: item.transactionCount,
    avgAmount: Math.round(item.avgAmount),
    percentage: grandTotal > 0
      ? Math.round((item.totalAmount / grandTotal) * 100)
      : 0,
  }));

  return {
    period: `Last ${days} days`,
    grandTotal: Math.round(grandTotal),
    categories,
    // Top spending category — useful for insight cards
    topCategory: categories[0] || null,
  };
};

// ─────────────────────────────────────────────────────────────
// 4. SPENDING TREND — Daily for last N days
// Powers the area/line chart on dashboard
// ─────────────────────────────────────────────────────────────
export const getSpendingTrend = async (userId, days = 30) => {
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const pipeline = [
    {
      $match: {
        userId: toObjectId(userId),
        type: 'debit',
        status: 'success',
        category: { $ne: 'transfer' },
        createdAt: { $gte: startDate },
      },
    },
    {
      $group: {
        _id: {
          // $dateToString formats date as YYYY-MM-DD for grouping by day
          date: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$createdAt',
            },
          },
        },
        dailyTotal: { $sum: '$amount' },
        transactionCount: { $sum: 1 },
      },
    },
    { $sort: { '_id.date': 1 } },
  ];

  const rawData = await Transaction.aggregate(pipeline);

  // Build complete date series — fill gaps with 0
  // WHY fill gaps? Recharts/Chart.js needs continuous data or lines break
  const dateMap = {};
  rawData.forEach((item) => {
    dateMap[item._id.date] = {
      amount: Math.round(item.dailyTotal),
      count: item.transactionCount,
    };
  });

  const trend = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const dateStr = date.toISOString().split('T')[0];
    trend.push({
      date: dateStr,
      // Short label for chart X-axis: "Jan 15"
      label: date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
      amount: dateMap[dateStr]?.amount || 0,
      count: dateMap[dateStr]?.count || 0,
    });
  }

  // Calculate moving average for trend line
  // WHY? Raw daily data is spiky. A 7-day moving average shows the real trend.
  const WINDOW = 7;
  const trendWithMA = trend.map((day, index) => {
    const windowSlice = trend.slice(
      Math.max(0, index - WINDOW + 1),
      index + 1
    );
    const movingAvg = windowSlice.reduce((s, d) => s + d.amount, 0) / windowSlice.length;
    return { ...day, movingAverage: Math.round(movingAvg) };
  });

  return {
    days,
    trend: trendWithMA,
    summary: {
      totalSpending: trend.reduce((s, d) => s + d.amount, 0),
      avgDailySpending: Math.round(
        trend.reduce((s, d) => s + d.amount, 0) / days
      ),
      peakDay: trend.reduce(
        (max, d) => (d.amount > max.amount ? d : max),
        { amount: 0 }
      ),
    },
  };
};

// ─────────────────────────────────────────────────────────────
// 5. ACCOUNT-WISE BALANCE SUMMARY
// Powers balance distribution bar chart
// ─────────────────────────────────────────────────────────────
export const getAccountBalanceSummary = async (userId) => {
  const accounts = await Account.find(
    { userId, isActive: true },
    'bankName accountType accountNumberLast4 balance'
  ).sort({ balance: -1 });

  const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);

  return {
    accounts: accounts.map((acc) => ({
      _id: acc._id,
      label: `${acc.bankName} ••••${acc.accountNumberLast4}`,
      accountType: acc.accountType,
      balance: acc.balance,
      percentage: totalBalance > 0
        ? Math.round((acc.balance / totalBalance) * 100)
        : 0,
    })),
    totalBalance,
  };
};

// ─────────────────────────────────────────────────────────────
// 6. FRAUD ALERTS SUMMARY
// Powers the security/alerts section of dashboard
// ─────────────────────────────────────────────────────────────
export const getFraudAlertsSummary = async (userId) => {
  const [alerts, statusBreakdown] = await Promise.all([
    FraudAlert.find({ userId })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('transactionId', 'amount type category createdAt'),

    FraudAlert.aggregate([
      { $match: { userId: toObjectId(userId) } },
      {
        $group: {
          _id: '$alertStatus',
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  const statusMap = statusBreakdown.reduce((acc, item) => {
    acc[item._id] = item.count;
    return acc;
  }, {});

  return {
    alerts,
    summary: {
      open: statusMap.open || 0,
      reviewed: statusMap.reviewed || 0,
      dismissed: statusMap.dismissed || 0,
      escalated: statusMap.escalated || 0,
      total: alerts.length,
    },
  };
};