// api/download.js - Vercel Serverless Function
const { spawn } = require('child_process');
const { ensureYtDlp } = require('./_ytdlp');
const { ensureFfmpeg } = require('./_ffmpeg');

module.exports = async (req, res) => {
    const { url, format, quality, title } = req.query;

    if (!url) {
        return res.status(400).send('Geçersiz YouTube URL\'si');
    }

    try {
        const ytdlpPath = await ensureYtDlp();
        const ffmpegPath = format === 'mp3' ? await ensureFfmpeg() : null;

        const safeTitle = (title || `download_${Date.now()}`).replace(/[<>:"/\\|?*\r\n]+/g, '_').trim();
        const encodedTitle = encodeURIComponent(safeTitle);
        const asciiTitle = safeTitle.replace(/[^\x20-\x7E]/g, '_');
        const ext = format === 'mp3' ? 'mp3' : 'mp4';

        res.setHeader('Content-Disposition', `attachment; filename="${asciiTitle}.${ext}"; filename*=UTF-8''${encodedTitle}.${ext}`);
        res.setHeader('Content-Type', format === 'mp3' ? 'audio/mpeg' : 'video/mp4');
        res.flushHeaders();

        const baseFlags = [
            '--no-playlist',
            '--no-warnings',
            '--concurrent-fragments', '4',
            '--buffer-size', '16K',
            '--no-part',
            '--retries', '2',
        ];

        if (format === 'mp3' && ffmpegPath) {
            // MP3: yt-dlp bestaudio stdout → ffmpeg → 192kbps MP3 → response
            const ytdlp = spawn(ytdlpPath, [...baseFlags, '-f', 'bestaudio', '-o', '-', url]);
            const ffmpeg = spawn(ffmpegPath, [
                '-i', 'pipe:0',
                '-f', 'mp3',
                '-ab', '192000',
                '-vn',
                '-loglevel', 'error',
                'pipe:1'
            ]);

            ytdlp.stdout.pipe(ffmpeg.stdin);
            ffmpeg.stdout.pipe(res);

            ytdlp.stderr.on('data', d => console.log('[ytdlp]', d.toString().slice(0, 200)));
            ffmpeg.stderr.on('data', d => console.log('[ffmpeg]', d.toString().slice(0, 200)));

            ytdlp.on('close', code => {
                if (code !== 0) ffmpeg.stdin.end();
            });

            req.on('close', () => { ytdlp.kill(); ffmpeg.kill(); });

        } else {
            // MP4 veya ffmpeg yoksa: yt-dlp → doğrudan response
            // MP3 without ffmpeg: serve as best audio (m4a/webm)
            const q = quality || '720';
            const fmtStr = format === 'mp3'
                ? 'bestaudio'
                : `best[height<=${q}][ext=mp4]/best[height<=${q}]/best`;

            const ytdlp = spawn(ytdlpPath, [...baseFlags, '-f', fmtStr, '-o', '-', url]);
            ytdlp.stdout.pipe(res);

            ytdlp.stderr.on('data', d => console.log('[ytdlp]', d.toString().slice(0, 200)));
            ytdlp.on('close', code => console.log('[ytdlp] exited:', code));

            req.on('close', () => ytdlp.kill());
        }

    } catch (err) {
        console.error('Download Error:', err);
        if (!res.headersSent) {
            res.status(500).send('İndirme hatası: ' + err.message);
        }
    }
};
