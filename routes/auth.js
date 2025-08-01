const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User =require("../models/auth.js");
const { loginAdmin } = require('../controllers/admin.controller.js');
const handleTransactionAbort = require('../utils/handleTransactionError'); // adjust path accordingly

// Generate username
function generateUsername(fullName) {
  const prefix = fullName.replace(/[^A-Za-z]/g, '').toLowerCase().substring(0, 3);
  const random = Math.floor(1000 + Math.random() * 9000);
  return prefix + random;
}

// Register Route
router.post('/user-register', async (req, res) => {

  const session = await mongoose.startSession();
  session.startTransaction();

  const { full_name, mobile, email, password, other_sponsor_id, country_id ,join_at } = req.body;
  // Basic required field check (without sponsor_id)
  if (!full_name || !mobile || !email || !password || !country_id || !join_at || !other_sponsor_id) {
     return await handleTransactionAbort(session, res, 400, 'All fields are required');
  }

  try {
    // Check for existing mobile/email
    const exists = await User.findOne({ $or: [{ email }, { mobile }] });
    if(exists)  return await handleTransactionAbort(session, res, 409, 'Email or Mobile already registered');
    
    // If sponsor_id is provided, verify it
    let sponsorObjectId = null;
    let referred_by = null;
    let crt_by=null;
    const sponsor = await User.findOne({MYsponsor_id:other_sponsor_id});
     if (!sponsor) return await handleTransactionAbort(session, res, 400, 'Invalid sponsor ID')

    sponsorObjectId = sponsor.MYsponsor_id;
    referred_by = sponsor._id;
    crt_by=sponsor.username;

    // Create user
    const username = generateUsername(full_name);
    const MYsponsor_id = `${mobile}-${Date.now()}`;
    const hashedPassword = await bcrypt.hash(password, 10);
    const crt_date = new Date();
    console.error(MYsponsor_id);
    const newUser = new User({
      username,
      full_name,
      mobile,
      email,
       referred_by,
      other_sponsor_id: sponsorObjectId,
      MYsponsor_id,
      country_id,
      password: hashedPassword,
      is_active: false,
      crt_by,
      crt_date
    });

    await newUser.save();

    // for Sponser person...

    if(join_at === "Left"){
       sponsor.left_user = other_sponsor_id;
    }
    else if(join_at === "Right"){
       sponsor.right_user = other_sponsor_id;
    }
    else{
return await handleTransactionAbort(session, res, 404, 'join_at missing!!')
    }




    await sponsor.save();
    await session.commitTransaction();
    session.endSession();
    return  res.json({ success: true, message: 'User registered successfully', username : username,MYsponsor_id : MYsponsor_id });

    

  } catch (err) {
    console.error(err);
    await handleTransactionAbort(session, res, 500, "Server error: ' + err.message");
  }
});

// Login Route
router.post('/user-login', async (req, res) => {
  const { username_or_mobile, password } = req.body;

  if (!username_or_mobile || !password) {
    return res.status(400).json({ error: 'Username or Mobile and Password are required' });
  }

  try {
    const user = await User.findOne({
      $or: [{ username: username_or_mobile }, { mobile: username_or_mobile }]
    });

    if (!user) return res.status(401).json({ error: 'User not found' ,  username_or_mobile, password  , user });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ error: 'Invalid password' });

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
      message: 'Login successful',
      token,
      userName : user.username,
      userId : user._id,
       role: user.role || "user"
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});



// POST /api/forgot-password
router.post("/forgot-password", async (req, res) => {
  try {
    const { username_or_mobile, newPassword } = req.body;

    if (!username_or_mobile || !newPassword) {
      return res.status(400).json({ error: "Missing required fields"  , data: req.body});
    }

    // Find user by username or mobile
    const user = await User.findOne({
      $or: [
        { username: username_or_mobile },
        { mobile: username_or_mobile }
      ]
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    user.password = hashedPassword;
    await user.save();

    return res.json({ success: true, message: "Password updated successfully." });
  } catch (err) {
    console.error("Forgot Password Error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/admin-login", loginAdmin);



module.exports = router;
