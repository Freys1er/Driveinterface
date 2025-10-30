/*
 *  Configuration variables
 */
const CLIENT_ID = '490934668566-dpcfvk9p5kfpk44ko8v1gl3d5i9f83qr.apps.googleusercontent.com';
/*
 * ====================================================================================
 * CONFIGURATION & GLOBAL STATE
 * ====================================================================================
 */


/*
 * ====================================================================================
 * CONFIGURATION & GLOBAL STATE
 * ====================================================================================
 */
const SCOPES = 'https://www.googleapis.com/auth/drive';
const TOKEN_STORAGE_KEY = 'drive-notes-app-token';

let tokenClient;
let gapiInited = false, gisInited = false;
// State Management
let currentPath = [];
let selectedFile = { id: 'root', name: 'Root' };
let isFocusMode = false;

/*
 * ====================================================================================
 * DOM ELEMENT REFERENCES
 * ====================================================================================
 */
const loginScreen = document.getElementById('login-screen');
const appContainer = document.getElementById('app-container');
const authButton = document.getElementById('authorize-button');
const signoutButton = document.getElementById('signout-button');
const fileList = document.getElementById('file-list');
const contentDisplay = document.getElementById('file-content-display');
const newFileButton = document.getElementById('new-file-button');
const uploadButton = document.getElementById('upload-button');
const fileUploadInput = document.getElementById('file-upload-input');
const viewerModal = document.getElementById('viewer-modal');
const modalTitle = document.getElementById('modal-title');
const modalOptions = document.getElementById('modal-options');
const modalCloseButton = document.getElementById('modal-close-button');
const focusButton = document.getElementById('focus-button');
const searchInput = document.getElementById('search-input');
const pathBar = document.getElementById('path-bar');
const unfocusButton = document.getElementById('unfocus-button');

const fileNavigator = document.getElementById('file-navigator');
const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
const navCloseButton = document.getElementById('nav-close-button');

/*
 * ====================================================================================
 * EVENT LISTENERS
 * ====================================================================================
 */
authButton.onclick = handleAuthClick;
signoutButton.onclick = handleSignoutClick;
fileList.onclick = handleFileTreeClick;
newFileButton.onclick = createNewFile;
uploadButton.onclick = () => fileUploadInput.click();
fileUploadInput.onchange = uploadFile;
modalCloseButton.onclick = () => viewerModal.classList.add('hidden');
focusButton.onclick = handleFocusClick;
searchInput.oninput = () => filterFileTree(searchInput.value);

unfocusButton.onclick = exitFocusMode;
mobileMenuToggle.onclick = toggleFileNavigator;
navCloseButton.onclick = toggleFileNavigator;


/*
 * ====================================================================================
 * INITIALIZATION & AUTHENTICATION FLOW
 * ====================================================================================
 */
function initializeApp() {
    const storedToken = getStoredToken();
    if (storedToken) { showAppUI(); } else { showLoginUI(); }
    loadGoogleScripts();
}

function loadGoogleScripts() {
    const gapiScript = document.createElement('script');
    gapiScript.src = 'https://apis.google.com/js/api.js';
    gapiScript.onload = gapiLoaded; gapiScript.async = true; document.body.appendChild(gapiScript);
    const gisScript = document.createElement('script');
    gisScript.src = 'https://accounts.google.com/gsi/client';
    gisScript.onload = gisLoaded; gisScript.async = true; document.body.appendChild(gisScript);
}

function gapiLoaded() { gapi.load('client', initializeGapiClient); }

function gisLoaded() {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID, scope: SCOPES, callback: handleTokenResponse,
    });
    gisInited = true; validateToken();
}

async function initializeGapiClient() {
    await gapi.client.init({
        discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
    });
    gapiInited = true; validateToken();
}

async function validateToken() {
    if (!gapiInited || !gisInited) return;
    const storedToken = getStoredToken();
    if (storedToken) {
        gapi.client.setToken(storedToken);
        try {
            await gapi.client.drive.about.get({ fields: 'user' });
            navigateTo('root', 'Root');
        } catch (err) { signOut(); }
    }
}

function handleAuthClick() { if (gisInited) tokenClient.requestAccessToken({ prompt: 'consent' }); }

function handleTokenResponse(tokenResponse) {
    if (tokenResponse.error) return console.error("Auth error:", tokenResponse.error);
    saveToken(gapi.client.getToken());
    showAppUI();
    navigateTo('root', 'Root');
}

