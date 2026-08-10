from __future__ import annotations

import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
CI = ROOT / "scripts" / "ci"
if str(CI) not in sys.path:
    sys.path.insert(0, str(CI))

