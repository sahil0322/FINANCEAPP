import mongoose from 'mongoose';
import { User } from './src/models/User.model.js';
import 'dotenv/config';

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    
    // Find the very first user in the database, regardless of their email
    const user = await User.findOne({});
    
    if (!user) {
      console.log('No users found in the database! Did you register one?');
      process.exit(1);
    }

    // Forcefully promote them to admin
    user.role = 'admin';
    await user.save();

    console.log('User promoted successfully!');
    console.log('Email:', user.email);
    console.log('Role:', user.role);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
};

run();