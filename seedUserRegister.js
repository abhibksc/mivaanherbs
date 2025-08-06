require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const User = require("./models/Users/User");

const MONGO_URI = process.env.MONGODB_URI;

if (!MONGO_URI) {
  console.error("❌ MONGODB_URI is not defined in .env");
  process.exit(1);
}

console.log("🔌 Connecting to MongoDB...");

mongoose
  .connect(MONGO_URI, {
    serverSelectionTimeoutMS: 10000,
  })
  .then(() => console.log("✅ MongoDB Atlas connected"))
  .catch((err) => {
    console.error("❌ Connection error:", err.message);
    process.exit(1);
  });

// 👇 Generate 10-digit zero-padded usernames
let counter = 1;
function generateUsername() {
  return String(counter++).padStart(10, "0");
}

// Helper to find position
async function findAvailablePosition(startUserId) {
  const queue = [startUserId];
  while (queue.length > 0) {
    const currentId = queue.shift();
    const currentUser = await User.findById(currentId);

    if (!currentUser.left_user) {
      return { parent: currentUser, position: "left_user" };
    }

    if (!currentUser.right_user) {
      return { parent: currentUser, position: "right_user" };
    }

    queue.push(currentUser.left_user);
    queue.push(currentUser.right_user);
  }

  return null;
}

const seedUserRegister = async () => {
  try {
    console.log("✅ Connected to MongoDB");

    // 👤 New user info
    const full_name = "Raj Kumar";
    const mobile = "9876500001";
    const email = "RajKumar@gmail.com";
    const password = await bcrypt.hash("rajkumar123", 10);
    const join_at = "Left";
    const country_id = "IN";

    // Check if user exists
    const exists = await User.findOne({ $or: [{ email }, { mobile }] });
    if (exists) throw new Error("❌ Email or Mobile already registered");

    // Try to find sponsor
    const sponsorEmail = "imowner@mivaan.com";
    let sponsor = await User.findOne({ email: sponsorEmail });

    // If sponsor not found and it's first user
    if (!sponsor) {
      const existingUsers = await User.countDocuments();
      if (existingUsers === 0) {
        console.log("🔓 No sponsor found, but this is the first user. Proceeding as root...");
        sponsor = null;
      } else {
         console.log("🔓 No sponsor found, but this is the first user. Proceeding as root...");
        sponsor = null;
      }
    }

    if (sponsor && !sponsor.is_active) throw new Error("❌ Sponsor is not active");

    // Generate unique username
    let username;
    while (true) {
      username = generateUsername();
      const exists = await User.findOne({ username });
      if (!exists) break;
    }

    const MYsponsor_id = username;

    // Create user
    const newUser = new User({
      username,
      full_name,
      mobile,
      email,
      password,
      referred_by: sponsor ? sponsor._id : null,
      other_sponsor_id: sponsor ? sponsor.MYsponsor_id : null,
      MYsponsor_id,
      country_id,
      is_active: sponsor ? false : true,
      crt_by: sponsor ? sponsor.username : "system",
      crt_date: new Date(),
    });

    await newUser.save();

  

    console.log("✅ Seeder user registered successfully with username:", username);
  } catch (err) {
    console.error("❌ Seeder error:", err.message);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 MongoDB disconnected");
  }
};

seedUserRegister();
