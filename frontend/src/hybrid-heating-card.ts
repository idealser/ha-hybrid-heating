// The bundle Home Assistant loads: defines the card and lists it in the card picker.
import { HybridHeatingCard } from './card';
import { define } from './dom';
import { HybridHeatingCardEditor } from './editor';
import { HybridHeatingPlanCard } from './plan-card';

interface CustomCardEntry {
  type: string;
  name: string;
  description: string;
  preview: boolean;
}

declare global {
  interface Window {
    customCards?: CustomCardEntry[];
  }
}

define('hybrid-heating-card', HybridHeatingCard);
define('hybrid-heating-card-editor', HybridHeatingCardEditor);
define('hybrid-heating-plan-card', HybridHeatingPlanCard);

const CARDS: CustomCardEntry[] = [
  {
    type: 'hybrid-heating-card',
    name: 'Hybrid Heating',
    description: 'Heat pumps first, the boiler fills in, within the load limit.',
    preview: false,
  },
  {
    type: 'hybrid-heating-plan-card',
    name: 'Hybrid Heating: floor plan',
    description: 'Only the flat: room temperatures and what heats them.',
    preview: false,
  },
];

window.customCards ??= [];
for (const card of CARDS) if (!window.customCards.some(c => c.type === card.type)) window.customCards.push(card);
