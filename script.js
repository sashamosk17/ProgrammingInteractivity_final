const LUMINANCE_BASE = [
    [16, 11, 10, 16, 24, 40, 51, 61],
    [12, 12, 14, 19, 26, 58, 60, 55],
    [14, 13, 16, 24, 40, 57, 69, 56],
    [14, 17, 22, 29, 51, 87, 80, 62],
    [18, 22, 37, 56, 68, 109, 103, 77],
    [24, 35, 55, 64, 81, 104, 113, 92],
    [49, 64, 78, 87, 103, 121, 120, 101],
    [72, 92, 95, 98, 112, 100, 103, 99]
];

const CHROMINANCE_BASE = [
    [17, 18, 24, 47, 99, 99, 99, 99],
    [18, 21, 26, 66, 99, 99, 99, 99],
    [24, 26, 56, 99, 99, 99, 99, 99],
    [47, 66, 99, 99, 99, 99, 99, 99],
    [99, 99, 99, 99, 99, 99, 99, 99],
    [99, 99, 99, 99, 99, 99, 99, 99],
    [99, 99, 99, 99, 99, 99, 99, 99],
    [99, 99, 99, 99, 99, 99, 99, 99]
];

const state = {
    quality: 75,
    originalData: null,
    width: 480,
    height: 320
};

const elements = {
    quality: document.querySelector('#quality-slider'),
    qualityValue: document.querySelector('#quality-value'),
    luminanceBody: document.querySelector('#luminance-table tbody'),
    chrominanceBody: document.querySelector('#chrominance-table tbody'),
    dctCanvas: document.querySelector('#dct-canvas'),
    quantizationCanvas: document.querySelector('#quantization-canvas'),
    originalCanvas: document.querySelector('#original-canvas'),
    resultCanvas: document.querySelector('#result-canvas'),
    fileSize: document.querySelector('#file-size'),
    psnr: document.querySelector('#psnr'),
    mse: document.querySelector('#mse'),
    metricsStatus: document.querySelector('#metrics-status')
};

function scaledTable(baseTable, quality) {
    const scale = quality < 50
        ? 5000 / quality
        : 200 - quality * 2;
    return baseTable.map(row => row.map(value => Math.max(1, Math.min(255, Math.round((value * scale + 50) / 100)))));
}

function renderTable(body, values) {
    body.replaceChildren();
    values.forEach(row => {
        const tableRow = document.createElement('tr');
        row.forEach(value => {
            const cell = document.createElement('td');
            cell.textContent = String(value);
            tableRow.appendChild(cell);
        });
        body.appendChild(tableRow);
    });
}

function drawDctBasis() {
    const context = elements.dctCanvas.getContext('2d');
    const size = elements.dctCanvas.width / 8;
    for (let v = 0; v < 8; v += 1) {
        for (let u = 0; u < 8; u += 1) {
            const offsetX = u * size;
            const offsetY = v * size;
            const cellSize = size / 8;
            for (let y = 0; y < 8; y += 1) {
                for (let x = 0; x < 8; x += 1) {
                    const value = Math.round(127.5 + 127.5
                        * Math.cos(((2 * x + 1) * u * Math.PI) / 16)
                        * Math.cos(((2 * y + 1) * v * Math.PI) / 16));
                    context.fillStyle = `rgb(${value}, ${value}, ${value})`;
                    context.fillRect(offsetX + x * cellSize, offsetY + y * cellSize, cellSize, cellSize);
                }
            }
            context.strokeStyle = '#b9b3a9';
            context.strokeRect(offsetX + 0.5, offsetY + 0.5, size - 1, size - 1);
        }
    }
}

function createOriginalImage() {
    const canvas = document.createElement('canvas');
    canvas.width = state.width;
    canvas.height = state.height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    const image = context.createImageData(state.width, state.height);
    for (let y = 0; y < state.height; y += 1) {
        for (let x = 0; x < state.width; x += 1) {
            const index = (y * state.width + x) * 4;
            const wave = Math.sin(x / 18) * 12 + Math.sin(y / 13) * 8;
            const circle = ((x - 330) ** 2 + (y - 120) ** 2) < 65 ** 2;
            image.data[index] = Math.max(0, Math.min(255, 48 + x * 0.18 + wave + (circle ? 90 : 0)));
            image.data[index + 1] = Math.max(0, Math.min(255, 75 + y * 0.35 + wave));
            image.data[index + 2] = Math.max(0, Math.min(255, 105 + (state.height - y) * 0.25 + wave + (circle ? 20 : 0)));
            image.data[index + 3] = 255;
        }
    }
    context.putImageData(image, 0, 0);
    state.originalData = image;
    elements.originalCanvas.getContext('2d').putImageData(image, 0, 0);
}

