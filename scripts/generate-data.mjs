import fs from 'node:fs';
import path from 'node:path';

const inputArg = process.argv[2]?.trim();
const inputPath = inputArg
  ? path.resolve(process.cwd(), inputArg)
  : path.resolve(process.cwd(), 'data', 'RiC-O_1-1.rdf');
const outputPath = path.resolve(process.cwd(), 'public', 'rico-data.json');

if (!fs.existsSync(inputPath)) {
  console.error(`[ric-navigator] Input RDF file not found: ${inputPath}`);
  process.exit(1);
}

const decodeXml = (value) =>
  value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();

const stripTags = (value) => decodeXml(value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());

const attrValue = (tag, attrName) => {
  const regex = new RegExp(`${attrName}\\s*=\\s*"([^"]+)"`, 'i');
  return regex.exec(tag)?.[1] ?? '';
};

const localName = (iri) => {
  const hash = iri.lastIndexOf('#');
  if (hash >= 0 && hash < iri.length - 1) return iri.slice(hash + 1);
  const slash = iri.lastIndexOf('/');
  if (slash >= 0 && slash < iri.length - 1) return iri.slice(slash + 1);
  return iri;
};

const extractEnglishTagValues = (block, tagName) => {
  const out = [];
  const regex = new RegExp(`<${tagName}\\b([^>]*)>([\\s\\S]*?)<\\/${tagName}>`, 'gi');
  let match = regex.exec(block);
  while (match) {
    const attrs = match[1] ?? '';
    const lang = attrValue(attrs, 'xml:lang').toLowerCase();
    if (lang && lang !== 'en' && !lang.startsWith('en-')) {
      match = regex.exec(block);
      continue;
    }
    const text = stripTags(match[2] ?? '');
    if (text) out.push(text);
    match = regex.exec(block);
  }
  return out;
};

const extractEnglishRiCmValues = (block) => {
  const out = [];
  const regex = /<(?:[a-zA-Z0-9_-]+:)?RiCCMCorrespondingComponent\b([^>]*)>([\s\S]*?)<\/(?:[a-zA-Z0-9_-]+:)?RiCCMCorrespondingComponent>/gi;
  let match = regex.exec(block);
  while (match) {
    const attrs = match[1] ?? '';
    const lang = attrValue(attrs, 'xml:lang').toLowerCase();
    if (lang && lang !== 'en' && !lang.startsWith('en-')) {
      match = regex.exec(block);
      continue;
    }
    const text = stripTags(match[2] ?? '');
    if (text) out.push(text);
    match = regex.exec(block);
  }
  return out;
};

const extractResourceRefs = (block, tagName) => {
  const out = new Set();

  const direct = new RegExp(`<${tagName}\\b[^>]*rdf:resource="([^"]+)"[^>]*/?>`, 'gi');
  let match = direct.exec(block);
  while (match) {
    const iri = (match[1] ?? '').trim();
    if (iri && /^https?:\/\//i.test(iri)) out.add(iri);
    match = direct.exec(block);
  }

  const nested = new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'gi');
  match = nested.exec(block);
  while (match) {
    const nestedBlock = match[1] ?? '';
    const nestedRefRegex = /rdf:(?:resource|about)="([^"]+)"/gi;
    let nestedMatch = nestedRefRegex.exec(nestedBlock);
    while (nestedMatch) {
      const iri = (nestedMatch[1] ?? '').trim();
      if (iri && /^https?:\/\//i.test(iri)) out.add(iri);
      nestedMatch = nestedRefRegex.exec(nestedBlock);
    }
    match = nested.exec(block);
  }

  return out;
};

const ensureClass = (classes, iri) => {
  if (classes.has(iri)) return classes.get(iri);
  const value = {
    iri,
    labels: [],
    scopeNotes: [],
    comments: [],
    ricCmNotes: [],
    superclasses: new Set()
  };
  classes.set(iri, value);
  return value;
};

const parse = (xml) => {
  const classes = new Map();
  const properties = [];

  const classRegex = /<owl:Class\b[\s\S]*?<\/owl:Class>/gi;
  let classMatch = classRegex.exec(xml);
  while (classMatch) {
    const block = classMatch[0] ?? '';
    const opening = /^<owl:Class\b([^>]*)>/i.exec(block)?.[0] ?? '';
    const iri = attrValue(opening, 'rdf:about').trim();
    if (iri && /^https?:\/\//i.test(iri)) {
      const cls = ensureClass(classes, iri);
      for (const label of extractEnglishTagValues(block, 'rdfs:label')) if (!cls.labels.includes(label)) cls.labels.push(label);
      for (const note of extractEnglishTagValues(block, 'skos:scopeNote')) if (!cls.scopeNotes.includes(note)) cls.scopeNotes.push(note);
      for (const comment of extractEnglishTagValues(block, 'rdfs:comment')) if (!cls.comments.includes(comment)) cls.comments.push(comment);
      for (const note of extractEnglishRiCmValues(block)) if (!cls.ricCmNotes.includes(note)) cls.ricCmNotes.push(note);
      for (const superIri of extractResourceRefs(block, 'rdfs:subClassOf')) cls.superclasses.add(superIri);
    }
    classMatch = classRegex.exec(xml);
  }

  const rdfDescRegex = /<rdf:Description\b[\s\S]*?<\/rdf:Description>/gi;
  let descMatch = rdfDescRegex.exec(xml);
  while (descMatch) {
    const block = descMatch[0] ?? '';
    const opening = /^<rdf:Description\b([^>]*)>/i.exec(block)?.[0] ?? '';
    const iri = attrValue(opening, 'rdf:about').trim();
    if (iri && /^https?:\/\//i.test(iri)) {
      const superclasses = extractResourceRefs(block, 'rdfs:subClassOf');
      if (superclasses.size) {
        const cls = ensureClass(classes, iri);
        for (const parent of superclasses) cls.superclasses.add(parent);
      }
    }
    descMatch = rdfDescRegex.exec(xml);
  }

  const parsePropertyBlocks = (tagName, kind) => {
    const regex = new RegExp(`<${tagName}\\b[\\s\\S]*?<\\/${tagName}>`, 'gi');
    let match = regex.exec(xml);
    while (match) {
      const block = match[0] ?? '';
      const opening = new RegExp(`^<${tagName}\\b([^>]*)>`, 'i').exec(block)?.[0] ?? '';
      const iri = attrValue(opening, 'rdf:about').trim();
      if (iri && /^https?:\/\//i.test(iri)) {
        const labels = extractEnglishTagValues(block, 'rdfs:label');
        const comments = extractEnglishTagValues(block, 'rdfs:comment');
        properties.push({
          iri,
          label: labels[0] || localName(iri),
          description: comments[0] || '',
          comments,
          kind,
          domains: [...extractResourceRefs(block, 'rdfs:domain')],
          ranges: [...extractResourceRefs(block, 'rdfs:range')],
          superproperties: [...extractResourceRefs(block, 'rdfs:subPropertyOf')]
        });
      }
      match = regex.exec(xml);
    }
  };

  parsePropertyBlocks('owl:ObjectProperty', 'object');
  parsePropertyBlocks('owl:DatatypeProperty', 'data');

  const classesOut = [...classes.values()]
    .map((cls) => ({
      iri: cls.iri,
      label: cls.labels[0] || localName(cls.iri),
      scopeNotes: cls.scopeNotes,
      comments: cls.comments,
      ricCmNotes: cls.ricCmNotes,
      superclasses: [...cls.superclasses]
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

const xml = fs.readFileSync(inputPath, 'utf8');
const data = parse(xml);

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
