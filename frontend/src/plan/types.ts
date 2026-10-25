// The floor plan the card draws (validated by the integration's floor_plan.py). Millimetres, y down.
import type { AcRoom, Room } from '../types';

export type Pt = [number, number];

export interface PlanRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** An AC body; its air runs from `from` to `to` (y), centred on `cx`. */
export interface PlanAc extends PlanRect {
  cx: number;
  from: number;
  to: number;
}

export interface PlanRadiator extends PlanRect {
  room: Room;
  sections: number | null;
}

export interface FloorPlan {
  version: 1;
  viewBox: [number, number, number, number];
  walls: Pt[][];
  glass: PlanRect[];
  bays: Pt[][];
  neutral: Pt[][];
  rooms: Record<Room, { polygons: Pt[][]; label: Pt }>;
  small_labels: { key: 'hall' | 'wardrobe' | 'storage'; at: Pt }[];
  radiators: PlanRadiator[];
  acs: Partial<Record<AcRoom, PlanAc>>;
  floor_heating: (PlanRect & { room: Room })[];
}
