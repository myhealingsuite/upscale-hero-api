'use strict';

const BEEHIIV_API_ROOT = 'https://api.beehiiv.com/v2';
const POST_LIMIT = 6;
const TIMEOUT_MS = 8000;

module.exports = async function handler(request, response) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  response.setHeader(
    'Cache-Control',
    'public, s-maxage=300, stale-while-revalidate=3600'
  );

  if (request.method === 'OPTIONS') {
    response.status(204).end();
    return;
  }

  if (request.method !== 'GET') {
    response.status(405).json({
      error: 'Method not allowed'
    });
    return;
  }

  const apiKey = process.env.BEEHIIV_API_KEY;
  const publicationId = process.env.BEEHIIV_PUBLICATION_ID;
  const contentTag =
    process.env.BEEHIIV_CONTENT_TAG || 'Featured Story';

  if (!apiKey || !publicationId) {
    response.status(500).json({
      error: 'Missing Beehiiv environment variables.'
    });
    return;
  }

  const parameters = new URLSearchParams();

  parameters.append('content_tags[]', contentTag);
  parameters.set('limit', String(POST_LIMIT));
  parameters.set('order_by', 'publish_date');
  parameters.set('direction', 'desc');
  parameters.set('status', 'confirmed');
  parameters.set('platform', 'web');
  parameters.set('audience', 'all');

  const apiUrl =
    `${BEEHIIV_API_ROOT}/publications/` +
    `${encodeURIComponent(publicationId)}/posts?` +
    parameters.toString();

  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, TIMEOUT_MS);

  try {
    const beehiivResponse = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json'
      },
      signal: controller.signal
    });

    if (!beehiivResponse.ok) {
      const errorText = await beehiivResponse.text();

      console.error(
        'Beehiiv API error:',
        beehiivResponse.status,
        errorText
      );

      response.status(502).json({
        error: 'Beehiiv returned an error.',
        status: beehiivResponse.status
      });

      return;
    }

    const result = await beehiivResponse.json();
    const posts = Array.isArray(result.data) ? result.data : [];

    const stories = posts
      .map((post) => ({
        id: post.id,
        title:
          post.title ||
          post.subject_line ||
          'Featured Story',
        link: post.web_url || '',
        image: post.thumbnail_url || '',
        publishedAt:
          post.publish_date ||
          post.displayed_date ||
          post.created ||
          null,
        contentTags: Array.isArray(post.content_tags)
          ? post.content_tags
          : []
      }))
      .filter((story) => story.title && story.link)
      .slice(0, POST_LIMIT);

    response.status(200).json(stories);
  } catch (error) {
    console.error('Featured Story endpoint error:', error);

    response.status(
      error && error.name === 'AbortError' ? 504 : 500
    ).json({
      error: 'Featured Stories are temporarily unavailable.'
    });
  } finally {
    clearTimeout(timeout);
  }
};
