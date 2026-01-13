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
    resumeJobs(); // Check for jobs in localStorage and resume polling
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

        // Note: We allow >25MB files if R2 is configured (they'll be chunked during processing)
        // The 25MB limit is only enforced for Blobs upload path (fallback)

        // Warn about Netlify Function upload limit
        if (file.size > CONFIG.maxUploadSize) {
            showError(`Warning: ${file.name} is ${(file.size / 1024 / 1024).toFixed(1)}MB. Files over ${CONFIG.maxUploadSize / 1024 / 1024}MB may fail due to Netlify Function limits. Consider using R2 storage or chunking.`);
            // Continue anyway - let it try, but user is warned
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
            jobId: null, // For large files using job-based workflow
            isLargeFile: file.size > CONFIG.maxFileSize, // >25MB requires job-based processing
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
    let statusText = fileData.status.charAt(0).toUpperCase() + fileData.status.slice(1);
    
    // Show detailed status message for job-based processing
    if (fileData.statusMessage) {
        statusText = fileData.statusMessage;
    }

    div.innerHTML = `
        <div class="file-header">
            <div class="file-info">
                <div class="file-name">${escapeHtml(fileData.fileName)}</div>
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

        // Check if this is a large file (>25MB) that needs job-based processing
        if (fileData.isLargeFile && uploadInfo.storageType === 'r2') {
            // Use job-based workflow for large files
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
            // Use direct transcription for small files
            fileData.status = 'transcribing';
            fileData.progress = 50;
            updateQueueDisplay();

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
            throw new Error('Transcription timed out. The file may be too large for direct processing. Try using a smaller file or contact support if this persists.');
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
                fileData.statusMessage = `Transcribing chunk ${jobStatus.chunksDone || 0} / ${jobStatus.chunksTotal}`;
            } else if (jobStatus.status === 'processing') {
                fileData.statusMessage = 'Processing...';
            } else if (jobStatus.status === 'finalizing') {
                fileData.statusMessage = 'Finalizing transcript...';
            } else if (jobStatus.status === 'done' || jobStatus.status === 'error') {
                // Clear status message when job completes
                fileData.statusMessage = null;
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
                        
                        fileData.transcript = {
                            transcriptText: transcriptText,
                            fileName: jobStatus.filename,
                            modelUsed: 'whisper-1',
                            language: jobStatus.language || 'auto',
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
            // Continue polling on error (might be temporary network issue)
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
function resumeJobs() {
    const jobKeys = Object.keys(localStorage).filter(key => key.startsWith('clemens-job-'));
    
    for (const key of jobKeys) {
        try {
            const jobData = JSON.parse(localStorage.getItem(key));
            const { jobId, fileId, fileName } = jobData;
            
            // Note: Do NOT increment activeProcessing here
            // Resumed jobs are tracked in activeJobs, and will decrement activeProcessing
            // when they complete. We don't want to double-count them.
            
            // Check if file still exists in state
            if (state.files.has(fileId)) {
                const fileData = state.files.get(fileId);
                fileData.jobId = jobId;
                fileData.status = 'processing';
                fileData.isLargeFile = true;
                
                // Resume polling
                pollJobStatus(jobId, fileId);
                console.log(`[resumeJobs] Resumed job ${jobId} for file ${fileName}`);
            } else {
                // File not in state, create a placeholder entry
                // Use the original fileId from jobData to maintain consistency
                // Fetch job status to get file size and other details
                try {
                    const statusUrl = `${CONFIG.apiBase}/job-status?jobId=${encodeURIComponent(jobId)}`;
                    const statusResponse = await fetch(statusUrl, {
                        method: 'GET',
                        headers: getAuthHeaders(),
                    });
                    
                    if (statusResponse.ok) {
                        const jobStatus = await statusResponse.json();
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
                            }).then(response => {
                                if (response.ok) {
                                    console.log(`[resumeJobs] ✅ Successfully triggered job ${jobId}`);
                                } else {
                                    console.error(`[resumeJobs] ⚠️ Failed to trigger job ${jobId}: ${response.status}`);
                                }
                            }).catch(err => {
                                console.error(`[resumeJobs] ❌ Error triggering job ${jobId}:`, err);
                            });
                        }
                    } else {
                        // Fallback: create placeholder without job status
                        state.files.set(fileId, {
                            id: fileId,
                            fileName: fileName,
                            fileSize: 0,
                            status: 'processing',
                            progress: 0,
                            error: null,
                            transcript: null,
                            objectKey: null,
                            jobId: jobId,
                            isLargeFile: true,
                        });
                    }
                } catch (error) {
                    console.error(`[resumeJobs] Error fetching job status for ${jobId}:`, error);
                    // Fallback: create placeholder
                    state.files.set(fileId, {
                        id: fileId,
                        fileName: fileName,
                        fileSize: 0,
                        status: 'processing',
                        progress: 0,
                        error: null,
                        transcript: null,
                        objectKey: null,
                        jobId: jobId,
                        isLargeFile: true,
                    });
                }
                
                // Resume polling
                pollJobStatus(jobId, fileId);
                console.log(`[resumeJobs] Resumed job ${jobId} for file ${fileName} (placeholder)`);
            }
        } catch (error) {
            console.error(`[resumeJobs] Error resuming job from ${key}:`, error);
            localStorage.removeItem(key); // Remove invalid entry
        }
    }
    
    if (jobKeys.length > 0) {
        updateQueueDisplay();
        elements.queueContainer.style.display = 'block';
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
