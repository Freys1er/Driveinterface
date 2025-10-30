/*
 * ====================================================================================
 * FLASHCARD VIEWER LOGIC (Externalized)
 * Note: This file relies on global elements/functions from script.js (e.g., contentDisplay, fetchFileContent, gapi.client.getToken)
 * ====================================================================================
 */

// Global state variables for the Flashcard Viewer
let currentDeck = [];
let currentDeckFile = null;
let currentCardIndex = -1;
let isFlipped = false;
let smartSuggestionTimeout;
let flashcardElements = {};
let isEditorReadOnly = true;

// --- Touch State Variables ---
let touchStartX = 0;
let touchStartY = 0;
let touchEndX = 0;
let touchEndY = 0;
const swipeThreshold = 50;


// --- Helper Functions ---
function getFlashcardElements() {
    flashcardElements = {
        studyScreen: document.getElementById('flashcard-study-screen'),
        editorScreen: document.getElementById('flashcard-editor-screen'),
        flashcard: document.getElementById('flashcard'),
        cardFront: document.querySelector('.card-front'),
        cardBack: document.querySelector('.card-back'),
        cardCounter: document.getElementById('card-counter'),
        editor: document.getElementById('editor'),
        editSaveBtn: document.getElementById('edit-save-btn'),
        editorTitle: document.getElementById('editor-title'),
        smartSuggestion: document.getElementById('smart-suggestion'),
    };
    return flashcardElements.flashcard;
}

function attachFlashcardListeners(file) {
    const elements = flashcardElements;
    
    // Header/Navigation
    document.getElementById('flashcard-create-deck-btn').onclick = () => {
        alert(`Deck File: ${file.name}\nFile ID: ${file.id}\nCards: ${currentDeck.length}\nTo add/remove cards, tap 'List'.`);
    };
    // The "Back" button now returns to the main app interface by clearing contentDisplay
    document.getElementById('study-back-btn').onclick = () => {
        contentDisplay.innerHTML = `<h1>${file.name}</h1><p>Closed Flashcard Viewer.</p>`;
        document.removeEventListener('keydown', handleKeyPress); // Remove key listener
    };
    document.getElementById('editor-back-btn').onclick = () => showFlashcardScreen('study-screen');
    document.getElementById('list-view-btn').onclick = showListView;
    elements.editSaveBtn.onclick = handleEditSave;

    // Flashcard touch/swipe logic
    if (elements.flashcard) {
        elements.flashcard.addEventListener('touchstart', handleTouchStart, { passive: false });
        elements.flashcard.addEventListener('touchmove', handleTouchMove, { passive: false });
        elements.flashcard.addEventListener('touchend', handleTouchEnd);
    }
}

function showFlashcardScreen(screenId) {
    document.querySelectorAll('#file-content-display .screen').forEach(s => s.classList.remove('active'));
    document.getElementById(`flashcard-${screenId}`).classList.add('active');
}

// --- Key Press Handler ---
function handleKeyPress(e) {
    if (!document.getElementById('flashcard-study-screen')?.classList.contains('active')) {
        return;
    }

    switch (e.key) {
        case 'ArrowLeft':
            e.preventDefault();
            handleSwipeLeft();
            break;
        case 'ArrowRight':
            e.preventDefault();
            handleSwipeRight();
            break;
        case 'ArrowDown':
        case ' ':
            e.preventDefault();
            flipCard();
            break;
    }
}

// --- Touch Handlers ---
function handleTouchStart(e) {
  touchStartX = e.changedTouches[0].screenX;
  touchStartY = e.changedTouches[0].screenY;
  flashcardElements.flashcard.classList.remove('is-flipping');
}

function handleTouchMove(e) {
  e.preventDefault();
  const currentX = e.changedTouches[0].screenX;
  const moveX = currentX - touchStartX;
  if (!isFlipped) {
    flashcardElements.flashcard.style.transform = `translateX(${moveX}px)`;
  } else {
    flashcardElements.flashcard.style.transform = `rotateY(180deg) translateX(${-moveX}px)`;
  }
}

function handleTouchEnd(e) {
  touchEndX = e.changedTouches[0].screenX;
  touchEndY = e.changedTouches[0].screenY;
  handleSwipe();
}

function handleSwipe() {
  const distX = touchEndX - touchStartX;
  const distY = touchEndY - touchStartY;

  if (Math.abs(distX) > swipeThreshold && Math.abs(distX) > Math.abs(distY)) {
    if (distX < 0) { handleSwipeLeft(); } 
    else { handleSwipeRight(); }
  } else if (Math.abs(distX) < 10 && Math.abs(distY) < 10) {
    flipCard();
  } else {
    resetCardPosition();
  }
}

