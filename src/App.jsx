import { useEffect, useMemo, useState } from 'react'

const categoryDetails = {
  appetizers: {
    icon: '✳', tint: 'coral', description: 'A little something to start the table and get everyone gathered around.',
  },
  backpacking: {
    icon: '⌁', tint: 'gold', description: 'Trail-friendly favorites and camp cooking ideas from the collection.',
  },
  belgian: {
    icon: '✦', tint: 'blue', description: 'A small collection of Belgian family recipes, from waffles to waterzooi.',
  },
  breads: {
    icon: '⌂', tint: 'gold', description: 'Warm loaves, quick breads, rolls, muffins, and doughs worth sharing.',
  },
  breakfast: {
    icon: '☀', tint: 'sage', description: 'Pancakes, oatmeal, brunch bakes, and easy starts to the day.',
  },
  desserts: {
    icon: '♡', tint: 'rose', description: 'Cookies, cakes, pies, frozen treats, and a little something sweet.',
  },
  drinks: {
    icon: '◌', tint: 'blue', description: 'Smoothies, coolers, punches, and cozy cups for every season.',
  },
  entrees: {
    icon: '✳', tint: 'sage', description: 'Comforting mains, weeknight dinners, sandwiches, and wraps.',
  },
  salads: {
    icon: '❋', tint: 'sage', description: 'Fresh greens, pasta salads, and colorful bowls for the middle of the table.',
  },
  sauces: {
    icon: '◉', tint: 'coral', description: 'The dips, dressings, sauces, syrups, and spreads that make a meal sing.',
  },
  sides: {
    icon: '✿', tint: 'gold', description: 'Vegetables, potatoes, grains, and all the good things alongside.',
  },
  soups: {
    icon: '◒', tint: 'blue', description: 'A comforting pot for a chilly evening, a busy day, or a full table.',
  },
}

const categoryOrder = [
  'appetizers', 'backpacking', 'belgian', 'breads', 'breakfast', 'desserts',
  'drinks', 'entrees', 'salads', 'sauces', 'sides', 'soups',
]

const categoryById = Object.fromEntries(
  Object.entries(categoryDetails).map(([id, details]) => [id, { id, ...details }]),
)

function parseRoute() {
  const segments = window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  if (segments[0] === 'category' && segments[1]) return { page: 'category', id: segments[1] }
  if (segments[0] === 'recipe' && segments[1]) return { page: 'recipe', id: segments[1] }
  return { page: 'home' }
}

function Icon({ name, className = '' }) {
  const shared = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round', className, 'aria-hidden': true }
  if (name === 'arrow') return <svg {...shared}><path d="M4.5 12h14M13 5.5l6.5 6.5-6.5 6.5" /></svg>
  if (name === 'chevron') return <svg {...shared}><path d="m8 10 4 4 4-4" /></svg>
  if (name === 'clock') return <svg {...shared}><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3.2 2" /></svg>
  if (name === 'book') return <svg {...shared}><path d="M5 4.5h11.5A2.5 2.5 0 0 1 19 7v12H7a2 2 0 0 1-2-2z" /><path d="M5 16.5A2.5 2.5 0 0 1 7.5 14H19M9 8h6m-6 3h6" /></svg>
  if (name === 'leaf') return <svg {...shared}><path d="M19.5 4.5c-7 .2-12.7 2.4-13.7 7.2-.7 3.1 1.6 5.7 4.7 5.2 4.9-.8 7.5-6.1 9-12.4Z" /><path d="M4.5 20c2.8-4.5 6.4-7.5 11-10" /></svg>
  if (name === 'spark') return <svg {...shared}><path d="m12 3 1.7 6.3L20 11l-6.3 1.7L12 19l-1.7-6.3L4 11l6.3-1.7L12 3Z" /><path d="m19 16 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16Z" /></svg>
  return <svg {...shared}><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="5.2" /><circle cx="12" cy="12" r="1.8" /></svg>
}

