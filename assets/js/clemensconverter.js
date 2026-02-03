/**
 * Clemens Converter - Client-side JavaScript
 * Handles file uploads, queue management, transcription, and downloads
 */

// Configuration
const CONFIG = {
    maxFileSize: 25 * 1024 * 1024, // 25MB (OpenAI Whisper limit per request - larger files use chunking)
    maxUploadSize: 5 * 1024 * 1024, // 5MB (Netlify Function body limit - files larger need chunking or R2)
    maxConcurrent: 2,
    apiBase: '/api',
    retryAttempts: 3,
    retryDelay: 1000, // ms
    jobPollInterval: 2000, // Poll job status every 2 seconds
};

// State
const state = {
    files: new Map(), // fileId -> file data
    processingQueue: [],
    activeProcessing: 0,
    concurrentMode: false,
    activeJobs: new Map(), // jobId -> { fileId, pollInterval }
    batchMode: false,
    batchSelected: new Set(),
    recording: {
        isRecording: false,
        mediaRecorder: null,
        audioChunks: [],
        stream: null,
        timerInterval: null,
        startTime: null,
        audioContext: null,
        analyser: null,
        dataArray: null,
        animationFrame: null,
    },
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
    recordingPanel: null,
    recordBtn: null,
    stopBtn: null,
    recordingStatus: null,
    recordingTimer: null,
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initializeElements();
    setupEventListeners();
    loadSettings();
    setupKeyboardShortcuts();
    loadStats();
    // Resume jobs asynchronously - don't await to avoid blocking initialization
    resumeJobs().catch(error => {
        console.error('[DOMContentLoaded] Error resuming jobs:', error);
    });
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
    elements.recordingPanel = document.getElementById('recordingPanel');
    elements.recordBtn = document.getElementById('recordBtn');
    elements.stopBtn = document.getElementById('stopBtn');
    elements.recordingStatus = document.getElementById('recordingStatus');
    elements.recordingTimer = document.getElementById('recordingTimer');
    elements.recordingSize = document.getElementById('recordingSize');
    elements.waveformContainer = document.getElementById('waveformContainer');
    elements.waveformCanvas = document.getElementById('waveformCanvas');
    elements.levelBar = document.getElementById('levelBar');
    elements.levelValue = document.getElementById('levelValue');
    
    // Log missing elements for debugging
    const requiredElements = ['dropzone', 'fileInput', 'selectFilesBtn', 'queueContainer', 'queueList', 'resultsContainer', 'settingsToggle', 'settingsContent'];
    const missing = requiredElements.filter(id => !document.getElementById(id));
    if (missing.length > 0) {
        console.warn('[Clemens Converter] Missing required elements:', missing);
    }
}

function setupEventListeners() {
    // File selection
    if (elements.selectFilesBtn && elements.fileInput) {
        elements.selectFilesBtn.addEventListener('click', () => {
            elements.fileInput.click();
        });
        elements.fileInput.addEventListener('change', handleFileSelect);
    }

    // Drag and drop
    if (elements.dropzone && elements.fileInput) {
        elements.dropzone.addEventListener('dragover', handleDragOver);
        elements.dropzone.addEventListener('dragleave', handleDragLeave);
        elements.dropzone.addEventListener('drop', handleDrop);
        elements.dropzone.addEventListener('click', () => elements.fileInput.click());
    }

    // Settings toggle
    if (elements.settingsToggle && elements.settingsContent) {
        elements.settingsToggle.addEventListener('click', () => {
            const isVisible = elements.settingsContent.style.display !== 'none';
            elements.settingsContent.style.display = isVisible ? 'none' : 'block';
        });
    }

    // Settings changes
    if (elements.concurrentMode) {
        elements.concurrentMode.addEventListener('change', (e) => {
            state.concurrentMode = e.target.checked;
            saveSettings();
            processQueue();
        });
    }

    // Save settings on change
    if (elements.languageSelect) {
        elements.languageSelect.addEventListener('change', saveSettings);
    }
    if (elements.includeTimestamps) {
        elements.includeTimestamps.addEventListener('change', saveSettings);
    }

    // Recording controls
    if (elements.recordBtn) {
        elements.recordBtn.addEventListener('click', startRecording);
    }
    if (elements.stopBtn) {
        elements.stopBtn.addEventListener('click', stopRecording);
    }
}

function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    elements.dropzone.classList.add('dragover', 'drag-active');
}

