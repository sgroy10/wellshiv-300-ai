document.addEventListener('DOMContentLoaded', function() {
    initializeChat();
});

function initializeChat() {
    const sendButton = document.getElementById('send-button');
    const micButton = document.getElementById('mic-button');
    const textInput = document.getElementById('text-input');
    const messageArea = document.getElementById('message-area');
    const enterNameBtn = document.getElementById('enter-name-btn');
    const helpButton = document.getElementById('help-btn'); // Added help button
    const languageSelection = document.getElementById('language-selection');

    let username = '';
    let selectedLanguage = 'en-US';
    let currentAudio = null;
    let isRecording = false;
    let recognition;
    let isInterruption = false;

    // Capture language selection
    languageSelection.onchange = function() {
        selectedLanguage = languageSelection.value;
    };

    // Handle "Enter Your Name" button click
    enterNameBtn.onclick = function() {
        username = prompt("Please enter your name:");
        if (username) {
            addMessageToChat('user', `My name is ${username}.`);
            sendMessageToAI(`My name is ${username}.`, true);
        } else {
            alert("Please enter a valid name.");
        }
    };

    // Handle "Help" button click
    helpButton.onclick = function() {
        openHelpWindow();
    };

    // Function to open a new window with help information
    function openHelpWindow() {
        const helpWindow = window.open("", "_blank", "width=400,height=400");
        helpWindow.document.write(`
            <html>
            <head>
                <title>Help</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        padding: 20px;
                    }
                    .help-content {
                        margin-bottom: 20px;
                    }
                    button {
                        padding: 10px 20px;
                        font-size: 16px;
                        cursor: pointer;
                        background-color: #ff7f00;
                        color: white;
                        border: none;
                        border-radius: 5px;
                    }
                </style>
            </head>
            <body>
                <div class="help-content">
                    <h2>Help Information</h2>
                    <p>1. <strong>Using the App:</strong> Type your message in the input field and click "Send" or press "Enter" to interact with the AI. Use the "TALK" button to speak your message if you prefer voice input.</p>
                    <p>2. <strong>Switching Languages:</strong> Use the dropdown menu at the top to select your preferred language. Available languages: English (US), Hindi, Korean, Chinese.</p>
                    <p>3. <strong>About the Developer:</strong> This app is developed by Sandeep Roy. Sandeep is passionate about creating intelligent and empathetic AI applications to assist users in various domains, including wellness and language learning.</p>
                </div>
                <button onclick="window.close()">Back</button>
            </body>
            </html>
        `);
    }

    // Handle send button click
    sendButton.onclick = function() {
        handleSendMessage();
    };

    // Handle "Enter" keypress in the text input field
    textInput.onkeypress = function(event) {
        if (event.key === 'Enter') {
            handleSendMessage();
        }
    };

    // Stop recording if user starts typing
    textInput.oninput = function() {
        if (isRecording) {
            stopRecording();
        }
    };

    // Handle microphone button click
    micButton.onclick = function() {
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    };

    // Start speech recognition
    function startRecording() {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            alert('Speech recognition is not supported in this browser. Please use Chrome.');
            return;
        }

        recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
        recognition.lang = selectedLanguage;
        recognition.interimResults = false;
        recognition.continuous = true;

        recognition.onstart = function() {
            isRecording = true;
            micButton.textContent = "Listening...";
            micButton.style.backgroundColor = "#FF8C00"; // Dark orange color
        };

        recognition.onresult = function(event) {
            const transcript = event.results[event.results.length - 1][0].transcript.trim();
            isInterruption = true; // Mark as interruption
            if (currentAudio) {
                currentAudio.pause(); // Stop current audio
            }
            textInput.value = transcript;
            handleSendMessage();
        };

        recognition.onerror = function(event) {
            console.error('Speech recognition error detected: ' + event.error);
            addMessageToChat('ai', 'Sorry, I couldn\'t understand that. Please try again.');
            stopRecording();
        };

        recognition.onspeechend = function() {
            stopRecording();
        };

        recognition.start();
    }

    // Stop speech recognition
    function stopRecording() {
        if (recognition) {
            recognition.stop();
            isRecording = false;
            micButton.textContent = "TALK";
            micButton.style.backgroundColor = "#FF8C00"; // Revert button color to dark orange
        }
    }

    // Handle sending a message
    function handleSendMessage() {
        const userMessage = textInput.value.trim();
        if (userMessage) {
            if (currentAudio) {
                currentAudio.pause(); // Stop any ongoing audio when a new message is sent
            }
            addMessageToChat('user', userMessage);
            textInput.value = '';
            sendMessageToAI(userMessage);
        }
    }

    // Add message to the chat area
    function addMessageToChat(sender, message) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', `${sender}-message`);
        messageElement.textContent = message;
        messageElement.style.marginBottom = "15px";  // Adding space between messages
        messageArea.appendChild(messageElement);
        messageArea.scrollTop = messageArea.scrollHeight;
    }

    // Send message to AI and handle response
    async function sendMessageToAI(userMessage, isInitialMessage = false) {
        try {
            const response = await axios.post('/api/chat', {
                message: userMessage,
                username: isInitialMessage ? username : undefined,
                language: selectedLanguage,
                isInterruption: isInterruption
            });
            isInterruption = false;  // Reset interruption flag
            const aiMessage = response.data.message.replace(/\*\*/g, '');  // Remove special characters like **
            addMessageToChat('ai', aiMessage);
            playAudio(aiMessage);
        } catch (error) {
            console.error("Chat error: ", error);
            addMessageToChat('ai', 'Sorry, I encountered an error. Please try again.');
        }
    }

    // Play audio response from AI
    async function playAudio(message) {
        try {
            const response = await axios.post('/api/tts', { message, languageCode: selectedLanguage });
            if (currentAudio) {
                currentAudio.pause(); // Stop any ongoing audio before playing new
            }
            currentAudio = new Audio(`data:audio/mp3;base64,${response.data.audioContent}`);
            currentAudio.play();
        } catch (error) {
            console.error('Error playing audio:', error);
            addMessageToChat('ai', 'Sorry, I couldn\'t play the audio. Please try again.');
        }
    }
}
