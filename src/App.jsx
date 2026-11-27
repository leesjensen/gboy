import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { RecipeEditor, SignInPage } from './Admin.jsx';
import { ImportPage } from './Import.jsx';
import { OfflineBanner, OfflineHeaderLink, OfflinePage, useOfflineAutoRefresh } from './Offline.jsx';
import { useOfflineMeta, useOnlineStatus } from './offline.js';
import { SearchPage, searchHref } from './Search.jsx';
import { canEditRecipes, fetchCategories, fetchMyRating, fetchRecipe, fetchRecipeSummaries, isConfigured, rateRecipe, rememberSignInReturn, supabase, takeSignInReturn } from './supabase.js';
import { Breadcrumbs, Icon, RatingBadge, StarInput, Stars, formatRating } from './ui.jsx';

const categoryDetails = {
  appetizers: {
    icon: '✳',
    tint: 'coral',
    description: 'A little something to start the table and get everyone gathered around.',
  },
  backpacking: {
    icon: '⌁',
    tint: 'gold',
    description: 'Trail-friendly favorites and camp cooking ideas from the collection.',
  },
  belgian: {
    icon: '✦',
    tint: 'blue',
    description: 'A small collection of Belgian family recipes, from waffles to waterzooi.',
  },
  breads: {
    icon: '⌂',
    tint: 'gold',
    description: 'Warm loaves, quick breads, rolls, muffins, and doughs worth sharing.',
  },
  breakfast: {
    icon: '☀',
    tint: 'sage',
    description: 'Pancakes, oatmeal, brunch bakes, and easy starts to the day.',
  },
  desserts: {
    icon: '♡',
    tint: 'rose',
    description: 'Cookies, cakes, pies, frozen treats, and a little something sweet.',
  },
  drinks: {
    icon: '◌',
    tint: 'blue',
    description: 'Smoothies, coolers, punches, and cozy cups for every season.',
  },
  entrees: {
    icon: '✳',
    tint: 'sage',
    description: 'Comforting mains, weeknight dinners, sandwiches, and wraps.',
  },
  salads: {
    icon: '❋',
    tint: 'sage',
    description: 'Fresh greens, pasta salads, and colorful bowls for the middle of the table.',
  },
  sauces: {
    icon: '◉',
    tint: 'coral',
    description: 'The dips, dressings, sauces, syrups, and spreads that make a meal sing.',
  },
  sides: {
    icon: '✿',
    tint: 'gold',
    description: 'Vegetables, potatoes, grains, and all the good things alongside.',
  },
  soups: {
    icon: '◒',
    tint: 'blue',
    description: 'A comforting pot for a chilly evening, a busy day, or a full table.',
  },
};

const defaultCategoryDetails = { icon: '✦', tint: 'sage', description: '' };

function parseRoute() {
  const segments = window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (segments[0] === 'category' && segments[1]) return { page: 'category', id: segments[1], sort: segments[2] };
  if (segments[0] === 'recipe' && segments[1] && segments[2] === 'edit') return { page: 'edit', id: segments[1] };
  if (segments[0] === 'recipe' && segments[1]) return { page: 'recipe', id: segments[1] };
  if (segments[0] === 'new') return { page: 'new', category: segments[1] };
  if (segments[0] === 'import') return { page: 'import', category: segments[1] };
  if (segments[0] === 'account' || segments[0] === 'admin') return { page: 'account' };
  if (segments[0] === 'offline') return { page: 'offline' };
  if (segments[0] === 'search') {
    try {
      return { page: 'search', query: decodeURIComponent(segments.slice(1).join('/')) };
    } catch {
      return { page: 'search', query: '' };
    }
  }
  return { page: 'home' };
}

function Brand({ onClick }) {
  return (
    <a href="#/" onClick={onClick} className="flex items-center gap-3 text-forest" aria-label="GBoy, the Giant Book of Yum: home">
      <span className="grid size-10 place-items-center rounded-2xl bg-forest text-cream shadow-sm">
        <Icon name="leaf" className="size-5" />
      </span>
      <span className="leading-tight">
        <span className="block font-serif text-[1.05rem] font-semibold tracking-tight">GBoy</span>
        <span className="block text-[0.62rem] font-semibold uppercase tracking-[0.19em] text-forest/60">Giant Book of Yum</span>
      </span>
    </a>
  );
}

function HeaderSearch() {
  const [query, setQuery] = useState('');
  function submit(event) {
    event.preventDefault();
    window.location.hash = searchHref(query);
    setQuery('');
  }
  return (
    <form role="search" onSubmit={submit} className="relative hidden md:block">
      <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-forest/40" />
      <input type="search" aria-label="Search recipes" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search recipes" className="w-44 rounded-full border border-forest/10 bg-white/80 py-2 pl-9 pr-3 text-sm text-forest outline-none transition placeholder:text-forest/40 focus:w-60 focus:border-forest/30 focus:bg-white lg:w-52" />
    </form>
  );
}

function Header({ canEdit, signedIn, page }) {
  return (
    <header className="sticky top-0 z-30 border-b border-forest/8 bg-cream/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3.5 sm:px-8 lg:px-12">
        <Brand />
        <nav className="flex items-center gap-3 sm:gap-7" aria-label="Main navigation">
          {page !== 'search' && <HeaderSearch />}
          <a href="#/search" aria-label="Search recipes" className="grid size-9 place-items-center rounded-full text-forest/70 transition hover:bg-white hover:text-forest md:hidden">
            <Icon name="search" className="size-5" />
          </a>
          <OfflineHeaderLink />
          <a href="#/category/all" className="text-sm font-medium text-forest/70 transition hover:text-forest">
            Browse recipes
          </a>
          {canEdit && (
            <a href="#/new" className="inline-flex items-center gap-1.5 rounded-full bg-forest px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-forest-light">
              <Icon name="plus" className="size-4" /> <span className="hidden sm:inline">Add recipe</span>
            </a>
          )}
          <a href="#/account" onClick={() => rememberSignInReturn()} aria-label={signedIn ? 'Your account' : 'Sign in'} title={signedIn ? 'Your account' : 'Sign in'} className="grid size-9 place-items-center rounded-full text-forest/70 transition hover:bg-white hover:text-forest sm:hidden">
            <Icon name="user" className="size-5" />
          </a>
          <a href="#/account" onClick={() => rememberSignInReturn()} className="hidden text-sm font-medium text-forest/70 transition hover:text-forest sm:inline">
            {signedIn ? (canEdit ? 'Admin' : 'Account') : 'Sign in'}
          </a>
          <a href="#/category/desserts" className={`${canEdit ? 'xl:inline-flex' : 'lg:inline-flex'} hidden rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-forest shadow-sm ring-1 ring-forest/10 transition hover:bg-sage-pale`}>
            Something sweet <Icon name="arrow" className="ml-2 size-4" />
          </a>
        </nav>
      </div>
    </header>
  );
}