function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    elements.dropzone.classList.remove('dragover', 'drag-active');
}

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    elements.dropzone.classList.remove('dragover', 'drag-active');
    
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

        // Note: We allow >25MB files if R2 is configured (they'll be chunked during processing)
        // The 25MB limit is only enforced for Blobs upload path (fallback)
        // No warnings - just process the file

        const fileId = generateFileId();
        // Create blob URL for audio playback (if it's an audio file)
        let audioUrl = null;
        if (file.type.startsWith('audio/') || file.name.match(/\.(mp3|webm|wav|ogg|m4a)$/i)) {
            audioUrl = URL.createObjectURL(file);
            
            // Store audio blob in IndexedDB for persistence across page refreshes
            storeAudioBlob(fileId, file).catch(error => {
                console.warn(`[addFiles] Failed to store audio blob in IndexedDB for ${fileId}:`, error);
                // Continue anyway - audio playback will work until page refresh
            });
        }
        
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
            jobId: null, // For large files using job-based workflow
            isLargeFile: file.size > CONFIG.maxFileSize, // >25MB requires job-based processing
            audioUrl: audioUrl, // Store blob URL for playback
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
    if (!elements.queueList) {
        console.warn('[updateQueueDisplay] queueList element not found');
        return;
    }
    
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
    let statusText = fileData.status.charAt(0).toUpperCase() + fileData.status.slice(1);
    
    // Show detailed status message for job-based processing
    if (fileData.statusMessage) {
        statusText = fileData.statusMessage;
    }
    
    // Get file type icon
    const fileExtension = fileData.fileName.split('.').pop()?.toLowerCase() || '';
    const fileIcons = {
        'mp3': '🎵',
        'webm': '🎤',
        'wav': '🔊',
        'ogg': '🎧',
        'm4a': '📻',
    };
    const fileIcon = fileIcons[fileExtension] || '📄';

    div.innerHTML = `
        <div class="file-header">
            <div class="file-info">
                <div class="file-name">
                    <span class="file-type-icon">${fileIcon}</span>
                    ${escapeHtml(fileData.fileName)}
                </div>
                <div class="file-meta">
                    <span>${fileData.fileSize > 0 ? formatFileSize(fileData.fileSize) : 'Large file'}</span>
                    <span class="file-status ${statusClass}">
                        ${(fileData.status === 'transcribing' || fileData.status === 'processing' || fileData.status === 'finalizing') ? '<span class="spinner"></span> ' : ''}
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

/**
 * IndexedDB helper functions for storing audio blobs
 */
const AUDIO_DB_NAME = 'clemens_converter_audio';
const AUDIO_DB_VERSION = 1;
const AUDIO_STORE_NAME = 'audio_blobs';

/**
 * Open IndexedDB database
 */
async function openAudioDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(AUDIO_DB_NAME, AUDIO_DB_VERSION);
        
        request.onerror = () => {
            console.error('[IndexedDB] Failed to open database:', request.error);
            reject(request.error);
        };
        
        request.onsuccess = () => {
            resolve(request.result);
        };
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(AUDIO_STORE_NAME)) {
                db.createObjectStore(AUDIO_STORE_NAME);
            }
        };
    });
}

/**
 * Store audio blob in IndexedDB
 */
async function storeAudioBlob(fileId, blob) {
    try {
        const db = await openAudioDB();
        const transaction = db.transaction([AUDIO_STORE_NAME], 'readwrite');
        const store = transaction.objectStore(AUDIO_STORE_NAME);
        
        return new Promise((resolve, reject) => {
            const request = store.put(blob, fileId);
            request.onsuccess = () => {
                console.log(`[IndexedDB] Stored audio blob for ${fileId}`);
                resolve();
            };
            request.onerror = () => {
                console.error(`[IndexedDB] Failed to store audio blob for ${fileId}:`, request.error);
                reject(request.error);
            };
        });
    } catch (error) {
        console.error(`[IndexedDB] Error storing audio blob for ${fileId}:`, error);
        // Don't throw - audio playback is optional
        return;
    }
}

/**
 * Retrieve audio blob from IndexedDB
 */
async function getAudioBlob(fileId) {
    try {
        const db = await openAudioDB();
        const transaction = db.transaction([AUDIO_STORE_NAME], 'readonly');
        const store = transaction.objectStore(AUDIO_STORE_NAME);
        
        return new Promise((resolve, reject) => {
            const request = store.get(fileId);
            request.onsuccess = () => {
                const blob = request.result;
                if (blob) {
                    console.log(`[IndexedDB] Retrieved audio blob for ${fileId}`);
                    resolve(blob);
                } else {
                    resolve(null);
                }
            };
            request.onerror = () => {
                console.error(`[IndexedDB] Failed to retrieve audio blob for ${fileId}:`, request.error);
                reject(request.error);
            };
        });
    } catch (error) {
        console.error(`[IndexedDB] Error retrieving audio blob for ${fileId}:`, error);
        return null;
    }
}

/**
 * Delete audio blob from IndexedDB
 */
async function deleteAudioBlob(fileId) {
    try {
        const db = await openAudioDB();
        const transaction = db.transaction([AUDIO_STORE_NAME], 'readwrite');
        const store = transaction.objectStore(AUDIO_STORE_NAME);
        
        return new Promise((resolve, reject) => {
            const request = store.delete(fileId);
            request.onsuccess = () => {
                console.log(`[IndexedDB] Deleted audio blob for ${fileId}`);
                resolve();
            };
            request.onerror = () => {
                console.error(`[IndexedDB] Failed to delete audio blob for ${fileId}:`, request.error);
                reject(request.error);
            };
        });
    } catch (error) {
        console.error(`[IndexedDB] Error deleting audio blob for ${fileId}:`, error);
        // Don't throw - cleanup is optional
        return;
    }
}

/**
 * Check if blob URL is still valid
 */
function isBlobUrlValid(blobUrl) {
    if (!blobUrl || !blobUrl.startsWith('blob:')) {
        return false;
    }
    // Blob URLs are valid until revoked or page unloads
    // We can't really test if they're valid without trying to use them
    // So we'll assume they're valid if they exist and are blob URLs
    return true;
}

// Global functions for inline event handlers
window.removeFile = (fileId) => {
    const fileData = state.files.get(fileId);
    if (!fileData) return;
    
    // Allow removal of queued or error files
    // Don't allow removal of files that are actively processing
    if (fileData.status === 'queued' || fileData.status === 'error') {
        // If it's a job-based file, stop polling
        if (fileData.jobId && state.activeJobs.has(fileData.jobId)) {
            const jobInfo = state.activeJobs.get(fileData.jobId);
            if (jobInfo?.pollInterval) {
                clearInterval(jobInfo.pollInterval);
            }
            state.activeJobs.delete(fileData.jobId);
            // Decrement activeProcessing if it was a job-based file
            // (jobs don't increment activeProcessing, but we need to ensure queue continues)
        }
        
        state.files.delete(fileId);
        updateQueueDisplay();
        
        // Continue processing queue if there are files waiting
        processQueue();
        
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
    // Include active jobs in concurrency calculation to respect limits
    const maxActive = state.concurrentMode ? CONFIG.maxConcurrent : 1;
    const totalActive = state.activeProcessing + state.activeJobs.size;
    const toProcess = queuedFiles.slice(0, Math.max(0, maxActive - totalActive));

    for (const fileId of toProcess) {
        state.activeProcessing++;
        processFile(fileId).catch(error => {
            // Log error but don't re-throw - error handling is in processFile()
            console.error(`[processQueue] Error processing file ${fileId}:`, error);
        }).finally(() => {
            // Only decrement if this wasn't a job-based file
            // Job-based files will decrement when the job completes
            const fileData = state.files.get(fileId);
            if (!fileData || !fileData.jobId) {
                // Not a job-based file, safe to decrement
                state.activeProcessing--;
            }
            // If it's a job-based file, activeProcessing will be decremented
            // when the job completes in pollJobStatus()
            
            // Always continue queue processing, even on errors
            // Use setTimeout to ensure this happens after state updates
            setTimeout(() => {
                processQueue();
            }, 50);
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
        
        // Step 3: Transcribe (or create job for large files)
        const language = elements.languageSelect.value || null;
        const includeTimestamps = elements.includeTimestamps.checked;

        // Use job-based workflow for R2 uploads (R2 is for files that need chunking/processing)
        // OR for files >25MB (even if using blobs fallback)
        if (uploadInfo.storageType === 'r2' || fileData.isLargeFile) {
            // Use job-based workflow for R2 files or large files
            // Keep progress at 30% (upload complete) - don't regress
            fileData.status = 'processing';
            fileData.progress = 30; // Maintain progress from upload step
            updateQueueDisplay();

            const jobResult = await createJob(
                uploadResult.objectKey,
                fileData.fileName,
                language,
                includeTimestamps
            );

            fileData.jobId = jobResult.jobId;
            
            // Store jobId in localStorage for resume capability
            const jobData = {
                jobId: jobResult.jobId,
                fileId: fileId,
                fileName: fileData.fileName,
            };
            localStorage.setItem(`clemens-job-${jobResult.jobId}`, JSON.stringify(jobData));

            // Decrement activeProcessing since this file is now tracked in activeJobs
            // This prevents double-counting in concurrency calculation
            state.activeProcessing--;

            // Start polling job status (this will add to activeJobs)
            pollJobStatus(jobResult.jobId, fileId);
        } else {
            // Use direct transcription for small files (only for blob uploads, not R2)
            fileData.status = 'transcribing';
            fileData.progress = 50;
            updateQueueDisplay();

            try {
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
            } catch (transcribeError) {
                // If direct transcription times out, fall back to job-based workflow
                if (transcribeError.message.includes('timed out') || transcribeError.message.includes('504')) {
                    console.log(`[processFile] Direct transcription timed out for ${fileData.fileName}, falling back to job-based workflow`);
                    
                    // Switch to job-based workflow
                    fileData.status = 'processing';
                    fileData.progress = 30;
                    updateQueueDisplay();

                    const jobResult = await createJob(
                        uploadResult.objectKey,
                        fileData.fileName,
                        language,
                        includeTimestamps
                    );

                    fileData.jobId = jobResult.jobId;
                    
                    const jobData = {
                        jobId: jobResult.jobId,
                        fileId: fileId,
                        fileName: fileData.fileName,
                    };
                    localStorage.setItem(`clemens-job-${jobResult.jobId}`, JSON.stringify(jobData));

                    state.activeProcessing--;
                    pollJobStatus(jobResult.jobId, fileId);
                } else {
                    // Re-throw other errors
                    throw transcribeError;
                }
            }
        }

    } catch (error) {
        console.error(`[processFile] Error for ${fileData.fileName}:`, error);
        fileData.status = 'error';
        // Extract meaningful error message
        let errorMessage = error.message || 'Processing failed';
        
        // Clean up JSON parse errors to show actual server error
        if (error.message && (error.message.includes('JSON') || error.message.includes('Unexpected token'))) {
            // Try to extract the actual error from the message
            const match = error.message.match(/Internal E[^"]*/);
            if (match) {
                errorMessage = `Server error: ${match[0]}. Check Netlify function logs for details.`;
            } else {
                errorMessage = 'Server error: Received invalid response. Check Netlify function logs.';
            }
        }
        
        // If it's a 500 error, provide helpful context
        if (errorMessage.includes('500') || errorMessage.includes('Internal Server Error')) {
            errorMessage += ' This usually means: (1) Missing environment variables (NETLIFY_SITE_ID, NETLIFY_BLOB_READ_WRITE_TOKEN), (2) Blob store not created, or (3) Function error. Check Netlify Dashboard → Functions → Logs.';
        }
        
        fileData.error = errorMessage;
        fileData.progress = 0;
        updateQueueDisplay();
        
        // Ensure queue continues processing after error
        // The finally block will also call processQueue(), but this ensures it happens
        // even if there's an issue with the finally block
        setTimeout(() => {
            processQueue();
        }, 100);
    }
}

async function getUploadUrl(fileName, fileSize) {
    const url = `${CONFIG.apiBase}/get-upload-url?fileName=${encodeURIComponent(fileName)}&fileSize=${fileSize}`;
    
    const response = await fetch(url, {
        method: 'GET',
        headers: getAuthHeaders(),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        
        // Provide helpful message for 401 errors
        if (response.status === 401) {
            const urlParams = new URLSearchParams(window.location.search);
            const token = urlParams.get('token');
            if (!token) {
                throw new Error('Authentication required. Please access this page with ?token=YOUR_TOKEN in the URL, or remove CLEMS_TOKEN from environment variables if you want open access.');
            } else {
                throw new Error('Invalid token. Please check that your token matches the CLEMS_TOKEN environment variable.');
            }
        }
        
        throw new Error(error.error || 'Failed to get upload URL');
    }

    const data = await response.json();
    return {
        uploadUrl: data.uploadUrl,
        objectKey: data.objectKey,
        method: data.method || 'POST',
        headers: data.headers || {},
        storageType: data.storageType || (data.uploadUrl.startsWith('http') ? 'r2' : 'blobs'),
    };
}

async function uploadFile(file, uploadInfo) {
    // Check if this is a direct R2 upload (presigned URL)
    if (uploadInfo.method === 'PUT' && uploadInfo.uploadUrl.startsWith('http')) {
        // Direct upload to R2 using presigned URL (bypasses Netlify Function limits)
        console.log('[uploadFile] Uploading directly to R2:', uploadInfo.uploadUrl.substring(0, 50) + '...');
        
        try {
            const response = await fetch(uploadInfo.uploadUrl, {
                method: 'PUT',
                body: file,
                headers: {
                    'Content-Type': uploadInfo.headers['Content-Type'] || 'audio/mpeg',
                },
            });

            if (!response.ok) {
                const errorText = await response.text().catch(() => 'Unknown error');
                throw new Error(`R2 upload failed (${response.status}): ${errorText.substring(0, 200)}`);
            }
        } catch (error) {
            // CORS errors throw TypeError: Failed to fetch before we get a response
            if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
                throw new Error(`CORS error: R2 bucket needs CORS configuration. Origin: ${window.location.origin}. See R2_CORS_FIX_NOW.md for setup instructions.`);
            }
            throw error; // Re-throw other errors
        }

        // R2 PUT requests return empty body (204) or minimal response on success
        console.log('[uploadFile] ✅ Successfully uploaded to R2');
        return { objectKey: uploadInfo.objectKey };
        
    } else if (uploadInfo.method === 'POST' && uploadInfo.uploadUrl.startsWith('/api/')) {
        // Upload via our API (Blobs - has 6MB size limits)
        console.log('[uploadFile] Uploading via Netlify Function (Blobs):', uploadInfo.uploadUrl);
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(uploadInfo.uploadUrl, {
            method: 'POST',
            body: formData,
            headers: getAuthHeaders(),
        });

        if (!response.ok) {
            // Check content type to determine how to read response
            const contentType = response.headers.get('content-type') || '';
            let errorMessage = `Upload failed: ${response.status} ${response.statusText}`;
            
            try {
                if (contentType.includes('application/json')) {
                    // It's JSON, parse it
                    const errorJson = await response.json();
                    errorMessage = errorJson.error || errorJson.message || errorJson.hint || errorMessage;
                } else {
                    // Not JSON, read as text (but only once!)
                    const errorText = await response.text();
                    // Try to extract meaningful error from HTML if it's an error page
                    if (errorText.includes('<title>')) {
                        const titleMatch = errorText.match(/<title[^>]*>([^<]+)<\/title>/i);
                        if (titleMatch) {
                            errorMessage = `${errorMessage}: ${titleMatch[1]}`;
                        } else {
                            errorMessage = `${errorMessage}: Server returned HTML error page`;
                        }
                    } else {
                        // Use first 200 chars of text response
                        errorMessage = `${errorMessage}: ${errorText.substring(0, 200)}`;
                    }
                }
            } catch (e) {
                // If reading fails, use status code
                console.error('[uploadFile] Failed to read error response:', e);
                errorMessage = `Upload failed: ${response.status} ${response.statusText}. Check function logs.`;
            }
            
            throw new Error(errorMessage);
        }

        // Parse successful response
        try {
            return await response.json();
        } catch (e) {
            const text = await response.text();
            throw new Error(`Invalid JSON response: ${text.substring(0, 100)}`);
        }
    } else {
        throw new Error(`Unsupported upload method: ${uploadInfo.method} for URL: ${uploadInfo.uploadUrl}`);
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
        // Handle 504 Gateway Timeout specifically
        if (response.status === 504) {
            throw new Error('Transcription timed out. The file is being processed using the job-based workflow instead.');
        }
        
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        
        // Provide helpful message for 401 errors
        if (response.status === 401) {
            const urlParams = new URLSearchParams(window.location.search);
            const token = urlParams.get('token');
            if (!token) {
                throw new Error('Authentication required. Please access this page with ?token=YOUR_TOKEN in the URL.');
            } else {
                throw new Error('Invalid token. Please check that your token matches the CLEMS_TOKEN environment variable.');
            }
        }
        
        throw new Error(error.error || `Transcription failed (${response.status})`);
    }

    return await response.json();
}

/**
 * Create a transcription job for large files
 */
async function createJob(r2Key, filename, language, includeTimestamps) {
    const url = `${CONFIG.apiBase}/create-job`;
    
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
        },
        body: JSON.stringify({
            r2Key,
            filename,
            language,
            includeTimestamps,
        }),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || 'Failed to create job');
    }

    return await response.json();
}

/**
 * Poll job status and update UI
 */
function pollJobStatus(jobId, fileId) {
    // Check if this job is already being tracked
    const wasAlreadyTracking = state.activeJobs.has(jobId);
    
    // Stop any existing polling for this job
    if (wasAlreadyTracking) {
        clearInterval(state.activeJobs.get(jobId).pollInterval);
    }

    // Define intervalId variable before creating poll() to avoid closure issues
    let intervalId = null;

    const poll = async () => {
        try {
            const url = `${CONFIG.apiBase}/job-status?jobId=${encodeURIComponent(jobId)}`;
            const response = await fetch(url, {
                method: 'GET',
                headers: getAuthHeaders(),
            });

            if (!response.ok) {
                // If job doesn't exist (404), stop polling and clean up
                if (response.status === 404) {
                    console.warn(`[pollJobStatus] Job ${jobId} not found (404), stopping polling and cleaning up`);
                    if (intervalId) {
                        clearInterval(intervalId);
                    }
                    state.activeJobs.delete(jobId);
                    localStorage.removeItem(`clemens-job-${jobId}`);
                    
                    // Update file status if it exists
                    const fileData = state.files.get(fileId);
                    if (fileData) {
                        fileData.status = 'error';
                        fileData.error = 'Job not found in database. It may have been deleted.';
                        updateQueueDisplay();
                    }
                    
                    processQueue();
                    return;
                }
                throw new Error(`Job status check failed: ${response.status}`);
            }

            const jobStatus = await response.json();
            const fileData = state.files.get(fileId);
            if (!fileData) {
                // File removed, stop polling
                if (intervalId) {
                    clearInterval(intervalId);
                }
                state.activeJobs.delete(jobId);
                
                // Note: Do NOT decrement activeProcessing here
                // If this job was created via processFile(), activeProcessing was already
                // decremented when the job was created. If it was resumed via resumeJobs(),
                // activeProcessing was never incremented. Either way, we don't need to
                // decrement it here.
                
                // Continue processing queue now that this job slot is freed
                processQueue();
                
                return;
            }

            // Update file data with job status
            fileData.status = jobStatus.status === 'done' ? 'done' : 
                            jobStatus.status === 'error' ? 'error' : 
                            jobStatus.status === 'transcribing' ? 'transcribing' : 
                            jobStatus.status === 'finalizing' ? 'finalizing' : 'processing';
            fileData.progress = jobStatus.progress || 0;
            
            // Update status message
            if (jobStatus.status === 'transcribing' && jobStatus.chunksTotal) {
                // Show current chunk being processed (chunksDone is 0-indexed, so +1 for display)
                const currentChunk = jobStatus.chunksDone < jobStatus.chunksTotal 
                    ? jobStatus.chunksDone + 1 
                    : jobStatus.chunksTotal;
                fileData.statusMessage = `Transcribing chunk ${currentChunk} / ${jobStatus.chunksTotal}`;
            } else if (jobStatus.status === 'processing') {
                fileData.statusMessage = 'Processing...';
            } else if (jobStatus.status === 'finalizing') {
                fileData.statusMessage = 'Finalizing transcript...';
            } else if (jobStatus.status === 'done' || jobStatus.status === 'error') {
                // Clear status message when job completes
                fileData.statusMessage = null;
            }
            
            // Check if job appears stuck (transcribing but hasn't updated in a while)
            if (jobStatus.status === 'transcribing' && jobStatus.chunksTotal && jobStatus.chunksDone < jobStatus.chunksTotal) {
                const lastUpdate = new Date(jobStatus.updated_at || jobStatus.updatedAt || Date.now());
                const minutesSinceUpdate = (Date.now() - lastUpdate.getTime()) / 1000 / 60;
                
                // If stuck for more than 5 minutes, try to trigger it again
                if (minutesSinceUpdate > 5) {
                    console.warn(`[pollJobStatus] Job ${jobId} appears stuck (${minutesSinceUpdate.toFixed(1)} min since update). Attempting to trigger...`);
                    try {
                        await fetch(`${CONFIG.apiBase}/trigger-job`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                ...getAuthHeaders(),
                            },
                            body: JSON.stringify({ jobId }),
                        });
                    } catch (triggerError) {
                        console.error(`[pollJobStatus] Failed to trigger stuck job:`, triggerError);
                    }
                }
            }

            if (jobStatus.errorMessage) {
                fileData.error = jobStatus.errorMessage;
            }

            updateQueueDisplay();

            // Stop polling if job is done or error (regardless of transcriptUrl)
            if (jobStatus.status === 'done') {
                if (intervalId) {
                    clearInterval(intervalId);
                }
                state.activeJobs.delete(jobId);
                
                // Note: Do NOT decrement activeProcessing here
                // It was already decremented when the job was created (line 370)
                // to transfer the count from activeProcessing to activeJobs.
                // Now that the job is done and removed from activeJobs,
                // the concurrency slot is automatically freed.
                
                // Remove from localStorage
                localStorage.removeItem(`clemens-job-${jobId}`);

                // Fetch transcript if URL is available
                if (jobStatus.transcriptUrl) {
                    try {
                        const transcriptResponse = await fetch(jobStatus.transcriptUrl);
                        const transcriptText = await transcriptResponse.text();
                        
                        // Try to fetch JSON transcript with segments if available
                        let segments = null;
                        if (jobStatus.transcriptJsonUrl) {
                            try {
                                const jsonResponse = await fetch(jobStatus.transcriptJsonUrl);
                                const jsonData = await jsonResponse.json();
                                segments = jsonData.segments || null;
                            } catch (jsonError) {
                                console.warn(`[pollJobStatus] Could not fetch JSON transcript:`, jsonError);
                                // Continue without segments
                            }
                        }
                        
                        fileData.transcript = {
                            transcriptText: transcriptText,
                            fileName: jobStatus.filename,
                            modelUsed: 'whisper-1',
                            language: jobStatus.language || 'auto',
                            segments: segments,
                        };
                    } catch (fetchError) {
                        console.error(`[pollJobStatus] Error fetching transcript:`, fetchError);
                        // Continue even if transcript fetch fails - job is still done
                    }
                }

                fileData.status = 'done';
                fileData.progress = 100;
                fileData.statusMessage = null; // Ensure status message is cleared
                updateQueueDisplay();
                
                // Show result if transcript is available
                if (fileData.transcript) {
                    showResult(fileId, fileData);
                }
                
                // Continue processing queue now that this job slot is freed
                processQueue();
            } else if (jobStatus.status === 'error') {
                if (intervalId) {
                    clearInterval(intervalId);
                }
                state.activeJobs.delete(jobId);
                
                // Note: Do NOT decrement activeProcessing here
                // It was already decremented when the job was created (line 370)
                // to transfer the count from activeProcessing to activeJobs.
                // Now that the job is done (with error) and removed from activeJobs,
                // the concurrency slot is automatically freed.
                
                localStorage.removeItem(`clemens-job-${jobId}`);
                fileData.status = 'error';
                fileData.statusMessage = null; // Ensure status message is cleared
                fileData.error = jobStatus.errorMessage || 'Job failed';
                updateQueueDisplay();
                
                // Continue processing queue now that this job slot is freed
                processQueue();
            }
        } catch (error) {
            console.error(`[pollJobStatus] Error polling job ${jobId}:`, error);
            
            // If error message indicates 404, stop polling
            if (error.message && error.message.includes('404')) {
                console.warn(`[pollJobStatus] Job ${jobId} not found, stopping polling`);
                if (intervalId) {
                    clearInterval(intervalId);
                }
                state.activeJobs.delete(jobId);
                localStorage.removeItem(`clemens-job-${jobId}`);
                
                // Update file status if it exists
                const fileData = state.files.get(fileId);
                if (fileData) {
                    fileData.status = 'error';
                    fileData.error = 'Job not found in database. It may have been deleted.';
                    updateQueueDisplay();
                }
                
                processQueue();
                return;
            }
            
            // For other errors, continue polling (might be temporary network issue)
            // But limit retries to avoid infinite polling
            const errorCount = state.activeJobs.get(jobId)?.errorCount || 0;
            if (errorCount > 10) {
                console.error(`[pollJobStatus] Too many errors for job ${jobId}, stopping polling`);
                if (intervalId) {
                    clearInterval(intervalId);
                }
                state.activeJobs.delete(jobId);
                
                const fileData = state.files.get(fileId);
                if (fileData) {
                    fileData.status = 'error';
                    fileData.error = 'Too many polling errors. Please try again.';
                    updateQueueDisplay();
                }
                
                processQueue();
                return;
            }
            
            // Increment error count
            const jobInfo = state.activeJobs.get(jobId);
            if (jobInfo) {
                jobInfo.errorCount = errorCount + 1;
            }
        }
    };

    // Set interval first to avoid race condition
    intervalId = setInterval(poll, CONFIG.jobPollInterval);
    state.activeJobs.set(jobId, { fileId, pollInterval: intervalId });
    
    // Note: We do NOT increment activeProcessing here
    // Jobs are tracked in activeJobs, and activeProcessing is managed separately:
    // - For jobs created via processFile(): activeProcessing was decremented when job was created (line 370)
    //   to transfer the count from activeProcessing to activeJobs
    // - For jobs resumed via resumeJobs(): activeProcessing is not incremented (job is only in activeJobs)
    // - When job completes: activeProcessing is NOT decremented (it was already decremented when job was created)
    // The concurrency calculation uses: totalActive = activeProcessing + activeJobs.size
    // This ensures jobs are only counted once, not double-counted
    
    // Poll immediately after interval is set
    poll();
}

/**
 * Resume jobs from localStorage (for page refresh)
 */
async function resumeJobs() {
    const jobKeys = Object.keys(localStorage).filter(key => key.startsWith('clemens-job-'));
    
    // Process jobs sequentially to avoid race conditions
    for (const key of jobKeys) {
        try {
            const jobData = JSON.parse(localStorage.getItem(key));
            const { jobId, fileId, fileName } = jobData;
            
            // Note: Do NOT increment activeProcessing here
            // Resumed jobs are tracked in activeJobs, and will decrement activeProcessing
            // when they complete. We don't want to double-count them.
            
            // First, verify job exists in database before resuming
            try {
                const statusUrl = `${CONFIG.apiBase}/job-status?jobId=${encodeURIComponent(jobId)}`;
                const statusResponse = await fetch(statusUrl, {
                    method: 'GET',
                    headers: getAuthHeaders(),
                });
                
                if (statusResponse.status === 404) {
                    // Job doesn't exist, clean up localStorage
                    console.log(`[resumeJobs] Job ${jobId} not found in database (404), removing from localStorage`);
                    localStorage.removeItem(key);
                    continue;
                }
                
                if (!statusResponse.ok) {
                    console.warn(`[resumeJobs] Could not verify job ${jobId} status (${statusResponse.status}), skipping`);
                    continue;
                }
                
                const jobStatus = await statusResponse.json();
                
                // If job is already done or error, clean up
                if (jobStatus.status === 'done' || jobStatus.status === 'error') {
                    console.log(`[resumeJobs] Job ${jobId} is already ${jobStatus.status}, removing from localStorage`);
                    localStorage.removeItem(key);
                    continue;
                }
            } catch (verifyError) {
                console.error(`[resumeJobs] Error verifying job ${jobId}:`, verifyError);
                // Continue anyway - might be temporary network issue
            }
            
            // Check if file still exists in state
            if (state.files.has(fileId)) {
                const fileData = state.files.get(fileId);
                fileData.jobId = jobId;
                fileData.status = 'processing';
                fileData.isLargeFile = true;
                
                // Try to restore audio blob from IndexedDB if audioUrl is missing or invalid
                if (!fileData.audioUrl || !isBlobUrlValid(fileData.audioUrl)) {
                    try {
                        const audioBlob = await getAudioBlob(fileId);
                        if (audioBlob) {
                            fileData.audioUrl = URL.createObjectURL(audioBlob);
                            console.log(`[resumeJobs] Restored audio blob URL for existing file ${fileId}`);
                        }
                    } catch (audioError) {
                        console.warn(`[resumeJobs] Could not restore audio blob for existing file ${fileId}:`, audioError);
                    }
                }
                
                // Resume polling
                pollJobStatus(jobId, fileId);
                console.log(`[resumeJobs] Resumed job ${jobId} for file ${fileName}`);
            } else {
                // File not in state, fetch job status to create placeholder
                // (Job existence was already verified above, so we can proceed)
                try {
                    const statusUrl = `${CONFIG.apiBase}/job-status?jobId=${encodeURIComponent(jobId)}`;
                    const statusResponse = await fetch(statusUrl, {
                        method: 'GET',
                        headers: getAuthHeaders(),
                    });
                    
                    if (statusResponse.ok) {
                        const jobStatus = await statusResponse.json();
                        // Try to restore audio blob from IndexedDB if available
                        let audioUrl = null;
                        try {
                            const audioBlob = await getAudioBlob(fileId);
                            if (audioBlob) {
                                audioUrl = URL.createObjectURL(audioBlob);
                                console.log(`[resumeJobs] Restored audio blob URL for ${fileId}`);
                            }
                        } catch (audioError) {
                            console.warn(`[resumeJobs] Could not restore audio blob for ${fileId}:`, audioError);
                        }
                        
                        state.files.set(fileId, {
                            id: fileId,
                            fileName: fileName,
                            fileSize: 0, // File size not available from job status, but we'll show the filename
                            status: jobStatus.status === 'queued' ? 'processing' : jobStatus.status,
                            progress: jobStatus.progress || 0,
                            error: jobStatus.errorMessage || null,
                            transcript: null,
                            objectKey: null,
                            jobId: jobId,
                            isLargeFile: true,
                            audioUrl: audioUrl, // Restored from IndexedDB if available
                        });
                        
                        // If job is still queued, try to trigger it
                        if (jobStatus.status === 'queued') {
                            console.log(`[resumeJobs] Job ${jobId} is still queued, attempting to trigger...`);
                            // Try to trigger the job manually (fire-and-forget)
                            fetch(`${CONFIG.apiBase}/trigger-job`, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    ...getAuthHeaders(),
                                },
                                body: JSON.stringify({ jobId }),
                            }).then(async response => {
                                try {
                                if (response.ok) {
                                    console.log(`[resumeJobs] ✅ Successfully triggered job ${jobId}`);
                                        return;
                                    }
                                    
                                    // Parse error response with proper error handling
                                    let errorData = {};
                                    try {
                                        errorData = await response.json();
                                    } catch (parseError) {
                                        console.warn(`[resumeJobs] Could not parse error response for job ${jobId}:`, parseError);
                                    }
                                    
                                    // If job doesn't exist (404) or is not queued (400), clean up
                                    if (response.status === 404 || response.status === 400) {
                                        console.log(`[resumeJobs] Job ${jobId} cannot be triggered (${response.status}), removing from localStorage`);
                                        localStorage.removeItem(key);
                                        // Remove from state if it exists
                                        if (state.files.has(fileId)) {
                                            state.files.delete(fileId);
                                            updateQueueDisplay();
                                        }
                                        return;
                                    }
                                    console.error(`[resumeJobs] ⚠️ Failed to trigger job ${jobId}: ${response.status}`, errorData);
                                } catch (error) {
                                    // Handle any errors in the async handler
                                    console.error(`[resumeJobs] ❌ Error processing response for job ${jobId}:`, error);
                                }
                            }).catch(err => {
                                console.error(`[resumeJobs] ❌ Error triggering job ${jobId}:`, err);
                            });
                        }
                        
                        // Start polling for this job
                        pollJobStatus(jobId, fileId);
                        console.log(`[resumeJobs] Resumed job ${jobId} for file ${fileName} (placeholder)`);
                    } else {
                        // Job status fetch failed (shouldn't happen since we verified above, but handle it)
                        console.warn(`[resumeJobs] Could not fetch job status for ${jobId} (${statusResponse.status}), skipping`);
                        continue;
                    }
                } catch (fetchError) {
                    console.error(`[resumeJobs] Error fetching job status for ${jobId}:`, fetchError);
                    continue;
                }
            }
        } catch (error) {
            console.error(`[resumeJobs] Error resuming job from ${key}:`, error);
            localStorage.removeItem(key); // Remove invalid entry
        }
    }
    
    if (jobKeys.length > 0) {
        updateQueueDisplay();
        if (elements.queueContainer) {
            elements.queueContainer.style.display = 'block';
        }
    }
}

function getAuthHeaders() {
    // Get token from URL or localStorage
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token') || localStorage.getItem('clems_token');
    
    if (token) {
        return { 'X-Clems-Token': token };
    }
    // Return empty object - backend will handle if token is required
    return {};
}

function showResult(fileId, fileData) {
    // Validate that transcript data exists and is complete
    if (!fileData) {
        console.error('[showResult] fileData is missing for fileId:', fileId);
        showError('Cannot display result: file data is missing');
        return;
    }
    
    if (!fileData.transcript) {
        console.error('[showResult] transcript is missing for fileId:', fileId, 'fileData:', fileData);
        showError('Cannot display result: transcript is not available yet. Please wait for transcription to complete.');
        return;
    }
    
    const transcript = fileData.transcript;
    
    // Validate transcript structure
    if (!transcript.transcriptText && !transcript.text) {
        console.error('[showResult] transcript text is missing for fileId:', fileId, 'transcript:', transcript);
        showError('Cannot display result: transcript text is empty. Please try refreshing the page.');
        return;
    }
    
    const resultDiv = document.createElement('div');
    resultDiv.className = 'result-item';
    resultDiv.id = `result-${fileId}`;

    // Use transcriptText or fallback to text property
    const transcriptText = transcript.transcriptText || transcript.text || '';
    const isCollapsed = transcriptText.length > 500;
    const hasSegments = transcript.segments && Array.isArray(transcript.segments) && transcript.segments.length > 0;
    
    // Check if audioUrl exists (we'll verify validity and restore from IndexedDB if needed)
    let hasAudio = fileData.audioUrl !== null && fileData.audioUrl !== undefined;

    // Build transcript HTML with word-level highlighting if segments available
    let transcriptHTML = '';
    if (hasSegments) {
        transcriptHTML = buildHighlightedTranscript(transcript.segments, transcriptText);
    } else {
        transcriptHTML = escapeHtml(transcriptText);
    }

    // Helper function to escape for JavaScript string literals (handles single quotes and special chars)
    const escapeJsString = (str) => {
        return String(str)
            .replace(/\\/g, '\\\\')  // Escape backslashes first
            .replace(/'/g, "\\'")    // Escape single quotes
            .replace(/"/g, '\\"')    // Escape double quotes
            .replace(/\n/g, '\\n')   // Escape newlines
            .replace(/\r/g, '\\r')   // Escape carriage returns
            .replace(/\t/g, '\\t')    // Escape tabs
            .replace(/</g, '\\x3C')   // Escape < to prevent HTML injection
            .replace(/>/g, '\\x3E');  // Escape > to prevent HTML injection
    };
    
    const escapedFileId = escapeJsString(fileId);

    resultDiv.innerHTML = `
        <div class="result-header">
            <div class="result-title-container">
                <input type="checkbox" class="batch-checkbox" id="batchCheck-${escapeHtml(fileId)}" 
                       onclick="toggleBatchSelect('${escapedFileId}')" 
                       style="display: ${state.batchMode ? 'block' : 'none'};">
                <div class="result-title">${escapeHtml(transcript.fileName || fileData.fileName || 'Untitled')}</div>
                <div class="result-tags" id="tags-${escapeHtml(fileId)}"></div>
            </div>
            <div class="result-actions">
                <button class="btn btn-copy" onclick="copyTranscript('${escapedFileId}')">Copy</button>
                <div class="btn-dropdown">
                    <button class="btn btn-download" onclick="toggleDownloadMenu('${escapedFileId}')">
                        Download ▼
                    </button>
                    <div class="dropdown-menu" id="downloadMenu-${escapeHtml(fileId)}" style="display: none;">
                        <a href="#" onclick="downloadTxt('${escapedFileId}'); return false;">TXT</a>
                        <a href="#" onclick="downloadPdf('${escapedFileId}'); return false;">PDF</a>
                        ${hasSegments ? `<a href="#" onclick="downloadSrt('${escapedFileId}'); return false;">SRT</a>` : ''}
                        <a href="#" onclick="downloadJson('${escapedFileId}'); return false;">JSON</a>
                        ${hasAudio ? `<a href="#" onclick="downloadOriginalAudio('${escapedFileId}'); return false;">Original Audio</a>` : ''}
                    </div>
                </div>
                <button class="btn btn-edit" id="editBtn-${escapeHtml(fileId)}" onclick="toggleEditTranscript('${escapedFileId}')">
                    <span class="edit-icon">✏️</span>
                    <span class="edit-text">Edit</span>
                </button>
                <button class="btn btn-analyze" id="analyzeBtn-${escapeHtml(fileId)}" onclick="analyzeTranscript('${escapedFileId}')">
                    <span class="analyze-icon">🎓</span>
                    <span class="analyze-text">AI Analysis</span>
                </button>
            </div>
        </div>
        <div class="transcript-search-container" id="searchContainer-${fileId}">
            <input type="text" class="transcript-search-input" id="searchInput-${fileId}" 
                   placeholder="Search in transcript..." 
                   oninput="searchInTranscript('${fileId}', this.value)"
                   onkeydown="handleSearchKeydown(event, '${fileId}')">
            <div class="search-results-info" id="searchResults-${fileId}" style="display: none;">
                <span id="searchCount-${fileId}">0</span> matches
                <button class="btn-search-nav" onclick="navigateSearch('${fileId}', -1)" title="Previous (↑)">↑</button>
                <button class="btn-search-nav" onclick="navigateSearch('${fileId}', 1)" title="Next (↓)">↓</button>
                <button class="btn-search-close" onclick="clearSearch('${fileId}')" title="Clear (Esc)">×</button>
            </div>
        </div>
        ${hasAudio ? `
            <div class="audio-player-container" id="audioPlayer-${fileId}">
                <audio id="audio-${fileId}" preload="metadata">
                    <source src="${fileData.audioUrl}" type="${fileData.file?.type || 'audio/webm'}">
                </audio>
                <div class="audio-controls">
                    <button class="btn-audio-play" id="playBtn-${fileId}" onclick="toggleAudioPlayback('${fileId}')">
                        <span class="play-icon">▶</span>
                        <span class="pause-icon" style="display: none;">⏸</span>
                    </button>
                    <button class="btn-audio-skip" onclick="skipAudio('${fileId}', -10)" title="Skip back 10s (←)">
                        ⏪ 10s
                    </button>
                    <button class="btn-audio-skip" onclick="skipAudio('${fileId}', 10)" title="Skip forward 10s (→)">
                        10s ⏩
                    </button>
                    <div class="audio-progress-container">
                        <div class="audio-progress-bar" id="progressBar-${fileId}" onclick="seekAudio('${fileId}', event)">
                            <div class="audio-progress-fill" id="progressFill-${fileId}"></div>
                        </div>
                        <div class="audio-time">
                            <span id="currentTime-${fileId}">0:00</span> / <span id="duration-${fileId}">0:00</span>
                        </div>
                    </div>
                    <div class="audio-speed-control">
                        <label>Speed:</label>
                        <select class="audio-speed-select" id="speedSelect-${fileId}" onchange="setPlaybackSpeed('${fileId}', this.value)">
                            <option value="0.5">0.5x</option>
                            <option value="0.75">0.75x</option>
                            <option value="1" selected>1x</option>
                            <option value="1.25">1.25x</option>
                            <option value="1.5">1.5x</option>
                            <option value="2">2x</option>
                        </select>
                    </div>
                    <div class="audio-volume-control">
                        <label>Volume:</label>
                        <input type="range" class="audio-volume-slider" id="volumeSlider-${fileId}" 
                               min="0" max="100" value="100" 
                               oninput="setVolume('${fileId}', this.value)">
                        <span class="volume-value" id="volumeValue-${fileId}">100%</span>
                    </div>
                </div>
            </div>
        ` : ''}
        <div class="transcript-preview ${isCollapsed ? 'collapsed' : ''}" id="preview-${fileId}">
            ${transcriptHTML}
        </div>
        <textarea class="transcript-editor" id="editor-${fileId}" style="display: none;">${escapeHtml(transcriptText)}</textarea>
        <div class="edit-actions" id="editActions-${fileId}" style="display: none;">
            <button class="btn btn-save" onclick="saveEditedTranscript('${fileId}')">Save Changes</button>
            <button class="btn btn-cancel" onclick="cancelEditTranscript('${fileId}')">Cancel</button>
        </div>
        ${isCollapsed ? `
            <button class="toggle-preview" onclick="togglePreview('${fileId}')">Show more</button>
        ` : ''}
        <div class="transcript-metadata" style="margin-top: 10px; color: #a0aec0; font-size: 0.9rem;">
            ${transcript.segments ? `
                Language: ${transcript.language || 'auto'} | 
                Model: ${transcript.modelUsed || 'whisper-1'} | 
                Duration: ${(transcript.elapsedMs / 1000).toFixed(1)}s |
            ` : ''}
            <span id="wordCount-${fileId}">${calculateWordCount(transcriptText)} words</span> | 
            <span id="readingTime-${fileId}">~${calculateReadingTime(transcriptText)} min read</span>
        </div>
    `;

    if (!elements.resultsContainer) {
        console.warn('[showResult] resultsContainer element not found');
        return;
    }
    
    elements.resultsContainer.appendChild(resultDiv);
    
    // Add animation class for new results
    resultDiv.classList.add('new-result');
    setTimeout(() => {
        resultDiv.classList.remove('new-result');
    }, 500);

    // Set up audio player if audio is available
    // First, try to restore audio from IndexedDB if audioUrl is missing or invalid
    (async () => {
        if (hasAudio && fileData.audioUrl && isBlobUrlValid(fileData.audioUrl)) {
            // Audio URL is valid, set up player immediately
            setupAudioPlayer(fileId, fileData, hasSegments);
        } else {
            // Try to restore from IndexedDB
            try {
                const audioBlob = await getAudioBlob(fileId);
                if (audioBlob) {
                    fileData.audioUrl = URL.createObjectURL(audioBlob);
                    console.log(`[showResult] Restored audio blob URL for ${fileId} from IndexedDB`);
                    
                    // Update the audio source in the DOM if it exists
                    const audioElement = document.getElementById(`audio-${fileId}`);
                    if (audioElement) {
                        const sourceElement = audioElement.querySelector('source');
                        if (sourceElement) {
                            sourceElement.src = fileData.audioUrl;
                            audioElement.load(); // Reload the audio element
                        }
                    }
                    
                    // Now we have a valid audio URL, set up player
                    setupAudioPlayer(fileId, fileData, hasSegments);
                } else if (hasAudio && fileData.audioUrl) {
                    // Audio URL exists but might be invalid, try to set up player anyway
                    setupAudioPlayer(fileId, fileData, hasSegments);
                }
            } catch (error) {
                console.warn(`[showResult] Could not restore audio blob for ${fileId}:`, error);
                // If we had an audioUrl originally, try to set up player anyway
                if (hasAudio && fileData.audioUrl) {
                    setupAudioPlayer(fileId, fileData, hasSegments);
                }
            }
        }
    })();

    // Store analysis state
    if (!fileData.analysisState) {
        fileData.analysisState = {
            isAnalyzing: false,
            analysis: null,
        };
    }
    
    // Update stats
    updateStats(fileData);
    
    // Save transcript to history
    saveTranscriptToHistory(fileId, fileData);
    
    // Initialize tags display
    updateTagsDisplay(fileId);
}

/**
 * Build highlighted transcript HTML with segment-level timestamps
 * Each segment gets wrapped with timing data for synchronized highlighting
 */
function buildHighlightedTranscript(segments, transcriptText) {
    // Build transcript by mapping segments to their text
    let result = '';
    let textIndex = 0;
    
    segments.forEach((segment, segIndex) => {
        const segmentText = segment.text.trim();
        const segmentStart = segment.start;
        const segmentEnd = segment.end;
        
        // Split segment into words for word-level highlighting
        const words = segmentText.split(/(\s+)/);
        const wordCount = words.filter(w => w.trim()).length;
        const wordDuration = wordCount > 0 ? (segmentEnd - segmentStart) / wordCount : 0;
        
        let wordIndex = 0;
        words.forEach((word, wordPos) => {
            if (!word.trim()) {
                // Preserve whitespace
                result += word;
            } else {
                // Calculate word timing within segment
                const wordStart = segmentStart + (wordIndex * wordDuration);
                const wordEnd = segmentStart + ((wordIndex + 1) * wordDuration);
                
                result += `<span class="transcript-word" data-start="${wordStart.toFixed(2)}" data-end="${wordEnd.toFixed(2)}">${escapeHtml(word)}</span>`;
                wordIndex++;
            }
        });
        
        // Add space between segments (except last)
        if (segIndex < segments.length - 1) {
            result += ' ';
        }
    });
    
    return result;
}

/**
 * Set up audio player with synchronized highlighting
 */
function setupAudioPlayer(fileId, fileData, hasSegments) {
    const audio = document.getElementById(`audio-${fileId}`);
    if (!audio) return;

    const playBtn = document.getElementById(`playBtn-${fileId}`);
    const progressFill = document.getElementById(`progressFill-${fileId}`);
    const currentTimeEl = document.getElementById(`currentTime-${fileId}`);
    const durationEl = document.getElementById(`duration-${fileId}`);
    const preview = document.getElementById(`preview-${fileId}`);
    const volumeSlider = document.getElementById(`volumeSlider-${fileId}`);
    const volumeValue = document.getElementById(`volumeValue-${fileId}`);

    // Initialize volume
    if (volumeSlider) {
        audio.volume = volumeSlider.value / 100;
    }

    // Update duration when metadata loads
    audio.addEventListener('loadedmetadata', () => {
        if (durationEl) {
            durationEl.textContent = formatTime(audio.duration);
        }
    });

    // Update progress bar
    audio.addEventListener('timeupdate', () => {
        if (audio.duration) {
            const progress = (audio.currentTime / audio.duration) * 100;
            if (progressFill) {
                progressFill.style.width = `${progress}%`;
            }
            if (currentTimeEl) {
                currentTimeEl.textContent = formatTime(audio.currentTime);
            }

            // Highlight words if segments are available
            if (hasSegments && preview) {
                highlightWordsAtTime(preview, audio.currentTime);
            }
        }
    });

    // Update play/pause button
    audio.addEventListener('play', () => {
        if (playBtn) {
            playBtn.querySelector('.play-icon').style.display = 'none';
            playBtn.querySelector('.pause-icon').style.display = 'inline';
        }
    });

    audio.addEventListener('pause', () => {
        if (playBtn) {
            playBtn.querySelector('.play-icon').style.display = 'inline';
            playBtn.querySelector('.pause-icon').style.display = 'none';
        }
    });

    // Scroll highlighted word into view
    audio.addEventListener('timeupdate', () => {
        if (hasSegments && preview) {
            const highlightedWord = preview.querySelector('.transcript-word.highlighted');
            if (highlightedWord) {
                highlightedWord.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    });
}

/**
 * Set playback speed
 */
window.setPlaybackSpeed = (fileId, speed) => {
    const audio = document.getElementById(`audio-${fileId}`);
    if (audio) {
        audio.playbackRate = parseFloat(speed);
    }
};

/**
 * Set volume
 */
window.setVolume = (fileId, volume) => {
    const audio = document.getElementById(`audio-${fileId}`);
    const volumeValue = document.getElementById(`volumeValue-${fileId}`);
    if (audio) {
        audio.volume = volume / 100;
    }
    if (volumeValue) {
        volumeValue.textContent = `${volume}%`;
    }
};

/**
 * Skip audio forward/backward
 */
window.skipAudio = (fileId, seconds) => {
    const audio = document.getElementById(`audio-${fileId}`);
    if (audio) {
        audio.currentTime = Math.max(0, Math.min(audio.duration, audio.currentTime + seconds));
    }
};

/**
 * Highlight words at current playback time
 */
function highlightWordsAtTime(container, currentTime) {
    const words = container.querySelectorAll('.transcript-word');
    
    words.forEach(word => {
        const start = parseFloat(word.dataset.start);
        const end = parseFloat(word.dataset.end);
        
        // Remove previous highlight
        word.classList.remove('highlighted', 'highlighted-past');
        
        // Highlight current word
        if (currentTime >= start && currentTime <= end) {
            word.classList.add('highlighted');
        } else if (currentTime > end) {
            word.classList.add('highlighted-past');
        }
    });
}

/**
 * Format time in MM:SS format
 */
function formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Toggle audio playback
 */
window.toggleAudioPlayback = (fileId) => {
    const audio = document.getElementById(`audio-${fileId}`);
    if (!audio) return;

    if (audio.paused) {
        audio.play();
    } else {
        audio.pause();
    }
};

/**
 * Seek audio to clicked position
 */
window.seekAudio = (fileId, event) => {
    const audio = document.getElementById(`audio-${fileId}`);
    const progressBar = document.getElementById(`progressBar-${fileId}`);
    if (!audio || !progressBar) return;

    const rect = progressBar.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const percentage = x / rect.width;
    const newTime = percentage * audio.duration;

    audio.currentTime = newTime;
};

/**
 * Analyze transcript with AI (AP Euro Teacher)
 */
window.analyzeTranscript = async (fileId) => {
    const fileData = state.files.get(fileId);
    if (!fileData || !fileData.transcript) {
        showError('No transcript available for analysis');
        return;
    }

    const analyzeBtn = document.getElementById(`analyzeBtn-${fileId}`);
    if (!analyzeBtn) return;

    // Check if already analyzing
    if (fileData.analysisState?.isAnalyzing) {
        showNotification('Analysis already in progress...');
        return;
    }

    // Check if analysis already exists
    if (fileData.analysisState?.analysis) {
        showAnalysisResults(fileId, fileData);
        return;
    }

    // Start analysis
    if (!fileData.analysisState) {
        fileData.analysisState = {};
    }
    fileData.analysisState.isAnalyzing = true;
    analyzeBtn.disabled = true;
    analyzeBtn.innerHTML = '<span class="spinner"></span> Analyzing...';

    try {
        const transcriptText = fileData.transcript.transcriptText || '';
        
        if (!transcriptText.trim()) {
            throw new Error('Transcript is empty');
        }

        // Check for uploaded files for context
        const contextFiles = fileData.analysisState.contextFiles || [];
        
        // Convert files to base64 for JSON transmission
        const contextFilesBase64 = [];
        if (contextFiles.length > 0) {
            for (const file of contextFiles) {
                try {
                    const base64 = await fileToBase64(file);
                    contextFilesBase64.push({
                        name: file.name,
                        type: file.type,
                        size: file.size,
                        data: base64,
                    });
                } catch (error) {
                    console.error('[analyzeTranscript] Error converting file to base64:', error);
                }
            }
        }
        
        const response = await fetch(`${CONFIG.apiBase}/analyze-transcript`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaders(),
            },
            body: JSON.stringify({
                lecture_transcript: transcriptText,
                context_files: contextFilesBase64,
            }),
        });

        // Handle 504 Gateway Timeout specifically
        if (response.status === 504) {
            throw new Error('Analysis timed out. The function may be processing large context files. Please try again or reduce the size/number of context files.');
        }

        if (!response.ok) {
            let errorData;
            try {
                const responseText = await response.text();
                errorData = responseText ? JSON.parse(responseText) : { error: 'Unknown error' };
            } catch (parseError) {
                console.error('[analyzeTranscript] Failed to parse error response:', parseError);
                errorData = { error: `Analysis failed with status ${response.status}` };
            }
            const errorMessage = errorData.error || errorData.message || `Analysis failed (${response.status})`;
            console.error('[analyzeTranscript] API error response:', errorData);
            throw new Error(errorMessage);
        }

        const result = await response.json();
        
        // Validate response structure
        if (!result) {
            throw new Error('Invalid response from server: empty response');
        }
        
        // Check for analysis in response (could be result.analysis or result.success with analysis)
        const analysis = result.analysis || (result.success && result.analysis) || null;
        
        if (!analysis) {
            console.error('[analyzeTranscript] Invalid response structure:', result);
            throw new Error('Server response missing analysis data. Response: ' + JSON.stringify(result).substring(0, 200));
        }
        
        fileData.analysisState.isAnalyzing = false;
        fileData.analysisState.analysis = analysis;
        
        analyzeBtn.disabled = false;
        analyzeBtn.innerHTML = '<span class="analyze-icon">🎓</span><span class="analyze-text">AI Analysis</span>';
        
        showAnalysisResults(fileId, fileData);
        showNotification('Analysis complete!');
    } catch (error) {
        console.error('[analyzeTranscript] Error:', error);
        console.error('[analyzeTranscript] Error details:', {
            message: error.message,
            stack: error.stack,
            fileId: fileId
        });
        fileData.analysisState.isAnalyzing = false;
        analyzeBtn.disabled = false;
        analyzeBtn.innerHTML = '<span class="analyze-icon">🎓</span><span class="analyze-text">AI Analysis</span>';
        showError('Failed to analyze transcript: ' + (error.message || 'Unknown error'));
    }
};

/**
 * Poll for analysis status (for background functions)
 */
async function pollAnalysisStatus(statusUrl, fileId, analyzeBtn) {
    const maxAttempts = 60; // Poll for up to 5 minutes (5 second intervals)
    let attempts = 0;
    
    const poll = async () => {
        try {
            const response = await fetch(statusUrl, {
                method: 'GET',
                headers: getAuthHeaders(),
            });
            
            if (response.ok) {
                const result = await response.json();
                
                if (result.status === 'completed') {
                    const fileData = state.files.get(fileId);
                    if (fileData) {
                        fileData.analysisState.isAnalyzing = false;
                        fileData.analysisState.analysis = result.analysis;
                        analyzeBtn.disabled = false;
                        analyzeBtn.innerHTML = '<span class="analyze-icon">🎓</span><span class="analyze-text">AI Analysis</span>';
                        showAnalysisResults(fileId, fileData);
                        showNotification('Analysis complete!');
                    }
                    return;
                } else if (result.status === 'error') {
                    const fileData = state.files.get(fileId);
                    if (fileData) {
                        fileData.analysisState.isAnalyzing = false;
                        analyzeBtn.disabled = false;
                        analyzeBtn.innerHTML = '<span class="analyze-icon">🎓</span><span class="analyze-text">AI Analysis</span>';
                        showError('Analysis failed: ' + (result.error || 'Unknown error'));
                    }
                    return;
                } else if (result.status === 'processing') {
                    // Still processing, continue polling
                    attempts++;
                    if (attempts < maxAttempts) {
                        setTimeout(poll, 5000); // Poll every 5 seconds
                    } else {
                        const fileData = state.files.get(fileId);
                        if (fileData) {
                            fileData.analysisState.isAnalyzing = false;
                            analyzeBtn.disabled = false;
                            analyzeBtn.innerHTML = '<span class="analyze-icon">🎓</span><span class="analyze-text">AI Analysis</span>';
                            showError('Analysis timed out. Please try again.');
                        }
                    }
                }
            } else {
                // Error fetching status
                attempts++;
                if (attempts < maxAttempts) {
                    setTimeout(poll, 5000);
                } else {
                    const fileData = state.files.get(fileId);
                    if (fileData) {
                        fileData.analysisState.isAnalyzing = false;
                        analyzeBtn.disabled = false;
                        analyzeBtn.innerHTML = '<span class="analyze-icon">🎓</span><span class="analyze-text">AI Analysis</span>';
                        showError('Failed to get analysis status. Please try again.');
                    }
                }
            }
        } catch (error) {
            console.error('[pollAnalysisStatus] Error:', error);
            attempts++;
            if (attempts < maxAttempts) {
                setTimeout(poll, 5000);
            } else {
                const fileData = state.files.get(fileId);
                if (fileData) {
                    fileData.analysisState.isAnalyzing = false;
                    analyzeBtn.disabled = false;
                    analyzeBtn.innerHTML = '<span class="analyze-icon">🎓</span><span class="analyze-text">AI Analysis</span>';
                    showError('Analysis polling failed. Please try again.');
                }
            }
        }
    };
    
    // Start polling after 2 seconds
    setTimeout(poll, 2000);
}

/**
 * Display analysis results
 */
function showAnalysisResults(fileId, fileData) {
    const resultDiv = document.getElementById(`result-${fileId}`);
    if (!resultDiv || !fileData.analysisState?.analysis) return;

    // Check if analysis section already exists
    let analysisSection = resultDiv.querySelector('.analysis-section');
    
    if (!analysisSection) {
        // Create analysis section
        analysisSection = document.createElement('div');
        analysisSection.className = 'analysis-section';
        analysisSection.innerHTML = `
            <div class="analysis-header">
                <h3 class="analysis-title">🎓 AP Euro AI Analysis</h3>
                <div class="analysis-actions">
                    <button class="btn-upload-context" onclick="uploadContextFiles('${fileId}')" title="Upload reference documents">
                        📎 Add Context Files
                    </button>
                    <button class="btn-close-analysis" onclick="closeAnalysis('${fileId}')">×</button>
                </div>
            </div>
            <div class="analysis-content" id="analysisContent-${fileId}"></div>
        `;
        
        // Insert after transcript preview
        const preview = resultDiv.querySelector('.transcript-preview');
        if (preview && preview.nextSibling) {
            resultDiv.insertBefore(analysisSection, preview.nextSibling);
        } else {
            resultDiv.appendChild(analysisSection);
        }
    }

    // Format and display analysis
    const analysisContent = document.getElementById(`analysisContent-${fileId}`);
    if (analysisContent) {
        // Convert markdown-style formatting to HTML
        const formattedAnalysis = formatAnalysisText(fileData.analysisState.analysis);
        analysisContent.innerHTML = formattedAnalysis;
    }
}

/**
 * Format analysis text (convert markdown-style to HTML)
 */
function formatAnalysisText(text) {
    if (!text) return '';
    
    // Escape HTML first
    let html = escapeHtml(text);
    
    // Convert headings (## Heading -> <h3>Heading</h3>)
    html = html.replace(/^### (.*$)/gim, '<h4>$1</h4>');
    html = html.replace(/^## (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^# (.*$)/gim, '<h2>$1</h2>');
    
    // Convert numbered sections (1️⃣ -> <h3>)
    html = html.replace(/1️⃣/g, '<h3>1️⃣');
    html = html.replace(/2️⃣/g, '</h3><h3>2️⃣');
    html = html.replace(/3️⃣/g, '</h3><h3>3️⃣');
    html = html.replace(/4️⃣/g, '</h3><h3>4️⃣');
    html = html.replace(/5️⃣/g, '</h3><h3>5️⃣');
    html = html.replace(/6️⃣/g, '</h3><h3>6️⃣');
    html = html.replace(/7️⃣/g, '</h3><h3>7️⃣');
    html = html.replace(/8️⃣/g, '</h3><h3>8️⃣');
    html = html.replace(/✍️/g, '</h3><h3>✍️');
    
    // Convert bold (**text** -> <strong>text</strong>)
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Convert bullet points (- -> <li>)
    html = html.replace(/^[-•]\s+(.*$)/gim, '<li>$1</li>');
    
    // Wrap consecutive <li> in <ul>
    html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');
    
    // Convert line breaks
    html = html.replace(/\n\n/g, '</p><p>');
    html = html.replace(/\n/g, '<br>');
    
    // Wrap in paragraphs
    html = '<p>' + html + '</p>';
    
    return html;
}

/**
 * Close analysis section
 */
window.closeAnalysis = (fileId) => {
    const resultDiv = document.getElementById(`result-${fileId}`);
    if (!resultDiv) return;
    
    const analysisSection = resultDiv.querySelector('.analysis-section');
    if (analysisSection) {
        analysisSection.remove();
    }
};

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

/**
 * Download SRT subtitle file
 */
window.downloadSrt = (fileId) => {
    const fileData = state.files.get(fileId);
    if (!fileData?.transcript) return;
    
    const segments = fileData.transcript.segments;
    if (!segments || !Array.isArray(segments) || segments.length === 0) {
        showError('SRT export requires timestamped segments. This transcript does not have timestamps.');
        return;
    }
    
    let srtContent = '';
    segments.forEach((segment, index) => {
        const start = formatSrtTime(segment.start);
        const end = formatSrtTime(segment.end);
        srtContent += `${index + 1}\n${start} --> ${end}\n${segment.text.trim()}\n\n`;
    });
    
    const blob = new Blob([srtContent], { type: 'text/srt' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileData.fileName.replace(/\.[^/.]+$/, '')}_transcript.srt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showNotification('SRT file downloaded');
};

/**
 * Format time for SRT (HH:MM:SS,mmm)
 */
function formatSrtTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const milliseconds = Math.floor((seconds % 1) * 1000);
    
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(milliseconds).padStart(3, '0')}`;
}

