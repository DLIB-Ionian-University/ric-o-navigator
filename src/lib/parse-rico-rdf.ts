import { QueryEngine } from '@comunica/query-sparql';
import { rdfParser } from 'rdf-parse';
import { Store } from 'n3';
import { Readable } from 'readable-stream';

export type NavigatorNamedIndividual = {
  iri: string;
  label: string;
};

export type NavigatorPropertyRestriction = {
  classIri: string;
  restrictionType: string;
  cardinality: string;
  onClassIri: string;
};

export type NavigatorClass = {
  iri: string;
  label: string;
  scopeNotes: string[];
  comments: string[];
  ricCmNotes: string[];
  superclasses: string[];
  namedIndividuals: NavigatorNamedIndividual[];
};

export type NavigatorProperty = {
  iri: string;
  label: string;
  description: string;
  comments: string[];
  kind: 'object' | 'data' | 'other';
  domains: string[];
  ranges: string[];
  superproperties: string[];
  subproperties: string[];
  restrictions: NavigatorPropertyRestriction[];
};

export type NavigatorData = {
  generatedAt: string;
  sourceFile: string;
  classes: NavigatorClass[];
  properties: NavigatorProperty[];
};

const RICO_THING_IRI = 'https://www.ica.org/standards/RiC/ontology#Thing';

const PREFIXES = `
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX owl: <http://www.w3.org/2002/07/owl#>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
`;

const localName = (iri: string) => {
  const hash = iri.lastIndexOf('#');
  if (hash >= 0 && hash < iri.length - 1) return iri.slice(hash + 1);
  const slash = iri.lastIndexOf('/');
  if (slash >= 0 && slash < iri.length - 1) return iri.slice(slash + 1);
  return iri;
};

const sortByLabel = <T extends { label: string }>(rows: T[]) =>
  [...rows].sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));

const pushUnique = (arr: string[], value: string) => {
  if (!value || arr.includes(value)) return;
  arr.push(value);
};

const addToSetMap = (map: Map<string, Set<string>>, key: string, value: string) => {
  if (!key || !value) return;
  const set = map.get(key) ?? new Set<string>();
  set.add(value);
  map.set(key, set);
};

const termValue = (binding: unknown) => {
  const term = binding as { value?: string } | undefined;
  return term?.value ?? '';
};

const bindingValue = (binding: { get: (key: string) => unknown }, key: string) => termValue(binding.get(key));

const parseRdfXmlToStore = async (xml: string, baseIRI: string) => {
  const store = new Store();
  const input = Readable.from([xml]);
  const quads = rdfParser.parse(input, {
    contentType: 'application/rdf+xml',
    baseIRI
  });

  await new Promise<void>((resolve, reject) => {
    quads.on('data', (quad) => store.addQuad(quad));
    quads.on('error', reject);
    quads.on('end', resolve);
  });

  return store;
};

const queryRows = async (engine: QueryEngine, store: Store, query: string) => {
  const bindings = await engine.queryBindings(query, { sources: [store] });
  return bindings.toArray();
};

