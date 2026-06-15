import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['credit', 'debit', 'transfer'],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: [0.01, 'Amount must be positive'],
    },
    category: {
      type: String,
      enum: [
        'salary', 'food', 'transport', 'shopping',
        'utilities', 'entertainment', 'healthcare',
        'education', 'transfer', 'other'
      ],
      default: 'other',
    },
    description: {
      type: String,
      trim: true,
      maxlength: [200, 'Description too long'],
    },
    status: {
      type: String,
      enum: ['success', 'pending', 'failed'],
      default: 'success',
    },
    // payment channel is useful for analytics and fraud detection
    channel: {
      type: String,
      enum: ['online', 'atm', 'branch', 'mobile', 'pos'],
      default: 'online',
    },
    // Reference to transfer document, if this transaction was part of a transfer
    transferId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transfer',
      default: null,
    },
    isFlagged: {
      type: Boolean,
      default: false, // set to true by fraud detection service
    },
  },
  { timestamps: true }
);

// Compound index for efficient filtering by user + date range
// Interview question: "why a compound index?" — single-field queries can use it too
transactionSchema.index({ userId: 1, createdAt: -1 });
transactionSchema.index({ accountId: 1, createdAt: -1 });

export const Transaction = mongoose.model('Transaction', transactionSchema);