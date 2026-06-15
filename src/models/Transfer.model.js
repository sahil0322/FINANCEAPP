import mongoose from 'mongoose';

// WHY a separate Transfer model instead of just two Transaction records?
// The Transfer document is the SOURCE OF TRUTH for the transfer operation.
// It links the two resulting transaction records together, ensuring
// you can always audit: "these two transactions are the same transfer."
// This is called an audit trail — critical in financial systems.

const transferSchema = new mongoose.Schema(
  {
    fromAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      required: true,
    },
    toAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      required: true,
    },
    initiatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: [0.01, 'Transfer amount must be positive'],
    },
    status: {
      type: String,
      enum: ['success', 'failed', 'pending'],
      default: 'pending',
    },
    // Store IDs of the two generated transaction records
    debitTransactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
      default: null,
    },
    creditTransactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
      default: null,
    },
    failureReason: {
      type: String,
      default: null, // populated if transfer fails
    },
  },
  { timestamps: true }
);

export const Transfer = mongoose.model('Transfer', transferSchema);