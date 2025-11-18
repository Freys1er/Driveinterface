// --- EVENT LISTENERS ---
document.getElementById('signout-button').addEventListener('click', () => {
    localStorage.removeItem(App.TOKEN_STORAGE_KEY);
    window.location.href = '/';
});

/**
 * Contains the logic specific to the contact.html page.
 */
function runPageLogic() {
    const container = document.getElementById('contact-container');
    const urlParams = new URLSearchParams(window.location.search);
    const contactId = urlParams.get('id');
    const isNew = urlParams.has('new');
    const isEdit = urlParams.has('edit');
    const allContacts = App.getContacts();
    let contactData = contactId ? allContacts.find(c => c.id === contactId) : null;

    if (isNew) {
        renderForm({});
    } else if (isEdit && contactData) {
        renderForm(contactData);
    } else if (contactData) {
        renderView(contactData);
    } else {
        container.innerHTML = `<h2>Contact Not Found</h2><a href="list.html" class="btn">Back to List</a>`;
    }

    /**
     * Renders the read-only view of a contact.
     */
    function renderView(contact) {
        // ... (This function is unchanged and correct)
        const notes = Array.isArray(contact.notes) ? contact.notes : [];
        let notesHtml = '<p>No structured notes.</p>';
        if (notes.length > 0) {
            notesHtml = `<ul class="notes-view-list">` + notes.map(note => 
                `<li class="notes-view-item"><strong>${note.key || 'N/A'}:</strong> ${note.value || 'N/A'}</li>`
            ).join('') + `</ul>`;
        }
        const relations = Array.isArray(contact.relations) ? contact.relations : [];
        let relationsHtml = '<p>No relationships defined.</p>';
        if (relations.length > 0) {
            relationsHtml = `<ul class="relations-view-list">` + relations.map(rel => {
                const target = allContacts.find(c => c.id === rel.contactId);
                const targetName = target ? `${target.firstName || ''} ${target.lastName || ''}`.trim() : `Unknown Contact (${rel.contactId})`;
                const strength = (rel.weight || 0) * 100;
                return `
                    <li class="relation-view-item" style="border-left: 5px solid ${rel.color || '#444'};">
                        <strong>${targetName}</strong> - <em>${rel.note || 'No description'}</em>
                        <div>Strength: ${strength}%></div>
                    </li>`;
            }).join('') + `</ul>`;
        }
        container.innerHTML = `
            <h2>${contact.firstName || ''} ${contact.lastName || ''}</h2>
            <h4>Structured Notes</h4>
            ${notesHtml}
            <div class="relations-section">
                <h3>Relationships</h3>
                ${relationsHtml}
            </div>
            <div class="btn-bar">
                <a href="contact.html?edit=true&id=${contact.id}" class="btn">Edit</a>
                <a href="list.html" class="btn" style="background-color:#555;">Back to List</a>
            </div>
        `;
    }

    /**
     * Renders the form for creating or editing a contact.
     */
    function renderForm(contact) {
        // Create deep copies to avoid mutation issues
        let currentNotes = Array.isArray(contact.notes) ? JSON.parse(JSON.stringify(contact.notes)) : [];
        let currentRelations = Array.isArray(contact.relations) ? JSON.parse(JSON.stringify(contact.relations)) : [];
        const otherContacts = allContacts.filter(c => c.id !== contact.id);

        container.innerHTML = `
            <h2>${contact.id ? 'Edit Contact' : 'Add New Contact'}</h2>
            <form id="contactForm" class="contact-form">
                <div class="form-group"><label for="firstName">First Name</label><input type="text" id="firstName" value="${contact.firstName || ''}"></div>
                <div class="form-group"><label for="lastName">Last Name</label><input type="text" id="lastName" value="${contact.lastName || ''}"></div>
                
                <div class="form-group">
                    <label>Structured Notes</label>
                    <div id="notes-kv-container" class="notes-kv-container"></div>
                    <button type="button" id="btn-add-note" class="btn">Add Pair</button>
                </div>

                <div class="relations-section">
                    <h3>Relationships</h3>
                    <div id="relations-list-container"></div>
                    <button type="button" id="btn-add-relation" class="btn">Add Relationship</button>
                    ${otherContacts.length > 0 ? `
                    <div class="contact-id-reference">
                        <h5>Existing Contact IDs</h5>
                        <ul>${otherContacts.map(c => `<li>${c.firstName} ${c.lastName}: <code>${c.id}</code></li>`).join('')}</ul>
                    </div>
                    ` : ''}
                </div>
                
                <div class="btn-bar">
                    <button type="submit" class="btn">Save</button>
                    <a href="list.html" class="btn" style="background-color:#555;">Cancel</a>
                </div>
            </form>
        `;

        const notesContainer = document.getElementById('notes-kv-container');
        const relationsContainer = document.getElementById('relations-list-container');

        // --- RENDER FUNCTIONS (Generate HTML from JS arrays) ---
        function renderNotesInputs() {
            notesContainer.innerHTML = currentNotes.map((note, index) => `
                <div class="notes-kv-pair" data-index="${index}">
                    <input type="text" class="key-input" placeholder="Key (e.g., Email)" value="${note.key || ''}">
                    <input type="text" class="value-input" placeholder="Value" value="${note.value || ''}">
                    <button type="button" class="btn-delete-item" data-type="note" data-index="${index}">X</button>
                </div>
            `).join('');
        }

        function renderRelationsInputs() {
            relationsContainer.innerHTML = currentRelations.map((rel, index) => `
                <div class="relationship-form-grid" data-index="${index}" style="padding: 1rem; border: 1px solid var(--border-color); border-radius: 5px; margin-bottom: 1rem;">
                    <div class="form-group"><label>Contact ID</label><input type="text" class="relation-id-input" placeholder="C123456789" value="${rel.contactId || ''}"></div>
                    <div class="form-group"><label>Note / Type</label><input type="text" class="relation-note-input" placeholder="e.g., Colleague" value="${rel.note || ''}"></div>
                    <div class="form-group-slider">
                        <label>Strength: <span class="relation-weight-value">${rel.weight || 0.5}</span></label>
                        <input type="range" class="relation-weight-input" min="0" max="1" step="0.1" value="${rel.weight || 0.5}">
                    </div>
                    <div class="form-group">
                        <label>Color</label>
                        <select class="relation-color-select">
                            <option value="#3498db" ${rel.color === '#3498db' ? 'selected' : ''}>Blue</option>
                            <option value="#2ecc71" ${rel.color === '#2ecc71' ? 'selected' : ''}>Green</option>
                            <option value="#f1c40f" ${rel.color === '#f1c40f' ? 'selected' : ''}>Yellow</option>
                            <option value="#e67e22" ${rel.color === '#e67e22' ? 'selected' : ''}>Orange</option>
                            <option value="#e74c3c" ${rel.color === '#e74c3c' ? 'selected' : ''}>Red</option>
                            <option value="#9b59b6" ${rel.color === '#9b59b6' ? 'selected' : ''}>Purple</option>
                        </select>
                    </div>
                    <button type="button" class="btn-delete-item" data-type="relation" data-index="${index}">Remove This Relationship</button>
                </div>
            `).join('');
        }

        // --- EVENT LISTENERS (Update JS arrays on user input) ---
        document.getElementById('btn-add-note').addEventListener('click', () => {
            currentNotes.push({ key: '', value: '' });
            renderNotesInputs();
        });

        document.getElementById('btn-add-relation').addEventListener('click', () => {
            currentRelations.push({ contactId: '', note: '', weight: '0.5', color: '#3498db' });
            renderRelationsInputs();
        });

        notesContainer.addEventListener('input', e => {
            const target = e.target;
            const parent = target.closest('.notes-kv-pair');
            if (!parent) return;
            const index = parseInt(parent.dataset.index, 10);
            currentNotes[index] = {
                key: parent.querySelector('.key-input').value,
                value: parent.querySelector('.value-input').value
            };
            console.log("NOTES_DEBUG: Updated notes array:", currentNotes);
        });

        relationsContainer.addEventListener('input', e => {
            const target = e.target;
            const parent = target.closest('.relationship-form-grid');
            if (!parent) return;
            const index = parseInt(parent.dataset.index, 10);
            const weightValueEl = parent.querySelector('.relation-weight-value');
            const weightInputEl = parent.querySelector('.relation-weight-input');
            if (target.matches('.relation-weight-input')) {
                weightValueEl.textContent = target.value;
            }
            currentRelations[index] = {
                contactId: parent.querySelector('.relation-id-input').value,
                note: parent.querySelector('.relation-note-input').value,
                weight: parent.querySelector('.relation-weight-input').value,
                color: parent.querySelector('.relation-color-select').value
            };
            console.log("RELATIONS_DEBUG: Updated relations array:", currentRelations);
        });
        
        // Universal delete button handler
        container.addEventListener('click', e => {
            if (e.target.classList.contains('btn-delete-item')) {
                const type = e.target.dataset.type;
                const index = parseInt(e.target.dataset.index, 10);
                if (type === 'note') {
                    currentNotes.splice(index, 1);
                    renderNotesInputs();
                } else if (type === 'relation') {
                    currentRelations.splice(index, 1);
                    renderRelationsInputs();
                }
            }
        });
        
        // --- SAVE LOGIC ---
        document.getElementById('contactForm').addEventListener('submit', e => {
            e.preventDefault();

            const savedData = {
                id: contact.id || 'C' + Date.now(),
                firstName: document.getElementById('firstName').value.trim(),
                lastName: document.getElementById('lastName').value.trim(),
                notes: currentNotes.filter(n => n.key && n.value),
                relations: currentRelations.filter(r => r.contactId && r.note)
            };

            console.log("CONTACT_JS_DEBUG: Final data object being saved:", JSON.stringify(savedData, null, 2));

            const updatedList = contact.id 
                ? allContacts.map(c => c.id === contact.id ? savedData : c) 
                : [...allContacts, savedData];
            
            App.saveContacts(updatedList);
        });

        // --- INITIAL RENDER ---
        renderNotesInputs();
        renderRelationsInputs();
    }
}

async function initializeAndRun() {
    try {
        await gapi.client.init({
            discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
        });
        const isAuthenticated = await App.initializeAndAuth();
        if (isAuthenticated) {
            await App.loadContacts();
            runPageLogic();
        }
    } catch (error) {
        console.error("Initialization or Authentication Error:", error);
        document.getElementById('page-content').innerHTML = `<h1>Error</h1><p>Could not initialize the application.</p><a href="/">Return to Login</a>`;
    }
}

function gapiLoaded() {
    gapi.load('client', initializeAndRun);
}