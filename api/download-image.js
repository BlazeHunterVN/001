export default async function handler(req, res) {
    const { url } = req.query;

    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    try {
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error('Failed to fetch image');
        }

        const buffer = await response.arrayBuffer();
        const fileName = url.substring(url.lastIndexOf('/') + 1).split('?')[0] || 'image.jpg';

        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Cache-Control', 'public, max-age=31536000');

        res.send(Buffer.from(buffer));
    } catch (error) {
        res.status(500).json({ error: 'Failed to download image' });
    }
}
