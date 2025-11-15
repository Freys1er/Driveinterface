// osint/js/ui.js

const UI = (() => {
    const authView = document.getElementById('auth-view');
    const mainView = document.getElementById('main-view');
    const pageContent = document.getElementById('page-content');

    // <<< FIX: Removed the event listeners from here. They are now handled by app.js.

    const showAuthView = () => {
        mainView.classList.add('hidden');
        authView.classList.remove('hidden');
    };

    const showMainView = () => {
        authView.classList.add('hidden');
        mainView.classList.remove('hidden');
    };

    const loadPage = async (page) => {
        try {
            // Display a loading message immediately
            pageContent.innerHTML = '<h2>Loading...</h2>';
            const response = await fetch(`./pages/${page}.html`);

            if (!response.ok) {
                // If the page doesn't exist, show a 404 message
                pageContent.innerHTML = '<h1>404 - Page Not Found</h1>';
                return;
            }

            const html = await response.text();
            pageContent.innerHTML = html;

            // Find and execute the script tag within the loaded HTML
            const scriptElement = pageContent.querySelector('script');
            if (scriptElement) {
                // To execute it, we must create a new script element and append it
                const newScript = document.createElement('script');
                newScript.textContent = scriptElement.textContent;
                document.body.appendChild(newScript).parentNode.removeChild(newScript);
            }

        } catch (error) {
            console.error(`Failed to load page '${page}':`, error);
            pageContent.innerHTML = '<h1>Error: Could not load page content.</h1>';
        }
    };

    const setLoading = (isLoading) => {
        // Optional: Add a visual loader to give feedback during Drive operations
        if (isLoading) {
            document.body.style.cursor = 'wait';
        } else {
            document.body.style.cursor = 'default';
        }
    };

    return {
        showAuthView,
        showMainView,
        loadPage,
        setLoading
    };
})();