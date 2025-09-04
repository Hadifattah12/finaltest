// utils/tokenUtils.js - Refresh token utilities
const crypto = require('crypto');
const User = require('../models/user');

/**
 * Generate a secure refresh token ID
 */
function generateRefreshTokenId() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Create and store a new refresh token
 */
async function createRefreshToken(userId, deviceInfo = null) {
  const tokenId = generateRefreshTokenId();
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
  
  await User.createRefreshToken(userId, tokenId, expiresAt, deviceInfo);
  
  return {
    tokenId,
    expiresAt
  };
}

/**
 * Generate device info from request
 */
function getDeviceInfo(request) {
  const userAgent = request.headers['user-agent'] || '';
  const ip = request.ip || 'unknown';
  
  // Simple device detection
  let device = 'Unknown';
  if (userAgent.includes('Mobile')) device = 'Mobile';
  else if (userAgent.includes('Chrome')) device = 'Chrome Browser';
  else if (userAgent.includes('Firefox')) device = 'Firefox Browser';
  else if (userAgent.includes('Safari')) device = 'Safari Browser';
  
  return `${device} (${ip})`;
}

/**
 * Set refresh token cookie
 */
function setRefreshTokenCookie(reply, tokenId, expiresAt) {
  reply.setCookie('refresh_token', tokenId, {
    httpOnly: true,
    sameSite: 'strict',
    secure: true,
    path: '/',
    expires: expiresAt
  });
}

/**
 * Set access token cookie
 */
function setAccessTokenCookie(reply, token) {
  reply.setCookie('access_token', token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: true,
    path: '/',
    maxAge: 10 * 60 // 10 minutes
  });
}

/**
 * Clear all auth cookies
 */
function clearAuthCookies(reply) {
  reply
    .clearCookie('access_token', { path: '/' })
    .clearCookie('refresh_token', { path: '/' });
}

module.exports = {
  generateRefreshTokenId,
  createRefreshToken,
  getDeviceInfo,
  setRefreshTokenCookie,
  setAccessTokenCookie,
  clearAuthCookies
};