const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/Users/User.js");
const { loginAdmin } = require("../controllers/admin.controller.js");
const handleTransactionAbort = require("../utils/handleTransactionError"); // adjust path accordingly

// Generate username
async function generateUniqueUsername(session) {
  let username;
  let exists = true;

  while (exists) {
    username = String(Math.floor(Math.random() * 1e10)).padStart(10, "0");
    exists = await User.findOne({ username }).session(session);
  }

  return username;
}

// Helper: Breadth First Search (Level Order) to find first free child
async function findAvailablePosition(startUserId, session) {
  const queue = [startUserId];

  while (queue.length > 0) {
    const currentId = queue.shift();
    const currentUser = await User.findById(currentId).session(session);

    if (!currentUser.left_user) {
      return { parent: currentUser, position: "Left" };
    }

    if (!currentUser.right_user) {
      return { parent: currentUser, position: "Right" };
    }

    // Add children to queue
    queue.push(currentUser.left_user);
    queue.push(currentUser.right_user);
  }

  return null; // No space found
}

function calculateBenefitPercent(packageAmount) {
  if (packageAmount >= 5000) return 10;
  if (packageAmount >= 2000) return 7;
  if (packageAmount >= 1000) return 5;
  return 3;
}


// 🚀 Register Route
router.post("/user-register", async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  const {
    full_name,
    mobile,
    email,
    password,
    other_sponsor_id,
    country_id,
    join_at,
  } = req.body;

  if (
    !full_name ||
    !mobile ||
    !email ||
    !password ||
    !country_id ||
    !join_at ||
    !other_sponsor_id
  ) {
    return await handleTransactionAbort(
      session,
      res,
      400,
      "All fields are required"
    );
  }

  try {
    // 📛 Check if user already exists
    const exists = await User.findOne({ $or: [{ email }, { mobile }] }).session(
      session
    );
    if (exists)
      return await handleTransactionAbort(
        session,
        res,
        409,
        "Email or Mobile already registered"
      );

    // 👤 Validate Sponsor
    const sponsor = await User.findOne({
      MYsponsor_id: other_sponsor_id,
    }).session(session);

    if (!sponsor)
      return await handleTransactionAbort(
        session,
        res,
        400,
        `Invalid sponsor ID`
      );

    //     const idString = exists._id.toString();
    // const last4 = idString.slice(-4);

    // 🆔 Generate username
    const username = await generateUniqueUsername(session);
    const usernameExists = await User.findOne({ username }).session(session);
    if (usernameExists)
      return await handleTransactionAbort(
        session,
        res,
        409,
        "Username already exists, try again"
      );

    const MYsponsor_id = username;
    const hashedPassword = await bcrypt.hash(password, 10);
    const crt_date = new Date();
    const level = (sponsor.level || 0) + 1;
    const upline_path = [...(sponsor.upline_path || []), sponsor._id];

    const newUser = new User({
      username,
      full_name,
      mobile,
      email,
      referred_by: sponsor._id,
      other_sponsor_id: sponsor.MYsponsor_id,
      MYsponsor_id,
      country_id,
      password: hashedPassword,
      is_active: false,
      crt_by: sponsor.username,
      crt_date,
      upline_path,
      level, // ✅ here
    });

    await newUser.save({ session });

      // enum: ["left", "right"],

    // 📦 Left or Right Join Logic with BFS
    if (join_at === "Left") {
      if (!sponsor.left_user) {
        sponsor.left_user = newUser._id;
        await sponsor.save({ session });
      } else {
        const result = await findAvailablePosition(sponsor.left_user, session);
        if (!result)
          return await handleTransactionAbort(
            session,
            res,
            409,
            "No space available on the left tree"
          );
        result.parent[result.position] = newUser._id;
        await result.parent.save({ session });
      }
    } else if (join_at === "Right") {
      if (!sponsor.right_user) {
        sponsor.right_user = newUser._id;
        await sponsor.save({ session });
      } else {
        const result = await findAvailablePosition(sponsor.right_user, session);
        if (!result)
          return await handleTransactionAbort(
            session,
            res,
            409,
            "No space available on the right tree"
          );
        result.parent[result.position] = newUser._id;
        await result.parent.save({ session });
      }
    } else {
      return await handleTransactionAbort(
        session,
        res,
        400,
        'join_at must be "Left" or "Right"'
      );
    }

    //     enum: ["left", "right"],
const position = join_at === "Right" ? "right" : "left";
console.log(position);




// ✅ Add user to sponsor's MLM network
sponsor.my_mlm_network.push({
  user_id: newUser._id,
  package_amount: newUser.package || 0,
  benefit_percent: calculateBenefitPercent(newUser.package || 0),
  joined_at: new Date(),
  position: position, // 'left' or 'right'
});


await sponsor.save({ session }); // Save the network update



    // ✅ All good
    await session.commitTransaction();
    session.endSession();

    return res.json({
      success: true,
      message: "User registered successfully",
      username,
      MYsponsor_id,
    });
  } catch (err) {
    console.error(err);
    await handleTransactionAbort(
      session,
      res,
      500,
      `Server error: ${err.message}`
    );
  }
});

// Login Route
router.post("/user-login", async (req, res) => {
  const { username_or_mobile, password } = req.body;

  if (!username_or_mobile || !password) {
    return res
      .status(400)
      .json({ error: "Username or Mobile and Password are required" });
  }

  try {
    const user = await User.findOne({
      $or: [{ username: username_or_mobile }, { mobile: username_or_mobile }],
    });

    if (!user)
      return res
        .status(401)
        .json({ error: "User not found", username_or_mobile, password, user });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ error: "Invalid password" });

    const token = jwt.sign(
      {
        id: user._id,
        username: user.username,

        role: user.role || "user", // fallback to "user"
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    res.json({
      success: true,
      message: "Login successful",
      full_name: user.full_name,
      token,
      userName: user.username,
      MYsponsor_id: user.MYsponsor_id,
      userId: user._id,
      role: user.role || "user",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error: " + err.message });
  }
});

// POST /api/forgot-password
router.post("/forgot-password", async (req, res) => {
  try {
    const { username_or_mobile, newPassword } = req.body;

    if (!username_or_mobile || !newPassword) {
      return res
        .status(400)
        .json({ error: "Missing required fields", data: req.body });
    }

    // Find user by username or mobile
    const user = await User.findOne({
      $or: [{ username: username_or_mobile }, { mobile: username_or_mobile }],
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    user.password = hashedPassword;
    await user.save();

    return res.json({
      success: true,
      message: "Password updated successfully.",
    });
  } catch (err) {
    console.error("Forgot Password Error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/admin-login", loginAdmin);

module.exports = router;
