// src/pages/home.ts
import '../styles/home.css';
import i18next from 'i18next';
import { apiFetch } from '../utils/api';

export async function renderHome(): Promise<HTMLElement> {
  const container = document.createElement('div');

  const userData = localStorage.getItem('user');
  const user     = userData ? JSON.parse(userData) : null;

  /* ------------------ language setup ------------------ */
  await initializeLanguage();

 container.innerHTML = `
    <div class="home-wrapper">
      <div class="home-container">
        <!-- ─────────────── HEADER ─────────────── -->
        <header class="home-header">
          <h1 class="home-title">${i18next.t('welcome')}</h1>

          <div class="header-right">
            <!-- profile / logout dropdown -->
            <div class="dropdown">
              <button class="dropdown-toggle" id="dropdownToggle">
                <span class="user-icon">${i18next.t('profile')}</span>
              </button>
              <div class="dropdown-menu" id="dropdownMenu" style="display:none;">
                <button class="dropdown-item" id="profileBtn">⚙️ ${i18next.t('profile')}</button>
                <button class="dropdown-item" id="logoutBtn">🚪 ${i18next.t('logout')}</button>
              </div>
            </div>

            <!-- language selector -->
            <select id="langSelect" class="language-selector">
              <option value="en">En</option>
              <option value="fr">Fr</option>
              <option value="ar">Ar</option>
            </select>
          </div>
        </header>

        <!-- greeting -->
        ${user
          ? `<h2 class="welcome-msg">${i18next.t('hello')} <span class="username">${user.name}</span>!</h2>`
          : ''}

        <!-- ─────────────── MAIN CONTENT ─────────────── -->
        <main class="home-main">
          <div class="game-mode-cards">
            <!-- 1 v 1 game -->
            <div class="game-card">
              <h2>🎯 1v1 Game</h2>
              <p>${i18next.t('startMatch')}</p>
              <button class="action-btn" id="playBtn">▶️ ${i18next.t('startMatch')}</button>

              <!-- quick-match form (hidden by default) -->
              <form id="playerForm" class="player-form" style="display:none;">
                <div class="form-group">
                  <label for="player2">${i18next.t('enterSecondPlayer')}</label>
                  <input
                    type="text"
                    id="player2"
                    class="player-input"
                    placeholder="${i18next.t('player2Name')}"
                    required
                  />
                </div>
                <div class="form-buttons">
                  <button type="submit" class="start-game-btn">🎮 ${i18next.t('startGame')}</button>
                  <button type="button" class="cancel-btn" id="cancelBtn">❌ ${i18next.t('cancel')}</button>
                </div>
              </form>
            </div>

            <!-- tournament -->
            <div class="game-card">
              <h2>🏆 ${i18next.t('tournament')}</h2>
              <p>${i18next.t('joinTournament')}</p>
              <button class="action-btn" id="tournamentBtn">🚀 ${i18next.t('tournament')}</button>
            </div>

            <!-- play vs AI -->
            <div class="game-card">
              <h2>🤖 ${i18next.t('playWithAI')}</h2>
              <p>${i18next.t('playWithAI')}</p>
              <button class="action-btn" id="aiBtn">🧠 ${i18next.t('playWithAI')}</button>

              <!-- AI level selector -->
              <form id="aiLevelForm" style="display:none;margin-top:10px;">
                <label style="color:white;">${i18next.t('chooseLevel')}</label>
                <select id="aiLevelSelect" class="player-input">
                  <option value="easy">${i18next.t('easy')}</option>
                  <option value="medium">${i18next.t('medium')}</option>
                  <option value="hard">${i18next.t('hard')}</option>
                </select>
                <button type="submit" class="start-game-btn">🎮 ${i18next.t('startGame')}</button>
              </form>
            </div>

            <!-- remote play -->
            <div class="game-card">
              <h2>🌐 ${i18next.t('remotePlayer')}</h2>
              <p>${i18next.t('startRemote')}</p>
              <button class="action-btn" id="remoteBtn">🔗 ${i18next.t('setupRemote')}</button>
            </div>
          </div>
        </main>
      </div>
    </div>
  `;

  /* ------------------- element refs ------------------- */
  const dropdownToggle = container.querySelector('#dropdownToggle')!;
  const dropdownMenu   = container.querySelector('#dropdownMenu')!;
  const logoutBtn      = container.querySelector('#logoutBtn');
  const profileBtn     = container.querySelector('#profileBtn');
  const playBtn        = container.querySelector('#playBtn');
  const tournamentBtn  = container.querySelector('#tournamentBtn');
  const aiBtn          = container.querySelector('#aiBtn');
  const aiLevelForm    = container.querySelector('#aiLevelForm') as HTMLFormElement;
  const aiLevelSelect  = container.querySelector('#aiLevelSelect') as HTMLSelectElement;
  const form           = container.querySelector('#playerForm') as HTMLFormElement;
  const input          = container.querySelector('#player2') as HTMLInputElement;
  const cancelBtn      = container.querySelector('#cancelBtn');
  const langSelect     = container.querySelector('#langSelect') as HTMLSelectElement;
  const remoteBtn      = container.querySelector('#remoteBtn');

  /* ---------------- language selector ---------------- */
  // Set initial value after language is loaded
  getUserLanguagePreference().then(lang => {
    langSelect.value = lang;
  });
  
  langSelect.addEventListener('change', async (e) => {
    const newLang = (e.target as HTMLSelectElement).value as SupportedLanguage;
    const success = await changeUserLanguage(newLang);
    if (success) {
      // Re-render current page with new language
      reloadCurrentPage();
    } else {
      console.error('Failed to change language');
      // Revert the selector to previous value
      getUserLanguagePreference().then(lang => {
        langSelect.value = lang;
      });
    }
  });

  /* ---------------- dropdown toggle ------------------ */
  dropdownToggle.addEventListener('click', () => {
    const menu = dropdownMenu as HTMLElement;
    menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
  });

  /* ------------------ logout flow -------------------- */
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        await apiFetch('/api/logout', { method: 'POST' });   // cookie cleared server-side
      } catch (err) {
        console.error('Logout API failed:', err);
      }
      localStorage.removeItem('user');      // clear user data
      clearLanguagePreferences();           // reset to browser default
      location.hash = '/login';
    });
  }

  /* ---------------- profile button ------------------- */
  if (profileBtn) profileBtn.addEventListener('click', () => (location.hash = '/profile'));

  /* ---------------- 1v1 quick form ------------------- */
  if (playBtn) {
    playBtn.addEventListener('click', () => {
      form.style.display = 'block';
      input.focus();
    });
  }
  if (cancelBtn) cancelBtn.addEventListener('click', () => { form.style.display = 'none'; input.value = ''; });

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const player2Name = input.value.trim();
      if (player2Name) {
        const gameData = { player1: user?.name || 'Player 1', player2: player2Name };
        localStorage.setItem('gameData', JSON.stringify(gameData));
        location.hash = '/pong';
      }
    });
  }

  /* -------------- tournament / AI / remote ----------- */
  if (tournamentBtn) tournamentBtn.addEventListener('click', () => (location.hash = '/tournament'));

  if (aiBtn && aiLevelForm && aiLevelSelect) {
    aiBtn.addEventListener('click', () => (aiLevelForm.style.display = 'block'));
    aiLevelForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const level = aiLevelSelect.value;
      const player1 = user?.name || 'Player1';
      localStorage.setItem('gameData', JSON.stringify({ player1, player2: 'AI', aiLevel: level }));
      location.hash = '/pong-ai';
    });
  }

  if (remoteBtn) remoteBtn.addEventListener('click', () => (location.hash = '/remote-setup'));

  return container;
}