function Brand({ onClick }) {
  return (
    <a href="#/" onClick={onClick} className="flex items-center gap-3 text-forest" aria-label="GBoy Recipe Book home">
      <span className="grid size-10 place-items-center rounded-2xl bg-forest text-cream shadow-sm">
        <Icon name="leaf" className="size-5" />
      </span>
      <span className="leading-tight">
        <span className="block font-serif text-[1.05rem] font-semibold tracking-tight">GBoy</span>
        <span className="block text-[0.62rem] font-semibold uppercase tracking-[0.19em] text-forest/60">Recipe book</span>
      </span>
    </a>
  )
}

function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-forest/8 bg-cream/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3.5 sm:px-8 lg:px-12">
        <Brand />
        <nav className="flex items-center gap-3 sm:gap-7" aria-label="Main navigation">
          <a href="#/" className="hidden text-sm font-medium text-forest/70 transition hover:text-forest sm:inline">Home</a>
          <a href="#/category/all" className="text-sm font-medium text-forest/70 transition hover:text-forest">Browse recipes</a>
          <a href="#/category/desserts" className="hidden rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-forest shadow-sm ring-1 ring-forest/10 transition hover:bg-sage-pale sm:inline-flex">
            Something sweet <Icon name="arrow" className="ml-2 size-4" />
          </a>
        </nav>
      </div>
    </header>
  )
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
            <circle cx="101" cy="99" r="10" fill="#c84f35" /><circle cx="151" cy="124" r="11" fill="#c84f35" /><circle cx="121" cy="150" r="9" fill="#c84f35" />
            <path d="M78 125c9-11 21-11 30-1-8 13-20 16-30 1Zm65-33c9-12 22-12 30-2-7 14-19 18-30 2Zm4 55c9-12 21-13 31-3-7 15-20 19-31 3Z" fill="#49795a" />
            <path d="m108 83 8-15m7 18 8-13m11 49 10-13" stroke="#fff9e6" strokeWidth="3" strokeLinecap="round" />
          </svg>
        </div>
      </div>
      <div className="absolute bottom-[8%] left-[7%] rounded-2xl bg-white/95 px-4 py-3 shadow-lg shadow-forest/10 sm:px-5 sm:py-4">
        <div className="mb-1 flex items-center gap-1 text-gold" aria-label="Family favorite"><span>✦</span><span>✦</span><span>✦</span></div>
        <p className="font-serif text-base font-semibold text-forest sm:text-lg">Made for the middle of the table</p>
        <p className="mt-1 text-xs text-forest/55">Family favorites, gathered over time</p>
      </div>
      <div className="absolute right-[7%] top-[20%] grid size-12 place-items-center rounded-full bg-coral text-white shadow-md sm:size-14">
        <Icon name="spark" className="size-6" />
      </div>
    </div>
  )
}

function categoryRecipes(recipes) {
  return categoryOrder.map((id) => {
    const meta = categoryById[id]
    const matching = recipes.filter((recipe) => recipe.category === id)
    return { ...meta, name: matching[0]?.categoryName || meta.name, count: matching.length, recipes: matching }
  }).filter((category) => category.count)
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
  )
}

function CategoryCard({ category }) {
  return (
    <a href={`#/category/${category.id}`} className={`category-card tint-${category.tint} group relative flex min-h-48 flex-col justify-between overflow-hidden rounded-[1.65rem] p-5 transition duration-300 hover:-translate-y-1 hover:shadow-lg sm:min-h-52 sm:p-6`}>
      <div className="absolute -right-6 -top-10 size-36 rounded-full border border-current/10 opacity-70 transition duration-500 group-hover:scale-110" />
      <div className="flex items-start justify-between">
        <span className="grid size-11 place-items-center rounded-2xl bg-white/70 font-serif text-2xl text-forest shadow-sm">{category.icon}</span>
        <span className="rounded-full bg-white/60 px-3 py-1 text-xs font-semibold text-forest/65">{category.count} recipes</span>
      </div>
      <div className="relative z-10 mt-7 flex items-end justify-between gap-3">
        <div>
          <h3 className="font-serif text-xl font-semibold text-forest sm:text-2xl">{category.name}</h3>
          <p className="mt-1 max-w-[14rem] text-xs leading-5 text-forest/65">{category.description}</p>
        </div>
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-forest text-white transition group-hover:translate-x-1"><Icon name="arrow" className="size-4" /></span>
      </div>
    </a>
  )
}

