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


TITLE_COLUMNS = (21.6, 323.8)


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
    # Titles start at the left margin, or at the middle of the page on the
    # two-column smoothie pages. Other positions are ingredient columns
    # (x≈223, x≈425), wrapped lines indented under them (x≈241, x≈443), or
    # sub-headings such as "For Filling" inside a recipe.
    if not any(abs(row["x"] - start) <= 5 for start in TITLE_COLUMNS):
        return False
    # Ingredient fragments and wrapped lines: "kosher salt", "(granny smith
    # is best)", "zest of 1 orange". Lowercase titles are real only when they
    # credit a source ("crispy fried chickpeas (from Maria Rodale's Scratch)").
    if title[:1] in "(-–—&" or (title.startswith("[") and title.endswith("]")):
        return False
    if title[:1].islower() and "from" not in title.lower():
        return False
    if title.endswith(")") and "(" not in title:
        return False
    if re.match(r"^(?:pinch|dash|juice of|zest of|for (?:the )?(?:filling|frosting|dough|topping|sauce|glaze|crust)\b)", title, re.I):
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


SOURCE_CREDIT = re.compile(r"^(.*?)\s*\(\s*from\s+([^()]*)\)\s*(.*)$", re.I)


def split_source(title):
    """Move a "(from ...)" credit out of a title into its own field. Any note
    after the credit stays in the title: "Cake (from blendtec.com) - DIVINE"
    becomes ("Cake - DIVINE", "blendtec.com"). Mirrors the SQL in
    install/supabase/migrations/20261127000000_recipe_source.sql."""
    match = SOURCE_CREDIT.match(title)
    if not match or not match.group(1).strip():
        return title, ""
    before, source, after = (part.strip() for part in match.groups())
    return " ".join(part for part in (before, after) if part), source


def slugify(value):
    normalized = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-z0-9]+", "-", normalized.lower()).strip("-")
    return slug or "recipe"


NOTE_START = re.compile(
    r"^(?:\*|notes?\b|tips?\b|hint\b|variations?\b|options?\b|optional\b|source\b|from\b|recipe from\b|adapted\b|this (?:recipe|is)\b|these (?:are|freeze)\b)",
    re.I,
)
# Authored step numbers are small; "350. Butter the pan" continues "Preheat oven to".
NUMBERED_STEP = re.compile(r"^(?:[1-9]|[1-3]\d)[.)]\s")
SENTENCE_END = (".", "!", "?")
# Words that end in a period without ending a sentence.
ABBREVIATIONS = {
    "approx", "c", "doz", "dr", "e.g", "etc", "ea", "env", "gal", "hr", "hrs", "i.e", "lb", "lbs", "med",
    "min", "mins", "mr", "mrs", "no", "oz", "pkg", "pkgs", "pt", "qt", "sm", "lg", "st", "t", "tbsp", "tbs",
    "tsp", "vs", "deg", "temp",
}
# Sentences shorter than this stay with the sentence before them ("Drain and peel.").
SHORT_SENTENCE = 30


def classify_line(text):
    if META_START.match(text) and len(text) < 60:
        return "meta"
    if text.endswith(":") and len(text) < 70:
        return "label"
    if INGREDIENT_START.match(text) and not NUMBERED_STEP.match(text) and (len(text) < 95 or not text.endswith(".")):
        return "ingredient"
    if len(text) < 60 and not text.endswith(SENTENCE_END) and not STEP_START.match(text):
        return "ingredient"
    return "prose"


def is_prose_line(text):
    """True for a PDF line that is part of a paragraph rather than a list item."""
    return len(text) >= 60 or STEP_START.match(text) is not None or text.endswith(SENTENCE_END)


