const fs = require('fs');
const os = require('os');
const path = require('path');
const { Readable } = require('stream');

// /tmp is always writable on Vercel/Linux. On Windows (local dev), use project root.
const YTDLP_PATH = os.platform() === 'win32'
    ? path.join(process.cwd(), 'yt-dlp.exe')
    : '/tmp/yt-dlp';

let _ensurePromise = null;

async function ensureYtDlp() {
    if (fs.existsSync(YTDLP_PATH)) return YTDLP_PATH;

    // Prevent concurrent downloads
    if (_ensurePromise) return _ensurePromise;

    _ensurePromise = (async () => {
        console.log('yt-dlp indiriliyor...');
        const url = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp';
        const response = await fetch(url);
        if (!response.ok) throw new Error(`yt-dlp indirilemedi: ${response.statusText}`);

        const fileStream = fs.createWriteStream(YTDLP_PATH);
        await new Promise((resolve, reject) => {
            Readable.fromWeb(response.body).pipe(fileStream);
            fileStream.on('finish', resolve);
            fileStream.on('error', reject);
        });

        if (os.platform() !== 'win32') {
            fs.chmodSync(YTDLP_PATH, '755');
        }

        console.log('yt-dlp hazır:', YTDLP_PATH);
        return YTDLP_PATH;
    })();

    return _ensurePromise;
}

module.exports = { ensureYtDlp };
