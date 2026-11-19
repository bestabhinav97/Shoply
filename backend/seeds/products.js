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
  {
    slug: "studio-headphones",
    name: "Studio headphones",
    category: "desk",
    price: 39900,
    description: "Classic black over-ear headphones for a desk setup. Other accessories are not included."
  },
  {
    slug: "city-daypack",
    name: "City daypack",
    category: "accessories",
    price: 34900,
    description: "A red and black backpack for your everyday rotation. Headphones and stationery pictured are not included."
  },
  {
    slug: "minimal-desk-lamp",
    name: "Minimal desk lamp",
    category: "desk",
    price: 29900,
    description: "A simple task lamp for a quiet workspace. Laptop and desk accessories are not included."
  },
  {
    slug: "everyday-writing-notebook",
    name: "Everyday writing notebook",
    category: "desk",
    price: 5900,
    description: "An understated notebook for notes and everyday ideas. The pen pictured is not included."
  },
  {
    slug: "daily-desk-planner",
    name: "Daily desk planner",
    category: "desk",
    price: 11900,
    description: "A desk planner for keeping your thoughts and plans together. Styling accessories are not included."
  },
  {
    slug: "classic-strap-watch",
    name: "Classic strap watch",
    category: "accessories",
    price: 49900,
    description: "An analog watch with a classic strap silhouette. This demo listing makes no water-resistance or movement claims."
  },
  {
    slug: "white-over-ear-headphones",
    name: "White over-ear headphones",
    category: "desk",
    price: 44900,
    description: "White over-ear headphones with a clean profile. The display stand is not included."
  },
  {
    slug: "sunshine-desk-lamp",
    name: "Sunshine desk lamp",
    category: "desk",
    price: 24900,
    description: "A cheerful yellow lamp for a study corner. Stationery and styling accessories are not included."
  },
  {
    slug: "brown-pocket-wallet",
    name: "Brown pocket wallet",
    category: "accessories",
    price: 19900,
    description: "A warm brown wallet with a compact folded profile for everyday carry."
  },
  {
    slug: "classic-black-wallet",
    name: "Classic black wallet",
    category: "accessories",
    price: 17900,
    description: "An understated black wallet for an everyday accessories collection. Phone and contents are not included."
  },
  {
    slug: "brown-buckle-belt",
    name: "Brown buckle belt",
    category: "accessories",
    price: 22900,
    description: "A brown belt with a warm-toned buckle and a classic casual silhouette."
  },
  {
    slug: "white-tea-set",
    name: "White tea set",
    category: "home",
    price: 34900,
    description: "A coordinated white teapot and tea bowl set for a minimal tabletop. Table styling is not included."
  },
  {
    slug: "floral-tea-set",
    name: "Floral tea set",
    category: "home",
    price: 59900,
    description: "A decorative floral teapot with coordinating cups and plate. Flowers and background props are not included."
  },
  {
    slug: "neutral-tableware-set",
    name: "Neutral tableware set",
    category: "home",
    price: 39900,
    description: "A coordinated selection of ceramic cups, bowls and plates in quiet neutral tones. Food and styling accessories are not included."
  },
  {
    slug: "open-page-journal",
    name: "Open-page journal",
    category: "desk",
    price: 7900,
    description: "A lined journal for daily reflections and lists. The pen pictured is not included."
  },
  {
    slug: "blue-writing-pen",
    name: "Blue writing pen",
    category: "desk",
    price: 2900,
    description: "A simple blue pen for your stationery collection. The notebook pictured is not included."
  },
  {
    slug: "midnight-headphones",
    name: "Midnight headphones",
    category: "desk",
    price: 32900,
    description: "Black over-ear headphones with a simple modern shape. Audio and connectivity specifications are not provided for this demo."
  },
  {
    slug: "stone-dial-watch",
    name: "Stone-dial watch",
    category: "accessories",
    price: 39900,
    description: "A classic analog watch for an understated accessories collection. This demo listing makes no water-resistance or movement claims."
  },
  {
    slug: "white-summer-sandals",
    name: "White summer sandals",
    category: "shoes",
    price: 27900,
    description: "White slip-on sandals with a clean summer silhouette.",
    options: [
      {
        name: "Size",
        values: [
          "EU 37",
          "EU 38",
          "EU 39",
          "EU 40"
        ]
      }
    ],
    combinations: [
      [
        0
      ],
      [
        1
      ],
      [
        2
      ],
      [
        3
      ]
    ]
  },
  {
    slug: "casual-black-deck-shoes",
    name: "Casual black deck shoes",
    category: "shoes",
    price: 19900,
    description: "Black lace-up deck shoes with contrasting soles for an easygoing wardrobe.",
    options: [
      {
        name: "Size",
        values: [
          "EU 37",
          "EU 38",
          "EU 39",
          "EU 40"
        ]
      }
    ],
    combinations: [
      [
        0
      ],
      [
        1
      ],
      [
        2
      ],
      [
        3
      ]
    ]
  },
];
