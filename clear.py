"""Remove exactly one owned toast after its one-shot local receipt was checked."""
import json
import sys
from activate import acknowledge
acknowledge(json.load(sys.stdin)["tag"])
print("acknowledged")
