(async function() {
    // Parser function
    function parseScenario(text) {
        const scenes = {};
        let currentScene = null;
        let currentOption = null;

        const lines = text.split('\n');
        
        for (let line of lines) {
            const trimmed = line.trim();
            
            // Skip empty lines if we're not in a text block or if they are just separators
            // Actually, we want to preserve empty lines in text, but maybe handle them smartly.
            // For this simple parser: 
            // - # starts new scene
            // - * starts new option
            // - > starts response
            // - Anything else is scene text (if scene exists and no options yet)
            
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
                    // We want to preserve newlines in response if multiple > lines
                    if (currentOption.response) {
                        currentOption.response += '\n' + responseLine.trim(); // Trim line for cleaner append? Or keep raw?
                        // Let's trim strictly to avoid indentation issues
                    } else {
                        currentOption.response = responseLine.trim();
                    }
                }
            } else if (trimmed.startsWith('//')) {
                // Comment - ignore, unless we are in an ascii art block?
                // But ASCII art is usually in code, not in the text file.
                // The text file 'mundane.txt' is just scenarios.
                // The Title is in the code below (lines 135-145).
                // The parser is only used for mundane.txt.
                // If the title is broken, it's because of something else?
                // Wait, the user said "ascii text logo... broken AFTER // comment changes".
                // The changes were only to this parser function.
                // Does the user mean the title defined in printTitle()? 
                // Or is there ASCII art in mundane.txt?
                // Let's assume the title in printTitle is fine (it's a string literal).
                // Maybe the issue is that the parser is stripping empty lines or processing lines incorrectly?
                // Or maybe the ASCII art contains `//`?
                // The title in line 122 doesn't have `//`.
                // Let's look at mundane.txt.
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

    try {
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
    } catch (e) {
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
        name: 'mundane',
        placeholder: 'Enter option number...',
        
        start: function() {
            currentSceneId = 'start';
            this.printTitle();
            const result = this.renderScene(currentSceneId);
            if (window.terminal && window.terminal.addOutput) {
                 window.terminal.addOutput(result.message, 'output');
            }
            // We return null here because we handled output manually to support HTML if needed,
            // OR we adapt renderScene to return string and we let caller handle it.
            // But wait, the previous contract was return string. 
            // Let's just return the string if possible, but now we have HTML tags.
            // The terminal addOutput handles textContent by default, unless we change it to innerHTML?
            // Looking at script.js, addOutput sets textContent. We need to update script.js to support HTML.
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
 | | | | | | | | |/ _ / __| __|
 | |_| | |_| |  __\\__ \\ |_ 
  \\__\\_\\\\__,_|\\___|___/\\__|`;
            if (window.terminal && window.terminal.addOutput) {
                window.terminal.addOutput(title, 'output ascii-art');
            }
        },

        renderScene: function(sceneId) {
            const scene = scenes[sceneId];
            if (!scene) return "Error: Scene not found.";

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

            // Handle empty input when there's only one option
            if (scene.options && scene.options.length === 1 && input === '') {
                const choice = scene.options[0];
                return this.executeChoice(choice);
            }

            if ((!scene.options || scene.options.length === 0) && input === '') {
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
    if (window.terminal && window.terminal.registerApp) {
        window.terminal.registerApp('mundane', questApp);
    }
})();
