// --- EVENT LISTENERS ---
document.getElementById('signout-button').addEventListener('click', () => {
    localStorage.removeItem(App.TOKEN_STORAGE_KEY);
    window.location.href = '/';
});

/**
 * Page-specific logic for the dashboard.
 */
async function runPageLogic() {
    console.log("DASHBOARD_JS_DEBUG: Running page logic.");
    // No need to load contacts again if not necessary for the view, but we will for the count
    await App.loadContacts(); 
    const contacts = App.getContacts();
    document.getElementById('contact-count').textContent = contacts.length;
    console.log("DASHBOARD_JS_DEBUG: Contact count updated.");
}

/**
 * Main bootstrap function that orchestrates the page load.
 */
async function initializeAndRun() {
    console.log("DASHBOARD_JS_DEBUG: GAPI client loaded. Initializing...");
    try {
        await gapi.client.init({
            discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
        });
        console.log("DASHBOARD_JS_DEBUG: GAPI client initialized.");
        
        const isAuthenticated = await App.initializeAndAuth();
        if (isAuthenticated) {
            console.log("DASHBOARD_JS_DEBUG: Authentication successful.");
            runPageLogic();
        }
    } catch (error) {
        console.error("DASHBOARD_JS_DEBUG: Initialization or Auth Error:", error);
        document.getElementById('page-content').innerHTML = `<h1>Error</h1><p>Could not initialize the application.</p><a href="/">Return to Login</a>`;
    }
}

/**
 * This function is the official entry point, called by the Google API script
 * once it has finished loading.
 */
function gapiLoaded() {
    console.log("DASHBOARD_JS_DEBUG: Google API script has loaded. Loading GAPI client...");
    gapi.load('client', initializeAndRun);
}