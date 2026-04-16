exports.getProfile = async (req, res) => {
  res.json({
    name: req.user.name,
    email: req.user.email,
    age: req.user.age,
    weight: req.user.weight,
    glucoseLevel: req.user.glucoseLevel
  });
};

exports.updateProfile = async (req, res) => {
  try {
    const user = req.user;
    
    if (req.body.name) user.name = req.body.name;
    if (req.body.age !== undefined) user.age = Number(req.body.age);
    if (req.body.weight !== undefined) user.weight = Number(req.body.weight);
    if (req.body.glucoseLevel !== undefined) user.glucoseLevel = Number(req.body.glucoseLevel);

    const updatedUser = await user.save();

    res.json({
      name: updatedUser.name,
      email: updatedUser.email,
      age: updatedUser.age,
      weight: updatedUser.weight,
      glucoseLevel: updatedUser.glucoseLevel
    });
  } catch (error) {
    res.status(500).json({ message: "Error updating profile", error: error.message });
  }
};