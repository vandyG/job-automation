// background.js - Service worker for the extension
chrome.runtime.onInstalled.addListener(() => {
    console.log('Listbox Automation Extension installed');
});

// Handle messages from content scripts or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Background received message:', request);
    
    // You can add background processing logic here if needed
    // For now, most functionality is handled in content.js and popup.js
    
    // Orchestrate job automation across navigations
    if (request.action === 'startJobAutomation' && request.tabId) {
        startJobAutomation(request.tabId).then(res => {
            sendResponse({ started: true });
        }).catch(err => {
            sendResponse({ started: false, error: err?.message || String(err) });
        });
        return true; // will respond asynchronously
    }

    return false; // Don't keep the message channel open for other messages
});

// Map of tabId => state { step }
const jobAutomationState = {};

async function startJobAutomation(tabId) {
    // Initialize state
    jobAutomationState[tabId] = { step: 0 };

    // Ensure content script is present in tab by injecting it
    await new Promise((resolve, reject) => {
        chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] }, (res) => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
            } else {
                resolve(res);
            }
        });
    });

    // Send first step
    sendJobStep(tabId, 0);

    return true;
}

function sendJobStep(tabId, step) {
    if (!jobAutomationState[tabId]) return;
    jobAutomationState[tabId].step = step;
    chrome.tabs.sendMessage(tabId, { action: 'runJobAutomationStep', step }, (response) => {
        if (chrome.runtime.lastError) {
            console.warn('Error sending job step:', chrome.runtime.lastError.message);
            return;
        }
        console.log('Job step response:', response);
        // If the response indicates completion, clear state
        if (response && response.finished) {
            delete jobAutomationState[tabId];
        }
    });
}

// Listen for navigation completion to continue automation
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (!jobAutomationState[tabId]) return;
    // When a navigation completes, move to the next step
    if (changeInfo.status === 'complete') {
        const state = jobAutomationState[tabId];
        const nextStep = (state.step || 0) + 1;
        // If we've exhausted steps (3 is last index), clear state
        const MAX_STEP = 3;
        if (nextStep > MAX_STEP) {
            delete jobAutomationState[tabId];
            return;
        }
        // Small delay to ensure content script is ready
        setTimeout(() => sendJobStep(tabId, nextStep), 300);
    }
});
