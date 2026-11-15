import { lazy, type ComponentType } from 'react';

const CampusMap = lazy(() => import('./campus-map/CampusMap').then(module => ({ default: module.CampusMap })));
const PaverFinder = lazy(() => import('./terrace-pavers/PaverFinder').then(module => ({ default: module.PaverFinder })));

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
    title: 'Terrace paver finder',
    description: 'Find an inscription, explore reported Terrace zones, and see photographed pavers in a small-area photo pilot.',
    category: 'Places & memories',
    component: PaverFinder,
  },
  {
    slug: 'campus-map',
    title: 'Campus dining map',
    description: 'Find dining and vending locations across campus. Explore providers, outlets, and the buildings around them.',
    category: 'Places & services',
    component: CampusMap,
  },
];