def join_wrapped_lines(lines):
    """Rejoin the visual PDF lines that make up one ingredient or paragraph."""
    joined = []
    for raw in lines:
        text = raw.strip()
        if not text:
            continue
        if joined:
            previous = joined[-1]
            # A line that is only a parenthetical, like "(granny smith is best)",
            # or one left open, finishes the item above; "(optional) fresh sage" starts a new one.
            continues_word = (
                text[:1].islower() or text[:1] in ",;)&"
                or re.fullmatch(r"\([^()]*(?:\)\.?)?", text) is not None
                # "Mills)" closes "(Bob's Red Mill or Arrowhead" on the line above.
                or (text.count(")") > text.count("(") and previous.count("(") > previous.count(")"))
            )
            in_ingredient = INGREDIENT_START.match(previous) and not NUMBERED_STEP.match(previous)
            open_paragraph = (is_prose_line(previous) and not in_ingredient
                              and not previous.endswith(SENTENCE_END + (":",)))
            starts_new_item = NUMBERED_STEP.match(text) or META_START.match(text) or (
                INGREDIENT_START.match(text) and not is_prose_line(text)
            )
            if (continues_word or open_paragraph) and not starts_new_item:
                joined[-1] = previous.rstrip("-") + ("" if previous.endswith("-") else " ") + text
                continue
        joined.append(text)
    return joined


def split_sentences(text):
    """Split a paragraph into sentences, skipping abbreviations and decimals."""
    sentences, start = [], 0
    for match in re.finditer(r"[.!?][\"”')]*\s+(?=[A-Z0-9“\"(])", text):
        before = text[start:match.start()].split()
        word = before[-1].lower().rstrip(".") if before else ""
        if match.group()[0] == "." and (word in ABBREVIATIONS or len(word) == 1):
            continue
        sentences.append(text[start:match.end()].strip())
        start = match.end()
    sentences.append(text[start:].strip())
    return [sentence for sentence in sentences if sentence]


def split_steps(text):
    """Turn a direction paragraph into steps of one or more whole sentences."""
    if NUMBERED_STEP.match(text):
        # Keep authored numbering; split "1. Mix. 2. Bake." run together on one
        # line, but only at the next number, so "Preheat oven to 350. Butter" stays.
        parts, start = [], 0
        expected = int(re.match(r"\d+", text).group()) + 1
        for match in re.finditer(r"\s+(\d+)[.)](?=\s)", text):
            if int(match.group(1)) == expected:
                parts.append(text[start:match.start()].strip())
                start = match.start()
                expected += 1
        parts.append(text[start:].strip())
        return [part for part in parts if part]
    steps = []
    for sentence in split_sentences(text):
        if steps and (len(sentence) < SHORT_SENTENCE or len(steps[-1]) < SHORT_SENTENCE):
            steps[-1] += " " + sentence
        else:
            steps.append(sentence)
    return steps


SECTION_WORDS = re.compile(
    r"\b(?:toppings?|fillings?|frosting|icing|glaze|dough|sauce|crust|cake|cupcakes|brownies?|base|layer|batter|"
    r"biga|soaker|streusel|marinade|garnish|decorations|dressing|vinaigrette|dumplings|meatballs|soup|salad|wraps?|"
    r"raita|bread|muffins|coffeecake|churros|french toast|chicken|rice|beans|sofrito|cheese|eggs|ingredients|"
    r"ganache|spread|butter|sauce|tzatziki|mix|ramen|add-ins|assembly|finishing)\b",
    re.I,
)
FOOD_START = re.compile(r"^(?:salt|pepper|kosher|black pepper|sugar|water|oil|olive oil|vanilla)\b", re.I)


def is_heading(text, following):
    """A sub-heading such as "Cookie Base" or "FILLING" that starts a group of
    ingredients or steps, as opposed to an ingredient with no quantity."""
    words = text.rstrip(":").split()
    if not 1 <= len(words) <= 6 or len(text) > 45 or re.search(r"\d|[¼½¾⅓⅔⅛]|,", text):
        return False
    if FOOD_START.match(text) or not following:
        return False
    if not (INGREDIENT_START.match(following) or NUMBERED_STEP.match(following) or len(following) > 60):
        return False
    minor = {"and", "of", "with", "for", "the", "&", "or", "a", "in", "-"}
    title_case = words[0][:1].isupper() and all(w[:1].isupper() or w.lower() in minor for w in words)
    if not title_case:
        return False
    # A single word is a heading only when it names a part of a recipe ("Filling"),
    # so lone ingredients such as "Bacon" or "Toothpicks" stay ingredients.
    return len(words) > 1 or text.isupper() or SECTION_WORDS.search(text) is not None


