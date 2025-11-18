// --- EVENT LISTENERS ---
document.getElementById('signout-button').addEventListener('click', () => {
    localStorage.removeItem(App.TOKEN_STORAGE_KEY);
    window.location.href = '/';
});

/**
 * Page-specific logic for rendering the contact list.
 */
async function runPageLogic() {
    console.log("LIST_JS_DEBUG: Running page logic.");
    await App.loadContacts();
    const contacts = App.getContacts();
    const container = document.getElementById('contacts-container');
    
    if (!contacts || contacts.length === 0) {
        container.innerHTML = '<p>No contacts found. Click "Add New Contact" to get started.</p>';
        return;
    }

    const sortedContacts = contacts.sort((a, b) => {
        const nameA = (a.firstName || '').toLowerCase();
        const nameB = (b.firstName || '').toLowerCase();
        if (nameA < nameB) return -1;
        if (nameA > nameB) return 1;
        return 0;
    });

    container.innerHTML = ''; // Clear loading message
    sortedContacts.forEach(contact => {
        const contactEl = document.createElement('a');
        contactEl.href = `contact.html?id=${contact.id}`;
        contactEl.className = 'contact-item';
        
        const displayName = (contact.firstName || contact.lastName) 
            ? `${contact.firstName || ''} ${contact.lastName || ''}`.trim() 
            : '[Unnamed Contact]';
            
        contactEl.textContent = displayName;
        container.appendChild(contactEl);
    });
    console.log(`LIST_JS_DEBUG: Rendered ${contacts.length} contacts.`);
}

/**
 * Main bootstrap function that orchestrates the page load.
 */
async function initializeAndRun() {
    console.log("LIST_JS_DEBUG: GAPI client loaded. Initializing...");
    try {
        await gapi.client.init({
            discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
        });
        console.log("LIST_JS_DEBUG: GAPI client initialized.");
        
        const isAuthenticated = await App.initializeAndAuth();
        if (isAuthenticated) {
            console.log("LIST_JS_DEBUG: Authentication successful.");
            runPageLogic();
        }
    } catch (error) {
        console.error("LIST_JS_DEBUG: Initialization or Auth Error:", error);
        document.getElementById('page-content').innerHTML = `<h1>Error</h1><p>Could not initialize the application.</p><a href="/">Return to Login</a>`;
    }
}

/**
 * This function is the official entry point, called by the Google API script
 * once it has finished loading.
 */
function gapiLoaded() {
    console.log("LIST_JS_DEBUG: Google API script has loaded. Loading GAPI client...");
    gapi.load('client', initializeAndRun);
}