// Fictional development products. These are not supplier specifications or offers.
export const categories = [
  { slug: "shoes", name: "Shoes" },
  { slug: "accessories", name: "Accessories" },
  { slug: "home", name: "Home & living" },
  { slug: "desk", name: "Desk essentials" },
];

export const products = [
  {
    slug: "everyday-white-sneaker",
    name: "Everyday white sneaker",
    category: "shoes",
    price: 44900,
    options: [
      { name: "Color", values: ["White"] },
      { name: "Size", values: ["EU 40", "EU 41", "EU 42", "EU 43"] },
    ],
    combinations: [
      [0, 0],
      [0, 1],
      [0, 2],
      [0, 3],
    ],
    description:
      "A clean lace-up silhouette for an everyday wardrobe. Pair it with your favourite casual outfit.",
  },
  {
    slug: "classic-canvas-sneaker",
    name: "Classic canvas sneaker",
    category: "shoes",
    price: 34900,
    options: [
      { name: "Color", values: ["Black"] },
      { name: "Size", values: ["EU 38", "EU 39", "EU 40", "EU 41"] },
    ],
    combinations: [
      [0, 0],
      [0, 1],
      [0, 2],
      [0, 3],
    ],
    description:
      "A classic black-and-white lace-up silhouette with a relaxed, casual feel.",
  },
  {
    slug: "weekend-sunglasses",
    name: "Weekend sunglasses",
    category: "accessories",
    price: 14900,
    description:
      "An understated accessory for your everyday rotation. This demo listing makes no UV-protection or optical-performance claims.",
  },
  {
    slug: "blue-lens-sunglasses",
    name: "Blue-lens sunglasses",
    category: "accessories",
    price: 17900,
    description:
      "Dark frames with blue-toned lenses and a simple silhouette. This demo listing makes no UV-protection or optical-performance claims.",
  },
  {
    slug: "everyday-tote",
    name: "Everyday tote",
    category: "accessories",
    price: 29900,
    description:
      "A relaxed tote with contrasting handles for a simple everyday look.",
  },
  {
    slug: "morning-ceramic-mug",
    name: "Morning ceramic mug",
    category: "home",
    price: 8900,
    description:
      "A ceramic mug with a patterned detail and rounded handle. A quiet addition to your kitchen shelf.",
  },
  {
    slug: "minimal-ceramic-mug",
    name: "Minimal ceramic mug",
    category: "home",
    price: 9900,
    description:
      "A minimal white ceramic silhouette to complement a calm tabletop.",
  },
  {
    slug: "soft-shape-vase",
    name: "Soft-shape vase",
    category: "home",
    price: 19900,
    description:
      "A sculptural white vase for a small corner or shelf. Decorative stems in the photograph are not included.",
  },
  {
    slug: "tabletop-vase",
    name: "Tabletop vase",
    category: "home",
    price: 24900,
    description:
      "A soft white vase with a simple profile. Flowers and styling accessories in the photograph are not included.",
  },
  {
    slug: "quiet-evening-candle",
    name: "Quiet evening candle",
    category: "home",
    price: 12900,
    description:
      "A candle in a simple glass vessel for your shelf or table. Scent, composition and burn time are not specified for this demo item.",
  },
  {
    slug: "amber-glass-candle",
    name: "Amber glass candle",
    category: "home",
    price: 15900,
    quantity: 0,
    description:
      "A candle in a warm-toned glass container. Scent, composition and burn time are not specified for this demo item.",
  },
  {
    slug: "daily-spiral-notebook",
    name: "Daily spiral notebook",
    category: "desk",
    price: 6900,
    description:
      "A simple spiral notebook for lists, sketches and everyday thoughts. Other desk accessories shown are not included.",
  },
];
