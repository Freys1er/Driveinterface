// osint/js/drive.js

const Drive = (() => {
    const OSINT_FOLDER_NAME = 'OSINT_Contacts'; // *** CORRECTED FOLDER NAME ***
    const CONTACTS_FILE_NAME = 'contacts.json';
    let folderId = null;
    let fileId = null;

    const findOrCreateFolder = async () => {
        if (folderId) return folderId;
        try {
            const listResponse = await gapi.client.drive.files.list({
                q: `name='${OSINT_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and 'root' in parents and trashed=false`,
                fields: 'files(id)',
                spaces: 'drive'
            });
            const files = listResponse?.result?.files || [];
            if (files.length > 0) {
                folderId = files[0].id;
                return folderId;
            }
            // If the user's folder doesn't exist, we create it.
            const createResponse = await gapi.client.drive.files.create({
                resource: { name: OSINT_FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder', parents: ['root'] },
                fields: 'id'
            });
            folderId = createResponse.result.id;
            return folderId;
        } catch (error) {
            console.error("DRIVE ERROR (findOrCreateFolder):", error);
            return null;
        }
    };

    const getContacts = async () => {
        try {
            const parentFolderId = await findOrCreateFolder();
            if (!parentFolderId) throw new Error("Could not find or create the OSINT data folder.");

            const listResponse = await gapi.client.drive.files.list({
                q: `name='${CONTACTS_FILE_NAME}' and '${parentFolderId}' in parents and trashed=false`,
                fields: 'files(id)'
            });
            const files = listResponse?.result?.files || [];
            if (files.length === 0) {
                // This means the OSINT_Contacts folder exists, but the contacts.json file does not.
                return { data: [], error: null }; 
            }
            fileId = files[0].id;
            const fileContentResponse = await gapi.client.drive.files.get({ fileId: fileId, alt: 'media' });
            const contacts = fileContentResponse.result || [];
            return { data: Array.isArray(contacts) ? contacts : [], error: null };
        } catch (error) {
            console.error("DRIVE ERROR (getContacts):", error);
            return { data: null, error };
        }
    };

    const saveContacts = async (contacts) => {
        try {
            const parentFolderId = await findOrCreateFolder();
            if (!parentFolderId) throw new Error("Could not find or create the OSINT data folder.");

            const boundary = '-------314159265358979323846';
            const delimiter = "\r\n--" + boundary + "\r\n";
            const close_delim = "\r\n--" + boundary + "--";
            const metadata = { name: CONTACTS_FILE_NAME, mimeType: 'application/json' };
            const multipartRequestBody =
                delimiter + 'Content-Type: application/json\r\n\r\n' + JSON.stringify(metadata) +
                delimiter + 'Content-Type: application/json\r\n\r\n' + JSON.stringify(contacts, null, 2) +
                close_delim;

            let request;
            if (fileId) { // If file exists, update it
                request = gapi.client.request({
                    path: `/upload/drive/v3/files/${fileId}`,
                    method: 'PATCH',
                    params: { uploadType: 'multipart' },
                    headers: { 'Content-Type': 'multipart/related; boundary="' + boundary + '"' },
                    body: multipartRequestBody
                });
            } else { // Otherwise, create it inside the folder
                metadata.parents = [parentFolderId];
                request = gapi.client.request({
                    path: '/upload/drive/v3/files',
                    method: 'POST',
                    params: { uploadType: 'multipart' },
                    headers: { 'Content-Type': 'multipart/related; boundary="' + boundary + '"' },
                    body: multipartRequestBody
                });
            }
            
            await request;
            return { success: true, error: null };

        } catch (error) {
            console.error("DRIVE ERROR (saveContacts):", error);
            return { success: false, error };
        }
    };

    return { getContacts, saveContacts };
})();