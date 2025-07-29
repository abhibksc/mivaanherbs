const mongoose = require("mongoose");
const Admin = require("../models/Admin"); // Update path if needed

// Replace with your actual MongoDB URI
const MONGO_URI = process.env.MONGODB_URI

const seedAdmin = async () => {
  try {
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    const dummyAdmin = new Admin({
      email: "admin@example.com",
      password: "admin123", // will be hashed automatically
    });

    await dummyAdmin.save();
    console.log("Dummy admin inserted successfully!");
    mongoose.disconnect();
  } catch (err) {
    console.error("Error seeding admin:", err);
  }
};

seedAdmin();
