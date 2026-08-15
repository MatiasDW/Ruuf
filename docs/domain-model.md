# Domain Model

## Core entities

### Plant

A plant record currently stores:

- species identity
- category
- spacing radius
- distance from structures
- supported sun exposure
- water need level
- estimated liters per week
- style tags

Later this should expand to include:

- region suitability in Chile
- soil preference
- mature canopy diameter
- root aggressiveness
- maintenance difficulty
- unit cost
- irrigation emitter type

### Site

The current site model supports:

- yard width
- yard height
- sun exposure
- style preference
- rectangular obstacles

Later this should support polygons, slope, orientation, shaded zones, soil zones, and hardscape classes.

### Plan result

The planner returns:

- placements
- unplaced requests
- irrigation estimate
- summary stats

This is enough for an MVP quote and layout discussion, but not enough for a final contractor handoff yet.
