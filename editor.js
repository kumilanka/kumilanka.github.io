// Editor State
const state = {
    nodes: {}, // Map of id -> node object
    scale: 1,
    panX: 0,
    panY: 0,
    isDraggingNode: false,
    isDraggingConnection: false,
    draggedNodeId: null,
    connectionSourceNodeId: null,
    connectionSourceIndex: null,
    tempConnectionEndX: 0,
    tempConnectionEndY: 0,
    dragStartX: 0,
    dragStartY: 0,
    isPanning: false,
    panStartX: 0,
    panStartY: 0,
    currentDocName: null, // New: Track current document name
    hasUnsavedChanges: false,
    metadata: {
        programName: '',
        titleAscii: ''
    }
};

// DOM Elements
const workspace = document.getElementById('workspace');
const panLayer = document.getElementById('pan-layer');
const nodesLayer = document.getElementById('nodes-layer');
const connectionsLayer = document.getElementById('connections-layer');
const modalOverlay = document.getElementById('modal-overlay');
const documentList = document.getElementById('document-list');
const currentDocNameDisplay = document.getElementById('current-doc-name');

// Properties Modal
const propsModalOverlay = document.getElementById('props-modal-overlay');
const propProgramName = document.getElementById('prop-program-name');
const propAsciiTitle = document.getElementById('prop-ascii-title');

// Release Modal
const releaseModalOverlay = document.getElementById('release-modal-overlay');
const releaseJsonCode = document.getElementById('release-json-code');

// Local Storage Key
const STORAGE_KEY = 'mundane_quest_docs';
const LAST_DOC_KEY = 'mundane_quest_last_doc';
const PREVIEW_KEY = 'mq_preview_content'; // Content for previewing

// --- Initialization ---
function init() {
    setupEventListeners();
    centerView();
    
    // Try to load last edited
    const lastDoc = localStorage.getItem(LAST_DOC_KEY);
    if (lastDoc) {
        const store = getStorage();
        if (store[lastDoc]) {
            loadFromContent(store[lastDoc].content, lastDoc);
            console.log(`Restored last session: ${lastDoc}`);
        }
    }
}

// --- Event Listeners ---
function setupEventListeners() {
    // Toolbar
    document.getElementById('btn-add-node').addEventListener('click', () => createNode());
    document.getElementById('btn-auto-layout').addEventListener('click', autoLayout);
    document.getElementById('btn-reset-view').addEventListener('click', centerView);
    document.getElementById('btn-zoom-in').addEventListener('click', () => zoom(0.1));
    document.getElementById('btn-zoom-out').addEventListener('click', () => zoom(-0.1));
    
    // New Buttons
    document.getElementById('btn-menu').addEventListener('click', openMenu);
    document.getElementById('btn-save-local').addEventListener('click', () => saveToLocalStorage());
    document.getElementById('current-doc-name').addEventListener('click', renameDocument);
    document.getElementById('btn-export').addEventListener('click', saveToFile); // Was btn-save
    document.getElementById('btn-load-file').addEventListener('click', () => document.getElementById('file-input').click()); // Was btn-load
    document.getElementById('btn-properties').addEventListener('click', openProperties);
    document.getElementById('btn-play').addEventListener('click', playPreview);
    document.getElementById('btn-publish').addEventListener('click', openReleaseMenu);
    
    document.getElementById('file-input').addEventListener('change', handleFileUpload);

    // Modal
    document.getElementById('btn-close-modal').addEventListener('click', closeMenu);
    document.getElementById('btn-new-doc').addEventListener('click', createNewDoc);
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeMenu();
    });

    // Props Modal
    document.getElementById('btn-close-props').addEventListener('click', closeProperties);
    document.getElementById('btn-save-props').addEventListener('click', saveProperties);
    propsModalOverlay.addEventListener('click', (e) => {
        if (e.target === propsModalOverlay) closeProperties();
    });

    // Release Modal
    document.getElementById('btn-close-release').addEventListener('click', closeRelease);
    document.getElementById('btn-download-release').addEventListener('click', downloadReleaseFile);
    document.getElementById('btn-copy-json').addEventListener('click', copyReleaseJson);
    releaseModalOverlay.addEventListener('click', (e) => {
        if (e.target === releaseModalOverlay) closeRelease();
    });

    // Workspace Panning & Dragging
    workspace.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('click', handleGlobalClick); // Handle click events for connections
    workspace.addEventListener('wheel', handleWheel, { passive: false });
    
    // No global connection listener needed, we attach directly to paths
}

