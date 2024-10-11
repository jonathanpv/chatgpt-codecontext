// ==UserScript==
// @name         ChatGPT CodeContext Client
// @namespace    http://tampermonkey.net/
// @version      2.2
// @description  Access local code files from ChatGPT, save project directories for quick access. Access vscode open editors with CodeContext extension.
// @match        https://chatgpt.com/*
// @grant        GM_xmlhttpRequest
// @connect      localhost
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    const SERVER_URL = 'http://localhost:5001';
    const IDS = {
        UI_WRAPPER: 'custom-ui-wrapper',
        UI: 'custom-chatgpt-ui',
        DROPDOWN: 'directory-dropdown',
        SEARCH: 'custom-search-bar',
        AUTOCOMPLETE: 'custom-autocomplete-list',
        STATUS: 'custom-ui-status-message',
        BADGES: 'selected-files-badges',
        FILE_LIST: 'file-list-container',
        RECENT_PROJECTS: 'recent-projects-container',
        ADD_PROJECT_BUTTON: 'add-project-button',
        CLEAR_RECENT_BUTTON: 'clear-recent-projects-button',
        SIDEBAR: 'sidebar',
        SIDEBAR_PROJECTS_LIST: 'sidebar-projects-list',
    };

    let searchDebounceTimer;
    let selectedFiles = new Set();
    let isUIVisible = false; // Track UI visibility

    const CUSTOM_UI_WRAPPER_TEMPLATE = `
        <div id="${IDS.UI_WRAPPER}" class="max-w-4xl w-full" style="position: fixed; top: 50px; left: 50%; transform: translateX(-50%); display: none; z-index: 1000;">
            <!-- Sidebar and File Explorer will be inserted here -->
        </div>
    `;

    // Template for the Sidebar (Projects)
    const SIDEBAR_TEMPLATE = `
        <div id="${IDS.SIDEBAR}" class="w-64 bg-token-sidebar-surface-primary border border-gray-300 dark:border-gray-700 p-4 shadow-lg font-sans transition-colors duration-300 flex flex-col">
            <h3 class="text-lg font-semibold text-text-token-primary mb-4">Projects</h3>
            <div id="${IDS.SIDEBAR_PROJECTS_LIST}" class="flex-1 overflow-y-auto">
                <!-- Project items will be inserted here -->
            </div>
            <button id="${IDS.ADD_PROJECT_BUTTON}" class="mt-4 btn btn-secondary py-1 px-2 rounded">Add Current Directory</button>
            <button id="${IDS.CLEAR_RECENT_BUTTON}" class="mt-2 w-full btn btn-primary py-1 px-2 rounded">Clear Projects</button>
        </div>
    `;

    const CUSTOM_UI_TEMPLATE = `
        <div id="${IDS.UI}" class="bg-token-sidebar-surface-primary border border-gray-300 dark:border-gray-700 rounded-lg p-4 shadow-lg font-sans transition-colors duration-300 flex-1">
            <div class="flex justify-between items-center mb-3 cursor-move">
                <h3 class="text-lg font-semibold text-text-token-primary">File Explorer</h3>
                <button id="close-button" class="text-2xl text-text-token-primary">&times;</button>
            </div>
            <div id="${IDS.STATUS}" class="mb-2 text-sm text-text-token-primary"></div>
            <div id="current-directory" class="mb-2 text-sm break-words text-text-token-primary"></div>
            <select id="${IDS.DROPDOWN}" class="w-full p-2 mb-2 bg-token-sidebar-surface-primary text-text-token-primary rounded">
                <option value="">Select Directory...</option>
            </select>
            <div class="relative mb-2">
                <input type="text" id="${IDS.SEARCH}" class="bg-token-sidebar-surface-primary text-text-token-primary w-full p-2 border border-gray-300 dark:border-gray-600 rounded" placeholder="Search files..." autocomplete="off"/>
                <div id="${IDS.AUTOCOMPLETE}" class="bg-token-sidebar-surface-primary text-text-token-primary absolute top-full left-0 right-0 border border-gray-300 dark:border-gray-600 max-h-40 overflow-y-auto hidden"></div>
            </div>
            <div id="${IDS.FILE_LIST}" class="mb-4 h-full max-h-96 overflow-scroll">
                <h4 class="text-lg font-semibold text-text-token-primary mb-2">All Files</h4>
                <div id="all-files" class="flex flex-col gap-2 max-h-60 overflow-y-auto"></div>
            </div>
            <div id="${IDS.BADGES}" class="flex flex-wrap gap-1"></div>
        </div>
    `;

    function injectCustomUI() {
        if (document.getElementById(IDS.UI_WRAPPER)) return;
        document.body.insertAdjacentHTML('beforeend', CUSTOM_UI_WRAPPER_TEMPLATE);
        const wrapper = document.getElementById(IDS.UI_WRAPPER);
        wrapper.insertAdjacentHTML('beforeend', SIDEBAR_TEMPLATE);
        wrapper.insertAdjacentHTML('beforeend', CUSTOM_UI_TEMPLATE);
        addEventListeners();
        checkServerConnection();
        initializeNavigation();
        fetchAllFiles();
        loadProjects();
    }

    function addEventListeners() {
        document.getElementById('close-button').onclick = () => toggleUIVisibility(false);
        document.getElementById(IDS.DROPDOWN).onchange = handleDirectoryChange;
        const searchInput = document.getElementById(IDS.SEARCH);
        searchInput.oninput = debounce(handleSearch, 300);
        searchInput.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); handleSearch(); } };
        document.addEventListener('click', e => {
            const autocomplete = document.getElementById(IDS.AUTOCOMPLETE);
            const searchBar = document.getElementById(IDS.SEARCH);
            if (!autocomplete.contains(e.target) && e.target !== searchBar) {
                hideAutocomplete();
            }
        });
        document.getElementById(IDS.ADD_PROJECT_BUTTON).onclick = addCurrentDirectoryAsProject;
        document.getElementById(IDS.CLEAR_RECENT_BUTTON).onclick = clearProjects;

        // Add right-click context menu for projects in the sidebar
        document.getElementById(IDS.SIDEBAR_PROJECTS_LIST).addEventListener('contextmenu', e => {
            e.preventDefault();
            if (e.target.classList.contains('project-item')) {
                const projectIndex = e.target.getAttribute('data-index');
                if (confirm('Do you want to remove this project from the list?')) {
                    removeProject(projectIndex);
                }
            }
        });

        // Add keydown event listener for CMD + J
        document.addEventListener('keydown', handleToggleShortcut);
    }

    function handleToggleShortcut(e) {
        if (e.key === 'j' && e.metaKey && !e.shiftKey && !e.altKey && !e.ctrlKey) {
            e.preventDefault();
            toggleUIVisibility();
        }
    }

    function toggleUIVisibility(forceState) {
        const wrapper = document.getElementById(IDS.UI_WRAPPER);
        if (!wrapper) return;

        if (typeof forceState === 'boolean') {
            isUIVisible = forceState;
        } else {
            isUIVisible = !isUIVisible;
        }

        wrapper.style.display = isUIVisible ? 'flex' : 'none';
    }

    function debounce(func, delay) {
        return function() {
            clearTimeout(searchDebounceTimer);
            searchDebounceTimer = setTimeout(() => func.apply(this, arguments), delay);
        };
    }

    function handleSearch() {
        const query = document.getElementById(IDS.SEARCH).value.trim().toLowerCase();
        if (query) fetchSearchResults(query);
        else hideAutocomplete();
    }

    function makeRequest(options) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: options.method || 'GET',
                url: `${SERVER_URL}${options.endpoint}`,
                data: options.data ? JSON.stringify(options.data) : undefined,
                headers: options.headers || {},
                onload: response => {
                    if (response.status === 200) resolve(JSON.parse(response.responseText));
                    else {
                        try {
                            const error = JSON.parse(response.responseText).error || response.statusText;
                            reject(error);
                        } catch {
                            reject(response.statusText);
                        }
                    }
                },
                onerror: () => reject(`Network error during ${options.method} request to ${options.endpoint}`)
            });
        });
    }

    function initializeNavigation() {
        makeRequest({ endpoint: '/get_current_directory' })
            .then(data => {
                updateCurrentDirectory(data.current_directory);
                updateDirectoryDropdown(data.current_directory);
            })
            .catch(error => {
                console.error('Error initializing navigation:', error);
                updateStatusMessage('Error initializing navigation. Please try again.', 'error');
            });
    }

    function handleDirectoryChange() {
        const selectedDir = document.getElementById(IDS.DROPDOWN).value;
        const currentDir = getCurrentDirectory();
        const newPath = selectedDir === '..' ?
            currentDir.split('/').slice(0, -1).join('/') || '/' :
            `${currentDir}/${selectedDir}`;
        setBaseDirectory(newPath);
    }

    function setBaseDirectory(path) {
        updateStatusMessage('Setting base directory...', 'info');
        makeRequest({
            method: 'POST',
            endpoint: '/set_base_directory',
            data: { new_directory: path },
            headers: { "Content-Type": "application/json" }
        })
        .then(data => {
            updateCurrentDirectory(data.current_directory);
            updateDirectoryDropdown(data.current_directory);
            updateStatusMessage('Base directory set successfully.', 'success');
            fetchAllFiles();
            loadProjects();
        })
        .catch(error => {
            console.error('Error setting base directory:', error);
            updateStatusMessage(`Error: ${error}`, 'error');
        });
    }

    function getCurrentDirectory() {
        return document.getElementById('current-directory').textContent.replace('Current Directory: ', '');
    }

    function updateCurrentDirectory(path) {
        document.getElementById('current-directory').textContent = `Current Directory: ${path}`;
    }

    function updateDirectoryDropdown(path) {
        const dropdown = document.getElementById(IDS.DROPDOWN);
        dropdown.innerHTML = '<option value="">Select Directory...</option>';
        makeRequest({ endpoint: `/get_dropdown_suggestions?current_path=${encodeURIComponent(path)}` })
            .then(data => {
                data.suggestions.forEach(dir => {
                    dropdown.insertAdjacentHTML('beforeend', `<option value="${dir}">${dir}</option>`);
                });
            })
            .catch(error => {
                console.error('Error fetching directory suggestions:', error);
                updateStatusMessage(`Error fetching directories: ${error}`, 'error');
            });
    }

    function fetchSearchResults(query) {
        makeRequest({ endpoint: `/search_files?query=${encodeURIComponent(query)}` })
            .then(data => {
                displayAutocomplete(data.results);
                updateStatusMessage(`Found ${data.results.length} files.`, 'success');
            })
            .catch(error => {
                updateStatusMessage(`Error: ${error}`, 'error');
                console.error(`Error fetching search results: ${error}`);
            });
    }

    function displayAutocomplete(files) {
        const autocompleteList = document.getElementById(IDS.AUTOCOMPLETE);
        autocompleteList.innerHTML = '';
        if (files.length === 0) {
            hideAutocomplete();
            return;
        }
        files.forEach(file => {
            const item = document.createElement('div');
            item.className = 'p-2 cursor-pointer hover:bg-token-sidebar-surface-secondary';
            item.textContent = file;
            item.onclick = () => {
                addBadge(file);
                document.getElementById(IDS.SEARCH).value = '';
                hideAutocomplete();
            };
            autocompleteList.appendChild(item);
        });
        autocompleteList.style.display = 'block';
    }

    function hideAutocomplete() {
        const autocompleteList = document.getElementById(IDS.AUTOCOMPLETE);
        autocompleteList.innerHTML = '';
        autocompleteList.style.display = 'none';
    }

    function addBadge(file) {
        if (selectedFiles.has(file)) return;
        selectedFiles.add(file);
        const badgesContainer = document.getElementById(IDS.BADGES);
        const badge = document.createElement('div');
        badge.className = 'bg-token-sidebar-surface-secondary text-text-token-primary px-2 py-1 rounded-full text-sm flex items-center space-x-1';
        badge.innerHTML = `
            <span>${file}</span>
            <span class="font-bold cursor-pointer hover:text-red-500">&times;</span>
        `;
        badge.querySelector('span:last-child').onclick = () => {
            badgesContainer.removeChild(badge);
            selectedFiles.delete(file);
            removeFileFromPrompt(file);
        };
        badgesContainer.appendChild(badge);
        fetchFileContent(file);
    }

    function fetchFileContent(file) {
        const path = file.includes('/') ? file.substring(0, file.lastIndexOf('/')) : '.';
        const filename = file.substring(file.lastIndexOf('/') + 1);

        makeRequest({ endpoint: `/get_file_content?filename=${encodeURIComponent(filename)}&path=${encodeURIComponent(path)}` })
            .then(data => {
                appendToPrompt(data.content, file);
                updateStatusMessage(`Added ${file} to prompt.`, 'success');
            })
            .catch(error => {
                updateStatusMessage(`Error: ${error}`, 'error');
                console.error(`Error fetching file content: ${error}`);
            });
    }

