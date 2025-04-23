// FileGuard Content Script v1.4.7
const VERSION = "1.4.7";
console.log(`FileGuard v${VERSION} initializing...`);

// Selectors for Gmail attachments
const ATTACHMENT_SELECTORS = [
  'div[role="main"] div[data-message-id] div[data-legacy-message-id]',
  'div[role="main"] div[data-message-id]',
  'div[data-message-id] div[role="presentation"]',
  'div[role="presentation"] div[role="toolbar"]'
];

// Common file types to scan
const FILE_TYPE_SELECTORS = [
  'a[href*="&disp=download"]',
  'a[href*="&disp=safe"]',
  'a[href*="&disp=att"]',
  'a[href*="&view=att"]',
  'a[download]',
  'a[href$=".doc"]',
  'a[href$=".docx"]',
  'a[href$=".pdf"]',
  'a[href$=".txt"]',
  'a[href$=".xls"]',
  'a[href$=".xlsx"]',
  'a[href$=".csv"]',
  'a[href$=".zip"]',
  'a[href$=".rar"]',
  'a[href$=".7z"]',
  'a[href$=".exe"]'
];

const SCAN_BUTTON_HTML = `
<div class="fileguard-scan-btn" role="button" aria-label="Scan for viruses" style="margin-left: 8px; display: inline-flex;">
  <span style="background: #1a73e8; color: white; padding: 8px 16px; border-radius: 4px; font-family: 'Google Sans',Roboto,Arial; font-size: 14px; cursor: pointer;">
    Scan
  </span>
</div>`;

// Add this CSS animation at the top of the file
const SCAN_ANIMATION_STYLE = `
@keyframes fileguard-scan-pulse {
    0% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.1); opacity: 0.7; }
    100% { transform: scale(1); opacity: 1; }
}

@keyframes fileguard-scan-spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}

.fileguard-scanning {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    background: #1a73e8;
    color: white;
    border-radius: 4px;
    font-family: 'Google Sans', Roboto, Arial;
    font-size: 13px;
    cursor: wait;
    user-select: none;
}

.fileguard-scanning .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: fileguard-scan-spin 1s linear infinite;
}

.fileguard-scanning .pulse {
    width: 8px;
    height: 8px;
    background: #34a853;
    border-radius: 50%;
    animation: fileguard-scan-pulse 1s ease-in-out infinite;
}

.fileguard-scanning .progress {
    position: absolute;
    bottom: 0;
    left: 0;
    height: 2px;
    background: rgba(255,255,255,0.3);
    width: 100%;
    overflow: hidden;
}

.fileguard-scanning .progress-bar {
    height: 100%;
    background: white;
    width: 0%;
    transition: width 0.3s ease;
}
`;

// Add the style to the document
const styleSheet = document.createElement('style');
styleSheet.textContent = SCAN_ANIMATION_STYLE;
document.head.appendChild(styleSheet);