// --- View Control ---
function autoLayout() {
    const nodes = Object.values(state.nodes);
    // Sort nodes to ensure deterministic layout (optional, but good for stability)
    // We can sort by ID or just use the default order.
    // Let's sort by current Y then X to try and preserve some relative order,
    // or just by ID to be stable.
    // Actually, let's just use the array order which usually matches creation/parse order.
    
    let currentX = 0;
    let currentY = 0;
    let maxRowHeight = 0;
    
    const colWidth = 450; // Width 300 + Gap 150
    const rowGap = 100;
    const limitX = 2000;

    nodes.forEach(node => {
        const el = node.element;
        if (!el) return;
        
        // Get current node height
        const h = el.offsetHeight;
        
        // Check if we need to wrap to next row
        if (currentX + colWidth > limitX && currentX > 0) {
            currentX = 0;
            currentY += maxRowHeight + rowGap;
            maxRowHeight = 0;
        }

        // Update Position
        node.x = currentX;
        node.y = currentY;
        updateNodePosition(node.id);
        
        // Update row stats
        if (h > maxRowHeight) maxRowHeight = h;
        
        // Advance X
        currentX += colWidth;
    });

    updateConnections();
    markUnsaved();
}

function centerView() {
    state.scale = 1;
    state.panX = workspace.clientWidth / 2;
    state.panY = workspace.clientHeight / 2;
    updateTransform();
}

function zoom(delta) {
    const newScale = Math.max(0.1, Math.min(3, state.scale + delta));
    state.scale = newScale;
    updateTransform();
}

function updateTransform() {
    panLayer.style.transform = `translate(${state.panX}px, ${state.panY}px) scale(${state.scale})`;
}

function handleWheel(e) {
    if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        // Zoom relative to mouse position
        const zoomSensitivity = 0.03; // Adjusted for better feel
        const delta = e.deltaY > 0 ? -zoomSensitivity : zoomSensitivity;
        
        const rect = workspace.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Calculate world coordinates before zoom
        const worldX = (mouseX - state.panX) / state.scale;
        const worldY = (mouseY - state.panY) / state.scale;

        // Apply zoom
        const newScale = Math.max(0.1, Math.min(5, state.scale + delta));
        state.scale = newScale;

        // Adjust pan to keep mouse over same world point
        state.panX = mouseX - worldX * state.scale;
        state.panY = mouseY - worldY * state.scale;
        
        updateTransform();
    } else {
        e.preventDefault(); // Prevent browser back/forward swipe history navigation
        // Pan with scroll
        state.panX -= e.deltaX;
        state.panY -= e.deltaY;
        updateTransform();
    }
}

function handleMouseDown(e) {
    // Check if clicking on workspace (not on a node)
    if (e.target === workspace || e.target === panLayer || e.target === nodesLayer || e.target.id === 'connections-layer') {
        state.isPanning = true;
        state.panStartX = e.clientX - state.panX;
        state.panStartY = e.clientY - state.panY;
    }
}

function handleMouseMove(e) {
    if (state.isPanning) {
        state.panX = e.clientX - state.panStartX;
        state.panY = e.clientY - state.panStartY;
        updateTransform();
    } else if (state.isDraggingNode && state.draggedNodeId) {
        const node = state.nodes[state.draggedNodeId];
        const dx = (e.clientX - state.dragStartX) / state.scale;
        const dy = (e.clientY - state.dragStartY) / state.scale;
        
        node.x += dx;
        node.y += dy;
        
        updateNodePosition(state.draggedNodeId);
        updateConnections();
        
        state.dragStartX = e.clientX;
        state.dragStartY = e.clientY;
        markUnsaved();
    } else if (state.isDraggingConnection) {
        // Transform mouse coordinates to workspace coordinates
        // The SVG layer has a huge offset (50000), so we need to map mouse -> pan-layer -> SVG space
        // Workspace coord = (Mouse - Pan) / Scale
        const rect = workspace.getBoundingClientRect();
        const wsX = (e.clientX - rect.left - state.panX) / state.scale;
        const wsY = (e.clientY - rect.top - state.panY) / state.scale;
        
        state.tempConnectionEndX = wsX;
        state.tempConnectionEndY = wsY;
        updateConnections(); // Redraw to show temp line
    }
}

function handleMouseUp(e) {
    state.isPanning = false;
    state.isDraggingNode = false;
    state.draggedNodeId = null;
    // Note: We do NOT clear state.isDraggingConnection here anymore, 
    // because connection creation is now click-click based, not drag-drop.
}

