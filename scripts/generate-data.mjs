import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';

import rdf from 'rdf-ext';
import { rdfParser } from 'rdf-parse';

const inputArg = process.argv[2]?.trim();
const inputPath = inputArg
  ? path.resolve(process.cwd(), inputArg)
  : path.resolve(process.cwd(), 'data', 'RiC-O_1-1.rdf');
const outputPath = path.resolve(process.cwd(), 'public', 'rico-data.json');

if (!fs.existsSync(inputPath)) {
  console.error(`[ric-navigator] Input RDF file not found: ${inputPath}`);
  process.exit(1);
}

const NS = {
  rdfType: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
  rdfsLabel: 'http://www.w3.org/2000/01/rdf-schema#label',
  rdfsComment: 'http://www.w3.org/2000/01/rdf-schema#comment',
  rdfsSubClassOf: 'http://www.w3.org/2000/01/rdf-schema#subClassOf',
  rdfsSubPropertyOf: 'http://www.w3.org/2000/01/rdf-schema#subPropertyOf',
  rdfsDomain: 'http://www.w3.org/2000/01/rdf-schema#domain',
  rdfsRange: 'http://www.w3.org/2000/01/rdf-schema#range',
  skosScopeNote: 'http://www.w3.org/2004/02/skos/core#scopeNote',
  skosPrefLabel: 'http://www.w3.org/2004/02/skos/core#prefLabel',
  owlClass: 'http://www.w3.org/2002/07/owl#Class',
  owlObjectProperty: 'http://www.w3.org/2002/07/owl#ObjectProperty',
  owlDatatypeProperty: 'http://www.w3.org/2002/07/owl#DatatypeProperty',
  ricoThing: 'https://www.ica.org/standards/RiC/ontology#Thing'
};

const localName = (iri) => {
  const hash = iri.lastIndexOf('#');
  if (hash >= 0 && hash < iri.length - 1) return iri.slice(hash + 1);
  const slash = iri.lastIndexOf('/');
  if (slash >= 0 && slash < iri.length - 1) return iri.slice(slash + 1);
  return iri;
};

const isNamedHttpIri = (term) => term?.termType === 'NamedNode' && /^https?:\/\//i.test(term.value);

const isEnglishOrNoLangLiteral = (term) => {
  if (!term || term.termType !== 'Literal') return false;
  const lang = (term.language || '').toLowerCase();
  return !lang || lang === 'en' || lang.startsWith('en-');
};

const pushUnique = (arr, value) => {
  if (!value || arr.includes(value)) return;
  arr.push(value);
};

const ensureClass = (classes, iri) => {
  if (classes.has(iri)) return classes.get(iri);
  const value = {
    iri,
    labels: [],
    scopeNotes: [],
    comments: [],
    ricCmNotes: [],
    superclasses: new Set(),
    namedIndividuals: []
  };
  classes.set(iri, value);
  return value;
};

