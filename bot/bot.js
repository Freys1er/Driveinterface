// --- DOM ELEMENTS ---
const botContainer = document.getElementById('bot-container');
const messagesContainer = document.getElementById('bot-messages');
const input = document.getElementById('bot-input');
const sendButton = document.getElementById('bot-send-button');
const fileUploadInput = document.getElementById('bot-file-upload-input');

// --- STATE ---
let conversationHistory = [];
let attachedFile = null;

// --- EVENT LISTENERS ---
sendButton.addEventListener('click', handleSendMessage);
input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
    }
});
fileUploadInput.addEventListener('change', handleFileUpload);


// --- FUNCTIONS ---

/**
 * Handles sending a message when the user clicks send or presses Enter.
 */
async function handleSendMessage() {
    const userMessage = input.value.trim();
    if (!userMessage && !attachedFile) return;

    addMessage('user', userMessage, attachedFile ? attachedFile.name : null);
    input.value = '';

    showTypingIndicator(true);

    const createFileRegex = /create file(?: at)? (.*?\.md) with content:/is;
    const match = userMessage.match(createFileRegex);

    if (match) {
        const filePath = match[1].trim();
        const content = userMessage.substring(match[0].length).trim();
        await handleCreateFileCommand(filePath, content);
    } else {
        await sendMessageToGemini(userMessage);
    }

    showTypingIndicator(false);
    resetAttachedFile();
}

/**
 * Handles the special command to create a file in Google Drive.
 * @param {string} fileName The name of the file to create.
 * @param {string} content The content to put in the file.
 */
async function handleCreateFileCommand(fileName, content) {
    addMessage('bot', `Understood. Creating file "${fileName}"...`);
    try {
        if (window.driveApi && typeof window.driveApi.createFile === 'function') {
            const parentId = window.driveApi.getCurrentFolderId();
            await window.driveApi.createFile(fileName, content, parentId);
            addMessage('bot', `Successfully created "${fileName}" in the current folder.`);
        } else {
            throw new Error("Drive API functions are not available.");
        }
    } catch (error) {
        console.error("Failed to create file via bot:", error);
        addMessage('bot', `Sorry, I couldn't create the file. Error: ${error.message}`);
    }
}

/**
 * Sends the user's message and any attached file to the Gemini API.
 * @param {string} text The user's text message.
 */
async function sendMessageToGemini(text) {
    // Get the API key securely from the main script
    const apiKey = window.driveApi ? window.driveApi.getGeminiApiKey() : null;

    if (!apiKey) {
        addMessage('bot', "Gemini API Key is not configured. Please refresh the page and provide your key when prompted. The key is stored securely in a `settings.json` file in your Google Drive root folder.");
        showTypingIndicator(false);
        return;
    }

    const visionModel = 'gemini-flash-latest';
    const textModel = 'gemini-flash-latest';
    const model = attachedFile ? visionModel : textModel;
    const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    
    const contents = [{
        parts: [{ text: text }]
    }];

    if (attachedFile) {
        contents[0].parts.push({
            inline_data: {
                mime_type: attachedFile.type,
                data: attachedFile.base64
            }
        });
    }

    try {
        const response = await fetch(GEMINI_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error.message || `API request failed with status ${response.status}`);
        }

        const data = await response.json();
        const botResponse = data.candidates[0].content.parts[0].text;
        addMessage('bot', botResponse);

    } catch (error) {
        console.error("Gemini API Error:", error);
        addMessage('bot', `Error communicating with AI: ${error.message}`);
    }
}


/**
 * Handles the selection of a file for upload to the AI.
 * @param {Event} e The file input change event.
 */
async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 4 * 1024 * 1024) {
        addMessage('bot', "File is too large. Please select a file smaller than 4MB.");
        return;
    }

    try {
        const base64 = await toBase64(file);
        attachedFile = {
            name: file.name,
            type: file.type,
            base64: base64
        };
        addMessage('system', `Attached "${file.name}". Ask me a question about it.`);
    } catch (error) {
        console.error("File processing error:", error);
        addMessage('system', "Could not process the attached file.");
    } finally {
        fileUploadInput.value = '';
    }
}

/**
 * Adds a message to the chat UI.
 * @param {'user' | 'bot' | 'system'} role The sender of the message.
 * @param {string} text The message content.
 * @param {string|null} attachmentName Optional name of an attached file.
 */
function addMessage(role, text, attachmentName = null) {
    const messageEl = document.createElement('div');
    messageEl.className = `bot-message ${role}`;
    
    let content = text;
    if (role === 'bot' && window.marked) {
        content = marked.parse(text);
    } else {
        const tempDiv = document.createElement('div');
        tempDiv.textContent = text;
        content = tempDiv.innerHTML.replace(/\n/g, '<br>');
    }

    if (attachmentName) {
        content = `<div class="attachment-info">File: ${attachmentName}</div>` + content;
    }
    
    messageEl.innerHTML = content;
    messagesContainer.appendChild(messageEl);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

/**
 * Shows or hides the typing indicator.
 * @param {boolean} show Whether to show or hide the indicator.
 */
function showTypingIndicator(show) {
    let indicator = messagesContainer.querySelector('.typing-indicator');
    if (show) {
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.className = 'bot-message bot typing-indicator';
            indicator.innerHTML = '<span></span><span></span><span></span>';
            messagesContainer.appendChild(indicator);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    } else {
        if (indicator) {
            indicator.remove();
        }
    }
}

/**
 * Resets the attached file state after a message is sent.
 */
function resetAttachedFile() {
    attachedFile = null;
}

/**
 * Converts a File object to a Base64 string.
 * @param {File} file The file to convert.
 * @returns {Promise<string>} A promise that resolves with the Base64 string.
 */
function toBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = error => reject(error);
    });
}