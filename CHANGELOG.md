# Changelog

## 0.3.1

- "Why" explains the module's own boiler decision. In observe mode the heat call still belongs to the old thermostat, so the card said "the boiler is paused" while the module would heat. The status now reports it as `boiler.wanted`.

## 0.3.0

The dashboard card.

- One card for the whole module: presets and hybrid mode, the flat with room temperatures and the devices that are running, why the module does what it does, the 48-hour forecast, the boiler flow curve with draggable points and weather-zone boundaries, a what-if estimate for any outdoor temperature, zone settings, room targets with night modes for the ACs, the load limit, the heating season and each layer's mode (off, observe, control), suggestions and the decision log.
- The integration serves the card and adds it to the dashboards' resources itself; it appears in the card picker as "Hybrid Heating". A failure there never stops the heating.
- Settings are edited as a draft and saved together; changes made elsewhere in the meantime are kept. Only administrators can change settings; everyone can switch presets.
- English and Russian, light and dark themes, phone and desktop layouts. Times are shown in Home Assistant's time zone.
- Card options: title, hidden sections, electricity price and currency.
- A sample floor plan by default. `tools/dxf_to_plan.py` turns a DXF drawing of your own flat into a plan you upload in the card editor; it is kept with the module's data in Home Assistant.
- Websocket commands `hybrid_heating/get_status`, `hybrid_heating/get_plan` and `hybrid_heating/set_plan` (admins only); `get_config` also reports the settings revision and the module's own entities.

## 0.2.0

The Home Assistant integration.

- Setup wizard in three steps (boiler and power; rooms, weather and air conditioners; existing heating), with no guessed entity ids, and an options flow to change them later.
- A control loop every minute, every 5 seconds while the home is over the power limit, and right when the overload hold time ends. Changes to the boiler, the water heater and the ACs wake it up early, and so does the power meter once it reads above the limit.
- Every layer starts in observe mode: decisions are logged, nothing is changed.
- Taking over and giving back: the existing thermostat, the boiler's flow setpoint and rods, the overpower automation (only with consent), the water heater and the ACs go back to how they were when a layer leaves Active, the module is disabled, or it is removed. A thermostat switched back on by hand returns the boiler to it.
- Safety: a 60-second grace period after Home Assistant starts (load shedding still acts during it), and after 5 failed cycles in a row, including failed starts, the module switches itself off and gives control back.
- A take-over or give-back that does not land is tried again; a thermostat found on after a restart while held is switched off again.
- Notifications for devices that stop responding, for the failsafe, and for anything left to restore by hand when the integration is removed.
- State survives restarts: settings, controller state, daily boiler write budget, the outdoor-temperature window and a 500-entry decision log. An unreadable section is reset on its own and reported.
- Entities: enabled and hybrid-mode switches, preset and boiler-mode selects, flow target, zone, status and heat loss sensors, boiler call and load shedding binary sensors. English and Russian names.
- Websocket commands `hybrid_heating/get_config`, `hybrid_heating/set_config` (admins only) and `hybrid_heating/get_log`, with reason texts in English or Russian.
- Diagnostics download.
- HACS support.

## 0.1.0

The control logic, tests and a season replay on a thermal model.