function RecipeArt({ category, compact = false }) {
  const tint = categoryDetails[category]?.tint || 'sage'
  return (
    <div className={`recipe-art tint-${tint} relative grid ${compact ? 'h-28' : 'h-36'} place-items-center overflow-hidden rounded-[1.2rem]`}>
      <div className="absolute -right-5 -top-9 size-24 rounded-full border border-forest/10" />
      <div className="absolute -bottom-10 -left-3 size-24 rounded-full border border-forest/10" />
      <div className="relative grid aspect-square h-[70%] place-items-center rounded-full border border-forest/10 bg-white/45 shadow-inner">
        <div className="grid aspect-square h-[75%] place-items-center rounded-full border-[5px] border-white/75 text-forest/70 shadow-sm">
          <Icon name="bowl" className={compact ? 'size-7' : 'size-9'} />
        </div>
      </div>
      <span className="absolute bottom-3 right-3 rounded-full bg-white/70 px-2.5 py-1 text-[0.58rem] font-bold uppercase tracking-[0.14em] text-forest/55">From the book</span>
    </div>
  )
}

function RecipeCard({ recipe }) {
  const category = { name: recipe.categoryName }
  return (
    <a href={`#/recipe/${recipe.id}`} className="group flex h-full flex-col rounded-[1.55rem] border border-forest/8 bg-white p-3.5 shadow-sm shadow-forest/[0.025] transition duration-300 hover:-translate-y-1 hover:border-forest/15 hover:shadow-xl hover:shadow-forest/10 sm:p-4">
      <RecipeArt category={recipe.category} compact />
      <div className="flex flex-1 flex-col px-1 pb-1 pt-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-[0.62rem] font-bold uppercase tracking-[0.16em] text-coral">{recipe.subcategory || category?.name || recipe.categoryName}</span>
          <span className="text-[0.68rem] text-forest/40">p. {recipe.sourcePage}</span>
        </div>
        <h3 className="font-serif text-[1.16rem] font-semibold leading-snug text-forest transition group-hover:text-coral">{recipe.title}</h3>
        <div className="mt-auto flex items-center justify-between pt-4 text-xs text-forest/50">
          <span className="flex items-center gap-1.5"><Icon name="book" className="size-3.5" /> In the collection</span>
          <span className="grid size-8 place-items-center rounded-full bg-cream text-forest transition group-hover:bg-forest group-hover:text-white"><Icon name="arrow" className="size-3.5" /></span>
        </div>
      </div>
    </a>
  )
}