function handleSignoutClick() {
    const token = getStoredToken();
    if (token) { google.accounts.oauth2.revoke(token.access_token, signOut); } else { signOut(); }
}

function signOut() {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    gapi.client.setToken('');
    showLoginUI();
    fileList.innerHTML = '';
}

function saveToken(token) { localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(token)); }
function getStoredToken() {
    const tokenString = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!tokenString) return null;
    try { return JSON.parse(tokenString); } catch (e) { return null; }
}
function showAppUI() { loginScreen.classList.add('hidden'); appContainer.classList.remove('hidden'); }
function showLoginUI() { loginScreen.classList.remove('hidden'); appContainer.classList.add('hidden'); }

/*
 * ====================================================================================
 * NAVIGATION & UI RENDERING
 * ====================================================================================
 */
function navigateTo(folderId, folderName) {
    // Reset/update currentPath is now handled by toggleFolder or explicit focus actions
    // For 'root' or initial load, set the currentPath
    if (folderId === 'root' && currentPath.length === 0) {
        currentPath = [{ id: 'root', name: 'Root' }];
    }

    renderFileTree(folderId, fileList);
    renderPathBar();
}

function renderPathBar() {
    pathBar.innerHTML = '';
    currentPath.forEach((segment, index) => {
        const segmentEl = document.createElement('span');
        segmentEl.className = 'path-segment';
        segmentEl.textContent = segment.name;
        segmentEl.onclick = () => {
            if (index < currentPath.length - 1) {
                // Navigate to this segment
                const newPath = currentPath.slice(0, index + 1);
                currentPath = newPath;
                const targetFolder = newPath[newPath.length - 1];
                renderFileTree(targetFolder.id, fileList);
                renderPathBar();
            }
        };
        pathBar.appendChild(segmentEl);
        if (index < currentPath.length - 1) {
            const separator = document.createElement('span');
            separator.className = 'path-separator';
            separator.textContent = '>';
            pathBar.appendChild(separator);
        }
    });
}

function updateSelection(fileRow, file) {
    document.querySelectorAll('.file-row.selected').forEach(el => el.classList.remove('selected'));
    fileRow.classList.add('selected');
    selectedFile = file;
}


/*
 * ====================================================================================
 * CORE FILE TREE & INTERACTIONS
 * ====================================================================================
 */
function handleFileTreeClick(e) {
    const fileRow = e.target.closest('.file-row');
    if (!fileRow) return;
    const listItem = fileRow.parentElement;
    const file = { ...listItem.dataset };
    updateSelection(fileRow, file);

    if (e.target.closest('.rename-button')) {
        e.stopPropagation();
        renameFile(file.id, file.name, listItem);
    }
    // NEW: Handle Delete button click
    else if (e.target.closest('.delete-button')) {
        e.stopPropagation();
        deleteFileOrFolder(file.id, file.name, listItem);
    }
    // END NEW
    else if (file.mimeType === 'application/vnd.google-apps.folder') {
        toggleFolder(listItem, file);
    } else {
        openViewerModal(file);

        // NEW: Close the navigation on mobile after selecting a non-folder file
        if (window.innerWidth <= 768) {
            fileNavigator.classList.remove('visible');
            mobileMenuToggle.querySelector('.material-icons').textContent = 'menu';
        }
    }
}


// script.js (Approx line 249)
async function toggleFolder(listItem, folder) {
    const isLoaded = listItem.dataset.loaded === 'true';
    const isCollapsed = listItem.classList.contains('collapsed');
    const childrenList = listItem.querySelector('ul');
    if (!childrenList) return;

    if (!isLoaded) {
        listItem.dataset.loaded = 'true';
        listItem.classList.remove('collapsed');
        await renderFileTree(folder.id, childrenList);
        updateFolderIcon(listItem, false);
        // Add folder to path only if it's the root list being loaded (not nested)
        // and if it's the item the current path is pointing to.
        // Since we are not re-rendering the whole tree on every toggle,
        // we should NOT update currentPath here, except to reflect the open/close state.
        // The path bar segments will handle navigation.
    } else if (isCollapsed) {
        listItem.classList.remove('collapsed');
        updateFolderIcon(listItem, false);
    } else {
        listItem.classList.add('collapsed');
        updateFolderIcon(listItem, true);
    }
}

