/*
 * ====================================================================================
 * FLASHCARD VIEWER LOGIC (Externalized)
 * Note: This file relies on global elements/functions from script.js (e.g., contentDisplay, fetchFileContent, gapi.client.getToken)
 * ====================================================================================
 */

// ... (All global state variables and helper functions remain the same) ...
let currentDeck = [];
let currentDeckFile = null;
let currentCardIndex = -1;
let isFlipped = false;
let smartSuggestionTimeout;
let flashcardElements = {};
let isEditorReadOnly = true;
let touchStartX = 0;
let touchStartY = 0;
let touchEndX = 0;
let touchEndY = 0;
const swipeThreshold = 50;


// --- Helper Functions ---
function getFlashcardElements(){flashcardElements={studyScreen:document.getElementById("flashcard-study-screen"),editorScreen:document.getElementById("flashcard-editor-screen"),flashcard:document.getElementById("flashcard"),cardFront:document.querySelector(".card-front"),cardBack:document.querySelector(".card-back"),cardCounter:document.getElementById("card-counter"),editor:document.getElementById("editor"),editSaveBtn:document.getElementById("edit-save-btn"),editorTitle:document.getElementById("editor-title"),smartSuggestion:document.getElementById("smart-suggestion")};return flashcardElements.flashcard}

function attachFlashcardListeners(file) {
    const elements = flashcardElements;
    
    document.getElementById('flashcard-create-deck-btn').onclick = () => {
        alert(`Deck File: ${file.name}\nFile ID: ${file.id}\nCards: ${currentDeck.length}\nTo add/remove cards, tap 'List'.`);
    };

    // --- MODIFIED: Back button now also removes the stylesheet ---
    document.getElementById('study-back-btn').onclick = () => {
        // Remove the dynamically added stylesheet
        const flashcardStyle = document.getElementById('flashcard-styles');
        if (flashcardStyle) {
            flashcardStyle.remove();
        }
        
        // Reset the content area
        contentDisplay.innerHTML = `<h1>${file.name}</h1><p>Closed Flashcard Viewer.</p>`;
        document.removeEventListener('keydown', handleKeyPress); // Remove key listener
    };

    document.getElementById('editor-back-btn').onclick = () => showFlashcardScreen('study-screen');
    document.getElementById('list-view-btn').onclick = showListView;
    elements.editSaveBtn.onclick = handleEditSave;

    if (elements.flashcard) {
        elements.flashcard.addEventListener('touchstart', handleTouchStart, { passive: false });
        elements.flashcard.addEventListener('touchmove', handleTouchMove, { passive: false });
        elements.flashcard.addEventListener('touchend', handleTouchEnd);
    }
}

