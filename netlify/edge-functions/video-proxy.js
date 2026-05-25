export default async (request) => {
  const url = new URL(request.url);
  const videoPath = url.pathname.replace('/media/video/', '');
  const videoUrl = `https://video.twimg.com/${videoPath}`;

  const resp = await fetch(videoUrl);

  if (!resp.ok) {
    return new Response(null, { status: resp.status });
  }

  return new Response(resp.body, {
    status: 200,
    headers: {
      'content-type': resp.headers.get('content-type') || 'video/mp4',
      'cache-control': 'public, max-age=604800',
      'access-control-allow-origin': '*',
    },
  });
};

export const config = {
  path: '/media/video/*',
};
