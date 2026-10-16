document.documentElement.classList.add("js");

const LUMINANCE_BASE = [
    [16, 11, 10, 16, 24, 40, 51, 61], [12, 12, 14, 19, 26, 58, 60, 55],
    [14, 13, 16, 24, 40, 57, 69, 56], [14, 17, 22, 29, 51, 87, 80, 62],
    [18, 22, 37, 56, 68, 109, 103, 77], [24, 35, 55, 64, 81, 104, 113, 92],
    [49, 64, 78, 87, 103, 121, 120, 101], [72, 92, 95, 98, 112, 100, 103, 99]
];
const CHROMINANCE_BASE = [
    [17, 18, 24, 47, 99, 99, 99, 99], [18, 21, 26, 66, 99, 99, 99, 99],
    [24, 26, 56, 99, 99, 99, 99, 99], [47, 66, 99, 99, 99, 99, 99, 99],
    [99, 99, 99, 99, 99, 99, 99, 99], [99, 99, 99, 99, 99, 99, 99, 99],
    [99, 99, 99, 99, 99, 99, 99, 99], [99, 99, 99, 99, 99, 99, 99, 99]
];
const state = { quality: 75, preset: "landscape", originalData: null, previousTables: [null, null], width: 480, height: 320 };
const isEnglish = document.documentElement.lang === "en";
const presetLabels = isEnglish
    ? { landscape: "Landscape", portrait: "Portrait", texture: "Checker / text" }
    : { landscape: "Пейзаж", portrait: "Портрет", texture: "Шахматная / текст" };
const elements = {
    quality: document.querySelector("#quality-slider"), qualityValue: document.querySelector("#quality-value"),
    luminanceBody: document.querySelector("#luminance-table tbody"), chrominanceBody: document.querySelector("#chrominance-table tbody"),
    dctCanvas: document.querySelector("#dct-canvas"), quantizationCanvas: document.querySelector("#quantization-canvas"),
    originalCanvas: document.querySelector("#original-canvas"), resultCanvas: document.querySelector("#result-canvas"),
    colorOriginalCanvas: document.querySelector("#color-original-canvas"), channelPreview: document.querySelector("#channel-preview"),
    yCanvas: document.querySelector("#y-canvas"), cbCanvas: document.querySelector("#cb-canvas"), crCanvas: document.querySelector("#cr-canvas"),
    fileSize: document.querySelector("#file-size"), psnr: document.querySelector("#psnr"), mse: document.querySelector("#mse"), metricsStatus: document.querySelector("#metrics-status")
};

