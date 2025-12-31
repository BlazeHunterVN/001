export const config = {
    api: {
        responseLimit: '10mb',
    },
};

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { url } = req.query;

    if (!url) {
        return res.status(400).json({ error: 'URL parameter is required' });
    }

    // Validate URL
    try {
        new URL(url);
    } catch (e) {
        return res.status(400).json({ error: 'Invalid URL format' });
    }

    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
        attempts++;

        try {
            // Fetch the image from the external URL with timeout
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

            const response = await fetch(url, {
                signal: controller.signal,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                }
            });

            clearTimeout(timeout);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            // Get the image buffer
            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            // Extract filename from URL
            const urlPath = new URL(url).pathname;
            const fileName = urlPath.substring(urlPath.lastIndexOf('/') + 1) || 'image.jpg';

            // Detect content type
            const contentType = response.headers.get('content-type') || 'image/jpeg';

            // Set headers for download
            res.setHeader('Content-Type', contentType);
            res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
            res.setHeader('Content-Length', buffer.length);
            res.setHeader('Cache-Control', 'public, max-age=86400');
            res.setHeader('X-Download-Attempts', attempts.toString());

            // Send the image
            return res.status(200).send(buffer);

        } catch (error) {
            console.error(`Download attempt ${attempts} failed:`, error.message);

            // If this was the last attempt, return error
            if (attempts >= maxAttempts) {
                return res.status(500).json({
                    error: 'Failed to download image after multiple attempts',
                    message: error.message,
                    attempts: attempts,
                    url: url
                });
            }

            // Wait before retry (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
        }
    }
}