function HeroArt() {
  return (
    <div className="relative mx-auto aspect-[1.06/1] w-full max-w-[540px] overflow-hidden rounded-[2.2rem] bg-sage-pale shadow-[0_24px_70px_-32px_rgba(31,59,44,.35)] sm:rounded-[2.7rem]">
      <div className="absolute -right-12 -top-16 size-56 rounded-full bg-gold/40 blur-2xl" />
      <div className="absolute -bottom-24 -left-16 size-64 rounded-full bg-coral/20 blur-3xl" />
      <div className="absolute left-[8%] top-[10%] font-serif text-[0.68rem] font-semibold uppercase tracking-[0.25em] text-forest/55">A collection made to be shared</div>
      <div className="plate-shadow absolute left-1/2 top-[48%] grid aspect-square w-[63%] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-[#fbfaf5] p-[6%]">
        <div className="relative grid size-full place-items-center overflow-hidden rounded-full border border-forest/10 bg-[#e7ebdc]">
          <div className="absolute inset-[8%] rounded-full border-[10px] border-[#faf8ee] shadow-inner sm:border-[14px]" />
          <svg className="relative z-10 size-[72%] -rotate-6" viewBox="0 0 240 240" aria-label="Illustration of a fresh bowl of pasta" role="img">
            <ellipse cx="120" cy="124" rx="94" ry="73" fill="#f5e7bd" />
            <path d="M49 119c8-38 42-62 74-54 36-11 70 14 72 49 5 35-29 63-71 65-42 6-82-19-75-60Z" fill="#e9b85c" />
            <path d="M63 115c14-30 43-46 70-37 30-10 53 11 61 34-7 31-36 48-69 47-29 3-51-14-62-44Z" fill="#f7d981" />
            <path d="M81 101c17 10 37 16 58 10m-64 17c18 12 48 20 75 14m-65 13c19 10 43 12 61 7m-22-65c-9 14-14 25-15 38m45-31c-8 15-12 29-11 45" fill="none" stroke="#d69437" strokeWidth="5" strokeLinecap="round" />
            <circle cx="101" cy="99" r="10" fill="#c84f35" />
            <circle cx="151" cy="124" r="11" fill="#c84f35" />
            <circle cx="121" cy="150" r="9" fill="#c84f35" />
            <path d="M78 125c9-11 21-11 30-1-8 13-20 16-30 1Zm65-33c9-12 22-12 30-2-7 14-19 18-30 2Zm4 55c9-12 21-13 31-3-7 15-20 19-31 3Z" fill="#49795a" />
            <path d="m108 83 8-15m7 18 8-13m11 49 10-13" stroke="#fff9e6" strokeWidth="3" strokeLinecap="round" />
          </svg>
        </div>
      </div>
      <div className="absolute bottom-[8%] left-[7%] rounded-2xl bg-white/95 px-4 py-3 shadow-lg shadow-forest/10 sm:px-5 sm:py-4">
        <div className="mb-1 flex items-center gap-1 text-gold" aria-label="Family favorite">
          <span>✦</span>
          <span>✦</span>
          <span>✦</span>
        </div>
        <p className="font-serif text-base font-semibold text-forest sm:text-lg">Made for the middle of the table</p>
        <p className="mt-1 text-xs text-forest/55">Family favorites, gathered over time</p>
      </div>
      <div className="absolute right-[7%] top-[20%] grid size-12 place-items-center rounded-full bg-coral text-white shadow-md sm:size-14">
        <Icon name="spark" className="size-6" />
      </div>
    </div>
  );
}

// Highest average first; more ratings break ties, then title.
function byRating(a, b) {
  return (b.ratingAverage ?? -1) - (a.ratingAverage ?? -1) || (b.ratingCount || 0) - (a.ratingCount || 0) || a.title.localeCompare(b.title);
}

const sortOptions = [
  { id: 'title', label: 'A–Z', compare: (a, b) => a.title.localeCompare(b.title) },
  { id: 'top-rated', label: 'Highest rated', compare: byRating },
  { id: 'most-rated', label: 'Most rated', compare: (a, b) => (b.ratingCount || 0) - (a.ratingCount || 0) || byRating(a, b) },
];

function categoryRecipes(categories, recipes) {
  return categories.map((category) => {
    const matching = recipes.filter((recipe) => recipe.category === category.id);
    return { ...defaultCategoryDetails, ...categoryDetails[category.id], ...category, count: matching.length, recipes: matching };
  });
}

function SectionHeading({ eyebrow, title, description, action }) {
  return (
    <div className="mb-7 flex flex-col gap-4 sm:mb-9 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <p className="mb-2 text-[0.68rem] font-bold uppercase tracking-[0.22em] text-coral">{eyebrow}</p>}
        <h2 className="font-serif text-3xl font-semibold tracking-tight text-forest sm:text-4xl">{title}</h2>
        {description && <p className="mt-2 max-w-xl text-sm leading-6 text-forest/60 sm:text-base">{description}</p>}
      </div>
      {action}
    </div>
  );
}

