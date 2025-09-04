// models/user.js
const util    = require('util');
const crypto  = require('crypto');
const bcrypt  = require('bcryptjs');
const db      = require('../db/database');

const SALT_ROUNDS = 8;

/* ------------------------------------------------------------------------- */
/* Promisified helpers so we can write async/await without boilerplate       */
/* ------------------------------------------------------------------------- */
const dbGet  = util.promisify(db.get.bind(db));
const dbAll  = util.promisify(db.all.bind(db));
const dbRunP = (sql, params = []) =>
  new Promise((resolve, reject) =>
    db.run(sql, params, function cb(err) {
      if (err) return reject(err);
      resolve(this);               // so `this.lastID` is available
    }));

/* ------------------------------------------------------------------------- */
/* User model                                                                */
/* ------------------------------------------------------------------------- */
class User {
  /* ------------------------------ creation ------------------------------ */

  static async create({
  name,
  email,
  password,
  avatar            = '/uploads/default-avatar.png',
  preferred_language = 'en',
  is_verified       = 0,
  verification_token = null
}) {
  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

  const sql = `
    INSERT INTO users
      (name, email, password, avatar, preferred_language, is_verified, verification_token)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

  const { lastID } = await dbRunP(sql, [
    name.trim(),
    email.trim(),
    hashedPassword,
    avatar,
    preferred_language,
    is_verified,
    verification_token
  ]);

  return { id: lastID, name, email, avatar, preferred_language, is_verified };
}


  static async createGoogleUser({ name, email, google_id, avatar, preferred_language = 'en' }) {
    const dummyPassword = crypto.randomBytes(32).toString('hex');
    const hashedPassword = await bcrypt.hash(dummyPassword, SALT_ROUNDS);

    const sql = `
      INSERT INTO users (name, email, password, google_id, avatar, preferred_language, is_verified)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `;
    const { lastID } = await dbRunP(sql, [name, email, hashedPassword, google_id, avatar, preferred_language]);

    return {
      id: lastID,
      name,
      email,
      google_id,
      avatar,
      preferred_language,
      is_verified: 1,
      is2FAEnabled: 0
    };
  }

  /* ------------------------------ look-ups ------------------------------ */

  static findById(id)             { return dbGet(`SELECT * FROM users WHERE id = ?`, [id]); }
  static findByGoogleId(gId)      { return dbGet(`SELECT * FROM users WHERE google_id = ?`, [gId]); }

  // case-insensitive search helpers
  static findByEmail(email)       { return dbGet(`SELECT * FROM users WHERE LOWER(email) = LOWER(?)`, [email]); }
  static findByName(name)         { return dbGet(`SELECT * FROM users WHERE LOWER(name)  = LOWER(?)`, [name]); }

  static findByVerificationToken(tkn) {
    return dbGet(`SELECT * FROM users WHERE verification_token = ?`, [tkn]);
  }

  static async getAllUsers() {
    return dbAll(`SELECT id, name, email, created_at FROM users`);
  }

  /* ------------------------------ updates ------------------------------ */

  static verifyEmail(id) {
    return dbRunP(`UPDATE users SET is_verified = 1, verification_token = NULL WHERE id = ?`, [id]);
  }

  static store2FACode(id, code, expiry) {
    return dbRunP(
      `UPDATE users SET twofa_code = ?, twofa_expiry = ? WHERE id = ?`,
      [code, expiry.toISOString(), id]
    );
  }

  static clear2FACode(id) {
    return dbRunP(`UPDATE users SET twofa_code = NULL, twofa_expiry = NULL WHERE id = ?`, [id]);
  }

  static verify2FACode(id, code) {
    return dbGet(
      `SELECT twofa_code, twofa_expiry FROM users WHERE id = ?`,
      [id]
    ).then(row => {
      if (!row || !row.twofa_code || !row.twofa_expiry) return false;
      return row.twofa_code === code && new Date() <= new Date(row.twofa_expiry);
    });
  }

  static update2FAStatus(id, status) {
    return dbRunP(`UPDATE users SET is2FAEnabled = ? WHERE id = ?`, [status, id]);
  }

  static updateGoogleId(id, googleId) {
    return dbRunP(`UPDATE users SET google_id = ? WHERE id = ?`, [googleId, id]);
  }

  /* --------------------------- email change flow --------------------------- */

  static setPendingEmail(id, newEmail, token) {
    return dbRunP(
      `UPDATE users SET pending_email = ?, email_update_token = ? WHERE id = ?`,
      [newEmail, token, id]
    );
  }

  static async confirmNewEmail(token) {
    const row = await dbGet(
      `SELECT id, pending_email FROM users WHERE email_update_token = ?`,
      [token]
    );
    if (!row) throw new Error('Invalid or expired token');

    await dbRunP(
      `UPDATE users SET email = ?, pending_email = NULL, email_update_token = NULL WHERE id = ?`,
      [row.pending_email, row.id]
    );
    return true;
  }

  /* --------------------------- language preferences --------------------------- */

  static updateLanguagePreference(id, language) {
    // Validate language is supported
    const supportedLanguages = ['en', 'fr', 'ar'];
    if (!supportedLanguages.includes(language)) {
      throw new Error('Unsupported language');
    }
    
    return dbRunP(
      `UPDATE users SET preferred_language = ? WHERE id = ?`,
      [language, id]
    );
  }

  static async getLanguagePreference(id) {
    const row = await dbGet(
      `SELECT preferred_language FROM users WHERE id = ?`,
      [id]
    );
    return row ? row.preferred_language : 'en';
  }

  /* --------------------------- refresh token management --------------------------- */

  static async createRefreshToken(userId, tokenId, expiresAt, deviceInfo = null) {
    return dbRunP(
      `INSERT INTO refresh_tokens (user_id, token_id, expires_at, device_info)
       VALUES (?, ?, ?, ?)`,
      [userId, tokenId, expiresAt.toISOString(), deviceInfo]
    );
  }

  static async findRefreshToken(tokenId) {
    return dbGet(
      `SELECT rt.*, u.id as user_id, u.name, u.email, u.avatar, u.is2FAEnabled 
       FROM refresh_tokens rt
       JOIN users u ON rt.user_id = u.id
       WHERE rt.token_id = ? AND rt.is_revoked = 0 AND rt.expires_at > datetime('now')`,
      [tokenId]
    );
  }

  static async updateRefreshTokenUsage(tokenId) {
    return dbRunP(
      `UPDATE refresh_tokens SET last_used_at = datetime('now') WHERE token_id = ?`,
      [tokenId]
    );
  }

  static async revokeRefreshToken(tokenId) {
    return dbRunP(
      `UPDATE refresh_tokens SET is_revoked = 1 WHERE token_id = ?`,
      [tokenId]
    );
  }

  static async revokeAllUserRefreshTokens(userId) {
    return dbRunP(
      `UPDATE refresh_tokens SET is_revoked = 1 WHERE user_id = ?`,
      [userId]
    );
  }

  static async cleanupExpiredRefreshTokens() {
    return dbRunP(
      `DELETE FROM refresh_tokens WHERE expires_at < datetime('now') OR is_revoked = 1`
    );
  }

  static async getUserRefreshTokens(userId, limit = 10) {
    return dbAll(
      `SELECT token_id, created_at, last_used_at, device_info, expires_at 
       FROM refresh_tokens 
       WHERE user_id = ? AND is_revoked = 0 
       ORDER BY last_used_at DESC 
       LIMIT ?`,
      [userId, limit]
    );
  }
}

module.exports = User;