/**
 * Download JSON transcript
 * NOTE: This function is defined later in the file (line ~3226) with tags support.
 * This duplicate definition is removed to prevent inconsistency.
 */

/**
 * Download original audio file
 */
window.downloadOriginalAudio = (fileId) => {
    const fileData = state.files.get(fileId);
    if (!fileData) return;
    
    if (fileData.audioUrl) {
        // Download from blob URL
        const a = document.createElement('a');
        a.href = fileData.audioUrl;
        a.download = fileData.fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        showNotification('Audio file downloaded');
    } else if (fileData.objectKey) {
        // Try to get download URL from server
        showError('Audio file not available for download. It may have been processed and removed.');
    } else {
        showError('Audio file not found');
    }
};

window.downloadPdf = async (fileId) => {
    const fileData = state.files.get(fileId);
    if (!fileData?.transcript) return;

    try {
        const { PDFDocument, rgb, StandardFonts } = PDFLib;
        
        const pdfDoc = await PDFDocument.create();
        let page = pdfDoc.addPage([612, 792]); // US Letter size (let, not const, for page reassignment)
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

/**
 * Recording Functions
 */

async function startRecording() {
    try {
        // Request microphone access
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
            } 
        });

        state.recording.stream = stream;
        state.recording.isRecording = true;
        state.recording.audioChunks = [];
        state.recording.startTime = Date.now();

        // Set up Web Audio API for visualization
        setupAudioVisualization(stream);

        // Determine best MIME type (prefer webm, fallback to default)
        let mimeType = 'audio/webm;codecs=opus';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = 'audio/webm';
        }
        if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = ''; // Use browser default
        }

        const mediaRecorder = new MediaRecorder(stream, {
            mimeType: mimeType,
        });

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                state.recording.audioChunks.push(event.data);
                // Update file size display
                updateRecordingSize();
            }
        };

        mediaRecorder.onstop = async () => {
            // Create audio blob
            const audioBlob = new Blob(state.recording.audioChunks, { 
                type: mimeType || 'audio/webm' 
            });

            // Create File object from blob
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const fileName = `recording-${timestamp}.webm`;
            const audioFile = new File([audioBlob], fileName, { 
                type: audioBlob.type,
                lastModified: Date.now(),
            });

            // Create blob URL for playback
            const audioUrl = URL.createObjectURL(audioBlob);

            // Stop all tracks
            state.recording.stream.getTracks().forEach(track => track.stop());

            // Stop audio visualization
            stopAudioVisualization();

            // Reset recording state
            state.recording.isRecording = false;
            state.recording.mediaRecorder = null;
            state.recording.stream = null;
            state.recording.audioChunks = [];
            if (state.recording.timerInterval) {
                clearInterval(state.recording.timerInterval);
                state.recording.timerInterval = null;
            }

            // Update UI
            updateRecordingUI(false);

            // Add to file queue with audio URL
            const fileId = generateFileId();
            const fileData = {
                fileId: fileId,
                file: audioFile,
                fileName: fileName,
                fileSize: audioBlob.size,
                status: 'queued',
                progress: 0,
                transcript: null,
                audioUrl: audioUrl, // Store blob URL for playback
            };
            state.files.set(fileId, fileData);
            
            // Store audio blob in IndexedDB for persistence across page refreshes
            storeAudioBlob(fileId, audioBlob).catch(error => {
                console.warn(`[startRecording] Failed to store audio blob in IndexedDB for ${fileId}:`, error);
                // Continue anyway - audio playback will work until page refresh
            });
            
            updateQueueDisplay();
            processQueue();
            showNotification('Recording saved! Added to queue.');
        };

        state.recording.mediaRecorder = mediaRecorder;
        mediaRecorder.start(1000); // Collect data every second

        // Start timer
        updateRecordingUI(true);
        startRecordingTimer();

        showNotification('Recording started!');
    } catch (error) {
        console.error('[startRecording] Error:', error);
        showError('Failed to start recording: ' + (error.message || 'Microphone access denied'));
        state.recording.isRecording = false;
        updateRecordingUI(false);
    }
}