function showFlashcardScreen(screenId){document.querySelectorAll("#file-content-display .screen").forEach(e=>e.classList.remove("active")),document.getElementById(`flashcard-${screenId}`).classList.add("active")}
function handleKeyPress(e){if(document.getElementById("flashcard-study-screen")?.classList.contains("active"))switch(e.key){case"ArrowLeft":e.preventDefault(),handleSwipeLeft();break;case"ArrowRight":e.preventDefault(),handleSwipeRight();break;case"ArrowDown":case" ":e.preventDefault(),flipCard()}}
function handleTouchStart(e){touchStartX=e.changedTouches[0].screenX,touchStartY=e.changedTouches[0].screenY,flashcardElements.flashcard.classList.remove("is-flipping")}
function handleTouchMove(e){e.preventDefault();const t=e.changedTouches[0].screenX-touchStartX;isFlipped?flashcardElements.flashcard.style.transform=`rotateY(180deg) translateX(${-t}px)`:flashcardElements.flashcard.style.transform=`translateX(${t}px)`}
function handleTouchEnd(e){touchEndX=e.changedTouches[0].screenX,touchEndY=e.changedTouches[0].screenY,handleSwipe()}
function handleSwipe(){const e=touchEndX-touchStartX,t=touchEndY-touchStartY;Math.abs(e)>swipeThreshold&&Math.abs(e)>Math.abs(t)?e<0?handleSwipeLeft():handleSwipeRight():Math.abs(e)<10&&Math.abs(t)<10?flipCard():resetCardPosition()}
function handleSwipeLeft(){isFlipped?flipCard():markIncorrect()}
function handleSwipeRight(){isFlipped?markCorrect():flipCard()}
function flipCard(){isFlipped=!isFlipped,flashcardElements.flashcard.classList.add("is-flipping"),flashcardElements.flashcard.style.transform="",flashcardElements.flashcard.classList.toggle("is-flipped",isFlipped),clearTimeout(smartSuggestionTimeout),hideSmartSuggestion()}
function resetCardPosition(){flashcardElements.flashcard.classList.add("is-flipping"),flashcardElements.flashcard.style.transform="",isFlipped&&flashcardElements.flashcard.classList.add("is-flipped")}
function animateCardOut(e){flashcardElements.flashcard.classList.add("is-flipping");const t="left"===e?"-150%":"150%";isFlipped?flashcardElements.flashcard.style.transform=`rotateY(180deg) translateX(${-t})`:flashcardElements.flashcard.style.transform=`translateX(${t})`}
function nextCard(){setTimeout(()=>{if(0===currentDeck.length)return flashcardElements.cardFront.textContent="Deck complete!",void(flashcardElements.cardBack.textContent="Great job!");currentDeck.sort((e,t)=>(e.score||0)-(t.score||0)),currentCardIndex=0,displayCard()},250)}
function displayCard(){isFlipped=!1,flashcardElements.flashcard.classList.remove("is-flipping","is-flipped"),flashcardElements.flashcard.style.transform="translateX(0)";const e=currentDeck[currentCardIndex];flashcardElements.cardFront.textContent=e.question,flashcardElements.cardBack.textContent=e.answer,flashcardElements.cardCounter.textContent=`${currentCardIndex+1} / ${currentDeck.length}`,clearTimeout(smartSuggestionTimeout),smartSuggestionTimeout=setTimeout(()=>showSmartSuggestion("You've been on this card for a while, take a break?"),15e3),e.answer&&e.answer.length>150&&showSmartSuggestion("The answer may be too long and cause difficulty.")}
function markCorrect(){currentCardIndex>-1&&(currentDeck[currentCardIndex].score=(currentDeck[currentCardIndex].score||0)+1,saveDeckProgress(),animateCardOut("right"),nextCard())}
function markIncorrect(){currentCardIndex>-1&&(currentDeck[currentCardIndex].score=Math.max(0,(currentDeck[currentCardIndex].score||0)-1),saveDeckProgress(),animateCardOut("left"),nextCard())}
async function saveFileContent(e,t){try{const o=new FormData;o.append("metadata",new Blob([JSON.stringify({name:currentDeckFile.name,mimeType:"application/json"})],{type:"application/json"})),o.append("file",new Blob([t],{type:"application/json"}));const s=await fetch(`https://www.googleapis.com/upload/drive/v3/files/${e}?uploadType=multipart`,{method:"PATCH",headers:new Headers({Authorization:`Bearer ${gapi.client.getToken().access_token}`}),body:o});if(!s.ok){const c=await s.text();throw new Error(`HTTP error! status: ${s.status}. Details: ${c}`)}console.log("Deck progress saved successfully.")}catch(n){console.error("Error saving file content:",n)}}
function saveDeckProgress(){currentDeckFile&&saveFileContent(currentDeckFile.id,JSON.stringify(currentDeck,null,2))}
function showListView(){showFlashcardScreen("editor-screen"),isEditorReadOnly=!0,flashcardElements.editor.setAttribute("readonly",!0),flashcardElements.editSaveBtn.textContent="Edit";const e=[...currentDeck].sort((e,t)=>(e.score||0)-(t.score||0));flashcardElements.editorTitle.textContent=currentDeckFile?currentDeckFile.name:"Card List",flashcardElements.editor.value=JSON.stringify(e,null,2)}
function handleEditSave(){if(isEditorReadOnly){if(!currentDeckFile)return void alert("Editing is disabled in this view.");isEditorReadOnly=!1,flashcardElements.editor.removeAttribute("readonly"),flashcardElements.editSaveBtn.textContent="Save",flashcardElements.editorTitle.textContent=`Editing ${currentDeckFile.name}`,flashcardElements.editor.focus()}else{isEditorReadOnly=!0,flashcardElements.editor.setAttribute("readonly",!0),flashcardElements.editSaveBtn.textContent="Edit",flashcardElements.editorTitle.textContent=currentDeckFile.name;try{const e=JSON.parse(flashcardElements.editor.value);currentDeck=e.map(e=>({...e,score:currentDeck.find(t=>t.question===e.question)?.score||e.score||0})),saveDeckProgress(),alert("Deck saved!")}catch(t){alert(`Invalid JSON: ${t.message}`),isEditorReadOnly=!1,flashcardElements.editor.removeAttribute("readonly"),flashcardElements.editSaveBtn.textContent="Save",flashcardElements.editorTitle.textContent=`Editing ${currentDeckFile.name}`}}}
function showSmartSuggestion(e){flashcardElements.smartSuggestion.textContent=e,flashcardElements.smartSuggestion.style.display="block",setTimeout(hideSmartSuggestion,5e3)}
function hideSmartSuggestion(){flashcardElements.smartSuggestion&&(flashcardElements.smartSuggestion.style.display="none")}
async function fetchAsset(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to load asset: ${url}. Status: ${response.status}`);
    }
    return response.text();
}

// --- Main Viewer Function (MODIFIED) ---

async function viewAsFlashcards(file) {
    contentDisplay.innerHTML = `<h1>Loading Flashcard Viewer...</h1>`;
    
    let htmlContent, cssContent;
    try {
        [htmlContent, cssContent] = await Promise.all([
            fetchAsset('flashcards/flashcards.html'),
            fetchAsset('flashcards/flashcards.css')
        ]);
    } catch (err) {
        contentDisplay.innerHTML = `<h1>Error: Could not load viewer assets.</h1><p>${err.message}</p>`;
        return;
    }

    // --- START of FIX ---
    // 1. Clean up any previous flashcard styles first
    const oldStyle = document.getElementById('flashcard-styles');
    if (oldStyle) {
        oldStyle.remove();
    }

    // 2. Create a new <style> element and append it to the document's head
    const styleElement = document.createElement('style');
    styleElement.id = 'flashcard-styles'; // Give it an ID for easy removal later
    styleElement.textContent = cssContent;
    document.head.appendChild(styleElement);

    // 3. Inject only the HTML into the contentDisplay
    contentDisplay.innerHTML = htmlContent;
    // --- END of FIX ---

    // 4. Continue witch existing logic to fetch deck data and initialize the viewer
    try {
        currentDeck = [];
        currentDeckFile = file;
        
        const content = await fetchFileContent(file);
        
        let data;
        try {
            data = JSON.parse(content);
        } catch(e) {
            data = [{
                question: "Error: Invalid JSON format.",
                answer: "Please tap List/Edit to correct the file format.",
                score: 0
            }];
            console.warn("Flashcard file content is not valid JSON.");
        }
        
        currentDeck = data.map(card => ({
            ...card,
            score: card.score || 0
        }));

        if (!getFlashcardElements()) throw new Error("Flashcard UI failed to load.");
        attachFlashcardListeners(file);
        document.addEventListener('keydown', handleKeyPress);
        
        if (currentDeck.length > 0) {
            nextCard();
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