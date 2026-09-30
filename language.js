/* --- Global Multi-Language System (Auto-Detect + 100+ Languages) --- */
const LANGUAGE_STORAGE_KEY = 'transgo-global-language'; 
const LANGUAGE_OPTIONS = [
    ['af', 'Afrikaans'],
    ['sq', 'Albanian'],
    ['am', 'Amharic'],
    ['ar', 'Arabic'],
    ['hy', 'Armenian'],
    ['as', 'Assamese'],
    ['ay', 'Aymara'],
    ['az', 'Azerbaijani'],
    ['bm', 'Bambara'],
    ['eu', 'Basque'],
    ['be', 'Belarusian'],
    ['bn', 'Bengali'],
    ['bho', 'Bhojpuri'],
    ['bs', 'Bosnian'],
    ['bg', 'Bulgarian'],
    ['my', 'Burmese'],
    ['ca', 'Catalan'],
    ['ceb', 'Cebuano'],
    ['ny', 'Chichewa'],
    ['zh', 'Chinese (Mandarin)'],
    ['co', 'Corsican'],
    ['hr', 'Croatian'],
    ['cs', 'Czech'],
    ['da', 'Danish'],
    ['dv', 'Divehi'],
    ['doi', 'Dogri'],
    ['nl', 'Dutch'],
    ['en', 'English'],
    ['eo', 'Esperanto'],
    ['et', 'Estonian'],
    ['ee', 'Ewe'],
    ['fi', 'Finnish'],
    ['fr', 'French'],
    ['fy', 'Frisian'],
    ['gl', 'Galician'],
    ['ka', 'Georgian'],
    ['de', 'German'],
    ['el', 'Greek'],
    ['gn', 'Guarani'],
    ['gu', 'Gujarati'],
    ['ht', 'Haitian Creole'],
    ['ha', 'Hausa'],
    ['haw', 'Hawaiian'],
    ['he', 'Hebrew'],
    ['hi', 'Hindi'],
    ['hmn', 'Hmong'],
    ['hu', 'Hungarian'],
    ['is', 'Icelandic'],
    ['ig', 'Igbo'],
    ['ilo', 'Ilocano'],
    ['id', 'Indonesian'],
    ['ga', 'Irish'],
    ['it', 'Italian'],
    ['ja', 'Japanese'],
    ['jw', 'Javanese'],
    ['kn', 'Kannada'],
    ['kk', 'Kazakh'],
    ['km', 'Khmer'],
    ['rw', 'Kinyarwanda'],
    ['gom', 'Konkani'],
    ['ko', 'Korean'],
    ['kri', 'Krio'],
    ['ku', 'Kurdish (Kurmanji)'],
    ['ckb', 'Kurdish (Sorani)'],
    ['ky', 'Kyrgyz'],
    ['lo', 'Lao'],
    ['la', 'Latin'],
    ['lv', 'Latvian'],
    ['ln', 'Lingala'],
    ['lt', 'Lithuanian'],
    ['lg', 'Luganda'],
    ['lb', 'Luxembourgish'],
    ['mk', 'Macedonian'],
    ['mai', 'Maithili'],
    ['mg', 'Malagasy'],
    ['ms', 'Malay'],
    ['ml', 'Malayalam'],
    ['mt', 'Maltese'],
    ['mi', 'Maori'],
    ['mr', 'Marathi'],
    ['mni-Mtei', 'Meiteilon (Manipuri)'],
    ['lus', 'Mizo'],
    ['mn', 'Mongolian'],
    ['ne', 'Nepali'],
    ['no', 'Norwegian'],
    ['or', 'Odia (Oriya)'],
    ['om', 'Oromo'],
    ['ps', 'Pashto'],
    ['fa', 'Persian'],
    ['pl', 'Polish'],
    ['pt', 'Portuguese'],
    ['pa', 'Punjabi'],
    ['qu', 'Quechua'],
    ['ro', 'Romanian'],
    ['ru', 'Russian'],
    ['sm', 'Samoan'],
    ['sa', 'Sanskrit'],
    ['gd', 'Scots Gaelic'],
    ['nso', 'Sepedi'],
    ['sr', 'Serbian'],
    ['st', 'Sesotho'],
    ['sn', 'Shona'],
    ['sd', 'Sindhi'],
    ['si', 'Sinhala'],
    ['sk', 'Slovak'],
    ['sl', 'Slovenian'],
    ['so', 'Somali'],
    ['es', 'Spanish'],
    ['su', 'Sundanese'],
    ['sw', 'Swahili'],
    ['sv', 'Swedish'],
    ['tg', 'Tajik'],
    ['ta', 'Tamil'],
    ['tt', 'Tatar'],
    ['te', 'Telugu'],
    ['th', 'Thai'],
    ['ti', 'Tigrinya'],
    ['ts', 'Tsonga'],
    ['tr', 'Turkish'],
    ['tk', 'Turkmen'],
    ['ak', 'Twi'],
    ['uk', 'Ukrainian'],
    ['ur', 'Urdu'],
    ['ug', 'Uyghur'],
    ['uz', 'Uzbek'],
    ['vi', 'Vietnamese'],
    ['cy', 'Welsh'],
    ['xh', 'Xhosa'],
    ['yi', 'Yiddish'],
    ['yo', 'Yoruba'],
    ['zu', 'Zulu']
];