function stopRecording() {
    if (state.recording.mediaRecorder && state.recording.isRecording) {
        state.recording.mediaRecorder.stop();
        showNotification('Stopping recording...');
    }
}

function startRecordingTimer() {
    if (state.recording.timerInterval) {
        clearInterval(state.recording.timerInterval);
    }

    state.recording.timerInterval = setInterval(() => {
        if (state.recording.isRecording && state.recording.startTime && elements.recordingTimer) {
            const elapsed = Math.floor((Date.now() - state.recording.startTime) / 1000);
            const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
            const seconds = (elapsed % 60).toString().padStart(2, '0');
            elements.recordingTimer.textContent = `${minutes}:${seconds}`;
        }
        // Update file size periodically
        updateRecordingSize();
    }, 100);
}

/**
 * Update recording file size display
 */
function updateRecordingSize() {
    if (!elements.recordingSize || !state.recording.isRecording) return;

    // Calculate total size from all chunks
    let totalSize = 0;
    if (state.recording.audioChunks && state.recording.audioChunks.length > 0) {
        totalSize = state.recording.audioChunks.reduce((sum, chunk) => sum + chunk.size, 0);
    }

    // Format as MB
    const sizeMB = (totalSize / (1024 * 1024)).toFixed(2);
    elements.recordingSize.textContent = `${sizeMB} MB`;
}

