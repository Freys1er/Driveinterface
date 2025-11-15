const Auth = (() => {
    const CLIENT_ID = '490934668566-dpcfvk9p5kfpk44ko8v1gl3d5i9f83qr.apps.googleusercontent.com'; // Replace with your Client ID
    const SCOPES = 'https://www.googleapis.com/auth/drive.file';
    let tokenClient;
    let authCallback;

    const onAuthChange = (callback) => {
        authCallback = callback;
    };

    const init = () => {
        gapi.load('client', async () => {
            await gapi.client.init({
                discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
            });
        });

        tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID,
            scope: SCOPES,
            callback: (tokenResponse) => {
                if (tokenResponse.error) {
                    console.error('Authentication error:', tokenResponse.error);
                    authCallback(false);
                } else {
                    gapi.client.setToken(tokenResponse);
                    authCallback(true);
                }
            },
        });
    };

    const signIn = () => {
        tokenClient.requestAccessToken();
    };

    const signOut = () => {
        const token = gapi.client.getToken();
        if (token) {
            google.accounts.oauth2.revoke(token.access_token, () => {
                gapi.client.setToken('');
                authCallback(false);
            });
        }
    };

    return { onAuthChange, init, signIn, signOut };
})();