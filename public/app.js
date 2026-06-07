document.addEventListener('DOMContentLoaded', () => {
    const urlInput = document.getElementById('url-input');
    const btnMp3 = document.getElementById('btn-mp3');
    const btnMp4 = document.getElementById('btn-mp4');
    const convertBtn = document.getElementById('convert-btn');
    const errorBox = document.getElementById('error-box');
    const errorText = document.getElementById('error-text');
    
    const qualityContainer = document.getElementById('quality-container');
    const qualitySelect = document.getElementById('quality-select');

    const videoInfoCard = document.getElementById('video-info-card');
    const videoThumbnail = document.getElementById('video-thumbnail');
    const videoTitle = document.getElementById('video-title');
    const videoAuthor = document.getElementById('video-author');
    const progressContainer = document.getElementById('progress-container');
    const progressBar = document.getElementById('progress-bar');
    const progressStatus = document.getElementById('progress-status');
    const downloadLink = document.getElementById('download-link');

    let selectedFormat = 'mp3';

    // Format Selector click events
    btnMp3.addEventListener('click', () => {
        selectedFormat = 'mp3';
        btnMp3.classList.add('active');
        btnMp4.classList.remove('active');
        qualityContainer.style.display = 'none';
    });

    btnMp4.addEventListener('click', () => {
        selectedFormat = 'mp4';
        btnMp4.classList.add('active');
        btnMp3.classList.remove('active');
        qualityContainer.style.display = 'inline-block';
    });

    // Convert Click Handler
    convertBtn.addEventListener('click', async () => {
        const url = urlInput.value.trim();
        
        // Hide previous cards/errors
        hideError();
        videoInfoCard.style.display = 'none';
        downloadLink.style.display = 'none';
        progressContainer.style.display = 'none';

        if (!url) {
            showError('Lütfen geçerli bir YouTube video linki yapıştırın.');
            return;
        }

        // Set Loading state
        convertBtn.classList.add('loading');
        convertBtn.disabled = true;

        try {
            // 1. Fetch video info from backend (GET with url param)
            const infoResponse = await fetch(`/api/info?url=${encodeURIComponent(url)}`);

            const infoData = await infoResponse.json();

            if (!infoResponse.ok || !infoData.success) {
                throw new Error(infoData.error || 'Video bilgileri alınamadı.');
            }

            // Show video metadata
            videoThumbnail.src = infoData.thumbnail;
            videoTitle.textContent = infoData.title;
            videoAuthor.textContent = infoData.author;
            videoInfoCard.style.display = 'flex';

            // Show progress bar
            progressContainer.style.display = 'flex';
            progressBar.style.width = '30%';
            progressStatus.textContent = 'İndirme motoru hazırlanıyor...';

            // Get selected quality if MP4
            const quality = selectedFormat === 'mp4' ? qualitySelect.value : '';

            // 2. Set final download URL pointing to our backend streaming API, including title for filename and quality
            const downloadUrl = `/api/download?url=${encodeURIComponent(url)}&format=${selectedFormat}&title=${encodeURIComponent(infoData.title)}&quality=${quality}`;
            
            progressBar.style.width = '100%';
            progressStatus.textContent = 'İndirme başlıyor! Tarayıcınızın indirme sekmesini kontrol edin.';

            // Show download link
            downloadLink.href = downloadUrl;
            downloadLink.style.display = 'inline-block';
            
            // Trigger automatic download redirection
            window.location.href = downloadUrl;

        } catch (err) {
            console.error(err);
            showError(err.message || 'Bir hata oluştu. Lütfen bağlantıyı kontrol edip tekrar deneyin.');
            progressContainer.style.display = 'none';
        } finally {
            convertBtn.classList.remove('loading');
            convertBtn.disabled = false;
        }
    });

    function showError(message) {
        errorText.textContent = message;
        errorBox.style.display = 'block';
    }

    function hideError() {
        errorBox.style.display = 'none';
    }
});
