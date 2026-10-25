# Hybrid Heating for Home Assistant

Heating control for a flat with an electric boiler and radiators, plus heat-pump air conditioners in some rooms.

**Status:** early development. The control logic and the Home Assistant integration are done and tested; the dashboard card is in progress. A fresh install only observes: it logs what it would do and changes nothing until you switch a layer to Active.

## What it does

- **Heat pumps first.** Each AC holds its own room using that room's temperature sensor, not the unit's built-in one. The boiler covers the rooms without an AC and steps in when an AC can't keep up.
- **Radiators that never go cold.** The boiler runs a weather-compensated flow curve, corrected by the room temperatures, instead of switching on and off. You set the curve with 9 points, one every 5 °C.
- **Weather zones.** Outdoor temperature bands decide which ACs run, how the boiler works (off, backup or main), and how many heating rods it may use.
- **Per-room targets.** Each room gets an offset from the preset target, for example a cooler child's room.
- **Load shedding.** When the whole flat stays over the power limit (8 kW, held 5 s by default), the module pauses the boiler, switches off the water heater and lowers the boiler's rods. It never touches the ACs.
- **Safe roll-out.** Each layer (boiler, ACs, load) can be off, observe-only or active. In observe mode the module logs what it would do and changes nothing.
- **Gives control back.** When the boiler layer goes active, the module switches your existing thermostat off and remembers its settings. When the layer leaves active, or the module is disabled or removed, it restores them. Turning the thermostat back on yourself hands the boiler back to it.
- **Explains itself.** Every decision comes with a reason, in English or Russian.

## Installation

Requires Home Assistant 2026.10 or newer and [HACS](https://hacs.xyz/).

1. In HACS, open the ⋮ menu → **Custom repositories**. Add `https://github.com/idealser/ha-hybrid-heating` with type **Integration**.
2. Find **Hybrid Heating** in HACS, **Download** it, and restart Home Assistant.
3. Go to **Settings → Devices & services → Add integration → Hybrid Heating**. The wizard has three steps:
   - **Boiler and power:** the heat-call switch, the flow-setpoint climate entity, the max-rods number, the flow and active-rods sensors, the boiler and whole-home power sensors, and the water heater switch.
   - **Rooms, weather and air conditioners:** a temperature sensor per room, outdoor temperature, weather, the two ACs and (optionally) their quiet-mode switches.
   - **Existing heating:** the thermostat that drives the boiler today, and optionally an automation that already protects against overload. Tick the box only if the module should switch that automation off while its load layer is active.

You can change the entities later under the integration's **Configure**.

### What you get

| Entity | What it shows |
| --- | --- |
| `switch.hybrid_heating_enabled` | The whole module on or off. Off gives everything back. |
| `switch.hybrid_heating_hybrid_mode` | Heat pumps first, or boiler only. |
| `select.hybrid_heating_preset` | Comfort, Eco, Night or Away. |
| `select.hybrid_heating_boiler_mode` | Smooth (weather curve) or Classic (on/off). |
| `sensor.hybrid_heating_flow_target` | The flow temperature the module wants. |
| `sensor.hybrid_heating_zone` | The current weather zone. |
| `sensor.hybrid_heating_status` | One line: zone, preset, target and what the boiler is doing. |
| `sensor.hybrid_heating_heat_loss` | The heat loss estimate (W/K). |
| `binary_sensor.hybrid_heating_boiler_call` | Whether the module wants the boiler to heat. |
| `binary_sensor.hybrid_heating_load_shedding` | Whether it is shedding load (or would, in observe mode). |

**Diagnostics** (the integration's ⋮ menu → Download diagnostics) contain the settings, the controller state and the last 500 decisions.

### Switching a layer to Active

Until the dashboard card is ready, use the browser console on any Home Assistant page (admin users only):

```js
await document.querySelector("home-assistant").hass.callWS({
  type: "hybrid_heating/set_config",
  settings: { layers: { boiler: "active" } },
});
```

Send the same command with `"observe"` to go back. Watch the log for a few days in observe mode first.

## Development

Requires [uv](https://docs.astral.sh/uv/) and Python 3.14.

```bash
uv sync
uv run pytest -m "not replay"   # fast tests (Home Assistant tests need Linux)
uv run pytest -m replay         # season replay on a thermal model of a flat
```

Home Assistant's test harness needs a Unix system. On Windows, `scripts/ha-pytest.sh` runs the same pytest arguments in a Linux container; the core tests also run natively with `-p no:homeassistant`.

The season replay runs on `local/data/season.csv` when you provide one (hourly `ts,t_out,boiler_kw,total_kw`; see `tools/export_history.py`). Without it, it uses a deterministic synthetic season. The `local/` folder is git-ignored and meant for private data.

## License

MIT
