// Terminal state
const terminalOutput = document.getElementById('terminal-output');
const commandInput = document.getElementById('command-input');
const promptContainer = document.querySelector('.prompt');
let commandHistory = [];
let historyIndex = -1;
let currentPath = '~';
let fileListCache = null; // Cache for file list
window.activeApp = null; // Track running app globally for external scripts

// Initial welcome message (unless preview)
const urlParams = new URLSearchParams(window.location.search);
const isPreview = urlParams.get('preview') === 'true';

// Removed early welcome message block to avoid duplication/logic split


// App Registration
window.terminal = {
    addOutput: addOutput,
    registerApp: function(name, appObj) {
        // We need to match the registered app to the activeApp context
        // If activeApp is generic (isLoading), we assign the impl to it
        if (window.activeApp && window.activeApp.isLoading) {
            // If the app script registers 'mundane' but we loaded it as 'my_quest',
            // we should accept it if it's the only thing loading.
            // OR we enforce that the app registers under the name we expect?
            // apps/quest.js now registers under activeApp.name, so it matches.
            
            if (window.activeApp.name === name) {
                window.activeApp = appObj;
                updatePrompt(); 
                const result = window.activeApp.start();
                if (result) addOutput(result);
            }
        }
    }
};

// Helper to clean path
function cleanPath(path) {
    return path.endsWith('/') && path.length > 1 ? path.slice(0, -1) : path;
}

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
  tetraemon     - Play Tetraemon (opens in new tab)
  sudo [cmd]    - Execute a command as superuser`;
    },
    tetraemon: () => {
        window.open('https://kumilanka.itch.io/tetraemon', '_blank');
        return 'Opening Tetraemon in a new tab...';
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
            return await commands[cmd](cmdArgs);
        } else {
            return `sudo: ${cmd}: command not found`;
        }
    },
    whoami: () => {
        return 'kumilanka';
    },
    pwd: () => {
        return currentPath === '~' ? '/home/kumilanka' : currentPath.replace('~', '/home/kumilanka');
    },
    ls: async (args) => {
        // Handle flags
        const hasLa = args.includes('-la') || args.includes('-l') || args.includes('-a');
        const dirArg = args.find(arg => !arg.startsWith('-'));
        
        let targetPath = currentPath;
        if (dirArg) {
            if (dirArg === '~' || dirArg === '/home/kumilanka') targetPath = '~';
            else if (dirArg === '.') targetPath = currentPath;
            else if (dirArg === '..') {
                 // Resolve parent
                 if (currentPath === '~') targetPath = '~'; // Stay at root
                 else {
                     const parts = currentPath.split('/');
                     parts.pop();
                     targetPath = parts.join('/');
                     if (targetPath === '') targetPath = '~';
                 }
            } else {
                // Resolve relative or absolute
                if (dirArg.startsWith('/')) {
                     // We don't support full fs, so assume it maps to ~ structure
                     // e.g. /home/kumilanka/programs -> ~/programs
                     if (dirArg.startsWith('/home/kumilanka')) {
                         targetPath = dirArg.replace('/home/kumilanka', '~');
                     } else {
                         return `ls: cannot access '${dirArg}': No such file or directory`;
                     }
                } else {
                     targetPath = currentPath === '~' ? `~/${dirArg}` : `${currentPath}/${dirArg}`;
                }
            }
        }

        // Clean path (remove trailing slash)
        targetPath = cleanPath(targetPath);
        
        try {
            // Fetch actual file list
            const fileList = await loadFileList();
            // Filter files in the target directory
            // We check if file.location === targetPath
            const files = (fileList || []).filter(f => cleanPath(f.location) === targetPath);
            
            if (files.length === 0) {
                 // Check if the directory itself exists (is there a file entry for it?)
                 // Unless it's root ~
                 if (targetPath !== '~') {
                     const dirExists = (fileList || []).some(f => {
                         // Check if this folder is defined as a directory in its parent
                         const parentPath = targetPath.substring(0, targetPath.lastIndexOf('/'));
                         const dirName = targetPath.substring(targetPath.lastIndexOf('/') + 1);
                         return f.name === dirName && f.type === 'directory' && cleanPath(f.location) === parentPath;
                     });
                     if (!dirExists) {
                         // Also check if it matches a location of ANY file (implicit directory)?
                         // No, let's require directory entries for now based on new files.json structure
                         return `ls: cannot access '${dirArg || '.'}': No such file or directory`;
                     }
                 }
            }
            
            if (hasLa) {
                // Format like ls -la
                let output = `total ${files.length}\n`;
                output += `drwxr-xr-x  2 kumilanka kumilanka 4096 Jan  1 00:00 .\n`;
                output += `drwxr-xr-x  3 root      root      4096 Jan  1 00:00 ..\n`;
                
                files.forEach(file => {
                    let type = '-';
                    let perms = 'rw-r--r--';
                    
                    if (file.type === 'directory') {
                        type = 'd';
                        perms = 'rwxr-xr-x';
                    } else if (file.type === 'executable') {
                        type = 'x';
                        perms = 'rwxr-xr-x';
                    } else if (file.type === 'link') {
                        type = 'l';
                        perms = 'rwxrwxrwx';
                    }
                    
                    const size = file.size || 0;
                    const date = 'Jan  1 00:00';
                    let name = file.name;
                    if (file.type === 'link' && file.url) {
                         name = `${file.name} -> ${file.url}`;
                    }
                    output += `${type}${perms}  1 kumilanka kumilanka ${size.toString().padStart(5)} ${date} ${name}\n`;
                });
                
                return output.trim();
            } else {
                // Simple list
                return files.map(f => f.name).join('  ');
            }
        } catch (error) {
            // Fallback on error
            return `Error listing files`;
        }
    },
    cat: async (args) => {
        if (!args[0]) {
            return 'cat: missing file operand\nTry \'cat --help\' for more information.';
        }
        const fileName = args[0];
        
        // Resolve file path
        const fileList = await loadFileList();
        const file = fileList.find(f => f.name === fileName && cleanPath(f.location) === currentPath);

        if (!file) {
             return `cat: ${fileName}: No such file or directory`;
        }
        
        if (file.type === 'directory') {
            return `cat: ${fileName}: Is a directory`;
        }

        // If it's an external link or executable, maybe catting it shows something else?
        if (file.type === 'link') {
             return file.url;
        }
        
        // If it's a text file, fetch content
        // We assume README.txt and igor.txt are in home/
        // If we had more structure we'd use file.path
        let fetchPath = file.name;
        if (file.location === '~' && !file.path) {
             fetchPath = 'home/' + file.name;
        } else if (file.path) {
            fetchPath = file.path;
        }

        try {
            const response = await fetch(fetchPath);
            if (response.ok) {
                const content = await response.text();
                return content.trim();
            } else {
                return `cat: ${fileName}: No such file or directory`;
            }
        } catch (error) {
            return `cat: ${fileName}: No such file or directory`;
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
    cd: async (args) => {
        const dir = args[0] || '~';
        
        if (dir === '~' || dir === '/home/kumilanka') {
            currentPath = '~';
            updatePrompt();
            return null;
        } else if (dir === '..') {
            if (currentPath === '~') {
                // Prevent going above root (or simulate root permission error)
                // User asked for error
                return `bash: cd: ..: Permission denied`;
            } else {
                const parts = currentPath.split('/');
                parts.pop();
                currentPath = parts.join('/');
                if (currentPath === '') currentPath = '~';
                updatePrompt();
                return null;
            }
        } else if (dir === '.') {
            return null;
        } else {
            // Check if directory exists in current path
            const fileList = await loadFileList();
            const targetDir = fileList.find(f => f.name === dir && f.type === 'directory' && cleanPath(f.location) === currentPath);
            
            if (targetDir) {
                currentPath = `${currentPath}/${dir}`;
                updatePrompt();
                return null;
            } else {
                return `bash: cd: ${dir}: No such file or directory`;
            }
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

// Helper function to update the input prompt based on state
function updatePrompt() {
    if (window.activeApp && !window.activeApp.isLoading) {
        // Simplified prompt for apps
        promptContainer.innerHTML = `<span class="path">></span> `;
        // Set custom placeholder if app defines one, otherwise clear it
        commandInput.placeholder = window.activeApp.placeholder || '';
    } else {
        // Standard shell prompt
        promptContainer.innerHTML = `
            <span class="user">kumilanka</span>@<span class="host">terminal</span>:<span class="path">${currentPath}</span>$ 
        `;
        commandInput.placeholder = "Type a command...";
    }
}

    // Helper function to add output to terminal
function addOutput(text, className = 'output') {
    if (text === null) return; // Skip null outputs (like successful cd)
    
    const outputDiv = document.createElement('div');
    if (className) {
        const classes = className.split(' ');
        classes.forEach(c => outputDiv.classList.add(c));
    }
    
    // Detect if text contains HTML tags
    if (text.includes('<') && text.includes('>')) {
        outputDiv.innerHTML = text;
    } else {
        outputDiv.textContent = text;
    }
    
    // Restore ascii-art class if passed
    if (className && className.includes('ascii-art')) {
        outputDiv.style.whiteSpace = 'pre';
        outputDiv.style.fontFamily = 'monospace';
    }
    
    terminalOutput.appendChild(outputDiv);
    terminalOutput.scrollTop = terminalOutput.scrollHeight;
}

// Helper function to add command line to history
function addCommandLine(command) {
    const promptLine = document.createElement('div');
    promptLine.className = 'prompt-line';
    
    if (window.activeApp && !window.activeApp.isLoading) {
         // App Prompt Style in history
         promptLine.innerHTML = `
            <span class="prompt"><span class="path">></span> </span>
            <span class="command">${escapeHtml(command)}</span>
        `;
    } else {
        // Standard Prompt Style in history
        promptLine.innerHTML = `
            <span class="prompt">
                <span class="user">kumilanka</span>@<span class="host">terminal</span>:<span class="path">${currentPath}</span>$ 
            </span>
            <span class="command">${escapeHtml(command)}</span>
        `;
    }
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
    if (commands[cmd] && cmd !== 'tetraemon') { // tetraemon is now a file link, but we kept the command for backup? No, remove it or check file first.
        // Actually, if it's a file in the current directory, execute it.
        // But built-ins take precedence usually?
        // Let's check for file first if it's a "./" command, but here users type just "guess".
        // Unix: builtins (like cd) run first. External commands run if found in PATH.
        // Here, "guess" is in ~/programs.
        
        // Modified logic:
        // 1. Builtins run first (cd, ls, help, clear...)
        // 2. Then check if the command exists as an executable in the CURRENT directory.
        
        if (commands[cmd] && cmd !== 'tetraemon') {
             // It is a built-in
             try {
                const result = await commands[cmd](args);
                if (result !== null && result !== undefined) {
                    addOutput(result);
                }
            } catch (error) {
                addOutput(`Error executing command: ${error.message}`, 'error');
            }
            terminalOutput.scrollTop = terminalOutput.scrollHeight;
            return;
        }
    }
    
    // Not a built-in (or it was tetraemon which we want to treat as file now)
    // Check if it's a file in current directory
    const fileList = await loadFileList();
    const file = fileList.find(f => f.name === cmd && cleanPath(f.location) === currentPath);
    
    if (file) {
        if (file.type === 'executable') {
             // Load and start app
             window.activeApp = { 
                 name: cmd, 
                 isLoading: true,
                 // Pass file metadata to the app script
                 path: file.path,
                 engine: file.engine 
             };
             addOutput(`Starting ${cmd}...`, 'info');
             
             const script = document.createElement('script');
             // Add timestamp to prevent caching during development
             // Use file.path or default based on engine
             let src = file.path || `apps/${cmd}.js`;
             
             // If it's a published VFS app using 'quest' engine, point to apps/quest.js
             if (file.engine === 'quest') {
                 src = 'apps/quest.js';
             }

             script.src = `${src}?v=${Date.now()}`;
             script.onload = () => {
                 // App will register itself
             };
             script.onerror = () => {
                 window.activeApp = null;
                 addOutput(`Error loading app: ${cmd}`, 'error');
                 updatePrompt(); // Reset prompt
             };
             document.body.appendChild(script);
        } else if (file.type === 'link') {
             // Open link
             addOutput(`Opening ${file.name}...`, 'info');
             window.open(file.url, '_blank');
        } else {
            // Just a regular file, maybe cat it?
            addOutput(`bash: ${cmd}: Permission denied`);
        }
    } else {
        // If not found in current dir, check if it's a built-in we missed (like tetraemon if we kept it)
        if (commands[cmd]) {
             // Backup execution for builtins
             try {
                const result = await commands[cmd](args);
                if (result) addOutput(result);
             } catch(e) {
                 addOutput(e.message, 'error');
             }
        } else {
            addOutput(`Command not found: ${cmd}`, 'error');
        }
    }

    // Scroll to bottom
    terminalOutput.scrollTop = terminalOutput.scrollHeight;
}

// Handle input
commandInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        const command = commandInput.value;
        
        if (window.activeApp && !window.activeApp.isLoading) {
            // Route input to app
            addCommandLine(command);
            commandHistory.push(command);
            historyIndex = commandHistory.length;
            
            const response = window.activeApp.handleInput(command);
            
            // Handle App Response
            if (response) {
                if (typeof response === 'string') {
                    addOutput(response);
                } else if (typeof response === 'object') {
                    if (response.message) addOutput(response.message);
                    if (response.action === 'exit') {
                        window.activeApp = null;
                        updatePrompt(); // Restore shell prompt
                    }
                }
            }
            
            commandInput.value = '';
            terminalOutput.scrollTop = terminalOutput.scrollHeight;
        } else {
            // Normal shell processing
            processCommand(command);
            commandInput.value = '';
            historyIndex = commandHistory.length;
        }
    } else if (e.key === 'c' && e.ctrlKey) {
        // Ctrl+C handling
        if (window.activeApp) {
            window.activeApp = null;
            addOutput('^C', 'error');
            addOutput('Program terminated.', 'info');
            updatePrompt(); // Restore shell prompt
            commandInput.value = '';
        }
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
    try {
        const response = await fetch('files.json');
        if (response.ok) {
            const data = await response.json();
            fileListCache = data.files || [];
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
        
        // Also match executables and links from file list in current directory
        if (fileListCache) {
            const execs = fileListCache
                .filter(f => (f.type === 'executable' || f.type === 'link' || f.type === 'directory') && f.name.startsWith(cmd) && cleanPath(f.location) === currentPath)
                .map(f => f.name);
            matches.push(...execs);
        }

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
            const fileList = await loadFileList();
            // Filter by current path
            const files = fileList.filter(f => cleanPath(f.location) === currentPath).map(f => f.name);
            
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

// Handle Preview Mode
if (isPreview) {
    const previewContent = localStorage.getItem('mq_preview_content');
    if (previewContent) {
        addOutput('Loading preview...', 'info comment');
        
        window.activeApp = {
            name: 'preview', // This MUST match what quest.js detects
            isLoading: true,
            content: previewContent,
            engine: 'quest'
        };
        
        // Load quest engine
        const script = document.createElement('script');
        script.src = `apps/quest.js?v=${Date.now()}`;
        script.onerror = () => addOutput('Failed to load engine.', 'error');
        document.body.appendChild(script);
    } else {
        addOutput('No preview content found.', 'error');
    }
} else {
    // Only show welcome message if NOT in preview mode
    // moved from top to here to be cleaner
    addOutput('Welcome to kumilanka\'s terminal', 'output');
    addOutput('Type \'help\' for available commands', 'output comment');
}

// Focus input on page load and preload file list
commandInput.focus();
loadFileList(); // Preload file list for faster autocomplete
