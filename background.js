// Configuration
const CONFIG = {
    VT_API_URL: 'https://www.virustotal.com/vtapi/v2',
    VT_API_KEY: process.env.VIRUSTOTAL_API_KEY || '',
    MAX_REQUESTS_PER_MINUTE: 4, // VirusTotal free tier limit
    TIMEOUT: 60000, // 60 seconds
    CACHE_TTL: 3600000, // 1 hour
    MAX_RETRIES: 10,
    RETRY_DELAY: 3000 // 3 seconds
};

// Rate limiting queue
const scanQueue = {
    queue: [],
    lastRequestTime: 0,
    requestsThisMinute: 0,
    
    async add(task) {
        return new Promise((resolve) => {
            this.queue.push({ task, resolve });
            this.process();
        });
    },
    
    async process() {
        if (this.queue.length === 0) return;
        
        const now = Date.now();
        const timeSinceLastMinute = now - (this.lastRequestTime - (this.lastRequestTime % 60000));
        
        // Reset counter if new minute
        if (timeSinceLastMinute >= 60000) {
            this.requestsThisMinute = 0;
        }
        
        if (this.requestsThisMinute < CONFIG.MAX_REQUESTS_PER_MINUTE) {
            const { task, resolve } = this.queue.shift();
            this.requestsThisMinute++;
            this.lastRequestTime = now;
            
            try {
                const result = await task();
                resolve(result);
            } catch (error) {
                resolve({ status: 'error', message: error.message });
            }
            
            this.process();
        } else {
            // Wait until next minute
            const delay = 60000 - timeSinceLastMinute + 1000;
            setTimeout(() => this.process(), delay);
        }
    }
};

// Cache for scan results
const scanCache = new Map();

// Message handler
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'scanFile') {
        handleScanRequest(request.fileUrl, request.fileName)
            .then(sendResponse)
            .catch(error => sendResponse({ status: 'error', error: error.message }));
        return true; // Keep the message channel open for async response
    }
    else if (request.action === 'validateApiKey') {
        validateVTApiKey(request.apiKey)
            .then(response => {
                console.log('API key validation response:', response);
                sendResponse(response);
            })
            .catch(error => {
                console.error('API key validation error:', error);
                sendResponse({ 
                    valid: false, 
                    error: error.message || 'Validation failed'
                });
            });
        return true;
    }
    else if (request.action === 'setApiKey') {
        chrome.storage.sync.set({ 'vt_api_key': request.apiKey }, () => {
            sendResponse({ success: true });
        });
        return true;
    }
    else if (request.action === 'getApiKey') {
        chrome.storage.sync.get(['vt_api_key'], (result) => {
            sendResponse({ apiKey: result.vt_api_key || null });
            });
        return true;
    }
});

// Main scanning function
async function handleScanRequest(fileUrl, fileName) {
    try {
        // First try to get hash of file
        const response = await fetch(fileUrl, {
            mode: 'cors',
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);
        }
        
        const blob = await response.blob();
        
        // Special handling for CSV files - check file size
        if (fileName.toLowerCase().endsWith('.csv') && blob.size > 32 * 1024 * 1024) {
            throw new Error('CSV file is too large (max 32MB)');
        }

        const hash = await calculateSHA256(blob);
        console.log('[FileGuard] File hash:', hash);

        // Check if file has been scanned before
        let vtResponse = await fetchVTHashReport(hash);
        console.log('[FileGuard] Hash report response:', vtResponse);
        
        if (!vtResponse || vtResponse.response_code === 0) {
            // File hasn't been scanned before, submit for scanning
            console.log('[FileGuard] Submitting file for scanning...');
            vtResponse = await fetchVTFileScan(blob, fileName);
            console.log('[FileGuard] Scan submission response:', vtResponse);
            
            if (!vtResponse || vtResponse.response_code === 0) {
                throw new Error('Failed to submit file for scanning');
            }
            
            // Wait for scan to complete (up to 60 seconds)
            for (let i = 0; i < 12; i++) {
                await new Promise(resolve => setTimeout(resolve, 5000));
                vtResponse = await fetchVTHashReport(hash);
                console.log('[FileGuard] Polling scan result:', vtResponse);
                if (vtResponse && vtResponse.response_code === 1) break;
            }
        }

        if (!vtResponse || !vtResponse.response_code) {
            throw new Error('Invalid response from VirusTotal');
        }

        return formatVTResponse(vtResponse);
    } catch (error) {
        console.error('[FileGuard] Scan error:', error);
        throw new Error(`Failed to scan file: ${error.message}`);
    }
}

