import jpegJs from 'https://esm.sh/jpeg-js@0.4.4';

let currentImage = null;
let currentQuality = 80;
const supportedLanguages = ['ru', 'en', 'es'];
const savedLanguage = localStorage.getItem('jpeg-explorer-language');
let currentLanguage = supportedLanguages.includes(savedLanguage) ? savedLanguage : 'ru';

const canvasOriginal = document.getElementById('canvas-original');
const canvasCompressed = document.getElementById('canvas-compressed');
const canvasDifference = document.getElementById('canvas-difference');

const ctxOriginal = canvasOriginal.getContext('2d', { willReadFrequently: true });
const ctxCompressed = canvasCompressed.getContext('2d', { willReadFrequently: true });
const ctxDifference = canvasDifference.getContext('2d', { willReadFrequently: true });

const qualitySlider = document.getElementById('quality-slider');
const qualityValue = document.getElementById('quality-value');
const btnPhoto = document.getElementById('btn-photo');
const btnText = document.getElementById('btn-text');
const btnPattern = document.getElementById('btn-pattern');
const imageUpload = document.getElementById('image-upload');
const themeToggle = document.getElementById('theme-toggle');
const languageButton = document.getElementById('language-button');
const languageName = document.getElementById('language-name');
const languageMenu = document.getElementById('language-menu');
const languageFlag = document.getElementById('language-flag');
const languageOptions = [...document.querySelectorAll('.language-option')];

const originalSizeEl = document.getElementById('original-size');
const compressedSizeEl = document.getElementById('compressed-size');
const compressionRatioEl = document.getElementById('compression-ratio');
let originalSourceSize = null;

const imagePresets = {
    photo: 'images/photo.svg',
    text: 'images/text.svg',
    pattern: 'images/pattern.svg'
};

const languageFlags = {
    ru: 'images/flag-ru.svg',
    en: 'images/flag-gb.svg',
    es: 'images/flag-es.svg'
};

const languageNames = {
    ru: 'Русский',
    en: 'English',
    es: 'Español'
};

const translations = {
    ru: {
        title: 'JPEG Compression: What Gets Thrown Away?',
        subtitle: 'Фото уменьшается в 10 раз, а разница почти незаметна. Что именно выбрасывается?',
        themeLabel: 'Переключить тему', lightTheme: 'Включить тёмную тему', darkTheme: 'Включить светлую тему',
        languageLabel: 'Язык', imageLabel: 'Изображение', photo: 'Фото', text: 'Текст',
        pattern: 'Паттерн', upload: 'Загрузить файл', quality: 'Качество',
        original: 'Оригинал:', jpeg: 'JPEG:', compression: 'Сжатие:',
        originalCanvas: 'Оригинал', compressedCanvas: 'После JPEG-сжатия',
        differenceCanvas: 'Разница (усиление ×10)',
        differenceNote: 'Красное = потерянная информация', howItWorks: 'Как это работает',
        explanation1Title: 'JPEG отбрасывает высокочастотные детали',
        explanation1Text: '— мелкие текстуры и резкие границы',
        explanation2Title: 'Карта разницы показывает потери',
        explanation2Text: '— они усилены в 10 раз',
        explanation3Title: 'Ниже качество — меньше файл',
        explanation3Text: ', но заметнее артефакты',
        explanation4Title: 'Фото обычно сжимаются лучше',
        explanation4Text: ', чем текст и повторяющиеся узоры',
        smaller: 'меньше', larger: 'больше',
        loadError: 'Не удалось загрузить изображение. Проверьте файл.'
    },
    en: {
        title: 'JPEG Compression: What Gets Thrown Away?',
        subtitle: 'A photo becomes 10× smaller, but the difference is barely visible. What gets thrown away?',
        themeLabel: 'Toggle theme', lightTheme: 'Enable dark theme', darkTheme: 'Enable light theme',
        languageLabel: 'Language', imageLabel: 'Image', photo: 'Photo', text: 'Text',
        pattern: 'Pattern', upload: 'Upload file', quality: 'Quality',
        original: 'Original:', jpeg: 'JPEG:', compression: 'Compression:',
        originalCanvas: 'Original', compressedCanvas: 'After JPEG compression',
        differenceCanvas: 'Difference (×10 amplified)',
        differenceNote: 'Red = lost information', howItWorks: 'How it works',
        explanation1Title: 'JPEG discards high-frequency details',
        explanation1Text: '— fine textures and sharp edges',
        explanation2Title: 'The difference map shows losses',
        explanation2Text: '— amplified 10× for visibility',
        explanation3Title: 'Lower quality means a smaller file',
        explanation3Text: ', but more visible artifacts',
        explanation4Title: 'Photos usually compress better',
        explanation4Text: ' than text and repeating patterns',
        smaller: 'smaller', larger: 'larger',
        loadError: 'Failed to load the image. Please check the file.'
    },
    es: {
        title: 'Compresión JPEG: ¿qué se descarta?',
        subtitle: 'Una foto se reduce 10 veces, pero la diferencia casi no se nota. ¿Qué se descarta?',
        themeLabel: 'Cambiar tema', lightTheme: 'Activar tema oscuro', darkTheme: 'Activar tema claro',
        languageLabel: 'Idioma', imageLabel: 'Imagen', photo: 'Foto', text: 'Texto',
        pattern: 'Patrón', upload: 'Subir archivo', quality: 'Calidad',
        original: 'Original:', jpeg: 'JPEG:', compression: 'Compresión:',
        originalCanvas: 'Original', compressedCanvas: 'Después de la compresión JPEG',
        differenceCanvas: 'Diferencia (ampliada ×10)',
        differenceNote: 'Rojo = información perdida', howItWorks: 'Cómo funciona',
        explanation1Title: 'JPEG descarta detalles de alta frecuencia',
        explanation1Text: '— texturas finas y bordes nítidos',
        explanation2Title: 'El mapa de diferencias muestra las pérdidas',
        explanation2Text: '— ampliadas 10 veces para que se vean',
        explanation3Title: 'Menor calidad significa un archivo más pequeño',
        explanation3Text: ', pero con más artefactos visibles',
        explanation4Title: 'Las fotos suelen comprimirse mejor',
        explanation4Text: ' que el texto y los patrones repetidos',
        smaller: 'más pequeño', larger: 'más grande',
        loadError: 'No se pudo cargar la imagen. Comprueba el archivo.'
    }
};

