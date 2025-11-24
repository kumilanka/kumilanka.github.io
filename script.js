// Terminal state
const terminalOutput = document.getElementById('terminal-output');
const commandInput = document.getElementById('command-input');
let commandHistory = [];
let historyIndex = -1;
let currentPath = '~';
let fileListCache = null; // Cache for file list

// Initial welcome message
addOutput('Welcome to kumilanka\'s terminal', 'output');
addOutput('Type \'help\' for available commands', 'output comment');

// Command definitions
const commands = {
    help: () => {
        return `Available commands:
  help          - Show this help message
  whoami        - Display current user
  pwd           - Print working directory
  ls [dir]      - List directory contents
  cat [file]    - Display file contents
  date          - Show current date and time
  clear         - Clear the terminal
  echo [text]   - Echo text to terminal
  cd [dir]      - Change directory (limited)
  uname         - Show system information
            neofetch      - Display system info (ASCII art style)
  sudo [cmd]    - Execute a command as superuser`;
    },
    make: (args) => {
        if (args.join(' ') === 'me a sandwich') {
            return 'What? Make it yourself.';
        }
        return `make: *** No rule to make target '${args.join(' ')}'.  Stop.`;
    },
    sudo: async (args) => {
        if (args.length === 0) {
            return 'usage: sudo command';
        }
        if (args.join(' ') === 'make me a sandwich') {
            return `Okay.
          ____
        /      \\
   ____/  ____  \\____
  /    \\ /    \\ /    \\
 |______|______|______|
 (      (      )      )
  \\______\\____/______/`;
        }
        
        // Passthrough for other commands
        const cmd = args[0];
        const cmdArgs = args.slice(1);
        if (commands[cmd]) {
            // Note: In a real system this would run with elevated privileges
            // Here we just run it normally, maybe with a different user prompt if we had one
            return await commands[cmd](cmdArgs);
        } else {
            return `sudo: ${cmd}: command not found`;
        }
    },
    whoami: () => {
        return 'kumilanka';
    },
    pwd: () => {
        return currentPath === '~' ? '/home/kumilanka' : currentPath;
    },
    ls: async (args) => {
        // Handle flags
        const hasLa = args.includes('-la') || args.includes('-l') || args.includes('-a');
        const dir = args.find(arg => !arg.startsWith('-')) || currentPath;
        
        if (dir === '~' || dir === '/home/kumilanka' || dir === '.' || !dir) {
            try {
                // Fetch actual file list
                const response = await fetch('files.json');
                if (response.ok) {
                    const data = await response.json();
                    const files = data.files || [];
                    
                    if (hasLa) {
                        // Format like ls -la
                        let output = `total ${files.length}\n`;
                        output += `drwxr-xr-x  2 kumilanka kumilanka 4096 Jan  1 00:00 .\n`;
                        output += `drwxr-xr-x  3 root      root      4096 Jan  1 00:00 ..\n`;
                        
                        files.forEach(file => {
                            const type = file.type === 'directory' ? 'd' : '-';
                            const perms = file.type === 'directory' ? 'rwxr-xr-x' : 'rw-r--r--';
                            const size = file.size || 0;
                            const date = 'Jan  1 00:00';
                            output += `${type}${perms}  1 kumilanka kumilanka ${size.toString().padStart(5)} ${date} ${file.name}\n`;
                        });
                        
                        return output.trim();
                    } else {
                        // Simple list
                        return files.map(f => f.name).join('  ');
                    }
                } else {
                    // Fallback if files.json doesn't exist
                    return `README.txt`;
                }
            } catch (error) {
                // Fallback on error
                return `README.txt`;
            }
        } else {
            return `ls: cannot access '${dir}': No such file or directory`;
        }
    },
    cat: async (args) => {
        if (!args[0]) {
            return 'cat: missing file operand\nTry \'cat --help\' for more information.';
        }
        const file = args[0];
        // Clean up the filename (remove ./ or ~/)
        let cleanFile = file.replace(/^\.\//, '').replace(/^~\//, '');
        
        // Look in the home subfolder
        if (!cleanFile.startsWith('home/')) {
            cleanFile = 'home/' + cleanFile;
        }
        
        try {
            const response = await fetch(cleanFile);
            if (response.ok) {
                const content = await response.text();
                return content.trim();
            } else {
                return `cat: ${file}: No such file or directory`;
            }
        } catch (error) {
            return `cat: ${file}: No such file or directory`;
        }
    },
    date: () => {
        const now = new Date();
        return now.toLocaleString('en-US', { 
            weekday: 'short', 
            month: 'short', 
            day: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit', 
            year: 'numeric',
            timeZoneName: 'short'
        });
    },
    clear: () => {
        terminalOutput.innerHTML = '';
        return null; // Don't add output for clear
    },
    echo: (args) => {
        return args.join(' ');
    },
    cd: (args) => {
        const dir = args[0] || '~';
        if (dir === '~' || dir === '/home/kumilanka') {
            currentPath = '~';
            return null; // cd doesn't output on success
        } else if (dir === '..') {
            currentPath = '~';
            return null;
        } else {
            return `bash: cd: ${dir}: No such file or directory`;
        }
    },
    uname: (args) => {
        const flag = args[0];
        if (flag === '-a') {
            return 'Linux terminal 6.0.0-generic #1 SMP PREEMPT_DYNAMIC x86_64 GNU/Linux';
        } else if (flag === '-r') {
            return '6.0.0-generic';
        } else if (flag === '-m') {
            return 'x86_64';
        } else {
            return 'Linux';
        }
    },
    neofetch: () => {
        return `       _nnnn_                      kumilanka@terminal
      dGGGGMMb     ,"""""""""""""""""""""""""""""""""""""""""""""""""""".
     @p~qp~~qMb    |  OS: Terminal Linux x86_64                          |
     M|@||@) M|   |  Host: Virtual Terminal                              |
     @,----.JM|   |  Kernel: 6.0.0-generic                               |
    JS^\\__/  qKL  |  Uptime: Always running                             |
   dZP        qKRb|  Shell: /bin/bash                                    |
  dZP          qKKb|  Terminal: Web Terminal v1.0                        |
 @ZP            SKKb|  CPU: Virtual CPU @ 2.0GHz                         |
 @ZM            MKK@|  Memory: 512MB / 2GB                               |
  @ZMM          MMKK@|  Disk: 10GB / 100GB (10%)                          |
   *Wq       .qKL   |                                                    |
     *W     WqKL    |  "Welcome to my terminal!"                         |
      *W.  .WqK     |                                                    |
        *WWWqK      |  Type 'help' for commands                           |
          *qK       '""""""""""""""""""""""""""""""""""""""""""""""""""""'`;
    }
};

// Helper function to add output to terminal
function addOutput(text, className = 'output') {
    if (text === null) return; // Skip null outputs (like successful cd)
    
    const outputDiv = document.createElement('div');
    outputDiv.className = className;
    
    // Detect ASCII art (lines longer than 100 characters indicate ASCII art)
    const lines = text.split('\n');
    const hasLongLines = lines.some(line => line.length > 100);
    if (hasLongLines) {
        outputDiv.classList.add('ascii-art');
    }
    
    outputDiv.textContent = text;
    terminalOutput.appendChild(outputDiv);
    terminalOutput.scrollTop = terminalOutput.scrollHeight;
}

// Helper function to add command line to history
function addCommandLine(command) {
    const promptLine = document.createElement('div');
    promptLine.className = 'prompt-line';
    promptLine.innerHTML = `
        <span class="prompt">
            <span class="user">kumilanka</span>@<span class="host">terminal</span>:<span class="path">${currentPath}</span>$ 
        </span>
        <span class="command">${escapeHtml(command)}</span>
    `;
    terminalOutput.appendChild(promptLine);
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Process command
async function processCommand(input) {
    if (!input.trim()) return;

    // Add to history
    commandHistory.push(input);
    historyIndex = commandHistory.length;

    // Add command line to output
    addCommandLine(input);

    // Parse command and arguments
    const parts = input.trim().split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);

    // Execute command
    if (commands[cmd]) {
        try {
            const result = await commands[cmd](args);
            if (result !== null && result !== undefined) {
                addOutput(result);
            }
        } catch (error) {
            addOutput(`Error executing command: ${error.message}`, 'error');
        }
    } else {
        addOutput(`Command not found: ${cmd}. Type 'help' for available commands.`, 'error');
    }

    // Scroll to bottom
    terminalOutput.scrollTop = terminalOutput.scrollHeight;
}

// Handle input
commandInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        const command = commandInput.value;
        processCommand(command);
        commandInput.value = '';
        historyIndex = commandHistory.length;
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (commandHistory.length > 0) {
            historyIndex = Math.max(0, historyIndex - 1);
            commandInput.value = commandHistory[historyIndex] || '';
        }
    } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (historyIndex < commandHistory.length - 1) {
            historyIndex++;
            commandInput.value = commandHistory[historyIndex] || '';
        } else {
            historyIndex = commandHistory.length;
            commandInput.value = '';
        }
    } else if (e.key === 'Tab') {
        e.preventDefault();
        handleTabCompletion();
    }
});

