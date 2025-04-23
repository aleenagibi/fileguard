// Load saved settings and initialize UI
document.addEventListener('DOMContentLoaded', async () => {
    // Load saved settings
    chrome.storage.sync.get(
        ['autoScan', 'notifications', 'virusTotalApiKey'], 
        function(data) {
            // Initialize auto-scan setting
            const autoScanCheckbox = document.getElementById('auto-scan');
            autoScanCheckbox.checked = data.autoScan !== false;
            updateStatusIndicator(autoScanCheckbox.checked);

            // Initialize notifications setting
            document.getElementById('notifications').checked = data.notifications !== false;

            // Initialize API key field
            const apiKeyInput = document.getElementById('vt-api-key');
            if (data.virusTotalApiKey) {
                apiKeyInput.value = data.virusTotalApiKey;
                updateApiKeyStatus(true);
            } else {
                updateApiKeyStatus(false);
            }
        }
    );

    // Save auto-scan setting
    document.getElementById('auto-scan').addEventListener('change', function(e) {
        chrome.storage.sync.set({ autoScan: e.target.checked });
        updateStatusIndicator(e.target.checked);
    });

    // Save notifications setting
    document.getElementById('notifications').addEventListener('change', function(e) {
        chrome.storage.sync.set({ notifications: e.target.checked });
    });

    // Load saved API key
    const response = await chrome.runtime.sendMessage({ action: 'getApiKey' });
    if (response.apiKey) {
        document.getElementById('vt-api-key').value = response.apiKey;
    }
    
    const saveButton = document.getElementById('save-api-key');
    const statusDiv = document.getElementById('status');
    
    saveButton.addEventListener('click', async () => {
        const apiKey = document.getElementById('vt-api-key').value.trim();
        
        if (!apiKey) {
            showStatus('Please enter an API key', 'error');
            return;
        }
        
        // Validate API key
        saveButton.disabled = true;
        saveButton.textContent = 'Validating...';
        
        try {
            const validationResponse = await chrome.runtime.sendMessage({
                action: 'validateApiKey',
                apiKey: apiKey
            });
            
            if (validationResponse.valid) {
                // Save API key
                await chrome.runtime.sendMessage({
                    action: 'setApiKey',
                    apiKey: apiKey
                });
                
                showStatus('API key saved successfully', 'success');
            } else {
                showStatus(validationResponse.error || 'Invalid API key', 'error');
            }
        } catch (error) {
            showStatus('Failed to validate API key', 'error');
        } finally {
            saveButton.disabled = false;
            saveButton.textContent = 'Save';
        }
    });

    // Show error logs button
    document.getElementById('show-logs').addEventListener('click', function() {
        chrome.storage.local.get(['errors'], function(data) {
            const errors = data.errors || [];
            const logsDiv = document.getElementById('error-logs');
            
            if (errors.length === 0) {
                logsDiv.innerHTML = '<p>No errors logged</p>';
                return;
            }

            logsDiv.innerHTML = errors.map(error => `
                <div class="error-log">
                    <div class="error-timestamp">${new Date(error.timestamp).toLocaleString()}</div>
                    <div class="error-context">${error.context}</div>
                    <div class="error-message">${error.message}</div>
                </div>
            `).join('');
        });
    });
});

// Update status indicator based on auto-scan setting
function updateStatusIndicator(isEnabled) {
    const status = document.querySelector('.status');
    if (isEnabled) {
        status.innerHTML = '✅ FileGuard is active and protecting your Gmail attachments';
        status.style.backgroundColor = '#e8f5e9';
        status.style.color = '#2e7d32';
    } else {
        status.innerHTML = '⚠️ Auto-scan is disabled';
        status.style.backgroundColor = '#fff3e0';
        status.style.color = '#ef6c00';
    }
}

// Update API key status indicator
function updateApiKeyStatus(isConfigured) {
    const apiKeyStatus = document.querySelector('.api-key-status');
    if (isConfigured) {
        apiKeyStatus.innerHTML = '✅ API key configured';
        apiKeyStatus.style.color = '#2e7d32';
    } else {
        apiKeyStatus.innerHTML = '⚠️ API key not configured';
        apiKeyStatus.style.color = '#ef6c00';
    }
}

// Show error message
function showError(message) {
    const errorDiv = document.getElementById('error-message');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, 5000);
}

function showStatus(message, type) {
    const statusDiv = document.getElementById('status');
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    setTimeout(() => {
        statusDiv.className = 'status';
    }, 3000);
} 