function translate(key) {
    return translations[currentLanguage][key];
}

function applyLanguage() {
    document.documentElement.lang = currentLanguage;
    document.title = translate('title');
    document.querySelectorAll('[data-i18n]').forEach(element => {
        element.textContent = translate(element.dataset.i18n);
    });
    languageName.textContent = languageNames[currentLanguage];
    languageFlag.src = languageFlags[currentLanguage];
    languageButton.setAttribute('aria-label', `${translate('languageLabel')}: ${languageNames[currentLanguage]}`);
    languageOptions.forEach(option => {
        option.setAttribute('aria-selected', String(option.dataset.language === currentLanguage));
    });
    qualitySlider.setAttribute('aria-label', translate('quality'));
    canvasOriginal.setAttribute('aria-label', translate('originalCanvas'));
    canvasCompressed.setAttribute('aria-label', translate('compressedCanvas'));
    canvasDifference.setAttribute('aria-label', translate('differenceCanvas'));
    updateThemeLabel(document.body.classList.contains('dark-theme') ? 'dark' : 'light');
    if (currentImage) processImage();
}

function applyTheme(theme) {
    const normalizedTheme = theme === 'dark' ? 'dark' : 'light';
    document.body.classList.toggle('dark-theme', normalizedTheme === 'dark');
    themeToggle.setAttribute('aria-pressed', String(normalizedTheme === 'dark'));
    updateThemeLabel(normalizedTheme);
    localStorage.setItem('jpeg-explorer-theme', normalizedTheme);
}

function updateThemeLabel(theme) {
    const labelKey = theme === 'dark' ? 'darkTheme' : 'lightTheme';
    themeToggle.setAttribute('aria-label', translate(labelKey));
}

window.addEventListener('DOMContentLoaded', () => {
    applyTheme(localStorage.getItem('jpeg-explorer-theme') || 'light');
    applyLanguage();
    setupEventListeners();
    loadImage(imagePresets.photo);
});

function setupEventListeners() {
    qualitySlider.addEventListener('input', (e) => {
        currentQuality = Number.parseInt(e.target.value, 10);
        qualityValue.textContent = currentQuality;
        if (currentImage) {
            processImage();
        }
    });

    themeToggle.addEventListener('click', () => {
        const nextTheme = document.body.classList.contains('dark-theme') ? 'light' : 'dark';
        applyTheme(nextTheme);
    });
    languageButton.addEventListener('click', () => {
        setLanguageMenuOpen(languageMenu.hidden);
    });

    languageOptions.forEach(option => {
        option.addEventListener('click', () => {
            currentLanguage = option.dataset.language;
            localStorage.setItem('jpeg-explorer-language', currentLanguage);
            applyLanguage();
            setLanguageMenuOpen(false);
            languageButton.focus();
        });
    });

    languageButton.addEventListener('keydown', handleLanguageButtonKeydown);
    languageMenu.addEventListener('keydown', handleLanguageMenuKeydown);
    document.addEventListener('click', event => {
        if (!languageMenu.hidden && !event.target.closest('.language-control')) {
            setLanguageMenuOpen(false);
        }
    });

    btnPhoto.addEventListener('click', () => {
        setActiveButton(btnPhoto);
        originalSourceSize = null;
        loadImage(imagePresets.photo);
    });

    btnText.addEventListener('click', () => {
        setActiveButton(btnText);
        originalSourceSize = null;
        loadImage(imagePresets.text);
    });

    btnPattern.addEventListener('click', () => {
        setActiveButton(btnPattern);
        originalSourceSize = null;
        loadImage(imagePresets.pattern);
    });

    imageUpload.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;
        originalSourceSize = file.size;
        setActiveButton(null);
        loadImage(URL.createObjectURL(file), () => URL.revokeObjectURL(file));
    });
}

