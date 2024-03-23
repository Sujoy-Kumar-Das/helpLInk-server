const jwt = require("jsonwebtoken");

const generateToken = (email) => {
  const token = jwt.sign({ email }, process.env.JWT_SECRET, {
    expiresIn: process.env.EXPIRES_IN,
  });

  return token;
};

module.exports = generateToken;
