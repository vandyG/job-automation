// popup.js - Handles the extension popup interface
document.addEventListener('DOMContentLoaded', function() {
    const automateBtn = document.getElementById('automateBtn');
    const detectBtn = document.getElementById('detectBtn');
    const runJobBtn = document.getElementById('runJobBtn');
    const tabListbox = document.getElementById('tabListbox');
    const tabJob = document.getElementById('tabJob');
    const listboxPanel = document.getElementById('listboxPanel');
    const jobPanel = document.getElementById('jobPanel');
    const statusDiv = document.getElementById('status');
    const listboxDataTextarea = document.getElementById('listboxData');

    // Default data
    const defaultData = {
        "4c40c353a422102cab96a01658860001": {
            "value": "6d0ee0914f8f1001b0dad4b12a070001",
            "text": "No"
        },
        "4c40c353a422102cab96a0afff5f0003": {
            "value": "4cc67a816877102ca5019d1aa9050000",
            "text": "No"
        },
        "4c40c353a422102cab96a0afff5f0009": {
            "value": "183bb31d972310015d811723d9d80002",
            "text": "Yes"
        },
        "4c40c353a422102cab96a0afff5f000c": {
            "value": "2b2350cd3e30100f7cf73579d5860000",
            "text": "No"
        },
        "4c40c353a422102cab96a149d1e30002": {
            "value": "b27175f300cb100f7d07fb2243fd0001",
            "text": "Yes"
        },
        "4c40c353a422102cab96a149d1e30005": {
            "value": "183bb31d972310015d81825c121c0002",
            "text": "Yes"
        },
        "4c40c353a422102cab96a149d1e30008": {
            "value": "183bb31d972310015d817ff42cec0002",
            "text": "$100,000 - $120,000"
        },
        "4c40c353a422102cab96a27ceda10001": {
            "value": "183bb31d972310015d81cc78c87b0001",
            "text": "No"
        },
        "4c40c353a422102cab96a27ceda10005": {
            "value": "bf9f76324498101bfda67414136b0000",
            "text": "No"
        },
        "4c40c353a422102cab96a31696160001": {
            "value": "183bb31d972310015d81a54f8d550002",
            "text": "Yes"
        },
        "4c40c353a422102cab96a31696160007": {
            "value": "183bb31d972310015d81947202b60962",
            "text": "No"
        },
        "4c40c353a422102cab96a3169616000a": {
            "value": "183bb31d972310015d815831954e0002",
            "text": "No"
        }
    };

    // Load default data
    listboxDataTextarea.value = JSON.stringify(defaultData, null, 2);

    function showStatus(message, type = 'info') {
        statusDiv.innerHTML = `<div class="${type}">${message}</div>`;
    }

    function getCurrentTab() {
        return new Promise((resolve) => {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                resolve(tabs[0]);
            });
        });
    }

    automateBtn.addEventListener('click', async function() {
        try {
            const listboxData = JSON.parse(listboxDataTextarea.value);
            const tab = await getCurrentTab();
            
            automateBtn.disabled = true;
            showStatus('Starting automation...', 'info');

            // Inject and execute the automation script
            chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: automateListboxes,
                args: [listboxData]
            }, (results) => {
                if (chrome.runtime.lastError) {
                    showStatus(`Error: ${chrome.runtime.lastError.message}`, 'error');
                } else if (results && results[0]) {
                    const result = results[0].result;
                    if (result.success) {
                        showStatus(`Automation completed! ${result.successful}/${result.total} listboxes processed successfully.`, 'success');
                    } else {
                        showStatus(`Automation failed: ${result.error}`, 'error');
                    }
                }
                automateBtn.disabled = false;
            });

        } catch (error) {
            showStatus(`Invalid JSON data: ${error.message}`, 'error');
            automateBtn.disabled = false;
        }
    });

    detectBtn.addEventListener('click', async function() {
        try {
            const tab = await getCurrentTab();
            
            detectBtn.disabled = true;
            showStatus('Detecting listboxes...', 'info');

            chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: detectListboxes
            }, (results) => {
                if (chrome.runtime.lastError) {
                    showStatus(`Error: ${chrome.runtime.lastError.message}`, 'error');
                } else if (results && results[0]) {
                    const listboxes = results[0].result;
                    showStatus(`Found ${listboxes.length} listboxes on the page.`, 'success');
                    console.log('Detected listboxes:', listboxes);
                }
                detectBtn.disabled = false;
            });

        } catch (error) {
            showStatus(`Detection failed: ${error.message}`, 'error');
            detectBtn.disabled = false;
        }
    });

    // Tab switching
    tabListbox.addEventListener('click', () => {
        listboxPanel.style.display = '';
        jobPanel.style.display = 'none';
    });
    tabJob.addEventListener('click', () => {
        listboxPanel.style.display = 'none';
        jobPanel.style.display = '';
    });

    // Run Job Automation independently
    runJobBtn.addEventListener('click', async () => {
        try {
            const tab = await getCurrentTab();
            runJobBtn.disabled = true;
            showStatus('Running job automation...', 'info');

            // Disallow internal pages where content scripts cannot be injected
            const url = tab.url || '';
            if (url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url === 'about:blank') {
                showStatus('Cannot run automation on this page (internal or protected page). Open a regular website tab.', 'error');
                runJobBtn.disabled = false;
                return;
            }

            const sendRunMessage = (cb) => {
                chrome.tabs.sendMessage(tab.id, { action: 'runJobAutomation' }, cb);
            };

            // Ask the background script to start orchestrating job automation across navigations
            chrome.runtime.sendMessage({ action: 'startJobAutomation', tabId: tab.id }, (resp) => {
                if (chrome.runtime.lastError) {
                    showStatus(`Failed to start automation: ${chrome.runtime.lastError.message}`, 'error');
                    runJobBtn.disabled = false;
                    return;
                }
                if (resp && resp.started) {
                    showStatus('Job automation started and will continue across pages.', 'success');
                } else {
                    showStatus(`Failed to start automation: ${resp?.error || 'unknown error'}`, 'error');
                }
                runJobBtn.disabled = false;
            });

        } catch (error) {
            showStatus(`Job automation failed: ${error.message}`, 'error');
            runJobBtn.disabled = false;
        }
    });
});