const translationCache = new Map();
const ignoredTags = new Set(['SCRIPT', 'STYLE', 'SELECT', 'OPTION', 'NOSCRIPT', 'TEXTAREA', 'CODE', 'PRE']);

// Automatically detect the user's phone/browser language code
function getBrowserDefaultLanguage() {
    try {
        const rawLang = navigator.language || navigator.userLanguage || 'en';
        const primaryCode = rawLang.split('-')[0].toLowerCase();
        
        // Check if the detected language is supported in our list
        const isSupported = LANGUAGE_OPTIONS.some(([code]) => code === primaryCode);
        return isSupported ? primaryCode : 'en';
    } catch (e) {
        return 'en';
    }
}

// Comprehensive node scanner capturing everything except names and control structures
function getAllTranslatableNodes() {
    const items = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
            const parent = node.parentElement;
            if (!parent) return NodeFilter.FILTER_REJECT;
            if (ignoredTags.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
            
            if (
                parent.closest('.language-control') || 
                parent.closest('[data-no-translate]') || 
                parent.classList.contains('user-name') || 
                parent.classList.contains('client-name') ||
                parent.classList.contains('recipient-name') ||
                parent.classList.contains('sender-name') ||
                parent.classList.contains('owner-name')
            ) {
                return NodeFilter.FILTER_REJECT;
            }
            
            const rawText = node.nodeValue ? node.nodeValue.trim() : '';
            if (rawText.length === 0 || rawText.length > 4000) return NodeFilter.FILTER_REJECT;
            
            if (/^[\d\s\p{P}#\-]+$/u.test(rawText) && !['pending', 'delivered', 'in transit', 'processing'].includes(rawText.toLowerCase())) {
                return NodeFilter.FILTER_REJECT;
            }
            
            return NodeFilter.FILTER_ACCEPT;
        }
    });

    let node;
    while ((node = walker.nextNode())) {
        const currentTrimmed = node.nodeValue.trim();
        
        if (!node._originalText || (node._lastTranslated && node._lastTranslated === currentTrimmed && node._originalText !== currentTrimmed)) {
            if (!node._originalText) {
                node._originalText = currentTrimmed;
            }
        }

        items.push({
            type: 'text',
            target: node,
            original: node._originalText || currentTrimmed
        });
    }

    document.querySelectorAll('input[placeholder], textarea[placeholder]').forEach(el => {
        if (el.closest('[data-no-translate]')) return;
        
        const placeholderText = el.placeholder ? el.placeholder.trim() : '';
        if (placeholderText) {
            if (!el._originalPlaceholder) {
                el._originalPlaceholder = placeholderText;
            }
            items.push({
                type: 'placeholder',
                target: el,
                original: el._originalPlaceholder
            });
        }
    });

    return items;
}

