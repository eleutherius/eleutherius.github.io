import { z, defineCollection, type SchemaContext } from "astro:content";
import { glob } from "astro/loaders";

// heroImage is a path relative to the post file (e.g. ../../assets/images/x.webp).
// Going through image() means Astro reads its real size and optimises it.
const blogSchema = ({ image }: SchemaContext) => z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    heroImage: image().optional(),
    badge: z.string().optional(),
    draft: z.boolean().default(false),
    tags: z.array(z.string()).refine(items => new Set(items).size === items.length, {
        message: 'tags must be unique',
    }).optional(),
});

export type BlogSchema = z.infer<ReturnType<typeof blogSchema>>;

const blogCollection = defineCollection({
    loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/blog' }),
    schema: blogSchema,
});

export const collections = {
    'blog': blogCollection,
}