function CategoryCard({ category }) {
  return (
    <a href={`#/category/${category.id}`} className={`category-card tint-${category.tint} group relative flex min-h-48 flex-col justify-between overflow-hidden rounded-[1.65rem] p-5 transition duration-300 hover:-translate-y-1 hover:shadow-lg sm:min-h-52 sm:p-6`}>
      <div className="absolute -right-6 -top-10 size-36 rounded-full border border-current/10 opacity-70 transition duration-500 group-hover:scale-110" />
      <div className="flex items-start justify-between">
        <span className="grid size-11 place-items-center rounded-2xl bg-white/70 font-serif text-2xl text-forest shadow-sm">{category.icon}</span>
        <span className="rounded-full bg-white/60 px-3 py-1 text-xs font-semibold text-forest/65">
          {category.count} {category.count === 1 ? 'recipe' : 'recipes'}
        </span>
      </div>
      <div className="relative z-10 mt-7 flex items-end justify-between gap-3">
        <div>
          <h3 className="font-serif text-xl font-semibold text-forest sm:text-2xl">{category.name}</h3>
          <p className="mt-1 max-w-[14rem] text-xs leading-5 text-forest/65">{category.description}</p>
        </div>
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-forest text-white transition group-hover:translate-x-1">
          <Icon name="arrow" className="size-4" />
        </span>
      </div>
    </a>
  );
}

function hashString(text) {
  let hash = 0;
  for (const char of text) hash = (hash * 31 + char.codePointAt(0)) >>> 0;
  return hash;
}

// Lighter or deeper versions of the category color, one per subcategory (in
// name order within its category), so a page of desserts mixes cakes,
// cookies, and pies at a glance. Six covers the largest category.
const subcategoryShades = ['bg-white/50', 'bg-forest/[0.06]', 'bg-white/25', 'bg-forest/[0.1]', 'bg-white/10', 'bg-forest/[0.03]'];
// Card details shared from App: subcategory shade positions and category names.
const CardContext = createContext({ shades: {}, categoryNames: {} });

function subcategoryShadeIndex(recipes) {
  const byCategory = {};
  for (const recipe of recipes) {
    if (recipe.subcategory) (byCategory[recipe.category] ||= new Set()).add(recipe.subcategory);
  }
  const index = {};
  for (const [category, names] of Object.entries(byCategory)) {
    [...names].sort().forEach((name, position) => (index[`${category}/${name}`] = position));
  }
  return index;
}

// A slim accent band in the category's color and icon (as on the category
// cards), shaded by subcategory. The rings shift with the recipe ID so
// neighboring cards don't look identical.
function RecipeBand({ recipe }) {
  const { tint, icon } = { ...defaultCategoryDetails, ...categoryDetails[recipe.category] };
  const hash = hashString(recipe.id);
  const position = useContext(CardContext).shades[`${recipe.category}/${recipe.subcategory}`];
  const shade = position === undefined ? '' : subcategoryShades[position % subcategoryShades.length];
  return (
    <div className={`recipe-art tint-${tint} relative grid h-12 place-items-center overflow-hidden rounded-[1.1rem]`} aria-hidden="true">
      {shade && <span className={`absolute inset-0 ${shade}`} />}
      <span className="absolute -top-10 size-20 rounded-full border border-forest/10" style={{ left: `${4 + (hash % 34)}%` }} />
      <span className="absolute -bottom-12 size-20 rounded-full border border-forest/10" style={{ left: `${50 + ((hash >>> 8) % 36)}%` }} />
      <span className="relative grid size-8 place-items-center rounded-xl bg-white/70 font-serif text-lg text-forest shadow-sm">{icon}</span>
    </div>
  );
}

function RecipeCard({ recipe }) {
  const categoryName = useContext(CardContext).categoryNames[recipe.category] || recipe.category;
  return (
    <a href={`#/recipe/${recipe.id}`} className="group flex h-full flex-col rounded-[1.55rem] border border-forest/8 bg-white p-3.5 shadow-sm shadow-forest/[0.025] transition duration-300 hover:-translate-y-1 hover:border-forest/15 hover:shadow-xl hover:shadow-forest/10 sm:p-4">
      <RecipeBand recipe={recipe} />
      <div className="flex flex-1 flex-col px-1 pb-1 pt-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-[0.62rem] font-bold uppercase tracking-[0.16em] text-coral">{recipe.subcategory || categoryName}</span>
          {recipe.sourcePage && <span className="text-[0.68rem] text-forest/40">p. {recipe.sourcePage}</span>}
        </div>
        <h3 className="font-serif text-[1.16rem] font-semibold leading-snug text-forest transition group-hover:text-coral">{recipe.title}</h3>
        <div className="mt-auto flex items-center justify-between pt-4 text-xs text-forest/50">
          {recipe.ratingCount ? (
            <RatingBadge average={recipe.ratingAverage} count={recipe.ratingCount} />
          ) : (
            <span className="flex items-center gap-1.5">
              <Icon name="book" className="size-3.5" /> In the collection
            </span>
          )}
          <span className="grid size-8 place-items-center rounded-full bg-cream text-forest transition group-hover:bg-forest group-hover:text-white">
            <Icon name="arrow" className="size-3.5" />
          </span>
        </div>
      </div>
    </a>
  );
}

