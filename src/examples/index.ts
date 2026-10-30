import type { ComponentType } from 'react';
import { CampusMap } from './campus-map/CampusMap';
import { PaverFinder } from './terrace-pavers/PaverFinder';

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
    description: 'Find an inscription, explore reported Terrace zones, and see photographed pavers in a small-area photo pilot.',
    category: 'Places & memories',
    component: PaverFinder,
  },
  {
    slug: 'campus-map',
    title: 'A map of our campus',
    description: 'Explore UW–Madison, from the lakeshore to the streets around campus. A foundation for mapping Wisconsin Union dining.',
    category: 'Geography',
    component: CampusMap,
  },
];