// Function to be injected into the page for automation
function automateListboxes(listboxData) {
    return new Promise(async (resolve) => {
        const results = [];
        let successful = 0;
        let total = Object.keys(listboxData).length;

        // Helper functions
        const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));
        
        function findDropdownOption(dropdown, targetValue, targetText) {
            const selectors = [
                `[value="${targetValue}"]`,
                `[data-value="${targetValue}"]`,
                `option[value="${targetValue}"]`,
                `li[data-value="${targetValue}"]`,
                `div[data-value="${targetValue}"]`,
                `span[data-value="${targetValue}"]`
            ];
            
            for (const selector of selectors) {
                const option = dropdown.querySelector(selector);
                if (option) return option;
            }
            
            const allOptions = dropdown.querySelectorAll('li, option, div[role="option"], span[role="option"]');
            for (const option of allOptions) {
                if (option.textContent.trim() === targetText) {
                    return option;
                }
            }
            
            return null;
        }
        
        function triggerEvent(element, eventType) {
            const event = new Event(eventType, { bubbles: true, cancelable: true });
            element.dispatchEvent(event);
        }

        // Process each listbox
        for (const [nameId, data] of Object.entries(listboxData)) {
            try {
                const button = document.querySelector(`button[name="${nameId}"]`) || 
                              document.querySelector(`button[id="${nameId}"]`) ||
                              document.querySelector(`[name="${nameId}"]`) ||
                              document.querySelector(`[id="${nameId}"]`);
                
                if (!button) {
                    throw new Error(`Button not found`);
                }

                console.log(`Processing listbox: ${nameId}`);
                
                // Open dropdown if needed
                const isExpanded = button.getAttribute('aria-expanded') === 'true';
                if (!isExpanded) {
                    button.focus();
                    await wait(100);
                    button.click();
                    await wait(300);
                    triggerEvent(button, 'mousedown');
                    triggerEvent(button, 'mouseup');
                }
                
                // Find dropdown
                const controlsId = button.getAttribute('aria-controls');
                let dropdown = null;
                
                if (controlsId) {
                    dropdown = document.getElementById(controlsId);
                }
                
                if (!dropdown) {
                    dropdown = button.nextElementSibling;
                    if (!dropdown || !dropdown.querySelector('[role="option"], option, li')) {
                        dropdown = button.parentElement.querySelector('[role="listbox"], ul, ol, .dropdown, .select-options');
                    }
                }
                
                if (!dropdown) {
                    throw new Error(`Dropdown not found`);
                }
                
                // Find and select option
                const targetOption = findDropdownOption(dropdown, data.value, data.text);
                
                if (!targetOption) {
                    throw new Error(`Option not found`);
                }
                
                targetOption.focus();
                await wait(100);
                targetOption.click();
                triggerEvent(targetOption, 'mousedown');
                triggerEvent(targetOption, 'mouseup');
                
                if (targetOption.hasAttribute('aria-selected')) {
                    dropdown.querySelectorAll('[aria-selected="true"]').forEach(opt => {
                        opt.setAttribute('aria-selected', 'false');
                    });
                    targetOption.setAttribute('aria-selected', 'true');
                }
                
                triggerEvent(button, 'change');
                triggerEvent(button, 'input');
                
                await wait(200);
                
                successful++;
                results.push({ nameId, success: true, message: 'Success' });
                
            } catch (error) {
                console.error(`Error with ${nameId}:`, error);
                results.push({ nameId, success: false, message: error.message });
            }
            
            await wait(500); // Wait between selections
        }
        
        resolve({
            success: true,
            successful,
            total,
            results
        });
    });
}

// Function to detect listboxes on the page
function detectListboxes() {
    const listboxButtons = document.querySelectorAll('button[aria-haspopup="listbox"]');
    const listboxData = [];
    
    listboxButtons.forEach(button => {
        listboxData.push({
            id: button.id || null,
            name: button.name || null,
            value: button.value || null,
            text: button.textContent?.trim() || null,
            ariaLabel: button.getAttribute('aria-label') || null
        });
    });
    
    return listboxData;
}
