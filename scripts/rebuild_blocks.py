#!/usr/bin/env python3
"""Rebuild every recipe's blocks in data/recipes.json from its sourceText.

Use this after changing the block rules in build_recipe_data.py when the PDF
extraction itself (titles, boundaries, source text) doesn't need to change.

usage: python3 scripts/rebuild_blocks.py [data/recipes.json]
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_recipe_data import recipe_blocks  # noqa: E402


def main():
    path = Path(sys.argv[1] if len(sys.argv) > 1 else "data/recipes.json")
    recipes = json.loads(path.read_text(encoding="utf-8"))
    changed = 0
    for recipe in recipes:
        blocks = recipe_blocks(recipe["sourceText"].split("\n"))
        if blocks != recipe["blocks"]:
            recipe["blocks"] = blocks
            changed += 1
    path.write_text(json.dumps(recipes, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Rebuilt blocks for {changed} of {len(recipes)} recipes in {path}")


if __name__ == "__main__":
    main()
