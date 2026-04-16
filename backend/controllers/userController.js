exports.getProfile = async (req, res) => {
  res.json({
    name: req.user.name,
    email: req.user.email
  });
};