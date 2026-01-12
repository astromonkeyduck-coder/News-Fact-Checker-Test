/**
 * Clemens Converter - Client-side JavaScript
 * Handles file uploads, queue management, transcription, and downloads
 */

// Configuration
const CONFIG = {
    maxFileSize: 25 * 1024 * 1024, // 25MB (OpenAI Whisper limit)
    maxConcurrent: 2,
    apiBase: '/api',
    retryAttempts: 3,
    retryDelay: 1000, // ms
};

// State
const state = {
    files: new Map(), // fileId -> file data
    processingQueue: [],
    activeProcessing: 0,
    concurrentMode: false,
};

// DOM Elements
const elements = {
    dropzone: null,
    fileInput: null,
    selectFilesBtn: null,
    queueContainer: null,
    queueList: null,
    resultsContainer: null,
    settingsToggle: null,
    settingsContent: null,
    languageSelect: null,
    includeTimestamps: null,
    concurrentMode: null,
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initializeElements();
    setupEventListeners();
    loadSettings();
});

function initializeElements() {
    elements.dropzone = document.getElementById('dropzone');
    elements.fileInput = document.getElementById('fileInput');
    elements.selectFilesBtn = document.getElementById('selectFilesBtn');
    elements.queueContainer = document.getElementById('queueContainer');
    elements.queueList = document.getElementById('queueList');
    elements.resultsContainer = document.getElementById('resultsContainer');
    elements.settingsToggle = document.getElementById('settingsToggle');
    elements.settingsContent = document.getElementById('settingsContent');
    elements.languageSelect = document.getElementById('languageSelect');
    elements.includeTimestamps = document.getElementById('includeTimestamps');
    elements.concurrentMode = document.getElementById('concurrentMode');
}

function setupEventListeners() {
    // File selection
    elements.selectFilesBtn.addEventListener('click', () => {
        elements.fileInput.click();
    });
    elements.fileInput.addEventListener('change', handleFileSelect);

    // Drag and drop
    elements.dropzone.addEventListener('dragover', handleDragOver);
    elements.dropzone.addEventListener('dragleave', handleDragLeave);
    elements.dropzone.addEventListener('drop', handleDrop);
    elements.dropzone.addEventListener('click', () => elements.fileInput.click());

    // Settings toggle
    elements.settingsToggle.addEventListener('click', () => {
        const isVisible = elements.settingsContent.style.display !== 'none';
        elements.settingsContent.style.display = isVisible ? 'none' : 'block';
    });

    // Settings changes
    elements.concurrentMode.addEventListener('change', (e) => {
        state.concurrentMode = e.target.checked;
        saveSettings();
        processQueue();
    });
}

function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    elements.dropzone.classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    elements.dropzone.classList.remove('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    elements.dropzone.classList.remove('dragover');
    
    const files = Array.from(e.dataTransfer.files).filter(f => 
        f.type.startsWith('audio/') || f.name.endsWith('.mp3')
    );
    
    if (files.length > 0) {
        addFiles(files);
    }
}

function handleFileSelect(e) {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
        addFiles(files);
    }
    // Reset input to allow selecting same file again
    e.target.value = '';
}

function addFiles(files) {
    const validFiles = [];
    
    for (const file of files) {
        // Validate file type
        if (!file.type.startsWith('audio/') && !file.name.endsWith('.mp3')) {
            showError(`Skipped ${file.name}: Not an audio file`);
            continue;
        }

        // Validate file size
        if (file.size > CONFIG.maxFileSize) {
            showError(`Skipped ${file.name}: File too large (max ${CONFIG.maxFileSize / 1024 / 1024}MB)`);
            continue;
        }

        const fileId = generateFileId();
        state.files.set(fileId, {
            id: fileId,
            file: file,
            fileName: file.name,
            fileSize: file.size,
            status: 'queued',
            progress: 0,
            error: null,
            transcript: null,
            objectKey: null,
        });

        validFiles.push(fileId);
    }

    if (validFiles.length > 0) {
        updateQueueDisplay();
        elements.queueContainer.style.display = 'block';
        processQueue();
    }
}

