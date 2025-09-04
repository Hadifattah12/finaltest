import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
// import { initReactI18next } from 'react-i18next'; // You won't use this, but required

import en from './locales/en.json';
import fr from './locales/fr.json';
import ar from './locales/ar.json';

i18n
  .use(LanguageDetector)
//   .use(initReactI18next) // still needed even if you're not using React
  .init({
    resources: {
      en: { translation: en },
      fr: { translation: fr },
      ar: { translation: ar }
    },
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    detection: {
      // For logged-in users, we'll manually set the language
      // For non-logged-in users, fallback to localStorage then navigator
      order: ['navigator'],
      caches: [] // We'll handle caching manually per user
    }
  });

export default i18n;
