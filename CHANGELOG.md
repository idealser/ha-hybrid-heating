# Changelog

## 0.10.0

- **Heat capacity:** the forecast's flat cooled about four times too fast. Its heat capacity was a fixed 5.2 kWh/K, while a concrete flat that cooled for 58 hours with nothing heating showed about 23 kWh/K, so Away promised 17.5° within a day where the flat held 20°.
  - The module now learns it. Every minute counts into its hour: whether the boiler had a heat call or an AC heated, and the mean of the rooms and outside. Every night at 04:30 it takes the hours of the last two weeks with nothing heating, after the first hour (the radiators still give off heat), and divides the heat the flat lost by the heat loss and gains the forecast uses by how far it cooled. It needs 24 such hours and 1° of cooling in all.
  - `sensor.hybrid_heating_heat_capacity` shows what the forecast uses; System lists the latest estimate beside the heat loss, and the log records it. It never changes the control.
  - The card option `capacity_kwh_per_k` (Heat capacity in the card editor) sets it by hand instead.

## 0.9.0

- **Thermostat:** the module is now one climate entity, `climate.hybrid_heating`, so Home Assistant's own thermostat tile, the phone app and voice assistants can show and change it. It shows the temperature the boiler follows, the target in effect and whether the flat is being heated.
  - Moving the target changes the preset in effect for good, the same as on the card; with Comfort inside the night window that is Night's target. The steps and limits are the card's.
  - The presets are the module's four.
  - Auto, Heat and Off are the heating season (Auto, Always on, Always off). Off keeps the heating off with the module still in charge: switching the module off would hand the boiler back to the old thermostat.

## 0.8.0

- **Forecast chart:** under the outdoor temperature, the flat's modelled temperature against its target (it cools during Away and Night and warms up after) and the electricity per hour, the boiler and the ACs stacked. A tapped hour is marked across all three and says how warm the flat is then.
- **Curve learning in smooth mode:** the room correction covers for a curve point that is off, so the rooms still reach their targets. The module now also watches what the correction adds, per 5° outdoor band, while the boiler runs its curve. A band where it adds or takes off 1.5° or more on average, on 3 days within a week, suggests moving that point by 1.5°.
- **Curve changes:** in smooth mode, the curve takes over what the correction had already added, so the flow does not jump twice after a change.

## 0.7.0

The forecast explains itself and the estimate is closer to the flat; fixes from a whole-plugin audit.

- **Forecast:** tap an hour, or use the arrow keys, to see what runs then: the ACs, the boiler and its rods, the flow and about how much it draws. The estimate now runs hour by hour from the rooms' temperatures: a warm flat cools on its stored heat before the heating has to start (Away, Night). Out of the heating season nothing is heated, and the totals say so. A weather entity without an hourly forecast is said so and asked again every 30 minutes.
- **Room targets:** each room has its own target against the preset (−3…+3°) on Rooms & power, so the child's −1° and applied Cold/Hot suggestions can be changed.
- **ACs:** an AC someone ran by hand and then switched off stays off until the preset changes, like one the module started; it was started again at once.
- **Texts:**
  - The boiler's texts say whether the room is below, above or at its target.
  - A load pause shows as such on every tick, in Why and on the status sensor.
  - Settings and saved times read plainly in the log.
  - Errors are in the card's words and language.
  - AC modes are named in words.
  - A Cold/Hot mark that makes a suggestion names it.
  - The setup wizard says Control, as the card does.
- **Card:**
  - A module that is off says so instead of "Starting", and offers no Cold/Hot.
  - The Load section speaks of what the module runs with, not of unsaved edits.
  - On a phone, picking a zone brings its editor into view, and the Russian tab bar fits.

## 0.6.0

Suggestions and the forecast. A suggestion changes nothing by itself: an admin applies or dismisses it.

- **Forecast:** the card shows the next 48 hours from the hourly forecast of the weather entity chosen in the setup.
- **Cold/Hot:** anyone in the house can mark a room on the plan or under Rooms & power. Two marks of the same kind within 7 days, an hour apart, suggest raising or lowering that room's target by 0.3° (the bathroom: the whole curve by 1°).
- **Morning check of the curve:** with the boiler in Control, three mornings in a row in one 5° outdoor band with the room the boiler follows 0.5° off its target suggest moving that curve point by 1.5°.
- **Heat loss:** estimated every Monday from the recorder's daily statistics, over whole heating days without the ACs. A good estimate is what the forecast and the what-if use and what `sensor.hybrid_heating_heat_loss` shows; it never changes the control.
- A dismissed suggestion does not come back for 30 days in similar weather; one whose setting someone changed meanwhile is withdrawn. The log records marks, suggestions and decisions.
- **Card fix:** Apply and Not now send the suggestion as `suggestion_id`; Home Assistant uses a message's `id` for itself.

## 0.5.0

Easier to read and to use.

- **Now:** "Why" starts with one plain line: the boiler, the ACs and the load ("Would heat, flow 36° · ACs run by hand · load 1.3 of 8.0 kW").
- **Floor plan:** tap a room (or focus it and press Enter) for its reading against its own target, what heats it, how its AC runs, and Cold/Hot.
- **Curve & zones:** the zone list is gone; the strip under the chart picks the zone (by click or keyboard), and the zone editor shows what that zone runs.
- **System:** before the boiler goes to Control, a note says when your old thermostat holds a different target than the module. The version is shown here instead of the header.
- **Phone:** the four presets fit one row.

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