QUANTITY = r"(?:\d+(?:\s*[-/]\s*\d+)?(?:\s*[¼½¾⅓⅔⅛⅜⅝⅞])?(?:-\d+)?|[¼½¾⅓⅔⅛⅜⅝⅞]|one|two|three|four)"
UNIT_ONLY = r"(?:c|t|T|cups?|tsp|tbsp|oz|lbs?|g|ml|qt)\.?"
NOT_A_NEW_ITEM = {
    "or", "and", "plus", "with", "about", "to", "each", "per", "into", "of", "in", "by", "than", "x", "makes",
    "make", "add", "use", "using", "substitute", "substituted", "for", "scant", "heaping", "generous", "approx",
    "approximately", "additional", "another", "yields", "serves",
}
TIME_UNIT = re.compile(r"^\s*(?:minutes?|mins?|hours?|hrs?|degrees?|seconds?|inch|inches|in\b)", re.I)


def split_ingredients(text):
    """Split "1 c whipping cream 2 T sugar ½ t vanilla", where the PDF put
    several ingredients on one line, into one ingredient each."""
    if "*" in text:
        return [text]
    parts, start, depth = [], 0, 0
    for match in re.finditer(r"[()]|(?<=[A-Za-z\)\.])\s+(?=" + QUANTITY + r"\s+[A-Za-z])", text, re.I):
        token = match.group()
        if token == "(":
            depth += 1
            continue
        if token == ")":
            depth = max(0, depth - 1)
            continue
        if depth:
            continue
        before = text[start:match.start()].strip()
        after = text[match.end():]
        previous_word = before.split()[-1].lower().strip(".,") if before.split() else ""
        # "2 c 4 c warm water" lists two batch sizes, not two ingredients.
        quantity_only = re.fullmatch(QUANTITY + r"\s*(?:" + UNIT_ONLY + r")?", before, re.I)
        unit_after = re.match(QUANTITY + r"\s+(\S+)", after, re.I)
        if previous_word in NOT_A_NEW_ITEM or quantity_only or not re.search(r"[A-Za-z]{2}", before):
            continue
        if unit_after and TIME_UNIT.match(unit_after.group(1)):
            continue
        parts.append(before)
        start = match.end()
    parts.append(text[start:].strip())
    return [part for part in parts if part]


def recipe_blocks(lines):
    blocks = []
    seen_ingredient = False
    joined = join_wrapped_lines(lines)
    for index, text in enumerate(joined):
        following = joined[index + 1] if index + 1 < len(joined) else ""
        kind = classify_line(text)
        if kind == "ingredient" and is_heading(text, following):
            kind = "label"
        if kind == "ingredient":
            seen_ingredient = True
            blocks.extend({"type": "ingredient", "text": part} for part in split_ingredients(text))
        elif kind != "prose":
            blocks.append({"type": kind, "text": text})
        elif NOTE_START.match(text) or not seen_ingredient:
            # Introductions before the ingredients, and marked notes, stay whole.
            blocks.append({"type": "note", "text": text})
        elif blocks and blocks[-1]["type"] == "step" and NUMBERED_STEP.match(blocks[-1]["text"]) and not NUMBERED_STEP.match(text):
            # An unnumbered paragraph after "3. ..." finishes that numbered step.
            blocks[-1]["text"] += " " + text
        else:
            blocks.extend({"type": "step", "text": step} for step in split_steps(text))
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
        page_rows = pages[candidate["page"]]
        continuation_index = next((
            i for i, other in enumerate(page_rows)
            if other is not row
            and abs(other["y"] - row["y"]) < 2
            and other["x"] != row["x"]
            and other["text"].lstrip().startswith(("“", "\"", "'"))
        ), None)
        if continuation_index is not None:
            candidate["title"] = candidate["title"].rstrip("- (") + " " + page_rows[continuation_index]["text"].strip()
            candidate["skipRows"] = [(candidate["page"], continuation_index)]
            candidates[:] = [
                other for other in candidates
                if (other["page"], other["index"]) != (candidate["page"], continuation_index)
            ]
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
        # IDs come from the full title above so links stay stable; the credit
        # moves to its own field afterwards.
        recipe["title"], recipe["source"] = split_source(recipe["title"])
        recipe.pop("page", None)
        recipe.pop("index", None)

    output = Path("data/recipes.json")
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(recipes, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    totals = Counter(recipe["categoryName"] for recipe in recipes)
    print("Wrote", len(recipes), "recipes to", output)
    for category, count in totals.items():
        print(" ", category + ":", count)


if __name__ == "__main__":
    main()
