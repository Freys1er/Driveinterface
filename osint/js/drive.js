// js/drive.js (with extensive logging)

const Drive = (() => {
    const OSINT_FOLDER_NAME = 'OSINT';
    const CONTACTS_FILE_NAME = 'contacts.json';
    let osintFolderId = null;
    let contactsFileId = null;

    async function findOrCreateFolder(name) {
        console.log(`[Drive] Searching for folder: '${name}'...`);
        const query = `mimeType='application/vnd.google-apps.folder' and name='${name}' and 'root' in parents and trashed=false`;
        const response = await gapi.client.drive.files.list({ q: query, fields: 'files(id)' });
        if (response.result.files && response.result.files.length > 0) {
            const foundId = response.result.files[0].id;
            console.log(`[Drive] Found folder '${name}' with ID: ${foundId}`);
            return foundId;
        } else {
            console.log(`[Drive] Folder '${name}' not found. Creating it...`);
            const fileMetadata = { name: name, mimeType: 'application/vnd.google-apps.folder' };
            const createResponse = await gapi.client.drive.files.create({ resource: fileMetadata, fields: 'id' });
            const newId = createResponse.result.id;
            console.log(`[Drive] Created folder '${name}' with ID: ${newId}`);
            return newId;
        }
    }

    async function setupFolders() {
        if (osintFolderId) {
            console.log('[Drive] setupFolders: Already initialized.');
            return;
        }
        console.log('[Drive] Setting up OSINT folder...');
        osintFolderId = await findOrCreateFolder(OSINT_FOLDER_NAME);
    }

    async function getContacts() {
        try {
            await setupFolders();
            console.log(`[Drive] Searching for '${CONTACTS_FILE_NAME}' in folder ID: ${osintFolderId}`);
            const query = `'${osintFolderId}' in parents and name='${CONTACTS_FILE_NAME}' and trashed=false`;
            const response = await gapi.client.drive.files.list({ q: query, fields: 'files(id)' });

            if (response.result.files && response.result.files.length > 0) {
                contactsFileId = response.result.files[0].id;
                console.log(`[Drive] Found '${CONTACTS_FILE_NAME}' with ID: ${contactsFileId}. Fetching content...`);
                const fileContent = await gapi.client.drive.files.get({ fileId: contactsFileId, alt: 'media' });
                console.log('[Drive] File content fetched. Attempting to parse JSON.');
                const parsedData = fileContent.body ? JSON.parse(fileContent.body) : [];
                console.log('[Drive] JSON parsed successfully. Returning data.');
                return parsedData;
            } else {
                console.warn(`[Drive] '${CONTACTS_FILE_NAME}' not found. Returning empty array.`);
                contactsFileId = null;
                return [];
            }
        } catch (error) {
            console.error('[Drive] FATAL ERROR in getContacts:', error);
            return [];
        }
    }

    async function saveContacts(contactsArray) {
        try {
            await setupFolders();
            console.log('[Drive] saveContacts called. Preparing to save...');
            const contactBlob = new Blob([JSON.stringify(contactsArray, null, 2)], { type: 'application/json' });

            if (contactsFileId) {
                console.log(`[Drive] Updating existing file with ID: ${contactsFileId}`);
                await gapi.client.request({
                    path: `/upload/drive/v3/files/${contactsFileId}`,
                    method: 'PATCH',
                    params: { uploadType: 'media' },
                    body: contactBlob,
                });
                console.log(`[Drive] UPDATE successful.`);
            } else {
                console.log(`[Drive] Creating new file in folder ID: ${osintFolderId}`);
                const fileMetadata = {
                    'name': CONTACTS_FILE_NAME,
                    'mimeType': 'application/json',
                    'parents': [osintFolderId]
                };
                const form = new FormData();
                form.append('metadata', new Blob([JSON.stringify(fileMetadata)], { type: 'application/json' }));
                form.append('file', contactBlob);

                const response = await gapi.client.request({
                    path: 'https://www.googleapis.com/upload/drive/v3/files',
                    method: 'POST',
                    params: { uploadType: 'multipart' },
                    body: form
                });
                contactsFileId = response.result.id;
                console.log(`[Drive] CREATE successful! New file ID: ${contactsFileId}`);
            }
            return { success: true };
        } catch (error) {
            console.error('[Drive] FATAL ERROR in saveContacts:', error);
            return { success: false, error: error };
        }
    }

    return { getContacts, saveContacts };
})();