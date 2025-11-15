// osint/js/drive.js

const Drive = (() => {
    const OSINT_FOLDER = 'OSINT_Contacts';
    const CONTACTS_FILE = 'contacts.json';
    let folderIdCache = null; // Use a simple cache to avoid repeated folder lookups

    /**
     * Finds the app's folder, creating it if it doesn't exist.
     * Caches the result for the session.
     */
    const findOrCreateFolder = async () => {
        if (folderIdCache) return folderIdCache;

        const query = `mimeType='application/vnd.google-apps.folder' and name='${OSINT_FOLDER}' and trashed=false`;
        const response = await gapi.client.drive.files.list({
            q: query,
            fields: 'files(id)'
        });

        if (response.result.files && response.result.files.length > 0) {
            folderIdCache = response.result.files[0].id;
            return folderIdCache;
        } else {
            const folderMetadata = {
                name: OSINT_FOLDER,
                mimeType: 'application/vnd.google-apps.folder'
            };
            const createResponse = await gapi.client.drive.files.create({
                resource: folderMetadata,
                fields: 'id'
            });
            folderIdCache = createResponse.result.id;
            return folderIdCache;
        }
    };

    /**
     * Fetches the contacts.json file from Google Drive.
     * Returns an empty array if the file is not found.
     */
    const getContacts = async () => {
        try {
            const parentFolderId = await findOrCreateFolder();
            const query = `'${parentFolderId}' in parents and name='${CONTACTS_FILE}' and trashed=false`;
            const response = await gapi.client.drive.files.list({
                q: query,
                fields: 'files(id)'
            });

            if (response.result.files.length === 0) {
                return { data: [], error: null }; // No file exists yet, return empty array.
            }

            const fileId = response.result.files[0].id;
            const fileContentResponse = await gapi.client.drive.files.get({
                fileId: fileId,
                alt: 'media'
            });

            // Handle cases where the file might be empty
            const data = fileContentResponse.body ? JSON.parse(fileContentResponse.body) : [];
            return { data: data, error: null };

        } catch (error) {
            console.error("DRIVE ERROR (getContacts):", error);
            return { data: [], error: error };
        }
    };

    /**
     * Saves the contact list to contacts.json in Google Drive.
     * This function now uses the robust FETCH API for uploads.
     */
    const saveContacts = async (contactsArray) => {
        try {
            const parentFolderId = await findOrCreateFolder();
            const content = JSON.stringify(contactsArray, null, 2);

            // KEY CHANGE: We need the auth token to use fetch directly.
            const token = gapi.client.getToken().access_token;
            if (!token) {
                throw new Error("Authentication token not found.");
            }
            const authHeader = `Bearer ${token}`;

            // First, check if the file already exists.
            const query = `'${parentFolderId}' in parents and name='${CONTACTS_FILE}' and trashed=false`;
            const listResponse = await gapi.client.drive.files.list({ q: query, fields: 'files(id)' });
            
            let response;
            if (listResponse.result.files.length > 0) {
                // --- UPDATE (PATCH) an existing file ---
                const fileId = listResponse.result.files[0].id;
                const uploadUrl = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`;
                
                response = await fetch(uploadUrl, {
                    method: 'PATCH',
                    headers: {
                        'Authorization': authHeader,
                        'Content-Type': 'application/json'
                    },
                    body: content
                });

            } else {
                // --- CREATE a new file ---
                const metadata = {
                    name: CONTACTS_FILE,
                    parents: [parentFolderId],
                    mimeType: 'application/json'
                };
                
                const form = new FormData();
                form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
                form.append('file', new Blob([content], { type: 'application/json' }));

                const createUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
                
                response = await fetch(createUrl, {
                    method: 'POST',
                    headers: {
                        'Authorization': authHeader
                    },
                    body: form
                });
            }

            if (!response.ok) {
                // If the fetch request itself failed, throw an error with the details.
                const errorBody = await response.json();
                console.error("Google Drive API Save Error:", errorBody);
                throw new Error(`Failed to save file: ${errorBody.error.message}`);
            }

            return { success: true, error: null };

        } catch (error) {
            // This will now catch both network errors and API errors.
            console.error("DRIVE ERROR (saveContacts):", error);
            return { success: false, error: error };
        }
    };

    return { getContacts, saveContacts };
})();