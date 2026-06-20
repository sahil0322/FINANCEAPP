import mongoose from 'mongoose';
import { User } from '../models/User.model.js';
import { Account } from '../models/Account.model.js';
import { Transaction } from '../models/Transaction.model.js';
import { FraudAlert } from '../models/FraudAlert.model.js';
import { ApiError } from '../utils/ApiError.js';

const toObjectId = (id) => new mongoose.Types.ObjectId(id);

// ─────────────────────────────────────────────────────────────
// PLATFORM-WIDE STATISTICS
// Key difference from user analytics: NO userId filter in $match
// This is the architectural distinction to call out in interviews —
// admin queries operate on the entire collection, not a user-scoped subset
// ─────────────────────────────────────────────────────────────
export const getPlatformStats = async () => {
  const [
    userStats,
    accountStats,
    transactionStats,
    fraudStats,
    todayActivity,
  ] = await Promise.all([

    // Total users, active vs disabled
    User.aggregate([
      {
        $group: {
          _id: null,
          totalUsers: { $sum: 1 },
          activeUsers: {
            $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] },
          },
          disabledUsers: {
            $sum: { $cond: [{ $eq: ['$isActive', false] }, 1, 0] },
          },
        },
      },
    ]),

    // Total accounts and platform-wide balance held
    Account.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: null,
          totalAccounts: { $sum: 1 },
          totalPlatformBalance: { $sum: '$balance' },
        },
      },
    ]),

    // Total transaction volume (all-time)
    Transaction.aggregate([
      { $match: { status: 'success' } },
      {
        $group: {
          _id: null,
          totalTransactions: { $sum: 1 },
          totalVolume: { $sum: '$amount' },
        },
      },
    ]),

    // Fraud alert breakdown
    FraudAlert.aggregate([
      {
        $group: {
          _id: '$alertStatus',
          count: { $sum: 1 },
        },
      },
    ]),

    // Today's activity — new users + transactions today
    // WHY useful? Shows admins real-time platform health at a glance
    (async () => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const [newUsersToday, transactionsToday] = await Promise.all([
        User.countDocuments({ createdAt: { $gte: todayStart } }),
        Transaction.countDocuments({ createdAt: { $gte: todayStart } }),
      ]);

      return { newUsersToday, transactionsToday };
    })(),
  ]);

  const fraudBreakdown = fraudStats.reduce((acc, item) => {
    acc[item._id] = item.count;
    return acc;
  }, {});

  return {
    users: userStats[0] || { totalUsers: 0, activeUsers: 0, disabledUsers: 0 },
    accounts: accountStats[0] || { totalAccounts: 0, totalPlatformBalance: 0 },
    transactions: transactionStats[0] || { totalTransactions: 0, totalVolume: 0 },
    fraudAlerts: {
      open: fraudBreakdown.open || 0,
      reviewed: fraudBreakdown.reviewed || 0,
      dismissed: fraudBreakdown.dismissed || 0,
      escalated: fraudBreakdown.escalated || 0,
    },
    today: todayActivity,
  };
};

// ─────────────────────────────────────────────────────────────
// GET ALL USERS — paginated, searchable
// ─────────────────────────────────────────────────────────────
export const getAllUsers = async (queryParams) => {
  const { search, role, isActive, page = 1, limit = 20 } = queryParams;

  const filter = {};

  // Text search across name and email
  // WHY $or with regex instead of a single field?
  // Admins might search by partial name OR partial email — they don't know which
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } }, // 'i' = case insensitive
      { email: { $regex: search, $options: 'i' } },
    ];
  }

  if (role) filter.role = role;
  if (isActive !== undefined) filter.isActive = isActive === 'true';

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [users, totalCount] = await Promise.all([
    User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    User.countDocuments(filter),
  ]);

  // Enrich each user with their account count and total balance
  // WHY a separate aggregation instead of populate?
  // We need SUMMED data across multiple accounts, not the account documents themselves
  const userIds = users.map((u) => u._id);
  const accountSummaries = await Account.aggregate([
    { $match: { userId: { $in: userIds }, isActive: true } },
    {
      $group: {
        _id: '$userId',
        accountCount: { $sum: 1 },
        totalBalance: { $sum: '$balance' },
      },
    },
  ]);

  // Build a lookup map for O(1) access instead of nested loops
  const summaryMap = accountSummaries.reduce((acc, item) => {
    acc[item._id.toString()] = item;
    return acc;
  }, {});

  const enrichedUsers = users.map((user) => ({
    ...user.toObject(),
    accountCount: summaryMap[user._id.toString()]?.accountCount || 0,
    totalBalance: summaryMap[user._id.toString()]?.totalBalance || 0,
  }));

  return {
    users: enrichedUsers,
    pagination: {
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalCount / parseInt(limit)),
      totalUsers: totalCount,
    },
  };
};

