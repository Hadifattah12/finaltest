// src/pages/profile.ts
import '../styles/profile.css';
import { resolveAvatar } from '../utils/resolveAvatar';
import { apiFetch } from '../utils/api';
import i18next from 'i18next';

// Import Chart.js - you'll need to install this
  import {
  Chart,
  registerables,
  type ChartData,
  type ChartOptions
} from 'chart.js';
/* ------------------------------------------------------------------ */
/* main component                                                     */
/* ------------------------------------------------------------------ */
export async function renderProfile(): Promise<HTMLElement> {
  const raw = localStorage.getItem('user');
  if (!raw) redirectToLogin();
  const user = JSON.parse(raw!);

  const container = document.createElement('div');
  container.className = 'profile-wrapper';
  document.body.className = '';

  container.innerHTML = `
    <button class="back-arrow" onclick="location.hash='#/home'">⬅ ${i18next.t('home')}</button>

    <div class="profile-container">
      <h1 class="profile-title">👤 ${i18next.t('myProfile')}</h1>

      <!-- avatar -->
      <div class="avatar-section">
        <img id="avatarPreview" class="avatar-img" src="${resolveAvatar(user.avatar)}" alt="avatar">
        <input type="file" id="avatarInput" accept="image/*">
      </div>

      <!-- editable info -->
      <div class="info-section">
        <h2>📝 ${i18next.t('updateInfo')}</h2>
        <label>${i18next.t('displayName')}</label>
        <input id="nameInput"  type="text"  value="${user.name}">
        <label>${i18next.t('email')}</label>
        <input id="emailInput" type="email" value="${user.email}" readonly>
        <label>${i18next.t('newPassword')}</label>
        <input id="passwordInput"        type="password" placeholder="${i18next.t('newPassword')}">
        <label>${i18next.t('confirmPassword')}</label>
        <input id="confirmPasswordInput" type="password" placeholder="${i18next.t('confirmPassword')}">
        <button id="saveProfileBtn">💾 ${i18next.t('saveChanges')}</button>
      </div>

      <!-- 2-FA -->
      <div class="twofa-section">
        <h2>🔐 ${i18next.t('twoFA')}</h2>
        <p>${i18next.t('twoFADesc')}</p>
        <button id="toggle2FA"
                data-enabled="${user.is2FAEnabled}"
                class="${user.is2FAEnabled ? 'disable' : 'enable'}">
          ${user.is2FAEnabled ? '❌ '+i18next.t('disable2FA') : '✅ '+i18next.t('enable2FA')}
        </button>
      </div>

      <!-- stats with charts -->
      <div class="stats-section">
        <h3>🏆 ${i18next.t('stats')}</h3>
        <div class="stats-grid">
          <div class="stat-card">
            <h4>Win/Loss Ratio</h4>
            <div class="chart-container">
              <canvas id="winLossChart"></canvas>
            </div>
            <div class="stat-summary">
              <div class="stat-item">
                <span class="stat-label">Total Matches:</span>
                <span id="totalMatches" class="stat-value">--</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">Win Rate:</span>
                <span id="winRate" class="stat-value">--</span>
              </div>
            </div>
          </div>
          
          <div class="stat-card">
            
            <div class="form-legend">
              
            </div>
          </div>
        </div>
      </div>

      <!-- history -->
      <div class="match-history-section">
        <h3>📜 ${i18next.t('matchHistory')}</h3>
        <ul id="matchHistoryList"></ul>
      </div>

      <!-- friends -->
      <div class="friend-section">
        <h3>👥 ${i18next.t('friends')}</h3>
        <ul id="friendList"></ul>
      </div>
      
      <div id="toast"></div>
      
      <!-- add friend -->
      <div class="add-friend-section">
        <h3>➕ ${i18next.t('addFriend')}</h3>
        <input id="searchInput" placeholder="${i18next.t('enterName')}">
        <button id="searchBtn">${i18next.t('search')}</button>
        <ul id="searchResults"></ul>
      </div>

      <!-- incoming requests -->
      <div class="pending-section">
        <h3>🕓 ${i18next.t('pendingRequests')}</h3>
        <ul id="pendingList"></ul>
      </div>
    </div>`;

  /* ---------- avatar preview ---------- */
  const avatarInput = container.querySelector('#avatarInput') as HTMLInputElement;
  const avatarPreview = container.querySelector('#avatarPreview') as HTMLImageElement;
  avatarInput.addEventListener('change', () => {
    const f = avatarInput.files?.[0];
    if (f) avatarPreview.src = URL.createObjectURL(f);
  });

// Register Chart.js components
Chart.register(...registerables);

/* ------------------------------------------------------------------ */
/* helpers                                                            */
/* ------------------------------------------------------------------ */
async function safeJson(res: Response) {
  const txt = await res.text();
  return txt ? JSON.parse(txt) : null;
}

/* Enhanced Toast helper with better error display */
let toastTimer: number | null = null;
function showToast(
  message: string,
  type: 'error' | 'success' | 'info' = 'info',
  duration = 3000
) {
  const el = document.getElementById('toast');
  if (!el) {
    console.warn('Toast container missing');
    alert(message); // Fallback for critical errors
    return;
  }
  el.textContent = message;
  el.className = `toast toast--visible toast--${type}`;
  if (toastTimer) {
    clearTimeout(toastTimer);
    toastTimer = null;
  }
  toastTimer = window.setTimeout(() => {
    el.classList.remove('toast--visible');
  }, duration);
}

function redirectToLogin() {
  showToast('Session expired — please log in again.', 'error', 3500);
  localStorage.removeItem('user');
  setTimeout(() => {
    location.hash = '#/login';
  }, 500);
  throw new Error('401 unauthorised');
}

/* Enhanced API fetch with better error handling */
async function safeFetch(url: string, options?: RequestInit) {
  try {
    console.log(`Making API request to: ${url}`);
    const response = await apiFetch(url, options);
    console.log(`API response status: ${response.status} for ${url}`);
    return response;
  } catch (error) {
    console.error(`Network error for ${url}:`, error);
    showToast(`Network error: Cannot connect to server. Check if your backend is running.`, 'error', 5000);
    throw error;
  }
}

/* ------------------------------------------------------------------ */
/* types                                                              */
/* ------------------------------------------------------------------ */
interface Friend {
  id: number;
  name: string;
  avatar: string;
  online: boolean;
}

interface MatchStats {
  wins: number;
  losses: number;
  totalMatches: number;
  winRate: number;
  recentForm: ('W' | 'L')[];
}

/* ------------------------------------------------------------------ */
/* Chart creation functions                                           */
/* ------------------------------------------------------------------ */
function createWinLossChart(canvas: HTMLCanvasElement, stats: MatchStats) {
  const data: ChartData<'doughnut'> = {
    labels: ['Wins', 'Losses'],
    datasets: [{
      data: [stats.wins, stats.losses],
      backgroundColor: [
        '#10B981', // Green for wins
        '#EF4444'  // Red for losses
      ],
      borderColor: [
        '#059669',
        '#DC2626'
      ],
      borderWidth: 2,
      hoverOffset: 10
    }]
  };

  const options: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          padding: 20,
          font: {
            size: 14,
            weight: 'bold'
          }
        }
      },
      tooltip: {
        callbacks: {
          label: function(context  ) {
            const label = context.label || '';
            const value = context.parsed;
            const percentage = stats.totalMatches > 0 
              ? ((value / stats.totalMatches) * 100).toFixed(1)
              : '0';
            return `${label}: ${value} (${percentage}%)`;
          }
        }
      }
    },
    cutout: '60%'
  };

  return new Chart(canvas, {
    type: 'doughnut',
    data: data,
    options: options
  });
}



