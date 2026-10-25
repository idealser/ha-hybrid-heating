// A labelled −/+ setting: the step, its range and the pairs that keep apart come from logic/steppers.
import { html } from 'lit';
import { fire } from '../dom';
import { stepSetting, type StepperKey } from '../logic/steppers';
import type { HhSettings } from '../types';
import './hh-stepper';

export function stepperField(
  host: EventTarget,
  s: HhSettings,
  key: StepperKey,
  label: string,
  text: string,
  disabled: boolean,
) {
  return html`<div class="field">
    <span class="lbl">${label}</span>
    <hh-stepper
      .label=${label}
      .text=${text}
      .disabled=${disabled}
      @hh-step=${(e: CustomEvent<{ dir: -1 | 1 }>) => fire(host, 'hh-edit', { next: stepSetting(s, key, e.detail.dir) })}
    ></hh-stepper>
  </div>`;
}
