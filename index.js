const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors()); // This enables CORS for all origins

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user.routes');
const adminRoutes = require("./routes/admin.routes");
const { authMiddleware } = require("./middleware/auth.middleware");


app.use('/api', authRoutes); //user login or singup or forgot 
app.use('/api/user', authMiddleware, userRoutes); //user authentication
app.use("/api/admin", adminRoutes); //admin authentication


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
