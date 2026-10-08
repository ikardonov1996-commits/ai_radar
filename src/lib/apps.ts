import type { App } from "@prisma/client";

export type StoreUrls = { ios?: string; android?: string; web?: string };

export type AppCard = {
  id: string;
  slug: string;
  name: string;
  developer: string | null;
  oneLiner: string;
  description: string;
  iconUrl: string | null;
  imageUrl: string | null;
  screenshots: string[];
  platforms: ("ios" | "android" | "web")[];
  price: "free" | "freemium" | "paid";
  rating: number | null;
  installs: string | null;
  storeUrls: StoreUrls;
  topics: string[];
};

export function toCard(a: App): AppCard {
  return {
    id: a.id,
    slug: a.slug,
    name: a.name,
    developer: a.developer,
    oneLiner: a.oneLiner,
    description: a.description,
    iconUrl: a.iconUrl,
    imageUrl: a.imageUrl,
    screenshots: a.screenshots,
    platforms: a.platforms,
    price: a.price,
    rating: a.rating,
    installs: a.installs,
    storeUrls: (a.storeUrls ?? {}) as StoreUrls,
    topics: a.topics,
  };
}