function handleGlobalClick(e) {
    if (!state.isDraggingConnection) return;
    
    // If clicking on an input handle, complete the connection
    if (e.target.classList.contains('input-handle')) {
        finishConnection(e.target);
    } else if (e.shiftKey || e.metaKey) {
        // Quick Create Node
        createNodeAtConnectionDrop(e);
    } else {
        // If we clicked anywhere else, cancel the connection drag
        cancelConnectionDrag();
    }
}

function createNodeAtConnectionDrop(e) {
    // Calculate position in workspace coords
    const rect = workspace.getBoundingClientRect();
    const x = (e.clientX - rect.left - state.panX) / state.scale;
    const y = (e.clientY - rect.top - state.panY) / state.scale;
    
    // Create new node where the click happened (top-left corner)
    // Adjust slightly so the cursor is not exactly on the border
    const newNode = createNode(null, x - 10, y - 10); 
    
    // Connect
    const sourceNode = state.nodes[state.connectionSourceNodeId];
    const option = sourceNode.options[state.connectionSourceIndex];
    
    option.next = newNode.id;
    const optInput = sourceNode.element.querySelectorAll('.option-target')[state.connectionSourceIndex];
    if (optInput) optInput.value = newNode.id;
    
    cancelConnectionDrag();
    markUnsaved();
}

function finishConnection(targetInputHandle) {
    const targetNodeId = targetInputHandle.closest('.node').id.replace('node-', '');
    const sourceNode = state.nodes[state.connectionSourceNodeId];
    const option = sourceNode.options[state.connectionSourceIndex];
    
    // Update connection
    option.next = targetNodeId;
    
    // Update the option UI input if it exists
    const optInput = sourceNode.element.querySelectorAll('.option-target')[state.connectionSourceIndex];
    if (optInput) optInput.value = targetNodeId;
    
    cancelConnectionDrag();
    markUnsaved();
}

function cancelConnectionDrag() {
    state.isDraggingConnection = false;
    state.connectionSourceNodeId = null;
    state.connectionSourceIndex = null;
    updateConnections(); // Clear temp lines
}

function handleConnectionMouseDown(e) {
    if (e.shiftKey) {
        e.stopPropagation();
        e.preventDefault();
        
        // Find the path element (it might be the target or a parent if we add decorations later)
        const path = e.target.closest('path.connection');
        if (path) {
            const sourceId = path.dataset.source;
            const index = parseInt(path.dataset.index, 10);
            if (sourceId && !isNaN(index)) {
                deleteConnection(sourceId, index);
            }
        }
    }
}

function deleteConnection(sourceId, index) {
    const sourceNode = state.nodes[sourceId];
    if (sourceNode) {
        const option = sourceNode.options[index];
        if (option) {
            option.next = '';
            updateConnections();
            markUnsaved();
        }
    }
}

// --- Helper ---
function markUnsaved() {
    if (state.hasUnsavedChanges) return;
    state.hasUnsavedChanges = true;
    const btn = document.getElementById('btn-save-local');
    if (btn) {
        btn.textContent = 'Save *';
        btn.style.color = '#ffeb3b'; // Optional: Highlight color
    }
}

function markSaved() {
    state.hasUnsavedChanges = false;
    const btn = document.getElementById('btn-save-local');
    if (btn) {
        btn.textContent = 'Save';
        btn.style.color = ''; // Reset color
    }
}

function autoExpand(field) {
    field.style.height = 'inherit'; // Reset to calculate scrollHeight
    const computed = window.getComputedStyle(field);
    const height = parseInt(computed.getPropertyValue('border-top-width'), 10) +
                   parseInt(computed.getPropertyValue('padding-top'), 10) +
                   field.scrollHeight +
                   parseInt(computed.getPropertyValue('padding-bottom'), 10) +
                   parseInt(computed.getPropertyValue('border-bottom-width'), 10);
                   
    // Check if it's option text or main node text for min height
    const isOption = field.classList.contains('option-text') || field.classList.contains('option-response');
    const minHeight = isOption ? 24 : 60; 
    field.style.height = Math.max(minHeight, height) + 'px';
    
    // Update connections as node size changed
    updateConnections();
}

// --- Node Management ---

function createNode(id = null, x = 0, y = 0, text = '', options = []) {
    const nodeId = id || 'scene_' + Date.now();
    
    const node = {
        id: nodeId,
        x: x,
        y: y,
        text: text,
        options: options,
        element: null
    };

    state.nodes[nodeId] = node;
    renderNode(node);
    updateConnections();
    markUnsaved();
    return node;
}

