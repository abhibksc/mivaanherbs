const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User =require("../models/auth.js");

// Generate username
function generateUsername(fullName) {
  const prefix = fullName.replace(/[^A-Za-z]/g, '').toLowerCase().substring(0, 3);
  const random = Math.floor(1000 + Math.random() * 9000);
  return prefix + random;
}

// Register Route
router.post('/register', async (req, res) => {



  const { full_name, mobile, email, password, referal_id, country_id  } = req.body;

  // Basic required field check (without sponsor_id)
  if (!full_name || !mobile || !email || !password || !country_id) {
    return res.status(400).json({ error: 'Full name, mobile, email, password, and country_id are required' , data : req.body });
  }


  

  try {
    // Check for existing mobile/email
    const exists = await User.findOne({ $or: [{ email }, { mobile }] });
    if (exists) return res.status(409).json({ error: 'Email or Mobile already registered' });

    // If sponsor_id is provided, verify it
    let sponsorObjectId = null;
    let crt_by=null;
    if (referal_id) {
      const sponsor = await User.findOne({MYsponsor_id:referal_id});
      if (!sponsor) return res.status(400).json({ error: 'Invalid sponsor ID' });
      sponsorObjectId = referal_id;
      crt_by=sponsor.username;
    }

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
      other_sponsor_id: sponsorObjectId,
      MYsponsor_id,
      country_id,
      password: hashedPassword,
      is_active: false,
      crt_by,
      crt_date
    });

    await newUser.save();

  return  res.json({ success: true, message: 'User registered successfully', username : username,MYsponsor_id : MYsponsor_id });




    // res.json({ success: true, message: 'User registered successfully', username, MYsponsor_id, username });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// Login Route
router.post('/login', async (req, res) => {
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

    const token = jwt.sign({ id: user._id, username: user.username }, process.env.JWT_SECRET, {
      expiresIn: '7d'
    });

    res.json({
      success: true,
      message: 'Login successful',
      token,
      userName : user.username,
      userId : user._id
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


module.exports = router;
