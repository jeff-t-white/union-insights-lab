// Geographic coordinates always use [longitude, latitude] in D3.
// This is a viewing center, not a surveyed campus boundary or dining location.
export const CAMPUS_CENTER: [number, number] = [-89.418, 43.0765];
export const DINING_SOURCE = 'https://union.wisc.edu/dine/find-food-and-drink';
// Retain remote locations in the data, but keep Reset focused on main campus.
export const CAMPUS_FIT_EXCLUDED_MAP_OBJECT_IDS = [723]; // Printing, 2109 S Stoughton Rd.

// Dining building shapes and grouped outlets live in dining-buildings.json.
