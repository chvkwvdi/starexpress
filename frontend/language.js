const LANGUAGE_STORAGE_KEY = 'star-express-language';
const LANGUAGE_OPTIONS = [
    ['en', 'English'],
    ['uk', 'Ukrainian'],
    ['it', 'Italian'],
    ['de', 'German'],
    ['tl', 'Filipino'],
    ['el', 'Greek'],
    ['fr', 'French'],
    ['es', 'Spanish'],
    ['pt', 'Portuguese'],
    ['ar', 'Arabic'],
    ['zh-CN', 'Chinese'],
    ['ja', 'Japanese'],
    ['ko', 'Korean'],
    ['hi', 'Hindi']
];

const translationCache = new Map();
const ignoredTags = new Set(['SCRIPT', 'STYLE', 'SELECT', 'OPTION', 'NOSCRIPT', 'TEXTAREA']);

function translationNodes() {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let node;
    while ((node = walker.nextNode())) {
        const parent = node.parentElement;
        const value = node.nodeValue.trim();
        if (!parent || !value || ignoredTags.has(parent.tagName) || parent.closest('.language-control')) continue;
        nodes.push(node);
    }
    return nodes;
}

async function translateText(text, language) {
    const key = `${language}:${text}`;
    if (translationCache.has(key)) return translationCache.get(key);
    const stored = localStorage.getItem(`star-express-translation:${key}`);
    if (stored) {
        translationCache.set(key, stored);
        return stored;
    }

    const response = await fetch(`/api/translate?text=${encodeURIComponent(text)}&language=${encodeURIComponent(language)}`);
    if (!response.ok) throw new Error('Translation service unavailable.');
    const result = await response.json();
    const translated = result?.text;
    if (!translated) throw new Error('Translation service returned no text.');
    translationCache.set(key, translated);
    localStorage.setItem(`star-express-translation:${key}`, translated);
    return translated;
}

async function translatePage(language) {
    if (!language || language === 'en') return;
    const nodes = translationNodes();
    const translatable = nodes.filter(node => node.nodeValue.trim().length <= 500);
    await Promise.all(translatable.map(async node => {
        const source = node.nodeValue.trim();
        try {
            const translated = await translateText(source, language);
            node.nodeValue = node.nodeValue.replace(source, translated);
        } catch (error) {
            console.warn('Translation skipped:', error.message);
        }
    }));
}

function setupLanguageSelector() {
    const selector = document.getElementById('languageSelect');
    if (!selector) return;
    selector.innerHTML = LANGUAGE_OPTIONS.map(([code, label]) => `<option value="${code}">${label}</option>`).join('');
    const savedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY) || 'en';
    selector.value = savedLanguage;
    selector.addEventListener('change', () => {
        const selectedLanguage = selector.value;
        localStorage.setItem(LANGUAGE_STORAGE_KEY, selectedLanguage);
        document.documentElement.dataset.language = selectedLanguage;
        window.location.reload();
    });
    document.documentElement.dataset.language = savedLanguage;
    translatePage(savedLanguage);
}

document.addEventListener('DOMContentLoaded', setupLanguageSelector);
window.translateCurrentPage = () => translatePage(localStorage.getItem(LANGUAGE_STORAGE_KEY) || 'en');
