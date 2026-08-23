// Reading time from a post's raw markdown body.
//
// Deliberately crude: strip frontmatter, code fences and markup, count words,
// divide by 200 wpm. A long technical post reads slower than that, but rounding
// up on a crude count beats an exact number nobody trusts.

const WORDS_PER_MINUTE = 200;

export function readingTime(body: string | undefined): number {
  if (!body) return 1;
  const text = body
    .replace(/^---[\s\S]*?---/, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`]*`/g, "")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_~|-]/g, " ");
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}
