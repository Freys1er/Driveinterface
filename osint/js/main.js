// js/main.js (with extensive logging)

const App = (() => {
    let contacts = null; // Start as null to clearly see if it's loaded

    function init() {
        console.log('[Main] App.init() called.');
        gapi.load('client', initializeGapiClient);
    }

    async function initializeGapiClient() {
        try {
            console.log('[Main] GAPI client loaded. Initializing for Drive API...');
            await gapi.client.init({
                discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
            });
            console.log('[Main] GAPI client for Drive ready. Initializing Auth module...');
            Auth.init(onAuthenticated, onSignedOut);
            document.getElementById('manual_signin_button').onclick = Auth.handleManualSignIn;
            document.getElementById('quick_signout_button').onclick = () => Auth.signOut(onSignedOut);
            console.log('[Main] Core initializations complete.');
        } catch (error) {
            console.error('[Main] FATAL ERROR during GAPI client initialization:', error);
            UI.showLoader('Critical Error: Could not initialize Google API. Check console.');
        }
    }

    async function onAuthenticated() {
        console.log('[Main] onAuthenticated callback received. Starting session...');
        UI.showApp();
        UI.showLoader('Initializing Session...');
        try {
            contacts = await Drive.getContacts();
            console.log('[Main] Contacts successfully loaded into memory:', contacts);
            router();
        } catch (error) {
            console.error("[Main] FATAL ERROR during post-authentication setup:", error);
            UI.showLoader('Error initializing session. Check console.');
        }
    }

    function onSignedOut() {
        console.log('[Main] onSignedOut callback received. Resetting UI.');
        contacts = null;
        UI.showAuthScreen();
    }

    function router() {
        const path = window.location.hash.substring(1).split('?')[0] || 'dashboard';
        console.log(`[Main-Router] Navigating to page: '${path}'`);
        UI.loadPage(path);
    }
    
    window.addEventListener('hashchange', router);
    window.navigateTo = (page) => window.location.hash = page;

    function getContacts() {
        console.log('[Main] getContacts() called. Returning:', contacts);
        return contacts ? [...contacts] : [];
    }
    
    async function saveContacts(updatedContactsList) {
        console.log('[Main] saveContacts() called with:', updatedContactsList);
        UI.showLoader('Saving to Google Drive...');
        const result = await Drive.saveContacts(updatedContactsList);
        if (result && result.success) {
            console.log('[Main] Save reported as successful. Updating in-memory contacts.');
            contacts = updatedContactsList;
            navigateTo('list');
        } else {
             console.error('[Main] Save FAILED. See Drive log for details.');
             alert('FATAL: Could not save contacts. Check the console.');
             navigateTo('dashboard');
        }
    }

    return { init, getContacts, saveContacts };
})();