function generateFileId() {
    return `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function updateQueueDisplay() {
    elements.queueList.innerHTML = '';
    
    for (const [fileId, fileData] of state.files) {
        const item = createFileItem(fileId, fileData);
        elements.queueList.appendChild(item);
    }
}

function createFileItem(fileId, fileData) {
    const div = document.createElement('div');
    div.className = 'file-item';
    div.id = `file-${fileId}`;

    const statusClass = `status-${fileData.status}`;
    const statusText = fileData.status.charAt(0).toUpperCase() + fileData.status.slice(1);

    div.innerHTML = `
        <div class="file-header">
            <div class="file-info">
                <div class="file-name">${escapeHtml(fileData.fileName)}</div>
                <div class="file-meta">
                    <span>${formatFileSize(fileData.fileSize)}</span>
                    <span class="file-status ${statusClass}">
                        ${fileData.status === 'transcribing' ? '<span class="spinner"></span> ' : ''}
                        ${statusText}
                    </span>
                </div>
            </div>
            <div class="file-actions">
                ${fileData.status === 'queued' ? `
                    <button class="btn btn-remove" onclick="removeFile('${fileId}')">Remove</button>
                ` : ''}
                ${fileData.status === 'error' ? `
                    <button class="btn btn-retry" onclick="retryFile('${fileId}')">Retry</button>
                    <button class="btn btn-remove" onclick="removeFile('${fileId}')">Remove</button>
                ` : ''}
            </div>
        </div>
        ${fileData.status !== 'queued' && fileData.status !== 'error' ? `
            <div class="progress-bar-container">
                <div class="progress-bar" style="width: ${fileData.progress}%"></div>
            </div>
        ` : ''}
        ${fileData.error ? `
            <div class="error-message">${escapeHtml(fileData.error)}</div>
        ` : ''}
    `;

    return div;
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Global functions for inline event handlers
window.removeFile = (fileId) => {
    if (state.files.get(fileId)?.status === 'queued') {
        state.files.delete(fileId);
        updateQueueDisplay();
        if (state.files.size === 0) {
            elements.queueContainer.style.display = 'none';
        }
    }
};

window.retryFile = (fileId) => {
    const fileData = state.files.get(fileId);
    if (fileData) {
        fileData.status = 'queued';
        fileData.progress = 0;
        fileData.error = null;
        updateQueueDisplay();
        processQueue();
    }
};

async function processQueue() {
    // Get queued files
    const queuedFiles = Array.from(state.files.entries())
        .filter(([_, data]) => data.status === 'queued')
        .map(([id, _]) => id);

    if (queuedFiles.length === 0) {
        return;
    }

    // Determine how many to process
    const maxActive = state.concurrentMode ? CONFIG.maxConcurrent : 1;
    const toProcess = queuedFiles.slice(0, maxActive - state.activeProcessing);

    for (const fileId of toProcess) {
        state.activeProcessing++;
        processFile(fileId).finally(() => {
            state.activeProcessing--;
            processQueue(); // Process next in queue
        });
    }
}

async function processFile(fileId) {
    const fileData = state.files.get(fileId);
    if (!fileData) return;

    try {
        // Step 1: Get upload URL
        fileData.status = 'uploading';
        fileData.progress = 10;
        updateQueueDisplay();

        const uploadInfo = await getUploadUrl(fileData.fileName, fileData.fileSize);
        
        // Step 2: Upload file
        fileData.progress = 30;
        updateQueueDisplay();

        const uploadResult = await uploadFile(fileData.file, uploadInfo);
        fileData.objectKey = uploadResult.objectKey;
        
        // Step 3: Transcribe
        fileData.status = 'transcribing';
        fileData.progress = 50;
        updateQueueDisplay();

        const language = elements.languageSelect.value || null;
        const includeTimestamps = elements.includeTimestamps.checked;

        const transcript = await transcribeFromUrl(
            uploadResult.objectKey,
            uploadInfo.storageType || 'blobs',
            language,
            includeTimestamps
        );

        // Step 4: Complete
        fileData.status = 'done';
        fileData.progress = 100;
        fileData.transcript = transcript;
        updateQueueDisplay();

        // Show result
        showResult(fileId, fileData);

    } catch (error) {
        console.error(`[processFile] Error for ${fileData.fileName}:`, error);
        fileData.status = 'error';
        fileData.error = error.message || 'Processing failed';
        fileData.progress = 0;
        updateQueueDisplay();
    }
}

async function getUploadUrl(fileName, fileSize) {
    const url = `${CONFIG.apiBase}/get-upload-url?fileName=${encodeURIComponent(fileName)}&fileSize=${fileSize}`;
    
    const response = await fetch(url, {
        method: 'GET',
        headers: getAuthHeaders(),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to get upload URL');
    }

    const data = await response.json();
    return {
        uploadUrl: data.uploadUrl,
        objectKey: data.objectKey,
        method: data.method || 'POST',
        storageType: data.uploadUrl.includes('r2') ? 'r2' : 'blobs',
    };
}

async function uploadFile(file, uploadInfo) {
    if (uploadInfo.method === 'POST' && uploadInfo.uploadUrl.startsWith('/api/')) {
        // Upload via our API (Blobs)
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(uploadInfo.uploadUrl, {
            method: 'POST',
            body: formData,
            headers: getAuthHeaders(),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Upload failed');
        }

        return await response.json();
    } else {
        // Direct upload to R2 (if implemented)
        const response = await fetch(uploadInfo.uploadUrl, {
            method: uploadInfo.method || 'PUT',
            body: file,
            headers: {
                'Content-Type': 'audio/mpeg',
                ...uploadInfo.headers,
            },
        });

        if (!response.ok) {
            throw new Error('Direct upload failed');
        }

        return { objectKey: uploadInfo.objectKey };
    }
}

async function transcribeFromUrl(objectKey, storageType, language, includeTimestamps) {
    const url = `${CONFIG.apiBase}/transcribe-from-url`;
    
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
        },
        body: JSON.stringify({
            objectKey,
            storageType,
            language,
            includeTimestamps,
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Transcription failed');
    }

    return await response.json();
}

function getAuthHeaders() {
    // Get token from URL or localStorage (if implemented)
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token') || localStorage.getItem('clems_token');
    
    if (token) {
        return { 'X-Clems-Token': token };
    }
    return {};
}

function showResult(fileId, fileData) {
    const resultDiv = document.createElement('div');
    resultDiv.className = 'result-item';
    resultDiv.id = `result-${fileId}`;

    const transcript = fileData.transcript;
    const transcriptText = transcript.transcriptText || '';
    const isCollapsed = transcriptText.length > 500;

    resultDiv.innerHTML = `
        <div class="result-header">
            <div class="result-title">${escapeHtml(transcript.fileName)}</div>
            <div class="result-actions">
                <button class="btn btn-copy" onclick="copyTranscript('${fileId}')">Copy</button>
                <button class="btn btn-download-txt" onclick="downloadTxt('${fileId}')">Download TXT</button>
                <button class="btn btn-download-pdf" onclick="downloadPdf('${fileId}')">Download PDF</button>
            </div>
        </div>
        <div class="transcript-preview ${isCollapsed ? 'collapsed' : ''}" id="preview-${fileId}">
            ${escapeHtml(transcriptText)}
        </div>
        ${isCollapsed ? `
            <button class="toggle-preview" onclick="togglePreview('${fileId}')">Show more</button>
        ` : ''}
        ${transcript.segments ? `
            <div style="margin-top: 10px; color: #a0aec0; font-size: 0.9rem;">
                Language: ${transcript.language || 'auto'} | 
                Model: ${transcript.modelUsed} | 
                Duration: ${(transcript.elapsedMs / 1000).toFixed(1)}s
            </div>
        ` : ''}
    `;

    elements.resultsContainer.appendChild(resultDiv);
}

window.togglePreview = (fileId) => {
    const preview = document.getElementById(`preview-${fileId}`);
    const button = preview.nextElementSibling;
    
    if (preview.classList.contains('collapsed')) {
        preview.classList.remove('collapsed');
        button.textContent = 'Show less';
    } else {
        preview.classList.add('collapsed');
        button.textContent = 'Show more';
    }
};

window.copyTranscript = async (fileId) => {
    const fileData = state.files.get(fileId);
    if (!fileData?.transcript) return;

    const text = fileData.transcript.transcriptText;
    try {
        await navigator.clipboard.writeText(text);
        showNotification('Transcript copied to clipboard!');
    } catch (error) {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showNotification('Transcript copied to clipboard!');
    }
};

window.downloadTxt = (fileId) => {
    const fileData = state.files.get(fileId);
    if (!fileData?.transcript) return;

    const text = fileData.transcript.transcriptText;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileData.fileName.replace(/\.[^/.]+$/, '')}_transcript.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

window.downloadPdf = async (fileId) => {
    const fileData = state.files.get(fileId);
    if (!fileData?.transcript) return;

    try {
        const { PDFDocument, rgb, StandardFonts } = PDFLib;
        
        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage([612, 792]); // US Letter size
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        const margin = 50;
        const maxWidth = page.getWidth() - 2 * margin;
        let y = page.getHeight() - margin;

        // Title
        page.drawText('Transcript', {
            x: margin,
            y: y,
            size: 20,
            font: boldFont,
            color: rgb(0, 0, 0),
        });
        y -= 30;

        // Filename
        page.drawText(`File: ${fileData.fileName}`, {
            x: margin,
            y: y,
            size: 12,
            font: font,
            color: rgb(0.3, 0.3, 0.3),
        });
        y -= 20;

        // Timestamp
        const timestamp = new Date().toLocaleString();
        page.drawText(`Generated: ${timestamp}`, {
            x: margin,
            y: y,
            size: 10,
            font: font,
            color: rgb(0.5, 0.5, 0.5),
        });
        y -= 30;

        // Transcript text
        const transcript = fileData.transcript.transcriptText;
        const lines = wrapText(transcript, maxWidth, font, 11);
        
        for (const line of lines) {
            if (y < margin + 20) {
                // New page
                const newPage = pdfDoc.addPage([612, 792]);
                y = page.getHeight() - margin;
                page = newPage;
            }
            
            page.drawText(line, {
                x: margin,
                y: y,
                size: 11,
                font: font,
                color: rgb(0, 0, 0),
            });
            y -= 14;
        }

        // Save PDF
        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${fileData.fileName.replace(/\.[^/.]+$/, '')}_transcript.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

    } catch (error) {
        console.error('[downloadPdf] Error:', error);
        showError('Failed to generate PDF. Please try downloading as TXT instead.');
    }
};

function wrapText(text, maxWidth, font, fontSize) {
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';

    for (const word of words) {
        const testLine = currentLine + (currentLine ? ' ' : '') + word;
        const width = font.widthOfTextAtSize(testLine, fontSize);
        
        if (width > maxWidth && currentLine) {
            lines.push(currentLine);
            currentLine = word;
        } else {
            currentLine = testLine;
        }
    }
    
    if (currentLine) {
        lines.push(currentLine);
    }
    
    return lines;
}

function showError(message) {
    // Simple error notification
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: rgba(239, 68, 68, 0.9);
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 5000);
}

function showNotification(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: rgba(34, 197, 94, 0.9);
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Settings persistence
function saveSettings() {
    localStorage.setItem('clemens_settings', JSON.stringify({
        language: elements.languageSelect.value,
        includeTimestamps: elements.includeTimestamps.checked,
        concurrentMode: elements.concurrentMode.checked,
    }));
}

function loadSettings() {
    const saved = localStorage.getItem('clemens_settings');
    if (saved) {
        try {
            const settings = JSON.parse(saved);
            elements.languageSelect.value = settings.language || '';
            elements.includeTimestamps.checked = settings.includeTimestamps || false;
            elements.concurrentMode.checked = settings.concurrentMode || false;
            state.concurrentMode = settings.concurrentMode || false;
        } catch (e) {
            console.error('[loadSettings] Error:', e);
        }
    }
}

// Save settings on change
elements.languageSelect.addEventListener('change', saveSettings);
elements.includeTimestamps.addEventListener('change', saveSettings);