export const parseRicoRdfXml = async (xml: string, sourceFile = 'data/RiC-O_1-1.rdf'): Promise<NavigatorData> => {
  const store = await parseRdfXmlToStore(xml, sourceFile);
  const engine = new QueryEngine();

  const classRows = await queryRows(
    engine,
    store,
    `${PREFIXES}
    SELECT ?class ?label ?scopeNote ?comment ?ricCmNote ?superclass WHERE {
      {
        ?class a owl:Class .
      }
      UNION
      {
        ?class rdfs:subClassOf ?anySuperclass .
      }
      FILTER(isIRI(?class))
      OPTIONAL {
        ?class rdfs:label ?label .
        FILTER(LANG(?label) = "" || LANGMATCHES(LANG(?label), "en"))
      }
      OPTIONAL {
        ?class skos:scopeNote ?scopeNote .
        FILTER(LANG(?scopeNote) = "" || LANGMATCHES(LANG(?scopeNote), "en"))
      }
      OPTIONAL {
        ?class rdfs:comment ?comment .
        FILTER(LANG(?comment) = "" || LANGMATCHES(LANG(?comment), "en"))
      }
      OPTIONAL {
        ?class ?ricCmPredicate ?ricCmNote .
        FILTER(STRENDS(STR(?ricCmPredicate), "RiCCMCorrespondingComponent"))
        FILTER(LANG(?ricCmNote) = "" || LANGMATCHES(LANG(?ricCmNote), "en"))
      }
      OPTIONAL {
        ?class rdfs:subClassOf ?superclass .
        FILTER(isIRI(?superclass))
      }
    }`
  );

  const classes = new Map<
    string,
    {
      iri: string;
      labels: string[];
      scopeNotes: string[];
      comments: string[];
      ricCmNotes: string[];
      superclasses: Set<string>;
      namedIndividuals: NavigatorNamedIndividual[];
    }
  >();

  const ensureClass = (iri: string) => {
    const existing = classes.get(iri);
    if (existing) return existing;
    const created = {
      iri,
      labels: [],
      scopeNotes: [],
      comments: [],
      ricCmNotes: [],
      superclasses: new Set<string>(),
      namedIndividuals: [] as NavigatorNamedIndividual[]
    };
    classes.set(iri, created);
    return created;
  };

  for (const row of classRows) {
    const classIri = bindingValue(row, 'class');
    if (!classIri) continue;
    const cls = ensureClass(classIri);
    pushUnique(cls.labels, bindingValue(row, 'label'));
    pushUnique(cls.scopeNotes, bindingValue(row, 'scopeNote'));
    pushUnique(cls.comments, bindingValue(row, 'comment'));
    pushUnique(cls.ricCmNotes, bindingValue(row, 'ricCmNote'));
    const superclass = bindingValue(row, 'superclass');
    if (superclass) cls.superclasses.add(superclass);
  }

  ensureClass(RICO_THING_IRI);

  const classIriSet = new Set(classes.keys());
  for (const cls of classes.values()) {
    const validParents = [...cls.superclasses].filter((parentIri) => classIriSet.has(parentIri) && parentIri !== cls.iri);
    cls.superclasses = new Set(validParents);
    if (cls.iri !== RICO_THING_IRI && cls.superclasses.size === 0) cls.superclasses.add(RICO_THING_IRI);
  }
  classes.get(RICO_THING_IRI)!.superclasses = new Set();

  const propertyRows = await queryRows(
    engine,
    store,
    `${PREFIXES}
    SELECT ?property ?kind ?label ?comment ?domain ?range ?superproperty WHERE {
      {
        ?property a owl:ObjectProperty .
        BIND("object" AS ?kind)
      }
      UNION
      {
        ?property a owl:DatatypeProperty .
        BIND("data" AS ?kind)
      }
      OPTIONAL {
        ?property rdfs:label ?label .
        FILTER(LANG(?label) = "" || LANGMATCHES(LANG(?label), "en"))
      }
      OPTIONAL {
        ?property rdfs:comment ?comment .
        FILTER(LANG(?comment) = "" || LANGMATCHES(LANG(?comment), "en"))
      }
      OPTIONAL {
        {
          ?property rdfs:domain ?domain .
          FILTER(isIRI(?domain))
        }
        UNION
        {
          ?property rdfs:domain ?domainValue .
          ?domainValue owl:unionOf/rdf:rest*/rdf:first ?domain .
          FILTER(isIRI(?domain))
        }
      }
      OPTIONAL {
        {
          ?property rdfs:range ?range .
          FILTER(isIRI(?range))
        }
        UNION
        {
          ?property rdfs:range ?rangeValue .
          ?rangeValue owl:unionOf/rdf:rest*/rdf:first ?range .
          FILTER(isIRI(?range))
        }
      }
      OPTIONAL {
        ?property rdfs:subPropertyOf ?superproperty .
        FILTER(isIRI(?superproperty))
      }
    }`
  );

  const propertyKinds = new Map<string, 'object' | 'data'>();
  const propertyLabels = new Map<string, string[]>();
  const propertyComments = new Map<string, string[]>();
  const propertyDomains = new Map<string, Set<string>>();
  const propertyRanges = new Map<string, Set<string>>();
  const propertySuperproperties = new Map<string, Set<string>>();
  const propertyRestrictions = new Map<string, NavigatorPropertyRestriction[]>();

  for (const row of propertyRows) {
    const propertyIri = bindingValue(row, 'property');
    const kind = bindingValue(row, 'kind');
    if (!propertyIri || (kind !== 'object' && kind !== 'data')) continue;
    propertyKinds.set(propertyIri, kind);

    const labels = propertyLabels.get(propertyIri) ?? [];
    pushUnique(labels, bindingValue(row, 'label'));
    propertyLabels.set(propertyIri, labels);

    const comments = propertyComments.get(propertyIri) ?? [];
    pushUnique(comments, bindingValue(row, 'comment'));
    propertyComments.set(propertyIri, comments);

    addToSetMap(propertyDomains, propertyIri, bindingValue(row, 'domain'));
    addToSetMap(propertyRanges, propertyIri, bindingValue(row, 'range'));
    addToSetMap(propertySuperproperties, propertyIri, bindingValue(row, 'superproperty'));
  }

  const restrictionRows = await queryRows(
    engine,
    store,
    `${PREFIXES}
    SELECT ?class ?property ?restrictionType ?cardinality ?onClass WHERE {
      ?class rdfs:subClassOf ?restriction .
      FILTER(isIRI(?class))
      ?restriction owl:onProperty ?property .
      FILTER(isIRI(?property))
      OPTIONAL {
        ?restriction owl:onClass ?onClass .
        FILTER(isIRI(?onClass))
      }
      {
        ?restriction owl:minQualifiedCardinality ?cardinality .
        BIND("minimum qualified cardinality" AS ?restrictionType)
      }
      UNION
      {
        ?restriction owl:qualifiedCardinality ?cardinality .
        BIND("qualified cardinality" AS ?restrictionType)
      }
      UNION
      {
        ?restriction owl:maxQualifiedCardinality ?cardinality .
        BIND("maximum qualified cardinality" AS ?restrictionType)
      }
      UNION
      {
        ?restriction owl:minCardinality ?cardinality .
        BIND("minimum cardinality" AS ?restrictionType)
      }
      UNION
      {
        ?restriction owl:cardinality ?cardinality .
        BIND("cardinality" AS ?restrictionType)
      }
      UNION
      {
        ?restriction owl:maxCardinality ?cardinality .
        BIND("maximum cardinality" AS ?restrictionType)
      }
    }`
  );

  for (const row of restrictionRows) {
    const propertyIri = bindingValue(row, 'property');
    const classIri = bindingValue(row, 'class');
    if (!propertyIri || !classIri || !propertyKinds.has(propertyIri)) continue;

    const restrictions = propertyRestrictions.get(propertyIri) ?? [];
    const restriction = {
      classIri,
      restrictionType: bindingValue(row, 'restrictionType'),
      cardinality: bindingValue(row, 'cardinality'),
      onClassIri: bindingValue(row, 'onClass')
    };
    const key = `${restriction.classIri}|${restriction.restrictionType}|${restriction.cardinality}|${restriction.onClassIri}`;
    if (!restrictions.some((item) => `${item.classIri}|${item.restrictionType}|${item.cardinality}|${item.onClassIri}` === key)) {
      restrictions.push(restriction);
    }
    propertyRestrictions.set(propertyIri, restrictions);
  }

  const individualRows = await queryRows(
    engine,
    store,
    `${PREFIXES}
    SELECT ?individual ?class ?label ?prefLabel WHERE {
      ?individual a ?class .
      FILTER(isIRI(?individual))
      FILTER(isIRI(?class))
      OPTIONAL {
        ?individual rdfs:label ?label .
        FILTER(LANG(?label) = "" || LANGMATCHES(LANG(?label), "en"))
      }
      OPTIONAL {
        ?individual skos:prefLabel ?prefLabel .
        FILTER(LANG(?prefLabel) = "" || LANGMATCHES(LANG(?prefLabel), "en"))
      }
    }`
  );

  const individualsByClass = new Map<string, Map<string, NavigatorNamedIndividual>>();
  for (const row of individualRows) {
    const individualIri = bindingValue(row, 'individual');
    const classIri = bindingValue(row, 'class');
    if (!individualIri || !classIriSet.has(classIri)) continue;
    if (classIriSet.has(individualIri) || propertyKinds.has(individualIri)) continue;

    const label = bindingValue(row, 'label') || bindingValue(row, 'prefLabel') || localName(individualIri);
    const individualMap = individualsByClass.get(classIri) ?? new Map<string, NavigatorNamedIndividual>();
    individualMap.set(individualIri, { iri: individualIri, label });
    individualsByClass.set(classIri, individualMap);
  }

  for (const [classIri, individualMap] of individualsByClass.entries()) {
    const cls = classes.get(classIri);
    if (!cls) continue;
    cls.namedIndividuals = sortByLabel([...individualMap.values()]);
  }

  const subpropertiesBySuperproperty = new Map<string, Set<string>>();
  for (const [propertyIri, superproperties] of propertySuperproperties.entries()) {
    for (const parentIri of superproperties) {
      addToSetMap(subpropertiesBySuperproperty, parentIri, propertyIri);
    }
  }

  const classesOut: NavigatorClass[] = [...classes.values()]
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

  const propertiesOut: NavigatorProperty[] = [...propertyKinds.entries()]
    .map(([iri, kind]) => {
      const comments = propertyComments.get(iri) ?? [];
      const labels = propertyLabels.get(iri) ?? [];
      return {
        iri,
        label: labels[0] || localName(iri),
        description: comments[0] || '',
        comments,
        kind,
        domains: [...(propertyDomains.get(iri) ?? new Set())],
        ranges: [...(propertyRanges.get(iri) ?? new Set())],
        superproperties: [...(propertySuperproperties.get(iri) ?? new Set())],
        subproperties: [...(subpropertiesBySuperproperty.get(iri) ?? new Set())],
        restrictions: propertyRestrictions.get(iri) ?? []
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));

  return {
    generatedAt: new Date().toISOString(),
    sourceFile,
    classes: classesOut,
    properties: propertiesOut
  };
};