function renderNode(node) {
    const el = document.createElement('div');
    el.className = 'node';
    el.id = `node-${node.id}`;
    
    // Input Handle (Top Left)
    const inputHandle = document.createElement('div');
    inputHandle.className = 'input-handle';
    inputHandle.title = 'Click to connect here';
    
    // Header
    const header = document.createElement('div');
    header.className = 'node-header';
    
    // Mouse down for dragging
    header.addEventListener('mousedown', (e) => {
        if (e.target !== header && e.target !== el.querySelector('.node-id-display')) return;
        startDragNode(e, node.id);
    });

    // Hover for highlighting connections
    header.addEventListener('mouseenter', () => highlightConnections(node.id));
    header.addEventListener('mouseleave', () => clearHighlights());
    
    const idDisplay = document.createElement('div');
    idDisplay.className = 'node-id-display';
    idDisplay.textContent = node.id;
    
    const idInput = document.createElement('input');
    idInput.className = 'node-id-input';
    idInput.value = node.id;
    idInput.style.display = 'none';
    idInput.addEventListener('blur', () => {
        updateNodeId(node.id, idInput.value);
        idInput.style.display = 'none';
        idDisplay.style.display = 'block';
    });
    idInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') idInput.blur();
    });

    idDisplay.addEventListener('dblclick', () => {
        idDisplay.style.display = 'none';
        idInput.style.display = 'block';
        idInput.focus();
    });
    
    const delBtn = document.createElement('button');
    delBtn.className = 'btn-delete-node';
    delBtn.textContent = '×';
    delBtn.addEventListener('click', () => deleteNode(node.id));

    header.appendChild(idDisplay);
    header.appendChild(idInput);
    header.appendChild(delBtn);
    
    // Content
    const content = document.createElement('div');
    content.className = 'node-content';
    
    const textArea = document.createElement('textarea');
    textArea.className = 'node-text';
    textArea.placeholder = 'Scene text...';
    textArea.value = node.text;
    
    textArea.addEventListener('input', (e) => { 
        node.text = e.target.value;
        autoExpand(e.target);
        markUnsaved();
    });
    
    // Initial resize
    setTimeout(() => autoExpand(textArea), 0);

    const optionsContainer = document.createElement('div');
    optionsContainer.className = 'node-options';
    
    // Render existing options
    node.options.forEach((opt, idx) => {
        optionsContainer.appendChild(createOptionElement(node, opt, idx));
    });

    const addOptBtn = document.createElement('div');
    addOptBtn.className = 'btn-add-option';
    addOptBtn.textContent = '+ Add Option';
    addOptBtn.addEventListener('click', (e) => {
        // Prevent bubbling to avoid triggering global click which might cancel connection if active
        e.stopPropagation(); 
        const newOpt = { text: 'Option', next: '' };
        node.options.push(newOpt);
        optionsContainer.appendChild(createOptionElement(node, newOpt, node.options.length - 1));
        updateConnections();
        markUnsaved();
    });

    content.appendChild(textArea);
    content.appendChild(optionsContainer);
    content.appendChild(addOptBtn);

    el.appendChild(inputHandle);
    el.appendChild(header);
    el.appendChild(content);
    
    node.element = el;
    nodesLayer.appendChild(el);
    updateNodePosition(node.id);
}