function appendToPrompt(content, file) {
    const promptContainer = getPromptTextarea();
    if (promptContainer) {
        const escapedContent = escapeHTML(content)
            .split('\n')
            .map(line => line.trim() === '' ? '<p></p>' : line)
            .join('<br>');
        const contentToAdd = `
            <p class="mt-2"><strong>=== ${file} ===</strong></p>
            <p></p>
            <pre class="bg-token-sidebar-surface-primary text-text-token-primary p-2 rounded mb-2 whitespace-pre-wrap">${escapedContent}</pre>
        `;
        promptContainer.innerHTML += contentToAdd;
        promptContainer.dispatchEvent(new Event('input', { bubbles: true }));
        scrollToEnd(promptContainer);
    } else {
        updateStatusMessage('Prompt textarea not found.', 'error');
    }
}

    function getPromptTextarea() {
        return document.querySelector('div[contenteditable="true"]');
    }

function removeFileFromPrompt(fileToRemove) {
    const promptContainer = getPromptTextarea();
    if (!promptContainer) return;

    // Escape special characters in the file name for use in regex
    const escapedFile = fileToRemove.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Split the content into separate files
    const filePattern = /===\s*(.*?)\s*===[\s\S]*?(?====|$)/g;
    const files = promptContainer.innerHTML.match(filePattern) || [];

    // Filter out the file to remove
    const updatedContent = files.filter(file => {
        const fileNameMatch = file.match(/===\s*(.*?)\s*===/);
        return fileNameMatch && fileNameMatch[1].trim() !== fileToRemove;
    }).join('\n\n');

    // Update the prompt container
    promptContainer.innerHTML = updatedContent;

    // Dispatch an input event to trigger any necessary updates
    promptContainer.dispatchEvent(new Event('input', { bubbles: true }));
}
    function escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function escapeHTML(str) {
        return str.replace(/&/g, "&amp;")
                  .replace(/</g, "&lt;")
                  .replace(/>/g, "&gt;")
                  .replace(/"/g, "&quot;")
                  .replace(/'/g, "&#039;");
    }

    function updateStatusMessage(message, type) {
        const statusMessage = document.getElementById(IDS.STATUS);
        if (!statusMessage) return;
        statusMessage.textContent = message;
        statusMessage.className = `mb-2 text-sm ${type === 'success' ? 'text-green-500' : type === 'error' ? 'text-red-500' : 'text-blue-500'} text-text-token-primary`;
    }

    function checkServerConnection() {
        makeRequest({ endpoint: '/get_all_files_recursive' })
            .then(() => updateStatusMessage('Connected to server.', 'success'))
            .catch(error => {
                updateStatusMessage('Failed to connect to server.', 'error');
                console.error(`Failed to connect to server: ${error}`);
            });
    }

    function fetchAllFiles() {
        makeRequest({ endpoint: '/get_all_files_recursive' })
            .then(data => {
                displayAllFiles(data.all_files);
                updateStatusMessage(`Loaded ${data.all_files.length} files.`, 'success');
            })
            .catch(error => {
                updateStatusMessage(`Error loading files: ${error}`, 'error');
                console.error(`Error loading all files: ${error}`);
            });
    }

    function displayAllFiles(files) {
        const allFilesContainer = document.getElementById('all-files');
        allFilesContainer.innerHTML = '';
        if (files.length === 0) {
            allFilesContainer.innerHTML = '<p class="text-text-token-primary">No files found.</p>';
            return;
        }
        files.forEach(file => {
            const fileItem = document.createElement('div');
            fileItem.className = 'btn-secondary p-2 rounded shadow cursor-pointer overflow-hidden';
            fileItem.textContent = file;
            fileItem.onclick = () => addBadge(file);
            allFilesContainer.appendChild(fileItem);
        });
    }

    function scrollToEnd(element) {
        element.scrollTop = element.scrollHeight;
    }

    // Projects Functionality

    function loadProjects() {
        const projects = getProjects();
        const projectsList = document.getElementById(IDS.SIDEBAR_PROJECTS_LIST);
        projectsList.innerHTML = '';

        if (projects.length === 0) {
            projectsList.innerHTML = '<p class="text-text-token-primary">No projects.</p>';
            return;
        }

        projects.forEach((project, index) => {
            const projectItem = document.createElement('div');
            projectItem.className = 'btn-secondary mb-2 project-item cursor-pointer p-2 rounded ';
            projectItem.setAttribute('data-index', index);
            projectItem.textContent = project.label;

            projectItem.onclick = () => {
                setBaseDirectory(project.path);
            };

            projectsList.appendChild(projectItem);
        });
    }

    function getProjects() {
        const projects = localStorage.getItem('projects');
        return projects ? JSON.parse(projects) : [];
    }

    function saveProjects(projects) {
        localStorage.setItem('projects', JSON.stringify(projects));
    }

    function addCurrentDirectoryAsProject() {
        const currentDir = getCurrentDirectory();
        const label = currentDir.split('/').pop(); // Use the last part of the path as the label

        const projects = getProjects();

        // Check for duplicates
        if (projects.some(proj => proj.path === currentDir)) {
            alert('This directory is already in your projects.');
            return;
        }

        projects.push({ label, path: currentDir });
        saveProjects(projects);
        loadProjects();
        updateStatusMessage('Project added.', 'success');
    }

    function removeProject(index) {
        const projects = getProjects();
        if (index < 0 || index >= projects.length) {
            alert('Invalid project selection.');
            return;
        }
        projects.splice(index, 1);
        saveProjects(projects);
        loadProjects();
        updateStatusMessage('Project removed.', 'success');
    }

    function clearProjects() {
        if (confirm('Are you sure you want to clear all projects?')) {
            saveProjects([]);
            loadProjects();
            updateStatusMessage('All projects have been cleared.', 'success');
        }
    }

    // Initialize the custom UI on window load
    window.addEventListener('load', injectCustomUI);
})();
