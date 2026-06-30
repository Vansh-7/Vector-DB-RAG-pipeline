import type { Category, VectorPoint2D } from '../types';

const CLUSTER_CENTERS: Record<Category, { x: number; y: number }> = {
  TECH: { x: -3, y: 2.5 },
  FINANCE: { x: 3.5, y: 3 },
  FOOD: { x: -2, y: -3 },
  'SPORTS & GAMES': { x: 4, y: -2 },
  DOCUMENTS: { x: -4, y: -0.5 },
  MATHEMATICS: { x: 1, y: -4 },
};

const CATEGORIES: Category[] = [
  'TECH',
  'FINANCE',
  'FOOD',
  'SPORTS & GAMES',
  'DOCUMENTS',
  'MATHEMATICS',
];

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return s / 2147483647;
  };
}

function gaussianRandom(rand: () => number): number {
  const u1 = rand();
  const u2 = rand();
  return Math.sqrt(-2 * Math.log(u1 || 0.001)) * Math.cos(2 * Math.PI * u2);
}

export function generateMockVectors(count = 200): VectorPoint2D[] {
  const rand = seededRandom(42);
  const perCategory = Math.floor(count / CATEGORIES.length);
  const vectors: VectorPoint2D[] = [];

  for (const category of CATEGORIES) {
    const center = CLUSTER_CENTERS[category];
    const n = category === CATEGORIES[CATEGORIES.length - 1]
      ? count - vectors.length
      : perCategory;

    for (let i = 0; i < n; i++) {
      const spread = 1.2 + gaussianRandom(rand) * 0.3;
      vectors.push({
        id: `vec_${category.toLowerCase().replace(/[^a-z]/g, '')}_${String(i).padStart(3, '0')}`,
        x: center.x + gaussianRandom(rand) * spread,
        y: center.y + gaussianRandom(rand) * spread,
        category,
        payload: `Sample ${category} document ${i + 1}`,
      });
    }
  }

  return vectors;
}

export const MOCK_VECTORS = generateMockVectors(200);
