#!/usr/bin/env python3
"""Turn PDFKit's positioned text lines into recipe records for the website."""

import json
import re
import sys
import unicodedata
from collections import Counter
from pathlib import Path


SECTIONS = {
    "APPETIZERS": ("appetizers", "Appetizers", ""),
    "BACKPACKING MEALS & DUTCH OVEN TIPS": ("backpacking", "Backpacking & Dutch oven", ""),
    "BELGIAN RECIPES": ("belgian", "Belgian recipes", ""),
    "BREADS": ("breads", "Breads", ""),
    "QUICK BREADS": ("breads", "Breads", "Quick breads"),
    "YEAST BREADS & ROLLS": ("breads", "Breads", "Yeast breads & rolls"),
    "BREAKFAST": ("breakfast", "Breakfast", ""),
    "CRAFTS & CONCOCTIONS": ("exclude", "", ""),
    "KITCHEN SCIENCE": ("exclude", "", ""),
    "CLEANING RECIPES": ("exclude", "", ""),
    "DECORATIONS": ("exclude", "", ""),
    "PAINTS & PLAY DOUGH": ("exclude", "", ""),
    "DESSERTS": ("desserts", "Desserts", ""),
    "BROWNIES & COOKIES": ("desserts", "Desserts", "Brownies & cookies"),
    "CAKES & FROSTINGS": ("desserts", "Desserts", "Cakes & frostings"),
    "PIES, PASTRIES & SWEETBREADS": ("desserts", "Desserts", "Pies & pastries"),
    "HOLIDAY TREATS & IDEAS": ("desserts", "Desserts", "Holiday treats"),
    "ICE CREAM": ("desserts", "Desserts", "Ice cream"),
    "OTHER DESSERTS": ("desserts", "Desserts", "Other desserts"),
    "DRINKS": ("drinks", "Drinks", ""),
    "SMOOTHIES, SLUSHES, MILKSHAKES, & ICES": ("drinks", "Drinks", "Smoothies & slushes"),
    "SODAS, PUNCHES, & WARM DRINKS": ("drinks", "Drinks", "Punches & warm drinks"),
    "ENTREES": ("entrees", "Entrées", ""),
    "ALL-INCLUSIVE MEALS": ("entrees", "Entrées", "All-inclusive meals"),
    "MEAT DISHES": ("entrees", "Entrées", "Meat dishes"),
    "SANDWICHES & WRAPS": ("entrees", "Entrées", "Sandwiches & wraps"),
    "SEASONING MIXES": ("entrees", "Entrées", "Seasonings"),
    "SALADS": ("salads", "Salads", ""),
    "GREEN SALADS": ("salads", "Salads", "Green salads"),
    "PASTA SALADS": ("salads", "Salads", "Pasta salads"),
    "OTHER SALADS": ("salads", "Salads", "Other salads"),
    "SAUCES & DIPS": ("sauces", "Sauces & dips", ""),
    "SIDE DISHES": ("sides", "Side dishes", ""),
    "SOUPS & STEWS": ("soups", "Soups & stews", ""),
    "BEAN SOUPS": ("soups", "Soups & stews", "Bean soups"),
    "HEARTY SOUPS": ("soups", "Soups & stews", "Hearty soups"),
    "USEFUL COOKING INFORMATION": ("exclude", "", ""),
    "NUTRITION INFORMATION/SUGGESTIONS": ("exclude", "", ""),
    "INGREDIENT SUBSTITUTIONS": ("exclude", "", ""),
}

