const { Transaction } = require("../models/Transaction");
const express = require("express");
const userRouter = express.Router();

const bcrypt = require("bcrypt");
const User = require("../models/auth.js");
const Transaction = require("../models/Transaction.js");

// Generate username
function generateUsername(fullName) {
  const prefix = fullName
    .replace(/[^A-Za-z]/g, "")
    .toLowerCase()
    .substring(0, 3);
  const random = Math.floor(1000 + Math.random() * 9000);
  return prefix + random;
}

// Register Route
userRouter.post("/activate", async (req, res) => {
  try {
    const { username, packageAmount } = req.body;

    // 1. Fetch user
    const user = await User.findOne({ username });
    if (!user) return res.status(404).json({ error: "User not found" });

    // 2. Activate user
    user.is_active = true;
    user.package = packageAmount;
    await user.save();
    const dp = Math.round(packageAmount * 0.8017);
    const bv = parseFloat((packageAmount * 0.0079).toFixed(2));
    // 3. Record transaction
    await Transaction.create({
      user_id: user._id,
      username,
      package_amount: packageAmount,
      dp,
      bv,
      payment_ref: user._id + "/" + username,
      status: "Success",
    });

    // 4. Find sponsor
    const sponsor = await User.findOne({
      my_sponsor_id: user.other_sponsor_id,
    });
    if (sponsor) {
      let sponsorChanged = false;

      // 5. Assign to binary tree
      if (!sponsor.left_user) {
        sponsor.left_user = user.other_sponsor_id;
        sponsorChanged = true;
      } else if (!sponsor.right_user) {
        sponsor.right_user = user.other_sponsor_id;
        sponsorChanged = true;
      }

      // 6. Direct Income (10%)
      const directIncome = packageAmount * 0.1;
      sponsor.wallet_balance += directIncome;
      sponsor.direct_sponsor_income += directIncome;
      sponsor.income_logs.push({
        type: "Direct",
        amount: directIncome,
        from_user: user._id,
      });
      sponsorChanged = true;

      // 7. Fighter Income (5%)
      if (sponsor.left_user && sponsor.right_user) {
        const fighterIncome = packageAmount * 0.05;
        sponsor.wallet_balance += fighterIncome;
        sponsor.fighter_income += fighterIncome;
        sponsor.income_logs.push({
          type: "Fighter",
          amount: fighterIncome,
          from_user: user.other_sponsor_id,
        });
        sponsorChanged = true;
      }

      // 8. Update BV
      const side =
        String(sponsor.left_user) === String(user._id) ? "left_bv" : "right_bv";
      sponsor[side] += bv;
      sponsorChanged = true;

      // 9. Matching Income (30% of min BV)
      const pairBV = Math.min(sponsor.left_bv, sponsor.right_bv);
      if (pairBV > 0) {
        const matchIncome = pairBV * 0.3;
        sponsor.wallet_balance += matchIncome;
        sponsor.matching_income += matchIncome;
        sponsor.left_bv -= pairBV;
        sponsor.right_bv -= pairBV;
        sponsor.income_logs.push({
          type: "Matching",
          amount: matchIncome,
          from_user: sponsor._id, // from self
        });
        sponsorChanged = true;
      }

      if (sponsorChanged) await sponsor.save();
    }

    return res.json({
      success: true,
      message: "User activated and incomes distributed",
    });
  } catch (err) {
    console.error("Activation Error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

// GET: Get all incomes for a user
userRouter.get(
  "/getProfile",

  async (req, res) => {
    try {
      const userId = req.user.id; // assuming you're using auth middleware
      const user = await User.findById(userId).select("-password -income_logs");
      res.json(user);
    } catch (err) {
      res.status(500).json({ error: "Something went wrong." });
    }
  }
);

// GET: Get all incomes for a user
userRouter.get(
  "/getIncome",

  async (req, res) => {
    try {
      const userId = req.user.id;
      const user = await User.findById(userId);
      const {
        direct_sponsor_income,
        fighter_income,
        matching_income,
        wallet_balance,
      } = user;

      res.json({
        direct_sponsor_income,
        fighter_income,
        matching_income,
        wallet_balance,
      });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch income." });
    }
  }
);

// GET: Get all incomes for a user
userRouter.get(
  "/getTransactions ",

  async (req, res) => {
    try {
      const userId = req.user.id;
      const transactions = await Transaction.find({ user_id: userId }).sort({
        created_at: -1,
      });
      res.json(transactions);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch transactions." });
    }
  }
);

// GET: Get all incomes for a user
userRouter.get(
  "/getMyNetwork ",

  async (req, res) => {
    try {
      const userId = req.user.id;
      const user = await User.findById(userId).populate(
        "my_mlm_network.user_id",
        "full_name username"
      );
      res.json(user.my_mlm_network);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch network." });
    }
  }
);



// // GET: Get all incomes for a user
userRouter.get("/getDashboardData",

  async (req, res) => {
  try {
    const userId = req.user.id; // assuming JWT middleware attaches user info
    const user = await User.findById(userId);

    if (!user) return res.status(404).json({ message: 'User not found' });

    // Fetch additional data
    const totalWithdrawal = 0; // replace with real logic if you store withdrawals
    const totalRewards = 0; // if applicable
    const totalRepurchase = 0; // if applicable

    const totalReferrals = user.my_mlm_network.length;

    res.json({
      wallet_balance: user.wallet_balance,
      direct_sponsor_income: user.direct_sponsor_income,
      fighter_income: user.fighter_income,
      matching_income: user.matching_income,
      total_withdrawal: totalWithdrawal,
      total_rewards: totalRewards,
      total_repurchase: totalRepurchase,
      total_referrals: totalReferrals,
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}



);

module.exports = userRouter;
