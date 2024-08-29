const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const axios = require('axios');
const session = require('express-session');
const fs = require('fs');
require('dotenv').config();  // Load the .env file

const app = express();

// Use API keys from environment variables
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GOOGLE_TTS_API_KEY = process.env.GOOGLE_TTS_API_KEY;

app.use(bodyParser.json());

// Logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

// Serve landing page at root URL
app.get('/', (req, res) => {
    console.log('Attempting to serve landing page');
    const landingPath = path.join(__dirname, 'frontend', 'landing.html');
    console.log('Landing page path:', landingPath);
    
    if (fs.existsSync(landingPath)) {
        res.sendFile(landingPath);
    } else {
        console.error('landing.html not found');
        res.status(404).send('Landing page not found');
    }
});

// Serve static files
const frontendPath = path.join(__dirname, 'frontend');
console.log('Frontend path:', frontendPath);
app.use(express.static(frontendPath));

app.use(session({
    secret: 'shivani_secret_key',
    resave: false,
    saveUninitialized: true,
}));

async function makeApiRequest(url, data, retries = 3) {
    try {
        const response = await axios.post(url, data, {
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        return response.data;
    } catch (error) {
        if (retries > 0 && error.code === 'ECONNRESET') {
            console.warn('Connection reset. Retrying...');
            return makeApiRequest(url, data, retries - 1);
        } else {
            throw error;
        }
    }
}

app.post('/api/chat', async (req, res) => {
    try {
        const { message, username, language, isInterruption } = req.body;

        if (!req.session.context) {
            req.session.context = [
                { role: "system", content: "You are Shivani, a highly empathetic and humorous wellness assistant. Your goal is to provide detailed, solution-oriented advice. Avoid short or generic responses, and only suggest seeing a doctor if absolutely necessary. Use humor to keep the conversation light-hearted when appropriate, and always show care and empathy." }
            ];
        }

        if (username && !req.session.username) {
            req.session.username = username;
            const greeting = `Hi ${username}, I am Shivani, your AI assistant for wellness and health, and I am developed by Sandeep Roy. How can I assist you today? 😄`;
            req.session.context.push({ role: "user", content: `My name is ${username}.` });
            req.session.context.push({ role: "assistant", content: greeting });

            return res.json({ message: greeting });
        }

        if (isInterruption) {
            req.session.context.push({ role: "assistant", content: "Oh, okay, go on. I'm all ears!" });
            req.session.context.push({ role: "user", content: message });
        } else {
            req.session.context.push({ role: "user", content: message });
        }

        const responseDataPromise = makeApiRequest('https://api.openai.com/v1/chat/completions', {
            model: "gpt-4",
            messages: req.session.context,
            max_tokens: 1200,
            temperature: 0.7
        });

        responseDataPromise.then(async (responseData) => {
            let aiMessage = responseData.choices[0].message.content
                .replace(/\*\*/g, '')  // Remove special characters like **
                .replace(/:\)/g, '');  // Remove smiley emoji representation

            req.session.context.push({ role: "assistant", content: aiMessage });

            const ttsPromise = axios.post('/api/tts', { message: aiMessage, languageCode: language });

            res.json({ message: aiMessage });

            try {
                const ttsResponse = await ttsPromise;
                const audioContent = ttsResponse.data.audioContent;

            } catch (ttsError) {
                console.error('Error in TTS processing:', ttsError.response ? ttsError.response.data : ttsError.message);
            }
        }).catch((error) => {
            console.error('Error in chat API:', error.response ? error.response.data : error.message);
            res.status(500).json({ error: 'Sorry, I encountered an error. Please try again.' });
        });

    } catch (error) {
        console.error('Unexpected error:', error);
        res.status(500).json({ error: 'Sorry, I encountered an error. Please try again.' });
    }
});

app.post('/api/tts', async (req, res) => {
    try {
        const { message, languageCode = 'en-US' } = req.body;

        const cleanedMessage = message.replace(/:\)|😊|😄|😉/g, '');  // Remove emoji representations

        const voiceMap = {
            'en-US': { name: 'en-US-Wavenet-F', ssmlGender: 'FEMALE' },
            'hi-IN': { name: 'hi-IN-Wavenet-A', ssmlGender: 'MALE' },
            'ko-KR': { name: 'ko-KR-Wavenet-B', ssmlGender: 'MALE' },
            'cmn-CN': { name: 'cmn-CN-Wavenet-A', ssmlGender: 'FEMALE' }, 
        };

        const voiceParams = voiceMap[languageCode] || voiceMap['en-US'];

        const response = await axios.post(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${GOOGLE_TTS_API_KEY}`, {
            input: { text: cleanedMessage },
            voice: { languageCode, name: voiceParams.name, ssmlGender: voiceParams.ssmlGender },
            audioConfig: { audioEncoding: 'MP3', speakingRate: 1.0, pitch: 0.5 } 
        });

        res.json({ audioContent: response.data.audioContent });
    } catch (error) {
        console.error('Error in TTS API:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'Sorry, I encountered an error in generating speech. Please try again later.' });
    }
});

app.get('/app', (req, res) => {
    console.log('Attempting to serve main application');
    const indexPath = path.join(__dirname, 'frontend', 'index.html');
    console.log('Index page path:', indexPath);
    
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        console.error('index.html not found');
        res.status(404).send('Main application page not found');
    }
});

app.get('*', (req, res) => {
    console.log('Catch-all route hit, redirecting to root');
    res.redirect('/');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