INGREDIENT_START = re.compile(
    r"^(?:\d|[¼½¾⅓⅔⅛⅜⅝⅞]|pinch\b|dash\b|a few\b|one\b|two\b|three\b)", re.I
)
META_START = re.compile(r"^(?:serves?\b|makes?\b|yield\b|takes?\b|total prep\b|prep time\b|cook time\b)", re.I)
STEP_START = re.compile(
    r"^(?:\d+[.)]|preheat\b|combine\b|mix\b|bake\b|cook\b|place\b|heat\b|stir\b|add\b|remove\b|put\b|prepare\b|pour\b|use\b|whisk\b|melt\b|transfer\b|brush\b|fold\b|serve\b|chop\b|slice\b|season\b|refrigerate\b|in a (?:large|medium|small|separate|saucepan|bowl|pot|skillet|blender|food processor)\b|when ready\b|to make\b)",
    re.I,
)
NON_RECIPE_TITLES = {
    "Dutch oven sizes/capacities",
    "Degrees F Top Bottom Top Bottom Top Bottom Top Bottom Top Bottom",
    "Les Recettes (recipes that Fabienne made and described to me verbally)",
    "Recipes from “Everybody Eats Well in Belgium” cookbook by Ruth Van Waerebeek",
    "Other:",
    "Topping",
    "Topping:",
    "Filling",
    "Dough",
    "Bread",
    "Batter 1:",
    "Batter 2:",
    "Churros",
    "Meatballs",
    "Soup",
    "Instructions",
    "Directions",
    "For Dough:",
    "Supplies",
    "Sauce",
    "Garlic Butter",
    "Glaze",
    "Frosting",
    "Cake",
    "Chocolate Cake",
    "Biga",
    "Soaker",
    "Streusel Topping",
    "Cookie Base",
    "Caramel Layer",
    "Topping",
    "Muffins",
    "French Toast",
    "French Toast:",
    "Tzatziki Sauce",
    "Green sauce",
    "Beans",
    "BEANS",
    "SOFRITO",
    "FINISHING THE SOUP",
    "Ingredients",
    "Fruit Smoothie",
    "Fruit Smoothie (",
    "Chicken",
    "Vegetables",
    "Butter and flour, for the pan",
    "Meatball mixture",
    "Smoothie Recipes",
    "Smoothie recipes (from Eleanor’s ward Enrichment meeting)",
    "Seasoning a Dutch Oven",
    "Next morning:",
    "for serving",
    "Storage Ingredients",
    "Salad",
    "How to Cook Wheat Berries",
    "Smoothie Recipes (from “1,000 Easy Recipes”)",
    "Vegetable Roasting 101 (from Good Housekeeping, March 2010, p. 203)",
    "MELANGEZ BIEN ET PUIS AJUTEZ",
    "COUPÉ EN PETIT MORCEAU ET MÉLANGE AVEC",
}
NON_RECIPE_PREFIXES = (
    "Number of briquettes",
    "opt:",
    "Cream cheese flavor Type of crumbs",
    "Honey nut Graham cracker",
    "Regular Oreo Cherry pie",
    "Pineapple Graham cracker",
    "Strawberry Oreo",
    "English muffins",
    "white corn meal cold water",
    "frozen fruit (",
    "Asparagus - 2 lbs",
    "Beets - 2 lbs",
    "Brussels Sprouts - 2 lbs",
    "Carrots - 2 lbs",
    "Cauliflower -",
    "Green beans - 2 lbs",
    "Potatoes - 2 lbs",
    "Sweet potatoes - 2 lbs",
    "Zucchini - 2 lbs",
    "get soggy)",
    "Butter surface of rolls right out of oven",
    "Salt and freshly ground black pepper",
    "Salt and pepper",
    "Optional:",
)
FORCED_TITLES = {
    (11, "Les Biscuits avec chocolat en morceaux"),
    (11, "Quiche"),
}
BELGIAN_SHORT = [
    ("White Fish and Veggie Sauce", "Boil fish; cook carrots, celery, onions, and other vegetables with cream and butter added to the vegetable juice. Serve with rice."),
    ("Tomates aux crevettes/thon", "Hollow out a tomato and fill it with shrimp, hard-boiled egg, or tuna mixed with mayonnaise. Serve with lettuce."),
    ("Tomato soup", "Cook tomatoes, potatoes, and onions."),
    ("Les oeufs soldat", "Soft-boiled eggs served with bread."),
    ("Pasta with pesto and mozzarella", "Pasta with pesto, mozzarella cheese, and cream."),
    ("Pain de veau (meatloaf)", "Veal, onions, eggs, and bread."),
    ("Zucchini filled with meatloaf", "Prepare a zucchini whole, cut it in half, and remove the seeds. Fill with meatloaf and bake. The source suggests rice with tomato sauce as a side."),
    ("Zucchini and onion soup", "1 zucchini, 2 onions, salt, pepper, 1 liter water, and cream cheese (as noted in the source)."),
    ("Pasta with tomato, onion, and basil sauce", "Pasta with a sauce of onions, tomatoes, basil leaves, and cheese."),
    ("Ivi’s Waterzooi", "A soup with chicken, carrots, and potatoes."),
]