function updateRecordingUI(isRecording) {
    if (!elements.recordBtn || !elements.recordingStatus) return;

    if (isRecording) {
        elements.recordBtn.style.display = 'none';
        elements.recordingStatus.style.display = 'flex';
        if (elements.waveformContainer) {
            elements.waveformContainer.style.display = 'block';
        }
    } else {
        elements.recordBtn.style.display = 'flex';
        elements.recordingStatus.style.display = 'none';
        if (elements.waveformContainer) {
            elements.waveformContainer.style.display = 'none';
        }
        if (elements.recordingTimer) {
            elements.recordingTimer.textContent = '00:00';
        }
        if (elements.recordingSize) {
            elements.recordingSize.textContent = '0 MB';
        }
        // Clear canvas
        if (elements.waveformCanvas) {
            const ctx = elements.waveformCanvas.getContext('2d');
            ctx.clearRect(0, 0, elements.waveformCanvas.width, elements.waveformCanvas.height);
        }
    }
}

/**
 * Audio Visualization Functions
 */

function setupAudioVisualization(stream) {
    try {
        // Create AudioContext
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const audioContext = new AudioContext();
        state.recording.audioContext = audioContext;

        // Create analyser node
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048; // Higher = more detail, lower = better performance
        analyser.smoothingTimeConstant = 0.8;
        state.recording.analyser = analyser;

        // Create data array for frequency data
        const bufferLength = analyser.frequencyBinCount;
        state.recording.dataArray = new Uint8Array(bufferLength);

        // Connect stream to analyser
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);

        // Set up canvas
        if (elements.waveformCanvas) {
            const canvas = elements.waveformCanvas;
            resizeCanvas();
            // Handle window resize
            window.addEventListener('resize', resizeCanvas);
        }

        // Start visualization loop
        visualize();
    } catch (error) {
        console.error('[setupAudioVisualization] Error:', error);
    }
}

