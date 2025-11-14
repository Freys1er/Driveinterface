// js/ui.js (Rewritten with a robust, browser-compliant page and script loader)

const UI = (() => {
    const pageContentEl = document.getElementById('page-content');
    const authScreenEl = document.getElementById('auth-screen');
    const appHeaderEl = document.getElementById('app-header');
    const scriptContainerEl = document.getElementById('script-container');

    async function loadPage(pageName) {
        console.log(`[UI] Loading page: '${pageName}.html'`);
        try {
            pageContentEl.style.display = 'block';
            pageContentEl.innerHTML = `<div class="loader">Loading ${pageName}...</div>`;

            const response = await fetch(`./pages/${pageName}.html`);
            if (!response.ok) {
                throw new Error(`Network request failed. Status: ${response.status}`);
            }
            const html = await response.text();
            console.log(`[UI] Page content for '${pageName}' fetched successfully.`);

            // --- THE DEFINITIVE FIX: A RELIABLE PARSING AND INJECTION METHOD ---
            
            // 1. Create an invisible, temporary container in memory.
            const tempContainer = document.createElement('div');
            tempContainer.innerHTML = html; // Let the browser parse the full HTML string.

            // 2. Find the script tag within the parsed content.
            const scriptTag = tempContainer.querySelector('script');
            let scriptContent = '';
            if (scriptTag) {
                scriptContent = scriptTag.textContent;
                // Remove the script from the container so it's not injected twice.
                scriptTag.remove();
            }

            // 3. Move the parsed HTML (without the script) to the visible page.
            // Because this is a direct node transfer, it's faster and more reliable.
            pageContentEl.innerHTML = ''; // Clear the "Loading..." message.
            // Move all children from the temp container to the page content element.
            while (tempContainer.firstChild) {
                pageContentEl.appendChild(tempContainer.firstChild);
            }

            // 4. Now that all HTML is guaranteed to be in the DOM, inject and run the script.
            scriptContainerEl.innerHTML = ''; // Clear old scripts.
            if (scriptContent) {
                console.log(`[UI] All HTML for '${pageName}' is in the DOM. Now executing script.`);
                const scriptEl = document.createElement('script');
                scriptEl.textContent = scriptContent;
                scriptContainerEl.appendChild(scriptEl);
            } else {
                console.log(`[UI] No script found for '${pageName}'.`);
            }

        } catch (error) {
            console.error(`[UI] FAILED to load page '${pageName}.html':`, error);
            pageContentEl.innerHTML = `<h1>Error loading page</h1><p>${error.message}</p>`;
        }
    }

    function showAuthScreen() {
        authScreenEl.style.display = 'flex';
        appHeaderEl.style.display = 'none';
        pageContentEl.style.display = 'none';
    }

    function showApp() {
        authScreenEl.style.display = 'none';
        appHeaderEl.style.display = 'flex';
        pageContentEl.style.display = 'block';
    }

    function showLoader(message = 'Loading...') {
         pageContentEl.innerHTML = `<div class="loader">${message}</div>`;
    }

    return { loadPage, showAuthScreen, showApp, showLoader };
})();