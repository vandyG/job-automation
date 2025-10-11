// content.js - Content script that runs on all pages
console.log('Listbox Automation Extension loaded');

// Listen for messages from the popup or background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'detectListboxes') {
        const listboxes = detectListboxes();
        sendResponse({ listboxes });
    } else if (request.action === 'automateListboxes') {
        automateListboxes(request.data).then(result => {
            sendResponse(result);
        }).catch(error => {
            sendResponse({ success: false, error: error.message });
        });
        return true; // Will respond asynchronously
    } else if (request.action === 'runJobAutomation') {
        runJobApplicationAutomation().then(result => {
            sendResponse(result);
        }).catch(error => {
            sendResponse({ success: false, error: error.message });
        });
        return true;
    } else if (request.action === 'runJobAutomationStep') {
        // request.step: 0 -> click Submit Resume (if present)
        // 1 -> click Continue (upload)
        // 2 -> select manual radio and click Continue
        // 3 -> click final Submit
        const step = Number(request.step || 0);
        runJobAutomationStep(step).then(resp => {
            sendResponse(resp);
        }).catch(err => {
            sendResponse({ success: false, error: err?.message || String(err) });
        });
        return true;
    }
});

// Function to detect all listboxes on the page
function detectListboxes() {
    const listboxButtons = document.querySelectorAll('button[aria-haspopup="listbox"]');
    const listboxData = [];
    
    listboxButtons.forEach(button => {
        listboxData.push({
            id: button.id || null,
            name: button.name || null,
            value: button.value || null,
            text: button.textContent?.trim() || null,
            ariaLabel: button.getAttribute('aria-label') || null,
            isExpanded: button.getAttribute('aria-expanded') === 'true'
        });
    });
    
    return listboxData;
}

// Main automation function
async function automateListboxes(listboxData) {
    // Simple site-detection: if this page contains known job-application selectors,
    // run the job application automation flow instead of listbox automation.
    const isJobSite = () => {
        // Submit Resume link on job description page
        if (document.querySelector('#jobdetails-jobdetails-jobdetailfooter-actions-jobdetailssubmitresume')) return true;
        // Resume upload / apply flow uses #apply-step-continue-button, but that id can be used on other sites;
        // check for the presence of the specific radio selector from the attachments
        if (document.querySelector('#manualOption') && document.querySelector('#apply-step-continue-button')) return true;
        return false;
    };

    async function automateJobApplicationFlow() {
        const results = [];
        const wait = (ms) => new Promise(res => setTimeout(res, ms));

        try {
            // 1) Click "Submit Resume" link if present (job description page)
            const submitResume = document.querySelector('#jobdetails-jobdetails-jobdetailfooter-actions-jobdetailssubmitresume');
            if (submitResume) {
                submitResume.click();
                results.push({ step: 'submitResume', success: true, message: 'Clicked Submit Resume link' });
                await wait(800);
            }

            // 2) On upload page, click Continue (may be same id across steps)
            let continueBtn = document.querySelector('#apply-step-continue-button');
            if (continueBtn) {
                // If the button is a <button> element and disabled, try enabling by removing disabled attr
                if (continueBtn.disabled) continueBtn.disabled = false;
                continueBtn.click();
                results.push({ step: 'continueUpload', success: true, message: 'Clicked Continue on upload page' });
                await wait(800);
            }

            // 3) On profile selection page: select manual option radio, then click Continue
            const manualRadio = document.querySelector('#manualOption');
            if (manualRadio) {
                // If it's not already checked, click it
                if (!manualRadio.checked) {
                    manualRadio.click();
                    results.push({ step: 'selectManual', success: true, message: 'Selected manual profile option' });
                    await wait(400);
                }

                // Click continue again (same id)
                continueBtn = document.querySelector('#apply-step-continue-button');
                if (continueBtn) {
                    if (continueBtn.disabled) continueBtn.disabled = false;
                    continueBtn.click();
                    results.push({ step: 'continueProfile', success: true, message: 'Clicked Continue after selecting manual option' });
                    await wait(800);
                }
            }

            // 4) Final application page: click Submit (same id used as continue)
            const submitBtn = document.querySelector('#apply-step-continue-button');
            if (submitBtn) {
                // Some pages change the button text to "Submit" — click anyway
                if (submitBtn.disabled) submitBtn.disabled = false;
                submitBtn.click();
                results.push({ step: 'submitApplication', success: true, message: 'Clicked final Submit button' });
                await wait(800);
            }

            return { success: true, flow: 'job-application', results };
        } catch (error) {
            return { success: false, flow: 'job-application', error: error.message, results };
        }
    }

    // If job site detected, run that automation and return early
    if (isJobSite()) {
        console.log('Job application site detected — running job automation flow');
        return await automateJobApplicationFlow();
    }

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

    // Process each listbox sequentially
    for (const [nameId, data] of Object.entries(listboxData)) {
        try {
            const button = document.querySelector(`button[name="${nameId}"]`) || 
                          document.querySelector(`button[id="${nameId}"]`) ||
                          document.querySelector(`[name="${nameId}"]`) ||
                          document.querySelector(`[id="${nameId}"]`);
            
            if (!button) {
                throw new Error(`Button with name/id "${nameId}" not found`);
            }

            console.log(`Processing listbox: ${nameId}`);
            
            // Check if dropdown is already expanded
            const isExpanded = button.getAttribute('aria-expanded') === 'true';
            
            if (!isExpanded) {
                // Open the dropdown
                button.focus();
                await wait(100);
                button.click();
                await wait(300);
                triggerEvent(button, 'mousedown');
                triggerEvent(button, 'mouseup');
            }
            
            // Find dropdown container
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
                throw new Error(`Dropdown container not found for ${nameId}`);
            }
            
            // Find the target option
            const targetOption = findDropdownOption(dropdown, data.value, data.text);
            
            if (!targetOption) {
                throw new Error(`Option with value "${data.value}" or text "${data.text}" not found`);
            }
            
            // Select the option
            targetOption.focus();
            await wait(100);
            targetOption.click();
            triggerEvent(targetOption, 'mousedown');
            triggerEvent(targetOption, 'mouseup');
            
            // Set aria-selected if applicable
            if (targetOption.hasAttribute('aria-selected')) {
                dropdown.querySelectorAll('[aria-selected="true"]').forEach(opt => {
                    opt.setAttribute('aria-selected', 'false');
                });
                targetOption.setAttribute('aria-selected', 'true');
            }
            
            // Trigger change events
            triggerEvent(button, 'change');
            triggerEvent(button, 'input');
            
            await wait(200);
            
            successful++;
            results.push({
                nameId,
                success: true,
                message: 'Successfully selected',
                selectedValue: data.value,
                selectedText: data.text
            });
            
        } catch (error) {
            console.error(`Error selecting ${nameId}:`, error);
            results.push({
                nameId,
                success: false,
                message: error.message,
                selectedValue: null,
                selectedText: null
            });
        }
        
        // Wait between selections
        await wait(500);
    }
    
    return {
        success: true,
        successful,
        total,
        results
    };
}

