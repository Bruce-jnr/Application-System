const express = require('express');
const router = express.Router();
const pool = require('../config/db');



// Public: news
router.get('/news', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '6', 10), 50);
    const [rows] = await pool.query(
      'SELECT id, title, excerpt, content, image_url, image_mime, image_data, category, author, published_at FROM news WHERE is_published = 1 ORDER BY published_at DESC LIMIT ?',
      [limit]
    );
    const items = rows.map(r => {
      let computedImageUrl = r.image_url;
      if (!computedImageUrl && r.image_data) {
        const base64 = Buffer.from(r.image_data).toString('base64');
        computedImageUrl = `data:${r.image_mime || 'image/jpeg'};base64,${base64}`;
      }
      return {
        id: r.id,
        title: r.title,
        excerpt: r.excerpt,
        content: r.content,
        image_url: computedImageUrl,
        category: r.category,
        author: r.author,
        published_at: r.published_at
      };
    });
    res.json({ success: true, items });
  } catch (e) {
    res.status(500).json({ success: false, error: 'Failed to load news' });
  }
});

module.exports = router;