function RESULT_HTML(status, details) {
    const statusText = status === 'clean' ? 'SAFE' :
                      status === 'suspicious' ? 'SUSPICIOUS' :
                      status === 'malicious' ? 'MALICIOUS' : 'ERROR';
    
    // Format current timestamp
    const currentDate = new Date();
    const timestamp = currentDate.toLocaleString('en-US', { 
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    });
    
    // Create the main result display with status and scan report button
    const mainResult = `
        <div style="display: inline-flex; align-items: center; gap: 8px; padding: 4px 8px; width: fit-content;">
            <div class="fileguard-result status-${status}" style="
                display: inline-flex;
                align-items: center;
                padding: 6px 12px;
                border: 1px solid ${
                    status === 'clean' ? '#34a853' :
                    status === 'suspicious' ? '#fbbc04' :
                    status === 'malicious' ? '#ea4335' : '#5f6368'
                };
                border-radius: 4px;
                background: ${
                    status === 'clean' ? '#e6f4ea' :
                    status === 'suspicious' ? '#fef7e0' :
                    status === 'malicious' ? '#fce8e6' : '#f1f3f4'
                };
                color: ${
                    status === 'clean' ? '#0b8043' :
                    status === 'suspicious' ? '#e37400' :
                    status === 'malicious' ? '#c5221f' : '#5f6368'
                };
                font-family: 'Google Sans', Roboto, Arial;
                font-size: 13px;
                gap: 8px;
                white-space: nowrap;
            ">
                <span style="font-weight: 500">${statusText}</span>
                <span style="opacity: 0.9; font-size: 12px;">Scanned by FileGuard</span>
            </div>
            <button class="fileguard-report-btn" style="
                padding: 6px 12px;
                border: 1px solid #1a73e8;
                border-radius: 4px;
                background: white;
                color: #1a73e8;
                font-family: 'Google Sans', Roboto, Arial;
                font-size: 13px;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                gap: 6px;
                transition: background-color 0.2s;
                white-space: nowrap;
            ">
                <svg width="16" height="16" viewBox="0 0 24 24" style="fill: currentColor">
                    <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"/>
                    <path d="M14 15H8v-2h6v2zm0-4H8V9h6v2z"/>
                </svg>
                View Report
            </button>
        </div>`;

    // Create the detailed report
    const reportHTML = `
        <div class="fileguard-report" style="
            display: none;
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 600px;
            max-height: 80vh;
            overflow-y: auto;
            padding: 24px;
            background: white;
            border-radius: 8px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.24);
            z-index: 9999;
            font-family: 'Google Sans', Roboto, Arial;
        ">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h2 style="margin: 0; color: #202124; font-size: 20px;">Security Scan Report</h2>
                <button class="fileguard-close-report" style="
                    border: none;
                    background: none;
                    padding: 8px;
                    cursor: pointer;
                    color: #5f6368;
                    font-size: 20px;
                    line-height: 1;
                    border-radius: 50%;
                    width: 36px;
                    height: 36px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: background-color 0.2s;
                    &:hover {
                        background-color: #f1f3f4;
                    }
                ">✕</button>
            </div>

            <div style="
                padding: 16px;
                background: ${
                    status === 'clean' ? '#e6f4ea' :
                    status === 'suspicious' ? '#fef7e0' :
                    status === 'malicious' ? '#fce8e6' : '#f1f3f4'
                };
                border-radius: 8px;
                margin-bottom: 24px;
            ">
                <div style="font-size: 24px; font-weight: 500; color: ${
                    status === 'clean' ? '#0b8043' :
                    status === 'suspicious' ? '#e37400' :
                    status === 'malicious' ? '#c5221f' : '#5f6368'
                };">${statusText}</div>
                <div style="color: #5f6368; margin-top: 4px;">Scan completed at ${timestamp}</div>
            </div>

            <div style="margin-bottom: 24px;">
                <h3 style="margin: 0 0 12px 0; color: #202124; font-size: 16px;">File Information</h3>
                <div style="
                    display: grid;
                    grid-template-columns: 140px 1fr;
                    gap: 8px;
                    padding: 16px;
                    background: #f8f9fa;
                    border-radius: 8px;
                ">
                    <div style="color: #5f6368;">File Name:</div>
                    <div style="color: #202124; font-weight: 500;">${details.fileName}</div>
                    <div style="color: #5f6368;">File Type:</div>
                    <div style="color: #202124;">${details.fileType.toUpperCase()}</div>
                    <div style="color: #5f6368;">Source:</div>
                    <div style="color: #202124;">${details.source}</div>
                    <div style="color: #5f6368;">Scan Engine:</div>
                    <div style="color: #202124;">${details.scanEngine}</div>
                </div>
            </div>

            <div style="margin-bottom: 24px;">
                <h3 style="margin: 0 0 12px 0; color: #202124; font-size: 16px;">Scan Details</h3>
                <div style="
                    display: grid;
                    grid-template-columns: 140px 1fr;
                    gap: 8px;
                    padding: 16px;
                    background: #f8f9fa;
                    border-radius: 8px;
                ">
                    <div style="color: #5f6368;">Status:</div>
                    <div style="color: ${
                        status === 'clean' ? '#0b8043' :
                        status === 'suspicious' ? '#e37400' :
                        status === 'malicious' ? '#c5221f' : '#5f6368'
                    }; font-weight: 500;">${statusText}</div>
                    
                    <div style="color: #5f6368;">Analysis Stats:</div>
                    <div style="color: #202124;">
                        <div style="display: flex; gap: 16px;">
                            <span style="color: #0b8043">Clean: ${details.stats?.harmless || 0}</span>
                            <span style="color: #e37400">Suspicious: ${details.stats?.suspicious || 0}</span>
                            <span style="color: #c5221f">Malicious: ${details.stats?.malicious || 0}</span>
                            <span style="color: #5f6368">Undetected: ${details.stats?.undetected || 0}</span>
                        </div>
                    </div>
                    
                    ${details.detections && details.detections.length > 0 ? `
                        <div style="color: #5f6368;">Detections:</div>
                        <div style="color: #202124;">
                            <div style="display: grid; gap: 8px;">
                                ${details.detections.map(detection => `
                                    <div style="
                                        display: flex;
                                        justify-content: space-between;
                                        padding: 8px;
                                        background: ${detection.category === 'malicious' ? '#fce8e6' : '#fef7e0'};
                                        border-radius: 4px;
                                    ">
                                        <span>${detection.engine}</span>
                                        <span style="color: ${detection.category === 'malicious' ? '#c5221f' : '#e37400'}">
                                            ${detection.result}
                                        </span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                    
                    ${details.permalink ? `
                        <div style="color: #5f6368;">Full Report:</div>
                        <div>
                            <a href="${details.permalink}" target="_blank" style="color: #1a73e8; text-decoration: none;">
                                View on VirusTotal
                                <svg width="12" height="12" viewBox="0 0 24 24" style="fill: currentColor; vertical-align: middle;">
                                    <path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/>
                                </svg>
                            </a>
                        </div>
                    ` : ''}
                </div>
            </div>

            <div style="text-align: center; padding-top: 16px; border-top: 1px solid #e8eaed;">
                <img src="${chrome.runtime.getURL('icons/icon48.png')}" style="width: 24px; height: 24px; vertical-align: middle;">
                <span style="color: #5f6368; font-size: 13px; margin-left: 8px;">Protected by FileGuard Security</span>
            </div>
        </div>
        <div class="fileguard-report-overlay" style="
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.6);
            backdrop-filter: blur(2px);
            z-index: 9998;
            cursor: pointer;
        "></div>`;

    return mainResult + reportHTML;
}

// Debug logging function
function debugLog(message, ...args) {
    console.log(`[FileGuard] ${message}`, ...args);
}

// Debounce function to limit how often a function can be called
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function initialize() {
    debugLog('Initializing...');
    
    // Initial scan with a small delay to let Gmail load
    setTimeout(() => scanForFiles(), 1000);
    
    // Debounced scan function
    const debouncedScan = debounce(() => {
  scanForFiles();
    }, 1000); // Wait 1 second after changes before scanning
    
    // Use a single mutation observer for better performance
    const observer = new MutationObserver((mutations) => {
        let shouldScan = false;
        
        for (const mutation of mutations) {
            // Only check for added nodes that might contain attachments
            if (mutation.addedNodes.length > 0) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === 1 && // Element node
                        (node.matches?.(ATTACHMENT_SELECTORS.join(',')) || 
                         node.querySelector?.(ATTACHMENT_SELECTORS.join(',')))) {
                        shouldScan = true;
                        break;
                    }
                }
            }
            if (shouldScan) break;
        }
        
        if (shouldScan) {
            debouncedScan();
        }
    });
    
    // Observe only the main Gmail container instead of the entire body
    const gmailContainer = document.querySelector('div[role="main"]');
    if (gmailContainer) {
        observer.observe(gmailContainer, {
            childList: true,
            subtree: true
        });
    } else {
        // Fallback to body if main container not found
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
    
    debugLog('Initialized successfully');
}

