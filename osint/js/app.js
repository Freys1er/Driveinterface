
const App = (() => {
    // This key must match the one used in your main script.js
    const TOKEN_STORAGE_KEY = 'drive-notes-app-token';
    let contacts = [];

    /**
     * Checks for a token in localStorage, validates it with Google, and redirects if invalid.
     * This is the master authentication check for the entire OSINT section.
     * @returns {Promise<boolean>} - Resolves true if authenticated, false otherwise.
     */
    const initializeAndAuth = () => {
        return new Promise(async (resolve) => {
            const tokenString = localStorage.getItem(TOKEN_STORAGE_KEY);

            if (!tokenString) {
                // If no token exists at all, redirect to the main app's login.
                window.location.href = '/';
                return resolve(false);
            }

            try {
                const token = JSON.parse(tokenString);
                gapi.client.setToken(token);

                // Make a lightweight API call to verify the token is still valid.
                await gapi.client.drive.about.get({ fields: 'user' });

                // If the call succeeds, the token is valid.
                resolve(true);
            } catch (error) {
                // If the call fails (e.g., 401 error), the token is expired or invalid.
                console.error("Authentication validation failed:", error);
                
                // Remove the bad token and redirect to the main app to re-authenticate.
                localStorage.removeItem(TOKEN_STORAGE_KEY);
                window.location.href = '/';
                resolve(false);
            }
        });
    };

    const loadContacts = async () => {
        const { data, error } = await Drive.getContacts();
        if (error) {
            console.error("Failed to load contacts:", error);
            return;
        }
        contacts = data;
    };

    const getContacts = () => {
        return contacts ? [...contacts] : [];
    };

    const saveContacts = async (updatedContacts) => {
        const { success, error } = await Drive.saveContacts(updatedContacts);
        if (success) {
            contacts = updatedContacts;
            window.location.href = './list.html';
        } else {
            console.error("Failed to save contacts:", error);
            alert('Failed to save contacts.');
        }
    };

    return {
        initializeAndAuth,
        loadContacts,
        getContacts,
        saveContacts,
        TOKEN_STORAGE_KEY // Expose for signout button
    };
})();