def is_title(row, page_rows, index):
    original = row["text"].strip()
    title = re.sub(r"^\*+\s*", "", original).strip()
    if title in NON_RECIPE_TITLES or len(title) < 3 or len(title) > 115:
        return False
    if title.lower().startswith(tuple(prefix.lower() for prefix in NON_RECIPE_PREFIXES)):
        return False
    if title.endswith((".", ",", ":", ";")) or len(title.split()) > 19:
        return False
    if re.match(r"^(?:\d|[¼½¾⅓⅔⅛⅜⅝⅞]|serves?\b|makes?\b|yield\b|takes?\b|from\s)", title, re.I):
        return False
    if re.match(r"^(?:fold|add|place|turn|stir|combine|bake|cook|melt|heat|mix|pour|let|cool|brush|preheat|whisk|transfer|spread|serve|use|remove|set|cut|chop|season|refrigerate|drizzle|sprinkle|top)\b", title, re.I):
        return False
    if re.search(r"\b(?:read more:|http://|https://|until|stirring|should|cook for|remove from|place in)\b", title, re.I):
        return False

    y = row["y"]
    same_column = [item for item in page_rows if (item["x"] >= 200) == (row["x"] >= 200)]
    column_index = next(i for i, item in enumerate(same_column) if item is row)
    column_rows = sorted(same_column, key=lambda item: -item["y"])
    column_index = next(i for i, item in enumerate(column_rows) if item is row)
    previous = column_rows[column_index - 1] if column_index else None
    previous_gap = previous["y"] - y if previous else 999
    first_in_column = previous is None
    if previous_gap < 20 and not first_in_column:
        return False

    # Two-column pages commonly put the recipe title on the same baseline as
    # a recipe in the other column, with no extra gap before its ingredients.
    # Check the candidate's own column, which is more reliable than PDF order.
    previous_y = y
    saw_material = False
    for following in column_rows[column_index + 1 : column_index + 9]:
        text = following["text"].strip()
        if text.upper() in SECTIONS or re.fullmatch(r"\d{1,3}", text):
            continue
        gap = previous_y - following["y"]
        previous_y = following["y"]
        if gap > 32:
            break
        if META_START.match(text):
            continue
        if INGREDIENT_START.match(text) or re.match(r"^(?:salt|pepper|butter|oil|water|milk|flour|sugar|eggs?)\b", text, re.I):
            saw_material = True
            break
        if STEP_START.match(text) or len(text) > 90:
            break
        # A brief descriptor may appear between the title and ingredients.
        continue
    return saw_material and (previous_gap >= 20 or first_in_column)


def slugify(value):
    normalized = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-z0-9]+", "-", normalized.lower()).strip("-")
    return slug or "recipe"


def classify_line(text):
    if META_START.match(text):
        return "meta"
    if text.endswith(":") and len(text) < 70:
        return "label"
    if STEP_START.match(text) or (len(text) > 100 and re.search(r"\b(?:until|minutes?|degrees?|stir|cook|bake|serve)\b", text, re.I)):
        return "step"
    if INGREDIENT_START.match(text):
        return "ingredient"
    if len(text) < 95 and not text.endswith((".", "!", "?")):
        return "ingredient"
    return "note"


