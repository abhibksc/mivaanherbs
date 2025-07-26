const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();


const app = express();
app.use(express.json());
app.use(cors()); // This enables CORS for all origins

const authRoutes = require('./routes/auth');
const activate_router=require('./routes/activate');

app.use('/api', authRoutes);
app.use('/api', activate_router);

// ✅ Connect to MongoDB Atlas using environment variable
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ MongoDB Atlas connected');
    app.listen(3000, () => {
      console.log(`🚀 Server running at http://localhost:3000`);
    });
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
  });