// Optimize attachment finding by caching selectors
const attachmentCache = new WeakMap();

function findAttachmentElements() {
    const elements = new Set();
    const now = Date.now();
    
    for (const selector of ATTACHMENT_SELECTORS) {
        const found = document.querySelectorAll(selector);
        found.forEach(el => {
            // Check cache first
            const cached = attachmentCache.get(el);
            if (cached && (now - cached.timestamp) < 5000) { // 5 second cache
                if (cached.hasAttachments) {
                    elements.add(el);
                }
                return;
            }
            
            // Check if this element contains any unscanned attachments
            const hasUnscannedAttachments = FILE_TYPE_SELECTORS.some(fileSelector => {
                const links = el.querySelectorAll(fileSelector);
                return Array.from(links).some(link => !link.closest('.fileguard-scanned'));
            });
            
            // Update cache
            attachmentCache.set(el, {
                timestamp: now,
                hasAttachments: hasUnscannedAttachments
            });
            
            if (hasUnscannedAttachments) {
                elements.add(el);
            }
        });
    }
    
    debugLog(`Found ${elements.size} email containers with attachments`);
    return Array.from(elements);
}

function findAttachmentLinks(container) {
    const links = new Set();
    
    // Look for download buttons in toolbar first
    const toolbar = container.querySelector('div[role="toolbar"]');
    if (toolbar) {
        for (const selector of FILE_TYPE_SELECTORS) {
            const foundLinks = toolbar.querySelectorAll(selector);
            foundLinks.forEach(link => {
                if (!link.closest('.fileguard-scanned')) {
                    links.add(link);
                }
            });
        }
    }
    
    // If no links found in toolbar, look in the entire container
    if (links.size === 0) {
        for (const selector of FILE_TYPE_SELECTORS) {
            const foundLinks = container.querySelectorAll(selector);
            foundLinks.forEach(link => {
                if (!link.closest('.fileguard-scanned')) {
                    links.add(link);
                }
            });
        }
    }
    
    debugLog(`Found ${links.size} attachment links in container`, container);
    return Array.from(links);
}

