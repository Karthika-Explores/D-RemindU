const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// Generate Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || "default_jwt_secret", {
    expiresIn: "7d"
  });
};

// ✅ Register User
const registerUser = async (req, res) => {
  try {
    let { name, email, password, age, weight, glucoseLevel, emergencyContact } = req.body;

    if (!name || !email || !password || age === undefined || age === null || age === "") {
      return res.status(400).json({ message: "Please fill in all required fields (Name, Email, Password, Age)." });
    }

    email = String(email).trim().toLowerCase();
    name = String(name).trim();

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: "An account with this email already exists." });
    }

    const parsedAge = Number(age);
    if (isNaN(parsedAge) || parsedAge <= 0 || parsedAge > 150) {
      return res.status(400).json({ message: "Please enter a valid age between 1 and 150." });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(String(password), salt);

    const parsedWeight = (weight !== undefined && weight !== null && weight !== "" && !isNaN(Number(weight)))
      ? Number(weight)
      : null;

    const parsedGlucose = (glucoseLevel !== undefined && glucoseLevel !== null && glucoseLevel !== "" && !isNaN(Number(glucoseLevel)))
      ? Number(glucoseLevel)
      : null;

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      age: parsedAge,
      weight: parsedWeight,
      glucoseLevel: parsedGlucose,
      emergencyContact: emergencyContact ? String(emergencyContact).trim() : ""
    });

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      age: user.age,
      weight: user.weight,
      glucoseLevel: user.glucoseLevel,
      emergencyContact: user.emergencyContact,
      stockReminderTime: user.stockReminderTime,
      token: generateToken(user._id)
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ message: error.message || "Registration failed. Please try again." });
  }
};

// ✅ Login User
const loginUser = async (req, res) => {
  try {
    let { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Please provide both email and password." });
    }

    email = String(email).trim().toLowerCase();

    const user = await User.findOne({ email });

    if (user && (await bcrypt.compare(String(password), user.password))) {
      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        age: user.age,
        weight: user.weight,
        glucoseLevel: user.glucoseLevel,
        emergencyContact: user.emergencyContact,
        stockReminderTime: user.stockReminderTime,
        token: generateToken(user._id)
      });
    } else {
      res.status(401).json({ message: "Invalid email or password." });
    }
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: error.message || "Login failed. Please try again." });
  }
};

// ✅ ONLY ONE EXPORT (FIXED)
module.exports = { registerUser, loginUser };