function HomePage({ recipes, allCategories }) {
  const featured = useMemo(() => {
    const ids = ['warm-pizza-dip-from-good-housekeeping-jan-feb-2021-p-107', 'chicken-alfredo', 'easy-pumpkin-loaf', 'black-bean-soup'];
    return ids.map((id) => recipes.find((recipe) => recipe.id === id)).filter(Boolean);
  }, [recipes]);
  const favorites = useMemo(() => recipes.filter((recipe) => recipe.ratingCount).sort(byRating).slice(0, 4), [recipes]);

  return (
    <main>
      <section className="mx-auto grid max-w-7xl items-center gap-10 px-5 pb-14 pt-9 sm:px-8 sm:pb-20 sm:pt-14 lg:grid-cols-[1.02fr_.98fr] lg:gap-14 lg:px-12 lg:pb-24">
        <div className="relative z-10 max-w-2xl">
          <h1 className="font-serif text-[3.15rem] font-medium leading-[1.02] tracking-[-0.045em] text-forest sm:text-6xl lg:text-[4.45rem]">
            Good food brings <span className="italic text-coral">us</span> together.
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-forest/65 sm:text-lg sm:leading-8">Recipes collected by Lisa Jensen from many sources over the years to share with her children, with love. Find an old favorite, choose something new, and make room for one more at the table.</p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a href="#/category/all" className="inline-flex items-center justify-center gap-3 rounded-full bg-forest px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-forest/15 transition hover:bg-forest-light">
              Browse all recipes <Icon name="arrow" className="size-4" />
            </a>
            <a href="#categories" className="rounded-full px-5 py-3.5 text-sm font-semibold text-forest/70 transition hover:bg-white">
              Explore categories
            </a>
          </div>
          <div className="mt-10 flex items-center gap-4 border-t border-forest/10 pt-6 sm:mt-12">
            <div className="flex -space-x-2" aria-hidden="true">
              <span className="grid size-9 place-items-center rounded-full border-2 border-cream bg-coral-pale text-sm">♡</span>
              <span className="grid size-9 place-items-center rounded-full border-2 border-cream bg-gold-pale text-sm">✿</span>
              <span className="grid size-9 place-items-center rounded-full border-2 border-cream bg-sage-pale text-sm">✦</span>
            </div>
            <p className="text-sm text-forest/55">
              <strong className="font-semibold text-forest">{recipes.length} recipes</strong> across {allCategories.filter((category) => category.count).length} cozy corners
            </p>
          </div>
        </div>
        <HeroArt />
      </section>

      <section id="categories" className="border-y border-forest/8 bg-white/50">
        <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-20 lg:px-12">
          <SectionHeading eyebrow="Find your kind of good" title="What sounds good today?" description="Browse by craving, course, or the kind of day you're having." />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {allCategories
              .filter((category) => category.count)
              .map((category) => (
                <CategoryCard key={category.id} category={category} />
              ))}
          </div>
        </div>
      </section>

      {favorites.length > 0 && (
        <section className="mx-auto max-w-7xl px-5 pt-14 sm:px-8 sm:pt-20 lg:px-12">
          <SectionHeading
            eyebrow="Rated by the family"
            title="Family favorites"
            description="The recipes everyone keeps coming back to, by their star ratings."
            action={
              <a href="#/category/all/top-rated" className="inline-flex items-center gap-2 text-sm font-semibold text-forest transition hover:text-coral">
                See all by rating <Icon name="arrow" className="size-4" />
              </a>
            }
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {favorites.map((recipe) => (
              <RecipeCard key={recipe.id} recipe={recipe} />
            ))}
          </div>
        </section>
      )}

      <section className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-20 lg:px-12">
        <SectionHeading
          eyebrow="A few from the recipe box"
          title="Good places to start"
          description="A handful of favorites from across the collection."
          action={
            <a href="#/category/all" className="inline-flex items-center gap-2 text-sm font-semibold text-forest transition hover:text-coral">
              See every recipe <Icon name="arrow" className="size-4" />
            </a>
          }
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {featured.map((recipe) => (
            <RecipeCard key={recipe.id} recipe={recipe} />
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-16 sm:px-8 sm:pb-24 lg:px-12">
        <div className="relative overflow-hidden rounded-[2rem] bg-forest px-6 py-9 text-white sm:px-10 sm:py-12">
          <div className="absolute -right-12 -top-20 size-64 rounded-full border border-white/10" />
          <div className="absolute -right-2 -top-10 size-44 rounded-full border border-white/10" />
          <div className="relative flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
            <div>
              <p className="mb-2 text-[0.66rem] font-bold uppercase tracking-[0.2em] text-gold">From Lisa, with love</p>
              <h2 className="max-w-xl font-serif text-3xl leading-tight sm:text-4xl">Every recipe has a place in the story.</h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-white/65">Lisa gathered these recipes from many sources and compiled them into the Giant Book of Yum for her children. Every recipe keeps its page number from the original book, along with the text as it was first written.</p>
            </div>
            <span className="inline-flex w-fit shrink-0 items-center gap-3 rounded-full bg-white/10 px-5 py-3 text-sm font-semibold text-white/85 ring-1 ring-white/15">
              <Icon name="book" className="size-4" /> 273 pages, gathered over time
            </span>
          </div>
        </div>
      </section>
    </main>
  );
}

function CategoryPage({ categoryId, initialSort, recipes, categoriesMap, canEdit }) {
  const category = categoriesMap[categoryId];
  const [selectedSubcategory, setSelectedSubcategory] = useState('All');
  const [sort, setSort] = useState(() => (sortOptions.some((option) => option.id === initialSort) ? initialSort : 'title'));
  useEffect(() => setSelectedSubcategory('All'), [categoryId]);

  function chooseSort(next) {
    setSort(next);
    // Keep the address shareable without a hashchange (which scrolls to top).
    window.history.replaceState(null, '', `#/category/${categoryId}${next === 'title' ? '' : `/${next}`}`);
  }

  const source = categoryId === 'all' ? recipes : category?.recipes || [];
  const subcategories = [...new Set(source.map((recipe) => recipe.subcategory).filter(Boolean))];
  const compare = sortOptions.find((option) => option.id === sort).compare;
  const visible = source.filter((recipe) => selectedSubcategory === 'All' || recipe.subcategory === selectedSubcategory).sort(compare);

  const title = categoryId === 'all' ? 'All recipes' : category?.name || 'Recipe collection';
  const description = categoryId === 'all' ? 'Every recipe in one place. Pick a category or settle in and browse.' : category?.description;

  return (
    <main className="mx-auto min-h-[70vh] max-w-7xl px-5 pb-20 pt-8 sm:px-8 sm:pt-12 lg:px-12">
      <Breadcrumbs>
        <span className="text-forest">{title}</span>
      </Breadcrumbs>
      <div className="mb-9 flex flex-col gap-6 border-b border-forest/10 pb-8 sm:flex-row sm:items-end sm:justify-between sm:pb-10">
        <div className="max-w-2xl">
          <p className="mb-2 text-[0.68rem] font-bold uppercase tracking-[0.21em] text-coral">The recipe collection</p>
          <h1 className="font-serif text-4xl font-semibold tracking-tight text-forest sm:text-5xl">{title}</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-forest/60 sm:text-base">{description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {canEdit && (
            <a href={categoryId === 'all' ? '#/new' : `#/new/${categoryId}`} className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-semibold text-forest shadow-sm ring-1 ring-forest/10 transition hover:bg-sage-pale">
              <Icon name="plus" className="size-4" /> Add recipe
            </a>
          )}
          <div className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-forest/8">
            <span className="grid size-10 place-items-center rounded-xl bg-sage-pale text-forest">
              <Icon name="book" className="size-5" />
            </span>
            <div>
              <p className="font-serif text-xl font-semibold text-forest">{visible.length}</p>
              <p className="text-[0.62rem] font-bold uppercase tracking-[0.14em] text-forest/45">recipes to browse</p>
            </div>
          </div>
        </div>
      </div>
      <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        {subcategories.length > 0 ? (
          <div className="flex flex-wrap gap-2" aria-label="Filter by subcategory">
            {['All', ...subcategories].map((subcategory) => (
              <button key={subcategory} onClick={() => setSelectedSubcategory(subcategory)} className={`rounded-full px-4 py-2 text-xs font-semibold transition ${selectedSubcategory === subcategory ? 'bg-forest text-white' : 'bg-white text-forest/65 ring-1 ring-forest/10 hover:ring-forest/25'}`}>
                {subcategory}
              </button>
            ))}
          </div>
        ) : <span />}
        <label className="flex shrink-0 items-center gap-2 text-xs font-semibold text-forest/55">
          Sort
          <select value={sort} onChange={(event) => chooseSort(event.target.value)} className="rounded-full border border-forest/12 bg-white py-2 pl-3.5 pr-8 text-xs font-semibold text-forest outline-none transition focus:border-forest/40 focus:ring-2 focus:ring-sage-pale">
            {sortOptions.map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
        </label>
      </div>
      {visible.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((recipe) => (
            <RecipeCard key={recipe.id} recipe={recipe} />
          ))}
        </div>
      ) : (
        <p className="rounded-3xl bg-white p-8 text-center text-forest/60">No recipes in this collection yet.</p>
      )}
    </main>
  );
}

