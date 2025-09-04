import './i18n';
import { initRouter } from './router';
import i18next from 'i18next';

// Global language initialization
async function initializeApp() {
  // Initialize language based on user preference or localStorage/browser
  const userData = localStorage.getItem('user');
  const user = userData ? JSON.parse(userData) : null;

  if (user) {
    // User is logged in - language will be set by individual pages
    // This is needed since we need to make API calls to get user preference
  } else {
    // User is not logged in, use localStorage or browser default
    const savedLang = localStorage.getItem('lang');
    if (savedLang && ['en', 'fr', 'ar'].includes(savedLang)) {
      await i18next.changeLanguage(savedLang);
    }
    // Handle RTL
    const isRTL = i18next.language === 'ar';
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    document.documentElement.lang = i18next.language;
  }

  // Start the router
  const app = document.querySelector<HTMLDivElement>('#app');
  if (app) {
    initRouter();
  }
}

// Initialize the app
initializeApp();
