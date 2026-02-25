# RiC-O Navigator (Static)

Standalone static RiC-O navigator app.

## Self-contained structure
- `data/RiC-O_1-1.rdf`: ontology source file (local)
- `scripts/generate-data.mjs`: parses local RDF and generates `public/rico-data.json`
- `src/App.vue`: client-side navigator that loads `public/rico-data.json`

No backend API is required.

## Run (inside `ric-navigator/`)
1. `npm install`
2. `npm run dev`

## Build (inside `ric-navigator/`)
1. `npm install`
2. `npm run build`

## Generate data manually
- Default local source: `npm run generate:data`
- Custom RDF path: `npm run generate:data -- ./path/to/ontology.rdf`

## Move to another repo
Copy the entire `ric-navigator` folder as-is and run the commands above from inside it.
