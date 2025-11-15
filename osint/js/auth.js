/*
 * ====================================================================================
 * REFACTORED AUTH MODULE (Auth.js)
 * This module acts as a simple interface to the main authentication
 * logic contained in script.js. It does not perform any initialization itself.
 * ====================================================================================
 */
const Auth = (() => {
    let authChangeCallback = null;

    /**
     * Registers a callback function to run whenever the authentication status changes.
     * @param {function(boolean): void} callback - The function to call. It receives `true` if signed in, `false` otherwise.
     */
    const onAuthChange = (callback) => {
        authChangeCallback = callback;
    };

    /**
     * Triggers the sign-in process by calling the global function from script.js.
     */
    const signIn = () => {
        // This function must exist in the global scope of script.js
        if (window.handleAuthClick) {
            window.handleAuthClick();
        } else {
            console.error("Auth.signIn Error: global 'handleAuthClick' function not found.");
        }
    };

    /**
     * Triggers the sign-out process by calling the global function from script.js.
     */
    const signOut = () => {
        // This function must exist in the global scope of script.js
        if (window.handleSignoutClick) {
            window.handleSignoutClick();
        } else {
            console.error("Auth.signOut Error: global 'handleSignoutClick' function not found.");
        }
    };

    /**
     * (For internal use by script.js)
     * Notifies the registered callback about a change in authentication state.
     * @param {boolean} isSignedIn - The new authentication status.
     */
    const notifyStatusChange = (isSignedIn) => {
        if (authChangeCallback) {
            authChangeCallback(isSignedIn);
        }
    };

    // Expose the public methods
    return {
        onAuthChange,
        signIn,
        signOut,
        // Expose this method so script.js can call it
        notifyStatusChange
    };
})();

// Make the functions from script.js globally available for the Auth module if they are not already.
// This is generally not needed if script.js is loaded in the HTML before Auth.js
window.handleAuthClick = handleAuthClick;
window.handleSignoutClick = handleSignoutClick;