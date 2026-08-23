// Single source of truth for reading blog posts and building post URLs.
//
// Why this file exists:
//  - Drafts must be excluded from every consumer (index, post route, tag
//    archive, RSS). One filter in one place instead of four copies that drift.
//  - Post URLs must be built identically everywhere. The RSS feed used to build
//    `/blog/${post.id}/` while the route generated `createSlug(title)`, so every
//    feed link 404'd. Going through postSlug() makes that mismatch impossible.

import { getCollection, type CollectionEntry } from "astro:content";
import createSlug from "./createSlug";

export type Post = CollectionEntry<"blog">;

/** Drafts are visible in `astro dev`, never in a build. */
const includeDrafts = import.meta.env.DEV;

/** Published posts, newest first. */
export async function getPublishedPosts(): Promise<Post[]> {
  const posts = await getCollection("blog", ({ data }) => includeDrafts || !data.draft);
  return posts.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

/** The `slug` route param for a post. */
export function postSlug(post: Post): string {
  return createSlug(post.data.title, post.id);
}

/** The canonical path of a post. Use this everywhere — never hand-build it. */
export function postUrl(post: Post): string {
  return `/blog/${postSlug(post)}/`;
}