function scanForFiles() {
    debugLog('Scanning for files...');
    
    try {
        const attachmentElements = findAttachmentElements();
        debugLog(`Processing ${attachmentElements.length} elements`);
        
        attachmentElements.forEach(element => {
            const fileLinks = findAttachmentLinks(element);
            if (fileLinks.length > 0) {
                // Create a container for all scan controls
                const scanControlsContainer = document.createElement('div');
                scanControlsContainer.className = 'fileguard-scan-controls';
                scanControlsContainer.style.cssText = `
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    margin: 8px 0;
                    padding: 8px;
                    background: #f8f9fa;
                    border-radius: 4px;
                    border: 1px solid #e8eaed;
                `;

                // If there are multiple attachments, add a single "Scan All" button
                if (fileLinks.length > 1) {
                    const scanAllBtn = document.createElement('button');
                    scanAllBtn.className = 'fileguard-scan-all-btn';
                    scanAllBtn.style.cssText = `
                        background: #1a73e8;
                        color: white;
                        padding: 8px 16px;
                        border-radius: 4px;
                        border: none;
                        font-family: 'Google Sans', Roboto, Arial;
                        font-size: 13px;
                        cursor: pointer;
                        display: inline-flex;
                        align-items: center;
                        gap: 8px;
                        transition: background-color 0.2s;
                        align-self: flex-start;
                        &:hover {
                            background: #1557b0;
                        }
                    `;
                    
                    scanAllBtn.innerHTML = `
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
                        </svg>
                        Scan All Attachments (${fileLinks.length})
                    `;

                    scanAllBtn.addEventListener('click', async () => {
                        try {
                            // Disable button and show loading state
                            scanAllBtn.disabled = true;
                            scanAllBtn.innerHTML = `
                                <div class="fileguard-scanning">
                                    <div class="spinner"></div>
                                    <span>Scanning ${fileLinks.length} files</span>
                                    <div class="pulse"></div>
                                    <div class="progress">
                                        <div class="progress-bar"></div>
                                    </div>
                                </div>
                            `;

                            // Create progress indicator
                            const progressDiv = document.createElement('div');
                            progressDiv.style.cssText = `
                                margin-top: 8px;
                                color: #5f6368;
                                font-size: 13px;
                                font-family: 'Google Sans', Roboto, Arial;
                            `;
                            scanControlsContainer.appendChild(progressDiv);

                            // Simulate progress
                            const progressBar = scanAllBtn.querySelector('.progress-bar');
                            let progress = 0;
                            const progressInterval = setInterval(() => {
                                progress += Math.random() * 5;
                                if (progress > 90) {
                                    clearInterval(progressInterval);
                                }
                                progressBar.style.width = `${Math.min(progress, 90)}%`;
                            }, 200);

                            // Scan all files
                            let completed = 0;
                            const results = [];
                            
                            for (const fileLink of fileLinks) {
                                if (!fileLink.closest('.fileguard-scanned')) {
                                    const fileUrl = fileLink.href;
                                    const fileName = fileLink.getAttribute('download') || 
                                                  fileLink.textContent.trim() || 
                                                  decodeURIComponent(fileUrl.split('/').pop().split('?')[0]) || 
                                                  'unknown';

                                    progressDiv.textContent = `Scanning ${completed + 1}/${fileLinks.length}: ${fileName}`;
                                    
                                    try {
                                        const result = await scanFile(fileUrl, fileName);
                                        results.push({ fileLink, result });
                                    } catch (error) {
                                        console.error('Error scanning file:', fileName, error);
                                        results.push({ 
                                            fileLink, 
                                            result: {
                                                status: 'error',
                                                error: error.message
                                            }
                                        });
                                    }
                                    
                                    completed++;
                                }
                            }

                            // Complete progress
                            progressBar.style.width = '100%';
                            clearInterval(progressInterval);

                            // Update UI with results
                            updateScanAllResults(results, scanControlsContainer);
                            initializeModalHandlers();

                        } catch (error) {
                            console.error('Error in scan all:', error);
                            scanAllBtn.innerHTML = `
                                <div style="
                                    display: inline-flex;
                                    align-items: center;
                                    gap: 8px;
                                    padding: 8px 16px;
                                    background: #ea4335;
                                    color: white;
                                    border-radius: 4px;
                                    font-family: 'Google Sans', Roboto, Arial;
                                    font-size: 13px;
                                    cursor: pointer;
                                ">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                                    </svg>
                                    Retry Scan All
                                </div>
                            `;
                        }
                    });

                    scanControlsContainer.appendChild(scanAllBtn);
                } else {
                    // For single attachment, add individual scan button
                    fileLinks.forEach(fileLink => {
                        if (!fileLink.closest('.fileguard-scanned')) {
                            addScanButton(element, fileLink);
                        }
                    });
                }

                // Insert the scan controls container after the first attachment
                const firstAttachment = fileLinks[0].closest('[role="listitem"]') || fileLinks[0].closest('.aQH');
                if (firstAttachment) {
                    firstAttachment.parentNode.insertBefore(scanControlsContainer, firstAttachment.nextSibling);
                }
            }
        });
    } catch (error) {
        console.error('Error scanning for files:', error);
    }
}

