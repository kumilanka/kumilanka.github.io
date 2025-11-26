(function() {
    // Game State
    let currentSceneId = 'start';

    // Scene Definitions
    const scenes = {
        'start': {
            text: "You're Dad. You jerk awake to the vibration on your wrist. It's 5:45. Time for the first choice of the day.",
            options: [
                { text: "Get out of bed", next: 'bedroom' },
                { text: "Snooze the watch", next: 'bed' }
            ]
        },
        'bedroom': {
            text: "You remove the warm, cozy blanket and torture yourself with the cold air. Another day, another battle to fight. You're now standing next to the bed in your underwear.",
            options: [
                { text: "Tip toe to the bathroom", next: 'bathroom' },
                { text: "Fuck it, I'm going back to bed", next: 'bed' }
            ]
        },
        'bed': {
            text: "You're wrapped up in your warm cocoon, safe from the looming responsibilities awaiting you outside. You know you're only delaying the inevitable.",
            options: [
                { text: "Get out of bed", next: 'bedroom' },
                { text: "Linger in your nest", next: 'bed2' }
            ]
        },
        'bed2': {
            text: "You feel the spirit of Marcus Aurelius gaze at you in contempt. You should be up, doing human things.",
            options: [
                { text: "Get out of bed, damn it", next: 'bedroom' },
                { text: "I bet Marcus didn't have a bed as warm and comfortable as this one", next: 'bed3' }
            ]
        },
        'bed3': {
            text: "As you meditate in your dark womb, time passes. It's now too late to go for your long morning walk before the kids wake up. This choice leads to a timeline where eventually you develop heart disease and die in your 50s. How tragic. You never get to meet your grandchildren.",
            options: [
                { 
                    text: "But the warmth...", 
                    response: "Your path in the warmth timeline is sealed.",
                    action: 'exit' 
                }
            ]
        },
        'bathroom': {
            text: "You're in the small, cluttered bathroom. You have a routine. Specific steps to execute in a specific order.",
            options: [
                { text: "Take a piss", next: 'piss' }
            ]
        },
        'piss': {
            text: "You sit down on the toilet like your mother taught you. Yellow water comes out of you, but does not make a mess.",
            options: [
                { text: "Continue this fantastic adventure IN THE NEXT EPISODE.", action: 'exit' }
            ]
        }
    };

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
 | | | | | | |/ _ / __| __|
 | |_| | |_| |  __\\__ \\ |_ 
  \\__\\_\\\\__,_|\\___|___/\\__|`;
            // Use global addOutput if available, otherwise console
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

            // Handle "exit" globally
            if (input === 'exit') {
                return { action: 'exit', message: 'Quest abandoned.' };
            }

            // Handle empty input for "Continue" scenes
            if ((!scene.options || scene.options.length === 0) && input === '') {
                 // Logic for linear progression if we had it, but here we usually have options.
                 // If we want a "Press Enter" node, we could make it transition automatically or have a default next.
                 // For now, let's assume valid scenes always have options in this specific demo structure, 
                 // or we add a 'defaultNext' property.
                 // Let's assume the user pressed enter on a choice-less scene if we had one.
                 return "Please enter a command or number.";
            }

            const choiceIndex = parseInt(input) - 1;
            
            if (isNaN(choiceIndex) || choiceIndex < 0 || choiceIndex >= scene.options.length) {
                return "Invalid option. Type the number of your choice.";
            }

            const choice = scene.options[choiceIndex];
            
            // Handle option response
            if (choice.response) {
                let responseOutput = `\n> ${choice.text}\n${choice.response}`;
                if (window.terminal && window.terminal.addOutput) {
                    window.terminal.addOutput(responseOutput);
                }
            }

            if (choice.action === 'exit') {
                return { action: 'exit', message: 'I will see you around...' };
            }

            if (choice.next) {
                currentSceneId = choice.next;
                return this.renderScene(currentSceneId);
            } else if (choice.response) {
                // If there's a response but no next scene, maybe we stay? 
                // Or reprint the current scene options?
                // For now, let's reprint current scene options without description if possible,
                // or just reprint everything.
                return this.renderScene(currentSceneId);
            }

            return "Something went wrong.";
        }
    };

    // Register the app
    if (window.terminal && window.terminal.registerApp) {
        window.terminal.registerApp('mundane', questApp);
    }
})();
