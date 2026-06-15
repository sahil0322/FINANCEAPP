import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [50, 'Name cannot exceed 50 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true, // normalize before storing
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false, // CRITICAL: never returned in queries by default
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    isActive: {
      type: Boolean,
      default: true, // admins can disable accounts
    },
  },
  { timestamps: true } // auto-adds createdAt and updatedAt
);

// PRE-SAVE HOOK: hash password before saving
// Why a hook vs. doing it in the controller?
// Because if password is updated anywhere, it's always hashed.
userSchema.pre('save', async function (next) {
  // Only hash if password field was actually modified
  if (!this.isModified('password')) return next();

  // Cost factor of 12 is the industry-standard balance of security vs. speed
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// INSTANCE METHOD: clean way to compare passwords
userSchema.methods.isPasswordCorrect = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

export const User = mongoose.model('User', userSchema);