async function scanFile(fileUrl, fileName) {
    try {
        debugLog('Starting scan for file:', fileName);
        
        // Check file type and size limitations
        if (fileName.toLowerCase().endsWith('.csv')) {
            debugLog('CSV file detected, checking size...');
        }

        // Send scan request to background script
        const response = await chrome.runtime.sendMessage({
            action: 'scanFile',
            fileUrl: fileUrl,
            fileName: fileName
        });

        debugLog('Received scan response:', response);

        // Handle error responses
        if (!response) {
            throw new Error('No response received from scan');
        }

        if (response.error) {
            throw new Error(response.error);
        }

        // Format the response for display
        const result = {
            status: response.status || 'error',
            fileName: fileName,
            fileType: fileName.split('.').pop() || 'Unknown',
            source: 'Gmail Attachment',
            scanEngine: 'VirusTotal',
            timestamp: response.timestamp || new Date().toISOString(),
            stats: response.stats || {
                total: 0,
                malicious: 0,
                suspicious: 0,
                harmless: 0,
                undetected: 0
            },
            detections: response.detections || [],
            permalink: response.permalink,
            error: response.error
        };

        debugLog('Formatted scan result:', result);
        return result;

    } catch (error) {
        console.error('[FileGuard] Scan error:', error);
        
        // Create a user-friendly error message
        let errorMessage = 'Failed to scan file';
        if (error.message.includes('too large')) {
            errorMessage = 'File is too large to scan (max 32MB)';
        } else if (error.message.includes('CORS')) {
            errorMessage = 'Unable to access file. Please try downloading first.';
        } else if (error.message.includes('network')) {
            errorMessage = 'Network error. Please check your connection.';
        } else if (error.message.includes('Invalid response')) {
            errorMessage = 'Invalid response from VirusTotal. Please try again.';
        }

        return {
            status: 'error',
            fileName: fileName,
            fileType: fileName.split('.').pop() || 'Unknown',
            source: 'Gmail Attachment',
            scanEngine: 'VirusTotal',
            timestamp: new Date().toISOString(),
            stats: {
                total: 0,
                malicious: 0,
                suspicious: 0,
                harmless: 0,
                undetected: 0
            },
            error: errorMessage
        };
    }
}

// Update the event listeners for the report modal
function handleReportClick(e) {
    if (e.target.closest('.fileguard-report-btn')) {
        const reportBtn = e.target.closest('.fileguard-report-btn');
        const resultContainer = reportBtn.closest('.fileguard-result-container');
        if (!resultContainer) return;
        
        showReport(resultContainer);
    }
    
    if (e.target.closest('.fileguard-close-report') || e.target.matches('.fileguard-report-overlay')) {
        closeReport();
    }
}

// New function to show report
function showReport(container) {
    // Remove any existing report
    closeReport();
    
    const report = container.querySelector('.fileguard-report');
    const overlay = container.querySelector('.fileguard-report-overlay');
    
    if (report && overlay) {
        // Clone the elements to ensure fresh event listeners
        const reportClone = report.cloneNode(true);
        const overlayClone = overlay.cloneNode(true);
        
        document.body.style.overflow = 'hidden';
        document.body.appendChild(overlayClone);
        document.body.appendChild(reportClone);
        
        // Add blur effect to other results
        const allResults = document.querySelectorAll('.fileguard-result-container');
        allResults.forEach(result => {
            if (result !== container) {
                result.style.filter = 'blur(4px)';
                result.style.transition = 'filter 0.3s ease';
            }
        });
        
        overlayClone.style.display = 'block';
        overlayClone.style.opacity = '0';
        reportClone.style.display = 'block';
        reportClone.style.opacity = '0';
        reportClone.style.transform = 'translate(-50%, -48%) scale(0.98)';
        
        // Add click handlers to new elements
        overlayClone.addEventListener('click', () => {
            closeReport();
            // Remove blur from all results
            allResults.forEach(result => {
                result.style.filter = 'none';
            });
        });
        
        reportClone.querySelector('.fileguard-close-report').addEventListener('click', () => {
            closeReport();
            // Remove blur from all results
            allResults.forEach(result => {
                result.style.filter = 'none';
            });
        });
        
        setTimeout(() => {
            overlayClone.style.opacity = '1';
            reportClone.style.opacity = '1';
            reportClone.style.transform = 'translate(-50%, -50%) scale(1)';
        }, 10);
        
        overlayClone.style.transition = 'opacity 0.2s ease-out';
        reportClone.style.transition = 'opacity 0.2s ease-out, transform 0.2s ease-out';
    }
}

