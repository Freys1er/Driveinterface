/*
 * =================================================================
 * NEW AUTHENTICATION SCRIPT (using Google Identity Services)
 * This script handles all authentication logic.
 * It does NOT require a separate API Key.
 * =================================================================
 */

// --- CONFIGURATION ---
// PASTE YOUR OAUTH CLIENT ID HERE
const CLIENT_ID = '490934668566-dpcfvk9p5kfpk44ko8v1gl3d5i9f83qr.apps.googleusercontent.com';

const SCOPES = 'https://www.googleapis.com/auth/drive.file';
const TOKEN_STORAGE_KEY = 'drive-notes-app-token'; // Must match the key in osint/js/app.js

let tokenClient;
let gapiInited = false;
let gisInited = false;

const loginScreen = document.getElementById('login-screen');
const appScreen = document.getElementById('app-container'); // This might be null, handled gracefully

/**
 * Callback after the GAPI client library has loaded.
 */
function gapiLoaded() {
    gapi.load('client', initializeGapiClient);
}

/**
 * Initializes the GAPI client.
 */
async function initializeGapiClient() {
    await gapi.client.init({
        discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
    });
    gapiInited = true;
    checkAuth();
}

/**
 * Callback after the GIS library has loaded.
 */
function gisLoaded() {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: tokenCallback, // Function to call after user grants consent
    });
    gisInited = true;
    checkAuth();
}

/**
 * The core function that is called when either library finishes loading.
 * It checks for an existing token and updates the UI.
 */
function checkAuth() {
    // Wait until both libraries are ready
    if (!gapiInited || !gisInited) {
        return;
    }

    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (token) {
        // If a token exists, apply it to the gapi client
        gapi.client.setToken(JSON.parse(token));
        // Redirect to the dashboard, which will validate the token
        window.location.replace('./osint/pages/dashboard.html');
    } else {
        // If no token, ensure the login screen is visible
        if(loginScreen) loginScreen.classList.remove('hidden');
        if(appScreen) appScreen.classList.add('hidden');
    }
}

/**
 * Callback function that receives the auth token from Google.
 * @param {object} response The token response from Google.
 */
function tokenCallback(response) {
    if (response.error) {
        console.error("Token Error:", response.error);
        alert('Authentication failed. Please try again.');
        return;
    }
    // Store the token and redirect to the dashboard
    localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(response));
    window.location.replace('./osint/pages/dashboard.html');
}

/**
 * Called when the user clicks the "Sign In" button.
 * It requests a new token from Google.
 */
function handleAuthClick() {
    if (gapiInited && gisInited) {
        tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
        alert("Authentication libraries are still loading. Please wait a moment and try again.");
    }
}

/**
 * Global sign-out function for other pages to call.
 */
function handleSignoutClick() {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (token) {
        const parsedToken = JSON.parse(token);
        google.accounts.oauth2.revoke(parsedToken.access_token, () => {
            console.log('Token revoked.');
        });
        gapi.client.setToken(null);
        localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
    // Redirect to the main login page (index.html)
    window.location.href = '/';
}