// Load file list for autocomplete
async function loadFileList() {
    if (fileListCache) return fileListCache;
    
    try {
        const response = await fetch('files.json');
        if (response.ok) {
            const data = await response.json();
            fileListCache = (data.files || []).map(f => f.name);
            return fileListCache;
        }
    } catch (error) {
        console.error('Error loading file list:', error);
    }
    return [];
}

// Handle tab completion for commands and filenames
async function handleTabCompletion() {
    const input = commandInput.value;
    const cursorPos = commandInput.selectionStart;
    const textBeforeCursor = input.substring(0, cursorPos);
    const textAfterCursor = input.substring(cursorPos);
    const parts = textBeforeCursor.trim().split(/\s+/);
    
    if (parts.length === 1 || (parts.length === 2 && textBeforeCursor.endsWith(' '))) {
        // Command completion
        const cmd = parts[0].toLowerCase();
        const matches = Object.keys(commands).filter(c => c.startsWith(cmd));
        if (matches.length === 1) {
            commandInput.value = matches[0] + ' ' + textAfterCursor;
            commandInput.setSelectionRange(matches[0].length + 1, matches[0].length + 1);
        } else if (matches.length > 1) {
            // Multiple matches - complete common prefix
            const commonPrefix = getCommonPrefix(matches);
            if (commonPrefix.length > cmd.length) {
                commandInput.value = commonPrefix + textAfterCursor;
                commandInput.setSelectionRange(commonPrefix.length, commonPrefix.length);
            }
        }
    } else if (parts.length >= 2) {
        // Filename completion (for commands that take files)
        const cmd = parts[0].toLowerCase();
        const fileCommands = ['cat', 'ls', 'cd']; // Commands that can take filenames
        
        if (fileCommands.includes(cmd)) {
            const partialFile = parts[parts.length - 1];
            const files = await loadFileList();
            
            // Filter files that start with the partial name
            const matches = files.filter(f => f.startsWith(partialFile));
            
            if (matches.length === 1) {
                // Single match - complete it
                const newValue = parts.slice(0, -1).join(' ') + ' ' + matches[0] + textAfterCursor;
                commandInput.value = newValue;
                commandInput.setSelectionRange(newValue.length - textAfterCursor.length, newValue.length - textAfterCursor.length);
            } else if (matches.length > 1) {
                // Multiple matches - complete common prefix
                const commonPrefix = getCommonPrefix(matches);
                if (commonPrefix.length > partialFile.length) {
                    const newValue = parts.slice(0, -1).join(' ') + ' ' + commonPrefix + textAfterCursor;
                    commandInput.value = newValue;
                    commandInput.setSelectionRange(newValue.length - textAfterCursor.length, newValue.length - textAfterCursor.length);
                }
            }
        }
    }
}

// Helper function to find common prefix of strings
function getCommonPrefix(strings) {
    if (strings.length === 0) return '';
    if (strings.length === 1) return strings[0];
    
    let prefix = strings[0];
    for (let i = 1; i < strings.length; i++) {
        while (!strings[i].startsWith(prefix)) {
            prefix = prefix.slice(0, -1);
            if (prefix === '') return '';
        }
    }
    return prefix;
}

// Keep focus on input
commandInput.addEventListener('blur', () => {
    setTimeout(() => commandInput.focus(), 0);
});

// Focus input on page load and preload file list
commandInput.focus();
loadFileList(); // Preload file list for faster autocomplete