// ─────────────────────────────────────────────────────────────
// GET USER DETAIL (admin view)
// ─────────────────────────────────────────────────────────────
export const getUserDetail = async (userId) => {
  const user = await User.findById(userId).select('-password');
  if (!user) {
    throw new ApiError(404, 'User not found.');
  }

  const [accounts, recentTransactions, fraudAlerts] = await Promise.all([
    Account.find({ userId, isActive: true }),
    Transaction.find({ userId }).sort({ createdAt: -1 }).limit(10),
    FraudAlert.find({ userId }).sort({ createdAt: -1 }),
  ]);

  return { user, accounts, recentTransactions, fraudAlerts };
};

// ─────────────────────────────────────────────────────────────
// DISABLE / ENABLE USER ACCOUNT
// ─────────────────────────────────────────────────────────────
export const setUserStatus = async (userId, isActive, adminId) => {
  // Prevent an admin from disabling themselves
  // WHY? Could lock the admin out with no one to re-enable them
  if (userId === adminId.toString()) {
    throw new ApiError(400, 'You cannot disable your own admin account.');
  }

  const user = await User.findByIdAndUpdate(
    userId,
    { isActive },
    { new: true }
  ).select('-password');

  if (!user) {
    throw new ApiError(404, 'User not found.');
  }

  return user;
};

// ─────────────────────────────────────────────────────────────
// GET ALL TRANSACTIONS (platform-wide, admin view)
// ─────────────────────────────────────────────────────────────
export const getAllTransactionsAdmin = async (queryParams) => {
  const { isFlagged, status, page = 1, limit = 20 } = queryParams;

  const filter = {};
  if (isFlagged !== undefined) filter.isFlagged = isFlagged === 'true';
  if (status) filter.status = status;

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [transactions, totalCount] = await Promise.all([
    Transaction.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('userId', 'name email')
      .populate('accountId', 'bankName accountNumberLast4'),
    Transaction.countDocuments(filter),
  ]);

  return {
    transactions,
    pagination: {
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalCount / parseInt(limit)),
      totalTransactions: totalCount,
    },
  };
};

// ─────────────────────────────────────────────────────────────
// GET ALL FRAUD ALERTS (admin) + REVIEW ACTION
// ─────────────────────────────────────────────────────────────
export const getAllFraudAlerts = async (queryParams) => {
  const { alertStatus, page = 1, limit = 20 } = queryParams;

  const filter = {};
  if (alertStatus) filter.alertStatus = alertStatus;

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [alerts, totalCount] = await Promise.all([
    FraudAlert.find(filter)
      .sort({ riskScore: -1, createdAt: -1 }) // highest risk first
      .skip(skip)
      .limit(parseInt(limit))
      .populate('userId', 'name email')
      .populate('transactionId', 'amount type category accountId createdAt'),
    FraudAlert.countDocuments(filter),
  ]);

  return {
    alerts,
    pagination: {
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalCount / parseInt(limit)),
      totalAlerts: totalCount,
    },
  };
};

export const reviewFraudAlert = async (alertId, adminId, { alertStatus }) => {
  const validStatuses = ['reviewed', 'dismissed', 'escalated'];
  if (!validStatuses.includes(alertStatus)) {
    throw new ApiError(400, 'Invalid alert status.');
  }

  const alert = await FraudAlert.findByIdAndUpdate(
    alertId,
    {
      alertStatus,
      reviewedBy: adminId,
      reviewedAt: new Date(),
    },
    { new: true }
  ).populate('userId', 'name email');

  if (!alert) {
    throw new ApiError(404, 'Fraud alert not found.');
  }

  return alert;
};