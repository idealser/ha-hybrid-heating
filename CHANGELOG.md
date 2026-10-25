# Changelog

## 0.4.1

What the card says is now true in every mode.

- **Observe mode:** "Why" says what the module *would* do ("Would keep the radiators warm", "Would switch off: …"), ACs it does not run are shown as run by hand with their own setpoint, and the flow chip is labelled as the module's.
- **Start-up:** until the first decision after a restart, "Why" says the module is starting instead of "the boiler is paused". The status reports this as `decided`.
- **Rooms:** the boiler follows "the room furthest below its target", named with its real reading; room offsets no longer show a shifted number. The log and status texts give the gap to the target for the same reason.
- **Pauses and load:** a pause out of season or for the load says so. Recovery after an overload is shown as such, and the shedding order matches what the module does. An overload being held shows before shedding starts.
- **Background curve and what-if:** no lower flow where the boiler only backs up the ACs (the warm zone), as the core computes it. AC night modes apply in the night window with any preset.
- **ACs:** an AC in another mode, switched off by hand, or with its layer off is described as such.
- **Floor plan:** the radiators show the real heat call.
- **Log:** an entry leads with what changed, failed and skipped commands are marked, and dates read day/month.
- **Status line:** old data says so, and out of season a layer in control still reads "In control".
- The boiler's tolerance setting is shown only in on/off mode.

## 0.4.0

The card in tabs, so the overview is not buried under the settings.

- **Now**: the flat, why, the 48-hour forecast and any new suggestion. **Curve & zones**: the flow curve, the selected zone and the what-if estimate. **Rooms & power**: targets, AC night modes, Cold/Hot and the load limit. **System**: each layer's mode, the heating season, the decision log and all suggestions.
- The card opens on Now and remembers the last tab on each device. A tab whose sections are all hidden disappears.
- A line under the title says who is in control ("Observing — nothing is changed", "In control: boiler · observing: ACs, load") on every tab.
- Save and Discard appear in a bar only while something is unsaved; a tab with unsaved edits shows a dot.
- Long explanations show their first sentence; the rest is behind ⓘ.

## 0.3.2

- The card has its own side padding. A panel view gives a card the full width with no margin, so the content touched the edges.

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
