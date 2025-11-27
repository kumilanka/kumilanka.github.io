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
    try {
        const response = await fetch('apps/mundane.txt');
        if (!response.ok) throw new Error('Failed to load scenario');
        const text = await response.text();
        scenes = parseScenario(text);
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
            return this.renderScene(currentSceneId);
        },

        printTitle: function() {
             const title = `
  __  __                 _                  
 |  \\/  |_   _ _ __   __| | __ _ _ __   ___ 
 | |\\/| | | | | '_ \\ / _\` |/ _\` | '_ \\ / _ \\
 | |  | | |_| | | | | (_| | (_| | | | |  __/
 |_|  |_|\\__,_|_| |_|\\__,_|\\__,_|_| |_|\\___|
   ___                 _   
  / _ \\ _   _  ___ ___| |_ 
 | | | | | | | |/ _ / __| __|
 | |_| | |_| |  __\\__ \\ |_ 
  \\__\\_\\\\__,_|\\___|___/\\__|`;
            if (window.terminal && window.terminal.addOutput) {
                window.terminal.addOutput(title, 'output ascii-art');
            }
        },

        renderScene: function(sceneId) {
            const scene = scenes[sceneId];
            if (!scene) return "Error: Scene not found.";

            let output = `\n${scene.text}\n\n`;
            
            if (scene.options && scene.options.length > 0) {
                scene.options.forEach((opt, index) => {
                    output += `[${index + 1}] ${opt.text}\n`;
                });
            } else {
                output += "[Press Enter to continue]";
            }

            return output;
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
                return this.renderScene(currentSceneId);
            } else if (choice.response) {
                // Stay on scene but maybe reprint text? 
                // Logic from previous version: reprint scene options
                return this.renderScene(currentSceneId);
            }
            
            return "The path ends here.";
        }
    };

    // Register the app
    if (window.terminal && window.terminal.registerApp) {
        window.terminal.registerApp('mundane', questApp);
    }
})();
