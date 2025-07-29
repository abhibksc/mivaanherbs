require("dotenv").config();
const mongoose = require("mongoose");
const Admin = require("./models/Admin"); // Adjust if needed

const MONGO_URI = process.env.MONGODB_URI;

const seedAdmin = async () => {
  try {
    console.log("📡 Connecting to DB...");
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("✅ Connected!");

    // Check if admin already exists
    const existing = await Admin.findOne({ email: "admin@example.com" });
    if (existing) {
      console.log("⚠️ Admin already exists. Skipping insert.");
      return mongoose.disconnect();
    }

    const dummyAdmin = new Admin({
      email: "admin@example.com",
      password: "admin123",
    });

    await dummyAdmin.save();
    console.log("✅ Dummy admin inserted successfully!");
    mongoose.disconnect();
  } catch (err) {
    console.error("❌ Error seeding admin:", err);
  }
};

seedAdmin();
