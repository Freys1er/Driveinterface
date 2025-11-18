// --- Bootstrap and Authentication Logic ---

document.getElementById('signout-button').addEventListener('click', () => {
    localStorage.removeItem(App.TOKEN_STORAGE_KEY);
    window.location.href = '/';
});

/**
 * Page-specific logic: Get contacts and initialize the graph.
 */
function runPageLogic() {
    const contacts = App.getContacts();
    const container = document.getElementById('network-container');
    initializeNetworkGraph(container, contacts);
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
        console.error("Initialization Error:", error);
        document.getElementById('page-content').innerHTML = `<h1>Error</h1><p>Could not initialize the application.</p>`;
    }
}

function gapiLoaded() {
    gapi.load('client', initializeAndRun);
}


// --- Network Graph Rendering Logic ---

function initializeNetworkGraph(containerElement, realContacts) {
    console.log("NETWORK_DEBUG: Initializing graph with", realContacts.length, "contacts.");
    const canvas = document.getElementById('network-canvas');
    if (!canvas) {
        console.error("Could not find the canvas element for the network graph.");
        return;
    }
    const ctx = canvas.getContext('2d');

    if (!realContacts || realContacts.length === 0) {
        ctx.fillStyle = '#444';
        ctx.textAlign = 'center';
        ctx.font = '18px "Courier New"';
        ctx.fillText("No contacts found to display in the network.", canvas.width / 2, canvas.height / 2);
        return;
    }

    const uiControls = document.getElementById('ui-controls');
    if(uiControls) uiControls.style.display = 'flex';

    const pauseButton = document.getElementById('pause-button');
    const findInput = document.getElementById('find-input');
    const findButton = document.getElementById('find-button');
    const addButton = document.getElementById('add-button');

    const nodes = [];
    const edges = [];

    realContacts.forEach(contact => {
        if (!contact.id) return;

        nodes.push({
            id: contact.id,
            label: `${(contact.firstName || '').charAt(0)}${(contact.lastName || '').charAt(0)}`.toUpperCase() || '??',
            x: (Math.random() - 0.5) * 500, y: (Math.random() - 0.5) * 500,
            vx: 0, vy: 0,
            isLocked: false,
            highlightUntil: 0
        });

        // *** FIX: Replaced the complex try/catch block with a simple, robust check. ***
        const relations = Array.isArray(contact.relations) ? contact.relations : [];

        if (relations.length > 0) {
            console.log(`NETWORK_DEBUG: Contact ${contact.id} has relations:`, relations);
        }

        relations.forEach(rel => {
            // Check if the target contact for the relationship actually exists in our list.
            const targetExists = realContacts.some(c => c.id === rel.contactId);
            
            if (rel && rel.contactId && targetExists) {
                // Avoid duplicate edges (A->B is the same as B->A for the graph)
                const edgeExists = edges.some(e => (e.source === contact.id && e.target === rel.contactId) || (e.source === rel.contactId && e.target === contact.id));
                if (!edgeExists) {
                    edges.push({ source: contact.id, target: rel.contactId });
                }
            } else {
                console.warn(`NETWORK_DEBUG: Could not create edge for relation because target contact '${rel.contactId}' was not found.`);
            }
        });
    });

    console.log("NETWORK_DEBUG: Node creation complete. Total nodes:", nodes.length);
    console.log("NETWORK_DEBUG: Edge creation complete. Total edges:", edges.length, edges);

    // --- STATE & CONSTANTS (No changes in this section) ---
    let isPaused = false;
    let draggedNode = null;
    let isPanning = false;
    let wasDragged = false;
    let lastPanPoint = { x: 0, y: 0 };
    let clickTimeout = null;
    let scale = 1.0;
    let viewOffset = { x: 0, y: 0 };
    let targetOffset = { x: 0, y: 0 };
    const DOUBLE_CLICK_THRESHOLD = 300;
    const NODE_RADIUS = 20;
    const GRID_SIZE = 50;

    // --- ALL THE REMAINING FUNCTIONS (handleInteraction, update, draw, etc.) ARE UNCHANGED ---
    function screenToWorld(x, y) {
        const rect = canvas.getBoundingClientRect();
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        return {
            x: (x - rect.left - centerX - viewOffset.x) / scale,
            y: (y - rect.top - centerY - viewOffset.y) / scale
        };
    }

    function handleInteractionStart(e) {
        if (e.target !== canvas) return;
        if (e.type === 'touchstart') e.preventDefault();
        wasDragged = false;
        const clientX = e.clientX ?? e.touches[0].clientX;
        const clientY = e.clientY ?? e.touches[0].clientY;

        const pos = screenToWorld(clientX, clientY);
        for (const node of nodes) {
            const dx = node.x - pos.x;
            const dy = node.y - pos.y;
            if (dx * dx + dy * dy < (NODE_RADIUS * NODE_RADIUS)) {
                draggedNode = node;
                return;
            }
        }
        isPanning = true;
        lastPanPoint = { x: clientX, y: clientY };
        canvas.classList.add('grabbing');
    }

    function handleInteractionMove(e) {
        if (!draggedNode && !isPanning) return;
        if (e.type === 'touchmove') e.preventDefault();
        wasDragged = true;

        const clientX = e.clientX ?? e.touches[0].clientX;
        const clientY = e.clientY ?? e.touches[0].clientY;

        if (draggedNode) {
            const pos = screenToWorld(clientX, clientY);
            draggedNode.x = pos.x;
            draggedNode.y = pos.y;
        } else if (isPanning) {
            const dx = clientX - lastPanPoint.x;
            const dy = clientY - lastPanPoint.y;
            viewOffset.x += dx; viewOffset.y += dy;
            targetOffset.x = viewOffset.x; targetOffset.y = viewOffset.y;
            lastPanPoint = { x: clientX, y: clientY };
        }
    }

    function handleInteractionEnd(e) {
        if (draggedNode && !wasDragged) {
            if (clickTimeout) {
                clearTimeout(clickTimeout);
                clickTimeout = null;
                window.location.href = `contact.html?id=${draggedNode.id}`;
            } else {
                clickTimeout = setTimeout(() => {
                    draggedNode.isLocked = !draggedNode.isLocked;
                    if (draggedNode.isLocked) {
                        draggedNode.x = Math.round(draggedNode.x / GRID_SIZE) * GRID_SIZE;
                        draggedNode.y = Math.round(draggedNode.y / GRID_SIZE) * GRID_SIZE;
                    }
                    clickTimeout = null;
                }, DOUBLE_CLICK_THRESHOLD);
            }
        }
        draggedNode = null;
        isPanning = false;
        canvas.classList.remove('grabbing');
    }
    
    function handleWheel(e) {
        e.preventDefault();
        const zoomFactor = 1.1; const oldScale = scale;
        scale *= e.deltaY > 0 ? 1 / zoomFactor : zoomFactor;
        scale = Math.max(0.1, Math.min(scale, 10));
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left - rect.width / 2; 
        const mouseY = e.clientY - rect.top - rect.height / 2;
        viewOffset.x = mouseX - (mouseX - viewOffset.x) * (scale / oldScale);
        viewOffset.y = mouseY - (mouseY - viewOffset.y) * (scale / oldScale);
        targetOffset = { ...viewOffset };
    }

    pauseButton.addEventListener('click', () => { isPaused = !isPaused; pauseButton.textContent = isPaused ? 'Play' : 'Pause'; });
    findButton.addEventListener('click', findNode);
    findInput.addEventListener('keydown', (e) => e.key === 'Enter' && findNode());
    addButton.addEventListener('click', () => window.location.href = 'contact.html?new=true');

    function findNode() {
        const query = findInput.value.trim().toUpperCase(); if (!query) return;
        const foundNode = nodes.find(n => n.label.toUpperCase().includes(query));
        if (foundNode) {
            targetOffset.x = -foundNode.x * scale; targetOffset.y = -foundNode.y * scale;
            foundNode.highlightUntil = Date.now() + 2000;
        } else { alert('Node not found.'); }
    }

    canvas.addEventListener('mousedown', handleInteractionStart);
    canvas.addEventListener('mousemove', handleInteractionMove);
    window.addEventListener('mouseup', handleInteractionEnd);
    canvas.addEventListener('touchstart', handleInteractionStart, { passive: false });
    canvas.addEventListener('touchmove', handleInteractionMove, { passive: false });
    window.addEventListener('touchend', handleInteractionEnd);
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    
    function resizeCanvas() {
        canvas.width = containerElement.clientWidth;
        canvas.height = containerElement.clientHeight;
    }
    window.addEventListener('resize', resizeCanvas);
    
    function update() {
        viewOffset.x += (targetOffset.x - viewOffset.x) * 0.1;
        viewOffset.y += (targetOffset.y - viewOffset.y) * 0.1;
        if (isPaused) return;

        const forces = new Map(nodes.map(n => [n.id, { fx: 0, fy: 0 }]));

        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const nodeA = nodes[i]; const nodeB = nodes[j];
                const dx = nodeB.x - nodeA.x; const dy = nodeB.y - nodeA.y;
                let distSq = dx * dx + dy * dy;
                if (distSq < 1) distSq = 1;
                const force = -8000 / distSq;
                const fx = force * dx / Math.sqrt(distSq);
                const fy = force * dy / Math.sqrt(distSq);
                forces.get(nodeA.id).fx += fx; forces.get(nodeA.id).fy += fy;
                forces.get(nodeB.id).fx -= fx; forces.get(nodeB.id).fy -= fy;
            }
        }

        edges.forEach(edge => {
            const source = nodes.find(n => n.id === edge.source);
            const target = nodes.find(n => n.id === edge.target);
            if (!source || !target) return;
            const dx = target.x - source.x; const dy = target.y - source.y;
            const stiffness = 0.01;
            forces.get(source.id).fx += dx * stiffness; forces.get(source.id).fy += dy * stiffness;
            forces.get(target.id).fx -= dx * stiffness; forces.get(target.id).fy -= dy * stiffness;
        });

        nodes.forEach(node => {
            if (node.isLocked || node === draggedNode) {
                node.vx = 0; node.vy = 0; return;
            }
            const force = forces.get(node.id);
            node.vx = (node.vx + force.fx) * 0.85; node.vy = (node.vy + force.fy) * 0.85;
            node.x += node.vx; node.y += node.vy;
        });
    }

    function draw() {
        ctx.save();
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.translate(viewOffset.x, viewOffset.y);
        ctx.scale(scale, scale);
        drawGrid();
        ctx.strokeStyle = 'rgba(0, 255, 0, 0.3)';
        ctx.lineWidth = 1 / scale;
        edges.forEach(edge => {
            const source = nodes.find(n => n.id === edge.source);
            const target = nodes.find(n => n.id === edge.target);
            if (source && target) {
                ctx.beginPath(); ctx.moveTo(source.x, source.y); ctx.lineTo(target.x, target.y); ctx.stroke();
            }
        });
        nodes.forEach(node => {
            const isHighlighted = node.highlightUntil > Date.now();
            if (node.isLocked) {
                ctx.strokeStyle = '#00ffff'; ctx.lineWidth = 3 / scale;
                ctx.strokeRect(node.x - NODE_RADIUS, node.y - NODE_RADIUS, NODE_RADIUS * 2, NODE_RADIUS * 2);
            }
            ctx.beginPath();
            ctx.arc(node.x, node.y, NODE_RADIUS, 0, 2 * Math.PI);
            ctx.fillStyle = isHighlighted ? 'rgba(255, 255, 0, 0.8)' : (node === draggedNode ? 'rgba(0, 255, 0, 0.5)' : 'rgba(0, 255, 0, 0.2)');
            ctx.fill();
            ctx.strokeStyle = isHighlighted ? '#ff0' : (node.isLocked ? '#00ffff' : '#0f0');
            ctx.lineWidth = isHighlighted ? (3 / scale) : (1 / scale);
            ctx.stroke();
            ctx.fillStyle = isHighlighted ? '#ff0' : '#0f0';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            const fontSize = NODE_RADIUS * 1.4;
            ctx.font = `bold ${fontSize}px "Courier New"`;
            ctx.fillText(node.label, node.x, node.y);
        });
        ctx.restore();
    }

    function drawGrid() {
        ctx.strokeStyle = 'rgba(0, 255, 0, 0.08)'; ctx.lineWidth = 1 / scale;
        const viewBounds = {
            left: -viewOffset.x / scale - (canvas.width / 2) / scale,
            right: -viewOffset.x / scale + (canvas.width / 2) / scale,
            top: -viewOffset.y / scale - (canvas.height / 2) / scale,
            bottom: -viewOffset.y / scale + (canvas.height / 2) / scale,
        };
        const startX = Math.floor(viewBounds.left / GRID_SIZE) * GRID_SIZE;
        const endX = Math.ceil(viewBounds.right / GRID_SIZE) * GRID_SIZE;
        const startY = Math.floor(viewBounds.top / GRID_SIZE) * GRID_SIZE;
        const endY = Math.ceil(viewBounds.bottom / GRID_SIZE) * GRID_SIZE;
        for (let x = startX; x <= endX; x += GRID_SIZE) {
            ctx.beginPath(); ctx.moveTo(x, viewBounds.top); ctx.lineTo(x, viewBounds.bottom); ctx.stroke();
        }
        for (let y = startY; y <= endY; y += GRID_SIZE) {
            ctx.beginPath(); ctx.moveTo(viewBounds.left, y); ctx.lineTo(viewBounds.right, y); ctx.stroke();
        }
    }

    function gameLoop() {
        update();
        draw();
        requestAnimationFrame(gameLoop);
    }
    
    resizeCanvas();
    gameLoop();
}