// Expose a top-level function to run the job-application automation directly
// so the popup can invoke it independently of listbox automation.
async function runJobApplicationAutomation() {
    // Reuse the internal automateJobApplicationFlow by copying detection and flow here.
    const wait = (ms) => new Promise(res => setTimeout(res, ms));

    const results = [];

    try {
        const submitResume = document.querySelector('#jobdetails-jobdetails-jobdetailfooter-actions-jobdetailssubmitresume');
        if (submitResume) {
            submitResume.click();
            results.push({ step: 'submitResume', success: true, message: 'Clicked Submit Resume link' });
            await wait(800);
        }

        let continueBtn = document.querySelector('#apply-step-continue-button');
        if (continueBtn) {
            if (continueBtn.disabled) continueBtn.disabled = false;
            continueBtn.click();
            results.push({ step: 'continueUpload', success: true, message: 'Clicked Continue on upload page' });
            await wait(800);
        }

        const manualRadio = document.querySelector('#manualOption');
        if (manualRadio) {
            if (!manualRadio.checked) {
                manualRadio.click();
                results.push({ step: 'selectManual', success: true, message: 'Selected manual profile option' });
                await wait(400);
            }

            continueBtn = document.querySelector('#apply-step-continue-button');
            if (continueBtn) {
                if (continueBtn.disabled) continueBtn.disabled = false;
                continueBtn.click();
                results.push({ step: 'continueProfile', success: true, message: 'Clicked Continue after selecting manual option' });
                await wait(800);
            }
        }

        const submitBtn = document.querySelector('#apply-step-continue-button');
        if (submitBtn) {
            if (submitBtn.disabled) submitBtn.disabled = false;
            submitBtn.click();
            results.push({ step: 'submitApplication', success: true, message: 'Clicked final Submit button' });
            await wait(800);
        }

        return { success: true, flow: 'job-application', results };
    } catch (error) {
        return { success: false, flow: 'job-application', error: error.message, results };
    }
}

