// api/stories.js
export default async function handler(req, res) {
  // Allow Beehiiv site to fetch this API
  res.setHeader('Access-Control-Allow-Origin', '*');
  // Revalidate edge cache every 30 seconds
  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=120');

  const RSS_URL = 'https://rss.beehiiv.com/feeds/px5ffXV3ZQ.xml';

  try {
    const response = await fetch(`${RSS_URL}?cb=${Date.now()}`, { cache: 'no-store' });
    const xml = await response.text();

    const items = [];
    const itemMatches = xml.match(/<item>[\s\S]*?<\/item>/gi) || [];

    for (const itemXml of itemMatches) {
      // Extract Title
      const titleMatch = itemXml.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
      const title = titleMatch ? titleMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : 'Featured Story';

      // Extract Link
      const linkMatch = itemXml.match(/<link>([\s\S]*?)<\/link>/i);
      const link = linkMatch ? linkMatch[1].trim() : '#';

      // Extract Image
      const imageMatch = itemXml.match(/url="([^"]+)"/i) || itemXml.match(/<img[^>]+src="([^">]+)"/i);
      let image = imageMatch ? imageMatch[1] : 'https://placehold.co/1600x900?text=Upscale+Magazine';
      image = image.replace(/width=\d+/, 'width=1600').replace(/w=\d+/, 'w=1600').replace(/quality=\d+/, 'quality=95');

      // Extract Categories
      const categories = [];
      const catMatches = itemXml.matchAll(/<category[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/category>/gi);
      for (const cat of catMatches) {
        categories.push(cat[1].toLowerCase().trim());
      }

      const isFeatured = categories.some(c => c.includes('feature') || c.includes('story'));

      items.push({ title, link, image, isFeatured });
    }

    const featured = items.filter(i => i.isFeatured);
    const result = (featured.length > 0 ? featured : items).slice(0, 6);

    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch stories' });
  }
}
