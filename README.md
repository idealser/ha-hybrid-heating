# Hybrid Heating for Home Assistant

Heating control for a flat with an electric boiler and radiators, plus heat-pump air conditioners in some rooms.

**Status:** early development. The control logic, the Home Assistant integration, the dashboard card, the suggestions and the forecast are done and tested; the ACs' own rollout comes next. A fresh install only observes: it logs what it would do and changes nothing until you switch a layer to Active.

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
| `climate.hybrid_heating` | The module as a thermostat, for tiles, the phone and voice: the temperature the boiler follows, the target in effect (moving it changes that preset's target for good) and the presets. Auto, Heat and Off are the heating season; Off keeps the heating off with the module in charge. |
| `switch.hybrid_heating_enabled` | The whole module on or off. Off gives everything back. |
| `switch.hybrid_heating_hybrid_mode` | Heat pumps first, or boiler only. |
| `select.hybrid_heating_preset` | Comfort, Eco, Night or Away. |
| `select.hybrid_heating_boiler_mode` | Smooth (weather curve) or Classic (on/off). |
| `sensor.hybrid_heating_flow_target` | The flow temperature the module wants. |
| `sensor.hybrid_heating_zone` | The current weather zone. |
| `sensor.hybrid_heating_status` | One line: zone, preset, target and what the boiler is doing. |
| `sensor.hybrid_heating_heat_loss` | The heat loss the estimates use (W/K): learned every Monday from the recorder's daily statistics, the 150 W/K default until there are enough whole heating days without the ACs. |
| `sensor.hybrid_heating_heat_capacity` | How much heat the flat stores per degree (kWh/K), which sets how fast the forecast lets it cool and warm up: learned every night from the hours the module saw nothing heating, the 5.2 kWh/K default until there are 24 such hours over two weeks with the flat cooling by 1° or more. |
| `binary_sensor.hybrid_heating_boiler_call` | Whether the module wants the boiler to heat. |
| `binary_sensor.hybrid_heating_load_shedding` | Whether it is shedding load (or would, in observe mode). |

**Diagnostics** (the integration's ⋮ menu → Download diagnostics) contain the settings, the controller state and the last 500 decisions.

## Dashboard card

The integration serves its own card and adds it to your dashboards' resources, so there is nothing to install or write in YAML. (A dashboard in YAML mode gets it as an extra module instead.)

1. Edit a dashboard, **Add card**, and pick **Hybrid Heating**. It is meant to be the only card on a **Panel** view, or a full-width card in a Sections view.
2. The card has four tabs. **Now** shows the flat (tap a room for its details and Cold/Hot), why the module does what it does and the forecast: outside, the flat inside and the electricity per hour (tap an hour to see what runs then). **Curve & zones** has the flow curve (drag its points), the weather zones (pick one on the strip under the chart, drag the boundaries between them) and a what-if estimate. **Rooms & power** has the preset targets, each room's target against the preset, the ACs' night modes and the load limit. **System** has each layer's mode (Off, Observe, Control), the heating season, the suggestions and the decision log. Mark a room Cold or Hot when it feels wrong: similar marks, and three mornings in a row off target, lead to suggestions an admin applies or dismisses. Presets and hybrid mode switch at once; every other change is a draft until you press **Save** in the bar that appears.
3. Only administrators can change settings. Other users see the same card read-only, and can still switch presets.

The card follows the language of your Home Assistant profile (English or Russian) and its theme, including dark mode. Its options, set in the card editor or in YAML:

| Option | What it does |
| --- | --- |
| `title` | Replaces the heading. |
| `hide_sections` | Sections to leave out: `plan`, `why`, `forecast`, `curve`, `probe`, `zone`, `rooms`, `load`, `season`, `suggestions`, `log`. |
| `tariff_per_kwh`, `currency` | Your electricity price, for the cost estimates (default 0.25 €). |
| `capacity_kwh_per_k` | The flat's heat capacity, if you'd rather set it than use what the module learns. |

The floor plan starts as a sample layout. To show your own flat, convert its DXF drawing with `tools/dxf_to_plan.py` (see the docstring for the overlay that names the rooms), then upload the JSON in the card editor under **Floor plan**. It is stored in Home Assistant with the module's data, not in the dashboard.

## Development

Requires [uv](https://docs.astral.sh/uv/) and Python 3.14.

```bash
uv sync
uv run pytest -m "not replay"   # fast tests (Home Assistant tests need Linux)
uv run pytest -m replay         # season replay on a thermal model of a flat
```

The card lives in `frontend/` (Lit and TypeScript; Node 24):

```bash
cd frontend
npm ci
npm test                 # unit tests
npm run typecheck
npm run build            # writes custom_components/hybrid_heating/frontend/hybrid-heating-card.js (committed)
npx playwright test      # the card in a test page against a fake Home Assistant
npm run harness          # that page at http://localhost:5179/test/harness/index.html
```

Screenshot baselines are kept per platform. The Linux ones come from the Playwright image CI uses: `docker run --rm -v "$PWD:/work" -v hh-node-modules:/work/node_modules -w /work mcr.microsoft.com/playwright:v1.64.1-noble sh -c 'npm ci && npx playwright test test/e2e/screenshots.spec.ts'`.

Home Assistant's test harness needs a Unix system. On Windows, `scripts/ha-pytest.sh` runs the same pytest arguments in a Linux container; the core tests also run natively with `-p no:homeassistant`.

The season replay runs on `local/data/season.csv` when you provide one (hourly `ts,t_out,boiler_kw,total_kw`; see `tools/export_history.py`). Without it, it uses a deterministic synthetic season. The `local/` folder is git-ignored and meant for private data.

## License

MIT