function HomePage({ recipes, allCategories }) {
  const featured = useMemo(() => {
    const ids = ['warm-pizza-dip-from-good-housekeeping-jan-feb-2021-p-107', 'chicken-alfredo', 'easy-pumpkin-loaf', 'black-bean-soup']
    return ids.map((id) => recipes.find((recipe) => recipe.id === id)).filter(Boolean)
  }, [])

  return (
    <main>
      <section className="mx-auto grid max-w-7xl items-center gap-10 px-5 pb-14 pt-9 sm:px-8 sm:pb-20 sm:pt-14 lg:grid-cols-[1.02fr_.98fr] lg:gap-14 lg:px-12 lg:pb-24">
        <div className="relative z-10 max-w-2xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-forest/10 bg-white/70 px-3.5 py-2 text-xs font-semibold text-forest/65 shadow-sm">
            <Icon name="spark" className="size-4 text-coral" /> Recipes collected with love
          </div>
          <h1 className="font-serif text-[3.15rem] font-medium leading-[1.02] tracking-[-0.045em] text-forest sm:text-6xl lg:text-[4.45rem]">
            Good food brings <span className="italic text-coral">us</span> together.
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-forest/65 sm:text-lg sm:leading-8">
            A welcoming home for the GBoy recipe collection. Find an old favorite, choose something new, and make room for one more at the table.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a href="#/category/all" className="inline-flex items-center justify-center gap-3 rounded-full bg-forest px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-forest/15 transition hover:bg-forest-light">
              Browse all recipes <Icon name="arrow" className="size-4" />
            </a>
            <a href="#categories" className="rounded-full px-5 py-3.5 text-sm font-semibold text-forest/70 transition hover:bg-white">Explore categories</a>
          </div>
          <div className="mt-10 flex items-center gap-4 border-t border-forest/10 pt-6 sm:mt-12">
            <div className="flex -space-x-2" aria-hidden="true">
              <span className="grid size-9 place-items-center rounded-full border-2 border-cream bg-coral-pale text-sm">♡</span>
              <span className="grid size-9 place-items-center rounded-full border-2 border-cream bg-gold-pale text-sm">✿</span>
              <span className="grid size-9 place-items-center rounded-full border-2 border-cream bg-sage-pale text-sm">✦</span>
            </div>
            <p className="text-sm text-forest/55"><strong className="font-semibold text-forest">{recipes.length} recipes</strong> across {allCategories.length} cozy corners</p>
          </div>
        </div>
        <HeroArt />
      </section>

      <section id="categories" className="border-y border-forest/8 bg-white/50">
        <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-20 lg:px-12">
          <SectionHeading eyebrow="Find your kind of good" title="What sounds good today?" description="Browse by craving, course, or the kind of day you're having." />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {allCategories.map((category) => <CategoryCard key={category.id} category={category} />)}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-20 lg:px-12">
        <SectionHeading
          eyebrow="A few from the recipe box"
          title="Good places to start"
          description="A handful of favorites from across the collection."
          action={<a href="#/category/all" className="inline-flex items-center gap-2 text-sm font-semibold text-forest transition hover:text-coral">See every recipe <Icon name="arrow" className="size-4" /></a>}
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {featured.map((recipe) => <RecipeCard key={recipe.id} recipe={recipe} />)}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-16 sm:px-8 sm:pb-24 lg:px-12">
        <div className="relative overflow-hidden rounded-[2rem] bg-forest px-6 py-9 text-white sm:px-10 sm:py-12">
          <div className="absolute -right-12 -top-20 size-64 rounded-full border border-white/10" />
          <div className="absolute -right-2 -top-10 size-44 rounded-full border border-white/10" />
          <div className="relative flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
            <div>
              <p className="mb-2 text-[0.66rem] font-bold uppercase tracking-[0.2em] text-gold">A cookbook with history</p>
              <h2 className="max-w-xl font-serif text-3xl leading-tight sm:text-4xl">Every recipe has a place in the story.</h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-white/65">The original collection is still here, alongside a calmer way to browse it one recipe at a time.</p>
            </div>
            <span className="inline-flex w-fit shrink-0 items-center gap-3 rounded-full bg-white/10 px-5 py-3 text-sm font-semibold text-white/85 ring-1 ring-white/15"><Icon name="book" className="size-4" /> 273 pages, gathered over time</span>
          </div>
        </div>
      </section>
    </main>
  )
}

function Breadcrumbs({ children }) {
  return <nav aria-label="Breadcrumb" className="mb-7 flex flex-wrap items-center gap-2 text-xs font-medium text-forest/45"><a href="#/" className="transition hover:text-forest">Home</a><span>/</span>{children}</nav>
}

