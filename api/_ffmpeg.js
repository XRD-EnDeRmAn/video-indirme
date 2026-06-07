const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

const FFMPEG_PATH = os.platform() === 'win32'
    ? path.join(__dirname, '..', 'ffmpeg.exe')
    : '/tmp/ffmpeg';

let _ffmpegPromise = null;

async function ensureFfmpeg() {
    if (fs.existsSync(FFMPEG_PATH)) return FFMPEG_PATH;
    if (_ffmpegPromise) return _ffmpegPromise;

    _ffmpegPromise = (async () => {
        // On Windows local dev, look for local ffmpeg in PATH
        if (os.platform() === 'win32') {
            try {
                execSync('ffmpeg -version', { stdio: 'ignore' });
                return 'ffmpeg';
            } catch {
                console.warn('ffmpeg not found on Windows, MP3 disabled');
                return null;
            }
        }

        // On Linux (Vercel): download static ffmpeg binary
        console.log('ffmpeg indiriliyor...');
        const url = 'https://github.com/yt-dlp/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-linux64-gpl.tar.xz';

        const { Readable } = require('stream');
        const tarPath = '/tmp/ffmpeg.tar.xz';

        const response = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        if (!response.ok) throw new Error(`ffmpeg indirilemedi: ${response.status}`);

        const fileStream = fs.createWriteStream(tarPath);
        await new Promise((resolve, reject) => {
            Readable.fromWeb(response.body).pipe(fileStream);
            fileStream.on('finish', resolve);
            fileStream.on('error', reject);
        });

        // Extract ffmpeg binary from the tar.xz
        execSync(`tar -xf ${tarPath} --wildcards '*/ffmpeg' -O > ${FFMPEG_PATH}`, { shell: true });
        fs.chmodSync(FFMPEG_PATH, '755');
        fs.unlinkSync(tarPath);

        console.log('ffmpeg hazır:', FFMPEG_PATH);
        return FFMPEG_PATH;
    })();

    return _ffmpegPromise;
}

module.exports = { ensureFfmpeg };
