// Geographic coordinates always use [longitude, latitude] in D3.
// This is a viewing center, not a surveyed campus boundary or dining location.
export const CAMPUS_CENTER: [number, number] = [-89.418, 43.0765];
export const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const DINING_SOURCE = 'https://union.wisc.edu/dine/find-food-and-drink';

export type DiningLocation = {
  id: string;
  name: string;
  building: string;
  address: string;
  coordinates: [longitude: number, latitude: number];
  sourceUrl: string;
};

// Populate only after verifying the locations. No placeholder coordinates.
export const diningLocations: DiningLocation[] = [];
