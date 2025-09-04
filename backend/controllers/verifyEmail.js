const User = require('../models/user');

const verifyEmail = async (request, reply) => {
  try {
    const { token } = request.query;
    console.log('Email verification attempt with token:', token ? token.substring(0, 10) + '...' : 'null');
    
    if (!token) {
      console.log('No token provided in request');
      return reply.status(400).send({ error: 'Verification token is required.' });
    }
    
    let user;
    try {
      user = await User.findByVerificationToken(token);
      console.log('User lookup result:', user ? `Found user: ${user.name} (${user.email})` : 'No user found');
    } catch (dbErr) {
      console.error('DB error in findByVerificationToken:', dbErr);
      request.log.error('DB error in findByVerificationToken:', dbErr);
      return reply.status(500).send({ error: 'Database error during verification.' });
    }

    // If no user found by token, check if token was used before by looking for any verified user
    if (!user) {
      console.log('Token not found in database - checking if it was used before...');
      
      // Check if any user exists with this token pattern or if we should show already verified message
      // Since we can't determine the specific user, show generic invalid token message
      console.log('Token not found in database or already used');
      return reply.status(400).type('text/html').send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Invalid Verification Token</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; margin-top: 50px; }
            .error { color: #EF4444; font-size: 24px; margin: 20px; }
            .message { color: #374151; font-size: 16px; margin: 20px; }
            .button { 
              background-color: #6B7280; 
              color: white; 
              padding: 12px 24px; 
              text-decoration: none; 
              border-radius: 6px; 
              display: inline-block;
              margin-top: 20px;
            }
          </style>
        </head>
        <body>
          <div class="error">❌ Invalid or Expired Token</div>
          <div class="message">
            This verification link is invalid or has already been used.<br>
            If your email was already verified, you can log in directly.<br>
            If you need a new verification email, please contact support or try signing up again.
          </div>
          <a href="https://c1r6s6.42beirut.com:3000/#/login" class="button">Go to Login</a>
        </body>
        </html>
      `);
    }

    if (user.is_verified === 1) {
      console.log('User email already verified');
      return reply.type('text/html').send(`
        <html>
        <head>
          <meta charset="utf-8">
          <title>Email Already Verified</title>
        </head>
        <body style="font-family: Arial, sans-serif; text-align: center; margin-top: 100px; background: #f0f0f0;">
          <div style="background: white; padding: 40px; border-radius: 10px; margin: 20px auto; max-width: 500px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h1 style="color: #3B82F6; margin-bottom: 20px;">ℹ️ Email Already Verified</h1>
            <p style="color: #374151; font-size: 18px;">Your email has already been verified.</p>
            <p style="color: #374151; font-size: 16px;">You can login to your account.</p>
            <a href="https://c1r6s6.42beirut.com:3000/#/login" style="display: inline-block; background: #3B82F6; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin-top: 20px; font-size: 16px;">Go to Login</a>
          </div>
        </body>
        </html>
      `);
    }
    
    console.log('Attempting to verify user:', user.name);
    try {
      await User.verifyEmail(user.id);
      console.log('User verification successful');
    } catch (dbErr) {
      console.error('DB error in verifyEmail:', dbErr);
      request.log.error('DB error in verifyEmail:', dbErr);
      return reply.status(500).send({ error: 'Failed to update verification status.' });
    }
    
    console.log('About to send success HTML response');
    
    // Try sending a very simple HTML response
    reply.header('Content-Type', 'text/html; charset=utf-8');
    reply.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    reply.header('Pragma', 'no-cache');
    reply.header('Expires', '0');
    
    const htmlResponse = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Email Verified - Success</title>
</head>
<body>
    <h1>SUCCESS: Email Verified!</h1>
    <p>Your email has been successfully verified.</p>
    <p>You can now login to your account.</p>
    <a href="https://c1r6s6.42beirut.com:3000/#/login">Click here to login</a>
    <script>
        console.log('Email verification page loaded successfully');
        document.title = 'Email Verified - SUCCESS';
    </script>
</body>
</html>`;
    
    console.log('Sending HTML response with length:', htmlResponse.length);
    return reply.code(200).send(htmlResponse);
  } catch (err) {
    console.error('Unexpected error in verifyEmail:', err);
    request.log.error('Unexpected error in verifyEmail:', err);
    return reply.status(500).send({ error: 'Internal Server Error' });
  }
};

module.exports = verifyEmail;
