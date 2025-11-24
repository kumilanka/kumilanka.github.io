(function() {
    const targetNumber = Math.floor(Math.random() * 100) + 1;
    let attempts = 0;

    const guessApp = {
        name: 'guess',
        placeholder: 'Enter your guess...',
        start: function() {
            this.printHeader();
            return "I'm thinking of a number between 1 and 100.\nType 'exit' to quit.";
        },
        printHeader: function() {
             // Simple ASCII header
             const header = `
   ____                     
  / ___|_   _  ___ ___ ___  
 | |  _| | | |/ _ / __/ __| 
 | |_| | |_| |  __\\__ \\__ \\ 
  \\____|\\__,_|\\___|___/___/ 
                            `;
            // using the global addOutput function from script.js
            // We might need to ensure it's available or passed in.
            // For now assuming global access or we will pass it.
            // But to be safe, let's assume the system passes a 'terminal' object with helpers.
            window.terminal.addOutput(header, 'ascii-art');
        },
        handleInput: function(input) {
            input = input.trim();
            if (input === 'exit' || input === 'quit') {
                return { action: 'exit', message: 'Thanks for playing!' };
            }
            
            const guess = parseInt(input);
            if (isNaN(guess)) {
                return "Please enter a valid number.";
            }
            
            attempts++;
            
            if (guess === targetNumber) {
                return { 
                    action: 'exit', 
                    message: `Correct! You got it in ${attempts} attempts.` 
                };
            } else if (guess < targetNumber) {
                return "Too low! Try again.";
            } else {
                return "Too high! Try again.";
            }
        }
    };

    // Register the app
    if (window.terminal && window.terminal.registerApp) {
        window.terminal.registerApp('guess', guessApp);
    } else {
        console.error('Terminal framework not found');
    }
})();

