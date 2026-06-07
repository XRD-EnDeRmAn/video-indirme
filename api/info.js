// api/info.js - Vercel Serverless Function
module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Support both GET (?url=...) and POST (body: {url})
    const url = req.query.url || (req.body && req.body.url);

    if (!url) {
        return res.status(400).json({ error: 'Lütfen bir video linki belirtin.' });
    }

    try {
        const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
        const response = await fetch(oembedUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        });

        if (!response.ok) {
            return res.status(400).json({ error: 'Geçersiz YouTube URL\'si veya video gizli/silinmiş.' });
        }

        const data = await response.json();
        res.json({
            success: true,
            title: data.title,
            thumbnail: data.thumbnail_url,
            author: data.author_name
        });
    } catch (error) {
        console.error('Info Error:', error);
        res.status(500).json({ error: 'Video bilgileri alınamadı: ' + error.message });
    }
};
