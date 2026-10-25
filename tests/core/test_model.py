import pytest

from custom_components.hybrid_heating.core.model import (
    ac_capacity_kw,
    ac_cop,
    heat_demand_kw,
    radiator_output_kw,
)


def test_model_matches_analysis():
    assert heat_demand_kw(150, 300, 23.0, 13.8) == pytest.approx(1.08)
    assert heat_demand_kw(150, 300, 23.0, 25.0) == 0.0
    assert ac_capacity_kw(3.5, 7) == 3.5 and ac_capacity_kw(3.5, 12) == 3.5
    assert ac_capacity_kw(3.5, -15) == pytest.approx(3.5 * 3.0 / 6.2)
    assert ac_capacity_kw(3.5, -15.1) == 0.0
    assert (
        ac_cop(7) == pytest.approx(3.6)
        and ac_cop(-15) == pytest.approx(1.7)
        and ac_cop(20) == pytest.approx(4.2)
    )
    assert radiator_output_kw(50, 23) == pytest.approx(3.25, abs=0.02)
    assert radiator_output_kw(20, 23) == 0.0
