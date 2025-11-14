# ContactOSINT - GitHub Pages Edition

This is a client-side contact management and OSINT application that uses your Google Drive as its database.

## **CRITICAL: Google API Setup**

Your application will not work without these steps.

1.  **Go to the Google Cloud Console:** [https://console.cloud.google.com/](https://console.cloud.google.com/)
2.  **Create a new project** (e.g., "ContactOSINT").
3.  **Enable APIs:**
    *   Go to "APIs & Services" > "Enabled APIs & services".
    *   Click "+ ENABLE APIS AND SERVICES".
    *   Search for and enable the **Google Drive API**.
4.  **Configure OAuth Consent Screen:**
    *   Go to "APIs & Services" > "OAuth consent screen".
    *   Choose **External** and click "Create".
    *   Fill out the required fields (App name, support email, developer contact).
    *   On the "Scopes" page, click "ADD OR REMOVE SCOPES". Search for `.../auth/drive.file` and add it. This scope allows the app to access only files it creates or that you open with it.
    *   Add your own Google account email as a **Test user**.
5.  **Create Credentials:**
    *   Go to "APIs & Services" > "Credentials".
    *   Click "+ CREATE CREDENTIALS" > **OAuth client ID**.
    *   **Application type:** Web application.
    *   **Authorized JavaScript origins:** This is the most important step for avoiding CORS errors. Add the exact addresses where you will run the app.
        *   `https://<YOUR-GITHUB-USERNAME>.github.io` (for your live site)
        *   `http://localhost` (for local testing)
        *   `http://127.0.0.1:5500` (or whatever port you use locally)
    *   **Authorized redirect URIs:** Add the same addresses here.
    *   Click "CREATE".
6.  **Copy your Client ID.**

## **Application Configuration**

1.  Open the `index.html` file.
2.  Find the `const CLIENT_ID = ...` line at the bottom.
3.  Paste your copied Client ID into the quotes.