function metaLabel(text) {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\s*-\s*/g, ' · ')
    .replace(/\s+--\s+/g, ' · ');
}

// Splits a recipe into its ingredient and direction columns, keeping section
// headings ("Filling", "Topping") in place. A heading goes in the column of the
// lines it introduces, and step numbers restart after each heading.
function recipeColumns(blocks) {
  const ingredientColumn = [];
  const directionColumn = [];
  let stepNumber = 0;
  blocks.forEach((block, index) => {
    if (block.type === 'label') {
      const next = blocks.slice(index + 1).find((item) => item.type !== 'label');
      if (next?.type === 'ingredient') ingredientColumn.push(block);
      else {
        directionColumn.push(block);
        stepNumber = 0;
      }
    } else if (block.type === 'ingredient') ingredientColumn.push(block);
    else if (block.type === 'step') directionColumn.push({ ...block, number: ++stepNumber });
    else directionColumn.push(block);
  });
  return { ingredientColumn, directionColumn };
}

function SectionLabel({ text, first, as: Tag = 'li' }) {
  return <Tag className={`list-none font-serif text-lg font-semibold text-forest ${first ? '' : 'pt-3'}`}>{text.replace(/:$/, '')}</Tag>;
}

function ratingSummary(average, count) {
  return count ? `${formatRating(average)} out of 5 · ${count} ${count === 1 ? 'rating' : 'ratings'}` : 'No ratings yet';
}

// Average, count, and the signed-in person's own stars for one recipe.
function RatingPanel({ recipe, rating, userId, onRated }) {
  const online = useOnlineStatus();
  const [mine, setMine] = useState({ id: null, stars: undefined });
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!userId || !online) return undefined;
    let cancelled = false;
    fetchMyRating(recipe.id, userId)
      .then((stars) => !cancelled && setMine({ id: recipe.id, stars }))
      .catch(() => !cancelled && setMine({ id: recipe.id, stars: null }));
    return () => {
      cancelled = true;
    };
  }, [recipe.id, userId, online]);

  const myStars = mine.id === recipe.id ? mine.stars : undefined;

  async function rate(stars) {
    const previous = myStars;
    setMine({ id: recipe.id, stars });
    setStatus('saving');
    setError('');
    try {
      onRated(recipe.id, await rateRecipe(recipe.id, stars));
      setStatus('saved');
    } catch (err) {
      setMine({ id: recipe.id, stars: previous });
      setStatus('idle');
      setError(online ? err.message || 'Your rating could not be saved. Try again in a moment.' : 'You’re offline. Rating needs a connection.');
    }
  }

  let action;
  if (!userId) {
    action = (
      <a href="#/account" onClick={() => rememberSignInReturn()} className="inline-flex items-center gap-2 rounded-full bg-forest px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-forest-light">
        Sign in to rate <Icon name="arrow" className="size-4" />
      </a>
    );
  } else if (!online) {
    action = <p className="text-sm text-forest/60">You’re offline. Rating needs a connection.</p>;
  } else {
    action = (
      <div>
        <StarInput value={myStars ?? null} onChange={(stars) => stars !== myStars && rate(stars)} disabled={myStars === undefined || status === 'saving'} />
        <p className="mt-1 min-h-5 text-xs text-forest/55" role="status" aria-live="polite">
          {myStars === undefined && 'Loading your rating…'}
          {myStars === null && status !== 'saving' && 'Tap a star to rate it.'}
          {myStars != null && status === 'saving' && 'Saving…'}
          {myStars != null && status !== 'saving' && (
            <>
              {status === 'saved' ? 'Thanks! ' : ''}You gave it {myStars} {myStars === 1 ? 'star' : 'stars'}.{' '}
              <button type="button" onClick={() => rate(null)} className="font-semibold text-coral underline-offset-2 hover:underline">Remove my rating</button>
            </>
          )}
        </p>
      </div>
    );
  }

  return (
    <section id="rate-recipe" className="mt-6 flex scroll-mt-24 flex-col gap-5 rounded-[1.65rem] bg-gold-pale/55 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div>
        <h2 className="font-serif text-2xl font-semibold text-forest">{myStars != null ? 'Your rating' : 'Made it? Rate it'}</h2>
        <p className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-forest/65">
          <Stars value={rating.ratingAverage || 0} className="size-4" />
          {ratingSummary(rating.ratingAverage, rating.ratingCount)}
        </p>
      </div>
      <div className="sm:text-right">{action}</div>
      {error && <p role="alert" className="rounded-2xl bg-coral-pale px-4 py-3 text-sm text-forest sm:basis-full">{error}</p>}
    </section>
  );
}