def recipe_blocks(lines):
    blocks = []
    for raw in lines:
        text = raw.strip()
        if not text or META_START.match(text):
            continue
        kind = classify_line(text)
        # Rejoin wrapped instruction and ingredient lines instead of rendering
        # each visual PDF line as an unrelated list item.
        if kind in ("step", "ingredient", "note") and text[:1].islower() and blocks and blocks[-1]["type"] == kind:
            blocks[-1]["text"] += " " + text
        elif blocks and kind == "step" and blocks[-1]["type"] == "step" and not re.match(r"^\d+[.)]", text):
            blocks[-1]["text"] += " " + text
        else:
            blocks.append({"type": kind, "text": text})
    return blocks


def main():
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python3 scripts/build_recipe_data.py extracted-lines.json")
    source = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    by_page = {}
    for row in source:
        by_page.setdefault(row["page"], []).append(row)

    active_section = ("exclude", "", "")
    pages = {}
    for page_number in sorted(by_page):
        page_rows = by_page[page_number]
        pages[page_number] = page_rows
        for row in page_rows:
            heading = row["text"].strip().upper()
            if heading in SECTIONS:
                active_section = SECTIONS[heading]
            row["section"] = active_section

    candidates = []
    for page_number, page_rows in pages.items():
        if page_number < 3 or page_number > 271:
            continue
        for index, row in enumerate(page_rows):
            section = row.get("section", ("exclude", "", ""))
            if section[0] == "exclude":
                continue
            text = row["text"].strip()
            if text.upper() in SECTIONS or re.fullmatch(r"\d{1,3}", text):
                continue
            if is_title(row, page_rows, index) or (page_number, row["text"].strip().lstrip("* ")) in FORCED_TITLES:
                candidates.append({
                    "title": re.sub(r"^\*+\s*", "", text).strip(),
                    "page": page_number,
                    "index": index,
                    "category": section[0],
                    "categoryName": section[1],
                    "subcategory": section[2],
                })

    # A wrapped or unmeasured first ingredient can look like a heading because
    # it follows the preceding title's blank line. When two candidate lines
    # sit close together in the same column, keep the earlier title and treat
    # the later one as its first ingredient line.
    pruned = []
    for candidate in candidates:
        row = pages[candidate["page"]][candidate["index"]]
        prior_heading = next((
            other for other in reversed(pruned)
            if other["page"] == candidate["page"]
            and (pages[other["page"]][other["index"]]["x"] >= 200) == (row["x"] >= 200)
            and pages[other["page"]][other["index"]]["y"] > row["y"]
        ), None)
        if prior_heading:
            prior_row = pages[prior_heading["page"]][prior_heading["index"]]
            distance = prior_row["y"] - row["y"]
            if distance < 60 and not INGREDIENT_START.match(row["text"].strip()):
                continue
        pruned.append(candidate)
    candidates = pruned

    # In a few entries, a title continues into a second column on the same
    # baseline. Join that continuation instead of treating it as another dish.
    for candidate in candidates:
        row = pages[candidate["page"]][candidate["index"]]
        if not candidate["title"].rstrip().endswith(("-", "(")):
            continue
        continuation = next((
            other for other in candidates
            if other is not candidate
            and other["page"] == candidate["page"]
            and abs(pages[other["page"]][other["index"]]["y"] - row["y"]) < 2
            and pages[other["page"]][other["index"]]["x"] != row["x"]
            and pages[other["page"]][other["index"]]["text"].lstrip().startswith(("“", "\"", "'"))
        ), None)
        if continuation:
            continuation_row = pages[continuation["page"]][continuation["index"]]
            candidate["title"] = candidate["title"].rstrip("- (") + " " + continuation_row["text"].strip()
            candidate["skipRows"] = [(continuation["page"], continuation["index"])]
            candidates.remove(continuation)
            break

    # The introductory Belgian section has ten brief family recipes in a
    # numbered list, rather than the collection's usual title/ingredient format.
    belgian_rows = pages.get(10, [])
    for number, (title, summary) in enumerate(BELGIAN_SHORT, start=1):
        row_index = next((i for i, row in enumerate(belgian_rows) if re.match(r"^" + str(number) + r"\.\s", row["text"].strip())), None)
        if row_index is not None:
            candidates.append({
                "title": title,
                "page": 10,
                "index": row_index,
                "category": "belgian",
                "categoryName": "Belgian recipes",
                "subcategory": "Les Recettes",
                "summary": summary,
            })
    candidates.sort(key=lambda item: (item["page"], item["index"]))

    recipes = []
    for candidate_index, candidate in enumerate(candidates):
        page_rows = pages[candidate["page"]]
        start = candidate["index"] + 1
        if candidate_index + 1 < len(candidates):
            following = candidates[candidate_index + 1]
            end_page = following["page"]
            end_index = following["index"]
        else:
            end_page = max(pages)
            end_index = len(pages[end_page])

        lines = []
        stop_recipe = False
        for page_number in range(candidate["page"], end_page + 1):
            rows = pages[page_number]
            first = start if page_number == candidate["page"] else 0
            last = end_index if page_number == end_page else len(rows)
            for row in rows[first:last]:
                text = row["text"].strip()
                row_index = rows.index(row)
                if (page_number, row_index) in candidate.get("skipRows", []):
                    continue
                if not text or text.upper() in SECTIONS or re.fullmatch(r"\d{1,3}", text):
                    continue
                if row.get("section", ("exclude",))[0] == "exclude":
                    continue
                if candidate["category"] == "backpacking" and text.lower() in {
                    "seasoning a dutch oven", "helpful dutch oven equipment", "dutch oven sizes/capacities"
                }:
                    stop_recipe = True
                    break
                lines.append(text)
            if stop_recipe:
                break

        if candidate.get("summary") and not lines:
            lines = [candidate["summary"]]

        if len("\n".join(lines)) < 50:
            title_row = pages[candidate["page"]][candidate["index"]]
            lower_titles = [
                pages[item["page"]][item["index"]]["y"]
                for item in candidates
                if item is not candidate and item["page"] == candidate["page"]
                and pages[item["page"]][item["index"]]["y"] < title_row["y"] - 45
            ]
            lower_bound = max(lower_titles) if lower_titles else 0
            same_column_only = title_row["x"] >= 200
            visual_lines = []
            for row in pages[candidate["page"]]:
                text = row["text"].strip()
                if not text or not (lower_bound < row["y"] < title_row["y"]):
                    continue
                if same_column_only and row["x"] < 200:
                    continue
                if row.get("section", ("exclude",))[0] == "exclude" or text.upper() in SECTIONS:
                    continue
                if re.fullmatch(r"\d{1,3}", text):
                    continue
                visual_lines.append(row)
            if visual_lines:
                lines = [row["text"].strip() for row in sorted(visual_lines, key=lambda item: -item["y"]) if row is not title_row]

        # Avoid absorbing unrelated pages if the next title is far away.
        # Recipe page ranges are normally contiguous; the source-page number
        # remains available for readers who need to compare the original.
        recipe = dict(candidate)
        recipe["sourcePage"] = candidate["page"]
        recipe["sourceEndPage"] = end_page
        recipe["blocks"] = recipe_blocks(lines)
        recipe["sourceText"] = "\n".join(lines)
        recipe.pop("summary", None)
        recipes.append(recipe)

    recipes.sort(key=lambda recipe: (recipe["sourcePage"], recipe["title"].lower()))
    counts = {}
    for recipe in recipes:
        base = slugify(recipe["title"])
        counts[base] = counts.get(base, 0) + 1
        recipe["id"] = base if counts[base] == 1 else base + "-" + str(counts[base])
        recipe.pop("page", None)
        recipe.pop("index", None)

    output = Path("public/recipes.json")
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(recipes, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    totals = Counter(recipe["categoryName"] for recipe in recipes)
    print("Wrote", len(recipes), "recipes to", output)
    for category, count in totals.items():
        print(" ", category + ":", count)


if __name__ == "__main__":
    main()