function handleSwipeLeft() {
  if (isFlipped) { flipCard(); } 
  else { markIncorrect(); }
}

function handleSwipeRight() {
  if (!isFlipped) { flipCard(); } 
  else { markCorrect(); }
}

// --- Core Action Functions ---
function flipCard() {
  isFlipped = !isFlipped;
  flashcardElements.flashcard.classList.add('is-flipping');
  flashcardElements.flashcard.style.transform = '';
  flashcardElements.flashcard.classList.toggle('is-flipped', isFlipped);
  clearTimeout(smartSuggestionTimeout);
  hideSmartSuggestion();
}

function resetCardPosition() {
    flashcardElements.flashcard.classList.add('is-flipping');
    flashcardElements.flashcard.style.transform = '';
    if (isFlipped) {
        flashcardElements.flashcard.classList.add('is-flipped');
    }
}

function animateCardOut(direction) {
    flashcardElements.flashcard.classList.add('is-flipping');
    const exitX = direction === 'left' ? '-150%' : '150%';
    if (!isFlipped) {
        flashcardElements.flashcard.style.transform = `translateX(${exitX})`;
    } else {
        flashcardElements.flashcard.style.transform = `rotateY(180deg) translateX(${-exitX})`;
    }
}

// --- Study & Card Logic ---
function nextCard() {
  setTimeout(() => {
    if (currentDeck.length === 0) {
      flashcardElements.cardFront.textContent = "Deck complete!";
      flashcardElements.cardBack.textContent = "Great job!";
      return;
    }

    currentDeck.sort((a, b) => (a.score || 0) - (b.score || 0));
    currentCardIndex = 0;
    
    displayCard();
  }, 250);
}

function displayCard() {
  isFlipped = false;
  flashcardElements.flashcard.classList.remove('is-flipping', 'is-flipped');
  flashcardElements.flashcard.style.transform = 'translateX(0)';

  const card = currentDeck[currentCardIndex];
  flashcardElements.cardFront.textContent = card.question;
  flashcardElements.cardBack.textContent = card.answer;
  flashcardElements.cardCounter.textContent = `${currentCardIndex + 1} / ${currentDeck.length}`;

  clearTimeout(smartSuggestionTimeout);
  smartSuggestionTimeout = setTimeout(() => showSmartSuggestion("You've been on this card for a while, take a break?"), 15000);
  if (card.answer && card.answer.length > 150) {
    showSmartSuggestion("The answer may be too long and cause difficulty.");
  }
}

function markCorrect() {
  if (currentCardIndex > -1) {
    currentDeck[currentCardIndex].score = (currentDeck[currentCardIndex].score || 0) + 1;
    saveDeckProgress();
    animateCardOut('right');
    nextCard();
  }
}

function markIncorrect() {
  if (currentCardIndex > -1) {
    currentDeck[currentCardIndex].score = Math.max(0, (currentDeck[currentCardIndex].score || 0) - 1);
    saveDeckProgress();
    animateCardOut('left');
    nextCard();
  }
}

// --- File & Save Functions ---

async function saveFileContent(fileId, content) {
    try {
        const boundary = 'flashcard_boundary';
        const delimiter = "\r\n--" + boundary + "\r\n";
        const close_delim = "\r\n--" + boundary + "--";

        const contentType = 'application/json';
        const metadata = { name: currentDeckFile.name, mimeType: contentType };
        // Use Blob and FormData for simpler content upload
        const contentBlob = new Blob([content], { type: contentType });
        const metadataBlob = new Blob([JSON.stringify(metadata)], { type: 'application/json' });
        
        const form = new FormData();
        form.append('metadata', metadataBlob);
        form.append('file', contentBlob);

        const response = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`, {
            method: 'PATCH',
            headers: new Headers({ 
                'Authorization': `Bearer ${gapi.client.getToken().access_token}`,
            }),
            body: form,
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status}. Details: ${errorText}`);
        }
        console.log("Deck progress saved successfully.");
    } catch (err) {
        console.error("Error saving file content:", err);
        // Note: Use alert only for critical errors, console.error is better here
    }
}

function saveDeckProgress() {
    if (currentDeckFile) {
        const contentToSave = JSON.stringify(currentDeck, null, 2);
        saveFileContent(currentDeckFile.id, contentToSave);
    }
}