async function translateBatch(texts, language) {
    const results = [];
    const missingTexts = [];
    const missingIndices = [];

    texts.forEach((text, index) => {
        const cacheKey = `${language}:${text}`;
        if (translationCache.has(cacheKey)) {
            results[index] = translationCache.get(cacheKey);
        } else {
            const stored = localStorage.getItem(`transgo-translation:${cacheKey}`);
            if (stored) {
                translationCache.set(cacheKey, stored);
                results[index] = stored;
            } else {
                missingTexts.push(text);
                missingIndices.push(index);
            }
        }
    });

    if (missingTexts.length === 0) return results;

    try {
        await Promise.all(missingTexts.map(async (text, i) => {
            const originalIndex = missingIndices[i];
            const cacheKey = `${language}:${text}`;
            try {
                const response = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${language}&dt=t&q=${encodeURIComponent(text)}`, {
                    method: 'GET',
                    mode: 'cors'
                });
                if (response.ok) {
                    const data = await response.json();
                    if (data && data[0] && data[0][0] && data[0][0][0]) {
                        const translated = data[0][0][0];
                        translationCache.set(cacheKey, translated);
                        localStorage.setItem(`transgo-translation:${cacheKey}`, translated);
                        results[originalIndex] = translated;
                        return;
                    }
                }
                results[originalIndex] = text;
            } catch (e) {
                results[originalIndex] = text;
            }
        }));
    } catch (err) {
        missingIndices.forEach(i => { results[i] = texts[i]; });
    }

    return results;
}

let isTranslating = false;

async function translatePage(language) {
    if (!language || isTranslating) return;

    isTranslating = true;
    try {
        const elements = getAllTranslatableNodes();
        if (elements.length === 0) return;

        const uniqueTexts = elements.map(el => el.original);
        
        if (language === 'en') {
            elements.forEach((item) => {
                if (item.type === 'text') {
                    item.target.nodeValue = item.original;
                    item.target._lastTranslated = item.original;
                } else if (item.type === 'placeholder') {
                    item.target.placeholder = item.original;
                }
            });
            return;
        }

        const translatedTexts = await translateBatch(uniqueTexts, language);

        elements.forEach((item, index) => {
            const translated = translatedTexts[index];
            if (!translated) return;

            if (item.type === 'text') {
                item.target.nodeValue = translated;
                item.target._lastTranslated = translated;
            } else if (item.type === 'placeholder') {
                item.target.placeholder = translated;
            }
        });
    } finally {
        isTranslating = false;
    }
}

function initLanguageSystem() {
    const selectors = document.querySelectorAll('#languageSelect, .language-select');
    
    // Check localStorage first, otherwise fallback to the user's browser/phone language
    const savedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY) || getBrowserDefaultLanguage();

    selectors.forEach(selector => {
        if (selector.options.length <= 3) {
            selector.innerHTML = LANGUAGE_OPTIONS.map(([code, label]) => `<option value="${code}">${label}</option>`).join('');
        }
        selector.value = savedLanguage;

        if (!selector.dataset.bound) {
            selector.dataset.bound = 'true';
            selector.addEventListener('change', async () => {
                const selectedLanguage = selector.value;
                localStorage.setItem(LANGUAGE_STORAGE_KEY, selectedLanguage);
                document.documentElement.dataset.language = selectedLanguage;
                
                selectors.forEach(s => { s.value = selectedLanguage; });
                
                await translatePage(selectedLanguage);
            });
        }
    });

    document.documentElement.dataset.language = savedLanguage;
    if (savedLanguage !== 'en') {
        setTimeout(() => translatePage(savedLanguage), 150);
    }

    let mutationTimeout;
    const observer = new MutationObserver((mutations) => {
        const currentLang = localStorage.getItem(LANGUAGE_STORAGE_KEY) || getBrowserDefaultLanguage();
        if (currentLang === 'en') return;

        let shouldTranslate = false;
        for (const mutation of mutations) {
            if (mutation.addedNodes.length > 0 || mutation.type === 'characterData') {
                const targetNode = mutation.target;
                const parent = targetNode.parentElement || targetNode;
                if (parent && parent.closest && (parent.closest('.language-control') || parent.closest('#languageSelect') || parent.closest('.language-select'))) continue;
                
                shouldTranslate = true;
                break;
            }
        }

        if (shouldTranslate) {
            clearTimeout(mutationTimeout);
            mutationTimeout = setTimeout(() => {
                translatePage(currentLang);
            }, 100);
        }
    });

    if (document.body) {
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true
        });
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLanguageSystem);
} else {
    initLanguageSystem();
}

window.translateCurrentPage = () => translatePage(localStorage.getItem(LANGUAGE_STORAGE_KEY) || getBrowserDefaultLanguage());