function closeReport() {
    const reports = document.querySelectorAll('.fileguard-report');
    const overlays = document.querySelectorAll('.fileguard-report-overlay');
    
    // Remove blur from all results
    const allResults = document.querySelectorAll('.fileguard-result-container');
    allResults.forEach(result => {
        result.style.filter = 'none';
    });
    
    reports.forEach(report => {
        if (report && report.style.display === 'block') {
            report.style.opacity = '0';
            report.style.transform = 'translate(-50%, -48%) scale(0.98)';
            
            setTimeout(() => {
                report.style.display = 'none';
                if (report.parentNode === document.body) {
                    document.body.removeChild(report);
                }
            }, 200);
        }
    });
    
    overlays.forEach(overlay => {
        if (overlay && overlay.style.display === 'block') {
            overlay.style.opacity = '0';
            
            setTimeout(() => {
                overlay.style.display = 'none';
                if (overlay.parentNode === document.body) {
                    document.body.removeChild(overlay);
                }
            }, 200);
        }
    });
    
    document.body.style.overflow = '';
}

// Update the modal keyboard listener
function addModalKeyboardListener() {
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeReport();
        }
    });
}

// Initialize modal listeners
function initializeModalHandlers() {
    // Remove any existing listeners
    document.removeEventListener('click', handleReportClick);
    
    // Add click listener
    document.addEventListener('click', handleReportClick);
    
    // Add keyboard listener
    addModalKeyboardListener();
}

