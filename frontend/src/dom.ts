// Small DOM helpers shared by the card and its parts.

/** An event that crosses shadow roots up to the card (and, for hass-notification, to Home Assistant). */
export function fire<T>(el: EventTarget, name: string, detail: T): void {
  el.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
}

/** Define an element once: the bundle may be loaded twice (a resource and a YAML module). */
export function define(name: string, ctor: CustomElementConstructor): void {
  if (!customElements.get(name)) customElements.define(name, ctor);
}