/* ==================== Language Utility Functions ==================== */

const SUPPORTED_LANGUAGES = ['en', 'fr', 'ar'] as const;
type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

/**
 * Get user's language preference from server
 */
async function getUserLanguagePreference(): Promise<SupportedLanguage> {
  try {
    const response = await apiFetch('/api/profile/language');
    if (response.ok) {
      const data = await response.json();
      return data.language || 'en';
    }
  } catch (error) {
    console.error('Error fetching user language preference:', error);
  }
  return 'en'; // fallback to English
}

/**
 * Update user's language preference on server
 */
async function updateUserLanguagePreference(language: SupportedLanguage): Promise<boolean> {
  try {
    const response = await apiFetch('/api/profile/language', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ language }),
    });

    if (response.ok) {
      return true;
    } else {
      const error = await response.json();
      console.error('Error updating language preference:', error);
      return false;
    }
  } catch (error) {
    console.error('Error updating language preference:', error);
    return false;
  }
}

/**
 * Initialize language based on user preference
 */
async function initializeLanguage(): Promise<SupportedLanguage> {
  const userData = localStorage.getItem('user');
  const user = userData ? JSON.parse(userData) : null;

  let language: SupportedLanguage = 'en';

  if (user) {
    // User is logged in, get their preference from server
    language = await getUserLanguagePreference();
  } else {
    // User is not logged in, use localStorage or browser detection
    const savedLang = localStorage.getItem('lang') as SupportedLanguage;
    if (savedLang && SUPPORTED_LANGUAGES.includes(savedLang)) {
      language = savedLang;
    } else {
      const browserLang = navigator.language.split('-')[0] as SupportedLanguage;
      language = SUPPORTED_LANGUAGES.includes(browserLang) ? browserLang : 'en';
    }
  }

  // Set the language in i18next
  await i18next.changeLanguage(language);
  
  // For non-logged-in users, store in localStorage as fallback
  if (!user) {
    localStorage.setItem('lang', language);
  }

  // Handle RTL languages
  updateDocumentDirection(language);
  return language;
}

/**
 * Change language for current user
 */
async function changeUserLanguage(newLanguage: SupportedLanguage): Promise<boolean> {
  const userData = localStorage.getItem('user');
  const user = userData ? JSON.parse(userData) : null;

  let success = true;

  if (user) {
    // User is logged in, update their preference on server
    success = await updateUserLanguagePreference(newLanguage);
  } else {
    // User is not logged in, just update localStorage
    localStorage.setItem('lang', newLanguage);
  }

  if (success) {
    // Update i18next
    await i18next.changeLanguage(newLanguage);
    updateDocumentDirection(newLanguage);
  }

  return success;
}

/**
 * Update document direction for RTL languages
 */
function updateDocumentDirection(language: SupportedLanguage): void {
  const isRTL = language === 'ar';
  document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
  document.documentElement.lang = language;
}

/**
 * Clear language preferences on logout
 */
function clearLanguagePreferences(): void {
  localStorage.removeItem('lang');
  // Reset to browser default or English
  const browserLang = navigator.language.split('-')[0] as SupportedLanguage;
  const fallbackLang = SUPPORTED_LANGUAGES.includes(browserLang) ? browserLang : 'en';
  
  i18next.changeLanguage(fallbackLang);
  updateDocumentDirection(fallbackLang);
}

/**
 * Reload current page without full browser reload
 */
function reloadCurrentPage(): void {
  // Trigger hashchange event to re-render current route
  const currentHash = window.location.hash;
  window.location.hash = '#/temp-reload';
  setTimeout(() => {
    window.location.hash = currentHash;
  }, 1);
}