function addScanButton(container, fileLink) {
    try {
        debugLog('Adding scan button for file link', fileLink);
        
        // Find the Gmail attachment container
        const attachmentContainer = fileLink.closest('[role="listitem"]') || fileLink.closest('.aQH');
        if (!attachmentContainer) {
            debugLog('Could not find attachment container');
            return;
        }

        // Create a wrapper for this specific attachment
        const attachmentWrapper = document.createElement('div');
        attachmentWrapper.className = 'fileguard-attachment-wrapper';
        attachmentWrapper.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 8px;
            margin: 4px 0;
            width: 100%;
            position: relative;
            z-index: 1;
        `;
        
        // Create the scan controls container
        const scanControlsContainer = document.createElement('div');
        scanControlsContainer.style.cssText = `
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 4px 8px;
            background: #f8f9fa;
            border-radius: 4px;
            margin-top: 4px;
            width: fit-content;
            min-width: 200px;
        `;
        
        // Create the scan button container
        const btnContainer = document.createElement('div');
        btnContainer.className = 'fileguard-btn-container';
        btnContainer.style.cssText = `
            display: inline-flex;
            align-items: center;
        `;
        btnContainer.innerHTML = SCAN_BUTTON_HTML;
        
        // Update scan button styles
        const scanBtn = btnContainer.querySelector('.fileguard-scan-btn');
        scanBtn.style.cssText = `
            display: inline-flex;
            align-items: center;
            margin: 0;
        `;
        scanBtn.querySelector('span').style.cssText = `
            background: #1a73e8;
            color: white;
            padding: 6px 12px;
            border-radius: 4px;
            font-family: 'Google Sans', Roboto, Arial;
            font-size: 13px;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            white-space: nowrap;
        `;

        // Add the scan controls after the file link
        scanControlsContainer.appendChild(btnContainer);
        attachmentWrapper.appendChild(scanControlsContainer);
        
        // Insert the wrapper after the attachment container
        attachmentContainer.parentNode.insertBefore(attachmentWrapper, attachmentContainer.nextSibling);
        
        scanBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            try {
                const fileUrl = fileLink.href;
                const fileName = fileLink.getAttribute('download') || 
                               fileLink.textContent.trim() || 
                               decodeURIComponent(fileUrl.split('/').pop().split('?')[0]) || 
                               'unknown';
                
                debugLog('Scanning file:', fileName, fileUrl);
                
                // Update button to scanning state
                scanBtn.innerHTML = `
                    <div class="fileguard-scanning">
                        <div class="spinner"></div>
                        <span>Scanning ${fileName}</span>
                        <div class="pulse"></div>
                        <div class="progress">
                            <div class="progress-bar"></div>
                        </div>
                    </div>
                `;
                
                // Simulate progress
                const progressBar = scanBtn.querySelector('.progress-bar');
                let progress = 0;
                const progressInterval = setInterval(() => {
                    progress += Math.random() * 10;
                    if (progress > 90) {
                        clearInterval(progressInterval);
                    }
                    progressBar.style.width = `${Math.min(progress, 90)}%`;
                }, 200);
                
                const response = await scanFile(fileUrl, fileName);
                debugLog('Scan response:', response);
                
                // Complete progress
                progressBar.style.width = '100%';
                clearInterval(progressInterval);
                
                // Create result container
                const resultDiv = document.createElement('div');
                resultDiv.className = 'fileguard-result-container';
                resultDiv.innerHTML = RESULT_HTML(response.status, {
                    ...response,
                    fileName: fileName,
                    fileType: fileName.split('.').pop() || 'Unknown',
                    source: 'Gmail Attachment',
                    scanEngine: 'VirusTotal'
                });
                
                // Replace the scan controls container with the result
                scanControlsContainer.replaceWith(resultDiv);
                
                // Mark this attachment as scanned
                fileLink.classList.add('fileguard-scanned');
                initializeModalHandlers();
                
            } catch (error) {
                console.error('Scan failed:', error);
                scanBtn.innerHTML = `
                    <div style="
                        display: inline-flex;
                        align-items: center;
                        gap: 8px;
                        padding: 8px 16px;
                        background: #ea4335;
                        color: white;
                        border-radius: 4px;
                        font-family: 'Google Sans', Roboto, Arial;
                        font-size: 13px;
                        cursor: pointer;
                    ">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                        </svg>
                        Retry Scan
                    </div>
                `;
            }
        });
        
        debugLog('Scan button added successfully for file:', fileLink.href);
    } catch (error) {
        console.error('Error adding scan button:', error);
    }
}

function generateSummaryReport(results) {
    const timestamp = new Date().toLocaleString();
    const totalFiles = results.length;
    const stats = {
        safe: results.filter(r => r.result.status === 'clean').length,
        suspicious: results.filter(r => r.result.status === 'suspicious').length,
        malicious: results.filter(r => r.result.status === 'malicious').length,
        error: results.filter(r => r.result.status === 'error').length
    };

    return `
        <div class="fileguard-report" style="
            display: none;
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 700px;
            max-height: 85vh;
            overflow-y: auto;
            padding: 24px;
            background: white;
            border-radius: 8px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.24);
            z-index: 9999;
            font-family: 'Google Sans', Roboto, Arial;
        ">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                <h2 style="margin: 0; color: #202124; font-size: 22px;">Batch Scan Summary Report</h2>
                <button class="fileguard-close-report" style="
                    border: none;
                    background: none;
                    padding: 8px;
                    cursor: pointer;
                    color: #5f6368;
                    font-size: 20px;
                    line-height: 1;
                    border-radius: 50%;
                    width: 36px;
                    height: 36px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: background-color 0.2s;
                    &:hover {
                        background-color: #f1f3f4;
                    }
                ">✕</button>
            </div>

            <div style="
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 16px;
                margin-bottom: 24px;
            ">
                <div style="
                    padding: 16px;
                    background: #e6f4ea;
                    border-radius: 8px;
                    text-align: center;
                ">
                    <div style="color: #0b8043; font-size: 24px; font-weight: 500;">${stats.safe}</div>
                    <div style="color: #0b8043; margin-top: 4px;">Safe</div>
                </div>
                <div style="
                    padding: 16px;
                    background: #fef7e0;
                    border-radius: 8px;
                    text-align: center;
                ">
                    <div style="color: #e37400; font-size: 24px; font-weight: 500;">${stats.suspicious}</div>
                    <div style="color: #e37400; margin-top: 4px;">Suspicious</div>
                </div>
                <div style="
                    padding: 16px;
                    background: #fce8e6;
                    border-radius: 8px;
                    text-align: center;
                ">
                    <div style="color: #c5221f; font-size: 24px; font-weight: 500;">${stats.malicious}</div>
                    <div style="color: #c5221f; margin-top: 4px;">Malicious</div>
                </div>
                <div style="
                    padding: 16px;
                    background: #f1f3f4;
                    border-radius: 8px;
                    text-align: center;
                ">
                    <div style="color: #5f6368; font-size: 24px; font-weight: 500;">${stats.error}</div>
                    <div style="color: #5f6368; margin-top: 4px;">Error</div>
                </div>
            </div>

            <div style="margin-bottom: 24px;">
                <h3 style="margin: 0 0 12px 0; color: #202124; font-size: 16px;">Scan Details</h3>
                <div style="
                    padding: 16px;
                    background: #f8f9fa;
                    border-radius: 8px;
                ">
                    <div style="display: grid; grid-template-columns: 140px 1fr; gap: 8px;">
                        <div style="color: #5f6368;">Total Files:</div>
                        <div style="color: #202124;">${totalFiles}</div>
                        <div style="color: #5f6368;">Scan Time:</div>
                        <div style="color: #202124;">${timestamp}</div>
                    </div>
                </div>
            </div>

            <div style="margin-bottom: 24px;">
                <h3 style="margin: 0 0 12px 0; color: #202124; font-size: 16px;">File Results</h3>
                <div style="
                    display: grid;
                    gap: 8px;
                ">
                    ${results.map(({ result, fileLink }) => `
                        <div style="
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                            padding: 12px 16px;
                            background: #f8f9fa;
                            border-radius: 8px;
                            border-left: 4px solid ${
                                result.status === 'clean' ? '#34a853' :
                                result.status === 'suspicious' ? '#fbbc04' :
                                result.status === 'malicious' ? '#ea4335' : '#5f6368'
                            };
                        ">
                            <div style="display: flex; flex-direction: column; gap: 4px;">
                                <div style="color: #202124; font-weight: 500;">
                                    ${fileLink.getAttribute('download') || fileLink.textContent.trim()}
                                </div>
                                <div style="color: #5f6368; font-size: 12px;">
                                    ${result.status === 'error' ? result.error : `
                                        ${result.stats.malicious} malicious, 
                                        ${result.stats.suspicious} suspicious, 
                                        ${result.stats.harmless} clean
                                    `}
                                </div>
                            </div>
                            <div style="
                                padding: 4px 12px;
                                border-radius: 4px;
                                font-size: 13px;
                                font-weight: 500;
                                ${result.status === 'clean' ? `
                                    background: #e6f4ea;
                                    color: #0b8043;
                                ` : result.status === 'suspicious' ? `
                                    background: #fef7e0;
                                    color: #e37400;
                                ` : result.status === 'malicious' ? `
                                    background: #fce8e6;
                                    color: #c5221f;
                                ` : `
                                    background: #f1f3f4;
                                    color: #5f6368;
                                `}
                            ">
                                ${result.status.toUpperCase()}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>

            <div style="text-align: center; padding-top: 16px; border-top: 1px solid #e8eaed;">
                <img src="${chrome.runtime.getURL('icons/icon48.png')}" style="width: 24px; height: 24px; vertical-align: middle;">
                <span style="color: #5f6368; font-size: 13px; margin-left: 8px;">Protected by FileGuard Security</span>
            </div>
        </div>
        <div class="fileguard-report-overlay" style="
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.6);
            backdrop-filter: blur(2px);
            z-index: 9998;
            cursor: pointer;
        "></div>
    `;
}

// Update the scan all results handling
function updateScanAllResults(results, scanControlsContainer) {
    const resultsContainer = document.createElement('div');
    resultsContainer.className = 'fileguard-results-container';
    resultsContainer.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-top: 8px;
    `;

    results.forEach(({ fileLink, result }) => {
        const resultDiv = document.createElement('div');
        resultDiv.className = 'fileguard-result-container';
        resultDiv.style.cssText = `
            display: flex;
            align-items: center;
            gap: 8px;
        `;
        resultDiv.innerHTML = RESULT_HTML(result.status, {
            ...result,
            fileName: fileLink.getAttribute('download') || fileLink.textContent.trim(),
            fileType: (fileLink.getAttribute('download') || fileLink.textContent.trim()).split('.').pop() || 'Unknown',
            source: 'Gmail Attachment',
            scanEngine: 'VirusTotal'
        });

        // Add click handlers to the new result's report button
        const reportBtn = resultDiv.querySelector('.fileguard-report-btn');
        if (reportBtn) {
            reportBtn.addEventListener('click', () => showReport(resultDiv));
        }

        resultsContainer.appendChild(resultDiv);
        fileLink.classList.add('fileguard-scanned');
    });

    scanControlsContainer.innerHTML = '';
    scanControlsContainer.appendChild(resultsContainer);
}

// Start the extension
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    initialize();
}


