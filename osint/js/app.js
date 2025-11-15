// osint/js/app.js

const App = (() => {
    let contacts = [];

    const init = () => {
        Auth.init();
        Auth.onAuthChange(handleAuthStateChange);
        window.addEventListener('hashchange', renderPage);
        document.getElementById('signInButton').addEventListener('click', Auth.signIn);
        document.getElementById('signOutButton').addEventListener('click', Auth.signOut);
    };

    const handleAuthStateChange = async (isSignedIn) => {
        if (isSignedIn) {
            UI.showMainView();
            await loadContacts();
            renderPage();
        } else {
            contacts = [];
            UI.showAuthView();
        }
    };

    const loadContacts = async () => {
        UI.setLoading(true);
        const { data, error } = await Drive.getContacts();
        UI.setLoading(false);
        if (error) {
            console.error("Failed to load contacts:", error);
            alert('Could not load contacts from Google Drive.');
            return;
        }
        contacts = data;
    };

    const renderPage = () => {
        document.getElementById('page-content').innerHTML = '';
        
        // <<< FIX: Properly parse the hash to separate the page name from query parameters.
        const hash = window.location.hash.substring(1) || 'dashboard';
        const pageName = hash.split('?')[0]; // Get the part before the '?'

        UI.loadPage(pageName);
    };

    const getContacts = () => {
        return contacts ? [...contacts] : [];
    };

    const saveContacts = async (updatedContacts) => {
        UI.setLoading(true);
        const { success, error } = await Drive.saveContacts(updatedContacts);
        UI.setLoading(false);

        if (success) {
            contacts = updatedContacts;
            window.location.hash = 'list';
        } else {
            console.error("Failed to save contacts:", error);
            alert('Failed to save contacts.');
        }
    };

    return {
        init,
        getContacts,
        saveContacts
    };
})();

window.addEventListener('load', App.init);