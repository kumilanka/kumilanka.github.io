(async function() {
    // Parser function
    function parseScenario(text) {
        const scenes = {};
        let currentScene = null;
        let currentOption = null;

        const lines = text.split('\n');
        
        for (let line of lines) {
            const trimmed = line.trim();
            
            // Skip metadata comments
            if (trimmed.startsWith('// @')) continue;

            if (trimmed.startsWith('#')) {
                // New Scene
                const id = trimmed.substring(1).trim();
                currentScene = {
                    id: id,
                    text: '',
                    options: []
                };
                scenes[id] = currentScene;
                currentOption = null;
            } else if (trimmed.startsWith('*')) {
                // Option
                if (!currentScene) continue;
                
                let optText = trimmed.substring(1).trim();
                let next = null;
                let action = null;

                // Check for [action]
                const actionMatch = optText.match(/\[(.*?)\]/);
                if (actionMatch) {
                    action = actionMatch[1];
                    optText = optText.replace(actionMatch[0], '').trim();
                }

                // Check for -> next
                if (optText.includes('->')) {
                    const parts = optText.split('->');
                    optText = parts[0].trim();
                    next = parts[1].trim();
                }

                currentOption = {
                    text: optText,
                    next: next,
                    action: action
                };
                currentScene.options.push(currentOption);
            } else if (trimmed.startsWith('>')) {
                // Response to previous option
                if (currentOption) {
                    const responseLine = line.substring(line.indexOf('>') + 1); // Keep leading spaces if any, but trim >
                    if (currentOption.response) {
                        currentOption.response += '\n' + responseLine.trim();
                    } else {
                        currentOption.response = responseLine.trim();
                    }
                }
            } else if (trimmed.startsWith('//')) {
                // Comment - ignore
                continue;
            } else {
                // Scene Text
                if (currentScene && currentScene.options.length === 0) {
                    // Only add text if we haven't started options yet
                    if (currentScene.text) {
                        currentScene.text += '\n' + line;
                    } else {
                        currentScene.text = line;
                    }
                }
            }
        }

        // Post-processing to clean up text (trim extra newlines)
        for (const id in scenes) {
            scenes[id].text = scenes[id].text.trim();
        }

        return scenes;
    }

    // Load content
    let scenes = {};
    let logoText = '';

    // Identify which app is running
    // script.js sets window.activeApp = { name: '...' } before loading script
    const appName = (window.activeApp && window.activeApp.name) || 'mundane';

    try {
        // Check for direct content (Preview Mode)
        if (window.activeApp && window.activeApp.content) {
            const content = window.activeApp.content;
            scenes = parseScenario(content);
            
            // Extract ASCII Title from content
            const lines = content.split('\n');
            let asciiAccumulator = '';
            for (let line of lines) {
                if (line.startsWith('// @title_ascii')) {
                    const part = line.substring(15);
                    asciiAccumulator += part + '\n';
                }
            }
            if (asciiAccumulator) logoText = asciiAccumulator;

        } else {
            // Check VFS for published apps first (Legacy/Local Install)
            const vfs = JSON.parse(localStorage.getItem('term_vfs_programs') || '{}');
            
            if (vfs[appName]) {
                // Load from Virtual File System
                const content = vfs[appName].content;
                scenes = parseScenario(content);
                
                // Extract ASCII Title from metadata comments
                const lines = content.split('\n');
                let asciiAccumulator = '';
                for (let line of lines) {
                    if (line.startsWith('// @title_ascii')) {
                        const part = line.substring(15);
                        asciiAccumulator += part + '\n';
                    }
                }
                if (asciiAccumulator) logoText = asciiAccumulator;
                
            } else {
                // Fallback to fetching files (legacy/default 'mundane' behavior)
                if (appName === 'mundane') {
                    const [scenarioRes, logoRes] = await Promise.all([
                        fetch('apps/mundane.txt'),
                        fetch('apps/mq_logo.txt')
                    ]);
        
                    if (!scenarioRes.ok) throw new Error('Failed to load scenario');
                    const text = await scenarioRes.text();
                    scenes = parseScenario(text);
        
                    if (logoRes.ok) {
                        logoText = await logoRes.text();
                    }
                } else if (window.activeApp && window.activeApp.path) {
                    // Load from real file path provided by files.json via script.js
                    const scenarioRes = await fetch(window.activeApp.path);
                    if (!scenarioRes.ok) throw new Error(`Failed to load ${window.activeApp.path}`);
                    const text = await scenarioRes.text();
                    scenes = parseScenario(text);
                    
                    // Extract ASCII Title from metadata comments in the file
                    const lines = text.split('\n');
                    let asciiAccumulator = '';
                    for (let line of lines) {
                        if (line.startsWith('// @title_ascii')) {
                            const part = line.substring(15);
                            asciiAccumulator += part + '\n';
                        }
                    }
                    if (asciiAccumulator) logoText = asciiAccumulator;
                } else {
                    throw new Error(`Program "${appName}" not found.`);
                }
            }
        }
    } catch (e) {
        console.error(e);
        scenes = {
            'start': {
                text: "Error loading story file: " + e.message,
                options: []
            }
        };
    }

    // Game State
    let currentSceneId = 'start';

    const questApp = {
        name: appName,
        placeholder: 'Enter option number...',
        
        start: function() {
            currentSceneId = 'start';
            // Check if start scene exists
            if (!scenes['start']) {
                // If no start scene, find the first one
                const keys = Object.keys(scenes);
                if (keys.length > 0) currentSceneId = keys[0];
            }
            
            this.printTitle();
            const result = this.renderScene(currentSceneId);
            if (window.terminal && window.terminal.addOutput) {
                 window.terminal.addOutput(result.message, 'output');
            }
            return null; 
        },

        printTitle: function() {
             const title = logoText || `
  __  __                 _                  
 |  \\/  |_   _ _ __   __| | __ _ _ __   ___ 
 | |\\/| | | | | '_ \\ / _\` |/ _\` | '_ \\ / _ \\
 | |  | | |_| | | | | (_| | (_| | | | |  __/
 |_|  |_|\\__,_|_| |_|\\__,_|\\__,_|_| |_|\\___|
   ___                 _   
  / _ \\ _   _  ___ ___| |_ 
  | | | | | | | | | |/ _ / __| __|
  | |_| | |_| |  __\\__ \\ |_ 
  \\__\\_\\\\__,_|\\___|___/\\__|`;
            if (window.terminal && window.terminal.addOutput) {
                window.terminal.addOutput(title, 'output ascii-art');
            }
        },

        renderScene: function(sceneId) {
            const scene = scenes[sceneId];
            if (!scene) return { message: "Error: Scene not found.", isHtml: false };

            let output = '';
            // Scene text wrapping
            if (scene.text) {
                output += `<div class='quest-text'>${scene.text}</div>\n`;
            }
            
            if (scene.options && scene.options.length > 0) {
                scene.options.forEach((opt, index) => {
                    output += `<div class='quest-choice'>[${index + 1}] ${opt.text}</div>`;
                });
            } else {
                output += "<div class='quest-choice'>[Press Enter to continue]</div>";
            }

            return { message: output, isHtml: true };
        },

        handleInput: function(input) {
            const scene = scenes[currentSceneId];
            input = input.trim();

            if (input === 'exit') {
                return { action: 'exit' };
            }

            // Handle empty input when there's only one option (continue)
            if (scene && scene.options && scene.options.length === 1 && input === '') {
                const choice = scene.options[0];
                return this.executeChoice(choice);
            }
            
            // Handle empty input when no options (end of story or click to continue?)
            // Actually if no options, it's usually end of branch unless we want a 'next'
            if (scene && (!scene.options || scene.options.length === 0) && input === '') {
                 return "Please enter a command or number.";
            }

            const choiceIndex = parseInt(input) - 1;
            
            if (isNaN(choiceIndex) || choiceIndex < 0 || choiceIndex >= scene.options.length) {
                return "Invalid option. Type the number of your choice.";
            }

            const choice = scene.options[choiceIndex];
            return this.executeChoice(choice);
        },

        executeChoice: function(choice) {
            // Handle option response
            if (choice.response) {
                let responseOutput = `\n${choice.response}`;
                if (window.terminal && window.terminal.addOutput) {
                    window.terminal.addOutput(responseOutput);
                }
            }

            if (choice.action === 'exit') {
                return { action: 'exit' };
            }

            if (choice.next) {
                currentSceneId = choice.next;
                const result = this.renderScene(currentSceneId);
                return { message: result.message, isHtml: true };
            } else if (choice.response) {
                // Stay on scene but maybe reprint text? 
                // Logic from previous version: reprint scene options
                const result = this.renderScene(currentSceneId);
                return { message: result.message, isHtml: true };
            }
            
            return "The path ends here.";
        }
    };

    // Register the app
    // We register it under the appName found in activeApp or default 'mundane'
    if (window.terminal && window.terminal.registerApp) {
        window.terminal.registerApp(appName, questApp);
    } else if (window.activeApp && window.activeApp.name === 'preview') {
        // Fallback logic removed as it was mostly for debugging. 
        // If registerApp isn't called, something is wrong with race conditions.
    }
})();
