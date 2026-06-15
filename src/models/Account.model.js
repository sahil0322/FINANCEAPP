import mongoose from 'mongoose';

const accountSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true, // index for fast lookups by user
    },
    bankName: {
      type: String,
      required: [true, 'Bank name is required'],
      trim: true,
    },
    accountHolderName: {
      type: String,
      required: true,
      trim: true,
    },
    accountType: {
      type: String,
      enum: ['savings', 'current', 'salary', 'fixed_deposit'],
      required: true,
    },
    // WHY store only last 4 digits?
    // PCI-DSS compliance — never store full account numbers.
    // Even in a portfolio project, demonstrate this awareness.
    accountNumberLast4: {
      type: String,
      required: true,
      match: [/^\d{4}$/, 'Must be exactly 4 digits'],
    },
    balance: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'Balance cannot be negative'], // business rule enforced at DB level
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

export const Account = mongoose.model('Account', accountSchema);