/* ------------------------------------------------------------------ */
/* friend-profile popup                                               */
/* ------------------------------------------------------------------ */
function closeExistingFriendModal() {
  const existing = document.querySelector('.modal-overlay');
  if (existing) {
    existing.remove();
    document.body.classList.remove('modal-open');
  }
}

async function showFriendProfile(friend: Friend) {
  // Clean any existing modal first (prevents layout stacking issues)
  closeExistingFriendModal();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = '<p>Loading…</p>';

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  document.body.classList.add('modal-open');

  const escHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      cleanupModal();
    }
  };

  function cleanupModal() {
    document.removeEventListener('keydown', escHandler);
    if (overlay.parentNode) {
      overlay.remove();
    }
    document.body.classList.remove('modal-open');
  }

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      cleanupModal();
    }
  });

  try {
    const r = await safeFetch(`/api/matches/${encodeURIComponent(friend.name)}`);
    if (r.status === 401) return redirectToLogin();
    const matches: any[] = (await safeJson(r)) || [];

    let wins = 0;
    let losses = 0;
    matches.forEach((m) => {
      if (m.winner === friend.name) wins++;
      else if (m.player1 === friend.name || m.player2 === friend.name) losses++;
    });

    const historyHtml = matches
      .slice(0, 10)
      .map((m) => {
        const opponent = m.player1 === friend.name ? m.player2 : m.player1;
        const win = m.winner === friend.name;
        return `<li><strong>${new Date(m.date).toLocaleString()}</strong> vs
                ${opponent} – ${win ? '🏆 Win' : '❌ Loss'} (${m.score1}-${m.score2})</li>`;
      })
      .join('');

    modal.innerHTML = `
      <button class="close-btn" aria-label="Close">×</button>
      <div class="friend-profile">
        <img src="${resolveAvatar(friend.avatar)}" class="avatar-large" alt="avatar">
        <h2 class="friend-heading">${friend.name} ${friend.online ? '🟢' : '🔘'}</h2>
        <p class="friend-stats">Wins <strong>${wins}</strong> | Losses <strong>${losses}</strong></p>
        <h3 class="history-title">Recent Matches</h3>
        <ul class="friend-history">${historyHtml || '<li>No matches yet.</li>'}</ul>
      </div>
    `;

    modal.querySelector('.close-btn')!.addEventListener('click', cleanupModal);
    document.addEventListener('keydown', escHandler);
  } catch (err) {
    console.error('Error loading friend profile:', err);
    modal.innerHTML = `
      <button class="close-btn" aria-label="Close">×</button>
      <p class="error-text">Failed to load profile. Server may be unavailable.</p>`;
    modal.querySelector('.close-btn')!.addEventListener('click', () => {
      closeExistingFriendModal();
    });
  }
}

  /* ---------- save profile ---------- */
  container.querySelector('#saveProfileBtn')!.addEventListener('click', async () => {
    const saveBtn = container.querySelector('#saveProfileBtn') as HTMLButtonElement;
    const originalText = saveBtn.textContent;
    
    try {
      // Show loading state
      saveBtn.disabled = true;
      saveBtn.textContent = '💾 Saving...';
      
      const name = (container.querySelector('#nameInput') as HTMLInputElement).value.trim();
      const pw1 = (container.querySelector('#passwordInput') as HTMLInputElement).value;
      const pw2 = (container.querySelector('#confirmPasswordInput') as HTMLInputElement).value;
      
      if (pw1 && pw1 !== pw2) {
        showToast('Passwords do not match', 'error');
        return;
      }

      // Validate avatar file if provided
      const avatarFile = avatarInput.files?.[0];
      if (avatarFile) {
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (avatarFile.size > maxSize) {
          showToast('Avatar file too large (max 5MB)', 'error');
          return;
        }
        
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedTypes.includes(avatarFile.type)) {
          showToast('Invalid file type. Use JPEG, PNG, GIF, or WebP', 'error');
          return;
        }
      }

      const email = (container.querySelector('#emailInput') as HTMLInputElement).value.trim();
      
      const fd = new FormData();
      fd.append('name', name);
      fd.append('email', email);
      if (pw1) fd.append('password', pw1);
      if (avatarFile) fd.append('avatar', avatarFile);

      console.log('Attempting to save profile with data:', { 
        name, 
        hasPassword: !!pw1, 
        hasAvatar: !!avatarFile,
        avatarSize: avatarFile ? avatarFile.size : 0,
        avatarType: avatarFile ? avatarFile.type : 'none'
      });
      
      // Add a timeout to the fetch request to see if that's the issue
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log('Manual timeout triggered after 90 seconds');
        controller.abort();
      }, 90000); // 90 second timeout
      
      try {
        const r = await safeFetch('/api/profile', { 
          method: 'PATCH', 
          body: fd,
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        if (r.status === 401) return redirectToLogin();
        
        const j = await safeJson(r);
        if (!r.ok) {
          console.error('Profile save failed:', j);
          showToast(j?.error || `Update failed (${r.status})`, 'error', 4000);
          return;
        }

        localStorage.setItem('user', JSON.stringify(j.user));
        showToast('Profile updated successfully!', 'success', 2500);
        setTimeout(() => location.reload(), 600);
        
      } catch (timeoutError: any) {
        clearTimeout(timeoutId);
        if (timeoutError?.name === 'AbortError') {
          console.error('Upload manually aborted');
          showToast('Upload timeout - took longer than 90 seconds', 'error');
          return;
        }
        throw timeoutError;
      }
      
    } catch (error) {
      console.error('Profile save error:', error);
      showToast('Network error: Cannot save profile. Check server connection.', 'error', 5000);
    } finally {
      // Reset button state
      saveBtn.disabled = false;
      saveBtn.textContent = originalText;
    }
  });

  /* ---------- 2-FA toggle ---------- */
  const toggleBtn = container.querySelector('#toggle2FA') as HTMLButtonElement;
  toggleBtn.addEventListener('click', async () => {
    const enabledNow = toggleBtn.dataset.enabled === 'true';
    const originalText = toggleBtn.textContent;

    try {
      toggleBtn.disabled = true;
      toggleBtn.textContent = '🔄 Processing...';

      const r = await safeFetch('/api/profile/2fa', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enable2FA: !enabledNow })
      });
      if (r.status === 401) return redirectToLogin();
      const j = await safeJson(r);
      if (!r.ok) {
        showToast(j?.error || `Error toggling 2FA (${r.status})`, 'error');
        return;
      }

      const stored = JSON.parse(localStorage.getItem('user') || '{}');
      stored.is2FAEnabled = !enabledNow;
      localStorage.setItem('user', JSON.stringify(stored));

      const enabledNew = !enabledNow;
      toggleBtn.dataset.enabled = String(enabledNew);
      toggleBtn.textContent = enabledNew ? '❌ Disable 2FA' : '✅ Enable 2FA';
      toggleBtn.classList.remove('enable', 'disable');
      toggleBtn.classList.add(enabledNew ? 'disable' : 'enable');
      showToast(enabledNew ? '2FA enabled' : '2FA disabled', 'info');
    } catch (error) {
      console.error('2FA toggle error:', error);
      showToast('Network error: Cannot toggle 2FA. Check server connection.', 'error', 5000);
    } finally {
      toggleBtn.disabled = false;
      if (toggleBtn.textContent === '🔄 Processing...') {
        toggleBtn.textContent = originalText;
      }
    }
  });

  /* ---------- loaders ---------- */
  async function loadFriends() {
    try {
      const r = await safeFetch('/api/friends');
      if (r.status === 401) return redirectToLogin();
      const arr: any[] = (await safeJson(r)) || [];
      if (!Array.isArray(arr)) return;

      const list = container.querySelector('#friendList');
      if (!list) {
        console.warn('Friend list element not found');
        return;
      }
      list.innerHTML = '';
      arr.forEach((fr) => {
        const li = document.createElement('li');
        li.innerHTML = `
          <img src="${resolveAvatar(fr.avatar)}" class="avatar-mini" alt="">
          <span class="friend-name">${fr.name}</span>
          <span class="online-indicator">${fr.online ? '🟢' : '🔘'}</span>
          <button class="remove-friend-btn" data-id="${fr.id}">❌ Remove</button>
        `;
        list.appendChild(li);

        li.querySelector('.friend-name')!
          .addEventListener('click', () => showFriendProfile(fr as Friend));

        li.querySelector('.remove-friend-btn')!
          .addEventListener('click', async (ev) => {
            ev.stopPropagation();
            try {
              const r2 = await safeFetch(`/api/friends/${fr.id}`, { method: 'DELETE' });
              if (r2.status === 401) return redirectToLogin();
              loadFriends();
              loadPendingRequests();
              showToast('Friend removed', 'info', 1800);
            } catch (error) {
              console.error('Remove friend error:', error);
              showToast('Failed to remove friend. Check server connection.', 'error');
            }
          });
      });
    } catch (error) {
      console.error('Load friends error:', error);
      const list = container.querySelector('#friendList');
      if (list) {
        list.innerHTML = '<li>Failed to load friends. Server may be unavailable.</li>';
      }
    }
  }

  async function loadPendingRequests() {
    try {
      const r = await safeFetch('/api/friends/requests');
      if (r.status === 401) return redirectToLogin();
      const arr: any[] = (await safeJson(r)) || [];
      if (!Array.isArray(arr)) return;

      const list = container.querySelector('#pendingList');
      if (!list) {
        console.warn('Pending list element not found');
        return;
      }
      list.innerHTML = '';
      arr.forEach((rq) => {
        const li = document.createElement('li');
        li.innerHTML = `
          <img src="${resolveAvatar(rq.avatar)}" class="avatar-mini" alt="">
          <span class="friend-name">${rq.name}</span>
          <button class="approve-btn" data-id="${rq.id}">✅</button>
          <button class="reject-btn"  data-id="${rq.id}">❌</button>
        `;
        list.appendChild(li);

        li.querySelector('.approve-btn')!
          .addEventListener('click', async () => {
            try {
              const r2 = await safeFetch(`/api/friends/approve/${rq.id}`, { method: 'PATCH' });
              if (r2.status === 401) return redirectToLogin();
              loadPendingRequests();
              loadFriends();
              showToast('Friend request approved', 'success', 1800);
            } catch (error) {
              console.error('Approve friend error:', error);
              showToast('Failed to approve friend request.', 'error');
            }
          });

        li.querySelector('.reject-btn')!
          .addEventListener('click', async () => {
            try {
              const r2 = await safeFetch(`/api/friends/reject/${rq.id}`, { method: 'PATCH' });
              if (r2.status === 401) return redirectToLogin();
              loadPendingRequests();
              showToast('Request rejected', 'info', 1600);
            } catch (error) {
              console.error('Reject friend error:', error);
              showToast('Failed to reject friend request.', 'error');
            }
          });
      });
    } catch (error) {
      console.error('Load pending requests error:', error);
      const list = container.querySelector('#pendingList');
      if (list) {
        list.innerHTML = '<li>Failed to load pending requests. Server may be unavailable.</li>';
      }
    }
  }

  async function loadMatchHistory() {
    try {
      const r = await safeFetch(`/api/matches/${encodeURIComponent(user.name)}`);
      if (r.status === 401) return redirectToLogin();
      const arr: any[] = (await safeJson(r)) || [];
      if (!Array.isArray(arr)) return;

      const list = container.querySelector('#matchHistoryList');
      if (!list) {
        console.warn('Match history list element not found');
        return;
      }
      list.innerHTML = arr.length ? '' : '<li>No match history yet.</li>';
      arr.forEach((m) => {
        const win = m.winner === user.name;
        const opponent = m.player1 === user.name ? m.player2 : m.player1;
        const li = document.createElement('li');
        li.className = win ? 'match-item win' : 'match-item loss';
        li.innerHTML = `<strong>${new Date(m.date).toLocaleString()}</strong> vs
          ${opponent} – ${win ? '🏆 Win' : '❌ Loss'}
          (${m.score1}-${m.score2})`;
        list.appendChild(li);
      });
    } catch (error) {
      console.error('Load match history error:', error);
      const list = container.querySelector('#matchHistoryList');
      if (list) {
        list.innerHTML = '<li>Failed to load match history. Server may be unavailable.</li>';
      }
    }
  }

  // Store chart instances to clean them up when needed
  let winLossChart: Chart | null = null;


  async function calcStats() {
    try {
      const r = await safeFetch(`/api/matches/${encodeURIComponent(user.name)}`);
      if (r.status === 401) return redirectToLogin();
      const arr: any[] = (await safeJson(r)) || [];
      if (!Array.isArray(arr)) return;

      let wins = 0;
      let losses = 0;
      const recentForm: ('W' | 'L')[] = [];
      
      // Process matches to calculate stats
      arr.forEach((m) => {
        const win = m.winner === user.name;
        if (win) {
          wins++;
          recentForm.push('W');
        } else if (m.player1 === user.name || m.player2 === user.name) {
          losses++;
          recentForm.push('L');
        }
      });

      const totalMatches = wins + losses;
      const winRate = totalMatches > 0 ? ((wins / totalMatches) * 100) : 0;

      const stats: MatchStats = {
        wins,
        losses,
        totalMatches,
        winRate,
        recentForm: recentForm.reverse() // Most recent first
      };

      // Update summary displays
      const totalMatchesEl = container.querySelector('#totalMatches') as HTMLElement;
      const winRateEl = container.querySelector('#winRate') as HTMLElement;
      
      if (totalMatchesEl) totalMatchesEl.textContent = String(totalMatches);
      if (winRateEl) winRateEl.textContent = `${winRate.toFixed(1)}%`;

      // Clean up existing charts
      if (winLossChart) {
        winLossChart.destroy();
      }
      
      // Create new charts
      const winLossCanvas = container.querySelector('#winLossChart') as HTMLCanvasElement;
      
      if (winLossCanvas) {
        winLossChart = createWinLossChart(winLossCanvas, stats);
      }
    } catch (error) {
      console.error('Calculate stats error:', error);
      // Set fallback values
      const totalMatchesEl = container.querySelector('#totalMatches') as HTMLElement;
      const winRateEl = container.querySelector('#winRate') as HTMLElement;
      
      if (totalMatchesEl) totalMatchesEl.textContent = 'Error';
      if (winRateEl) winRateEl.textContent = 'Error';
    }
  }

  /* ---------- friend search ---------- */
  const searchBtn = container.querySelector('#searchBtn') as HTMLButtonElement;
  const searchInput = container.querySelector('#searchInput') as HTMLInputElement;
  const resultList = container.querySelector('#searchResults') as HTMLUListElement;

  if (searchBtn && searchInput && resultList) {
    searchBtn.addEventListener('click', async () => {
      const q = searchInput.value.trim();
      if (!q) return;
      
      const originalText = searchBtn.textContent;
      
      try {
        searchBtn.disabled = true;
        searchBtn.textContent = '🔍 Searching...';
        
        const r = await safeFetch(`/api/friends/search?name=${encodeURIComponent(q)}`);
        if (r.status === 401) return redirectToLogin();
        const arr: any[] = (await safeJson(r)) || [];
        if (!Array.isArray(arr)) return;

        resultList.innerHTML = '';
        if (arr.length === 0) {
          resultList.innerHTML = '<li>No users found.</li>';
          return;
        }
        
        arr.forEach((u) => {
          const li = document.createElement('li');
          let badge = '';
          switch (u.friendship_status) {
            case 'friends':
              badge = '<span class="status-badge friends">✅ Friends</span>';
              break;
            case 'pending_sent':
              badge = '<span class="status-badge pending">⏳ Request Sent</span>';
              break;
            case 'pending_received':
              badge = '<span class="status-badge pending">📩 Pending Response</span>';
              break;
            default:
              badge = `<button class="add-friend-btn" data-id="${u.id}">Add Friend</button>`;
          }
          li.innerHTML = `<img src="${resolveAvatar(u.avatar)}" class="avatar-mini" alt="">
                          <span class="friend-name">${u.name}</span> ${badge}`;
          resultList.appendChild(li);

          li.querySelector('.add-friend-btn')?.addEventListener('click', async () => {
            try {
              const r2 = await safeFetch(`/api/friends/${u.id}`, { method: 'POST' });
              if (r2.status === 401) return redirectToLogin();
              searchBtn.click();
              loadPendingRequests();
              showToast('Friend request sent', 'success', 2000);
            } catch (error) {
              console.error('Add friend error:', error);
              showToast('Failed to send friend request.', 'error');
            }
          });
        });
      } catch (error) {
        console.error('Friend search error:', error);
        resultList.innerHTML = '<li>Search failed. Server may be unavailable.</li>';
      } finally {
        searchBtn.disabled = false;
        searchBtn.textContent = originalText;
      }
    });

    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') searchBtn.click();
    });
  }

  /* ---------- initial parallel loads ---------- */
  try {
    await Promise.all([loadFriends(), loadPendingRequests(), loadMatchHistory()]);
    setTimeout(calcStats, 100); // Small delay to ensure DOM is ready
  } catch (error) {
    console.error('Initial load error:', error);
    showToast('Some profile data failed to load. Server may be unavailable.', 'error', 4000);
  }

  return container;
}