async function renderFileTree(parentId, parentElement) {
    parentElement.innerHTML = `<li>Loading...</li>`;
    try {
        const response = await gapi.client.drive.files.list({
            q: `'${parentId}' in parents and trashed = false`,
            fields: 'files(id, name, mimeType, webContentLink, webViewLink)',
            orderBy: 'folder desc, name'
        });
        const files = response.result.files;
        parentElement.innerHTML = '';
        if (!files || files.length === 0) {
            if (parentId !== 'root' && parentId !== selectedFile.id) {
                const emptyItem = document.createElement('li');
                emptyItem.textContent = '(Empty)';
                emptyItem.style.cssText = 'color: #888; font-style: italic; padding: 6px 24px;';
                parentElement.appendChild(emptyItem);
            }
            return;
        }
        files.forEach(file => {
            const listItem = document.createElement('li');
            Object.keys(file).forEach(key => { if (file[key]) listItem.dataset[key] = String(file[key]) });
            const isFolder = file.mimeType === 'application/vnd.google-apps.folder';
            if (isFolder) listItem.classList.add('collapsed');

            const fileRow = document.createElement('div');
            fileRow.className = 'file-row';
            fileRow.innerHTML = `
                <div class="file-label">
                    <span class="icon toggle-arrow material-icons">${isFolder ? 'chevron_right' : ''}</span>
                    <span class="icon file-icon material-icons">${getIconForFile(file)}</span>
                    <span class="file-name">${file.name}</span>
                </div>
                <button class="rename-button" title="Rename"><span class="material-icons">edit</span></button>
                <!-- NEW: Delete Button -->
                <button class="delete-button" title="Delete"><span class="material-icons">delete</span></button>`;
                listItem.appendChild(fileRow);
            if (isFolder) {
                listItem.dataset.loaded = 'false';
                const childrenList = document.createElement('ul');
                listItem.appendChild(childrenList);
            }
            parentElement.appendChild(listItem);
        });
    } catch (err) {
        console.error("Error rendering file tree:", err);
        parentElement.innerHTML = `<li>Error loading.</li>`;
    }
}

/*
 * ====================================================================================
 * FOCUS, SEARCH, RENAME
 * ====================================================================================
 */
// script.js (Approx line 316)
function handleFocusClick() {
    // Only allow focus if a folder is selected
    if (selectedFile && selectedFile.mimeType === 'application/vnd.google-apps.folder') {
        enterFocusMode(selectedFile.id, selectedFile.name);
    }
}

// New functions for explicit Focus/Unfocus
function enterFocusMode(folderId, folderName) {
    // The previous logic was: if focusMode, call exitFocusMode. This is gone.
    isFocusMode = true;

    // Show the Unfocus button
    unfocusButton.classList.remove('hidden');
    focusButton.classList.remove('active'); // Remove active style from focus button
    focusButton.title = "Focus on Selected Folder"; // Reset title

    // Set the path to the newly focused folder (This is the key part for nested focus)
    // When focusing, we always set the path to the selected folder as the new root of the view.
    currentPath = [{ id: folderId, name: folderName }];

    renderFileTree(folderId, fileList);
    renderPathBar();
}

function exitFocusMode() {
    isFocusMode = false;

    // Hide the Unfocus button
    unfocusButton.classList.add('hidden');

    focusButton.classList.remove('active');
    focusButton.title = "Focus on Selected Folder";

    // Navigate back to the main root view
    currentPath = [{ id: 'root', name: 'Root' }];
    renderFileTree('root', fileList);
    renderPathBar();
}

function toggleFileNavigator() {
    fileNavigator.classList.toggle('visible');
    const isVisible = fileNavigator.classList.contains('visible');
    // Change the icon from 'menu' to 'close' when open
    mobileMenuToggle.querySelector('.material-icons').textContent = isVisible ? 'close' : 'menu';
}
function filterFileTree(searchText) {
    const lowerCaseText = searchText.toLowerCase();
    const allItems = fileList.querySelectorAll('li');
    allItems.forEach(item => {
        const fileName = (item.dataset.name || '').toLowerCase();
        const isMatch = fileName.includes(lowerCaseText);
        if (isMatch) {
            item.classList.remove('hidden-by-search');
            // Make sure parents are visible
            let parent = item.parentElement.closest('li');
            while (parent) {
                parent.classList.remove('hidden-by-search');
                parent.classList.remove('collapsed');
                updateFolderIcon(parent, false);
                parent = parent.parentElement.closest('li');
            }
        } else {
            item.classList.add('hidden-by-search');
        }
    });
}

