require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const User = require("./models/Users/User"); // Adjust path as needed

const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/your-db-name";

// Utility to generate a unique username
function generateUsername(fullName) {
  const prefix = fullName.replace(/[^A-Za-z]/g, '').toLowerCase().substring(0, 3);
  const random = Math.floor(1000 + Math.random() * 9000);
  return prefix + random;
}

// Utility to generate sponsor ID
function generateSponsorId(mobile, fullName) {
  const firstName = fullName.trim().split(' ')[0].replace(/[^A-Za-z]/g, '').toLowerCase();
  const last4Digits = mobile.slice(-4);
  const timestamp = Date.now();
  return `MIVAAN_${firstName}_${last4Digits}_${timestamp}`;
}

const seedUsers = async () => {
  try {
    console.log("📡 Connecting to MongoDB...");
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("✅ MongoDB connected");

    // 🌱 Create Root Sponsor
    const sponsorEmail = "sponsor@example.com";
    const existingSponsor = await User.findOne({ email: sponsorEmail });

    let rootSponsor;
    if (existingSponsor) {
      console.log("⚠️ Root sponsor already exists. Skipping creation.");
      rootSponsor = existingSponsor;
    } else {
      const sponsorName = "Root Sponsor";
      const sponsorMobile = "9876543210";
      const sponsorPassword = await bcrypt.hash("Test@1234", 10);
      const sponsorUsername = generateUsername(sponsorName);

      let sponsorId;
      while (true) {
        sponsorId = generateSponsorId(sponsorMobile, sponsorName);
        const exists = await User.findOne({ MYsponsor_id: sponsorId });
        if (!exists) break;
      }

      rootSponsor = new User({
        username: sponsorUsername,
        full_name: sponsorName,
        mobile: sponsorMobile,
        email: sponsorEmail,
        password: sponsorPassword,
        MYsponsor_id: sponsorId,
        is_active: true,
        country_id: "IN",
        crt_date: new Date(),
        crt_by: "system",
      });

      await rootSponsor.save();
      console.log("✅ Root sponsor created");
    }

    // 🌱 Create Test User Referred by Root Sponsor
    const userEmail = "user@example.com";
    const existingUser = await User.findOne({ email: userEmail });

    if (existingUser) {
      console.log("⚠️ Test user already exists. Skipping creation.");
      return mongoose.disconnect();
    }

    const fullName = "Test User";
    const mobile = "9123456789";
    const password = await bcrypt.hash("User@123", 10);
    const join_at = "Left"; // Or "Right"

    let username = generateUsername(fullName);
    while (await User.findOne({ username })) {
      username = generateUsername(fullName); // Ensure unique username
    }

    let MYsponsor_id;
    while (true) {
      MYsponsor_id = generateSponsorId(mobile, fullName);
      const sponsorIdExists = await User.findOne({ MYsponsor_id });
      if (!sponsorIdExists) break;
    }

    const newUser = new User({
      username,
      full_name: fullName,
      mobile,
      email: userEmail,
      password,
      MYsponsor_id,
      referred_by: rootSponsor._id,
      other_sponsor_id: rootSponsor.MYsponsor_id,
      country_id: "IN",
      is_active: false,
      crt_by: rootSponsor.username,
      crt_date: new Date(),
    });

    await newUser.save();
    console.log("✅ Test user created");

    // ↔️ Link user to sponsor (left or right)
    if (join_at === "Left") {
      rootSponsor.left_user = newUser._id;
    } else if (join_at === "Right") {
      rootSponsor.right_user = newUser._id;
    } else {
      console.log("❌ Invalid join_at value. Must be 'Left' or 'Right'");
      return mongoose.disconnect();
    }

    await rootSponsor.save();
    console.log(`✅ Test user linked to root sponsor on ${join_at}`);

  } catch (err) {
    console.error("❌ Error seeding users:", err);
  } finally {
    mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
  }
};

seedUsers();
