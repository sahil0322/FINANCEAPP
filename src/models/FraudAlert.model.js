import mongoose from 'mongoose';

const fraudAlertSchema = new mongoose.Schema(
  {
    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // Risk score between 0–100, higher = more suspicious
    // Even a rule-based system can assign numeric scores:
    // e.g., high amount = +40, high frequency = +35, unusual category = +25
    riskScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    // Human-readable explanation of why this was flagged
    reasons: {
      type: [String],
      required: true,
    },
    alertStatus: {
      type: String,
      enum: ['open', 'reviewed', 'dismissed', 'escalated'],
      default: 'open',
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User', // the admin who reviewed it
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

export const FraudAlert = mongoose.model('FraudAlert', fraudAlertSchema);