function createOptionElement(node, opt, index) {
    const container = document.createElement('div');
    container.className = 'option-container';

    const row = document.createElement('div');
    row.className = 'option-item';
    
    const textInput = document.createElement('textarea'); // Changed to textarea
    textInput.className = 'option-text';
    textInput.value = opt.text;
    textInput.placeholder = 'Text';
    textInput.rows = 1;
    textInput.addEventListener('input', (e) => { 
        opt.text = e.target.value;
        autoExpand(e.target); // Auto-expand on input
        markUnsaved();
    });
    
    // Initial expansion for existing text
    setTimeout(() => autoExpand(textInput), 0);
    
    // Hidden target input (kept for compatibility/debugging)
    const targetInput = document.createElement('input');
    targetInput.className = 'option-target';
    targetInput.value = opt.next || '';
    targetInput.type = 'hidden'; 
    
    const delBtn = document.createElement('span');
    delBtn.className = 'btn-del-option';
    delBtn.textContent = '×';
    delBtn.addEventListener('click', () => {
        const idx = node.options.indexOf(opt);
        if (idx > -1) {
            node.options.splice(idx, 1);
            container.remove(); // Remove the container
            updateConnections();
            markUnsaved();
        }
    });
    
    // Output Handle
    const outputHandle = document.createElement('div');
    outputHandle.className = 'output-handle';
    outputHandle.title = 'Click to start connection';
    // CHANGED: mousedown -> click for the new interaction mode
    // Use dynamic index lookup to avoid stale closures
    outputHandle.addEventListener('click', (e) => {
        const currentIdx = node.options.indexOf(opt);
        if (currentIdx !== -1) {
            startDragConnection(e, node.id, currentIdx);
        }
    });

    row.appendChild(textInput);
    row.appendChild(targetInput); // Hidden
    row.appendChild(delBtn);
    row.appendChild(outputHandle);

    // Response Input
    const responseInput = document.createElement('textarea');
    responseInput.className = 'option-response';
    responseInput.value = opt.response || '';
    responseInput.placeholder = 'Optional response...';
    responseInput.rows = 1;
    responseInput.addEventListener('input', (e) => {
        opt.response = e.target.value;
        autoExpand(e.target);
        markUnsaved();
    });
    
    setTimeout(() => autoExpand(responseInput), 0);

    container.appendChild(row);
    container.appendChild(responseInput);
    
    return container;
}

function startDragNode(e, nodeId) {
    e.stopPropagation();
    e.preventDefault(); // Prevent text selection
    state.isDraggingNode = true;
    state.draggedNodeId = nodeId;
    state.dragStartX = e.clientX;
    state.dragStartY = e.clientY;
    
    // Bring to front
    const el = state.nodes[nodeId].element;
    nodesLayer.appendChild(el);
}

function startDragConnection(e, nodeId, index) {
    e.stopPropagation();
    // e.preventDefault(); // Not strictly necessary for click, but good practice
    
    state.isDraggingConnection = true;
    state.connectionSourceNodeId = nodeId;
    state.connectionSourceIndex = index;
}

function updateNodePosition(id) {
    const node = state.nodes[id];
    if (node && node.element) {
        node.element.style.transform = `translate(${node.x}px, ${node.y}px)`;
    }
}

function updateNodeId(oldId, newId) {
    if (oldId === newId) return;
    if (state.nodes[newId]) {
        alert('ID already exists!');
        return;
    }
    
    const node = state.nodes[oldId];
    node.id = newId;
    state.nodes[newId] = node;
    delete state.nodes[oldId];
    node.element.id = `node-${newId}`;
    node.element.querySelector('.node-id-display').textContent = newId;

    // Update all references to this node
    Object.values(state.nodes).forEach(n => {
        n.options.forEach((opt, idx) => {
            if (opt.next === oldId) {
                opt.next = newId;
                // Update UI hidden input
                const optInput = n.element.querySelectorAll('.option-target')[idx];
                if (optInput) optInput.value = newId;
            }
        });
    });

    updateConnections();
    markUnsaved();
}

function deleteNode(id) {
    if (confirm(`Delete scene "${id}"?`)) {
        const node = state.nodes[id];
        node.element.remove();
        delete state.nodes[id];
        updateConnections();
        markUnsaved();
    }
}

// --- Connections ---

