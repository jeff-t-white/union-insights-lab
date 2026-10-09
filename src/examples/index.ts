import type { ComponentType } from 'react';
import { CampusMap } from './campus-map/CampusMap';

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
    slug: 'campus-map',
    title: 'A map of our campus',
    description: 'Explore UW–Madison, from the lakeshore to the streets around campus. A foundation for mapping Wisconsin Union dining.',
    category: 'Geography',
    component: CampusMap,
  },
];
