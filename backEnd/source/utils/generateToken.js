const jwt = require('jsonwebtoken');

const generateToken = (id, sessionId = null) => {
  return jwt.sign(
    { id, sessionId },
    process.env.JWT_SECRET,
    {
      expiresIn: '7d',
    }
  );
};

module.exports = generateToken;
