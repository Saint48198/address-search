import express from 'express';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// Proxy route for address suggestions
app.get('/api/address-suggest', async (req, res) => {
    const { street = '', num = '' } = req.query;

    if (!street || !num) {
        return res.status(400).json({ error: 'Missing street or num parameter' });
    }

    const externalUrl = `https://address.mivoter.org/?street=${encodeURIComponent(street)}&num=${encodeURIComponent(num)}`;

    try {
        const response = await fetch(externalUrl);
        const data = await response.json();
        res.json(data); // Send raw API response directly
    } catch (err) {
        console.error('Proxy error:', err);
        res.status(500).json({ error: 'Failed to fetch from external API' });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