function CategoryPage({ categoryId, recipes, categoriesMap }) {
  const category = categoriesMap[categoryId]
  const [selectedSubcategory, setSelectedSubcategory] = useState('All')
  useEffect(() => setSelectedSubcategory('All'), [categoryId])

  const source = categoryId === 'all' ? recipes : category?.recipes || []
  const subcategories = [...new Set(source.map((recipe) => recipe.subcategory).filter(Boolean))]
  const visible = source.filter((recipe) => selectedSubcategory === 'All' || recipe.subcategory === selectedSubcategory)
    .sort((a, b) => a.title.localeCompare(b.title))

  const title = categoryId === 'all' ? 'All recipes' : category?.name || 'Recipe collection'
  const description = categoryId === 'all' ? 'Every recipe in one place. Pick a category or settle in and browse.' : category?.description

  return (
    <main className="mx-auto min-h-[70vh] max-w-7xl px-5 pb-20 pt-8 sm:px-8 sm:pt-12 lg:px-12">
      <Breadcrumbs><span className="text-forest">{title}</span></Breadcrumbs>
      <div className="mb-9 flex flex-col gap-6 border-b border-forest/10 pb-8 sm:flex-row sm:items-end sm:justify-between sm:pb-10">
        <div className="max-w-2xl">
          <p className="mb-2 text-[0.68rem] font-bold uppercase tracking-[0.21em] text-coral">The recipe collection</p>
          <h1 className="font-serif text-4xl font-semibold tracking-tight text-forest sm:text-5xl">{title}</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-forest/60 sm:text-base">{description}</p>
        </div>
        <div className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-forest/8">
          <span className="grid size-10 place-items-center rounded-xl bg-sage-pale text-forest"><Icon name="book" className="size-5" /></span>
          <div><p className="font-serif text-xl font-semibold text-forest">{visible.length}</p><p className="text-[0.62rem] font-bold uppercase tracking-[0.14em] text-forest/45">recipes to browse</p></div>
        </div>
      </div>
      {subcategories.length > 0 && (
        <div className="mb-7 flex flex-wrap gap-2" aria-label="Filter by subcategory">
          {['All', ...subcategories].map((subcategory) => (
            <button key={subcategory} onClick={() => setSelectedSubcategory(subcategory)} className={`rounded-full px-4 py-2 text-xs font-semibold transition ${selectedSubcategory === subcategory ? 'bg-forest text-white' : 'bg-white text-forest/65 ring-1 ring-forest/10 hover:ring-forest/25'}`}>
              {subcategory}
            </button>
          ))}
        </div>
      )}
      {visible.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{visible.map((recipe) => <RecipeCard key={recipe.id} recipe={recipe} />)}</div> : <p className="rounded-3xl bg-white p-8 text-center text-forest/60">No recipes in this collection yet.</p>}
    </main>
  )
}

function metaLabel(text) {
  return text.replace(/\s+/g, ' ').replace(/\s*-\s*/g, ' · ').replace(/\s+--\s+/g, ' · ')
}

