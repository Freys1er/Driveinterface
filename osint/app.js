/**
 * ContactOSINT Application Core Logic (App Module)
 */
const App = (() => {
    const TOKEN_STORAGE_KEY = 'drive-notes-app-token';
    let contacts = []; 

    /**
     * Handles any authentication failure by clearing the invalid token and redirecting to the login page.
     * This is the new centralized function for handling 401 errors.
     */
    const handleAuthFailure = () => {
        console.error("APP_DEBUG: Authentication has failed. Clearing token and redirecting to login.");
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        alert('Your session has expired or is invalid. Please sign in again.');
        // Redirect to one directory level up, where the main login page is assumed to be.
        window.location.href = '../'; 
    };

    /**
     * Checks for a token and validates it with a lightweight API call.
     * @returns {Promise<boolean>} - Resolves true if authenticated, false otherwise.
     */
    const initializeAndAuth = () => {
        console.log("APP_DEBUG: Starting initializeAndAuth...");
        return new Promise(async (resolve) => {
            const tokenString = localStorage.getItem(TOKEN_STORAGE_KEY);
            if (!tokenString) {
                console.warn("APP_DEBUG: No token found. Forcing redirect.");
                handleAuthFailure(); // Use the centralized handler
                return resolve(false);
            }

            try {
                const token = JSON.parse(tokenString);
                gapi.client.setToken(token);
                console.log("APP_DEBUG: Token validation successful.");
                resolve(true);
            } catch (error) {
                console.error("APP_DEBUG: Token validation failed during initial check.", error);
                handleAuthFailure(); // Use the centralized handler
                resolve(false);
            }
        });
    };

    /**
     * Fetches contacts from Google Drive and caches them locally.
     */
    const loadContacts = async () => {
        console.log("APP_DEBUG: Attempting to load contacts from Drive...");
        const { data, error, authFailed } = await Drive.getContacts(); 
        
        // If the Drive module reports an auth failure, we stop everything.
        if (authFailed) return;

        if (error) {
            console.error("APP_DEBUG: Failed to load contacts from Drive module.", error);
            throw new Error("Failed to load contacts data from Drive.");
        }
        contacts = data || [];
        console.log(`APP_DEBUG: Successfully loaded and cached ${contacts.length} contacts.`);
    };

    const getContacts = () => {
        return contacts ? [...contacts] : [];
    };

    /**
     * Saves the updated contacts array back to Google Drive.
     */
    const saveContacts = async (updatedContacts) => {
        console.log(`APP_DEBUG: Attempting to save ${updatedContacts.length} contacts...`);
        const { success, error, authFailed } = await Drive.saveContacts(updatedContacts);
        
        if (authFailed) return;

        if (success) {
            console.log("APP_DEBUG: Save successful. Updating local cache and redirecting.");
            contacts = updatedContacts;
            window.location.href = 'list.html'; 
        } else {
            console.error("APP_DEBUG: Failed to save contacts via Drive module.", error);
            alert('Failed to save contacts. Check the console for more details.');
        }
    };

    return {
        initializeAndAuth,
        loadContacts,
        getContacts,
        saveContacts,
        TOKEN_STORAGE_KEY,
        handleAuthFailure // Expose the new handler
    };
})();