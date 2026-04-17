exports.getProfile = async (req, res) => {
  res.json({
    name: req.user.name,
    email: req.user.email,
    age: req.user.age,
    weight: req.user.weight,
    glucoseLevel: req.user.glucoseLevel,
    emergencyContact: req.user.emergencyContact
  });
};

exports.updateProfile = async (req, res) => {
  try {
    const user = req.user;
    
    if (req.body.name) user.name = req.body.name;
    if (req.body.age !== undefined) {
      if (Number(req.body.age) > 150) return res.status(400).json({ message: "Age cannot exceed 150 years" });
      user.age = Number(req.body.age);
    }
    if (req.body.weight !== undefined) user.weight = Number(req.body.weight);
    if (req.body.glucoseLevel !== undefined) user.glucoseLevel = Number(req.body.glucoseLevel);
    if (req.body.emergencyContact !== undefined) user.emergencyContact = req.body.emergencyContact;

    const updatedUser = await user.save();

    res.json({
      name: updatedUser.name,
      email: updatedUser.email,
      age: updatedUser.age,
      weight: updatedUser.weight,
      glucoseLevel: updatedUser.glucoseLevel,
      emergencyContact: updatedUser.emergencyContact
    });
  } catch (error) {
    res.status(500).json({ message: "Error updating profile", error: error.message });
  }
};