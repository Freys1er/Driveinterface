/*
 *  Configuration variables
 */
const CLIENT_ID = '490934668566-dpcfvk9p5kfpk44ko8v1gl3d5i9f83qr.apps.googleusercontent.com';
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
let currentMarkdownFile = null;
let currentRawMarkdown = '';
let isMarkdownEditMode = false;


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
const newFolderButton = document.getElementById('new-folder-button');
const uploadButton = document.getElementById('upload-button');
const focusButton = document.getElementById('focus-button');
const searchInput = document.getElementById('search-input');
const pathBar = document.getElementById('path-bar');
const unfocusButton = document.getElementById('unfocus-button');
const contentArea = document.getElementById('content-area');
// New buttons
const fullscreenButton = document.getElementById('fullscreen-button');
const toggleBotButton = document.getElementById('toggle-bot-button');
const mdToggleButton = document.getElementById('md-toggle-button');
const mdSaveButton = document.getElementById('md-save-button');

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
newFolderButton.onclick = createNewFolder;
uploadButton.onclick = () => fileUploadInput.click();
fileUploadInput.onchange = uploadFile;
focusButton.onclick = handleFocusClick;
searchInput.oninput = () => filterFileTree(searchInput.value);
unfocusButton.onclick = exitFocusMode;
mobileMenuToggle.onclick = toggleFileNavigator;
navCloseButton.onclick = toggleFileNavigator;
// New listeners
fullscreenButton.onclick = toggleFullScreen;
toggleBotButton.onclick = toggleBot;
mdToggleButton.onclick = toggleMarkdownMode;
mdSaveButton.onclick = saveMarkdownFile;


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

    const target = e.target.closest('button');
    if (target) {
        e.stopPropagation();
        if (target.classList.contains('rename-button')) {
            renameFile(file.id, file.name, listItem);
        } else if (target.classList.contains('delete-button')) {
            deleteFileOrFolder(file.id, file.name, listItem);
        } else if (target.classList.contains('download-button')) {
            downloadFile(file);
        }
    } else if (file.mimeType === 'application/vnd.google-apps.folder') {
        toggleFolder(listItem, file);
    } else {
        openFile(file);
        if (window.innerWidth <= 768) {
            fileNavigator.classList.remove('visible');
            mobileMenuToggle.querySelector('.material-icons').textContent = 'menu';
        }
    }
}

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
                <div class="file-actions">
                    <button class="download-button" title="Download"><span class="material-icons">download</span></button>
                    <button class="rename-button" title="Rename"><span class="material-icons">edit</span></button>
                    <button class="delete-button" title="Delete"><span class="material-icons">delete</span></button>
                </div>`;
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
 * UI TOGGLES & MODES
 * ====================================================================================
 */
function handleFocusClick() {
    if (selectedFile && selectedFile.mimeType === 'application/vnd.google-apps.folder') {
        enterFocusMode(selectedFile.id, selectedFile.name);
    }
}

function enterFocusMode(folderId, folderName) {
    isFocusMode = true;
    unfocusButton.classList.remove('hidden');
    focusButton.classList.remove('active');
    focusButton.title = "Focus on Selected Folder";
    currentPath = [{ id: folderId, name: folderName }];
    renderFileTree(folderId, fileList);
    renderPathBar();
}

function exitFocusMode() {
    isFocusMode = false;
    unfocusButton.classList.add('hidden');
    focusButton.classList.remove('active');
    focusButton.title = "Focus on Selected Folder";
    currentPath = [{ id: 'root', name: 'Root' }];
    renderFileTree('root', fileList);
    renderPathBar();
}

function toggleFileNavigator() {
    fileNavigator.classList.toggle('visible');
    const isVisible = fileNavigator.classList.contains('visible');
    mobileMenuToggle.querySelector('.material-icons').textContent = isVisible ? 'close' : 'menu';
}

function toggleFullScreen() {
    contentArea.classList.toggle('fullscreen');
    const isFullscreen = contentArea.classList.contains('fullscreen');
    fullscreenButton.querySelector('.material-icons').textContent = isFullscreen ? 'fullscreen_exit' : 'fullscreen';
}

function toggleBot() {
    appContainer.classList.toggle('bot-collapsed');
    const isCollapsed = appContainer.classList.contains('bot-collapsed');
    toggleBotButton.querySelector('.material-icons').textContent = isCollapsed ? 'chat_bubble_outline' : 'chat';
}


function filterFileTree(searchText) {
    const lowerCaseText = searchText.toLowerCase();
    const allItems = fileList.querySelectorAll('li');
    allItems.forEach(item => {
        const fileName = (item.dataset.name || '').toLowerCase();
        const isMatch = fileName.includes(lowerCaseText);
        if (isMatch) {
            item.classList.remove('hidden-by-search');
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

async function deleteFileOrFolder(fileId, fileName, listItem) {
    if (!confirm(`Are you sure you want to delete "${fileName}"? This moves the item to Trash.`)) return;
    try {
        await gapi.client.drive.files.update({ fileId: fileId, resource: { trashed: true } });
        listItem.remove();
        if (selectedFile.id === fileId) {
            contentDisplay.innerHTML = `<h1>File Deleted</h1><p>"${fileName}" was moved to trash.</p>`;
            selectedFile = { id: 'root', name: 'Root' };
        }
    } catch (err) {
        alert("Could not delete file/folder.");
        console.error("Delete error:", err);
    }
}

function getIconForFile(file) {
    if (file.mimeType === 'application/vnd.google-apps.folder') return 'folder';
    if (file.mimeType.startsWith('image/')) return 'image';
    if (file.mimeType.startsWith('video/')) return 'movie';
    if (file.mimeType.startsWith('audio/')) return 'audio_file';
    if (file.mimeType === 'application/pdf') return 'picture_as_pdf';
    if (file.name && file.name.toLowerCase().endsWith('.md')) return 'article';
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
 * FILE ACTIONS (CREATE, UPLOAD, DOWNLOAD)
 * ====================================================================================
 */
async function createNewFile(fileName, content = '', parentId = selectedFile.id || 'root') {
    const finalFileName = typeof fileName === 'string' ? fileName : prompt("Enter filename (e.g., 'My Note.md'):", "Untitled.md");
    if (!finalFileName) return;
    try {
        const fileMetadata = { name: finalFileName, parents: [parentId] };
        const mimeType = finalFileName.toLowerCase().endsWith('.md') ? 'text/markdown' : 'text/plain';
        fileMetadata.mimeType = mimeType;

        const file = new Blob([content], { type: mimeType });

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(fileMetadata)], { type: 'application/json' }));
        form.append('file', file);

        await fetch(`https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`, {
            method: 'POST',
            headers: new Headers({ 'Authorization': `Bearer ${gapi.client.getToken().access_token}` }),
            body: form,
        });

        refreshFileTree();
    } catch (err) {
        alert("Could not create file.");
        console.error("Create file error:", err);
    }
}


async function createNewFolder() {
    const folderName = prompt("Enter folder name:", "New Folder");
    if (!folderName) return;
    try {
        await gapi.client.drive.files.create({
            resource: {
                name: folderName,
                mimeType: 'application/vnd.google-apps.folder',
                parents: [selectedFile.id || 'root']
            },
            fields: 'id'
        });
        refreshFileTree();
    } catch (err) { alert("Could not create folder."); }
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
        refreshFileTree();
    } catch (err) { alert("Could not upload file."); } finally { fileUploadInput.value = ''; }
}

function downloadFile(file) {
    const token = gapi.client.getToken()?.access_token;
    if (!token) {
        alert("Authentication token not found. Please sign in again.");
        return;
    }
    if (!file.webContentLink) {
        alert("This file is not directly downloadable (e.g., Google Docs).");
        return;
    }
    const downloadUrl = `${file.webContentLink}&access_token=${token}`;
    window.open(downloadUrl, '_blank');
}

function refreshFileTree() {
    const parentToRefresh = isFocusMode ? selectedFile.id : 'root';
    renderFileTree(parentToRefresh, fileList);
}


/*
 * ====================================================================================
 * VIEWERS & MARKDOWN EDITOR
 * ====================================================================================
 */
function openFile(file) {
    // Reset markdown editor state
    mdToggleButton.classList.add('hidden');
    mdSaveButton.classList.add('hidden');
    isMarkdownEditMode = false;
    currentMarkdownFile = null;
    currentRawMarkdown = '';

    const fileName = file.name || '';
    if (fileName.toLowerCase().endsWith('.md')) {
        viewAsMarkdown(file);
    } else if (file.mimeType && file.mimeType.startsWith('image/')) {
        viewAsDefault(file, 'image');
    } else if (file.mimeType && file.mimeType.startsWith('video/')) {
        viewAsDefault(file, 'video');
    } else if (file.mimeType === 'application/pdf') {
        viewAsDefault(file, 'pdf');
    } else if (fileName.toLowerCase().includes('flashcards')) {
        viewAsFlashcards(file);
    } else {
        viewAsPlainText(file);
    }
}

async function fetchFileContent(file) {
    if (file.mimeType && file.mimeType.includes('google-apps')) {
        const exportType = file.mimeType.includes('document') ? 'text/plain' : 'text/csv';
        const res = await gapi.client.drive.files.export({ fileId: file.id, mimeType: exportType });
        return res.body;
    }
    const res = await gapi.client.drive.files.get({ fileId: file.id, alt: 'media' });
    return res.body;
}

function viewAsDefault(file, type) {
    const token = gapi.client.getToken()?.access_token;
    if (!token) return contentDisplay.innerHTML = `<h2>Error: Access token missing.</h2>`;

    if (type === 'pdf') {
        if (!file.webViewLink) return contentDisplay.innerHTML = `<h2>Preview not available</h2>`;
        contentDisplay.innerHTML = `<iframe src="${file.webViewLink.replace('/view', '/preview')}" class="file-iframe"></iframe>`;
        return;
    }
    
    if (!file.webContentLink) return contentDisplay.innerHTML = `<h2>Preview not available.</h2>`;
    
    let url = file.webContentLink.replace('&export=download', '');
    const authenticatedUrl = `${url}&access_token=${token}`;
    
    let element = '';
    if (type === 'image') {
        element = `<img src="${authenticatedUrl}" alt="${file.name}">`;
    } else if (type === 'video') {
        element = `<video controls width="100%"><source src="${authenticatedUrl}" type="${file.mimeType}"></video>`;
    }
    contentDisplay.innerHTML = `<h2>${file.name}</h2>${element}`;
}

async function viewAsMarkdown(file) {
    contentDisplay.innerHTML = `<h1>Loading ${file.name}...</h1>`;
    try {
        const content = await fetchFileContent(file);
        currentMarkdownFile = file;
        currentRawMarkdown = content;
        mdToggleButton.classList.remove('hidden');
        renderMarkdownReadMode(content);
    } catch (err) { contentDisplay.innerHTML = `<h1>Error: Could not load text content.</h1>`; }
}

function renderMarkdownReadMode(markdownText) {
    contentDisplay.innerHTML = marked.parse(markdownText);
    mdToggleButton.querySelector('.material-icons').textContent = 'edit';
    mdToggleButton.title = 'Edit Mode';
    mdSaveButton.classList.add('hidden');
    isMarkdownEditMode = false;
}

function renderMarkdownEditMode(markdownText) {
    contentDisplay.innerHTML = '';
    const editor = document.createElement('textarea');
    editor.id = 'markdown-editor';
    editor.value = markdownText;
    contentDisplay.appendChild(editor);
    mdToggleButton.querySelector('.material-icons').textContent = 'menu_book';
    mdToggleButton.title = 'Read Mode';
    mdSaveButton.classList.remove('hidden');
    isMarkdownEditMode = true;
}

function toggleMarkdownMode() {
    if (isMarkdownEditMode) {
        const editor = document.getElementById('markdown-editor');
        currentRawMarkdown = editor.value; // Update raw content from editor
        renderMarkdownReadMode(currentRawMarkdown);
    } else {
        renderMarkdownEditMode(currentRawMarkdown);
    }
}

async function saveMarkdownFile() {
    if (!isMarkdownEditMode || !currentMarkdownFile) return;

    const editor = document.getElementById('markdown-editor');
    const newContent = editor.value;

    mdSaveButton.textContent = 'Saving...';
    mdSaveButton.disabled = true;

    try {
        await updateFileContent(currentMarkdownFile.id, newContent);
        currentRawMarkdown = newContent;
        // Switch to read mode to show the saved result
        renderMarkdownReadMode(newContent);
    } catch (err) {
        alert("Could not save file. See console for details.");
        console.error("Save error:", err);
    } finally {
        mdSaveButton.textContent = 'Save';
        mdSaveButton.disabled = false;
    }
}

async function updateFileContent(fileId, content) {
    const token = gapi.client.getToken()?.access_token;
    if (!token) throw new Error("Authentication token is missing.");

    await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
        method: 'PATCH',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'text/markdown',
        },
        body: content,
    });
}

async function viewAsPlainText(file) {
    contentDisplay.innerHTML = `<h1>Loading ${file.name}...</h1>`;
    try {
        const content = await fetchFileContent(file);
        const pre = document.createElement('pre');
        pre.textContent = content;
        contentDisplay.innerHTML = '';
        const title = document.createElement('h2');
        title.textContent = file.name;
        contentDisplay.appendChild(title);
        contentDisplay.appendChild(pre);
    } catch (err) { contentDisplay.innerHTML = `<h1>Error: Could not load text content.</h1>`; }
}


/*
 * ====================================================================================
 * AI BOT HELPERS (for bot.js)
 * ====================================================================================
 */
window.driveApi = {
    createFile: createNewFile,
    getCurrentFolderId: () => selectedFile.id || 'root'
};


/*
 * ====================================================================================
 * START THE APPLICATION
 * ====================================================================================
 */
initializeApp();