function RecipePage({ recipe, categoriesMap, canEdit, rating, userId, onRated }) {
  const category = categoriesMap[recipe.category];
  const categoryName = category?.name || recipe.category;
  const meta = recipe.blocks.filter((block) => block.type === 'meta');
  const bodyBlocks = recipe.blocks.filter((block) => block.type !== 'meta');
  const { ingredientColumn, directionColumn } = recipeColumns(bodyBlocks);
  const ingredientCount = ingredientColumn.filter((block) => block.type === 'ingredient').length;
  const stepCount = directionColumn.filter((block) => block.type === 'step').length;
  const hasStructuredParts = ingredientCount > 0 || stepCount > 0;

  return (
    <main className="mx-auto min-h-[70vh] max-w-7xl px-5 pb-20 pt-8 sm:px-8 sm:pt-12 lg:px-12">
      <Breadcrumbs>
        <a href={`#/category/${recipe.category}`} className="transition hover:text-forest">
          {categoryName}
        </a>
        <span>/</span>
        <span className="max-w-[15rem] truncate text-forest">{recipe.title}</span>
      </Breadcrumbs>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-12">
        <article>
          <div className="mb-6 flex flex-wrap items-center gap-2">
            {canEdit && (
              <a href={`#/recipe/${recipe.id}/edit`} className="order-last ml-auto inline-flex items-center gap-1.5 rounded-full bg-forest px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-forest-light">
                <Icon name="edit" className="size-3.5" /> Edit
              </a>
            )}
            <a href={`#/category/${recipe.category}`} className={`category-pill tint-${category?.tint || 'sage'} inline-flex items-center gap-1.5 rounded-full py-1.5 pl-2.5 pr-3.5 text-[0.67rem] font-bold uppercase tracking-[0.15em]`}>
              <span aria-hidden="true" className="font-serif text-sm font-normal normal-case tracking-normal">{category?.icon || defaultCategoryDetails.icon}</span>
              {categoryName}
            </a>
            {recipe.subcategory && <span className="rounded-full bg-white px-3.5 py-1.5 text-[0.67rem] font-semibold text-forest/55 ring-1 ring-forest/8">{recipe.subcategory}</span>}
          </div>
          <h1 className="max-w-4xl font-serif text-4xl font-semibold leading-[1.08] tracking-tight text-forest sm:text-5xl lg:text-[3.55rem]">{recipe.title}</h1>
          {recipe.source && <p className="mt-3 max-w-3xl font-serif text-lg italic leading-snug text-forest/65 sm:text-xl">From {recipe.source}</p>}
          <button type="button" onClick={() => document.getElementById('rate-recipe')?.scrollIntoView({ behavior: 'smooth' })} className="mt-4 flex items-center gap-2 text-sm text-forest/60 transition hover:text-forest">
            <Stars value={rating.ratingAverage || 0} className="size-4" />
            {ratingSummary(rating.ratingAverage, rating.ratingCount)}
          </button>
          <p className="mt-2 flex items-center gap-2 text-sm text-forest/50">
            <Icon name="book" className="size-4" /> Giant Book of Yum
            {recipe.sourcePage && (
              <>
                <span className="text-forest/25">·</span> page {recipe.sourcePage}
              </>
            )}
          </p>
          {meta.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2">
              {meta.map((item, index) => (
                <span key={index} className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-semibold text-forest/70 ring-1 ring-forest/8">
                  <Icon name="clock" className="size-3.5 text-coral" />
                  {metaLabel(item.text)}
                </span>
              ))}
            </div>
          )}

          {hasStructuredParts ? (
            <div className="mt-8 grid gap-5 md:grid-cols-[minmax(0,.82fr)_minmax(0,1.18fr)]">
              <section className="rounded-[1.65rem] bg-sage-pale/65 p-5 sm:p-6">
                <div className="mb-5 flex items-center justify-between">
                  <h2 className="font-serif text-2xl font-semibold text-forest">Ingredients</h2>
                  <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-forest/50">{ingredientCount} items</span>
                </div>
                <ul className="space-y-3.5">
                  {ingredientColumn.map((block, index) =>
                    block.type === 'label' ? (
                      <SectionLabel key={index} text={block.text} first={index === 0} />
                    ) : (
                      <li key={index} className="flex gap-3 text-sm leading-6 text-forest/75">
                        <span className="mt-[0.52rem] size-1.5 shrink-0 rounded-full bg-coral" />
                        {block.text}
                      </li>
                    ),
                  )}
                </ul>
              </section>
              <section className="rounded-[1.65rem] bg-white p-5 shadow-sm ring-1 ring-forest/8 sm:p-6">
                <h2 className="mb-5 font-serif text-2xl font-semibold text-forest">Let’s make it</h2>
                <div className="space-y-4">
                  {directionColumn.map((block, index) => {
                    if (block.type === 'label') return <SectionLabel key={index} as="h3" text={block.text} first={index === 0} />;
                    if (block.type === 'note') {
                      return (
                        <p key={index} className="text-sm leading-6 text-forest/65">
                          {block.text}
                        </p>
                      );
                    }
                    const numbered = block.text.match(/^(\d+)[.)]\s*(.*)$/);
                    return (
                      <div key={index} className="flex gap-3.5 text-sm leading-6 text-forest/70">
                        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-cream text-xs font-bold text-forest">{numbered?.[1] || block.number}</span>
                        <p>{numbered?.[2] || block.text}</p>
                      </div>
                    );
                  })}
                </div>
                {!stepCount && <p className="text-sm leading-6 text-forest/60">The source has ingredient notes but no separate numbered directions for this recipe.</p>}
              </section>
            </div>
          ) : (
            <section className="mt-8 rounded-[1.65rem] bg-white p-5 shadow-sm ring-1 ring-forest/8 sm:p-7">
              <h2 className="mb-4 font-serif text-2xl font-semibold text-forest">Recipe notes</h2>
              <div className="space-y-3 text-sm leading-7 text-forest/70">
                {bodyBlocks.map((block, index) => (
                  <p key={index}>{block.text}</p>
                ))}
              </div>
            </section>
          )}

          <RatingPanel recipe={recipe} rating={rating} userId={userId} onRated={onRated} />

          {recipe.sourceText && (
            <details className="group mt-6 rounded-2xl border border-forest/10 bg-white/55 p-4 sm:p-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-forest marker:hidden">
                <span>See the source transcription</span>
                <Icon name="chevron" className="size-4 transition group-open:rotate-180" />
              </summary>
              <pre className="mt-4 max-h-96 overflow-auto whitespace-pre-wrap border-t border-forest/10 pt-4 font-sans text-xs leading-6 text-forest/60">{recipe.sourceText}</pre>
            </details>
          )}
          {recipe.sourcePage && (
            <div className="mt-7 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-gold-pale/65 px-4 py-4 text-xs text-forest/60 sm:px-5">
              <span>From page {recipe.sourcePage} of the original collection</span>
              <span className="font-semibold text-forest/65">Original collection, page {recipe.sourcePage}</span>
            </div>
          )}
        </article>

        <aside className="lg:pt-1">
          <div className="sticky top-24 rounded-[1.7rem] border border-forest/8 bg-white p-5 shadow-sm sm:p-6">
            <p className="mb-4 text-[0.66rem] font-bold uppercase tracking-[0.18em] text-coral">Keep browsing</p>
            <h2 className="font-serif text-2xl font-semibold text-forest">More from {categoryName}</h2>
            <div className="mt-5 space-y-2">
              {(category?.recipes || [])
                .filter((item) => item.id !== recipe.id)
                .slice(0, 4)
                .map((item) => (
                  <a key={item.id} href={`#/recipe/${item.id}`} className="group flex items-center justify-between gap-3 rounded-xl px-3 py-3 transition hover:bg-cream">
                    <span className="line-clamp-2 font-serif text-[0.98rem] font-semibold leading-snug text-forest/80 group-hover:text-coral">{item.title}</span>
                    <Icon name="arrow" className="size-4 shrink-0 text-forest/40 transition group-hover:translate-x-1 group-hover:text-coral" />
                  </a>
                ))}
            </div>
            <a href={`#/category/${recipe.category}`} className="mt-4 flex items-center justify-center gap-2 rounded-full bg-forest px-4 py-3 text-sm font-semibold text-white transition hover:bg-forest-light">
              View all in this category <Icon name="arrow" className="size-4" />
            </a>
          </div>
        </aside>
      </div>
    </main>
  );
}

