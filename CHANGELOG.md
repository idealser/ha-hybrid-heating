# Changelog

## 0.2.0

The Home Assistant integration.

- Setup wizard in three steps (boiler and power; rooms, weather and air conditioners; existing heating), with no guessed entity ids, and an options flow to change them later.
- A control loop every minute, and every 5 seconds while the home is over the power limit. Changes to the boiler, the water heater and the ACs wake it up early, and so does the power meter once it reads above the limit.
- Every layer starts in observe mode: decisions are logged, nothing is changed.
- Taking over and giving back: the existing thermostat, the boiler's flow setpoint and rods, the overpower automation (only with consent), the water heater and the ACs go back to how they were when a layer leaves Active, the module is disabled, or it is removed. A thermostat switched back on by hand returns the boiler to it.
- Safety: a 60-second grace period after Home Assistant starts, and after 5 failed cycles in a row the module switches itself off and gives control back.
- State survives restarts: settings, controller state, daily boiler write budget, the outdoor-temperature window and a 500-entry decision log. An unreadable section is reset on its own and reported.
- Entities: enabled and hybrid-mode switches, preset and boiler-mode selects, flow target, zone, status and heat loss sensors, boiler call and load shedding binary sensors. English and Russian names.
- Websocket commands `hybrid_heating/get_config`, `hybrid_heating/set_config` (admins only) and `hybrid_heating/get_log`, with reason texts in English or Russian.
- Diagnostics download.
- HACS support.

## 0.1.0

The control logic, tests and a season replay on a thermal model.
