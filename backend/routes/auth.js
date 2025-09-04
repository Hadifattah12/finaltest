// routes/auth.js  ------------------------------------------------------------
const { pipeline } = require('stream/promises');
const path         = require('path');
const fs           = require('fs');

const auth                       = require('../middlewares/auth');
const confirmEmailUpdate         = require('../controllers/confirmEmailUpdate');
const { toggle2FA }              = require('../controllers/authController');
const { googleAuth, googleCallback } = require('../controllers/googleAuthController');
const User = require('../models/user');
const db   = require('../db/database');        // ← single DB handle here

async function routes(fastify) {
  const { signUp, login, getProfile, verify2FA } =
    require('../controllers/authController');
  const verifyEmail  = require('../controllers/verifyEmail');
  const tournament   = require('../controllers/tournamentController');

  /* ---------- Public auth ---------- */
  fastify.post('/signup',     signUp);
  fastify.post('/login',      login);
  fastify.post('/verify-2fa', verify2FA);

  /* ---------- Google OAuth ---------- */
  fastify.get('/auth/google',          googleAuth);
  fastify.get('/auth/google/callback', googleCallback);

  /* ---------- Protected profile routes ---------- */
  fastify.get('/profile',       { preHandler: auth }, getProfile);
  fastify.patch('/profile/2fa', { preHandler: auth }, toggle2FA);

  /* ---------------------------------------------------------------------- */
  /* PATCH /profile  – update profile, propagate name change to history      */
  /* ---------------------------------------------------------------------- */
  fastify.patch('/profile', { 
    preHandler: auth,
    config: {
      timeout: 60000 // 60 second timeout for this route
    }
  }, async (req, reply) => {
    let isAborted = false;
    
    // Handle request abort
    req.raw.on('aborted', () => {
      console.log('Profile update request aborted');
      isAborted = true;
    });
    
    try {
      const userId       = req.user.id;
      const currentUser  = await User.findById(userId);   // original values
      const oldName      = currentUser.name;

      // Handle multipart data
      let fields = {};
      let avatarFile = null;

      console.log('Request content-type:', req.headers['content-type']);
      console.log('Request method:', req.method);

      try {
        const parts = req.parts();
        console.log('Parts iterator created');
        
        for await (const part of parts) {
          if (isAborted) {
            console.log('Request was aborted, stopping part processing');
            return;
          }
          
          console.log('Processing part:', {
            type: part.type,
            fieldname: part.fieldname,
            filename: part.filename,
            mimetype: part.mimetype
          });
          
          if (part.type === 'file' && part.fieldname === 'avatar') {
            console.log('Found avatar file, starting immediate processing...');
            // Validate file type
            const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
            if (!allowedTypes.includes(part.mimetype)) {
              return reply.status(400).send({ error: 'Invalid file type. Use JPEG, PNG, GIF, or WebP' });
            }
            
            // Immediately process the file to avoid connection reset
            try {
              const uploadPath = path.join(__dirname, '..', 'uploads', `${userId}_${part.filename}`);
              console.log(`Uploading file to: ${uploadPath} (mimetype: ${part.mimetype})`);
              
              // Create write stream with specific options
              const writeStream = fs.createWriteStream(uploadPath, {
                flags: 'w',
                highWaterMark: 64 * 1024 // 64KB chunks
              });
              
              // Handle stream events
              writeStream.on('error', (error) => {
                console.error('Write stream error:', error);
              });
              
              writeStream.on('finish', () => {
                console.log('Write stream finished');
              });
              
              console.log('Starting file pipeline...');
              await pipeline(part.file, writeStream);
              avatarFile = { filename: part.filename, path: uploadPath };
              console.log('File upload completed successfully');
            } catch (uploadError) {
              console.error('File upload error:', uploadError);
              console.error('Upload error details:', {
                code: uploadError.code,
                message: uploadError.message,
                stack: uploadError.stack
              });
              if (!isAborted) {
                return reply.status(500).send({ error: 'Failed to upload avatar. Please try again.' });
              }
              return;
            }
          } else if (part.type === 'field') {
            const value = part.value ? part.value.trim() : '';
            fields[part.fieldname] = value;
            console.log(`Field ${part.fieldname} = "${value}"`);
          }
        }
        
        console.log('Finished processing parts');
      } catch (parseError) {
        console.error('Multipart parse error:', parseError);
        if (parseError.code === 'ECONNRESET' || isAborted) {
          console.log('Connection was reset or aborted during parsing');
          return;
        }
        return reply.status(400).send({ error: 'Failed to parse form data' });
      }

      const { name, email, password } = fields;
      
      console.log('Profile update request:', {
        fields,
        hasAvatar: !!avatarFile,
        currentName: currentUser.name,
        currentEmail: currentUser.email
      });

    /* --- basic validation --- */
    const hasChanges = (name && name !== currentUser.name) || 
                      (email && email !== currentUser.email) || 
                      password || 
                      avatarFile;
    
    if (!hasChanges) {
      return reply.status(400).send({ error: 'Nothing to update.' });
    }

    if ((name && !email) || (email && !name))
      return reply.status(400).send({ error: 'Name and email are both required.' });

    /* --- uniqueness checks --- */
    if (email) {
      const owner = await User.findByEmail(email);
      if (owner && owner.id !== userId)
        return reply.status(400).send({ error: 'Email already in use.' });
    }
    if (name) {
      const owner = await User.findByName(name);
      if (owner && owner.id !== userId)
        return reply.status(400).send({ error: 'Display name already taken.' });
    }

    /* --- build update payload --- */
    const updatePayload = {};
    if (name)  updatePayload.name  = name;
    if (email) updatePayload.email = email;

    if (password && password.length >= 7) {
      updatePayload.password =
        await require('bcryptjs').hash(password, require('../models/user').SALT_ROUNDS || 8);
    }

    if (avatarFile) {
      // File was already uploaded during multipart parsing
      updatePayload.avatar = `/uploads/${userId}_${avatarFile.filename}`;
    }

    /* --- e-mail change: send confirmation token, defer real change --- */
    let isChangingEmail = false;
    if (updatePayload.email) {
      const crypto  = require('crypto');
      const token   = crypto.randomBytes(32).toString('hex');
      const mailer  = require('../services/emailService');
      const getURL  = require('../utils/getNgrokUrl');

      isChangingEmail =
        currentUser.email.toLowerCase() !== updatePayload.email.toLowerCase();

      if (isChangingEmail) {
        await User.setPendingEmail(userId, updatePayload.email, token);
        const confirmUrl = `${await getURL()}/api/confirm-new-email?token=${token}`;

        await mailer.sendMail({
          to      : updatePayload.email,
          subject : 'Confirm your new email',
          html    : `<p>Please confirm by clicking <a href="${confirmUrl}">here</a>.</p>`
        });

        delete updatePayload.email;        // keep old email until confirmed
      }
    }

    /* ---------- persist users table ---------- */
    if (Object.keys(updatePayload).length) {
      const setClause = Object.keys(updatePayload).map(k => `${k} = ?`).join(', ');
      await new Promise((res, rej) =>
        db.run(
          `UPDATE users SET ${setClause} WHERE id = ?`,
          [...Object.values(updatePayload), userId],
          err => (err ? rej(err) : res())
        )
      );
    }

    /* ---------- if display-name changed, cascade into match_history ----- */
    if (updatePayload.name && oldName !== updatePayload.name) {
      const newName = updatePayload.name;
      await new Promise((resolve, reject) => {
        db.run(
          `
          UPDATE match_history
             SET player1 = CASE WHEN player1 = ? THEN ? ELSE player1 END,
                 player2 = CASE WHEN player2 = ? THEN ? ELSE player2 END,
                 winner  = CASE WHEN winner  = ? THEN ? ELSE winner  END
           WHERE player1 = ? OR player2 = ? OR winner = ?
          `,
          [
            oldName, newName,  // player1
            oldName, newName,  // player2
            oldName, newName,  // winner
            oldName, oldName, oldName
          ],
          err => (err ? reject(err) : resolve())
        );
      });
    }

    /* ---------- respond ---------- */
    const refreshed = await User.findById(userId);
    let message = 'Profile updated.';
    if (isChangingEmail) message += ' Check your new inbox to confirm the change.';
    reply.send({ message, user: refreshed });
    } catch (error) {
      console.error('Profile update error:', error);
      reply.status(500).send({ error: 'Failed to update profile. Please try again.' });
    }
  });

  /* ---------- logout ---------- */
  fastify.post('/logout', { preHandler: auth }, (req, reply) => {
    req.server.onlineUsers.delete(req.user.id);

    /* Clear the JWT cookie */
    reply
      .clearCookie('access_token', { path: '/' })   // <-- added
      .send({ message: 'Logged out successfully.' });
  });

  /* ---------- misc routes ---------- */
  fastify.get('/verify-email',        verifyEmail);
  fastify.get('/confirm-new-email',   confirmEmailUpdate);

  fastify.post('/tournament/start',         tournament.startTournament);
  fastify.post('/tournament/record-winner', tournament.recordWinner);
  fastify.post('/tournament/next-round',    tournament.nextRound);
  fastify.get('/tournament/matches',        tournament.getMatches);
  fastify.post('/tournament/complete',      tournament.completeTournament);
  fastify.get('/tournament/blockchain/:tournamentId', tournament.getTournamentFromBlockchain);
  fastify.get('/blockchain/status',         tournament.getBlockchainStatus);

  fastify.get('/health', async () => ({ status: 'OK' , message: 'API is running' }));
}

module.exports = routes;