function updateConnections() {
    // Clear existing
    while (connectionsLayer.firstChild) {
        connectionsLayer.removeChild(connectionsLayer.firstChild);
    }
    
    const off = 50000; // SVG Offset

    // Draw existing connections
    Object.values(state.nodes).forEach(sourceNode => {
        sourceNode.options.forEach((opt, index) => {
            if (opt.next && state.nodes[opt.next]) {
                const targetNode = state.nodes[opt.next];
                const outputHandle = sourceNode.element.querySelectorAll('.output-handle')[index];
                const inputHandle = targetNode.element.querySelector('.input-handle');
                
                if (outputHandle && inputHandle) {
                    // Get coordinates relative to pan-layer
                    // We can get bounding rects and adjust by pan/scale, OR just use node x/y + relative offsets
                    // Using getBoundingClientRect is robust but requires reverse-transform
                    
                    const sourceRect = outputHandle.getBoundingClientRect();
                    const targetRect = inputHandle.getBoundingClientRect();
                    const panRect = panLayer.getBoundingClientRect();
                    
                    // Calculate positions in the unscaled coordinate system relative to panLayer origin
                    const startX = (sourceRect.left + sourceRect.width/2 - panRect.left) / state.scale + off;
                    const startY = (sourceRect.top + sourceRect.height/2 - panRect.top) / state.scale + off;
                    const endX = (targetRect.left + targetRect.width/2 - panRect.left) / state.scale + off;
                    const endY = (targetRect.top + targetRect.height/2 - panRect.top) / state.scale + off;
                    
                    drawConnectionPath(startX, startY, endX, endY, false, sourceNode.id, targetNode.id, index);
                }
            }
        });
    });
    
    // Draw active drag connection
    if (state.isDraggingConnection) {
        const sourceNode = state.nodes[state.connectionSourceNodeId];
        const outputHandle = sourceNode.element.querySelectorAll('.output-handle')[state.connectionSourceIndex];
        
        if (outputHandle) {
            const sourceRect = outputHandle.getBoundingClientRect();
            const panRect = panLayer.getBoundingClientRect();
            
            const startX = (sourceRect.left + sourceRect.width/2 - panRect.left) / state.scale + off;
            const startY = (sourceRect.top + sourceRect.height/2 - panRect.top) / state.scale + off;
            
            // Temp end pos is already in workspace coords
            const endX = state.tempConnectionEndX + off;
            const endY = state.tempConnectionEndY + off;
            
            drawConnectionPath(startX, startY, endX, endY, true);
        }
    }
}

function drawConnectionPath(x1, y1, x2, y2, isTemp = false, sourceId = null, targetId = null, index = null) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.classList.add('connection');
    if (isTemp) path.classList.add('temp');
    if (sourceId && targetId) {
        path.dataset.source = sourceId;
        path.dataset.target = targetId;
        if (index !== null) path.dataset.index = index;
    }
    
    // Add mousedown listener for deletion
    if (!isTemp) {
        path.addEventListener('mousedown', handleConnectionMouseDown);
    }
    
    // Curvy bezier
    // Control points: pull out horizontally from source, pull in vertically/horizontally to target?
    // Output handle is on Right, Input is on Top Left corner (let's assume Top for simplicity or Left?)
    // Input handle is physically at top-left.
    
    // Standard Bezier: Start go Right, End arrive Left
    // But input is at top-left.
    
    const dx = Math.abs(x2 - x1);
    const controlOffset = Math.max(dx * 0.5, 50);
    
    const c1x = x1 + controlOffset;
    const c1y = y1;
    const c2x = x2 - controlOffset;
    const c2y = y2;

    const d = `M ${x1} ${y1} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x2} ${y2}`;
    path.setAttribute('d', d);
    
    connectionsLayer.appendChild(path);
}

function highlightConnections(nodeId) {
    // Find all paths where source OR target is this node
    const paths = connectionsLayer.querySelectorAll('path.connection');
    paths.forEach(path => {
        if (path.dataset.source === nodeId || path.dataset.target === nodeId) {
            path.classList.add('highlight');
        }
    });
}

function clearHighlights() {
    const paths = connectionsLayer.querySelectorAll('path.connection.highlight');
    paths.forEach(path => {
        path.classList.remove('highlight');
    });
}

// --- IO (Parser/Serializer) ---

function serialize() {
    let output = '';
    
    // Serialize Metadata
    if (state.metadata.programName) {
        output += `// @program_name ${state.metadata.programName}\n`;
    }
    if (state.metadata.titleAscii) {
        const lines = state.metadata.titleAscii.split('\n');
        lines.forEach(line => {
            output += `// @title_ascii ${line}\n`;
        });
        output += '\n';
    }

    Object.values(state.nodes).forEach(node => {
        // Write coordinates as a comment
        output += `# ${node.id}\n`;
        output += `// @pos ${Math.round(node.x)},${Math.round(node.y)}\n`;
        output += `${node.text.trim()}\n\n`;
        
        node.options.forEach(opt => {
            let line = `* ${opt.text}`;
            if (opt.next) line += ` -> ${opt.next}`;
            output += `${line}\n`;
            
            if (opt.response) {
                const responseLines = opt.response.split('\n');
                responseLines.forEach(rLine => {
                    output += `> ${rLine}\n`;
                });
            }
        });
        output += '\n';
    });
    return output;
}