// Perform a single step of the job automation sequence. Returns an object { success, performed, finished, message }
async function runJobAutomationStep(step) {
    const wait = (ms) => new Promise(res => setTimeout(res, ms));
    const waitForCondition = async (fn, timeout = 3000, interval = 150) => {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            try {
                if (fn()) return true;
            } catch (e) {
                // ignore
            }
            // eslint-disable-next-line no-await-in-loop
            await wait(interval);
        }
        return false;
    };
    try {
        if (step === 0) {
            const submitResume = document.querySelector('#jobdetails-jobdetails-jobdetailfooter-actions-jobdetailssubmitresume');
            if (submitResume) {
                submitResume.click();
                await wait(600);
                return { success: true, performed: true, finished: false, message: 'Clicked Submit Resume' };
            }
            // If no submit resume link, treat as performed but move on
            return { success: true, performed: false, finished: false, message: 'No Submit Resume link found' };
        }

        if (step === 1) {
            const continueBtn = document.querySelector('#apply-step-continue-button');
            if (continueBtn) {
                if (continueBtn.disabled) continueBtn.disabled = false;
                continueBtn.click();
                await wait(600);
                return { success: true, performed: true, finished: false, message: 'Clicked Continue (upload)' };
            }
            return { success: true, performed: false, finished: false, message: 'No Continue button found (upload)' };
        }

        if (step === 2) {
            // Robust selection of the manual option radio
            let performed = false;
            const selectors = [
                '#manualOption',
                'input[name="profile-fill-option"][value="manual"]',
                'input[id$="manualOption"]',
                'input.form-selector-input[name="profile-fill-option"]'
            ];

            let manualRadio = null;
            for (const sel of selectors) {
                manualRadio = document.querySelector(sel);
                if (manualRadio) break;
            }

            // Helper to dispatch input/change events
            function dispatchChange(el) {
                try {
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                } catch (e) {
                    // ignore
                }
            }

            if (manualRadio) {
                try {
                    manualRadio.scrollIntoView({ block: 'center', inline: 'nearest' });
                    manualRadio.focus({ preventScroll: true });

                    // Try clicking the input directly
                    if (!manualRadio.checked) {
                        manualRadio.click();
                        await wait(250);
                    }

                    // If still not checked, try setting the property and dispatching events
                    if (!manualRadio.checked) {
                        manualRadio.checked = true;
                        dispatchChange(manualRadio);
                        await wait(150);
                    }

                    // Also attempt to click an associated label
                    if (!manualRadio.checked) {
                        const id = manualRadio.id;
                        if (id) {
                            const label = document.querySelector(`label[for="${id}"]`);
                            if (label) {
                                label.click();
                                await wait(200);
                            }
                        }
                        // try closest parent label
                        if (!manualRadio.checked) {
                            const parentLabel = manualRadio.closest('label');
                            if (parentLabel) {
                                parentLabel.click();
                                await wait(200);
                            }
                        }
                    }
                    // Wait for the checked state to be reflected by the browser/site handlers
                    const gotChecked = await waitForCondition(() => manualRadio.checked === true, 3000, 150);
                    if (gotChecked) {
                        performed = true;
                    } else {
                        console.warn('Manual radio did not become checked within timeout');
                    }
                } catch (err) {
                    console.warn('Error selecting manual radio:', err);
                }
            }

            // Click Continue after trying to select the radio
            const continueBtn = document.querySelector('#apply-step-continue-button');
            if (continueBtn) {
                try {
                    if (continueBtn.disabled) continueBtn.disabled = false;
                    continueBtn.scrollIntoView({ block: 'center', inline: 'nearest' });
                    continueBtn.focus({ preventScroll: true });
                    continueBtn.click();
                    performed = true || performed;
                    await wait(600);
                } catch (err) {
                    console.warn('Error clicking Continue:', err);
                }
            }

            return { success: true, performed, finished: false, message: 'Attempted to select manual option and clicked Continue' };
        }

        if (step === 3) {
            const submitBtn = document.querySelector('#apply-step-continue-button');
            if (submitBtn) {
                if (submitBtn.disabled) submitBtn.disabled = false;
                submitBtn.click();
                await wait(600);
                return { success: true, performed: true, finished: true, message: 'Clicked final Submit' };
            }
            return { success: true, performed: false, finished: true, message: 'No final Submit button found' };
        }

        return { success: false, performed: false, finished: true, message: 'Unknown step' };
    } catch (error) {
        return { success: false, performed: false, finished: true, message: error.message };
    }
}
