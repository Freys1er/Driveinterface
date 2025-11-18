const Drive = (() => {
    const OSINT_FOLDER_NAME = 'OSINT_Contacts';
    const CONTACTS_FILE_NAME = 'contacts.json';
    let folderId = null;
    let fileId = null;

    const findOrCreateFolder = async () => {
        if (folderId) return folderId;
        try {
            console.log(`DRIVE_DEBUG: Searching for folder named '${OSINT_FOLDER_NAME}'...`);
            const listResponse = await gapi.client.drive.files.list({
                q: `name='${OSINT_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and 'root' in parents and trashed=false`,
                fields: 'files(id, name)',
                spaces: 'drive'
            });
            const files = listResponse?.result?.files || [];
            if (files.length > 0) {
                folderId = files[0].id;
                return folderId;
            }
            const createResponse = await gapi.client.drive.files.create({
                resource: { name: OSINT_FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder', parents: ['root'] },
                fields: 'id'
            });
            folderId = createResponse.result.id;
            return folderId;
        } catch (error) {
            // *** FIX: Centralized 401 error check ***
            if (error.status === 401) {
                App.handleAuthFailure();
                return null;
            }
            console.error("DRIVE_DEBUG: CRITICAL ERROR in findOrCreateFolder:", error);
            throw error; // Re-throw other errors
        }
    };

    const getContacts = async () => {
        try {
            console.log("DRIVE_DEBUG: Getting contacts file...");
            const parentFolderId = await findOrCreateFolder();
            if (!parentFolderId) throw new Error("Could not find or create the OSINT data folder.");

            const listResponse = await gapi.client.drive.files.list({
                q: `name='${CONTACTS_FILE_NAME}' and '${parentFolderId}' in parents and trashed=false`,
                fields: 'files(id)'
            });
            const files = listResponse?.result?.files || [];
            if (files.length === 0) {
                fileId = null;
                return { data: [], error: null }; 
            }
            fileId = files[0].id;
            const fileContentResponse = await gapi.client.drive.files.get({ fileId: fileId, alt: 'media' });
            const contacts = fileContentResponse.result || [];
            return { data: Array.isArray(contacts) ? contacts : [], error: null };
        } catch (error) {
            // *** FIX: Centralized 401 error check ***
            if (error.status === 401) {
                App.handleAuthFailure();
                return { data: null, error: error, authFailed: true };
            }
            console.error("DRIVE_DEBUG: CRITICAL ERROR in getContacts:", error);
            return { data: null, error: error };
        }
    };

    const saveContacts = async (contacts) => {
        try {
            console.log(`DRIVE_DEBUG: Saving ${contacts.length} contacts...`);
            const parentFolderId = await findOrCreateFolder();
            if (!parentFolderId) throw new Error("Could not find or create the OSINT data folder for saving.");
            
            // ... (rest of the multipart request setup is unchanged)
            const boundary = '-------314159265358979323846';
            const delimiter = "\r\n--" + boundary + "\r\n";
            const close_delim = "\r\n--" + boundary + "--";
            const metadata = { name: CONTACTS_FILE_NAME, mimeType: 'application/json' };
            const contactsJsonString = JSON.stringify(contacts, null, 2); 
            
            let response;
            if (fileId) {
                const path = `/upload/drive/v3/files/${fileId}?uploadType=multipart`;
                const multipartRequestBody = delimiter + 'Content-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify({}) + delimiter + 'Content-Type: application/json; charset=UTF-8\r\n\r\n' + contactsJsonString + close_delim;
                response = await gapi.client.request({ path: path, method: 'PATCH', headers: { 'Content-Type': 'multipart/related; boundary="' + boundary + '"' }, body: multipartRequestBody });
            } else {
                metadata.parents = [parentFolderId];
                const multipartRequestBody = delimiter + 'Content-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(metadata) + delimiter + 'Content-Type: application/json; charset=UTF-8\r\n\r\n' + contactsJsonString + close_delim;
                const path = `/upload/drive/v3/files?uploadType=multipart&fields=id`;
                response = await gapi.client.request({ path: path, method: 'POST', headers: { 'Content-Type': 'multipart/related; boundary="' + boundary + '"' }, body: multipartRequestBody });
                fileId = response.result.id;
            }
            return { success: true, error: null };
        } catch (error) {
            // *** FIX: Centralized 401 error check ***
            if (error.status === 401) {
                App.handleAuthFailure();
                return { success: false, error: error, authFailed: true };
            }
            console.error("DRIVE_DEBUG: CRITICAL ERROR in saveContacts:", error);
            const errorBody = error.result ? error.result.error : { message: "Unknown error" };
            alert(`Failed to save to Google Drive: ${errorBody.message}`);
            return { success: false, error: error };
        }
    };

    return { getContacts, saveContacts };
})();