function NotFound() {
  return (
    <main className="mx-auto min-h-[65vh] max-w-2xl px-5 py-20 text-center">
      <span className="mx-auto mb-5 grid size-14 place-items-center rounded-2xl bg-gold-pale text-2xl">✦</span>
      <h1 className="font-serif text-4xl font-semibold text-forest">That recipe wandered off.</h1>
      <p className="mt-3 text-forest/60">Try the recipe collection and pick another dish.</p>
      <a href="#/category/all" className="mt-7 inline-flex items-center gap-2 rounded-full bg-forest px-5 py-3 text-sm font-semibold text-white">
        Browse recipes <Icon name="arrow" className="size-4" />
      </a>
    </main>
  );
}

function Footer() {
  return (
    <footer className="border-t border-forest/10 bg-white/45">
      <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-7 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
        <Brand />
        <p className="text-xs leading-5 text-forest/45">The Giant Book of Yum, compiled by Lisa Jensen and shared with her children, with love.</p>
        <div className="flex items-center gap-4 text-xs font-semibold text-forest/50">
          <span>Made for the middle of the table.</span>
          <a href="#/offline" className="text-forest/40 transition hover:text-forest">
            Use offline
          </a>
          <a href="#/account" className="text-forest/40 transition hover:text-forest">
            Account
          </a>
        </div>
      </div>
    </footer>
  );
}

function StatusMessage({ title, message, loading = false }) {
  return (
    <main className="mx-auto grid min-h-[65vh] max-w-xl place-items-center px-5 py-24 text-center">
      <div>
        {loading && (
          <span className="mx-auto mb-5 grid size-12 animate-pulse place-items-center rounded-2xl bg-sage-pale text-forest">
            <Icon name="bowl" className="size-6" />
          </span>
        )}
        <h1 className="font-serif text-2xl font-semibold text-forest sm:text-3xl">{title}</h1>
        {message && <p className="mt-3 text-sm text-forest/60">{message}</p>}
      </div>
    </main>
  );
}

function OfflineEmpty() {
  return (
    <main className="mx-auto grid min-h-[65vh] max-w-xl place-items-center px-5 py-24 text-center">
      <div>
        <span className="mx-auto mb-5 grid size-12 place-items-center rounded-2xl bg-gold-pale text-forest">
          <Icon name="cloud-off" className="size-6" />
        </span>
        <h1 className="font-serif text-2xl font-semibold text-forest sm:text-3xl">You’re offline.</h1>
        <p className="mt-3 text-sm leading-6 text-forest/60">The recipes haven’t been downloaded to this device yet. Next time you’re connected, open <a href="#/offline" className="font-semibold text-coral">Use offline</a> and download them to read GBoy anywhere.</p>
      </div>
    </main>
  );
}

// Loads one full recipe; the summaries list only has titles and categories.
function useRecipe(id, version) {
  const [state, setState] = useState({ id: null, recipe: null, error: false });
  useEffect(() => {
    if (!id) return undefined;
    let cancelled = false;
    fetchRecipe(id)
      .then((recipe) => !cancelled && setState({ id, recipe, error: false }))
      .catch(() => !cancelled && setState({ id, recipe: null, error: true }));
    return () => {
      cancelled = true;
    };
  }, [id, version]);
  return state.id === id ? state : { id, recipe: undefined, error: false };
}

