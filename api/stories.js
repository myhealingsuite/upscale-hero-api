'use strict';

const BEEHIIV_API_ROOT = 'https://api.beehiiv.com/v2';

// Return six stories to the carousel.
const POST_LIMIT = 6;

// Request additional posts in case some records do not have a public web URL.
const UPSTREAM_LIMIT = 20;

const TIMEOUT_MS = 8000;

function setHeaders(response) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader(
    'Access-Control-Allow-Methods',
    'GET, OPTIONS'
  );
  response.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type'
  );

  response.setHeader(
    'Cache-Control',
    'public, s-maxage=300, stale-while-revalidate=3600'
  );
}

function normalizePost(post) {
  return {
    id: post.id || '',
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
  };
}

module.exports = async function handler(request, response) {
  setHeaders(response);

  if (request.method === 'OPTIONS') {
    response.status(204).end();
    return;
  }

  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET, OPTIONS');

    response.status(405).json({
      error: 'Method not allowed.'
    });

    return;
  }

  const apiKey = process.env.BEEHIIV_API_KEY;
  const publicationId =
    process.env.BEEHIIV_PUBLICATION_ID;

  // This defaults to the correct content tag, so a separate
  // BEEHIIV_CONTENT_TAG variable is not required in Vercel.
  const contentTag =
    process.env.BEEHIIV_CONTENT_TAG ||
    'Featured Story';

  if (!apiKey || !publicationId) {
    response.status(500).json({
      error: 'Missing Beehiiv environment variables.'
    });

    return;
  }

  if (!publicationId.startsWith('pub_')) {
    response.status(500).json({
      error: 'The Beehiiv publication ID is invalid.'
    });

    return;
  }

  const parameters = new URLSearchParams();

  parameters.append(
    'content_tags[]',
    contentTag
  );

  parameters.set(
    'limit',
    String(UPSTREAM_LIMIT)
  );

  parameters.set(
    'order_by',
    'publish_date'
  );

  parameters.set(
    'direction',
    'desc'
  );

  parameters.set(
    'status',
    'confirmed'
  );

  // Includes web-only and posts published to both email and web.
  parameters.set(
    'platform',
    'all'
  );

  parameters.set(
    'audience',
    'all'
  );

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
      console.error(
        'Beehiiv API request failed:',
        beehiivResponse.status,
        beehiivResponse.statusText
      );

      response.status(502).json({
        error: 'Beehiiv returned an error.',
        status: beehiivResponse.status
      });

      return;
    }

    const result = await beehiivResponse.json();

    const posts = Array.isArray(result.data)
      ? result.data
      : [];

    const stories = posts
      .map(normalizePost)

      // Only include posts with a public webpage.
      .filter((story) => {
        return Boolean(
          story.id &&
          story.title &&
          story.link
        );
      })

      // Ensure the newest posts are first.
      .sort((first, second) => {
        return (
          Number(second.publishedAt || 0) -
          Number(first.publishedAt || 0)
        );
      })

      // Send exactly the six newest available stories.
      .slice(0, POST_LIMIT);

    response.status(200).json(stories);
  } catch (error) {
    const timedOut =
      error &&
      error.name === 'AbortError';

    console.error(
      'Featured Story endpoint error:',
      timedOut
        ? 'Beehiiv request timed out.'
        : error
    );

    response
      .status(timedOut ? 504 : 500)
      .json({
        error:
          'Featured Stories are temporarily unavailable.'
      });
  } finally {
    clearTimeout(timeout);
  }
};