async function renameFile(fileId, currentName, listItem) {
    const newName = prompt("Enter new name:", currentName);
    if (newName && newName !== currentName) {
        try {
            await gapi.client.drive.files.update({ fileId: fileId, resource: { name: newName } });
            listItem.querySelector('.file-name').textContent = newName;
            listItem.dataset.name = newName;
        } catch (err) { alert("Could not rename file."); }
    }
}

// NEW: Delete Function
async function deleteFileOrFolder(fileId, fileName, listItem) {
    if (!confirm(`Are you sure you want to delete "${fileName}"? This action cannot be undone and moves the item to the Trash.`)) {
        return;
    }
    try {
        await gapi.client.drive.files.update({
            fileId: fileId,
            // Setting 'trashed' to true moves the file/folder to the trash, which is the standard "delete" action in Drive.
            resource: { trashed: true }
        });
        listItem.remove();
        // Clear content display if the deleted file was selected
        if (selectedFile.id === fileId) {
            document.getElementById('file-content-display').innerHTML = `<h1>File Deleted</h1><p>"${fileName}" was moved to trash.</p>`;
            // Reset selection to prevent errors if further actions are attempted
            selectedFile = { id: 'root', name: 'Root' };
        }
    } catch (err) {
        alert("Could not delete file/folder. Check console for details.");
        console.error("Delete error:", err);
    }
}
// END NEW

function getIconForFile(file) {
    if (file.mimeType === 'application/vnd.google-apps.folder') return 'folder';
    if (file.mimeType.startsWith('image/')) return 'image';
    if (file.mimeType.startsWith('video/')) return 'movie';
    if (file.mimeType.startsWith('audio/')) return 'audio_file';
    if (file.mimeType === 'application/pdf') return 'picture_as_pdf';
    if (file.name.toLowerCase().endsWith('.md')) return 'article';
    if (file.mimeType.includes('google-apps.document')) return 'description';
    if (file.mimeType.includes('google-apps.spreadsheet')) return 'analytics';
    if (file.mimeType.includes('google-apps.presentation')) return 'slideshow';
    return 'insert_drive_file';
}

function updateFolderIcon(listItem, isCollapsed) {
    const iconElement = listItem.querySelector('.toggle-arrow');
    if (iconElement) iconElement.textContent = isCollapsed ? 'chevron_right' : 'expand_more';
}

/*
 * ====================================================================================
 * UPLOAD / CREATE / VIEWERS
 * ====================================================================================
 */
async function createNewFile() {
    const fileName = prompt("Enter filename (e.g., 'My Note.md'):", "Untitled.md");
    if (!fileName) return;
    try {
        await gapi.client.drive.files.create({
            resource: { name: fileName, mimeType: 'text/markdown', parents: [selectedFile.id || 'root'] },
            fields: 'id'
        });
        // This is a complex refresh, a full re-render is simplest
        isFocusMode ? renderFileTree(selectedFile.id, fileList) : renderFileTree('root', fileList);
    } catch (err) { alert("Could not create file."); }
}

async function uploadFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    contentDisplay.innerHTML = `<h1>Uploading ${file.name}...</h1>`;
    const metadata = { name: file.name, parents: [selectedFile.id || 'root'] };
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', file);
    try {
        await fetch(`https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`, {
            method: 'POST',
            headers: new Headers({ 'Authorization': `Bearer ${gapi.client.getToken().access_token}` }),
            body: form,
        });
        contentDisplay.innerHTML = `<h1>Upload complete!</h1>`;
        isFocusMode ? renderFileTree(selectedFile.id, fileList) : renderFileTree('root', fileList);
    } catch (err) { alert("Could not upload file."); } finally { fileUploadInput.value = ''; }
}

function openViewerModal(file) {
    modalTitle.textContent = `Open "${file.name}" with:`;
    modalOptions.innerHTML = '';
    addViewerOption('Default Viewer', () => viewAsPdf(file));
    addViewerOption('Image Viewer', () => viewAsImage(file));
    addViewerOption('Markdown Viewer', () => viewAsMarkdown(file));
    addViewerOption('Plain Text Viewer', () => viewAsPlainText(file));
    addViewerOption('Video Viewer', () => viewAsVideo(file));
    addViewerOption('Flashcard Viewer (Custom)', () => viewAsFlashcards(file));
    viewerModal.classList.remove('hidden');
}