async function fetchVTHashReport(hash) {
    try {
        const params = new URLSearchParams({
            apikey: CONFIG.VT_API_KEY,
            resource: hash
        });

        const response = await fetch(`${CONFIG.VT_API_URL}/file/report?${params}`);
    if (!response.ok) {
            throw new Error(`VirusTotal API error: ${response.status}`);
        }
        
        const text = await response.text(); // First get response as text
        try {
            return JSON.parse(text); // Then try to parse as JSON
        } catch (e) {
            console.error('[FileGuard] Failed to parse JSON response:', text);
            throw new Error('Invalid response from VirusTotal');
        }
    } catch (error) {
        console.error('[FileGuard] Hash report error:', error);
        return null;
    }
}

async function fetchVTFileScan(blob, fileName) {
    try {
    const formData = new FormData();
        formData.append('apikey', CONFIG.VT_API_KEY);
        formData.append('file', blob, fileName);
    
        const response = await fetch(`${CONFIG.VT_API_URL}/file/scan`, {
        method: 'POST',
        body: formData
    });
    
    if (!response.ok) {
            throw new Error(`VirusTotal scan error: ${response.status}`);
        }

        const text = await response.text(); // First get response as text
        try {
            return JSON.parse(text); // Then try to parse as JSON
        } catch (e) {
            console.error('[FileGuard] Failed to parse JSON response:', text);
            throw new Error('Invalid response from VirusTotal');
        }
    } catch (error) {
        console.error('[FileGuard] File scan error:', error);
        return null;
    }
}

function formatVTResponse(vtResponse) {
    if (!vtResponse || vtResponse.response_code === 0) {
        return {
            status: 'unknown',
            timestamp: new Date().toISOString(),
            stats: {
                total: 0,
                malicious: 0,
                suspicious: 0,
                harmless: 0,
                undetected: 0
            }
        };
    }

    const stats = {
        total: vtResponse.total || 0,
        malicious: vtResponse.positives || 0,
        suspicious: 0,
        harmless: (vtResponse.total || 0) - (vtResponse.positives || 0),
        undetected: 0
    };

    // Determine status based on detection ratio
    let status = 'clean';
    const detectionRatio = stats.malicious / stats.total;
    if (detectionRatio > 0.1) {
        status = 'malicious';
    } else if (detectionRatio > 0) {
        status = 'suspicious';
    }
    
    return {
        status,
        timestamp: vtResponse.scan_date || new Date().toISOString(),
        stats,
        detections: vtResponse.scans ? Object.entries(vtResponse.scans)
            .filter(([_, result]) => result.detected)
            .map(([engine, result]) => ({
                engine,
                result: result.result || 'unknown',
                category: result.result?.toLowerCase().includes('malicious') ? 'malicious' : 'suspicious'
            })) : [],
        permalink: vtResponse.permalink
    };
}

async function calculateSHA256(blob) {
    const buffer = await blob.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function getApiKey() {
    return new Promise((resolve) => {
        chrome.storage.sync.get(['vt_api_key'], (result) => {
            resolve(result.vt_api_key || null);
        });
    });
}

async function validateVTApiKey(key) {
    try {
        const response = await fetch(`${CONFIG.VT_API_URL}/users/current`, {
            headers: { 'x-apikey': key }
        });
        
        return {
            valid: response.ok,
            error: response.ok ? null : 'Invalid API key'
        };
    } catch (error) {
        console.error('API key validation error:', error);
        return {
            valid: false,
            error: 'Failed to validate API key'
        };
    }
}

function logError(error, context = '') {
    console.error(`[FileGuard] ${context}:`, error);
}

// Initialize
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.set({
        scanCount: 0,
        lastScanTime: null,
        settings: { autoScan: true }
    });
});