// --- List/Editor Functions ---
function showListView() {
  showFlashcardScreen('editor-screen');
  isEditorReadOnly = true;
  flashcardElements.editor.setAttribute('readonly', true);
  flashcardElements.editSaveBtn.textContent = "Edit";
  const sortedDeck = [...currentDeck].sort((a, b) => (a.score || 0) - (b.score || 0));
  flashcardElements.editorTitle.textContent = currentDeckFile ? currentDeckFile.name : "Card List";
  flashcardElements.editor.value = JSON.stringify(sortedDeck, null, 2);
}

function handleEditSave() {
  if (isEditorReadOnly) {
    if (!currentDeckFile) {
      alert("Editing is disabled in this view.");
      return;
    }
    isEditorReadOnly = false;
    flashcardElements.editor.removeAttribute('readonly');
    flashcardElements.editSaveBtn.textContent = "Save";
    flashcardElements.editorTitle.textContent = `Editing ${currentDeckFile.name}`;
    flashcardElements.editor.focus();
  } else {
    isEditorReadOnly = true;
    flashcardElements.editor.setAttribute('readonly', true);
    flashcardElements.editSaveBtn.textContent = "Edit";
    flashcardElements.editorTitle.textContent = currentDeckFile.name;
    try {
      const updatedDeck = JSON.parse(flashcardElements.editor.value);
      currentDeck = updatedDeck.map(card => ({
          ...card,
          score: currentDeck.find(c => c.question === card.question)?.score || card.score || 0 
      }));
      saveDeckProgress();
      alert("Deck saved!");
    } catch (e) {
      alert(`Invalid JSON: ${e.message}`);
      isEditorReadOnly = false;
      flashcardElements.editor.removeAttribute('readonly');
      flashcardElements.editSaveBtn.textContent = "Save";
      flashcardElements.editorTitle.textContent = `Editing ${currentDeckFile.name}`;
    }
  }
}

// --- Smart Suggestion Helpers ---
function showSmartSuggestion(message) {
  flashcardElements.smartSuggestion.textContent = message;
  flashcardElements.smartSuggestion.style.display = 'block';
  setTimeout(hideSmartSuggestion, 5000);
}

function hideSmartSuggestion() {
  if (flashcardElements.smartSuggestion) {
      flashcardElements.smartSuggestion.style.display = 'none';
  }
}

// Helper function to fetch file content
async function fetchAsset(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to load asset: ${url}. Status: ${response.status}`);
    }
    return response.text();
}

// --- Main Viewer Function ---

async function viewAsFlashcards(file) {
    contentDisplay.innerHTML = `<h1>Loading Flashcard Viewer...</h1>`;
    
    let htmlContent, cssContent;
    try {
        // 1. Fetch HTML and CSS content
        const [html, css] = await Promise.all([
            fetchAsset('flashcards/flashcards.html'),
            fetchAsset('flashcards/flashcards.css')
        ]);
        htmlContent = html;
        cssContent = css;
    } catch (err) {
        return contentDisplay.innerHTML = `<h1>Error: Could not load viewer assets.</h1><p>${err.message}</p>`;
    }

    // 2. Inject HTML and CSS into contentDisplay
    contentDisplay.innerHTML = `
        <style>${cssContent}</style>
        ${htmlContent}
    `;

    // 3. Continue with existing logic...
    try {
        currentDeck = [];
        currentDeckFile = file;
        
        // fetchFileContent is a global function from script.js
        const content = await fetchFileContent(file);
        
        // Try to parse the content
        let data;
        try {
            data = JSON.parse(content);
        } catch(e) {
            data = [{
                question: "Error: Invalid JSON format.",
                answer: "Please tap List/Edit to correct the file format.",
                score: 0
            }];
            // Use console.warn instead of alert to prevent blocking the UI
            console.warn("Flashcard file content is not valid JSON. Editing recommended.");
        }
        
        currentDeck = data.map(card => ({
            ...card,
            score: card.score || 0 // Ensure score exists
        }));

        // Get references and attach listeners now that the HTML is in the DOM
        if (!getFlashcardElements()) throw new Error("Flashcard UI failed to load.");
        attachFlashcardListeners(file);
        document.addEventListener('keydown', handleKeyPress); // Activate keypress listener
        
        // Start studying logic
        if (currentDeck.length > 0) {
            nextCard(); // Start studying immediately
        } else {
            flashcardElements.cardFront.textContent = "Deck is empty.";
            flashcardElements.cardBack.textContent = "Tap List to add cards.";
            flashcardElements.cardCounter.textContent = "0 / 0";
        }

    } catch(err) {
        contentDisplay.innerHTML = `<h1>Error: Could not load Flashcard data.</h1><p>${err.message}</p>`;
        console.error("Flashcard loading error:", err);
    }
}