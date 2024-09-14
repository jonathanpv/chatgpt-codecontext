// ==UserScript==
// @name         ChatGPT Custom UI with Draggable File Selection
// @namespace    http://tampermonkey.net/
// @version      1.4
// @description  Persistent Custom UI for ChatGPT with draggable file selection, theme toggle, and enhanced button styles
// @match        https://chatgpt.com/*
// @grant        GM_xmlhttpRequest
// @connect      localhost
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // Backend server URL
    const SERVER_URL = 'http://localhost:5000';

    // ID for the custom UI container
    const CUSTOM_UI_ID = 'custom-chatgpt-ui';

    // Debounce timer
    let debounceTimer;

    // Default theme
    let currentTheme = 'light';

    // Function to apply theme-based styles
    function applyThemeStyles(container) {
        if (currentTheme === 'dark') {
            container.style.backgroundColor = '#212121';
            container.style.color = '#ececec';
            container.style.border = '1px solid #555';
            container.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.5)';
            container.style.fontFamily = 'ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

            // Update buttons and other elements
            const buttons = container.querySelectorAll('button');
            buttons.forEach(button => {
                button.style.backgroundColor = '#555';
                button.style.color = '#ececec';
                button.style.border = 'none';
                button.style.fontFamily = 'inherit';
            });
        } else {
            container.style.backgroundColor = '#ffffff';
            container.style.color = '#000000';
            container.style.border = '1px solid #ccc';
            container.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.2)';
            container.style.fontFamily = 'ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

            const buttons = container.querySelectorAll('button');
            buttons.forEach(button => {
                button.style.backgroundColor = '#f0f0f0';
                button.style.color = '#000000';
                button.style.border = '1px solid #ccc';
                button.style.fontFamily = 'inherit';
            });
        }

        // Update checkbox styles based on theme
        const checkboxes = container.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            if (currentTheme === 'dark') {
                checkbox.style.accentColor = '#ffffff';
            } else {
                checkbox.style.accentColor = '#000000';
            }
        });
    }

    // Function to make the UI draggable
    function makeDraggable(container, handle) {
        let isDragging = false;
        let offsetX, offsetY;

        handle.style.cursor = 'move';

        handle.addEventListener('mousedown', (e) => {
            isDragging = true;
            const rect = container.getBoundingClientRect();
            offsetX = e.clientX - rect.left;
            offsetY = e.clientY - rect.top;
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });

        function onMouseMove(e) {
            if (isDragging) {
                container.style.left = `${e.clientX - offsetX}px`;
                container.style.top = `${e.clientY - offsetY}px`;
                container.style.right = 'auto'; // Disable right positioning while dragging
                container.style.bottom = 'auto'; // Disable bottom positioning if any
            }
        }

        function onMouseUp() {
            isDragging = false;
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            // Save position to localStorage
            const left = container.style.left;
            const top = container.style.top;
            localStorage.setItem('customUILeft', left);
            localStorage.setItem('customUITop', top);
        }
    }

    // Function to create and inject custom UI
    function injectCustomUI() {
        // Check if UI already exists
        if (document.getElementById(CUSTOM_UI_ID)) return;

        // Create container for custom UI
        const customUIContainer = document.createElement('div');
        customUIContainer.id = CUSTOM_UI_ID;
        customUIContainer.style.position = 'fixed';
        customUIContainer.style.top = '10%';
        customUIContainer.style.right = '20px';
        customUIContainer.style.width = '300px';
        customUIContainer.style.maxHeight = '80%';
        customUIContainer.style.overflowY = 'auto';
        customUIContainer.style.backgroundColor = '#ffffff'; // Default to light theme; will be updated
        customUIContainer.style.border = '1px solid #ccc';
        customUIContainer.style.borderRadius = '8px';
        customUIContainer.style.padding = '10px';
        customUIContainer.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.2)';
        customUIContainer.style.zIndex = '1000';
        customUIContainer.style.transition = 'background-color 0.3s, color 0.3s, border 0.3s, box-shadow 0.3s';
        customUIContainer.style.fontFamily = 'ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

        // Title bar for dragging
        const titleBar = document.createElement('div');
        titleBar.style.display = 'flex';
        titleBar.style.justifyContent = 'space-between';
        titleBar.style.alignItems = 'center';
        titleBar.style.marginBottom = '10px';
        titleBar.style.userSelect = 'none';

        const title = document.createElement('h3');
        title.innerText = 'Select Files';
        title.style.margin = '0';
        title.style.fontSize = '1.2em';
        title.style.fontFamily = 'inherit';
        title.style.color = 'inherit';

        const closeButton = document.createElement('button');
        closeButton.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                <path d="M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
        `;
        closeButton.title = 'Close';
        closeButton.style.background = 'transparent';
        closeButton.style.border = 'none';
        closeButton.style.cursor = 'pointer';
        closeButton.style.padding = '4px';
        closeButton.style.color = 'inherit';
        closeButton.style.display = 'flex';
        closeButton.style.alignItems = 'center';
        closeButton.style.justifyContent = 'center';
        closeButton.addEventListener('click', () => {
            customUIContainer.style.display = 'none';
        });

        titleBar.appendChild(title);
        titleBar.appendChild(closeButton);
        customUIContainer.appendChild(titleBar);

        // Scrollable list container
        const listContainer = document.createElement('div');
        listContainer.id = 'file-list';
        listContainer.style.maxHeight = '60vh';
        listContainer.style.overflowY = 'auto';
        listContainer.style.marginBottom = '10px';
        customUIContainer.appendChild(listContainer);

        // Refresh button
        const refreshButton = document.createElement('button');
        refreshButton.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M21 3V8M21 8H16M21 8C18.4958 5.32659 15.2136 3.75 11.75 3.75C6.22632 3.75 1.75 8.22632 1.75 13.75C1.75 19.2737 6.22632 23.75 11.75 23.75C16.6853 23.75 20.7579 20.1315 21.5961 15.25" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Refresh
        `;
        refreshButton.title = 'Refresh File List';
        refreshButton.style.width = 'auto';
        refreshButton.style.padding = '6px 12px';
        refreshButton.style.marginBottom = '10px';
        refreshButton.style.cursor = 'pointer';
        refreshButton.style.borderRadius = '9999px';
        refreshButton.style.backgroundColor = '#000000';
        refreshButton.style.color = '#ffffff';
        refreshButton.style.transition = 'background-color 0.3s, color 0.3s';
        refreshButton.style.fontFamily = 'inherit';
        refreshButton.style.display = 'flex';
        refreshButton.style.alignItems = 'center';
        refreshButton.style.justifyContent = 'center';
        refreshButton.style.gap = '6px';
        refreshButton.style.fontSize = '14px';

        refreshButton.addEventListener('click', fetchFileList);
        customUIContainer.appendChild(refreshButton);

        // Theme Toggle button
        const themeToggleButton = document.createElement('button');
        themeToggleButton.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 16C14.2091 16 16 14.2091 16 12C16 9.79086 14.2091 8 12 8V16Z" fill="currentColor"/>
            <path fill-rule="evenodd" clip-rule="evenodd" d="M12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2ZM12 4V8C9.79086 8 8 9.79086 8 12C8 14.2091 9.79086 16 12 16V20C16.4183 20 20 16.4183 20 12C20 7.58172 16.4183 4 12 4Z" fill="currentColor"/>
          </svg>
          Toggle Theme
        `;
        themeToggleButton.title = 'Toggle Light/Dark Theme';
        themeToggleButton.style.width = 'auto';
        themeToggleButton.style.padding = '6px 12px';
        themeToggleButton.style.cursor = 'pointer';
        themeToggleButton.style.borderRadius = '9999px';
        themeToggleButton.style.backgroundColor = '#007BFF';
        themeToggleButton.style.color = '#ffffff';
        themeToggleButton.style.transition = 'background-color 0.3s, color 0.3s';
        themeToggleButton.style.fontFamily = 'inherit';
        themeToggleButton.style.marginBottom = '10px';
        themeToggleButton.style.display = 'flex';
        themeToggleButton.style.alignItems = 'center';
        themeToggleButton.style.justifyContent = 'center';
        themeToggleButton.style.gap = '6px';
        themeToggleButton.style.fontSize = '14px';

        themeToggleButton.addEventListener('click', () => {
            currentTheme = currentTheme === 'light' ? 'dark' : 'light';
            applyThemeStyles(customUIContainer);
        });
        customUIContainer.appendChild(themeToggleButton);

        // Inject custom UI into the body
        document.body.appendChild(customUIContainer);

        // Apply initial theme styles
        applyThemeStyles(customUIContainer);

        // Make the UI draggable
        makeDraggable(customUIContainer, titleBar);

        // Restore position if saved
        const savedLeft = localStorage.getItem('customUILeft');
        const savedTop = localStorage.getItem('customUITop');
        if (savedLeft && savedTop) {
            customUIContainer.style.left = savedLeft;
            customUIContainer.style.top = savedTop;
            customUIContainer.style.right = 'auto';
            customUIContainer.style.bottom = 'auto';
        }

        // Fetch and display the file list
        fetchFileList();
    }

    // Function to fetch the list of files from the server
    function fetchFileList() {
        const fileListContainer = document.getElementById('file-list');
        if (!fileListContainer) return;

        fileListContainer.innerHTML = '<p>Loading files...</p>';

        GM_xmlhttpRequest({
            method: "GET",
            url: `${SERVER_URL}/get_files`,
            onload: function(response) {
                if (response.status === 200) {
                    const data = JSON.parse(response.responseText);
                    displayFileList(data.files);
                } else {
                    fileListContainer.innerHTML = `<p>Error fetching files: ${response.statusText}</p>`;
                }
            },
            onerror: function() {
                fileListContainer.innerHTML = `<p>Network error while fetching files.</p>`;
            }
        });
    }

    // Function to display the file list as checkboxes
    function displayFileList(files) {
        const fileListContainer = document.getElementById('file-list');
        if (!fileListContainer) return;

        fileListContainer.innerHTML = ''; // Clear existing content

        if (files.length === 0) {
            fileListContainer.innerHTML = '<p>No files available.</p>';
            return;
        }

        files.forEach(file => {
            const label = document.createElement('label');
            label.style.display = 'block';
            label.style.marginBottom = '5px';
            label.style.cursor = 'pointer';
            label.style.fontFamily = 'inherit';
            label.style.color = 'inherit';
            label.style.position = 'relative';
            label.style.paddingLeft = '0';
            label.style.paddingRight = '25px';
            label.style.userSelect = 'none';
            label.style.transition = 'color 0.3s';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = file;
            checkbox.style.position = 'absolute';
            checkbox.style.left = 'auto';
            checkbox.style.right = '0';
            checkbox.style.top = '0';
            checkbox.style.width = '18px';
            checkbox.style.height = '18px';
            checkbox.style.cursor = 'pointer';
            checkbox.style.borderRadius = '4px';
            checkbox.style.transition = 'background-color 0.3s, border 0.3s, transform 0.2s';

            // Event listener for checkbox
            checkbox.addEventListener('change', function() {
                if (this.checked) {
                    // Add a slight scale animation
                    this.style.transform = 'scale(1.2)';
                    setTimeout(() => {
                        this.style.transform = 'scale(1)';
                    }, 200);
                    fetchFileContent(this.value);
                } else {
                    this.style.transform = 'scale(1.2)';
                    setTimeout(() => {
                        this.style.transform = 'scale(1)';
                    }, 200);
                    removeFileContent(this.value);
                }
            });

            label.appendChild(checkbox);
            label.appendChild(document.createTextNode(file));
            fileListContainer.appendChild(label);
        });

        // Re-apply theme styles to update checkbox colors
        const customUIContainer = document.getElementById(CUSTOM_UI_ID);
        if (customUIContainer) {
            applyThemeStyles(customUIContainer);
        }
    }

    // Function to fetch file content from the server
    function fetchFileContent(filename) {
        GM_xmlhttpRequest({
            method: "GET",
            url: `${SERVER_URL}/get_file_content?filename=${encodeURIComponent(filename)}`,
            onload: function(response) {
                if (response.status === 200) {
                    const data = JSON.parse(response.responseText);
                    appendToPrompt(data.content, filename);
                } else {
                    alert(`Error fetching file content: ${response.statusText}`);
                }
            },
            onerror: function() {
                alert('Network error while fetching file content.');
            }
        });
    }

function removeFileContent(filename) {
    const promptContainer = document.querySelector('#prompt-textarea');
    if (promptContainer) {
        const contentRegex = new RegExp(`<p>=== ${filename} ===</p>[\\s\\S]*?(?=<p>===|$)`, 'g');
        promptContainer.innerHTML = promptContainer.innerHTML.replace(contentRegex, '');
        promptContainer.dispatchEvent(new Event('input', { bubbles: true }));
    }
}

function appendToPrompt(content, filename) {
    const promptContainer = document.querySelector('#prompt-textarea');
    if (promptContainer) {
        const contentToAdd = `<p>=== ${filename} ===</p><p>${content.replace(/\n/g, '</p><p>')}</p>`;
        promptContainer.innerHTML += contentToAdd;
        promptContainer.dispatchEvent(new Event('input', { bubbles: true }));

        // Move cursor to the end
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(promptContainer);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
    } else {
        alert('Prompt textarea not found.');
    }
}

    // Function to refresh the prompt based on selected files
    function refreshPrompt() {
        const selectedCheckboxes = document.querySelectorAll('#file-list input[type="checkbox"]:checked');
        const promptContainer = document.querySelector('#prompt-textarea');
        if (!promptContainer) return;

        // Remove all existing file content
        const existingContents = promptContainer.querySelectorAll('div[id^="file-content-"]');
        existingContents.forEach(div => div.remove());

        // Re-fetch and append content for all selected files
        selectedCheckboxes.forEach(checkbox => {
            fetchFileContent(checkbox.value);
        });
    }

    // Function to initialize the MutationObserver
    function initializeMutationObserver() {
        const targetNode = document.body;
        const config = { childList: true, subtree: true };

        const callback = function(mutationsList) {
            for (let mutation of mutationsList) {
                if (mutation.type === 'childList') {
                    // Check if the custom UI is removed
                    if (!document.getElementById(CUSTOM_UI_ID)) {
                        // Debounce re-injection to prevent rapid firing
                        clearTimeout(debounceTimer);
                        debounceTimer = setTimeout(() => {
                            injectCustomUI();
                        }, 1000); // Adjust the timeout as needed
                    }
                }
            }
        };

        const observer = new MutationObserver(callback);
        observer.observe(targetNode, config);
    }

    // Function to listen for theme changes (Removed as per instructions)
    // Removed all theme observation and related functions

    // Function to handle theme toggle persistence
    function handleThemePersistence() {
        const savedTheme = localStorage.getItem('customUITheme');
        if (savedTheme) {
            currentTheme = savedTheme;
        }
    }

    // Update theme toggle button to save theme selection
    function updateThemeToggle(container, button) {
        button.addEventListener('click', () => {
            currentTheme = currentTheme === 'light' ? 'dark' : 'light';
            applyThemeStyles(container);
            localStorage.setItem('customUITheme', currentTheme);
        });
    }

    // Initialize custom UI when the page loads
    window.addEventListener('load', () => {
        handleThemePersistence();
        injectCustomUI();
        initializeMutationObserver();
    });

})();