function RecipePage({ recipe, categoriesMap }) {
  if (!recipe) return <NotFound />
  const category = categoriesMap[recipe.category]
  const meta = recipe.blocks.filter((block) => block.type === 'meta')
  const bodyBlocks = recipe.blocks.filter((block) => block.type !== 'meta')
  const ingredients = bodyBlocks.filter((block) => block.type === 'ingredient')
  const steps = bodyBlocks.filter((block) => block.type === 'step')
  const labels = bodyBlocks.filter((block) => block.type === 'label')
  const notes = bodyBlocks.filter((block) => block.type === 'note')
  const hasStructuredParts = ingredients.length > 0 || steps.length > 0

  return (
    <main className="mx-auto min-h-[70vh] max-w-7xl px-5 pb-20 pt-8 sm:px-8 sm:pt-12 lg:px-12">
      <Breadcrumbs><a href={`#/category/${recipe.category}`} className="transition hover:text-forest">{recipe.categoryName}</a><span>/</span><span className="max-w-[15rem] truncate text-forest">{recipe.title}</span></Breadcrumbs>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-12">
        <article>
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <a href={`#/category/${recipe.category}`} className={`category-pill tint-${category?.tint || 'sage'} rounded-full px-3.5 py-1.5 text-[0.67rem] font-bold uppercase tracking-[0.15em]`}>{recipe.categoryName}</a>
            {recipe.subcategory && <span className="rounded-full bg-white px-3.5 py-1.5 text-[0.67rem] font-semibold text-forest/55 ring-1 ring-forest/8">{recipe.subcategory}</span>}
          </div>
          <h1 className="max-w-4xl font-serif text-4xl font-semibold leading-[1.08] tracking-tight text-forest sm:text-5xl lg:text-[3.55rem]">{recipe.title}</h1>
          <p className="mt-4 flex items-center gap-2 text-sm text-forest/50"><Icon name="book" className="size-4" /> GBoy recipe collection <span className="text-forest/25">·</span> page {recipe.sourcePage}</p>
          {meta.length > 0 && <div className="mt-6 flex flex-wrap gap-2">{meta.map((item, index) => <span key={index} className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-semibold text-forest/70 ring-1 ring-forest/8"><Icon name="clock" className="size-3.5 text-coral" />{metaLabel(item.text)}</span>)}</div>}

          <div className="my-8 overflow-hidden rounded-[1.8rem]">
            <RecipeArt category={recipe.category} />
          </div>

          {hasStructuredParts ? (
            <div className="grid gap-5 md:grid-cols-[minmax(0,.82fr)_minmax(0,1.18fr)]">
              <section className="rounded-[1.65rem] bg-sage-pale/65 p-5 sm:p-6">
                <div className="mb-5 flex items-center justify-between">
                  <h2 className="font-serif text-2xl font-semibold text-forest">Ingredients</h2>
                  <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-forest/50">{ingredients.length} items</span>
                </div>
                <ul className="space-y-3.5">
                  {ingredients.map((block, index) => <li key={index} className="flex gap-3 text-sm leading-6 text-forest/75"><span className="mt-[0.52rem] size-1.5 shrink-0 rounded-full bg-coral" />{block.text}</li>)}
                </ul>
                {labels.length > 0 && <div className="mt-6 space-y-2 border-t border-forest/10 pt-4">{labels.map((block, index) => <p key={index} className="font-semibold text-forest">{block.text}</p>)}</div>}
              </section>
              <section className="rounded-[1.65rem] bg-white p-5 shadow-sm ring-1 ring-forest/8 sm:p-6">
                <h2 className="mb-5 font-serif text-2xl font-semibold text-forest">Let’s make it</h2>
                <div className="space-y-4">
                  {steps.map((block, index) => {
                    const numbered = block.text.match(/^(\d+)[.)]\s*(.*)$/)
                    return <div key={index} className="flex gap-3.5 text-sm leading-6 text-forest/70"><span className="grid size-7 shrink-0 place-items-center rounded-full bg-cream text-xs font-bold text-forest">{numbered?.[1] || index + 1}</span><p>{numbered?.[2] || block.text}</p></div>
                  })}
                  {notes.map((block, index) => <p key={`note-${index}`} className="text-sm leading-6 text-forest/65">{block.text}</p>)}
                </div>
                {!steps.length && <p className="text-sm leading-6 text-forest/60">The source has ingredient notes but no separate numbered directions for this recipe.</p>}
              </section>
            </div>
          ) : (
            <section className="rounded-[1.65rem] bg-white p-5 shadow-sm ring-1 ring-forest/8 sm:p-7">
              <h2 className="mb-4 font-serif text-2xl font-semibold text-forest">Recipe notes</h2>
              <div className="space-y-3 text-sm leading-7 text-forest/70">{bodyBlocks.map((block, index) => <p key={index}>{block.text}</p>)}</div>
            </section>
          )}

          {recipe.sourceText && (
            <details className="group mt-6 rounded-2xl border border-forest/10 bg-white/55 p-4 sm:p-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-forest marker:hidden">
                <span>See the source transcription</span><Icon name="chevron" className="size-4 transition group-open:rotate-180" />
              </summary>
              <pre className="mt-4 max-h-96 overflow-auto whitespace-pre-wrap border-t border-forest/10 pt-4 font-sans text-xs leading-6 text-forest/60">{recipe.sourceText}</pre>
            </details>
          )}
          <div className="mt-7 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-gold-pale/65 px-4 py-4 text-xs text-forest/60 sm:px-5">
            <span>From page {recipe.sourcePage} of the original collection</span>
            <span className="font-semibold text-forest/65">Original collection, page {recipe.sourcePage}</span>
          </div>
        </article>

        <aside className="lg:pt-1">
          <div className="sticky top-24 rounded-[1.7rem] border border-forest/8 bg-white p-5 shadow-sm sm:p-6">
            <p className="mb-4 text-[0.66rem] font-bold uppercase tracking-[0.18em] text-coral">Keep browsing</p>
            <h2 className="font-serif text-2xl font-semibold text-forest">More from {recipe.categoryName}</h2>
            <div className="mt-5 space-y-2">
              {(category?.recipes || []).filter((item) => item.id !== recipe.id).slice(0, 4).map((item) => (
                <a key={item.id} href={`#/recipe/${item.id}`} className="group flex items-center justify-between gap-3 rounded-xl px-3 py-3 transition hover:bg-cream">
                  <span className="line-clamp-2 font-serif text-[0.98rem] font-semibold leading-snug text-forest/80 group-hover:text-coral">{item.title}</span><Icon name="arrow" className="size-4 shrink-0 text-forest/40 transition group-hover:translate-x-1 group-hover:text-coral" />
                </a>
              ))}
            </div>
            <a href={`#/category/${recipe.category}`} className="mt-4 flex items-center justify-center gap-2 rounded-full bg-forest px-4 py-3 text-sm font-semibold text-white transition hover:bg-forest-light">View all in this category <Icon name="arrow" className="size-4" /></a>
          </div>
        </aside>
      </div>
    </main>
  )
}

function NotFound() {
  return <main className="mx-auto min-h-[65vh] max-w-2xl px-5 py-20 text-center"><span className="mx-auto mb-5 grid size-14 place-items-center rounded-2xl bg-gold-pale text-2xl">✦</span><h1 className="font-serif text-4xl font-semibold text-forest">That recipe wandered off.</h1><p className="mt-3 text-forest/60">Try the recipe collection and pick another dish.</p><a href="#/category/all" className="mt-7 inline-flex items-center gap-2 rounded-full bg-forest px-5 py-3 text-sm font-semibold text-white">Browse recipes <Icon name="arrow" className="size-4" /></a></main>
}

function Footer() {
  return (
    <footer className="border-t border-forest/10 bg-white/45">
      <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-7 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
        <Brand />
        <p className="text-xs leading-5 text-forest/45">A growing digital home for the recipes we return to.</p>
        <span className="text-xs font-semibold text-forest/50">Made for the middle of the table.</span>
      </div>
    </footer>
  )
}

export default function App() {
  const [route, setRoute] = useState(parseRoute)
  const [recipes, setRecipes] = useState([])
  const [loadError, setLoadError] = useState(false)
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}recipes.json`)
      .then((response) => {
        if (!response.ok) throw new Error('Recipe collection could not be loaded')
        return response.json()
      })
      .then(setRecipes)
      .catch(() => setLoadError(true))
  }, [])
  useEffect(() => {
    const update = () => {
      setRoute(parseRoute())
      window.scrollTo({ top: 0, behavior: 'instant' })
    }
    window.addEventListener('hashchange', update)
    return () => window.removeEventListener('hashchange', update)
  }, [])

  const allCategories = useMemo(() => categoryRecipes(recipes), [recipes])
  const categoriesMap = useMemo(() => Object.fromEntries(allCategories.map((category) => [category.id, category])), [allCategories])

  let content
  if (loadError) content = <main className="mx-auto min-h-[65vh] max-w-xl px-5 py-24 text-center"><h1 className="font-serif text-3xl font-semibold text-forest">The recipe box is taking a moment.</h1><p className="mt-3 text-sm text-forest/60">Refresh the page to load the collection.</p></main>
  else if (!recipes.length) content = <main className="mx-auto grid min-h-[65vh] max-w-xl place-items-center px-5 py-24 text-center"><div><span className="mx-auto mb-5 grid size-12 animate-pulse place-items-center rounded-2xl bg-sage-pale text-forest"><Icon name="bowl" className="size-6" /></span><p className="font-serif text-xl font-semibold text-forest">Opening the recipe box…</p></div></main>
  else if (route.page === 'home') content = <HomePage recipes={recipes} allCategories={allCategories} />
  else if (route.page === 'category') content = <CategoryPage categoryId={route.id} recipes={recipes} categoriesMap={categoriesMap} />
  else if (route.page === 'recipe') content = <RecipePage recipe={recipes.find((item) => item.id === route.id)} categoriesMap={categoriesMap} />
  else content = <NotFound />

  return <div className="min-h-screen bg-cream text-forest"><Header />{content}<Footer /></div>
}