export default function App() {
  const [route, setRoute] = useState(parseRoute);
  const [categories, setCategories] = useState([]);
  const [recipes, setRecipes] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [session, setSession] = useState(null);
  const [canEdit, setCanEdit] = useState(false);
  const [recipeVersion, setRecipeVersion] = useState(0);
  const online = useOnlineStatus();
  const offlineCopy = useOfflineMeta();
  useOfflineAutoRefresh();

  const loadCollection = useCallback(
    () =>
      Promise.all([fetchCategories(), fetchRecipeSummaries()])
        .then(([categoryRows, recipeRows]) => {
          setCategories(categoryRows);
          setRecipes(recipeRows);
          setLoadError(false);
        })
        .catch(() => setLoadError(true)),
    [],
  );

  useEffect(() => {
    if (isConfigured) loadCollection();
  }, [loadCollection]);

  // Retry once a connection returns, or once a download lands while offline.
  const hasOfflineCopy = Boolean(offlineCopy.meta);
  useEffect(() => {
    if (isConfigured && loadError && (online || hasOfflineCopy)) loadCollection();
  }, [online, hasOfflineCopy, loadError, loadCollection]);

  useEffect(() => {
    if (!isConfigured) return undefined;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      // Back to the page where "Sign in" was tapped.
      if (event === 'SIGNED_IN') {
        const target = takeSignInReturn();
        if (target) setTimeout(() => (window.location.hash = target), 0);
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user?.id;
  useEffect(() => {
    if (!userId) {
      setCanEdit(false);
      return undefined;
    }
    let cancelled = false;
    canEditRecipes()
      .then((allowed) => !cancelled && setCanEdit(allowed))
      .catch(() => !cancelled && setCanEdit(false));
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    const update = () => {
      setRoute(parseRoute());
      window.scrollTo({ top: 0, behavior: 'instant' });
    };
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);

  const allCategories = useMemo(() => categoryRecipes(categories, recipes || []), [categories, recipes]);
  const cardContext = useMemo(
    () => ({ shades: subcategoryShadeIndex(recipes || []), categoryNames: Object.fromEntries(categories.map((category) => [category.id, category.name])) }),
    [recipes, categories],
  );
  const recipesById = useMemo(() => Object.fromEntries((recipes || []).map((recipe) => [recipe.id, recipe])), [recipes]);
  const categoriesMap = useMemo(() => Object.fromEntries(allCategories.map((category) => [category.id, category])), [allCategories]);
  const detailId = route.page === 'recipe' || route.page === 'edit' ? route.id : null;
  const detail = useRecipe(detailId, recipeVersion);

  function handleSaved(saved) {
    setRecipeVersion((version) => version + 1);
    loadCollection();
    window.location.hash = `#/recipe/${saved.id}`;
  }

  function handleRated(id, totals) {
    setRecipes((current) => current?.map((recipe) => (recipe.id === id ? { ...recipe, ...totals } : recipe)));
  }

  function handleDeleted(deleted) {
    loadCollection();
    window.location.hash = `#/category/${deleted.category}`;
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.hash = '#/';
  }

  let content;
  if (!isConfigured) content = <StatusMessage title="The recipe box isn't connected yet." message="Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local (install/supabase/write_env_local.sh writes them), then restart the dev server." />;
  else if (route.page === 'offline') content = <OfflinePage totalRecipes={recipes?.length} />;
  else if (route.page === 'account' && !online && !session) content = <StatusMessage title="Signing in needs a connection." message="You can still browse any recipes you’ve downloaded." />;
  else if (loadError && !online) content = <OfflineEmpty />;
  else if (loadError) content = <StatusMessage title="The recipe box is taking a moment." message="Refresh the page to load the collection." />;
  else if (route.page === 'account') content = <SignInPage session={session} canEdit={canEdit} onSignOut={signOut} />;
  else if (!recipes) content = <StatusMessage title="Opening the recipe box…" loading />;
  else if (route.page === 'search') content = <SearchPage key={route.query} initialQuery={route.query} categoriesMap={categoriesMap} recipesById={recipesById} />;
  else if (route.page === 'home') content = <HomePage recipes={recipes} allCategories={allCategories} />;
  else if (route.page === 'category') content = <CategoryPage key={`${route.id}/${route.sort || ''}`} categoryId={route.id} initialSort={route.sort} recipes={recipes} categoriesMap={categoriesMap} canEdit={canEdit} />;
  else if (['new', 'edit', 'import'].includes(route.page) && !online) content = <StatusMessage title="Editing needs a connection." message="Recipes you’ve downloaded are still here to read." />;
  else if (['new', 'edit', 'import'].includes(route.page) && !canEdit) {
    content = session ? <StatusMessage title="This account can't edit recipes." message="Ask the site owner to make you an admin." /> : <SignInPage session={session} canEdit={canEdit} onSignOut={signOut} />;
  } else if (route.page === 'new') {
    content = <RecipeEditor key="new" defaultCategory={categoriesMap[route.category] ? route.category : undefined} categories={categories} summaries={recipes} onSaved={handleSaved} onDeleted={handleDeleted} />;
  } else if (route.page === 'import') {
    content = <ImportPage key={`import-${route.category || ''}`} defaultCategory={categoriesMap[route.category] ? route.category : ''} categories={categories} summaries={recipes} onSaved={handleSaved} onDeleted={handleDeleted} />;
  } else if (detail.error && !online) content = <StatusMessage title="This recipe isn’t on this device." message={offlineCopy.meta ? 'It was added after your last download. Connect to see it.' : 'Download the recipes while you’re connected to read them offline.'} />;
  else if (detail.error) content = <StatusMessage title="That recipe didn't load." message="Refresh the page to try again." />;
  else if (detail.recipe === undefined) content = <StatusMessage title="Finding the recipe…" loading />;
  else if (!detail.recipe) content = <NotFound />;
  else if (route.page === 'edit') content = <RecipeEditor key={`${detail.recipe.id}-${recipeVersion}`} recipe={detail.recipe} categories={categories} summaries={recipes} onSaved={handleSaved} onDeleted={handleDeleted} />;
  else content = <RecipePage recipe={detail.recipe} categoriesMap={categoriesMap} canEdit={canEdit} rating={recipesById[detail.recipe.id] || {}} userId={userId} onRated={handleRated} />;

  return (
    <div className="min-h-screen bg-cream text-forest">
      <Header canEdit={canEdit} signedIn={Boolean(session)} page={route.page} />
      <OfflineBanner />
      <CardContext.Provider value={cardContext}>{content}</CardContext.Provider>
      <Footer />
    </div>
  );
}
