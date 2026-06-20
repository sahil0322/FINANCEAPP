import mongoose from 'mongoose';
import { Transaction } from '../models/Transaction.model.js';
import { FraudAlert } from '../models/FraudAlert.model.js';

// ─────────────────────────────────────────────────────────────
// RULE-BASED FRAUD DETECTION ENGINE
//
// Interview explanation:
// "I implemented a rule-based scoring system where each suspicious
//  signal contributes a weighted score. If the cumulative score
//  exceeds a threshold, the transaction is flagged and a FraudAlert
//  document is created. The weights are tunable — in a production
//  system you'd replace or supplement this with an ML model."
// ─────────────────────────────────────────────────────────────

const FRAUD_RULES = {
  HIGH_AMOUNT_THRESHOLD: 100000,      // ₹1,00,000
  VELOCITY_WINDOW_MINUTES: 10,        // time window for frequency check
  VELOCITY_MAX_TRANSACTIONS: 5,       // max transactions in that window
  UNUSUAL_AMOUNT_MULTIPLIER: 5,       // 5x the user's average = suspicious
  RISK_SCORE_THRESHOLD: 60,           // flag if score >= 60
};

// Each rule returns { triggered: boolean, score: number, reason: string }
const rules = {
  // Rule 1: Absolute high amount
  highAmount: async (transaction) => {
    const triggered = transaction.amount >= FRAUD_RULES.HIGH_AMOUNT_THRESHOLD;
    return {
      triggered,
      score: triggered ? 40 : 0,
      reason: `Transaction amount ₹${transaction.amount} exceeds threshold of ₹${FRAUD_RULES.HIGH_AMOUNT_THRESHOLD}`,
    };
  },

  // Rule 2: Velocity check — too many transactions in a short window
  // WHY? Card skimming and account takeovers involve rapid-fire transactions
  highFrequency: async (transaction) => {
    const windowStart = new Date(
      Date.now() - FRAUD_RULES.VELOCITY_WINDOW_MINUTES * 60 * 1000
    );

    const recentCount = await Transaction.countDocuments({
      accountId: transaction.accountId,
      createdAt: { $gte: windowStart },
      status: 'success',
    });

    const triggered = recentCount >= FRAUD_RULES.VELOCITY_MAX_TRANSACTIONS;
    return {
      triggered,
      score: triggered ? 35 : 0,
      reason: `${recentCount} transactions in the last ${FRAUD_RULES.VELOCITY_WINDOW_MINUTES} minutes`,
    };
  },

  // Rule 3: Statistical anomaly — amount is unusually high vs. user's history
  // WHY? A user who normally spends ₹500/transaction making a ₹50,000 transaction
  // is a red flag even if ₹50,000 is below the absolute threshold
  unusualAmount: async (transaction) => {
    const stats = await Transaction.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(transaction.userId),
          type: 'debit',
          status: 'success',
          // Only look at last 90 days of history for a relevant baseline
          createdAt: {
            $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
          },
        },
      },
      {
        $group: {
          _id: null,
          avgAmount: { $avg: '$amount' },
          count: { $sum: 1 },
        },
      },
    ]);

    // Need at least 5 historical transactions for a meaningful baseline
    if (!stats.length || stats[0].count < 5) {
      return { triggered: false, score: 0, reason: '' };
    }

    const avg = stats[0].avgAmount;
    const multiplier = transaction.amount / avg;
    const triggered = multiplier >= FRAUD_RULES.UNUSUAL_AMOUNT_MULTIPLIER;

    return {
      triggered,
      score: triggered ? 25 : 0,
      reason: `Amount is ${multiplier.toFixed(1)}x the user's 90-day average of ₹${Math.round(avg)}`,
    };
  },

  // Rule 4: Night-time large transaction (11PM - 5AM)
  // WHY? Unauthorized access often happens at odd hours
  offHoursLargeTransaction: async (transaction) => {
    const hour = new Date().getHours();
    const isOffHours = hour >= 23 || hour < 5;
    const isLarge = transaction.amount >= 50000;
    const triggered = isOffHours && isLarge;

    return {
      triggered,
      score: triggered ? 20 : 0,
      reason: `Large transaction of ₹${transaction.amount} initiated between 11PM–5AM`,
    };
  },
};

// ─────────────────────────────────────────────────────────────
// MAIN FRAUD CHECK FUNCTION
// Called after every debit/transfer transaction is created
// Accepts an optional Mongoose session for atomic fraud alert creation
// ─────────────────────────────────────────────────────────────
export const runFraudCheck = async (transaction, session = null) => {
  try {
    // Run all rules concurrently — they're independent
    const ruleResults = await Promise.all(
      Object.values(rules).map((rule) => rule(transaction))
    );

    // Accumulate total risk score and collect triggered reasons
    const triggeredResults = ruleResults.filter((r) => r.triggered);
    const totalScore = triggeredResults.reduce((sum, r) => sum + r.score, 0);
    const reasons = triggeredResults.map((r) => r.reason);

    if (totalScore >= FRAUD_RULES.RISK_SCORE_THRESHOLD) {
      // Create fraud alert
      const alertOptions = session ? { session } : {};
      await FraudAlert.create(
        [{
          transactionId: transaction._id,
          userId: transaction.userId,
          riskScore: Math.min(totalScore, 100), // cap at 100
          reasons,
          alertStatus: 'open',
        }],
        alertOptions
      );

      // Flag the transaction itself
      await Transaction.findByIdAndUpdate(
        transaction._id,
        { isFlagged: true },
        session ? { session } : {}
      );

      return { isFlagged: true, riskScore: totalScore, reasons };
    }

    return { isFlagged: false, riskScore: totalScore, reasons: [] };

  } catch (error) {
    // IMPORTANT: Fraud check failure should NOT block the transaction
    // Log the error but don't throw — the transaction already succeeded
    // In production this would go to a logging service like Datadog
    console.error('Fraud check error (non-blocking):', error.message);
    return { isFlagged: false, riskScore: 0, reasons: [] };
  }
};