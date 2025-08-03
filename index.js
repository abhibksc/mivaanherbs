const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const path = require("path");

const app = express();
app.use(express.json());
app.use(cors()); // This enables CORS for all origins
// Serve static files from the uploads directory
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/User/user.routes');
const adminRoutes = require("./routes/Admin/admin.routes");
const { authMiddleware } = require("./middleware/auth.middleware");
const { checkRole } = require("./middleware/roles.middleware");




app.use('/api', authRoutes); //user login or singup or forgot 
app.use('/api/user', authMiddleware, checkRole("user"), userRoutes); // Only users
app.use('/api/admin', authMiddleware, checkRole("admin"), adminRoutes); // Only admins


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
