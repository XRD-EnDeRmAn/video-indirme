// server.js - Local development server (Express)
// For Vercel deployment, the api/ folder functions are used instead.
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const { ensureYtDlp } = require('./api/_ytdlp');

const app = express();
const PORT = process.env.PORT || 3000;

let ffmpegPath = null;
try {
    ffmpegPath = require('ffmpeg-static');
    console.log('ffmpeg bulundu:', ffmpegPath);
} catch (e) {
    console.warn('ffmpeg-static bulunamadı.');
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// GET /api/info?url=...
app.get('/api/info', async (req, res) => {
    const url = req.query.url;
    if (!url) return res.status(400).json({ error: 'Lütfen bir video linki belirtin.' });

    try {
        const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
        const response = await fetch(oembedUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        });
        if (!response.ok) return res.status(400).json({ error: 'Geçersiz YouTube URL\'si veya video gizli/silinmiş.' });

        const data = await response.json();
        res.json({ success: true, title: data.title, thumbnail: data.thumbnail_url, author: data.author_name });
    } catch (error) {
        res.status(500).json({ error: 'Video bilgileri alınamadı: ' + error.message });
    }
});

// POST /api/info (backward compat)
app.post('/api/info', async (req, res) => {
    req.query.url = req.body && req.body.url;
    return app._router.handle(Object.assign(req, { method: 'GET' }), res, () => {});
});

// GET /api/download
app.get('/api/download', async (req, res) => {
    const { url, format, quality, title } = req.query;
    if (!url) return res.status(400).send('Geçersiz YouTube URL\'si');

    try {
        const ytdlpPath = await ensureYtDlp();

        const safeTitle = (title || `download_${Date.now()}`).replace(/[<>:"/\\|?*\r\n]+/g, '_').trim();
        const encodedTitle = encodeURIComponent(safeTitle);
        const asciiTitle = safeTitle.replace(/[^\x20-\x7E]/g, '_');
        const ext = format === 'mp3' ? 'mp3' : 'mp4';

        res.header('Content-Disposition', `attachment; filename="${asciiTitle}.${ext}"; filename*=UTF-8''${encodedTitle}.${ext}`);
        res.header('Content-Type', format === 'mp3' ? 'audio/mpeg' : 'video/mp4');
        res.flushHeaders();

        const baseFlags = [
            '--no-playlist', '--no-warnings',
            '--concurrent-fragments', '16',
            '--buffer-size', '16K',
            '--http-chunk-size', '10M',
            '--no-part',
            '--extractor-retries', '1',
            '--retries', '2',
        ];

        // Node.js çalışma ortamını PATH'e ekle (yt-dlp JS engine için)
        const nodeDir = path.dirname(process.execPath);
        const envPath = `${nodeDir}${os.platform() === 'win32' ? ';' : ':'}${process.env.PATH || ''}`;

        if (format === 'mp3' && ffmpegPath) {
            const ytdlp = spawn(ytdlpPath, [...baseFlags, '-f', 'bestaudio', '-o', '-', url], {
                env: { ...process.env, PATH: envPath }
            });
            const ffmpeg = spawn(ffmpegPath, ['-i', 'pipe:0', '-f', 'mp3', '-ab', '192000', '-vn', '-loglevel', 'error', 'pipe:1']);

            ytdlp.stdout.pipe(ffmpeg.stdin);
            ffmpeg.stdout.pipe(res);

            ytdlp.stderr.on('data', d => console.log('[ytdlp]', d.toString().slice(0, 200)));
            ffmpeg.stderr.on('data', d => console.log('[ffmpeg]', d.toString().slice(0, 200)));
            ytdlp.on('close', code => { if (code !== 0) ffmpeg.stdin.end(); });
            req.on('close', () => { ytdlp.kill(); ffmpeg.kill(); });

        } else {
            const q = quality || '720';
            const fmtStr = format === 'mp3' ? 'bestaudio' : `best[height<=${q}][ext=mp4]/best`;
            const ytdlp = spawn(ytdlpPath, [...baseFlags, '-f', fmtStr, '-o', '-', url], {
                env: { ...process.env, PATH: envPath }
            });

            ytdlp.stdout.pipe(res);
            ytdlp.stderr.on('data', d => console.log('[ytdlp]', d.toString().slice(0, 200)));
            req.on('close', () => ytdlp.kill());
        }

    } catch (err) {
        console.error(err);
        if (!res.headersSent) res.status(500).send('İndirme hatası: ' + err.message);
    }
});

async function start() {
    await ensureYtDlp();
    app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
}

start();