function visualize() {
    if (!state.recording.isRecording || !state.recording.analyser || !elements.waveformCanvas) {
        return;
    }

    const canvas = elements.waveformCanvas;
    const ctx = canvas.getContext('2d');
    const analyser = state.recording.analyser;
    const dataArray = state.recording.dataArray;

    // Get frequency data
    analyser.getByteFrequencyData(dataArray);

    // Clear canvas
    ctx.fillStyle = 'rgba(7, 21, 42, 0.9)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw waveform
    drawWaveform(ctx, canvas, dataArray);

    // Draw frequency bars
    drawFrequencyBars(ctx, canvas, dataArray);

    // Update audio level
    updateAudioLevel(dataArray);

    // Continue animation
    state.recording.animationFrame = requestAnimationFrame(visualize);
}

function drawWaveform(ctx, canvas, dataArray) {
    const centerY = canvas.height / 2;
    const sliceWidth = canvas.width / dataArray.length;
    let x = 0;

    ctx.strokeStyle = '#1da1f2';
    ctx.lineWidth = 2;
    ctx.beginPath();

    for (let i = 0; i < dataArray.length; i++) {
        const v = dataArray[i] / 255.0;
        const y = centerY - (v * centerY * 0.8);

        if (i === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }

        x += sliceWidth;
    }

    ctx.stroke();

    // Draw mirrored waveform
    ctx.beginPath();
    x = 0;
    for (let i = 0; i < dataArray.length; i++) {
        const v = dataArray[i] / 255.0;
        const y = centerY + (v * centerY * 0.8);

        if (i === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }

        x += sliceWidth;
    }
    ctx.stroke();
}

function drawFrequencyBars(ctx, canvas, dataArray) {
    const barCount = 64; // Number of bars to display
    const barWidth = canvas.width / barCount;
    const barGap = 2;

    for (let i = 0; i < barCount; i++) {
        const dataIndex = Math.floor((i / barCount) * dataArray.length);
        const barHeight = (dataArray[dataIndex] / 255) * canvas.height * 0.9;

        // Create gradient for bars
        const gradient = ctx.createLinearGradient(
            i * barWidth, canvas.height - barHeight,
            i * barWidth, canvas.height
        );
        
        // Color based on frequency (low = blue, mid = purple, high = pink)
        const hue = (i / barCount) * 360;
        gradient.addColorStop(0, `hsl(${hue}, 70%, 60%)`);
        gradient.addColorStop(1, `hsl(${hue}, 100%, 40%)`);

        ctx.fillStyle = gradient;
        ctx.fillRect(
            i * barWidth + barGap,
            canvas.height - barHeight,
            barWidth - barGap * 2,
            barHeight
        );

        // Add glow effect
        ctx.shadowBlur = 10;
        ctx.shadowColor = `hsl(${hue}, 70%, 60%)`;
        ctx.fillRect(
            i * barWidth + barGap,
            canvas.height - barHeight,
            barWidth - barGap * 2,
            barHeight
        );
        ctx.shadowBlur = 0;
    }
}

function updateAudioLevel(dataArray) {
    if (!elements.levelBar || !elements.levelValue) return;

    // Calculate average level
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
    }
    const average = sum / dataArray.length;
    const percentage = Math.round((average / 255) * 100);

    // Update level bar
    elements.levelBar.style.width = `${percentage}%`;
    elements.levelValue.textContent = `${percentage}%`;

    // Color based on level
    if (percentage < 30) {
        elements.levelBar.style.background = '#22c55e'; // Green
    } else if (percentage < 70) {
        elements.levelBar.style.background = '#f59e0b'; // Orange
    } else {
        elements.levelBar.style.background = '#ef4444'; // Red
    }
}

function resizeCanvas() {
    if (!elements.waveformCanvas) return;
    const canvas = elements.waveformCanvas;
    const rect = canvas.getBoundingClientRect();
    // Use device pixel ratio for crisp rendering on high-DPI displays
    const dpr = window.devicePixelRatio || 1;
    canvas.width = (rect.width || 800) * dpr;
    canvas.height = 200 * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    // Set CSS size to maintain visual size
    canvas.style.width = (rect.width || 800) + 'px';
    canvas.style.height = '200px';
}

function stopAudioVisualization() {
    if (state.recording.animationFrame) {
        cancelAnimationFrame(state.recording.animationFrame);
        state.recording.animationFrame = null;
    }

    if (state.recording.audioContext) {
        state.recording.audioContext.close().catch(err => {
            console.error('[stopAudioVisualization] Error closing audio context:', err);
        });
        state.recording.audioContext = null;
    }

    state.recording.analyser = null;
    state.recording.dataArray = null;

    // Remove resize listener
    window.removeEventListener('resize', resizeCanvas);
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

/**
 * Setup keyboard shortcuts
 */
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Don't trigger shortcuts when typing in inputs
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
            return;
        }

        // Ctrl+K or Cmd+K: Clear queue
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            clearQueue();
        }

        // Ctrl+O or Cmd+O: Select files
        if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
            e.preventDefault();
            if (elements.fileInput) {
                elements.fileInput.click();
            }
        }

        // ?: Show shortcuts
        if (e.key === '?' && !e.shiftKey) {
            e.preventDefault();
            showShortcutsModal();
        }

        // Esc: Close modals
        if (e.key === 'Escape') {
            closeShortcutsModal();
        }

        // Space: Start/Stop recording (when not in input)
        if (e.key === ' ' && !e.target.tagName.match(/INPUT|TEXTAREA|BUTTON/)) {
            e.preventDefault();
            if (state.recording.isRecording) {
                stopRecording();
            } else if (elements.recordBtn && elements.recordBtn.style.display !== 'none') {
                startRecording();
            }
        }
    });
}

/**
 * Show keyboard shortcuts modal
 */
function showShortcutsModal() {
    const modal = document.getElementById('shortcutsModal');
    if (modal) {
        modal.style.display = 'flex';
    }
}

/**
 * Close keyboard shortcuts modal
 */
window.closeShortcutsModal = () => {
    const modal = document.getElementById('shortcutsModal');
    if (modal) {
        modal.style.display = 'none';
    }
};

/**
 * Clear queue
 */
window.clearQueue = () => {
    if (confirm('Are you sure you want to clear the queue? This will remove all queued files.')) {
        // Remove all queued files
        for (const [fileId, fileData] of state.files) {
            if (fileData.status === 'queued') {
                // Stop any polling
                if (fileData.jobId && state.activeJobs.has(fileData.jobId)) {
                    const jobInfo = state.activeJobs.get(fileData.jobId);
                    if (jobInfo.pollInterval) {
                        clearInterval(jobInfo.pollInterval);
                    }
                    state.activeJobs.delete(fileData.jobId);
                }
                state.files.delete(fileId);
            }
        }
        updateQueueDisplay();
        showNotification('Queue cleared');
    }
};

/**
 * Clear results
 */