function addViewerOption(name, action) {
    const button = document.createElement('button');
    button.textContent = name;
    button.onclick = () => { action(); viewerModal.classList.add('hidden'); };
    modalOptions.appendChild(button);
}

async function fetchFileContent(file) {
    if (file.mimeType === 'application/vnd.google-apps.document') {
        const res = await gapi.client.drive.files.export({ fileId: file.id, mimeType: 'text/plain' });
        return res.body;
    }
    const res = await gapi.client.drive.files.get({ fileId: file.id, alt: 'media' });
    return res.body;
}

function viewAsImage(file) {
    if (!file.webContentLink) {
        return contentDisplay.innerHTML = `<h2>Preview not available</h2><p>This file does not have a direct image link.</p>`;
    }

    const token = gapi.client.getToken()?.access_token;
    if (!token) return contentDisplay.innerHTML = `<h2>Error: Access token missing.</h2>`;

    // Use the webContentLink and ensure the access_token is appended.
    // The link must ensure it's a download or media content.
    let url = file.webContentLink;
    // 1. Ensure it's not missing '&export=download' 
    if (!url.includes('export=download')) url += '&export=download';
    // 2. Append the authenticated token
    const authenticatedUrl = `${url}&access_token=${token}`;

    contentDisplay.innerHTML = `<h2>${file.name}</h2><img src="${authenticatedUrl}" alt="${file.name}">`;
}

function viewAsVideo(file) {
    if (!file.webContentLink) {
        return contentDisplay.innerHTML = `<h2>Preview not available</h2><p>This file does not have a direct video link.</p>`;
    }

    const token = gapi.client.getToken()?.access_token;
    if (!token) return contentDisplay.innerHTML = `<h2>Error: Access token missing.</h2>`;

    // Use the webContentLink for video streaming
    let url = file.webContentLink;
    // 1. Ensure it's NOT a download link for streaming (often better without the export=download)
    url = url.replace('&export=download', '');
    // 2. Append the authenticated token
    const authenticatedUrl = `${url}&access_token=${token}`;

    contentDisplay.innerHTML = `<h2>${file.name}</h2><video controls width="100%"><source src="${authenticatedUrl}" type="${file.mimeType}"></video>`;
}

function viewAsPdf(file) {
    if (!file.webViewLink) return contentDisplay.innerHTML = `<h2>Preview not available</h2><p>This file cannot be viewed in the browser.</p>`;
    contentDisplay.innerHTML = `<h2>${file.name}</h2><iframe src="${file.webViewLink.replace('/view', '/preview')}" style="width:100%; height:85vh; border:none;"></iframe>`;
}

async function viewAsMarkdown(file) {
    contentDisplay.innerHTML = `<h1>Loading ${file.name}...</h1>`;
    try {
        const content = await fetchFileContent(file);
        contentDisplay.innerHTML = marked.parse(content);
    } catch (err) { contentDisplay.innerHTML = `<h1>Error: Could not load text content.</h1>`; }
}

async function viewAsPlainText(file) {
    contentDisplay.innerHTML = `<h1>Loading ${file.name}...</h1>`;
    try {
        const content = await fetchFileContent(file);
        const pre = document.createElement('pre');
        pre.textContent = content;
        contentDisplay.innerHTML = '';
        contentDisplay.appendChild(pre);
    } catch (err) { contentDisplay.innerHTML = `<h1>Error: Could not load text content.</h1>`; }
}
async function deleteFileOrFolder(fileId, fileName, listItem) {
    if (!confirm(`Are you sure you want to delete "${fileName}"? This action cannot be undone and moves the item to the Trash.`)) {
        return;
    }
    try {
        await gapi.client.drive.files.update({
            fileId: fileId,
            resource: { trashed: true }
        });
        listItem.remove();
        // Clear content display if the deleted file was selected
        if (selectedFile.id === fileId) {
            document.getElementById('file-content-display').innerHTML = `<h1>File Deleted</h1><p>"${fileName}" was moved to trash.</p>`;
            selectedFile = { id: 'root', name: 'Root' };
        }
    } catch (err) {
        alert("Could not delete file/folder. Check console for details.");
        console.error("Delete error:", err);
    }
}
/*
 * ====================================================================================
 * START THE APPLICATION
 * ====================================================================================
 */
initializeApp();