function reconstructImage() {
    const source = state.originalData;
    const result = new ImageData(state.width, state.height);
    const severity = (100 - state.quality) / 100;
    const blockSize = 8;
    for (let y = 0; y < state.height; y += 1) {
        for (let x = 0; x < state.width; x += 1) {
            const index = (y * state.width + x) * 4;
            const blockX = x % blockSize;
            const blockY = y % blockSize;
            const blockEdge = Math.min(blockX, blockY, blockSize - 1 - blockX, blockSize - 1 - blockY);
            const noise = Math.sin(x * 0.55 + y * 0.31) * severity * 13;
            const blockShift = blockEdge === 0 ? severity * 7 : 0;
            for (let channel = 0; channel < 3; channel += 1) {
                const original = source.data[index + channel];
                const quantized = Math.round((original + noise + blockShift) / (1 + severity * 3)) * (1 + severity * 3);
                result.data[index + channel] = Math.max(0, Math.min(255, quantized));
            }
            result.data[index + 3] = 255;
        }
    }
    return result;
}

function drawQuantizationPreview(data) {
    const canvas = elements.quantizationCanvas;
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);
    const scaleX = canvas.width / state.width;
    const scaleY = canvas.height / state.height;
    const preview = document.createElement('canvas');
    preview.width = state.width;
    preview.height = state.height;
    preview.getContext('2d').putImageData(data, 0, 0);
    context.imageSmoothingEnabled = false;
    context.drawImage(preview, 0, 0, canvas.width, canvas.height);
    context.strokeStyle = `rgba(255, 255, 255, ${0.15 + (100 - state.quality) / 180})`;
    context.lineWidth = Math.max(1, scaleX / 8);
    for (let x = 8; x < state.width; x += 8) {
        context.beginPath();
        context.moveTo(x * scaleX, 0);
        context.lineTo(x * scaleX, canvas.height);
        context.stroke();
    }
    for (let y = 8; y < state.height; y += 8) {
        context.beginPath();
        context.moveTo(0, y * scaleY);
        context.lineTo(canvas.width, y * scaleY);
        context.stroke();
    }
}

function calculateMetrics(result) {
    let squaredError = 0;
    for (let index = 0; index < state.originalData.data.length; index += 4) {
        for (let channel = 0; channel < 3; channel += 1) {
            const difference = state.originalData.data[index + channel] - result.data[index + channel];
            squaredError += difference * difference;
        }
    }
    const sampleCount = state.width * state.height * 3;
    const mse = squaredError / sampleCount;
    const psnr = mse === 0 ? Infinity : 10 * Math.log10((255 ** 2) / mse);
    const estimatedBytes = Math.round(state.width * state.height * (0.08 + state.quality / 850));
    return { mse, psnr, estimatedBytes };
}

function updateVisualization() {
    state.quality = Number(elements.quality.value);
    elements.qualityValue.textContent = String(state.quality);
    elements.quality.setAttribute('aria-valuenow', String(state.quality));
    renderTable(elements.luminanceBody, scaledTable(LUMINANCE_BASE, state.quality));
    renderTable(elements.chrominanceBody, scaledTable(CHROMINANCE_BASE, state.quality));

    const result = reconstructImage();
    elements.resultCanvas.getContext('2d').putImageData(result, 0, 0);
    drawQuantizationPreview(result);

    const metrics = calculateMetrics(result);
    elements.fileSize.textContent = `${(metrics.estimatedBytes / 1024).toFixed(1)} KB`;
    elements.psnr.textContent = `${metrics.psnr.toFixed(1)} dB`;
    elements.mse.textContent = metrics.mse.toFixed(2);
    elements.metricsStatus.textContent = `Quality ${state.quality} percent. File size ${elements.fileSize.textContent}; PSNR ${elements.psnr.textContent}; MSE ${elements.mse.textContent}.`;
}

function initialize() {
    drawDctBasis();
    createOriginalImage();
    elements.quality.addEventListener('input', updateVisualization);
    updateVisualization();
}

initialize();
