// The bundle Home Assistant loads: defines the card and lists it in the card picker.
import { HybridHeatingCard } from './card';
import { define } from './dom';
import { HybridHeatingCardEditor } from './editor';

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

window.customCards ??= [];
if (!window.customCards.some(c => c.type === 'hybrid-heating-card')) {
  window.customCards.push({
    type: 'hybrid-heating-card',
    name: 'Hybrid Heating',
    description: 'Heat pumps first, the boiler fills in, within the load limit.',
    preview: false,
  });
}