const parseDataset = (dataset) => {
  const classIris = new Set();
  const propertyKinds = new Map();

  for (const quad of dataset) {
    if (!isNamedHttpIri(quad.subject)) continue;

    if (quad.predicate.value === NS.rdfType && isNamedHttpIri(quad.object)) {
      if (quad.object.value === NS.owlClass) {
        classIris.add(quad.subject.value);
      } else if (quad.object.value === NS.owlObjectProperty) {
        propertyKinds.set(quad.subject.value, 'object');
      } else if (quad.object.value === NS.owlDatatypeProperty) {
        propertyKinds.set(quad.subject.value, 'data');
      }
    }

    if (quad.predicate.value === NS.rdfsSubClassOf) {
      classIris.add(quad.subject.value);
    }
  }

  const classes = new Map();
  for (const iri of classIris) {
    const cls = ensureClass(classes, iri);
    const subject = rdf.namedNode(iri);

    for (const quad of dataset.match(subject, rdf.namedNode(NS.rdfsLabel), null)) {
      if (isEnglishOrNoLangLiteral(quad.object)) pushUnique(cls.labels, quad.object.value.trim());
    }
    for (const quad of dataset.match(subject, rdf.namedNode(NS.skosScopeNote), null)) {
      if (isEnglishOrNoLangLiteral(quad.object)) pushUnique(cls.scopeNotes, quad.object.value.trim());
    }
    for (const quad of dataset.match(subject, rdf.namedNode(NS.rdfsComment), null)) {
      if (isEnglishOrNoLangLiteral(quad.object)) pushUnique(cls.comments, quad.object.value.trim());
    }
    for (const quad of dataset.match(subject, rdf.namedNode(NS.rdfsSubClassOf), null)) {
      if (isNamedHttpIri(quad.object)) cls.superclasses.add(quad.object.value);
    }

    for (const quad of dataset.match(subject, null, null)) {
      if (!isEnglishOrNoLangLiteral(quad.object)) continue;
      if (quad.predicate.value.endsWith('RiCCMCorrespondingComponent')) {
        pushUnique(cls.ricCmNotes, quad.object.value.trim());
      }
    }
  }

  const rootIri = NS.ricoThing;
  ensureClass(classes, rootIri);

  const classIriSet = new Set(classes.keys());
  for (const cls of classes.values()) {
    const filteredParents = [...cls.superclasses].filter((parentIri) => classIriSet.has(parentIri) && parentIri !== cls.iri);
    cls.superclasses = new Set(filteredParents);

    if (cls.iri !== rootIri && cls.superclasses.size === 0) {
      cls.superclasses.add(rootIri);
    }
  }

  if (classes.has(rootIri)) {
    classes.get(rootIri).superclasses = new Set();
  }

  const individualsByClass = new Map();
  const individualIris = new Set();

  for (const quad of dataset) {
    if (quad.predicate.value !== NS.rdfType) continue;
    if (!isNamedHttpIri(quad.subject) || !isNamedHttpIri(quad.object)) continue;
    if (!classIriSet.has(quad.object.value)) continue;

    const individualIri = quad.subject.value;
    if (classIriSet.has(individualIri) || propertyKinds.has(individualIri)) continue;

    individualIris.add(individualIri);
    const classSet = individualsByClass.get(quad.object.value) ?? new Set();
    classSet.add(individualIri);
    individualsByClass.set(quad.object.value, classSet);
  }

  const individualLabelByIri = new Map();
  for (const individualIri of individualIris) {
    const subject = rdf.namedNode(individualIri);
    let label = '';
    for (const quad of dataset.match(subject, rdf.namedNode(NS.rdfsLabel), null)) {
      if (isEnglishOrNoLangLiteral(quad.object)) {
        label = quad.object.value.trim();
        if (label) break;
      }
    }
    if (!label) {
      for (const quad of dataset.match(subject, rdf.namedNode(NS.skosPrefLabel), null)) {
        if (isEnglishOrNoLangLiteral(quad.object)) {
          label = quad.object.value.trim();
          if (label) break;
        }
      }
    }
    individualLabelByIri.set(individualIri, label || localName(individualIri));
  }

  for (const [classIri, individualSet] of individualsByClass.entries()) {
    const cls = classes.get(classIri);
    if (!cls) continue;
    cls.namedIndividuals = [...individualSet]
      .map((individualIri) => ({
        iri: individualIri,
        label: individualLabelByIri.get(individualIri) || localName(individualIri)
      }))
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
  }

  const properties = [];
  for (const [iri, kind] of propertyKinds.entries()) {
    const subject = rdf.namedNode(iri);
    const labels = [];
    const comments = [];
    const domains = new Set();
    const ranges = new Set();
    const superproperties = new Set();

    for (const quad of dataset.match(subject, rdf.namedNode(NS.rdfsLabel), null)) {
      if (isEnglishOrNoLangLiteral(quad.object)) pushUnique(labels, quad.object.value.trim());
    }
    for (const quad of dataset.match(subject, rdf.namedNode(NS.rdfsComment), null)) {
      if (isEnglishOrNoLangLiteral(quad.object)) pushUnique(comments, quad.object.value.trim());
    }
    for (const quad of dataset.match(subject, rdf.namedNode(NS.rdfsDomain), null)) {
      if (isNamedHttpIri(quad.object)) domains.add(quad.object.value);
    }
    for (const quad of dataset.match(subject, rdf.namedNode(NS.rdfsRange), null)) {
      if (isNamedHttpIri(quad.object)) ranges.add(quad.object.value);
    }
    for (const quad of dataset.match(subject, rdf.namedNode(NS.rdfsSubPropertyOf), null)) {
      if (isNamedHttpIri(quad.object)) superproperties.add(quad.object.value);
    }

    properties.push({
      iri,
      label: labels[0] || localName(iri),
      description: comments[0] || '',
      comments,
      kind,
      domains: [...domains],
      ranges: [...ranges],
      superproperties: [...superproperties]
    });
  }

  const classesOut = [...classes.values()]
    .map((cls) => ({
      iri: cls.iri,
      label: cls.labels[0] || localName(cls.iri),
      scopeNotes: cls.scopeNotes,
      comments: cls.comments,
      ricCmNotes: cls.ricCmNotes,
      superclasses: [...cls.superclasses],
      namedIndividuals: cls.namedIndividuals
    }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));

  const subpropertiesBySuperproperty = new Map();
  for (const prop of properties) {
    for (const parent of prop.superproperties) {
      const set = subpropertiesBySuperproperty.get(parent) ?? new Set();
      set.add(prop.iri);
      subpropertiesBySuperproperty.set(parent, set);
    }
  }

  const propertiesOut = properties
    .map((prop) => ({
      ...prop,
      subproperties: [...(subpropertiesBySuperproperty.get(prop.iri) ?? new Set())]
    }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));

  return { classes: classesOut, properties: propertiesOut };
};

const parseRdfXmlToDataset = async (xml, baseIRI) => {
  const textStream = Readable.from([xml]);
  const quadStream = rdfParser.parse(textStream, {
    contentType: 'application/rdf+xml',
    baseIRI
  });
  return rdf.dataset().import(quadStream);
};

const main = async () => {
  const xml = fs.readFileSync(inputPath, 'utf8');
  const dataset = await parseRdfXmlToDataset(xml, `file://${inputPath}`);
  const data = parseDataset(dataset);

  const payload = {
    generatedAt: new Date().toISOString(),
    sourceFile: path.relative(process.cwd(), inputPath),
    classes: data.classes,
    properties: data.properties
  };

  fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`[ric-navigator] Generated ${outputPath}`);
  console.log(`[ric-navigator] Source: ${inputPath}`);
  console.log(`[ric-navigator] Classes: ${payload.classes.length}, Properties: ${payload.properties.length}`);
};

main().catch((err) => {
  console.error('[ric-navigator] Failed to generate data:', err instanceof Error ? err.message : err);
  process.exit(1);
});
