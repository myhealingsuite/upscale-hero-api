// api/stories.js
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=0, max-age=0, no-cache, no-store, must-revalidate');

  const RSS_URL = 'https://rss.beehiiv.com/feeds/px5ffXV3ZQ.xml';

  try {
    const response = await fetch(`${RSS_URL}?cb=${Date.now()}`, { cache: 'no-store' });
    const xml = await response.text();

    const items = [];
    const itemMatches = xml.match(/<item>[\s\S]*?<\/item>/gi) || [];

    for (const rawItem of itemMatches) {
      // Strip CDATA wrappers to clean up XML parsing
      const cleanItem = rawItem.replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '');

      // Extract Title
      const titleMatch = cleanItem.match(/<title>([\s\S]*?)<\/title>/i);
      let title = titleMatch ? titleMatch[1].trim() : 'Featured Story';
      title = title.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"');

      // Extract Link
      const linkMatch = cleanItem.match(/<link>([\s\S]*?)<\/link>/i);
      const link = linkMatch ? linkMatch[1].trim() : '#';

      // Extract Image
      const imageMatch = cleanItem.match(/url="([^"]+)"/i) || cleanItem.match(/<img[^>]+src="([^">]+)"/i);
      let image = imageMatch ? imageMatch[1] : 'https://placehold.co/1600x900?text=Upscale+Magazine';
      image = image.replace(/width=\d+/, 'width=1600').replace(/w=\d+/, 'w=1600').replace(/quality=\d+/, 'quality=95');

      // Extract and split multi-assigned categories (e.g., "Sports, Featured Story")
      const categories = [];
      const catMatches = cleanItem.matchAll(/<category[^>]*>([\s\S]*?)<\/category>/gi);
      for (const cat of catMatches) {
        const catText = cat[1].toLowerCase().trim();
        catText.split(',').forEach(c => categories.push(c.trim()));
      }

      // Filter strictly for the Featured Story category
      const isFeaturedStory = categories.some(c => 
        c === 'featured story' || 
        c === 'featured stories' || 
        c.includes('featured story')
      );

      if (isFeaturedStory) {
        items.push({ title, link, image });
      }
    }

    // Return the 6 latest posts matching the Featured Story category
    const result = items.slice(0, 6);

    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch stories' });
  }
}
