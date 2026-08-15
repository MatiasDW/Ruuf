# Frontend Reference From Provided Mocks

## Source reviewed

This document is based on the assets reviewed on **August 15, 2026**:

- visual system screenshot
- HTML for steps 1 and 2
- HTML for steps 3 and 4
- HTML for the final proposal screen

## What the mocks already define well

The material sent already gives a strong direction for the product.

### Visual language

- calm, premium, nature-oriented UI
- deep forest green as primary
- sage green as support color
- warm brown as tertiary accent
- soft neutral backgrounds
- rounded cards and large touch targets
- modern editorial hierarchy with Montserrat + Inter

### Product tone

- guided
- expert-backed
- aspirational but practical
- commercial without feeling aggressive

### Structural pattern

The UX direction is clearly a **multi-step wizard** with a strong visual result at the end:

1. Welcome / intro
2. Space definition
3. Preferences
4. Plant wishlist
5. Proposal / results

That is a good direction for this product.

## Recommended interpretation of each step

## Step 1: Welcome

### What works

- strong emotional hero image
- clear value proposition
- single CTA
- low friction entry

### What this screen should communicate

- this tool helps plan a yard quickly
- it uses expert logic, not only inspiration images
- it will recommend fit, compatibility, water use, and layout

### Frontend objective

Keep this screen light and confidence-building. It should not ask for data yet.

## Step 2: Space definition

### Current content in the mock

- yard width
- yard length
- sunlight
- city or comuna

### Good decision

This is the right amount of information for the beginning.

### What should be added

The current backend also benefits from:

- house footprint or built obstacle
- optional non-plantable areas

### Best UX implementation

Use two layers:

- simple numeric inputs
- visual mini canvas showing the lot and house block

The user should be able to either:

- type dimensions only
- or type dimensions and adjust a basic house block visually

### What not to ask here

- exact irrigation cost
- exact water provider tariff
- technical species information

## Step 3: Preferences

### Current content in the mock

- landscape style cards
- maintenance level
- low-water priority toggle

### This is strong

This is exactly the kind of abstraction the client can understand.

### Recommended additions

- budget range
- desired use of the yard
  - ornamental
  - family use
  - pets
  - shade
  - low maintenance

### Why

These preferences shape the proposal and help commercial follow-up later.

## Step 4: Wishlist

### Current content in the mock

- plant search
- category chips
- species wishlist

### What works

- category-first approach
- search by species
- easy sense of exploration

### What should improve

The product should support two types of users:

- users who know exact species
- users who only know intent

So the UI should allow:

- "I want trees"
- "I want flowers"
- "I want low-water plants"
- "I want shade"

not only exact species names

### Recommended interaction model

Each selected plant should show:

- quantity
- rough space needed
- water level
- visual tag for style match

## Final proposal screen

### Current content in the mock

- map of the plan
- summary metrics
- warnings/conflicts
- CTA to request commercial help
- download action

### This is the most important screen

The real product value is here.

### What we should definitely show

- visual layout of house, yard, and plants
- clear status
  - everything fits
  - partial fit
  - conflict detected
- water estimate
- cost estimate
- list of rejected plants
- reason for rejection
- one-click replacement or adjustment actions

### What the user should be able to do from here

- replace a conflicting species
- reduce quantity
- re-run plan
- ask for human help
- download summary

## Recommended design adjustments from a product perspective

## 1. The progress count in the mock should be aligned with the real flow

The HTML implies 4 steps, but the proposal screen behaves like a final fifth state.

Recommend thinking of it as:

1. Intro
2. Space
3. Preferences
4. Wishlist
5. Proposal

The proposal should not feel like just another form step. It is the payoff screen.

## 2. Avoid decorative UI that doesn not explain the system

The visuals are nice, but the result map must become meaningful, not just illustrative.

The frontend should use real backend placement data:

- `x`
- `y`
- `clearance_radius_m`
- `name`
- `water_need`

So the layout becomes operational, not only pretty.

## 3. Make conflict actions concrete

The mock already suggests:

- replace species
- relocate species

That is good. Those should become action buttons backed by planner logic.

## 4. Separate expert mode from simple mode

The main UI should stay simple.

If later needed, add an advanced panel for:

- more obstacles
- detailed environmental data
- more exact site editing

## 5. Keep pricing secondary until the plan is trusted

Cost matters, but only after the user believes the plan is valid.

So the visual hierarchy should be:

1. does the plan work
2. what fits and what conflicts
3. what it looks like
4. how much water and money it implies

## What the frontend team should use from backend

The backend can already provide or is structured to provide:

- plant catalog
- spacing radius
- structure clearance
- sunlight compatibility
- water need
- liters per week
- placed items
- unplaced items
- conflict reasons
- replacement suggestions
- irrigation estimate
- monthly cost estimate

That means the frontend can be designed around real states, not fake placeholders.

## Recommended screen architecture

### Desktop

- left panel for input flow
- right panel for preview and system feedback

### Mobile

- stacked wizard
- sticky primary action
- result screen with map first, conflicts second, summary third

## States the designer should include

The designer should not design only the happy path.

They should cover:

- empty state
- loading state
- everything fits
- partial fit
- nothing useful fits
- missing measurements
- unsupported sunlight combination
- high-water warning
- no exact species found

## Suggested design principle

This app should feel like:

- a planning assistant
- not a spreadsheet
- not a nursery ecommerce site
- not a landscape CAD tool

The right tone is:

- professional
- reassuring
- visual
- guided
- commercially useful

## Practical recommendation

If the designer has to choose where to spend the most effort, it should be on:

1. the result screen
2. the yard layout visualization
3. conflict explanation patterns
4. plant selection UX

Those four areas are where the product value becomes visible.
