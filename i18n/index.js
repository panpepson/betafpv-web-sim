// ================================================================
// i18n — lekki moduł tłumaczeń (PL + EN)
// ================================================================

const SUPPORTED_LANGS = ['en', 'pl'];
const DEFAULT_LANG = 'en';
const STORAGE_KEY = 'betafpv_lang';

let currentLang = DEFAULT_LANG;
let translations = {};
let allTranslations = {};
let initialized = false;

// ================================================================
// ŁADOWANIE TŁUMACZEŃ
// ================================================================
async function loadTranslations() {
  const results = await Promise.all(
    SUPPORTED_LANGS.map(lang =>
      fetch(`i18n/${lang}.json`)
        .then(r => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        })
        .then(data => ({ lang, data }))
        .catch(err => {
          console.warn(`⚠️ i18n: nie udało się załadować ${lang}:`, err);
          return { lang, data: null };
        })
    )
  );

  allTranslations = {};
  for (const { lang, data } of results) {
    if (data) allTranslations[lang] = data;
  }

  console.log('🌍 i18n: załadowano języki:', Object.keys(allTranslations));
}

// ================================================================
// WYKRYWANIE JĘZYKA
// ================================================================
function detectLang() {
  // 1. Ścieżka URL (/en lub /pl)
  const path = window.location.pathname.toLowerCase();
  if (path === '/en' || path.endsWith('/en')) {
    console.log('🌍 i18n: język ze ścieżki:', 'en');
    return 'en';
  }
  if (path === '/pl' || path.endsWith('/pl')) {
    console.log('🌍 i18n: język ze ścieżki:', 'pl');
    return 'pl';
  }

  // 2. Query string (?lang=pl lub ?lang=en)
  const urlParams = new URLSearchParams(window.location.search);
  const urlLang = urlParams.get('lang');
  if (urlLang && SUPPORTED_LANGS.includes(urlLang)) {
    console.log('🌍 i18n: język z URL:', urlLang);
    return urlLang;
  }

  // 3. localStorage (wybór użytkownika)
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && SUPPORTED_LANGS.includes(stored)) {
      console.log('🌍 i18n: język z localStorage:', stored);
      return stored;
    }
  } catch (e) {}

  // 4. Język przeglądarki
  const browserLang = (navigator.language || navigator.userLanguage || '').toLowerCase();
  const primary = browserLang.split('-')[0];
  if (SUPPORTED_LANGS.includes(primary)) {
    console.log('🌍 i18n: język przeglądarki:', primary);
    return primary;
  }

  // 5. Domyślny
  console.log('🌍 i18n: język domyślny:', DEFAULT_LANG);
  return DEFAULT_LANG;
}

// ================================================================
// TŁUMACZENIE
// ================================================================
export function t(key, vars = {}) {
  const keys = key.split('.');
  let value = translations;

  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      // Fallback: spróbuj znaleźć w EN
      let fallback = allTranslations[DEFAULT_LANG];
      for (const k2 of keys) {
        if (fallback && typeof fallback === 'object' && k2 in fallback) {
          fallback = fallback[k2];
        } else {
          fallback = null;
          break;
        }
      }
      if (typeof fallback === 'string') {
        console.warn(`⚠️ i18n: brak klucza "${key}" w "${currentLang}" — używam EN`);
        value = fallback;
      } else {
        console.warn(`⚠️ i18n: brak klucza "${key}" w "${currentLang}" i "${DEFAULT_LANG}"`);
        return key;
      }
      break;
    }
  }

  if (typeof value === 'string') {
    for (const [k, v] of Object.entries(vars)) {
      value = value.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
    }
  }

  return value;
}
// ================================================================
// APLIKACJA TŁUMACZEŃ DO DOM
// ================================================================
function applyTranslations() {
  // 1. Meta tagi
  const metaTitle = document.querySelector('title');
  if (metaTitle) metaTitle.textContent = t('meta.title');

  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) metaDesc.setAttribute('content', t('meta.description'));

  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) ogTitle.setAttribute('content', t('meta.title'));

  const ogDesc = document.querySelector('meta[property="og:description"]');
  if (ogDesc) ogDesc.setAttribute('content', t('meta.description'));

  const twTitle = document.querySelector('meta[name="twitter:title"]');
  if (twTitle) twTitle.setAttribute('content', t('meta.title'));

  const twDesc = document.querySelector('meta[name="twitter:description"]');
  if (twDesc) twDesc.setAttribute('content', t('meta.description'));

  // 2. Elementy z data-i18n (textContent)
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const value = t(key);
    if (value) el.textContent = value;
  });

  // 3. Elementy z data-i18n-html (innerHTML)
  document.querySelectorAll('[data-i18n-html]').forEach(el => {
    const key = el.getAttribute('data-i18n-html');
    const value = t(key);
    if (value) el.innerHTML = value;
  });

  // 4. Elementy z data-i18n-placeholder
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    const value = t(key);
    if (value) el.setAttribute('placeholder', value);
  });

  // 5. Atrybut lang na <html>
  document.documentElement.setAttribute('lang', currentLang);

  // 6. Przełącznik języka — pokaż flagę języka, na który można się przełączyć
  const langBtn = document.getElementById('langToggle');
  if (langBtn) {
    langBtn.textContent = currentLang === 'pl' ? '🇬🇧' : '🇵🇱';
    langBtn.title = currentLang === 'pl'
      ? 'Switch to English'
      : 'Zmień na polski';
  }

  console.log('🌍 i18n: zastosowano tłumaczenia dla:', currentLang);
}

// ================================================================
// ZMIANA JĘZYKA
// ================================================================
export function setLang(lang) {
  if (!SUPPORTED_LANGS.includes(lang)) {
    console.warn(`⚠️ i18n: nieobsługiwany język: ${lang}`);
    return;
  }

  currentLang = lang;
  translations = allTranslations[lang] || allTranslations[DEFAULT_LANG];

  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch (e) {}

  applyTranslations();

  // Zaktualizuj URL (bez przeładowania)
  const url = new URL(window.location);
  url.searchParams.set('lang', lang);
  window.history.replaceState({}, '', url);

  // Emituj event dla innych modułów
  window.dispatchEvent(new CustomEvent('langchange', { detail: { lang } }));

  console.log('🌍 i18n: zmieniono język na:', lang);
}

export function getLang() {
  return currentLang;
}

export function toggleLang() {
  const nextLang = currentLang === 'pl' ? 'en' : 'pl';
  setLang(nextLang);
}

// ================================================================
// INICJALIZACJA
// ================================================================
export async function initI18n() {
  if (initialized) {
    console.log('🌍 i18n: już zainicjalizowane, pomijam');
    return;
  }

  await loadTranslations();
  currentLang = detectLang();
  translations = allTranslations[currentLang] || allTranslations[DEFAULT_LANG];

  if (!translations) {
    console.error('❌ i18n: brak tłumaczeń! Sprawdź, czy pliki i18n/en.json i i18n/pl.json istnieją.');
    return;
  }

  applyTranslations();
  initialized = true;
  console.log('🌍 i18n: zainicjalizowano z językiem:', currentLang);
}
