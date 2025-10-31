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
let geminiApiKey = null;
// NEW: Unified state for the text editor
let currentTextFile = null;
let currentRawText = '';
let isEditMode = false;

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
const fullscreenButton = document.getElementById('fullscreen-button');
const toggleBotButton = document.getElementById('toggle-bot-button');
const botCloseButton = document.getElementById('bot-close-button');
// RENAMED: Editor buttons are now generic
const editorToggleButton = document.getElementById('editor-toggle-button');
const editorSaveButton = document.getElementById('editor-save-button');
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
fullscreenButton.onclick = toggleFullScreen;
toggleBotButton.onclick = toggleBot;
botCloseButton.onclick = toggleBot;
editorToggleButton.onclick = toggleEditorMode;
editorSaveButton.onclick = saveTextFile;

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
    await gapi.client.init({ discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'] });
    gapiInited = true; validateToken();
}

async function validateToken() {
    if (!gapiInited || !gisInited) return;
    const storedToken = getStoredToken();
    if (storedToken) {
        gapi.client.setToken(storedToken);
        try {
            await gapi.client.drive.about.get({ fields: 'user' });
            await handleApiKeys();
            navigateTo('root', 'Root');
        } catch (err) { signOut(); }
    }
}

function handleAuthClick() { if (gisInited) tokenClient.requestAccessToken({ prompt: 'consent' }); }

async function handleTokenResponse(tokenResponse) {
    if (tokenResponse.error) return console.error("Auth error:", tokenResponse.error);
    saveToken(gapi.client.getToken());
    showAppUI();
    await handleApiKeys();
    navigateTo('root', 'Root');
}

function handleSignoutClick() {
    const token = getStoredToken();
    if (token) { google.accounts.oauth2.revoke(token.access_token, signOut); } else { signOut(); }
}

function signOut() {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    gapi.client.setToken('');
    geminiApiKey = null;
    showLoginUI();
    fileList.innerHTML = '';
}

function saveToken(token) { localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(token)); }
function getStoredToken() {
    const tokenString = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!tokenString) return null;
    try { return JSON.parse(tokenString); } catch (e) { return null; }
}

function showAppUI() {
    loginScreen.classList.add('hidden');
    appContainer.classList.remove('hidden');
    appContainer.classList.add('bot-collapsed');
}

function showLoginUI() {
    loginScreen.classList.remove('hidden');
    appContainer.classList.add('hidden');
}

// ... (API Key Handling Protocol remains the same) ...
async function handleApiKeys() { try { let e = await searchForSettingsFile(); if (e) { const t = await fetchFileContent({ id: e }); if (t) { try { const n = JSON.parse(t); if (n.geminiApiKey) { geminiApiKey = n.geminiApiKey; return console.log("Gemini API Key loaded from settings.json."), void 0 } } catch (o) { console.warn("settings.json is malformed. Will ask for key.") } } await getAndSaveApiKey(e) } else { const t = await createSettingsFile(); await getAndSaveApiKey(t) } } catch (s) { console.error("Error during API key handling:", s), alert("Could not set up API key. The bot may not function correctly.") } } async function searchForSettingsFile() { const e = await gapi.client.drive.files.list({ q: "name='settings.json' and 'root' in parents and trashed = false", fields: "files(id)", spaces: "drive" }); return e.result.files.length > 0 ? e.result.files[0].id : null } async function createSettingsFile() { const e = await gapi.client.drive.files.create({ resource: { name: "settings.json", mimeType: "application/json", parents: ["root"] }, fields: "id" }); return e.result.id } async function getAndSaveApiKey(e) { const t = prompt("Please enter your Google AI Gemini API Key.\n\nThis will be saved to a 'settings.json' file in your Google Drive root folder so you won't be asked again."); t && t.trim() ? (geminiApiKey = t.trim(), await updateFileContent(e, JSON.stringify({ geminiApiKey: geminiApiKey }, null, 2), "application/json"), alert("API Key saved successfully to settings.json.")) : (alert("No API Key provided. The AI Bot will not function."), geminiApiKey = null) }


/*
 * ====================================================================================
 * NAVIGATION & UI RENDERING
 * ====================================================================================
 */
