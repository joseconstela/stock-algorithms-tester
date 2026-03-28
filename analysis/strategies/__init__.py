"""
Strategy auto-discovery and registry.

On import, this package scans its own directory for Python files (excluding
``__init__.py`` and files starting with ``_``).  Each file is expected to
export:

- ``STRATEGY``: a dict with at least ``name`` (str) and ``description`` (str).
- ``analyze``: a callable ``(pd.DataFrame) -> dict | None``.

Discovered strategies are registered in ``STRATEGY_REGISTRY`` which maps
strategy name -> analyze function, and ``STRATEGY_META`` which maps
strategy name -> metadata dict.
"""

from __future__ import annotations

import importlib
import logging
from pathlib import Path
from typing import Any, Callable

import pandas as pd

logger = logging.getLogger(__name__)

# Type alias for a strategy function
StrategyFn = Callable[[pd.DataFrame], dict[str, Any] | None]

# Registry: strategy name -> analyze function
STRATEGY_REGISTRY: dict[str, StrategyFn] = {}

# Metadata: strategy name -> { name, description, path }
STRATEGY_META: dict[str, dict[str, Any]] = {}


def _discover_strategies() -> None:
    """Scan the strategies directory and import all strategy modules."""
    pkg_dir = Path(__file__).resolve().parent

    for filepath in sorted(pkg_dir.glob("*.py")):
        # Skip __init__.py and private modules (e.g. _helpers.py)
        if filepath.name.startswith("_"):
            continue

        module_name = filepath.stem
        fqn = f"strategies.{module_name}"

        try:
            mod = importlib.import_module(fqn)
        except Exception:
            logger.exception("Failed to import strategy module '%s'", fqn)
            continue

        # Validate exports
        strategy_meta = getattr(mod, "STRATEGY", None)
        analyze_fn = getattr(mod, "analyze", None)

        if strategy_meta is None or not isinstance(strategy_meta, dict):
            logger.warning(
                "Strategy module '%s' missing STRATEGY dict -- skipping", fqn
            )
            continue

        if analyze_fn is None or not callable(analyze_fn):
            logger.warning(
                "Strategy module '%s' missing analyze() function -- skipping", fqn
            )
            continue

        name = strategy_meta.get("name")
        if not name:
            logger.warning(
                "Strategy module '%s' has STRATEGY dict without 'name' -- skipping", fqn
            )
            continue

        # Register
        STRATEGY_REGISTRY[name] = analyze_fn
        STRATEGY_META[name] = {
            "name": name,
            "description": strategy_meta.get("description", ""),
            "path": str(filepath),
            "parameters": strategy_meta.get("parameters", []),
        }
        logger.info("Registered strategy: %s (%s)", name, filepath.name)


def get_strategy(name: str) -> StrategyFn | None:
    """Look up a strategy function by name."""
    return STRATEGY_REGISTRY.get(name)


def get_all_strategy_names() -> list[str]:
    """Return a sorted list of all registered strategy names."""
    return sorted(STRATEGY_REGISTRY.keys())


# Auto-discover on import
_discover_strategies()
