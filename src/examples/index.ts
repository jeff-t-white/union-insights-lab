import type { ComponentType } from 'react';
import { CampusMap } from './campus-map/CampusMap';
import { TerracePavers } from './terrace-pavers/TerracePavers';

export type VisualizationExample = {
  slug: string;
  title: string;
  description: string;
  category: string;
  /** An example page should include the visualization, sources, and notes. */
  component: ComponentType;
};

// Add an entry only when there is a real visualization to explore.
export const examples: VisualizationExample[] = [
  {
    slug: 'terrace-pavers',
    title: 'A closer look at the Terrace',
    description: 'Explore a small Terrace section through overlapping photographs. A first experiment in finding the stories underfoot.',
    category: 'Places & memories',
    component: TerracePavers,
  },
  {
    slug: 'campus-map',
    title: 'A map of our campus',
    description: 'Explore UW–Madison, from the lakeshore to the streets around campus. A foundation for mapping Wisconsin Union dining.',
    category: 'Geography',
    component: CampusMap,
  },
];
