// api/stories.js
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');

  try {
    const response = await fetch('https://rss.beehiiv.com/feeds/px5ffXV3ZQ.xml', { cache: 'no-store' });
    const xml = await response.text();

    const items = [];
    const itemMatches = xml.match(/<item>[\s\S]*?<\/item>/gi) || [];

    for (const rawItem of itemMatches) {
      const clean = rawItem.replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '');
      
      const title = (clean.match(/<title>([\s\S]*?)<\/title>/i) || [])[1]?.trim() || 'Featured Story';
      const link = (clean.match(/<link>([\s\S]*?)<\/link>/i) || [])[1]?.trim() || '#';
      const imageMatch = clean.match(/url="([^"]+)"/i) || clean.match(/<img[^>]+src="([^">]+)"/i);
      const image = imageMatch ? imageMatch[1].replace(/width=\d+/, 'width=1600') : 'https://placehold.co/1600x900';

      const catBlock = clean.match(/<category[^>]*>([\s\S]*?)<\/category>/gi) || [];
      const cats = catBlock.join(' ').toLowerCase();

      const isFeatured = cats.includes('feature') || cats.includes('story') || clean.toLowerCase().includes('featured');

      items.push({ title, link, image, isFeatured });
    }

    const featured = items.filter(i => i.isFeatured);
    const fallback = items.filter(i => !i.isFeatured);
    const finalSelection = [...featured, ...fallback].slice(0, 6);

    return res.status(200).json(finalSelection);
  } catch (err) {
    return res.status(500).json({ error: 'Feed processing failed' });
  }
}
