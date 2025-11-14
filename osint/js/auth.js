// js/auth.js (with extensive logging)

const Auth = (() => {
    const SCOPES = 'https://www.googleapis.com/auth/drive.file';
    let tokenClient;

    function init(onAuthenticated, onSignedOut) {
        try {
            console.log('[Auth] Initializing token client...');
            tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: CLIENT_ID,
                scope: SCOPES,
                callback: (tokenResponse) => {
                    console.log('[Auth] Token client callback triggered.');
                    if (tokenResponse && tokenResponse.error) {
                        console.error("[Auth] Token response contained an error:", tokenResponse);
                        onSignedOut();
                        return;
                    }
                    console.log("[Auth] Successfully received token. Storing it.", tokenResponse);
                    gapi.client.setToken(tokenResponse);
                    onAuthenticated();
                }
            });
            console.log('[Auth] Token client initialized successfully.');
        } catch (error) {
            console.error('[Auth] FATAL ERROR during token client initialization:', error);
        }
    }

    function handleManualSignIn() {
        console.log("[Auth] handleManualSignIn() called.");
        if (tokenClient) {
            console.log("[Auth] Requesting access token popup...");
            tokenClient.requestAccessToken();
        } else {
            console.error("[Auth] CRITICAL: handleManualSignIn called but tokenClient is not initialized.");
            alert("Authentication system failed to load. Please refresh the page.");
        }
    }

    function signOut(onSignedOut) {
        console.log("[Auth] signOut() called.");
        const token = gapi.client.getToken();
        if (token !== null) {
            console.log("[Auth] Revoking existing token...");
            google.accounts.oauth2.revoke(token.access_token, () => {
                console.log("[Auth] Token successfully revoked.");
                gapi.client.setToken('');
                onSignedOut();
            });
        } else {
            console.log("[Auth] No token to revoke. Simply signing out.");
            onSignedOut();
        }
    }

    return { init, handleManualSignIn, signOut };
})();