// A made-up two-bedroom layout, drawn until the user uploads a plan of their own flat.
import schematic from './schematic.json';
import type { FloorPlan } from './types';

export const SCHEMATIC = schematic as unknown as FloorPlan;