window.clearResults = () => {
    if (confirm('Are you sure you want to clear all results?')) {
        if (elements.resultsContainer) {
            elements.resultsContainer.innerHTML = '';
        }
        showNotification('Results cleared');
    }
};

/**
 * Export all transcripts
 */
window.exportAllTranscripts = async () => {
    const transcripts = [];
    for (const [fileId, fileData] of state.files) {
        if (fileData.transcript && fileData.transcript.transcriptText) {
            transcripts.push({
                fileName: fileData.fileName,
                text: fileData.transcript.transcriptText,
            });
        }
    }

    if (transcripts.length === 0) {
        showError('No transcripts to export');
        return;
    }

    try {
        const { PDFDocument, rgb, StandardFonts } = PDFLib;
        const pdfDoc = await PDFDocument.create();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        let page = pdfDoc.addPage([612, 792]);
        const margin = 50;
        const maxWidth = page.getWidth() - 2 * margin;
        let y = page.getHeight() - margin;

        // Title
        page.drawText('All Transcripts Export', {
            x: margin,
            y: y,
            size: 20,
            font: boldFont,
            color: rgb(0, 0, 0),
        });
        y -= 30;

        for (const transcript of transcripts) {
            // Check if we need a new page
            if (y < margin + 100) {
                page = pdfDoc.addPage([612, 792]);
                y = page.getHeight() - margin;
            }

            // File name
            page.drawText(transcript.fileName, {
                x: margin,
                y: y,
                size: 14,
                font: boldFont,
                color: rgb(0, 0, 0),
            });
            y -= 20;

            // Transcript text
            const lines = wrapText(transcript.text, maxWidth, font, 11);
            for (const line of lines) {
                if (y < margin + 20) {
                    page = pdfDoc.addPage([612, 792]);
                    y = page.getHeight() - margin;
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

            y -= 20; // Space between transcripts
        }

        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `all_transcripts_${new Date().toISOString().split('T')[0]}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showNotification(`Exported ${transcripts.length} transcript(s)`);
    } catch (error) {
        console.error('[exportAllTranscripts] Error:', error);
        showError('Failed to export transcripts');
    }
};

/**
 * Load and display stats
 */
function loadStats() {
    const stats = JSON.parse(localStorage.getItem('clemens_stats') || '{}');
    
    const totalProcessed = stats.totalProcessed || 0;
    const totalMinutes = stats.totalMinutes || 0;
    
    const totalProcessedEl = document.getElementById('totalProcessed');
    const totalTimeEl = document.getElementById('totalTime');
    
    if (totalProcessedEl) {
        animateValue(totalProcessedEl, 0, totalProcessed, 1000);
    }
    if (totalTimeEl) {
        animateValue(totalTimeEl, 0, totalMinutes, 1000);
    }
}

/**
 * Animate number value
 */
function animateValue(element, start, end, duration) {
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const current = Math.floor(progress * (end - start) + start);
        element.textContent = current.toLocaleString();
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}

/**
 * Update stats
 */
function updateStats(fileData) {
    const stats = JSON.parse(localStorage.getItem('clemens_stats') || '{}');
    
    if (fileData.status === 'done' && fileData.transcript) {
        stats.totalProcessed = (stats.totalProcessed || 0) + 1;
        
        // Estimate minutes from file size (rough estimate: 1MB ≈ 1 minute)
        const estimatedMinutes = Math.max(1, Math.round((fileData.fileSize || 0) / (1024 * 1024)));
        stats.totalMinutes = (stats.totalMinutes || 0) + estimatedMinutes;
        
        localStorage.setItem('clemens_stats', JSON.stringify(stats));
        
        // Update display
        const totalProcessedEl = document.getElementById('totalProcessed');
        const totalTimeEl = document.getElementById('totalTime');
        
        if (totalProcessedEl) {
            animateValue(totalProcessedEl, parseInt(totalProcessedEl.textContent) || 0, stats.totalProcessed, 500);
        }
        if (totalTimeEl) {
            animateValue(totalTimeEl, parseInt(totalTimeEl.textContent) || 0, stats.totalMinutes, 500);
        }
    }
}

/**
 * Search within transcript
 */
window.searchInTranscript = (fileId, searchTerm) => {
    const preview = document.getElementById(`preview-${fileId}`);
    const searchResults = document.getElementById(`searchResults-${fileId}`);
    const searchCount = document.getElementById(`searchCount-${fileId}`);
    
    if (!preview || !searchTerm.trim()) {
        clearSearch(fileId);
        return;
    }
    
    // Remove previous highlights
    const words = preview.querySelectorAll('.transcript-word, span');
    words.forEach(word => {
        word.classList.remove('search-match', 'search-active');
        const originalText = word.getAttribute('data-original') || word.textContent;
        if (word.getAttribute('data-original')) {
            word.textContent = originalText;
            word.removeAttribute('data-original');
        }
    });
    
    // Search in text content
    const text = preview.textContent || preview.innerText;
    const regex = new RegExp(`(${escapeRegex(searchTerm)})`, 'gi');
    const matches = text.match(regex);
    
    if (!matches || matches.length === 0) {
        if (searchResults) {
            searchResults.style.display = 'none';
        }
        return;
    }
    
    // Highlight matches
    let matchIndex = 0;
    const walker = document.createTreeWalker(
        preview,
        NodeFilter.SHOW_TEXT,
        null,
        false
    );
    
    const textNodes = [];
    let node;
    while (node = walker.nextNode()) {
        if (node.textContent.trim()) {
            textNodes.push(node);
        }
    }
    
    textNodes.forEach(textNode => {
        const parent = textNode.parentElement;
        if (parent.classList.contains('search-match')) return;
        
        const nodeText = textNode.textContent;
        if (regex.test(nodeText)) {
            const highlighted = nodeText.replace(regex, (match) => {
                const span = document.createElement('span');
                span.className = 'search-match';
                span.setAttribute('data-match-index', matchIndex++);
                span.textContent = match;
                return span.outerHTML;
            });
            
            const wrapper = document.createElement('span');
            wrapper.innerHTML = highlighted;
            textNode.parentNode.replaceChild(wrapper, textNode);
        }
    });
    
    // Update search results info
    if (searchResults) {
        searchResults.style.display = 'flex';
        searchCount.textContent = matches.length;
    }
    
    // Highlight first match
    navigateSearch(fileId, 0);
};

/**
 * Navigate search results
 */
window.navigateSearch = (fileId, direction) => {
    const preview = document.getElementById(`preview-${fileId}`);
    if (!preview) return;
    
    const matches = Array.from(preview.querySelectorAll('.search-match'));
    if (matches.length === 0) return;
    
    const currentActive = preview.querySelector('.search-active');
    let currentIndex = currentActive ? matches.indexOf(currentActive) : -1;
    
    if (direction === 0) {
        currentIndex = 0;
    } else {
        currentIndex += direction;
        if (currentIndex < 0) currentIndex = matches.length - 1;
        if (currentIndex >= matches.length) currentIndex = 0;
    }
    
    // Remove previous active
    matches.forEach(m => m.classList.remove('search-active'));
    
    // Set new active
    const activeMatch = matches[currentIndex];
    if (activeMatch) {
        activeMatch.classList.add('search-active');
        activeMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
};

/**
 * Clear search
 */
window.clearSearch = (fileId) => {
    const preview = document.getElementById(`preview-${fileId}`);
    const searchInput = document.getElementById(`searchInput-${fileId}`);
    const searchResults = document.getElementById(`searchResults-${fileId}`);
    
    if (searchInput) searchInput.value = '';
    if (searchResults) searchResults.style.display = 'none';
    
    if (preview) {
        const matches = preview.querySelectorAll('.search-match');
        matches.forEach(match => {
            match.classList.remove('search-match', 'search-active');
            const parent = match.parentNode;
            if (parent && parent.nodeType === Node.TEXT_NODE) {
                parent.textContent = match.textContent;
            } else {
                const text = match.textContent;
                match.replaceWith(document.createTextNode(text));
            }
        });
    }
};

/**
 * Handle search keyboard shortcuts
 */
window.handleSearchKeydown = (e, fileId) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        navigateSearch(fileId, 1);
    } else if (e.key === 'ArrowUp' || (e.key === 'Enter' && e.shiftKey)) {
        e.preventDefault();
        navigateSearch(fileId, -1);
    } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        navigateSearch(fileId, 1);
    } else if (e.key === 'Escape') {
        e.preventDefault();
        clearSearch(fileId);
    }
};

/**
 * Toggle edit mode for transcript
 */
window.toggleEditTranscript = (fileId) => {
    const fileData = state.files.get(fileId);
    if (!fileData || !fileData.transcript) return;
    
    const preview = document.getElementById(`preview-${fileId}`);
    const editor = document.getElementById(`editor-${fileId}`);
    const editActions = document.getElementById(`editActions-${fileId}`);
    const editBtn = document.getElementById(`editBtn-${fileId}`);
    
    if (!preview || !editor || !editActions) return;
    
    const isEditing = editor.style.display !== 'none';
    
    if (isEditing) {
        // Cancel edit
        cancelEditTranscript(fileId);
    } else {
        // Start editing
        preview.style.display = 'none';
        editor.style.display = 'block';
        editActions.style.display = 'flex';
        editor.value = fileData.transcript.transcriptText || '';
        editor.focus();
        
        if (editBtn) {
            editBtn.innerHTML = '<span class="edit-icon">✏️</span><span class="edit-text">Cancel Edit</span>';
        }
    }
};

/**
 * Save edited transcript
 */
window.saveEditedTranscript = (fileId) => {
    const fileData = state.files.get(fileId);
    const editor = document.getElementById(`editor-${fileId}`);
    
    if (!fileData || !editor) return;
    
    const newText = editor.value.trim();
    if (!newText) {
        showError('Transcript cannot be empty');
        return;
    }
    
    // Update transcript
    fileData.transcript.transcriptText = newText;
    fileData.transcript.edited = true;
    fileData.transcript.editedAt = new Date().toISOString();
    
    // Update preview
    const preview = document.getElementById(`preview-${fileId}`);
    if (preview) {
        // Rebuild preview HTML (simplified, without segments if edited)
        preview.innerHTML = escapeHtml(newText).replace(/\n/g, '<br>');
        preview.style.display = 'block';
    }
    
    // Hide editor
    editor.style.display = 'none';
    document.getElementById(`editActions-${fileId}`).style.display = 'none';
    
    const editBtn = document.getElementById(`editBtn-${fileId}`);
    if (editBtn) {
        editBtn.innerHTML = '<span class="edit-icon">✏️</span><span class="edit-text">Edit</span>';
    }
    
    showNotification('Transcript saved successfully!');
};

/**
 * Cancel edit transcript
 */
window.cancelEditTranscript = (fileId) => {
    const editor = document.getElementById(`editor-${fileId}`);
    const preview = document.getElementById(`preview-${fileId}`);
    const editActions = document.getElementById(`editActions-${fileId}`);
    const editBtn = document.getElementById(`editBtn-${fileId}`);
    
    if (editor) editor.style.display = 'none';
    if (preview) preview.style.display = 'block';
    if (editActions) editActions.style.display = 'none';
    
    if (editBtn) {
        editBtn.innerHTML = '<span class="edit-icon">✏️</span><span class="edit-text">Edit</span>';
    }
};

/**
 * Escape regex special characters
 */
function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Save transcript to history
 */
function saveTranscriptToHistory(fileId, fileData) {
    if (!fileData.transcript || fileData.status !== 'done') return;
    
    const history = JSON.parse(localStorage.getItem('clemens_history') || '[]');
    
    // Remove if already exists
    const existingIndex = history.findIndex(h => h.fileId === fileId);
    if (existingIndex >= 0) {
        history.splice(existingIndex, 1);
    }
    
    // Add to beginning
    history.unshift({
        fileId: fileId,
        fileName: fileData.fileName,
        transcriptText: fileData.transcript.transcriptText,
        createdAt: new Date().toISOString(),
        fileSize: fileData.fileSize,
        language: fileData.transcript.language,
        edited: fileData.transcript.edited || false,
        tags: fileData.tags || [],
    });
    
    // Keep only last 100 transcripts
    if (history.length > 100) {
        history.splice(100);
    }
    
    localStorage.setItem('clemens_history', JSON.stringify(history));
}

/**
 * Show history modal
 */
window.showHistory = () => {
    const modal = document.getElementById('historyModal');
    const historyList = document.getElementById('historyList');
    if (!modal || !historyList) return;
    
    const history = JSON.parse(localStorage.getItem('clemens_history') || '[]');
    
    if (history.length === 0) {
        historyList.innerHTML = '<div class="empty-state">No transcript history yet.</div>';
        modal.style.display = 'flex';
        return;
    }
    
    historyList.innerHTML = history.map((item, index) => `
        <div class="history-item" onclick="loadFromHistory('${item.fileId}')">
            <div class="history-item-header">
                <div class="history-item-name">${escapeHtml(item.fileName)}</div>
                <div class="history-item-date">${new Date(item.createdAt).toLocaleString()}</div>
            </div>
            <div class="history-item-preview">${escapeHtml(item.transcriptText.substring(0, 150))}...</div>
            <div class="history-item-meta">
                ${item.edited ? '<span class="badge-edited">Edited</span>' : ''}
                ${item.tags && item.tags.length > 0 ? item.tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('') : ''}
                <span class="history-item-size">${formatFileSize(item.fileSize || 0)}</span>
            </div>
        </div>
    `).join('');
    
    modal.style.display = 'flex';
};

/**
 * Close history modal
 */
window.closeHistoryModal = () => {
    const modal = document.getElementById('historyModal');
    if (modal) {
        modal.style.display = 'none';
    }
};

/**
 * Load transcript from history
 */
window.loadFromHistory = (fileId) => {
    const history = JSON.parse(localStorage.getItem('clemens_history') || '[]');
    const item = history.find(h => h.fileId === fileId);
    
    if (!item) {
        showError('Transcript not found in history');
        return;
    }
    
    // Check if already loaded
    if (state.files.has(fileId)) {
        // Scroll to existing result
        const resultDiv = document.getElementById(`result-${fileId}`);
        if (resultDiv) {
            resultDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
            closeHistoryModal();
            return;
        }
    }
    
    // Create fileData from history
    const fileData = {
        id: fileId,
        fileName: item.fileName,
        fileSize: item.fileSize,
        status: 'done',
        progress: 100,
        transcript: {
            transcriptText: item.transcriptText,
            fileName: item.fileName,
            language: item.language,
            edited: item.edited,
        },
        tags: item.tags || [],
    };
    
    state.files.set(fileId, fileData);
    showResult(fileId, fileData);
    closeHistoryModal();
    
    // Scroll to result
    setTimeout(() => {
        const resultDiv = document.getElementById(`result-${fileId}`);
        if (resultDiv) {
            resultDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, 100);
};

/**
 * Search across all results
 */
window.searchAcrossResults = (searchTerm) => {
    const clearBtn = document.getElementById('clearGlobalSearch');
    if (!searchTerm.trim()) {
        if (clearBtn) clearBtn.style.display = 'none';
        // Remove highlights
        document.querySelectorAll('.global-search-match').forEach(el => {
            el.classList.remove('global-search-match');
        });
        // Show all results
        document.querySelectorAll('.result-item').forEach(item => {
            item.style.display = 'block';
            item.classList.remove('has-search-match');
        });
        return;
    }
    
    if (clearBtn) clearBtn.style.display = 'inline-block';
    
    const regex = new RegExp(`(${escapeRegex(searchTerm)})`, 'gi');
    let totalMatches = 0;
    
    // Search in all result items
    const resultItems = document.querySelectorAll('.result-item');
    resultItems.forEach(resultItem => {
        const preview = resultItem.querySelector('.transcript-preview');
        if (!preview) return;
        
        const text = preview.textContent || preview.innerText;
        const matches = text.match(regex);
        
        if (matches && matches.length > 0) {
            totalMatches += matches.length;
            resultItem.classList.add('has-search-match');
        } else {
            resultItem.classList.remove('has-search-match');
            resultItem.style.display = 'none';
        }
    });
};

/**
 * Clear global search
 */
window.clearGlobalSearch = () => {
    const searchInput = document.getElementById('globalSearchInput');
    const clearBtn = document.getElementById('clearGlobalSearch');
    
    if (searchInput) searchInput.value = '';
    if (clearBtn) clearBtn.style.display = 'none';
    
    // Show all results
    document.querySelectorAll('.result-item').forEach(item => {
        item.style.display = 'block';
        item.classList.remove('has-search-match');
    });
    
    // Remove highlights
    document.querySelectorAll('.global-search-match').forEach(el => {
        el.classList.remove('global-search-match');
    });
};

/**
 * Calculate word count
 */
function calculateWordCount(text) {
    if (!text) return 0;
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
}

/**
 * Calculate reading time (average 200 words per minute)
 */
function calculateReadingTime(text) {
    const words = calculateWordCount(text);
    const minutes = Math.ceil(words / 200);
    return minutes;
}

/**
 * Toggle download menu
 */
window.toggleDownloadMenu = (fileId) => {
    const menu = document.getElementById(`downloadMenu-${fileId}`);
    if (!menu) return;
    
    // Close all other menus
    document.querySelectorAll('.dropdown-menu').forEach(m => {
        if (m !== menu) m.style.display = 'none';
    });
    
    menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
};

// Close dropdowns when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.btn-dropdown')) {
        document.querySelectorAll('.dropdown-menu').forEach(menu => {
            menu.style.display = 'none';
        });
    }
});

/**
 * Download SRT subtitle file
 */
window.downloadSrt = (fileId) => {
    const fileData = state.files.get(fileId);
    if (!fileData?.transcript) return;
    
    const segments = fileData.transcript.segments;
    if (!segments || !Array.isArray(segments) || segments.length === 0) {
        showError('SRT export requires timestamped segments. This transcript does not have timestamps.');
        return;
    }
    
    let srtContent = '';
    segments.forEach((segment, index) => {
        const start = formatSrtTime(segment.start);
        const end = formatSrtTime(segment.end);
        srtContent += `${index + 1}\n${start} --> ${end}\n${segment.text.trim()}\n\n`;
    });
    
    const blob = new Blob([srtContent], { type: 'text/srt' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileData.fileName.replace(/\.[^/.]+$/, '')}_transcript.srt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showNotification('SRT file downloaded');
};

/**
 * Format time for SRT (HH:MM:SS,mmm)
 */
function formatSrtTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const milliseconds = Math.floor((seconds % 1) * 1000);
    
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(milliseconds).padStart(3, '0')}`;
}

/**
 * Download JSON transcript
 */
window.downloadJson = (fileId) => {
    const fileData = state.files.get(fileId);
    if (!fileData?.transcript) return;
    
    const jsonData = {
        fileName: fileData.fileName,
        transcript: fileData.transcript.transcriptText,
        language: fileData.transcript.language || 'auto',
        segments: fileData.transcript.segments || null,
        metadata: {
            fileSize: fileData.fileSize,
            createdAt: new Date().toISOString(),
            edited: fileData.transcript.edited || false,
            tags: fileData.tags || [],
        },
    };
    
    const jsonContent = JSON.stringify(jsonData, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileData.fileName.replace(/\.[^/.]+$/, '')}_transcript.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showNotification('JSON file downloaded');
};

/**
 * Download original audio file
 */
window.downloadOriginalAudio = (fileId) => {
    const fileData = state.files.get(fileId);
    if (!fileData) return;
    
    if (fileData.audioUrl) {
        // Download from blob URL
        const a = document.createElement('a');
        a.href = fileData.audioUrl;
        a.download = fileData.fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        showNotification('Audio file downloaded');
    } else if (fileData.objectKey) {
        // Try to get download URL from server
        showError('Audio file not available for download. It may have been processed and removed.');
    } else {
        showError('Audio file not found');
    }
};

/**
 * Toggle batch selection mode
 */
window.toggleBatchMode = () => {
    state.batchMode = !state.batchMode;
    const resultItems = document.querySelectorAll('.result-item');
    resultItems.forEach(item => {
        const checkbox = item.querySelector('.batch-checkbox');
        if (checkbox) {
            checkbox.style.display = state.batchMode ? 'block' : 'none';
        }
    });
    
    const batchActions = document.getElementById('batchActions');
    if (batchActions) {
        batchActions.style.display = state.batchMode ? 'flex' : 'none';
    }
    
    if (!state.batchMode) {
        state.batchSelected.clear();
        updateBatchActions();
    }
    
    showNotification(state.batchMode ? 'Batch mode enabled' : 'Batch mode disabled');
};

/**
 * Toggle batch selection for a file
 */
window.toggleBatchSelect = (fileId) => {
    if (!state.batchSelected) {
        state.batchSelected = new Set();
    }
    
    if (state.batchSelected.has(fileId)) {
        state.batchSelected.delete(fileId);
    } else {
        state.batchSelected.add(fileId);
    }
    
    updateBatchActions();
};

/**
 * Update batch actions display
 */
function updateBatchActions() {
    const count = state.batchSelected ? state.batchSelected.size : 0;
    const batchCount = document.getElementById('batchCount');
    if (batchCount) {
        batchCount.textContent = `${count} selected`;
    }
}

/**
 * Export selected transcripts
 */
window.exportSelectedTranscripts = async () => {
    if (!state.batchSelected || state.batchSelected.size === 0) {
        showError('No transcripts selected');
        return;
    }
    
    const transcripts = [];
    for (const fileId of state.batchSelected) {
        const fileData = state.files.get(fileId);
        if (fileData?.transcript) {
            transcripts.push({
                fileName: fileData.fileName,
                text: fileData.transcript.transcriptText,
            });
        }
    }
    
    if (transcripts.length === 0) {
        showError('No valid transcripts to export');
        return;
    }
    
    try {
        const { PDFDocument, rgb, StandardFonts } = PDFLib;
        const pdfDoc = await PDFDocument.create();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        
        let page = pdfDoc.addPage([612, 792]);
        const margin = 50;
        const maxWidth = page.getWidth() - 2 * margin;
        let y = page.getHeight() - margin;
        
        page.drawText(`Selected Transcripts Export (${transcripts.length} files)`, {
            x: margin,
            y: y,
            size: 20,
            font: boldFont,
            color: rgb(0, 0, 0),
        });
        y -= 30;
        
        for (const transcript of transcripts) {
            if (y < margin + 100) {
                page = pdfDoc.addPage([612, 792]);
                y = page.getHeight() - margin;
            }
            
            page.drawText(transcript.fileName, {
                x: margin,
                y: y,
                size: 14,
                font: boldFont,
                color: rgb(0, 0, 0),
            });
            y -= 20;
            
            const lines = wrapText(transcript.text, maxWidth, font, 11);
            for (const line of lines) {
                if (y < margin + 20) {
                    page = pdfDoc.addPage([612, 792]);
                    y = page.getHeight() - margin;
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
            y -= 20;
        }
        
        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `selected_transcripts_${new Date().toISOString().split('T')[0]}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showNotification(`Exported ${transcripts.length} transcript(s)`);
        toggleBatchMode(); // Exit batch mode
    } catch (error) {
        console.error('[exportSelectedTranscripts] Error:', error);
        showError('Failed to export transcripts');
    }
};

/**
 * Delete selected transcripts
 */
window.deleteSelectedTranscripts = () => {
    if (!state.batchSelected || state.batchSelected.size === 0) {
        showError('No transcripts selected');
        return;
    }
    
    if (!confirm(`Delete ${state.batchSelected.size} transcript(s)?`)) {
        return;
    }
    
    for (const fileId of state.batchSelected) {
        const resultDiv = document.getElementById(`result-${fileId}`);
        if (resultDiv) {
            resultDiv.remove();
        }
        state.files.delete(fileId);
    }
    
    state.batchSelected.clear();
    toggleBatchMode();
    showNotification('Transcripts deleted');
};

/**
 * Convert file to base64
 */
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const base64 = reader.result.split(',')[1]; // Remove data:type;base64, prefix
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

/**
 * Upload context files for AI analysis
 */
window.uploadContextFiles = (fileId) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = '.pdf,.txt,.doc,.docx';
    
    input.onchange = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;
        
        const fileData = state.files.get(fileId);
        if (!fileData) return;
        
        if (!fileData.analysisState) {
            fileData.analysisState = {};
        }
        if (!fileData.analysisState.contextFiles) {
            fileData.analysisState.contextFiles = [];
        }
        
        // Store files
        fileData.analysisState.contextFiles.push(...files);
        
        showNotification(`Added ${files.length} context file(s). Re-run analysis to use them.`);
    };
    
    input.click();
};

/**
 * Add tag to transcript
 */
window.addTag = (fileId) => {
    const tag = prompt('Enter a tag:');
    if (!tag || !tag.trim()) return;
    
    const fileData = state.files.get(fileId);
    if (!fileData) return;
    
    if (!fileData.tags) {
        fileData.tags = [];
    }
    
    if (!fileData.tags.includes(tag.trim())) {
        fileData.tags.push(tag.trim());
        updateTagsDisplay(fileId);
        saveTranscriptToHistory(fileId, fileData);
    }
};

/**
 * Remove tag from transcript
 */
window.removeTag = (fileId, tag) => {
    const fileData = state.files.get(fileId);
    if (!fileData || !fileData.tags) return;
    
    fileData.tags = fileData.tags.filter(t => t !== tag);
    updateTagsDisplay(fileId);
    saveTranscriptToHistory(fileId, fileData);
};

/**
 * Update tags display
 */
function updateTagsDisplay(fileId) {
    const fileData = state.files.get(fileId);
    const tagsContainer = document.getElementById(`tags-${fileId}`);
    
    if (!tagsContainer || !fileData) return;
    
    // Helper function to escape for JavaScript string literals (handles single quotes)
    const escapeJsString = (str) => {
        return String(str)
            .replace(/\\/g, '\\\\')  // Escape backslashes first
            .replace(/'/g, "\\'")    // Escape single quotes
            .replace(/"/g, '\\"')    // Escape double quotes
            .replace(/\n/g, '\\n')   // Escape newlines
            .replace(/\r/g, '\\r')   // Escape carriage returns
            .replace(/\t/g, '\\t');   // Escape tabs
    };
    
    const escapedFileId = escapeJsString(fileId);
    
    if (!fileData.tags || fileData.tags.length === 0) {
        tagsContainer.innerHTML = '<button class="btn-add-tag" onclick="addTag(\'' + escapedFileId + '\')">+ Tag</button>';
        return;
    }
    
    tagsContainer.innerHTML = fileData.tags.map(tag => {
        const escapedTag = escapeJsString(tag);
        return `<span class="tag"><span class="tag-text">${escapeHtml(tag)}</span><button class="tag-remove" onclick="removeTag('${escapedFileId}', '${escapedTag}')">×</button></span>`;
    }).join('') + '<button class="btn-add-tag" onclick="addTag(\'' + escapedFileId + '\')">+</button>';
}
