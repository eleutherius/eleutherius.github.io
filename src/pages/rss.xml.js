import rss from "@astrojs/rss";
import { SITE_TITLE, SITE_DESCRIPTION } from "../config";
import { getPublishedPosts, postUrl } from "../lib/posts";

export async function GET(_context) {
  const blog = await getPublishedPosts();
  return rss({
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    site: import.meta.env.SITE,
    customData: `<language>en-us</language>`,
    items: blog.map((post) => ({
      title: post.data.title,
      pubDate: post.data.pubDate,
      description: post.data.description,
      // Was `/blog/${post.id}/` — that 404'd, because pages are routed by
      // createSlug(title) when GENERATE_SLUG_FROM_TITLE is on.
      link: postUrl(post),
      categories: post.data.tags,
    })),
  });
}