function clamp(value) { return Math.max(0, Math.min(255, value)); }
function scaledTable(baseTable, quality) {
    const scale = quality < 50 ? 5000 / quality : 200 - quality * 2;
    return baseTable.map(row => row.map(value => Math.max(1, Math.min(255, Math.round((value * scale + 50) / 100)))));
}
function renderTable(body, values, previous) {
    body.replaceChildren();
    values.forEach((row, y) => {
        const tableRow = document.createElement("tr");
        row.forEach((value, x) => {
            const cell = document.createElement("td");
            cell.textContent = String(value);
            if (previous && previous[y][x] !== value) cell.className = "changed";
            tableRow.appendChild(cell);
        });
        body.appendChild(tableRow);
    });
}
function drawDctBasis() {
    const context = elements.dctCanvas.getContext("2d");
    const size = elements.dctCanvas.width / 8;
    for (let v = 0; v < 8; v += 1) for (let u = 0; u < 8; u += 1) {
        const offsetX = u * size, offsetY = v * size, cellSize = size / 8;
        for (let y = 0; y < 8; y += 1) for (let x = 0; x < 8; x += 1) {
            const value = Math.round(127.5 + 127.5 * Math.cos(((2 * x + 1) * u * Math.PI) / 16) * Math.cos(((2 * y + 1) * v * Math.PI) / 16));
            context.fillStyle = `rgb(${value},${value},${value})`;
            context.fillRect(offsetX + x * cellSize, offsetY + y * cellSize, cellSize, cellSize);
        }
        context.strokeStyle = "#aaa49b";
        context.strokeRect(offsetX + .5, offsetY + .5, size - 1, size - 1);
    }
}
function createOriginalImage() {
    // Создаем временный холст для рисования
    const canvas = document.createElement("canvas");
    canvas.width = state.width;
    canvas.height = state.height;
    const ctx = canvas.getContext("2d");

    if (state.preset === "landscape") {
        // Пейзаж: Небо, земля и солнце (плавные градиенты, отлично сжимаются)
        const grad = ctx.createLinearGradient(0, 0, 0, state.height);
        grad.addColorStop(0, "#4a90e2");   // синее небо
        grad.addColorStop(0.5, "#87ceeb"); // светлый горизонт
        grad.addColorStop(0.5, "#556b2f"); // темная трава вдалеке
        grad.addColorStop(1, "#228b22");   // зеленая трава
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, state.width, state.height);
        
        ctx.fillStyle = "#fff0a8";
        ctx.beginPath();
        ctx.arc(80, 80, 35, 0, Math.PI * 2);
        ctx.fill();
    } else if (state.preset === "portrait") {
        // Портрет: мягкий круг в центре (имитация лица)
        ctx.fillStyle = "#e0e4e8";
        ctx.fillRect(0, 0, state.width, state.height);
        
        const grad = ctx.createRadialGradient(state.width/2, state.height/2, 10, state.width/2, state.height/2, 120);
        grad.addColorStop(0, "#ffb6c1");
        grad.addColorStop(1, "#c71585");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(state.width/2, state.height/2, 110, 0, Math.PI * 2);
        ctx.fill();
    } else {
        // Текстура / Шахматка: резкие контрасты (покажут артефакты и ringing-эффект)
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, state.width, state.height);
        ctx.fillStyle = "#252525";
        
        for (let y = 0; y < state.height; y += 40) {
            for (let x = 0; x < state.width; x += 40) {
                if ((x / 40 + Math.floor(y / 40)) % 2 === 0) {
                    ctx.fillRect(x, y, 40, 40);
                }
            }
        }
        // Резкий красный текст
        ctx.fillStyle = "#e63946";
        ctx.font = "bold 110px 'Courier New', monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("JPEG", state.width/2, state.height/2);
    }

    // Извлекаем пиксели и отдаем логике
    const imageData = ctx.getImageData(0, 0, state.width, state.height);
    state.originalData = imageData;
    elements.originalCanvas.getContext("2d").putImageData(imageData, 0, 0);
    elements.colorOriginalCanvas.getContext("2d").putImageData(imageData, 0, 0);
    drawChannels();
}
function drawChannels() {
    const channels = [elements.yCanvas, elements.cbCanvas, elements.crCanvas];
    const channelImage = channels.map(canvas => new ImageData(state.width, state.height));
    for (let i = 0; i < state.originalData.data.length; i += 4) {
        const r = state.originalData.data[i], g = state.originalData.data[i + 1], b = state.originalData.data[i + 2];
        const y = clamp(.299 * r + .587 * g + .114 * b), cb = clamp(128 - .169 * r - .331 * g + .5 * b), cr = clamp(128 + .5 * r - .419 * g - .081 * b);
        [y, cb, cr].forEach((value, index) => {
            const data = channelImage[index].data;
            data[i] = index === 0 ? value : value; data[i + 1] = index === 0 ? value : value; data[i + 2] = index === 0 ? value : value; data[i + 3] = 255;
        });
    }
    channels.forEach((canvas, index) => {
        const preview = document.createElement("canvas"); preview.width = state.width; preview.height = state.height;
        preview.getContext("2d").putImageData(channelImage[index], 0, 0);
        canvas.getContext("2d").drawImage(preview, 0, 0, canvas.width, canvas.height);
    });
}
function reconstructImage() {
    const result = new ImageData(state.width, state.height);
    const severity = (100 - state.quality) / 100;
    for (let y = 0; y < state.height; y += 1) for (let x = 0; x < state.width; x += 1) {
        const index = (y * state.width + x) * 4, edge = Math.min(x % 8, y % 8, 7 - x % 8, 7 - y % 8);
        const noise = Math.sin(x * .55 + y * .31) * severity * 13, blockShift = edge === 0 ? severity * 7 : 0;
        for (let channel = 0; channel < 3; channel += 1) {
            const original = state.originalData.data[index + channel], step = 1 + severity * 3;
            result.data[index + channel] = clamp(Math.round((original + noise + blockShift) / step) * step);
        }
        result.data[index + 3] = 255;
    }
    return result;
}
function drawQuantizationPreview(data) {
    const canvas = elements.quantizationCanvas, context = canvas.getContext("2d");
    const preview = document.createElement("canvas"); preview.width = state.width; preview.height = state.height;
    preview.getContext("2d").putImageData(data, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height); context.imageSmoothingEnabled = false; context.drawImage(preview, 0, 0, canvas.width, canvas.height);
    const scaleX = canvas.width / state.width, scaleY = canvas.height / state.height;
    context.strokeStyle = `rgba(255,255,255,${.15 + (100 - state.quality) / 180})`; context.lineWidth = Math.max(1, scaleX / 8);
    for (let x = 8; x < state.width; x += 8) { context.beginPath(); context.moveTo(x * scaleX, 0); context.lineTo(x * scaleX, canvas.height); context.stroke(); }
    for (let y = 8; y < state.height; y += 8) { context.beginPath(); context.moveTo(0, y * scaleY); context.lineTo(canvas.width, y * scaleY); context.stroke(); }
}
function calculateMetrics(result) {
    let squaredError = 0;
    for (let i = 0; i < state.originalData.data.length; i += 4) for (let channel = 0; channel < 3; channel += 1) {
        const difference = state.originalData.data[i + channel] - result.data[i + channel]; squaredError += difference * difference;
    }
    const mse = squaredError / (state.width * state.height * 3), psnr = mse === 0 ? Infinity : 10 * Math.log10(255 ** 2 / mse);
    return { mse, psnr, estimatedBytes: Math.round(state.width * state.height * (.08 + state.quality / 850)) };
}
function updateVisualization() {
    state.quality = Number(elements.quality.value);
    elements.qualityValue.textContent = String(state.quality); elements.quality.setAttribute("aria-valuenow", String(state.quality));
    const tables = [scaledTable(LUMINANCE_BASE, state.quality), scaledTable(CHROMINANCE_BASE, state.quality)];
    renderTable(elements.luminanceBody, tables[0], state.previousTables[0]); renderTable(elements.chrominanceBody, tables[1], state.previousTables[1]); state.previousTables = tables;
    const result = reconstructImage(); elements.resultCanvas.getContext("2d").putImageData(result, 0, 0); drawQuantizationPreview(result);
    const metrics = calculateMetrics(result), fileSize = `${(metrics.estimatedBytes / 1024).toFixed(1)} KB`, psnr = `${metrics.psnr.toFixed(1)} dB`, mse = metrics.mse.toFixed(2);
    elements.fileSize.textContent = fileSize; elements.psnr.textContent = psnr; elements.mse.textContent = mse;
    elements.metricsStatus.textContent = isEnglish
        ? `Quality ${state.quality} percent. File size ${fileSize}; PSNR ${psnr}; MSE ${mse}.`
        : `Качество ${state.quality} процентов. Размер ${fileSize}; PSNR ${psnr}; MSE ${mse}.`;
}
function updatePreset(preset) {
    state.preset = preset;
    document.querySelectorAll(".preset-button").forEach(button => {
        const isActive = button.dataset.preset === preset;
        button.classList.toggle("is-active", isActive);
        button.setAttribute("aria-pressed", String(isActive));
    });
    createOriginalImage(); updateVisualization();
}
function renderPresetControls() {
    document.querySelectorAll(".preset-buttons").forEach(container => {
        container.replaceChildren();
        Object.entries(presetLabels).forEach(([preset, label]) => {
            const button = document.createElement("button");
            button.className = "preset-button";
            button.type = "button";
            button.dataset.preset = preset;
            button.textContent = label;
            button.setAttribute("aria-pressed", String(preset === state.preset));
            button.addEventListener("click", () => updatePreset(preset));
            container.appendChild(button);
        });
    });
}
function setupScrollspy() {
    const links = [...document.querySelectorAll(".toc a")], sections = links.map(link => document.querySelector(link.getAttribute("href")));
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
        if (entry.isIntersecting) links.forEach(link => link.classList.toggle("is-current", link.getAttribute("href") === `#${entry.target.id}`));
    }), { rootMargin: "-20% 0px -65% 0px" });
    sections.filter(Boolean).forEach(section => observer.observe(section));
}
function setupColorPreview() {
    const demo = document.querySelector(".color-space-demo");
    if (!demo) return;
    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            elements.channelPreview.classList.add("is-visible");
            observer.unobserve(entry.target);
        });
    }, { threshold: .2, rootMargin: "0px 0px -10% 0px" });
    observer.observe(demo);
}
function setupRevealOnScroll() {
    const sections = document.querySelectorAll(".article-section");
    const reveal = section => section.classList.add("is-visible");

    if (!("IntersectionObserver" in window)) {
        sections.forEach(reveal);
        return;
    }

    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            reveal(entry.target);
            observer.unobserve(entry.target);
        });
    }, { threshold: .12, rootMargin: "0px 0px -8% 0px" });

    sections.forEach(section => observer.observe(section));
}
function initialize() {
    drawDctBasis(); renderPresetControls(); createOriginalImage(); updateVisualization(); setupScrollspy(); setupColorPreview(); setupRevealOnScroll();
    elements.quality.addEventListener("input", updateVisualization);
    const savedTheme = localStorage.getItem("jpeg-theme");
    const themeToggle = document.querySelector("#theme-toggle");
    if (savedTheme) document.documentElement.dataset.theme = savedTheme;
    const updateThemeLabel = () => {
        const isDark = document.documentElement.dataset.theme === "dark";
        const label = isEnglish
            ? (isDark ? "Enable light theme" : "Enable dark theme")
            : (isDark ? "Включить светлую тему" : "Включить тёмную тему");
        themeToggle.setAttribute("aria-label", label);
        themeToggle.setAttribute("title", label);
    };
    updateThemeLabel();
    themeToggle.addEventListener("click", event => {
        const theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
        document.documentElement.dataset.theme = theme; localStorage.setItem("jpeg-theme", theme);
        updateThemeLabel();
    });
    const menuToggle = document.querySelector("#menu-toggle");
    const toc = document.querySelector(".toc");
    menuToggle.addEventListener("click", () => {
        const isOpen = toc.classList.toggle("is-open");
        menuToggle.classList.toggle("is-open", isOpen);
        menuToggle.setAttribute("aria-expanded", String(isOpen));
    });
    toc.querySelectorAll("a").forEach(link => link.addEventListener("click", () => {
        toc.classList.remove("is-open");
        menuToggle.classList.remove("is-open");
        menuToggle.setAttribute("aria-expanded", "false");
    }));
    const backToTop = document.querySelector("#back-to-top");
    window.addEventListener("scroll", () => backToTop.classList.toggle("is-visible", window.scrollY > 500), { passive: true });
    backToTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
}
initialize();