function setLanguageMenuOpen(isOpen) {
    languageMenu.hidden = !isOpen;
    languageButton.setAttribute('aria-expanded', String(isOpen));
}

function handleLanguageButtonKeydown(event) {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        setLanguageMenuOpen(true);
        languageOptions.find(option => option.dataset.language === currentLanguage)?.focus();
    }
}

function handleLanguageMenuKeydown(event) {
    const currentIndex = languageOptions.indexOf(document.activeElement);
    if (event.key === 'Escape') {
        event.preventDefault();
        setLanguageMenuOpen(false);
        languageButton.focus();
    } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        languageOptions[(currentIndex + 1) % languageOptions.length].focus();
    } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        languageOptions[(currentIndex - 1 + languageOptions.length) % languageOptions.length].focus();
    } else if (event.key === 'Home') {
        event.preventDefault();
        languageOptions[0].focus();
    } else if (event.key === 'End') {
        event.preventDefault();
        languageOptions[languageOptions.length - 1].focus();
    }
}

function setActiveButton(activeBtn) {
    [btnPhoto, btnText, btnPattern].forEach(btn => {
        const isActive = btn === activeBtn;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-pressed', String(isActive));
    });
}

function loadImage(src, onLoaded) {
    const img = new Image();

    img.onload = () => {
        currentImage = img;

        // Set canvas dimensions
        const maxWidth = 400;
        const scale = Math.min(1, maxWidth / img.width);
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));

        [canvasOriginal, canvasCompressed, canvasDifference].forEach(canvas => {
            canvas.width = width;
            canvas.height = height;
        });

        // Draw original image
        ctxOriginal.clearRect(0, 0, width, height);
        ctxOriginal.drawImage(img, 0, 0, width, height);
        if (onLoaded) onLoaded();

        // Process and show compressed version
        processImage();
    };

    img.onerror = () => {
        console.error('Failed to load image:', src);
        alert(translate('loadError'));
    };

    img.src = src;
}

function processImage() {
    if (!currentImage) return;

    const width = canvasOriginal.width;
    const height = canvasOriginal.height;

    // Get original image data
    const originalImageData = ctxOriginal.getImageData(0, 0, width, height);

    // PNG is a stable, lossless baseline for the uncompressed source preview.
    const originalSize = originalSourceSize || dataUrlSize(canvasOriginal.toDataURL('image/png'));

    // Encode to JPEG using jpeg-js
    const jpegData = encodeJPEG(originalImageData, currentQuality);

    // Decode JPEG back to image data
    const compressedImageData = decodeJPEG(jpegData);

    // Draw compressed image
    ctxCompressed.putImageData(compressedImageData, 0, 0);

    // Calculate and draw difference
    const differenceImageData = calculateDifference(originalImageData, compressedImageData);
    ctxDifference.putImageData(differenceImageData, 0, 0);

    // Update stats
    updateStats(originalSize, jpegData.length);
}

function encodeJPEG(imageData, quality) {
    // jpeg-js expects data in a specific format
    const rawImageData = {
        data: imageData.data,
        width: imageData.width,
        height: imageData.height
    };

    const jpegImageData = jpegJs.encode(rawImageData, quality);
    return jpegImageData.data;
}

function decodeJPEG(jpegData) {
    const decoded = jpegJs.decode(jpegData);

    const imageData = new ImageData(
        new Uint8ClampedArray(decoded.data),
        decoded.width,
        decoded.height
    );

    return imageData;
}

function dataUrlSize(dataUrl) {
    const base64 = dataUrl.split(',')[1];
    return Math.floor(base64.length * 0.75);
}

function calculateDifference(originalData, compressedData) {
    const width = originalData.width;
    const height = originalData.height;
    const diffData = new ImageData(width, height);

    const amplification = 10; // Amplify difference by 10x

    for (let i = 0; i < originalData.data.length; i += 4) {
        const rDiff = Math.abs(originalData.data[i] - compressedData.data[i]);
        const gDiff = Math.abs(originalData.data[i + 1] - compressedData.data[i + 1]);
        const bDiff = Math.abs(originalData.data[i + 2] - compressedData.data[i + 2]);

        // Average difference
        const avgDiff = (rDiff + gDiff + bDiff) / 3;

        // Amplify the difference
        const amplified = Math.min(255, avgDiff * amplification);

        // Black means no change; increasing loss shifts from yellow to red.
        diffData.data[i] = amplified;
        diffData.data[i + 1] = Math.max(0, 255 - amplified * 1.5);
        diffData.data[i + 2] = Math.max(0, 80 - amplified / 3);
        diffData.data[i + 3] = 255;
    }

    return diffData;
}

function updateStats(originalSize, compressedSize) {
    const ratio = originalSize / compressedSize;

    originalSizeEl.textContent = formatBytes(originalSize);
    compressedSizeEl.textContent = formatBytes(compressedSize);
    compressionRatioEl.textContent = ratio >= 1
        ? `${ratio.toFixed(1)}× ${translate('smaller')}`
        : `${(1 / ratio).toFixed(1)}× ${translate('larger')}`;
}

function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
