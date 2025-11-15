// osint/js/ui.js

const UI = (() => {

    const showAuthView = () => {
        document.getElementById('login-screen')?.classList.remove('hidden');
        document.getElementById('app-container')?.classList.add('hidden');
    };

    const showMainView = () => {
        document.getElementById('login-screen')?.classList.add('hidden');
        document.getElementById('app-container')?.classList.remove('hidden');
    };

    const loadPage = async (pageName, container) => {
        // *** THIS IS THE CRITICAL FIX ***
        // The path now correctly points to the 'osint/pages/' directory.
        const path = `./osint/pages/${pageName}.html`;

        // Use the main app's content display area by default.
        const contentContainer = container || document.getElementById('file-content-display');

        if (!contentContainer) {
            console.error("UI Error: Could not find content container to load page into.");
            return;
        }

        try {
            const response = await fetch(path);
            if (!response.ok) {
                throw new Error(`Page not found: ${path}`);
            }
            contentContainer.innerHTML = await response.text();

            // If the loaded page is the network graph, initialize it.
            if (pageName === 'network' && typeof initializeNetworkGraph === 'function') {
                initializeNetworkGraph(contentContainer);
            }
        } catch (error) {
            console.error(`Failed to load page '${pageName}':`, error);
            if (contentContainer) {
                contentContainer.innerHTML = `<h1>Error</h1><p>Could not load page: ${pageName}.html</p>`;
            }
        }
    };

    // This is a placeholder; you can expand it with more UI functions.
    const setLoading = (isLoading) => {
        // You can implement a loading spinner here if you wish.
        console.log("Setting loading state:", isLoading);
    };

    return {
        showAuthView,
        showMainView,
        loadPage,
        setLoading
    };
})();