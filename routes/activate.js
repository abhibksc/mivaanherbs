const express = require("express");
const activate_router = express.Router();
const User = require("../models/auth");
const { Transaction } = require("../models/Transaction");

activate_router.get("/allusers", async (req, res) => {
  try {
    const users = await User.find(
      {},
      {
        username: 1,
        email: 1,
        mobile: 1,
        country_id: 1,
        crt_date: 1,
        is_active: 1,
        wallet_balance: 1,
      }
    ).sort({ crt_date: -1 });

    const transactions = await Transaction.find({ status: "Success" });

    // Map user_id -> total package
    const userPackageSums = {};
    let totalPackageSell = 0;

    transactions.forEach((txn) => {
      const userId = txn.user_id.toString();
      const amount = parseFloat(txn.package_amount) || 0;

      userPackageSums[userId] = (userPackageSums[userId] || 0) + amount;
      totalPackageSell += amount;
    });

    const userData = users.map((user) => {
      return {
        username: user.username,
        email: user.email,
        mobile: user.mobile,
        country: user.country_id,
        joined_at: user.crt_date,
        active: user.is_active,
        balance: user.wallet_balance,
      };
    });

    // Final response
    return res.json({
      total_package_sell: totalPackageSell,
      withdrawals: 0,
      data: userData,
    });
  } catch (err) {
    console.error("User list error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

// POST /api/activate
activate_router.post("/activate", async (req, res) => {
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

module.exports = activate_router;