function saveToFile() {
    const content = serialize();
    const docName = state.currentDocName || 'mundane';
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${docName}.txt`;
    a.click();
}

function parse(text) {
    const lines = text.split('\n');
    const newNodes = {};
    let currentId = null;
    let currentNode = null;
    
    // Reset metadata
    state.metadata = { programName: '', titleAscii: '' };
    
    // Default layout params
    let layoutX = 0;
    let layoutY = 0;
    
    lines.forEach(line => {
        const trimmed = line.trim();
        
        // Parse Metadata
        if (line.trim().startsWith('// @program_name')) {
            state.metadata.programName = line.trim().substring(16).trim();
            return;
        }
        if (line.startsWith('// @title_ascii')) {
            const part = line.substring(15); // Keep spaces
            state.metadata.titleAscii += part + '\n';
            return;
        }

        if (trimmed.startsWith('#')) {
            currentId = trimmed.substring(1).trim();
            currentNode = {
                id: currentId,
                x: layoutX,
                y: layoutY,
                text: '',
                options: []
            };
            newNodes[currentId] = currentNode;
            
            // Simple grid auto-layout for imported nodes without pos
            layoutX += 450;
            if (layoutX > 2000) {
                layoutX = 0;
                layoutY += 400;
            }
        } else if (trimmed.startsWith('// @pos')) {
            if (currentNode) {
                const parts = trimmed.split(' ')[2].split(',');
                currentNode.x = parseInt(parts[0]);
                currentNode.y = parseInt(parts[1]);
            }
        } else if (trimmed.startsWith('*')) {
            if (currentNode) {
                let optText = trimmed.substring(1).trim();
                let next = '';
                if (optText.includes('->')) {
                    const parts = optText.split('->');
                    optText = parts[0].trim();
                    next = parts[1].trim();
                }
                currentNode.options.push({ text: optText, next: next });
            }
        } else if (trimmed.startsWith('>')) {
            if (currentNode && currentNode.options.length > 0) {
                const lastOption = currentNode.options[currentNode.options.length - 1];
                const responseLine = line.substring(line.indexOf('>') + 1).trim();
                if (lastOption.response) {
                    lastOption.response += '\n' + responseLine;
                } else {
                    lastOption.response = responseLine;
                }
            }
        } else {
            if (currentNode && currentNode.options.length === 0) {
                // Skip comments if not processed above
                if (trimmed.startsWith('//')) return;
                
                if (currentNode.text) currentNode.text += '\n';
                currentNode.text += line; // Preserve indentation?
            }
        }
    });
    
    // Clean up trailing newlines in ASCII
    if (state.metadata.titleAscii) {
        state.metadata.titleAscii = state.metadata.titleAscii.replace(/\n$/, '');
    }
    
    return newNodes;
}

function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (ev) => {
        loadFromContent(ev.target.result, file.name.replace('.txt', ''));
    };
    reader.readAsText(file);
}

function loadFromContent(content, name) {
    // Clear current
    Object.values(state.nodes).forEach(n => n.element.remove());
    state.nodes = {};
    
    const loadedNodes = parse(content);
    
    Object.values(loadedNodes).forEach(n => {
        createNode(n.id, n.x, n.y, n.text.trim(), n.options);
    });
    
    setDocName(name);
    
    // Update last doc
    if (name) {
        localStorage.setItem(LAST_DOC_KEY, name);
    }

    // Wait for DOM to update so we can calculate handle positions
    setTimeout(() => {
        updateConnections();
        centerView();
        markSaved(); // Reset unsaved indicator on load
    }, 50);
}

// --- Local Storage & Menu ---

function getStorage() {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : {};
}

function setStorage(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function saveToLocalStorage() {
    let name = state.currentDocName;
    if (!name) {
        name = prompt("Enter document name:");
        if (!name) return;
        setDocName(name);
    }

    const content = serialize();
    const store = getStorage();
    store[name] = {
        content: content,
        timestamp: Date.now()
    };
    setStorage(store);
    localStorage.setItem(LAST_DOC_KEY, name); // Remember this doc
    markSaved();
    alert(`Saved "${name}" locally.`);
}

function renameDocument() {
    const oldName = state.currentDocName;
    const newName = prompt("Rename document:", oldName || "");
    
    if (!newName || newName === oldName) return;

    const store = getStorage();
    
    if (store[newName]) {
        if (!confirm(`Document "${newName}" already exists. Overwrite?`)) return;
    }

    // Save current content to new name
    const content = serialize();
    store[newName] = {
        content: content,
        timestamp: Date.now()
    };

    // If we are renaming an existing saved document, remove the old one
    if (oldName && store[oldName]) {
        delete store[oldName];
    }

    setStorage(store);
    setDocName(newName);
    localStorage.setItem(LAST_DOC_KEY, newName);
    markSaved(); // Rename acts as a save
    alert(`Renamed to "${newName}".`);
}

function openMenu() {
    updateDocList();
    modalOverlay.classList.remove('hidden');
}

function closeMenu() {
    modalOverlay.classList.add('hidden');
}

function createNewDoc() {
    if (Object.keys(state.nodes).length > 0) {
        if (!confirm("Are you sure? Unsaved changes will be lost.")) return;
    }
    
    Object.values(state.nodes).forEach(n => n.element.remove());
    state.nodes = {};
    setDocName(null);
    state.metadata = { programName: '', titleAscii: '' }; // Reset meta
    markSaved(); // Reset for new doc
    localStorage.removeItem(LAST_DOC_KEY); // Clear last doc
    updateConnections();
    centerView();
    closeMenu();
}

function updateDocList() {
    const store = getStorage();
    documentList.innerHTML = '';
    
    const sortedNames = Object.keys(store).sort((a, b) => store[b].timestamp - store[a].timestamp);
    
    if (sortedNames.length === 0) {
        documentList.innerHTML = '<div style="color: #666; padding: 20px; text-align: center;">No documents saved.</div>';
        return;
    }

    sortedNames.forEach(name => {
        const doc = store[name];
        const date = new Date(doc.timestamp).toLocaleDateString();
        
        const item = document.createElement('div');
        item.className = 'doc-item';
        
        const info = document.createElement('div');
        info.className = 'doc-info';
        info.innerHTML = `<span class="doc-name">${name}</span><span class="doc-date">${date}</span>`;
        info.onclick = () => {
            if (confirm(`Load "${name}"? Unsaved changes will be lost.`)) {
                loadFromContent(doc.content, name);
                closeMenu();
            }
        };
        
        const actions = document.createElement('div');
        actions.className = 'doc-actions';
        
        const delBtn = document.createElement('button');
        delBtn.className = 'btn-icon delete';
        delBtn.textContent = '×'; // Or trash icon
        delBtn.title = 'Delete';
        delBtn.onclick = (e) => {
            e.stopPropagation();
            if (confirm(`Permanently delete "${name}"?`)) {
                const s = getStorage();
                delete s[name];
                setStorage(s);
                updateDocList();
            }
        };
        
        actions.appendChild(delBtn);
        item.appendChild(info);
        item.appendChild(actions);
        documentList.appendChild(item);
    });
}

function setDocName(name) {
    state.currentDocName = name;
    currentDocNameDisplay.textContent = name ? name : '(Untitled)';
}

// --- Properties & Publish ---

function openProperties() {
    propProgramName.value = state.metadata.programName || state.currentDocName || '';
    propAsciiTitle.value = state.metadata.titleAscii || '';
    propsModalOverlay.classList.remove('hidden');
}

function closeProperties() {
    propsModalOverlay.classList.add('hidden');
}

function saveProperties() {
    state.metadata.programName = propProgramName.value.trim();
    state.metadata.titleAscii = propAsciiTitle.value;
    markUnsaved();
    closeProperties();
}

function playPreview() {
    // Auto-save properties if name provided
    if (propProgramName.value) saveProperties();
    
    const content = serialize();
    localStorage.setItem(PREVIEW_KEY, content);
    
    // Open terminal in preview mode
    // We assume index.html is in the parent directory or same directory
    // The layout is /editor.html and /index.html
    window.open('index.html?preview=true', '_blank');
}

function openReleaseMenu() {
    // Ensure properties are saved/updated
    if (!state.metadata.programName) {
        openProperties();
        alert('Please set a Program Name first.');
        return;
    }
    
    // Prepare JSON snippet
    const progName = state.metadata.programName;
    const jsonSnippet = {
        name: progName,
        type: "executable",
        size: 2048, // Estimate
        path: `apps/${progName}.txt`,
        engine: "quest",
        location: "~/programs"
    };
    
    releaseJsonCode.textContent = JSON.stringify(jsonSnippet, null, 2);
    releaseModalOverlay.classList.remove('hidden');
}

function closeRelease() {
    releaseModalOverlay.classList.add('hidden');
}

function downloadReleaseFile() {
    saveToFile(); // Re-use existing download, name is already set
}

function copyReleaseJson() {
    const range = document.createRange();
    range.selectNode(releaseJsonCode);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
    document.execCommand('copy');
    window.getSelection().removeAllRanges();
    
    const btn = document.getElementById('btn-copy-json');
    const originalText = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(() => btn.textContent = originalText, 2000);
}

// Start
init();
