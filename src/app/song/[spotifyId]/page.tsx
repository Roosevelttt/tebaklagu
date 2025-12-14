import { headers } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import { slugify } from '@/lib/slugify';

interface SongApiResponse {
  track?: {
    name?: string;
  };
}

export default async function SongIdRedirectPage(
  { params }: { params: Promise<{ spotifyId: string }> }
) {
  const { spotifyId } = await params;
  if (!spotifyId) {
    notFound();
  }

  const headerList = await headers();
  const host = headerList.get('host');
  const protocol = headerList.get('x-forwarded-proto') ?? 'http';

  if (!host) {
    notFound();
  }

  const baseUrl = `${protocol}://${host}`;
  let slug = 'song';

  try {
    const res = await fetch(`${baseUrl}/api/song/${spotifyId}`, { cache: 'no-store' });
    if (!res.ok) {
      throw new Error(`Failed to fetch song: ${res.status}`);
    }

    const data: SongApiResponse = await res.json();
    if (data.track?.name) {
      const resolvedSlug = slugify(data.track.name);
      if (resolvedSlug) {
        slug = resolvedSlug;
      }
    }
  } catch (error) {
    console.error('Song canonical redirect failed:', error);
    notFound();
  }

  redirect(`/song/${spotifyId}/${slug}`);
}
