"""Constants shared by the Home Assistant glue. No Home Assistant imports here."""

from typing import Final

DOMAIN: Final = "hybrid_heating"
TITLE: Final = "Hybrid Heating"
VERSION: Final = "0.8.0"
STORAGE_VERSION: Final = 1

# Timing (seconds)
TICK_S: Final = 60
FAST_TICK_S: Final = 5
DEBOUNCE_S: Final = 5.0
STARTUP_GRACE_S: Final = 60
COMMAND_TIMEOUT_S: Final = 10.0
SAVE_DELAY_S: Final = 300
MAX_TICK_FAILURES: Final = 5

# Sizes
LOG_SIZE: Final = 500
WINDOW_BUCKET_S: Final = 300
WINDOW_MAX_HOURS: Final = 72
DEFAULT_HEAT_LOSS_W_PER_K: Final = 150.0
WS_PREFIX: Final = "hybrid_heating/"

# Config entry keys: boiler and power
CONF_BOILER_CALL: Final = "boiler_call"
CONF_BOILER_FLOW: Final = "boiler_flow"
CONF_BOILER_RODS: Final = "boiler_rods"
CONF_FLOW_TEMPERATURE: Final = "flow_temperature"
CONF_ACTIVE_RODS: Final = "active_rods"
CONF_BOILER_POWER: Final = "boiler_power"
CONF_TOTAL_POWER: Final = "total_power"
CONF_WATER_HEATER: Final = "water_heater"
# Rooms and weather
CONF_TEMP_LIVING: Final = "temp_living"
CONF_TEMP_BEDROOM: Final = "temp_bedroom"
CONF_TEMP_CHILD: Final = "temp_child"
CONF_TEMP_BATH: Final = "temp_bath"
CONF_OUTDOOR: Final = "outdoor"
CONF_WEATHER: Final = "weather"
# Air conditioners
CONF_AC_LIVING: Final = "ac_living"
CONF_AC_BEDROOM: Final = "ac_bedroom"
CONF_QUIET_LIVING: Final = "quiet_living"
CONF_QUIET_BEDROOM: Final = "quiet_bedroom"
# Coexistence with the existing heating setup
CONF_THERMOSTAT: Final = "thermostat"
CONF_OVERPOWER_AUTOMATION: Final = "overpower_automation"
CONF_DISABLE_OVERPOWER_AUTOMATION: Final = "disable_overpower_automation"

OPTIONAL_KEYS: Final = frozenset({CONF_QUIET_LIVING, CONF_QUIET_BEDROOM, CONF_OVERPOWER_AUTOMATION})