function navigateTo(folderId, folderName) {
    if (folderId === 'root' && currentPath.length === 0) { currentPath = [{ id: 'root', name: 'Root' }]; }
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

// ... (handleFileTreeClick, toggleFolder, renderFileTree remain the same) ...
function handleFileTreeClick(e) { const t = e.target.closest(".file-row"); if (t) { const n = t.parentElement, o = { ...n.dataset }; updateSelection(t, o); const s = e.target.closest("button"); s ? (e.stopPropagation(), s.classList.contains("rename-button") ? renameFile(o.id, o.name, n) : s.classList.contains("delete-button") ? deleteFileOrFolder(o.id, o.name, n) : s.classList.contains("download-button") && downloadFile(o)) : "application/vnd.google-apps.folder" === o.mimeType ? toggleFolder(n, o) : (openFile(o), window.innerWidth <= 768 && (fileNavigator.classList.remove("visible"), mobileMenuToggle.querySelector(".material-icons").textContent = "menu")) } } async function toggleFolder(e, t) { const n = e.dataset.loaded === "true", o = e.classList.contains("collapsed"), s = e.querySelector("ul"); s && (!n ? (e.dataset.loaded = "true", e.classList.remove("collapsed"), await renderFileTree(t.id, s), updateFolderIcon(e, !1)) : o ? (e.classList.remove("collapsed"), updateFolderIcon(e, !1)) : (e.classList.add("collapsed"), updateFolderIcon(e, !0))) } async function renderFileTree(parentId, parentElement) {
    // Start by clearing the target element and showing a loading state
    parentElement.innerHTML = `<li>Loading...</li>`;
    try {
        // Fetch the list of files and folders from the Google Drive API
        const response = await gapi.client.drive.files.list({
            q: `'${parentId}' in parents and trashed = false`,
            fields: 'files(id, name, mimeType, webContentLink, webViewLink)',
            orderBy: 'folder desc, name'
        });
        const files = response.result.files;

        // Clear the loading message
        parentElement.innerHTML = '';

        // Handle the case where a folder is empty
        if (!files || files.length === 0) {
            if (parentId !== 'root' && parentId !== selectedFile.id) {
                parentElement.innerHTML = '<li class="empty-folder">(Empty)</li>';
            }
            return; // Stop the function here if there are no files
        }

        // Loop through each file/folder returned by the API
        files.forEach(file => {
            const listItem = document.createElement('li');

            // Store all file metadata in the element's dataset for later use
            Object.keys(file).forEach(key => {
                if (file[key]) {
                    listItem.dataset[key] = String(file[key]);
                }
            });

            const isFolder = file.mimeType === 'application/vnd.google-apps.folder';
            if (isFolder) {
                listItem.classList.add('collapsed');
            }

            // Create the visible row for the file
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
                </div>
            `;

            listItem.appendChild(fileRow);

            // If the item is a folder, add an empty <ul> to hold its children later
            if (isFolder) {
                listItem.dataset.loaded = 'false';
                listItem.appendChild(document.createElement('ul'));
            }

            // *** THIS IS THE CRITICAL LINE ***
            // Append the newly created listItem to the correct parent element from the function parameter
            parentElement.appendChild(listItem);
        });
    } catch (err) {
        console.error("Error rendering file tree:", err);
        // Ensure parentElement is valid before trying to update it in case of an error
        if (parentElement) {
            parentElement.innerHTML = `<li>Error loading files.</li>`;
        }
    }
}

// ... (UI Toggles & Modes remain the same) ...
function handleFocusClick() { selectedFile && "application/vnd.google-apps.folder" === selectedFile.mimeType && enterFocusMode(selectedFile.id, selectedFile.name) } function enterFocusMode(e, t) { isFocusMode = !0, unfocusButton.classList.remove("hidden"), focusButton.classList.remove("active"), focusButton.title = "Focus on Selected Folder", currentPath = [{ id: e, name: t }], renderFileTree(e, fileList), renderPathBar() } function exitFocusMode() { isFocusMode = !1, unfocusButton.classList.add("hidden"), focusButton.classList.remove("active"), focusButton.title = "Focus on Selected Folder", currentPath = [{ id: "root", name: "Root" }], renderFileTree("root", fileList), renderPathBar() } function toggleFileNavigator() { fileNavigator.classList.toggle("visible"); const e = fileNavigator.classList.contains("visible"); mobileMenuToggle.querySelector(".material-icons").textContent = e ? "close" : "menu" } function toggleFullScreen() { contentArea.classList.toggle("fullscreen"); const e = contentArea.classList.contains("fullscreen"); fullscreenButton.querySelector(".material-icons").textContent = e ? "fullscreen_exit" : "fullscreen" } function toggleBot() { appContainer.classList.toggle("bot-collapsed"); const e = appContainer.classList.contains("bot-collapsed"); toggleBotButton.querySelector(".material-icons").textContent = e ? "chat_bubble_outline" : "chat" }


// ... (filterFileTree, renameFile, deleteFileOrFolder, getIconForFile, updateFolderIcon remain the same) ...
function filterFileTree(e) { const t = e.toLowerCase(); fileList.querySelectorAll("li").forEach(e => { const n = (e.dataset.name || "").toLowerCase().includes(t); e.classList.toggle("hidden-by-search", !n), n && function (e) { for (let t = e.parentElement.closest("li"); t;)t.classList.remove("hidden-by-search"), t.classList.remove("collapsed"), updateFolderIcon(t, !1), t = t.parentElement.closest("li") }(e) }) } async function renameFile(e, t, n) { const o = prompt("Enter new name:", t); o && o !== t && gapi.client.drive.files.update({ fileId: e, resource: { name: o } }).then(() => { n.querySelector(".file-name").textContent = o, n.dataset.name = o }).catch(() => alert("Could not rename file.")) } async function deleteFileOrFolder(e, t, n) { confirm(`Are you sure you want to delete "${t}"? This moves the item to Trash.`) && gapi.client.drive.files.update({ fileId: e, resource: { trashed: !0 } }).then(() => { n.remove(), selectedFile.id === e && (contentDisplay.innerHTML = `<h1>File Deleted</h1><p>"${t}" was moved to trash.</p>`, selectedFile = { id: "root", name: "Root" }) }).catch(e => { alert("Could not delete file/folder."), console.error("Delete error:", e) }) } function getIconForFile(e) { const t = e.name || ""; return "application/vnd.google-apps.folder" === e.mimeType ? "folder" : e.mimeType.startsWith("image/") ? "image" : e.mimeType.startsWith("video/") ? "movie" : e.mimeType.startsWith("audio/") ? "audio_file" : "application/pdf" === e.mimeType ? "picture_as_pdf" : t.toLowerCase().endsWith(".md") ? "article" : e.mimeType.includes("google-apps.document") ? "description" : e.mimeType.includes("google-apps.spreadsheet") ? "analytics" : e.mimeType.includes("google-apps.presentation") ? "slideshow" : "insert_drive_file" } function updateFolderIcon(e, t) { const n = e.querySelector(".toggle-arrow"); n && (n.textContent = t ? "chevron_right" : "expand_more") }


// ... (File Actions: create, upload, download, refresh remain the same) ...
async function createNewFile(e, t = "", n = selectedFile.id || "root") { "string" != typeof e && (e = prompt("Enter filename (e.g., 'My Note.md'):", "Untitled.md")), e && gapi.client.getToken() && fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", { method: "POST", headers: new Headers({ Authorization: `Bearer ${gapi.client.getToken().access_token}` }), body: function (e, t, n) { const o = { name: e, parents: [n] }; e.toLowerCase().endsWith(".md") ? o.mimeType = "text/markdown" : o.mimeType = "text/plain"; const s = new FormData; return s.append("metadata", new Blob([JSON.stringify(o)], { type: "application/json" })), s.append("file", new Blob([t], { type: o.mimeType })), s }(e, t, n) }).then(e => { e.ok ? refreshFileTree() : alert("Could not create file.") }).catch(e => { alert("Could not create file."), console.error("Create file error:", e) }) } async function createNewFolder() { const e = prompt("Enter folder name:", "New Folder"); e && gapi.client.drive.files.create({ resource: { name: e, mimeType: "application/vnd.google-apps.folder", parents: [selectedFile.id || "root"] }, fields: "id" }).then(refreshFileTree).catch(() => alert("Could not create folder.")) } async function uploadFile(e) { const t = e.target.files[0]; if (t) { contentDisplay.innerHTML = `<h1>Uploading ${t.name}...</h1>`; const n = { name: t.name, parents: [selectedFile.id || "root"] }, o = new FormData; o.append("metadata", new Blob([JSON.stringify(n)], { type: "application/json" })), o.append("file", t), fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", { method: "POST", headers: new Headers({ Authorization: `Bearer ${gapi.client.getToken().access_token}` }), body: o }).then(e => { e.ok ? (contentDisplay.innerHTML = "<h1>Upload complete!</h1>", refreshFileTree()) : alert("Could not upload file.") }).catch(() => alert("Could not upload file.")).finally(() => { e.target.value = "" }) } } function downloadFile(e) { const t = gapi.client.getToken()?.access_token; t ? e.webContentLink ? window.open(`${e.webContentLink}&access_token=${t}`, "_blank") : alert("This file is not directly downloadable (e.g., Google Docs).") : alert("Authentication token not found. Please sign in again.") } function refreshFileTree() { const e = isFocusMode ? selectedFile.id : "root"; renderFileTree(e, fileList) }

/*
 * ====================================================================================
 * UNIVERSAL TEXT EDITOR & VIEWERS (REFACTORED)
 * ====================================================================================
 */

/**
 * NEW: Determines if a file is a text-based format that can be edited.
 * @param {object} file - The file object from the Drive API.
 * @returns {boolean}
 */
function isEditableTextFile(file) {
    const editableMimeTypes = ['text/plain', 'text/markdown', 'text/html', 'text/css', 'text/javascript', 'application/json'];
    const editableExtensions = ['.md', '.txt', '.js', '.css', '.html', '.json', '.xml', '.yaml', '.log'];

    if (file.mimeType && editableMimeTypes.includes(file.mimeType)) {
        return true;
    }
    if (file.name) {
        return editableExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
    }
    return false;
}

/**
 * Clears editor state and hides buttons. Called before opening any new file.
 */
function resetEditorState() {
    editorToggleButton.classList.add('hidden');
    editorSaveButton.classList.add('hidden');
    isEditMode = false;
    currentTextFile = null;
    currentRawText = '';


    contentDisplay.classList.remove('iframe-active', 'flashcard-mode', 'editor-active');
}

// In script.js, modify the openFile function

// In script.js, replace the entire openFile function with this one

function openFile(file) {
    resetEditorState();

    const mimeType = file.mimeType || '';
    const fileName = file.name || '';

    // --- START of CHANGE ---
    // Rule 1 (HIGHEST PRIORITY): Check for the specific .flashcards extension first.
    if (fileName.toLowerCase().endsWith('.flashcards')) {
        viewAsFlashcards(file);
    }
    // --- END of CHANGE ---

    // Rule 2: Check for other editable text files.
    else if (isEditableTextFile(file)) {
        initializeTextEditor(file);
    }

    // Rule 3: Check for all iframe-able file types (Google, Office, PDF).
    else if (
        mimeType === 'application/vnd.google-apps.document' ||
        mimeType === 'application/vnd.google-apps.spreadsheet' ||
        mimeType === 'application/vnd.google-apps.presentation' ||
        mimeType === 'application/pdf' ||
        mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || // .docx
        mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||       // .xlsx
        mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation'  // .pptx
    ) {
        viewAsDefault(file, 'iframe');
    }

    // Rule 4: Handle standard media types.
    else if (mimeType.startsWith('image/')) {
        viewAsDefault(file, 'image');
    } else if (mimeType.startsWith('video/')) {
        viewAsDefault(file, 'video');
    }

    // Rule 5 (FALLBACK): If nothing else matches, open as a read-only text preview.
    else {
        initializeTextEditor(file, true);
    }
}

async function fetchFileContent(file) {
    if (file.mimeType && file.mimeType.includes('google-apps')) {
        const res = await gapi.client.drive.files.export({ fileId: file.id, mimeType: 'text/plain' });
        return res.body;
    }
    const res = await gapi.client.drive.files.get({ fileId: file.id, alt: 'media' });
    return res.body;
}

function viewAsDefault(file, type) {
    const token = gapi.client.getToken()?.access_token;
    if (!token) {
        contentDisplay.innerHTML = `<h2>Error: Access token missing.</h2>`;
        return;
    }

    // --- START of CHANGE ---
    // Handle all iframe previews (PDF, Docs, Sheets, Slides) with one block
    if (type === 'iframe') {
        contentDisplay.classList.add('iframe-active'); // Use a generic class
        if (!file.webViewLink) {
            contentDisplay.innerHTML = `<h2>Preview not available for this file.</h2>`;
            return;
        }
        // The preview URL works for all Google Workspace files and PDFs
        const previewUrl = file.webViewLink.replace('/view', '/preview');
        contentDisplay.innerHTML = `<iframe src="${previewUrl}" class="file-iframe"></iframe>`;
        return;
    }
    // --- END of CHANGE ---

    // This part for images and videos remains the same
    if (!file.webContentLink) {
        contentDisplay.innerHTML = `<h2>Preview not available.</h2>`;
        return;
    }
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
/**
 * Initializes the editor for any text-based file.
 * @param {object} file - The file object.
 * @param {boolean} [readOnly=false] - If true, the edit button will be hidden.
 */
async function initializeTextEditor(file, readOnly = false) {
    contentDisplay.innerHTML = `<h1>Loading ${file.name}...</h1>`;
    try {
        const content = await fetchFileContent(file);
        currentTextFile = file;
        currentRawText = content;
        if (!readOnly) {
            editorToggleButton.classList.remove('hidden');
        }
        renderTextViewer(file, content);
    } catch (err) {
        contentDisplay.innerHTML = `<h1>Error: Could not load file content.</h1>`;
        console.error("Error fetching file content:", err);
    }
}

/**
 * Renders the "Read Mode" view for a text file.
 * @param {object} file - The file object.
 * @param {string} content - The raw text content of the file.
 */
function renderTextViewer(file, content) {
    contentDisplay.classList.remove('editor-active');
    if (file.name && file.name.toLowerCase().endsWith('.md')) {
        contentDisplay.innerHTML = marked.parse(content);
    } else {
        const pre = document.createElement('pre');
        pre.textContent = content;
        contentDisplay.innerHTML = '';
        contentDisplay.appendChild(pre);
    }
    editorToggleButton.querySelector('.material-icons').textContent = 'edit';
    editorToggleButton.title = 'Edit Mode';
    editorSaveButton.classList.add('hidden');
    isEditMode = false;
}

/**
 * Renders the "Edit Mode" view with a textarea.
 */
function renderEditMode() {
    contentDisplay.classList.add('editor-active');
    contentDisplay.innerHTML = '';
    const editor = document.createElement('textarea');
    editor.id = 'text-editor';
    editor.value = currentRawText;
    contentDisplay.appendChild(editor);

    editorToggleButton.querySelector('.material-icons').textContent = 'menu_book';
    editorToggleButton.title = 'Read Mode';
    editorSaveButton.classList.remove('hidden');
    isEditMode = true;
}

/**
 * Toggles between read and edit modes.
 */
function toggleEditorMode() {
    if (isEditMode) {
        const editor = document.getElementById('text-editor');
        currentRawText = editor.value;
        renderTextViewer(currentTextFile, currentRawText);
    } else {
        renderEditMode();
    }
}

/**
 * Saves the content of the text editor back to Google Drive.
 */
async function saveTextFile() {
    if (!isEditMode || !currentTextFile) return;

    const editor = document.getElementById('text-editor');
    const newContent = editor.value;

    editorSaveButton.textContent = 'Saving...';
    editorSaveButton.disabled = true;

    try {
        await updateFileContent(currentTextFile.id, newContent, currentTextFile.mimeType || 'text/plain');
        currentRawText = newContent;
        renderTextViewer(currentTextFile, newContent); // Switch to read mode
    } catch (err) {
        alert("Could not save file. See console for details.");
        console.error("Save error:", err);
    } finally {
        editorSaveButton.textContent = 'Save';
        editorSaveButton.disabled = false;
    }
}

async function updateFileContent(fileId, content, contentType = 'text/plain') {
    const token = gapi.client.getToken()?.access_token;
    if (!token) throw new Error("Authentication token is missing.");
    await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': contentType },
        body: content,
    });
}

/*
 * ====================================================================================
 * AI BOT HELPERS & APP START
 * ====================================================================================
 */
window.driveApi = {
    createFile: createNewFile,
    getCurrentFolderId: () => selectedFile.id || 'root',
    getGeminiApiKey: () => geminiApiKey
};

initializeApp();