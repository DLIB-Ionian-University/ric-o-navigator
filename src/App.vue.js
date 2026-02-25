import { computed, onMounted, ref } from 'vue';
import RicoClassTreeNode from './components/RicoClassTreeNode.vue';
const activeTab = ref('classes');
const activeDetailsKind = ref('');
const classSearchText = ref('');
const classIsSearching = ref(false);
const classHasSearched = ref(false);
const classSearchError = ref('');
const classDetailsError = ref('');
const classSearchResults = ref([]);
const selectedClassIri = ref('');
const classDetails = ref(null);
const treeNodes = ref([]);
const treeExpanded = ref({});
const treeError = ref('');
const dataPropertySearchText = ref('');
const dataPropertyIsSearching = ref(false);
const dataPropertyHasSearched = ref(false);
const dataPropertyError = ref('');
const dataPropertyResults = ref([]);
const selectedDataPropertyIri = ref('');
const dataPropertyDetails = ref(null);
const objectPropertySearchText = ref('');
const objectPropertyIsSearching = ref(false);
const objectPropertyHasSearched = ref(false);
const objectPropertyError = ref('');
const objectPropertyResults = ref([]);
const selectedObjectPropertyIri = ref('');
const objectPropertyDetails = ref(null);
const domainPropertyFilters = ref({ property: '', type: '', sourceClass: '', relatedClass: '' });
const rangePropertyFilters = ref({ property: '', type: '', sourceClass: '', relatedClass: '' });
const allClasses = ref([]);
const allProperties = ref([]);
const loadError = ref('');
const localName = (iri) => {
    const hash = iri.lastIndexOf('#');
    if (hash >= 0 && hash < iri.length - 1)
        return iri.slice(hash + 1);
    const slash = iri.lastIndexOf('/');
    if (slash >= 0 && slash < iri.length - 1)
        return iri.slice(slash + 1);
    return iri;
};
const classesByIri = computed(() => new Map(allClasses.value.map((c) => [c.iri, c])));
const propertiesByIri = computed(() => new Map(allProperties.value.map((p) => [p.iri, p])));
const subclassesBySuperclass = computed(() => {
    const out = new Map();
    for (const cls of allClasses.value) {
        for (const parent of cls.superclasses) {
            const set = out.get(parent) ?? new Set();
            set.add(cls.iri);
            out.set(parent, set);
        }
    }
    return out;
});
const subpropertiesBySuperproperty = computed(() => {
    const out = new Map();
    for (const prop of allProperties.value) {
        for (const parent of prop.superproperties) {
            const set = out.get(parent) ?? new Set();
            set.add(prop.iri);
            out.set(parent, set);
        }
    }
    return out;
});
const classRefFromIri = (iri) => {
    const cls = classesByIri.value.get(iri);
    if (!cls)
        return { iri, label: localName(iri), ricCmNotes: [] };
    return { iri: cls.iri, label: cls.label, ricCmNotes: cls.ricCmNotes };
};
const sortByLabel = (rows) => [...rows].sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
const uniqueClassRefs = (rows) => {
    const seen = new Set();
    const out = [];
    for (const row of rows) {
        if (!row.iri || seen.has(row.iri))
            continue;
        seen.add(row.iri);
        out.push(row);
    }
    return out;
};
const collectSuperclasses = (startIri) => {
    const out = new Set();
    const visit = (iri) => {
        const cls = classesByIri.value.get(iri);
        if (!cls)
            return;
        for (const parent of cls.superclasses) {
            if (out.has(parent))
                continue;
            out.add(parent);
            visit(parent);
        }
    };
    visit(startIri);
    return out;
};
const collectSubclasses = (startIri) => {
    const out = new Set();
    const visit = (iri) => {
        const children = subclassesBySuperclass.value.get(iri);
        if (!children)
            return;
        for (const child of children) {
            if (out.has(child))
                continue;
            out.add(child);
            visit(child);
        }
    };
    visit(startIri);
    return out;
};
const collectSuperproperties = (startIri) => {
    const out = new Set();
    const visit = (iri) => {
        const prop = propertiesByIri.value.get(iri);
        if (!prop)
            return;
        for (const parent of prop.superproperties) {
            if (out.has(parent))
                continue;
            out.add(parent);
            visit(parent);
        }
    };
    visit(startIri);
    return out;
};
const collectSubproperties = (startIri) => {
    const out = new Set();
    const visit = (iri) => {
        const children = subpropertiesBySuperproperty.value.get(iri);
        if (!children)
            return;
        for (const child of children) {
            if (out.has(child))
                continue;
            out.add(child);
            visit(child);
        }
    };
    visit(startIri);
    return out;
};
const treeChildrenByParent = computed(() => {
    const out = {};
    const knownIris = new Set(treeNodes.value.map((node) => node.iri));
    for (const node of treeNodes.value) {
        const validParents = node.parentIris.filter((iri) => knownIris.has(iri));
        if (!validParents.length) {
            out.__root__ = out.__root__ ?? [];
            out.__root__.push(node);
            continue;
        }
        for (const parent of validParents) {
            out[parent] = out[parent] ?? [];
            out[parent].push(node);
        }
    }
    for (const key of Object.keys(out)) {
        out[key] = sortByLabel(out[key]);
    }
    return out;
});
const treeRootNodes = computed(() => treeChildrenByParent.value.__root__ ?? []);
const activeDetailsError = computed(() => {
    if (activeDetailsKind.value === 'class')
        return classDetailsError.value;
    if (activeDetailsKind.value === 'data')
        return dataPropertyError.value;
    if (activeDetailsKind.value === 'object')
        return objectPropertyError.value;
    return '';
});
const valueContains = (value, query) => value.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
const filteredClassPropertiesByDomain = computed(() => {
    if (!classDetails.value)
        return [];
    return classDetails.value.propertiesByDomain.filter((prop) => {
        const related = prop.relatedEntities.map((e) => e.label).join(' ');
        return (valueContains(prop.label, domainPropertyFilters.value.property) &&
            valueContains(prop.kind, domainPropertyFilters.value.type) &&
            valueContains(prop.viaClassLabel, domainPropertyFilters.value.sourceClass) &&
            valueContains(related, domainPropertyFilters.value.relatedClass));
    });
});
const filteredClassPropertiesByRange = computed(() => {
    if (!classDetails.value)
        return [];
    return classDetails.value.propertiesByRange.filter((prop) => {
        const related = prop.relatedEntities.map((e) => e.label).join(' ');
        return (valueContains(prop.label, rangePropertyFilters.value.property) &&
            valueContains(prop.kind, rangePropertyFilters.value.type) &&
            valueContains(prop.viaClassLabel, rangePropertyFilters.value.sourceClass) &&
            valueContains(related, rangePropertyFilters.value.relatedClass));
    });
});
const toggleTreeNode = (iri) => {
    treeExpanded.value = { ...treeExpanded.value, [iri]: !treeExpanded.value[iri] };
};
const runClassSearch = async () => {
    classIsSearching.value = true;
    classHasSearched.value = true;
    classSearchError.value = '';
    try {
        const q = classSearchText.value.trim().toLowerCase();
        let rows = allClasses.value.map((cls) => ({
            iri: cls.iri,
            label: cls.label,
            description: cls.scopeNotes[0] || cls.comments[0] || cls.ricCmNotes[0] || ''
        }));
        if (q) {
            rows = rows.filter((row) => (row.label + ' ' + row.iri + ' ' + localName(row.iri)).toLowerCase().includes(q));
        }
        classSearchResults.value = sortByLabel(rows);
    }
    catch (err) {
        classSearchError.value = err instanceof Error ? err.message : 'Unable to search RiC-O classes.';
        classSearchResults.value = [];
    }
    finally {
        classIsSearching.value = false;
    }
};
const buildClassDetails = (iri) => {
    const cls = classesByIri.value.get(iri);
    if (!cls)
        throw new Error('RiC-O class not found: ' + iri);
    const superSet = collectSuperclasses(iri);
    const subSet = collectSubclasses(iri);
    const inheritanceSet = new Set([iri, ...superSet]);
    const superclasses = sortByLabel(uniqueClassRefs([...superSet].map(classRefFromIri)));
    const subclasses = sortByLabel(uniqueClassRefs([...subSet].map(classRefFromIri)));
    const propertiesByDomain = [];
    const propertiesByRange = [];
    for (const prop of allProperties.value) {
        for (const domainIri of prop.domains) {
            if (!inheritanceSet.has(domainIri))
                continue;
            propertiesByDomain.push({
                iri: prop.iri,
                label: prop.label,
                kind: prop.kind,
                matchedBy: 'domain',
                viaClassIri: domainIri,
                viaClassLabel: classRefFromIri(domainIri).label,
                relatedEntities: sortByLabel(uniqueClassRefs(prop.ranges.map(classRefFromIri)))
            });
        }
        for (const rangeIri of prop.ranges) {
            if (!inheritanceSet.has(rangeIri))
                continue;
            propertiesByRange.push({
                iri: prop.iri,
                label: prop.label,
                kind: prop.kind,
                matchedBy: 'range',
                viaClassIri: rangeIri,
                viaClassLabel: classRefFromIri(rangeIri).label,
                relatedEntities: sortByLabel(uniqueClassRefs(prop.domains.map(classRefFromIri)))
            });
        }
    }
    const uniqRows = (rows) => {
        const seen = new Set();
        return rows.filter((row) => {
            const key = row.iri + '|' + row.matchedBy + '|' + row.viaClassIri;
            if (seen.has(key))
                return false;
            seen.add(key);
            return true;
        });
    };
    const scopeNotes = Array.from(new Set([...cls.scopeNotes, ...cls.comments].filter(Boolean)));
    return {
        entity: {
            iri: cls.iri,
            label: cls.label,
            description: scopeNotes[0] || cls.ricCmNotes[0] || ''
        },
        scopeNotes,
        ricCmNotes: cls.ricCmNotes,
        superclasses,
        subclasses,
        propertiesByDomain: sortByLabel(uniqRows(propertiesByDomain)),
        propertiesByRange: sortByLabel(uniqRows(propertiesByRange))
    };
};
const selectClass = async (iri) => {
    selectedClassIri.value = iri;
    classDetailsError.value = '';
    activeDetailsKind.value = 'class';
    domainPropertyFilters.value = { property: '', type: '', sourceClass: '', relatedClass: '' };
    rangePropertyFilters.value = { property: '', type: '', sourceClass: '', relatedClass: '' };
    try {
        classDetails.value = buildClassDetails(iri);
    }
    catch (err) {
        classDetailsError.value = err instanceof Error ? err.message : 'Unable to load class details.';
        classDetails.value = null;
    }
};
const selectClassFromTree = async (iri) => {
    await selectClass(iri);
};
const loadClassTree = async () => {
    treeError.value = '';
    try {
        const classIris = new Set(allClasses.value.map((c) => c.iri));
        treeNodes.value = sortByLabel(allClasses.value.map((cls) => ({
            iri: cls.iri,
            label: cls.label,
            parentIris: cls.superclasses.filter((iri) => classIris.has(iri))
        })));
    }
    catch (err) {
        treeError.value = err instanceof Error ? err.message : 'Unable to load class tree.';
        treeNodes.value = [];
    }
};
const runPropertySearch = async (kind) => {
    const isData = kind === 'data';
    const searchTextRef = isData ? dataPropertySearchText : objectPropertySearchText;
    const isSearchingRef = isData ? dataPropertyIsSearching : objectPropertyIsSearching;
    const hasSearchedRef = isData ? dataPropertyHasSearched : objectPropertyHasSearched;
    const errorRef = isData ? dataPropertyError : objectPropertyError;
    const resultsRef = isData ? dataPropertyResults : objectPropertyResults;
    isSearchingRef.value = true;
    hasSearchedRef.value = true;
    errorRef.value = '';
    try {
        const q = searchTextRef.value.trim().toLowerCase();
        let rows = allProperties.value
            .filter((prop) => prop.kind === kind)
            .map((prop) => ({ iri: prop.iri, label: prop.label, description: prop.description || '', kind: prop.kind }));
        if (q) {
            rows = rows.filter((row) => (row.label + ' ' + row.iri + ' ' + localName(row.iri)).toLowerCase().includes(q));
        }
        resultsRef.value = sortByLabel(rows);
    }
    catch (err) {
        errorRef.value = err instanceof Error ? err.message : 'Unable to search properties.';
        resultsRef.value = [];
    }
    finally {
        isSearchingRef.value = false;
    }
};
const buildPropertyDetails = (iri, kind) => {
    const prop = propertiesByIri.value.get(iri);
    if (!prop || prop.kind !== kind)
        throw new Error('RiC-O property not found: ' + iri);
    const domains = sortByLabel(uniqueClassRefs(prop.domains.map(classRefFromIri)));
    const ranges = sortByLabel(uniqueClassRefs(prop.ranges.map(classRefFromIri)));
    const domainSubclasses = sortByLabel(uniqueClassRefs(prop.domains.flatMap((classIri) => [...collectSubclasses(classIri)]).map(classRefFromIri)));
    const rangeSubclasses = sortByLabel(uniqueClassRefs(prop.ranges.flatMap((classIri) => [...collectSubclasses(classIri)]).map(classRefFromIri)));
    const toSummary = (propertyIri) => {
        const item = propertiesByIri.value.get(propertyIri);
        if (!item)
            return null;
        return { iri: item.iri, label: item.label, description: item.description || '', kind: item.kind };
    };
    const superproperties = sortByLabel([...collectSuperproperties(prop.iri)]
        .map(toSummary)
        .filter((item) => Boolean(item)));
    const subproperties = sortByLabel([...collectSubproperties(prop.iri)]
        .map(toSummary)
        .filter((item) => Boolean(item)));
    return {
        property: { iri: prop.iri, label: prop.label, description: prop.description || '', kind: prop.kind },
        comments: prop.comments,
        domains,
        ranges,
        domainSubclasses,
        rangeSubclasses,
        superproperties,
        subproperties
    };
};
const selectProperty = async (kind, iri) => {
    activeDetailsKind.value = kind;
    if (kind === 'data')
        selectedDataPropertyIri.value = iri;
    else
        selectedObjectPropertyIri.value = iri;
    try {
        const details = buildPropertyDetails(iri, kind);
        if (kind === 'data')
            dataPropertyDetails.value = details;
        else
            objectPropertyDetails.value = details;
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to load property details.';
        if (kind === 'data') {
            dataPropertyError.value = message;
            dataPropertyDetails.value = null;
        }
        else {
            objectPropertyError.value = message;
            objectPropertyDetails.value = null;
        }
    }
};
const openClassFromProperty = async (iri) => {
    activeTab.value = 'classes';
    await selectClass(iri);
};
const openRelatedProperty = async (property) => {
    if (property.kind !== 'data' && property.kind !== 'object')
        return;
    activeTab.value = property.kind === 'data' ? 'data-properties' : 'object-properties';
    await selectProperty(property.kind, property.iri);
};
const closeDetailsModal = () => {
    activeDetailsKind.value = '';
};
const activateTab = async (tab) => {
    activeTab.value = tab;
    if (tab === 'tree' && !treeNodes.value.length) {
        await loadClassTree();
        return;
    }
    if (tab === 'data-properties' && !dataPropertyHasSearched.value) {
        await runPropertySearch('data');
        return;
    }
    if (tab === 'object-properties' && !objectPropertyHasSearched.value) {
        await runPropertySearch('object');
    }
};
const loadNavigatorData = async () => {
    loadError.value = '';
    try {
        const res = await fetch('/rico-data.json', { cache: 'no-store' });
        if (!res.ok)
            throw new Error('Failed to load rico-data.json (' + res.status + ')');
        const payload = (await res.json());
        allClasses.value = payload.classes ?? [];
        allProperties.value = payload.properties ?? [];
    }
    catch (err) {
        loadError.value = err instanceof Error ? err.message : 'Unable to load navigator data.';
        allClasses.value = [];
        allProperties.value = [];
    }
};
onMounted(async () => {
    await loadNavigatorData();
    await runClassSearch();
    await runPropertySearch('data');
    await runPropertySearch('object');
    await loadClassTree();
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['tab-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['result-item']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['uri-link']} */ ;
/** @type {__VLS_StyleScopedClasses['description-box']} */ ;
/** @type {__VLS_StyleScopedClasses['description-box']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['result-item']} */ ;
/** @type {__VLS_StyleScopedClasses['prop-table']} */ ;
/** @type {__VLS_StyleScopedClasses['prop-table']} */ ;
/** @type {__VLS_StyleScopedClasses['prop-table']} */ ;
/** @type {__VLS_StyleScopedClasses['prop-table']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['two-columns']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
    ...{ class: "rico-helper-page" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "header-row" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h1, __VLS_intrinsicElements.h1)({});
if (__VLS_ctx.loadError) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "error" },
    });
    (__VLS_ctx.loadError);
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.article, __VLS_intrinsicElements.article)({
    ...{ class: "card tabs-card" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "tab-row" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.activateTab('classes');
        } },
    type: "button",
    ...{ class: (['tab-btn', { active: __VLS_ctx.activeTab === 'classes' }]) },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.activateTab('tree');
        } },
    type: "button",
    ...{ class: (['tab-btn', { active: __VLS_ctx.activeTab === 'tree' }]) },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.activateTab('data-properties');
        } },
    type: "button",
    ...{ class: (['tab-btn', { active: __VLS_ctx.activeTab === 'data-properties' }]) },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.activateTab('object-properties');
        } },
    type: "button",
    ...{ class: (['tab-btn', { active: __VLS_ctx.activeTab === 'object-properties' }]) },
});
if (__VLS_ctx.activeTab === 'classes') {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
        ...{ class: "tab-panel" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.article, __VLS_intrinsicElements.article)({
        ...{ class: "search-card" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.form, __VLS_intrinsicElements.form)({
        ...{ onSubmit: (__VLS_ctx.runClassSearch) },
        ...{ class: "search-row" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        value: (__VLS_ctx.classSearchText),
        type: "text",
        placeholder: "Search RiC-O class/entity",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        type: "submit",
    });
    if (__VLS_ctx.classSearchError) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
            ...{ class: "error" },
        });
        (__VLS_ctx.classSearchError);
    }
    if (__VLS_ctx.classSearchResults.length > 0) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "result-list" },
        });
        for (const [entity] of __VLS_getVForSourceType((__VLS_ctx.classSearchResults))) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.activeTab === 'classes'))
                            return;
                        if (!(__VLS_ctx.classSearchResults.length > 0))
                            return;
                        __VLS_ctx.selectClass(entity.iri);
                    } },
                key: (entity.iri),
                ...{ class: "result-item" },
                ...{ class: ({ active: __VLS_ctx.selectedClassIri === entity.iri }) },
                type: "button",
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
            (entity.label);
            __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
            __VLS_asFunctionalElement(__VLS_intrinsicElements.a, __VLS_intrinsicElements.a)({
                ...{ onClick: () => { } },
                ...{ class: "uri-link" },
                href: (entity.iri),
                target: "_blank",
                rel: "noopener noreferrer",
            });
            (entity.iri);
            if (entity.description) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
                (entity.description);
            }
        }
    }
    else if (__VLS_ctx.classHasSearched && !__VLS_ctx.classIsSearching) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
    }
}
else if (__VLS_ctx.activeTab === 'tree') {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
        ...{ class: "tab-panel" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.article, __VLS_intrinsicElements.article)({
        ...{ class: "search-card hierarchy-search-card" },
    });
    if (__VLS_ctx.treeError) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
            ...{ class: "error" },
        });
        (__VLS_ctx.treeError);
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "tree-scroll-panel" },
    });
    if (__VLS_ctx.treeRootNodes.length > 0) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.ul, __VLS_intrinsicElements.ul)({
            ...{ class: "tree-root" },
        });
        for (const [node] of __VLS_getVForSourceType((__VLS_ctx.treeRootNodes))) {
            /** @type {[typeof RicoClassTreeNode, ]} */ ;
            // @ts-ignore
            const __VLS_0 = __VLS_asFunctionalComponent(RicoClassTreeNode, new RicoClassTreeNode({
                key: (node.iri),
                node: (node),
                childrenByParent: (__VLS_ctx.treeChildrenByParent),
                expandedMap: (__VLS_ctx.treeExpanded),
                toggleNode: (__VLS_ctx.toggleTreeNode),
                onSelect: (__VLS_ctx.selectClassFromTree),
            }));
            const __VLS_1 = __VLS_0({
                key: (node.iri),
                node: (node),
                childrenByParent: (__VLS_ctx.treeChildrenByParent),
                expandedMap: (__VLS_ctx.treeExpanded),
                toggleNode: (__VLS_ctx.toggleTreeNode),
                onSelect: (__VLS_ctx.selectClassFromTree),
            }, ...__VLS_functionalComponentArgsRest(__VLS_0));
        }
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
    }
}
else if (__VLS_ctx.activeTab === 'data-properties') {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
        ...{ class: "tab-panel" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.article, __VLS_intrinsicElements.article)({
        ...{ class: "search-card" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.form, __VLS_intrinsicElements.form)({
        ...{ onSubmit: (...[$event]) => {
                if (!!(__VLS_ctx.activeTab === 'classes'))
                    return;
                if (!!(__VLS_ctx.activeTab === 'tree'))
                    return;
                if (!(__VLS_ctx.activeTab === 'data-properties'))
                    return;
                __VLS_ctx.runPropertySearch('data');
            } },
        ...{ class: "search-row" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        value: (__VLS_ctx.dataPropertySearchText),
        type: "text",
        placeholder: "Search data properties",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        type: "submit",
    });
    if (__VLS_ctx.dataPropertyError) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
            ...{ class: "error" },
        });
        (__VLS_ctx.dataPropertyError);
    }
    if (__VLS_ctx.dataPropertyResults.length > 0) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "result-list" },
        });
        for (const [prop] of __VLS_getVForSourceType((__VLS_ctx.dataPropertyResults))) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
                ...{ onClick: (...[$event]) => {
                        if (!!(__VLS_ctx.activeTab === 'classes'))
                            return;
                        if (!!(__VLS_ctx.activeTab === 'tree'))
                            return;
                        if (!(__VLS_ctx.activeTab === 'data-properties'))
                            return;
                        if (!(__VLS_ctx.dataPropertyResults.length > 0))
                            return;
                        __VLS_ctx.selectProperty('data', prop.iri);
                    } },
                key: (prop.iri),
                ...{ class: "result-item" },
                ...{ class: ({ active: __VLS_ctx.selectedDataPropertyIri === prop.iri }) },
                type: "button",
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
            (prop.label);
            __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
            __VLS_asFunctionalElement(__VLS_intrinsicElements.a, __VLS_intrinsicElements.a)({
                ...{ onClick: () => { } },
                ...{ class: "uri-link" },
                href: (prop.iri),
                target: "_blank",
                rel: "noopener noreferrer",
            });
            (prop.iri);
            if (prop.description) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
                (prop.description);
            }
        }
    }
    else if (__VLS_ctx.dataPropertyHasSearched && !__VLS_ctx.dataPropertyIsSearching) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
    }
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
        ...{ class: "tab-panel" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.article, __VLS_intrinsicElements.article)({
        ...{ class: "search-card" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.form, __VLS_intrinsicElements.form)({
        ...{ onSubmit: (...[$event]) => {
                if (!!(__VLS_ctx.activeTab === 'classes'))
                    return;
                if (!!(__VLS_ctx.activeTab === 'tree'))
                    return;
                if (!!(__VLS_ctx.activeTab === 'data-properties'))
                    return;
                __VLS_ctx.runPropertySearch('object');
            } },
        ...{ class: "search-row" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        value: (__VLS_ctx.objectPropertySearchText),
        type: "text",
        placeholder: "Search object properties",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        type: "submit",
    });
    if (__VLS_ctx.objectPropertyError) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
            ...{ class: "error" },
        });
        (__VLS_ctx.objectPropertyError);
    }
    if (__VLS_ctx.objectPropertyResults.length > 0) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "result-list" },
        });
        for (const [prop] of __VLS_getVForSourceType((__VLS_ctx.objectPropertyResults))) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
                ...{ onClick: (...[$event]) => {
                        if (!!(__VLS_ctx.activeTab === 'classes'))
                            return;
                        if (!!(__VLS_ctx.activeTab === 'tree'))
                            return;
                        if (!!(__VLS_ctx.activeTab === 'data-properties'))
                            return;
                        if (!(__VLS_ctx.objectPropertyResults.length > 0))
                            return;
                        __VLS_ctx.selectProperty('object', prop.iri);
                    } },
                key: (prop.iri),
                ...{ class: "result-item" },
                ...{ class: ({ active: __VLS_ctx.selectedObjectPropertyIri === prop.iri }) },
                type: "button",
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
            (prop.label);
            __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
            __VLS_asFunctionalElement(__VLS_intrinsicElements.a, __VLS_intrinsicElements.a)({
                ...{ onClick: () => { } },
                ...{ class: "uri-link" },
                href: (prop.iri),
                target: "_blank",
                rel: "noopener noreferrer",
            });
            (prop.iri);
            if (prop.description) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
                (prop.description);
            }
        }
    }
    else if (__VLS_ctx.objectPropertyHasSearched && !__VLS_ctx.objectPropertyIsSearching) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
    }
}
if (__VLS_ctx.activeDetailsKind) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ onClick: (__VLS_ctx.closeDetailsModal) },
        ...{ class: "details-modal-backdrop" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.article, __VLS_intrinsicElements.article)({
        ...{ class: "details-card details-modal" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "details-modal-actions" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.closeDetailsModal) },
        type: "button",
        ...{ class: "icon-btn close-btn" },
        title: "Close details",
    });
    if (__VLS_ctx.activeDetailsKind === 'class' && __VLS_ctx.classDetails) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "entity-header" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({});
        (__VLS_ctx.classDetails.entity.label);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
            ...{ class: "entity-iri" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.a, __VLS_intrinsicElements.a)({
            ...{ class: "uri-link" },
            href: (__VLS_ctx.classDetails.entity.iri),
            target: "_blank",
            rel: "noopener noreferrer",
        });
        (__VLS_ctx.classDetails.entity.iri);
        if (__VLS_ctx.classDetails.entity.description) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
                ...{ class: "description-box" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({});
            __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
            (__VLS_ctx.classDetails.entity.description);
        }
        if (__VLS_ctx.classDetails.scopeNotes.length) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
                ...{ class: "block" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({});
            __VLS_asFunctionalElement(__VLS_intrinsicElements.ul, __VLS_intrinsicElements.ul)({});
            for (const [note, idx] of __VLS_getVForSourceType((__VLS_ctx.classDetails.scopeNotes))) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({
                    key: (`${idx}-${note.slice(0, 20)}`),
                });
                (note);
            }
        }
        if (__VLS_ctx.classDetails.ricCmNotes.length) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
                ...{ class: "block" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({});
            __VLS_asFunctionalElement(__VLS_intrinsicElements.ul, __VLS_intrinsicElements.ul)({});
            for (const [note, idx] of __VLS_getVForSourceType((__VLS_ctx.classDetails.ricCmNotes))) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({
                    key: (`riccm-${idx}-${note.slice(0, 20)}`),
                });
                (note);
            }
        }
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "grid two-columns" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
            ...{ class: "block" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({});
        if (__VLS_ctx.classDetails.superclasses.length) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.ul, __VLS_intrinsicElements.ul)({});
            for (const [cls] of __VLS_getVForSourceType((__VLS_ctx.classDetails.superclasses))) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({
                    key: (cls.iri),
                });
                __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
                    ...{ onClick: (...[$event]) => {
                            if (!(__VLS_ctx.activeDetailsKind))
                                return;
                            if (!(__VLS_ctx.activeDetailsKind === 'class' && __VLS_ctx.classDetails))
                                return;
                            if (!(__VLS_ctx.classDetails.superclasses.length))
                                return;
                            __VLS_ctx.selectClass(cls.iri);
                        } },
                    ...{ class: "entity-link-btn" },
                    type: "button",
                });
                (cls.label);
                __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
                __VLS_asFunctionalElement(__VLS_intrinsicElements.a, __VLS_intrinsicElements.a)({
                    ...{ class: "uri-link" },
                    href: (cls.iri),
                    target: "_blank",
                    rel: "noopener noreferrer",
                });
                (cls.iri);
            }
        }
        else {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
        }
        __VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
            ...{ class: "block" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({});
        if (__VLS_ctx.classDetails.subclasses.length) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.ul, __VLS_intrinsicElements.ul)({});
            for (const [cls] of __VLS_getVForSourceType((__VLS_ctx.classDetails.subclasses))) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({
                    key: (cls.iri),
                });
                __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
                    ...{ onClick: (...[$event]) => {
                            if (!(__VLS_ctx.activeDetailsKind))
                                return;
                            if (!(__VLS_ctx.activeDetailsKind === 'class' && __VLS_ctx.classDetails))
                                return;
                            if (!(__VLS_ctx.classDetails.subclasses.length))
                                return;
                            __VLS_ctx.selectClass(cls.iri);
                        } },
                    ...{ class: "entity-link-btn" },
                    type: "button",
                });
                (cls.label);
                __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
                __VLS_asFunctionalElement(__VLS_intrinsicElements.a, __VLS_intrinsicElements.a)({
                    ...{ class: "uri-link" },
                    href: (cls.iri),
                    target: "_blank",
                    rel: "noopener noreferrer",
                });
                (cls.iri);
            }
        }
        else {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
        }
        __VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
            ...{ class: "block" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({});
        if (__VLS_ctx.classDetails.propertiesByDomain.length) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.table, __VLS_intrinsicElements.table)({
                ...{ class: "prop-table" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.thead, __VLS_intrinsicElements.thead)({});
            __VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)({});
            __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({});
            __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({});
            __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({});
            __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({});
            __VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)({
                ...{ class: "filter-row" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({});
            __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
                value: (__VLS_ctx.domainPropertyFilters.property),
                ...{ class: "column-filter-input" },
                type: "text",
                placeholder: "Filter property",
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({});
            __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
                value: (__VLS_ctx.domainPropertyFilters.type),
                ...{ class: "column-filter-input" },
                type: "text",
                placeholder: "Filter type",
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({});
            __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
                value: (__VLS_ctx.domainPropertyFilters.sourceClass),
                ...{ class: "column-filter-input" },
                type: "text",
                placeholder: "Filter domain class",
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({});
            __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
                value: (__VLS_ctx.domainPropertyFilters.relatedClass),
                ...{ class: "column-filter-input" },
                type: "text",
                placeholder: "Filter range class",
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.tbody, __VLS_intrinsicElements.tbody)({});
            for (const [prop] of __VLS_getVForSourceType((__VLS_ctx.filteredClassPropertiesByDomain))) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)({
                    key: (`${prop.iri}|domain|${prop.viaClassIri}`),
                });
                __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
                __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
                    ...{ onClick: (...[$event]) => {
                            if (!(__VLS_ctx.activeDetailsKind))
                                return;
                            if (!(__VLS_ctx.activeDetailsKind === 'class' && __VLS_ctx.classDetails))
                                return;
                            if (!(__VLS_ctx.classDetails.propertiesByDomain.length))
                                return;
                            __VLS_ctx.openRelatedProperty({ iri: prop.iri, label: prop.label, description: '', kind: prop.kind });
                        } },
                    ...{ class: "entity-link-btn" },
                    type: "button",
                });
                (prop.label);
                __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
                __VLS_asFunctionalElement(__VLS_intrinsicElements.a, __VLS_intrinsicElements.a)({
                    ...{ onClick: () => { } },
                    ...{ class: "uri-link" },
                    href: (prop.iri),
                    target: "_blank",
                    rel: "noopener noreferrer",
                });
                (prop.iri);
                __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
                (prop.kind);
                __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
                __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
                    ...{ onClick: (...[$event]) => {
                            if (!(__VLS_ctx.activeDetailsKind))
                                return;
                            if (!(__VLS_ctx.activeDetailsKind === 'class' && __VLS_ctx.classDetails))
                                return;
                            if (!(__VLS_ctx.classDetails.propertiesByDomain.length))
                                return;
                            __VLS_ctx.selectClass(prop.viaClassIri);
                        } },
                    ...{ class: "entity-link-btn" },
                    type: "button",
                });
                (prop.viaClassLabel);
                __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
                if (prop.relatedEntities.length) {
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                        ...{ class: "entity-link-list" },
                    });
                    for (const [entity] of __VLS_getVForSourceType((prop.relatedEntities))) {
                        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
                            ...{ onClick: (...[$event]) => {
                                    if (!(__VLS_ctx.activeDetailsKind))
                                        return;
                                    if (!(__VLS_ctx.activeDetailsKind === 'class' && __VLS_ctx.classDetails))
                                        return;
                                    if (!(__VLS_ctx.classDetails.propertiesByDomain.length))
                                        return;
                                    if (!(prop.relatedEntities.length))
                                        return;
                                    __VLS_ctx.selectClass(entity.iri);
                                } },
                            key: (`${prop.iri}-range-${entity.iri}`),
                            ...{ class: "entity-link-btn" },
                            type: "button",
                        });
                        (entity.label);
                    }
                }
                else {
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
                }
            }
            if (!__VLS_ctx.filteredClassPropertiesByDomain.length) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)({});
                __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
                    colspan: "4",
                });
            }
        }
        else {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
        }
        __VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
            ...{ class: "block" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({});
        if (__VLS_ctx.classDetails.propertiesByRange.length) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.table, __VLS_intrinsicElements.table)({
                ...{ class: "prop-table" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.thead, __VLS_intrinsicElements.thead)({});
            __VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)({});
            __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({});
            __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({});
            __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({});
            __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({});
            __VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)({
                ...{ class: "filter-row" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({});
            __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
                value: (__VLS_ctx.rangePropertyFilters.property),
                ...{ class: "column-filter-input" },
                type: "text",
                placeholder: "Filter property",
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({});
            __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
                value: (__VLS_ctx.rangePropertyFilters.type),
                ...{ class: "column-filter-input" },
                type: "text",
                placeholder: "Filter type",
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({});
            __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
                value: (__VLS_ctx.rangePropertyFilters.sourceClass),
                ...{ class: "column-filter-input" },
                type: "text",
                placeholder: "Filter range class",
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({});
            __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
                value: (__VLS_ctx.rangePropertyFilters.relatedClass),
                ...{ class: "column-filter-input" },
                type: "text",
                placeholder: "Filter domain class",
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.tbody, __VLS_intrinsicElements.tbody)({});
            for (const [prop] of __VLS_getVForSourceType((__VLS_ctx.filteredClassPropertiesByRange))) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)({
                    key: (`${prop.iri}|range|${prop.viaClassIri}`),
                });
                __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
                __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
                    ...{ onClick: (...[$event]) => {
                            if (!(__VLS_ctx.activeDetailsKind))
                                return;
                            if (!(__VLS_ctx.activeDetailsKind === 'class' && __VLS_ctx.classDetails))
                                return;
                            if (!(__VLS_ctx.classDetails.propertiesByRange.length))
                                return;
                            __VLS_ctx.openRelatedProperty({ iri: prop.iri, label: prop.label, description: '', kind: prop.kind });
                        } },
                    ...{ class: "entity-link-btn" },
                    type: "button",
                });
                (prop.label);
                __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
                __VLS_asFunctionalElement(__VLS_intrinsicElements.a, __VLS_intrinsicElements.a)({
                    ...{ onClick: () => { } },
                    ...{ class: "uri-link" },
                    href: (prop.iri),
                    target: "_blank",
                    rel: "noopener noreferrer",
                });
                (prop.iri);
                __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
                (prop.kind);
                __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
                __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
                    ...{ onClick: (...[$event]) => {
                            if (!(__VLS_ctx.activeDetailsKind))
                                return;
                            if (!(__VLS_ctx.activeDetailsKind === 'class' && __VLS_ctx.classDetails))
                                return;
                            if (!(__VLS_ctx.classDetails.propertiesByRange.length))
                                return;
                            __VLS_ctx.selectClass(prop.viaClassIri);
                        } },
                    ...{ class: "entity-link-btn" },
                    type: "button",
                });
                (prop.viaClassLabel);
                __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
                if (prop.relatedEntities.length) {
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                        ...{ class: "entity-link-list" },
                    });
                    for (const [entity] of __VLS_getVForSourceType((prop.relatedEntities))) {
                        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
                            ...{ onClick: (...[$event]) => {
                                    if (!(__VLS_ctx.activeDetailsKind))
                                        return;
                                    if (!(__VLS_ctx.activeDetailsKind === 'class' && __VLS_ctx.classDetails))
                                        return;
                                    if (!(__VLS_ctx.classDetails.propertiesByRange.length))
                                        return;
                                    if (!(prop.relatedEntities.length))
                                        return;
                                    __VLS_ctx.selectClass(entity.iri);
                                } },
                            key: (`${prop.iri}-domain-${entity.iri}`),
                            ...{ class: "entity-link-btn" },
                            type: "button",
                        });
                        (entity.label);
                    }
                }
                else {
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
                }
            }
            if (!__VLS_ctx.filteredClassPropertiesByRange.length) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)({});
                __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
                    colspan: "4",
                });
            }
        }
        else {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
        }
    }
    else if (__VLS_ctx.activeDetailsKind === 'data' && __VLS_ctx.dataPropertyDetails) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({});
        (__VLS_ctx.dataPropertyDetails.property.label);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
            ...{ class: "entity-iri" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.a, __VLS_intrinsicElements.a)({
            ...{ class: "uri-link" },
            href: (__VLS_ctx.dataPropertyDetails.property.iri),
            target: "_blank",
            rel: "noopener noreferrer",
        });
        (__VLS_ctx.dataPropertyDetails.property.iri);
        if (__VLS_ctx.dataPropertyDetails.comments.length) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
                ...{ class: "block" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({});
            __VLS_asFunctionalElement(__VLS_intrinsicElements.ul, __VLS_intrinsicElements.ul)({});
            for (const [comment, index] of __VLS_getVForSourceType((__VLS_ctx.dataPropertyDetails.comments))) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({
                    key: ('data-comment-' + index),
                });
                (comment);
            }
        }
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "grid two-columns" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
            ...{ class: "block" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({});
        if (__VLS_ctx.dataPropertyDetails.domains.length) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.ul, __VLS_intrinsicElements.ul)({});
            for (const [cls] of __VLS_getVForSourceType((__VLS_ctx.dataPropertyDetails.domains))) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({
                    key: (cls.iri),
                });
                __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
                    ...{ onClick: (...[$event]) => {
                            if (!(__VLS_ctx.activeDetailsKind))
                                return;
                            if (!!(__VLS_ctx.activeDetailsKind === 'class' && __VLS_ctx.classDetails))
                                return;
                            if (!(__VLS_ctx.activeDetailsKind === 'data' && __VLS_ctx.dataPropertyDetails))
                                return;
                            if (!(__VLS_ctx.dataPropertyDetails.domains.length))
                                return;
                            __VLS_ctx.openClassFromProperty(cls.iri);
                        } },
                    ...{ class: "entity-link-btn" },
                    type: "button",
                });
                (cls.label);
                __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
                __VLS_asFunctionalElement(__VLS_intrinsicElements.a, __VLS_intrinsicElements.a)({
                    ...{ class: "uri-link" },
                    href: (cls.iri),
                    target: "_blank",
                    rel: "noopener noreferrer",
                });
                (cls.iri);
            }
            for (const [cls] of __VLS_getVForSourceType((__VLS_ctx.dataPropertyDetails.domainSubclasses))) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({
                    key: ('data-domain-sub-merged-' + cls.iri),
                    ...{ class: "nested-class-row" },
                });
                __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
                    ...{ onClick: (...[$event]) => {
                            if (!(__VLS_ctx.activeDetailsKind))
                                return;
                            if (!!(__VLS_ctx.activeDetailsKind === 'class' && __VLS_ctx.classDetails))
                                return;
                            if (!(__VLS_ctx.activeDetailsKind === 'data' && __VLS_ctx.dataPropertyDetails))
                                return;
                            if (!(__VLS_ctx.dataPropertyDetails.domains.length))
                                return;
                            __VLS_ctx.openClassFromProperty(cls.iri);
                        } },
                    ...{ class: "entity-link-btn nested-entity-link" },
                    type: "button",
                });
                (cls.label);
                __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
                __VLS_asFunctionalElement(__VLS_intrinsicElements.a, __VLS_intrinsicElements.a)({
                    ...{ class: "uri-link" },
                    href: (cls.iri),
                    target: "_blank",
                    rel: "noopener noreferrer",
                });
                (cls.iri);
            }
        }
        else {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
        }
        __VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
            ...{ class: "block" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({});
        if (__VLS_ctx.dataPropertyDetails.ranges.length) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.ul, __VLS_intrinsicElements.ul)({});
            for (const [cls] of __VLS_getVForSourceType((__VLS_ctx.dataPropertyDetails.ranges))) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({
                    key: (cls.iri),
                });
                __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
                    ...{ onClick: (...[$event]) => {
                            if (!(__VLS_ctx.activeDetailsKind))
                                return;
                            if (!!(__VLS_ctx.activeDetailsKind === 'class' && __VLS_ctx.classDetails))
                                return;
                            if (!(__VLS_ctx.activeDetailsKind === 'data' && __VLS_ctx.dataPropertyDetails))
                                return;
                            if (!(__VLS_ctx.dataPropertyDetails.ranges.length))
                                return;
                            __VLS_ctx.openClassFromProperty(cls.iri);
                        } },
                    ...{ class: "entity-link-btn" },
                    type: "button",
                });
                (cls.label);
                __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
                __VLS_asFunctionalElement(__VLS_intrinsicElements.a, __VLS_intrinsicElements.a)({
                    ...{ class: "uri-link" },
                    href: (cls.iri),
                    target: "_blank",
                    rel: "noopener noreferrer",
                });
                (cls.iri);
            }
            for (const [cls] of __VLS_getVForSourceType((__VLS_ctx.dataPropertyDetails.rangeSubclasses))) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({
                    key: ('data-range-sub-merged-' + cls.iri),
                    ...{ class: "nested-class-row" },
                });
                __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
                    ...{ onClick: (...[$event]) => {
                            if (!(__VLS_ctx.activeDetailsKind))
                                return;
                            if (!!(__VLS_ctx.activeDetailsKind === 'class' && __VLS_ctx.classDetails))
                                return;
                            if (!(__VLS_ctx.activeDetailsKind === 'data' && __VLS_ctx.dataPropertyDetails))
                                return;
                            if (!(__VLS_ctx.dataPropertyDetails.ranges.length))
                                return;
                            __VLS_ctx.openClassFromProperty(cls.iri);
                        } },
                    ...{ class: "entity-link-btn nested-entity-link" },
                    type: "button",
                });
                (cls.label);
                __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
                __VLS_asFunctionalElement(__VLS_intrinsicElements.a, __VLS_intrinsicElements.a)({
                    ...{ class: "uri-link" },
                    href: (cls.iri),
                    target: "_blank",
                    rel: "noopener noreferrer",
                });
                (cls.iri);
            }
        }
        else {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
        }
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "grid two-columns" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
            ...{ class: "block" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({});
        if (__VLS_ctx.dataPropertyDetails.superproperties.length) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.ul, __VLS_intrinsicElements.ul)({});
            for (const [prop] of __VLS_getVForSourceType((__VLS_ctx.dataPropertyDetails.superproperties))) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({
                    key: (prop.iri),
                });
                __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
                    ...{ onClick: (...[$event]) => {
                            if (!(__VLS_ctx.activeDetailsKind))
                                return;
                            if (!!(__VLS_ctx.activeDetailsKind === 'class' && __VLS_ctx.classDetails))
                                return;
                            if (!(__VLS_ctx.activeDetailsKind === 'data' && __VLS_ctx.dataPropertyDetails))
                                return;
                            if (!(__VLS_ctx.dataPropertyDetails.superproperties.length))
                                return;
                            __VLS_ctx.openRelatedProperty(prop);
                        } },
                    ...{ class: "entity-link-btn" },
                    type: "button",
                });
                (prop.label);
                __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
                __VLS_asFunctionalElement(__VLS_intrinsicElements.a, __VLS_intrinsicElements.a)({
                    ...{ onClick: () => { } },
                    ...{ class: "uri-link" },
                    href: (prop.iri),
                    target: "_blank",
                    rel: "noopener noreferrer",
                });
                (prop.iri);
            }
        }
        else {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
        }
        __VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
            ...{ class: "block" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({});
        if (__VLS_ctx.dataPropertyDetails.subproperties.length) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.ul, __VLS_intrinsicElements.ul)({});
            for (const [prop] of __VLS_getVForSourceType((__VLS_ctx.dataPropertyDetails.subproperties))) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({
                    key: (prop.iri),
                });
                __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
                    ...{ onClick: (...[$event]) => {
                            if (!(__VLS_ctx.activeDetailsKind))
                                return;
                            if (!!(__VLS_ctx.activeDetailsKind === 'class' && __VLS_ctx.classDetails))
                                return;
                            if (!(__VLS_ctx.activeDetailsKind === 'data' && __VLS_ctx.dataPropertyDetails))
                                return;
                            if (!(__VLS_ctx.dataPropertyDetails.subproperties.length))
                                return;
                            __VLS_ctx.openRelatedProperty(prop);
                        } },
                    ...{ class: "entity-link-btn" },
                    type: "button",
                });
                (prop.label);
                __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
                __VLS_asFunctionalElement(__VLS_intrinsicElements.a, __VLS_intrinsicElements.a)({
                    ...{ onClick: () => { } },
                    ...{ class: "uri-link" },
                    href: (prop.iri),
                    target: "_blank",
                    rel: "noopener noreferrer",
                });
                (prop.iri);
            }
        }
        else {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
        }
    }
    else if (__VLS_ctx.activeDetailsKind === 'object' && __VLS_ctx.objectPropertyDetails) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({});
        (__VLS_ctx.objectPropertyDetails.property.label);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
            ...{ class: "entity-iri" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.a, __VLS_intrinsicElements.a)({
            ...{ class: "uri-link" },
            href: (__VLS_ctx.objectPropertyDetails.property.iri),
            target: "_blank",
            rel: "noopener noreferrer",
        });
        (__VLS_ctx.objectPropertyDetails.property.iri);
        if (__VLS_ctx.objectPropertyDetails.comments.length) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
                ...{ class: "block" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({});
            __VLS_asFunctionalElement(__VLS_intrinsicElements.ul, __VLS_intrinsicElements.ul)({});
            for (const [comment, index] of __VLS_getVForSourceType((__VLS_ctx.objectPropertyDetails.comments))) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({
                    key: ('object-comment-' + index),
                });
                (comment);
            }
        }
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "grid two-columns" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
            ...{ class: "block" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({});
        if (__VLS_ctx.objectPropertyDetails.domains.length) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.ul, __VLS_intrinsicElements.ul)({});
            for (const [cls] of __VLS_getVForSourceType((__VLS_ctx.objectPropertyDetails.domains))) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({
                    key: (cls.iri),
                });
                __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
                    ...{ onClick: (...[$event]) => {
                            if (!(__VLS_ctx.activeDetailsKind))
                                return;
                            if (!!(__VLS_ctx.activeDetailsKind === 'class' && __VLS_ctx.classDetails))
                                return;
                            if (!!(__VLS_ctx.activeDetailsKind === 'data' && __VLS_ctx.dataPropertyDetails))
                                return;
                            if (!(__VLS_ctx.activeDetailsKind === 'object' && __VLS_ctx.objectPropertyDetails))
                                return;
                            if (!(__VLS_ctx.objectPropertyDetails.domains.length))
                                return;
                            __VLS_ctx.openClassFromProperty(cls.iri);
                        } },
                    ...{ class: "entity-link-btn" },
                    type: "button",
                });
                (cls.label);
                __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
                __VLS_asFunctionalElement(__VLS_intrinsicElements.a, __VLS_intrinsicElements.a)({
                    ...{ class: "uri-link" },
                    href: (cls.iri),
                    target: "_blank",
                    rel: "noopener noreferrer",
                });
                (cls.iri);
            }
            for (const [cls] of __VLS_getVForSourceType((__VLS_ctx.objectPropertyDetails.domainSubclasses))) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({
                    key: ('object-domain-sub-merged-' + cls.iri),
                    ...{ class: "nested-class-row" },
                });
                __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
                    ...{ onClick: (...[$event]) => {
                            if (!(__VLS_ctx.activeDetailsKind))
                                return;
                            if (!!(__VLS_ctx.activeDetailsKind === 'class' && __VLS_ctx.classDetails))
                                return;
                            if (!!(__VLS_ctx.activeDetailsKind === 'data' && __VLS_ctx.dataPropertyDetails))
                                return;
                            if (!(__VLS_ctx.activeDetailsKind === 'object' && __VLS_ctx.objectPropertyDetails))
                                return;
                            if (!(__VLS_ctx.objectPropertyDetails.domains.length))
                                return;
                            __VLS_ctx.openClassFromProperty(cls.iri);
                        } },
                    ...{ class: "entity-link-btn nested-entity-link" },
                    type: "button",
                });
                (cls.label);
                __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
                __VLS_asFunctionalElement(__VLS_intrinsicElements.a, __VLS_intrinsicElements.a)({
                    ...{ class: "uri-link" },
                    href: (cls.iri),
                    target: "_blank",
                    rel: "noopener noreferrer",
                });
                (cls.iri);
            }
        }
        else {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
        }
        __VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
            ...{ class: "block" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({});
        if (__VLS_ctx.objectPropertyDetails.ranges.length) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.ul, __VLS_intrinsicElements.ul)({});
            for (const [cls] of __VLS_getVForSourceType((__VLS_ctx.objectPropertyDetails.ranges))) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({
                    key: (cls.iri),
                });
                __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
                    ...{ onClick: (...[$event]) => {
                            if (!(__VLS_ctx.activeDetailsKind))
                                return;
                            if (!!(__VLS_ctx.activeDetailsKind === 'class' && __VLS_ctx.classDetails))
                                return;
                            if (!!(__VLS_ctx.activeDetailsKind === 'data' && __VLS_ctx.dataPropertyDetails))
                                return;
                            if (!(__VLS_ctx.activeDetailsKind === 'object' && __VLS_ctx.objectPropertyDetails))
                                return;
                            if (!(__VLS_ctx.objectPropertyDetails.ranges.length))
                                return;
                            __VLS_ctx.openClassFromProperty(cls.iri);
                        } },
                    ...{ class: "entity-link-btn" },
                    type: "button",
                });
                (cls.label);
                __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
                __VLS_asFunctionalElement(__VLS_intrinsicElements.a, __VLS_intrinsicElements.a)({
                    ...{ class: "uri-link" },
                    href: (cls.iri),
                    target: "_blank",
                    rel: "noopener noreferrer",
                });
                (cls.iri);
            }
            for (const [cls] of __VLS_getVForSourceType((__VLS_ctx.objectPropertyDetails.rangeSubclasses))) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({
                    key: ('object-range-sub-merged-' + cls.iri),
                    ...{ class: "nested-class-row" },
                });
                __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
                    ...{ onClick: (...[$event]) => {
                            if (!(__VLS_ctx.activeDetailsKind))
                                return;
                            if (!!(__VLS_ctx.activeDetailsKind === 'class' && __VLS_ctx.classDetails))
                                return;
                            if (!!(__VLS_ctx.activeDetailsKind === 'data' && __VLS_ctx.dataPropertyDetails))
                                return;
                            if (!(__VLS_ctx.activeDetailsKind === 'object' && __VLS_ctx.objectPropertyDetails))
                                return;
                            if (!(__VLS_ctx.objectPropertyDetails.ranges.length))
                                return;
                            __VLS_ctx.openClassFromProperty(cls.iri);
                        } },
                    ...{ class: "entity-link-btn nested-entity-link" },
                    type: "button",
                });
                (cls.label);
                __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
                __VLS_asFunctionalElement(__VLS_intrinsicElements.a, __VLS_intrinsicElements.a)({
                    ...{ class: "uri-link" },
                    href: (cls.iri),
                    target: "_blank",
                    rel: "noopener noreferrer",
                });
                (cls.iri);
            }
        }
        else {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
        }
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "grid two-columns" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
            ...{ class: "block" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({});
        if (__VLS_ctx.objectPropertyDetails.superproperties.length) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.ul, __VLS_intrinsicElements.ul)({});
            for (const [prop] of __VLS_getVForSourceType((__VLS_ctx.objectPropertyDetails.superproperties))) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({
                    key: (prop.iri),
                });
                __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
                    ...{ onClick: (...[$event]) => {
                            if (!(__VLS_ctx.activeDetailsKind))
                                return;
                            if (!!(__VLS_ctx.activeDetailsKind === 'class' && __VLS_ctx.classDetails))
                                return;
                            if (!!(__VLS_ctx.activeDetailsKind === 'data' && __VLS_ctx.dataPropertyDetails))
                                return;
                            if (!(__VLS_ctx.activeDetailsKind === 'object' && __VLS_ctx.objectPropertyDetails))
                                return;
                            if (!(__VLS_ctx.objectPropertyDetails.superproperties.length))
                                return;
                            __VLS_ctx.openRelatedProperty(prop);
                        } },
                    ...{ class: "entity-link-btn" },
                    type: "button",
                });
                (prop.label);
                __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
                __VLS_asFunctionalElement(__VLS_intrinsicElements.a, __VLS_intrinsicElements.a)({
                    ...{ onClick: () => { } },
                    ...{ class: "uri-link" },
                    href: (prop.iri),
                    target: "_blank",
                    rel: "noopener noreferrer",
                });
                (prop.iri);
            }
        }
        else {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
        }
        __VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
            ...{ class: "block" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({});
        if (__VLS_ctx.objectPropertyDetails.subproperties.length) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.ul, __VLS_intrinsicElements.ul)({});
            for (const [prop] of __VLS_getVForSourceType((__VLS_ctx.objectPropertyDetails.subproperties))) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({
                    key: (prop.iri),
                });
                __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
                    ...{ onClick: (...[$event]) => {
                            if (!(__VLS_ctx.activeDetailsKind))
                                return;
                            if (!!(__VLS_ctx.activeDetailsKind === 'class' && __VLS_ctx.classDetails))
                                return;
                            if (!!(__VLS_ctx.activeDetailsKind === 'data' && __VLS_ctx.dataPropertyDetails))
                                return;
                            if (!(__VLS_ctx.activeDetailsKind === 'object' && __VLS_ctx.objectPropertyDetails))
                                return;
                            if (!(__VLS_ctx.objectPropertyDetails.subproperties.length))
                                return;
                            __VLS_ctx.openRelatedProperty(prop);
                        } },
                    ...{ class: "entity-link-btn" },
                    type: "button",
                });
                (prop.label);
                __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
                __VLS_asFunctionalElement(__VLS_intrinsicElements.a, __VLS_intrinsicElements.a)({
                    ...{ onClick: () => { } },
                    ...{ class: "uri-link" },
                    href: (prop.iri),
                    target: "_blank",
                    rel: "noopener noreferrer",
                });
                (prop.iri);
            }
        }
        else {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
        }
    }
    if (__VLS_ctx.activeDetailsError) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
            ...{ class: "error" },
        });
        (__VLS_ctx.activeDetailsError);
    }
}
/** @type {__VLS_StyleScopedClasses['rico-helper-page']} */ ;
/** @type {__VLS_StyleScopedClasses['header-row']} */ ;
/** @type {__VLS_StyleScopedClasses['error']} */ ;
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['tabs-card']} */ ;
/** @type {__VLS_StyleScopedClasses['tab-row']} */ ;
/** @type {__VLS_StyleScopedClasses['tab-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['search-card']} */ ;
/** @type {__VLS_StyleScopedClasses['search-row']} */ ;
/** @type {__VLS_StyleScopedClasses['error']} */ ;
/** @type {__VLS_StyleScopedClasses['result-list']} */ ;
/** @type {__VLS_StyleScopedClasses['result-item']} */ ;
/** @type {__VLS_StyleScopedClasses['uri-link']} */ ;
/** @type {__VLS_StyleScopedClasses['tab-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['search-card']} */ ;
/** @type {__VLS_StyleScopedClasses['hierarchy-search-card']} */ ;
/** @type {__VLS_StyleScopedClasses['error']} */ ;
/** @type {__VLS_StyleScopedClasses['tree-scroll-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['tree-root']} */ ;
/** @type {__VLS_StyleScopedClasses['tab-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['search-card']} */ ;
/** @type {__VLS_StyleScopedClasses['search-row']} */ ;
/** @type {__VLS_StyleScopedClasses['error']} */ ;
/** @type {__VLS_StyleScopedClasses['result-list']} */ ;
/** @type {__VLS_StyleScopedClasses['result-item']} */ ;
/** @type {__VLS_StyleScopedClasses['uri-link']} */ ;
/** @type {__VLS_StyleScopedClasses['tab-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['search-card']} */ ;
/** @type {__VLS_StyleScopedClasses['search-row']} */ ;
/** @type {__VLS_StyleScopedClasses['error']} */ ;
/** @type {__VLS_StyleScopedClasses['result-list']} */ ;
/** @type {__VLS_StyleScopedClasses['result-item']} */ ;
/** @type {__VLS_StyleScopedClasses['uri-link']} */ ;
/** @type {__VLS_StyleScopedClasses['details-modal-backdrop']} */ ;
/** @type {__VLS_StyleScopedClasses['details-card']} */ ;
/** @type {__VLS_StyleScopedClasses['details-modal']} */ ;
/** @type {__VLS_StyleScopedClasses['details-modal-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['icon-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['close-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['entity-header']} */ ;
/** @type {__VLS_StyleScopedClasses['entity-iri']} */ ;
/** @type {__VLS_StyleScopedClasses['uri-link']} */ ;
/** @type {__VLS_StyleScopedClasses['description-box']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['two-columns']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['entity-link-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['uri-link']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['entity-link-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['uri-link']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['prop-table']} */ ;
/** @type {__VLS_StyleScopedClasses['filter-row']} */ ;
/** @type {__VLS_StyleScopedClasses['column-filter-input']} */ ;
/** @type {__VLS_StyleScopedClasses['column-filter-input']} */ ;
/** @type {__VLS_StyleScopedClasses['column-filter-input']} */ ;
/** @type {__VLS_StyleScopedClasses['column-filter-input']} */ ;
/** @type {__VLS_StyleScopedClasses['entity-link-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['uri-link']} */ ;
/** @type {__VLS_StyleScopedClasses['entity-link-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['entity-link-list']} */ ;
/** @type {__VLS_StyleScopedClasses['entity-link-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['prop-table']} */ ;
/** @type {__VLS_StyleScopedClasses['filter-row']} */ ;
/** @type {__VLS_StyleScopedClasses['column-filter-input']} */ ;
/** @type {__VLS_StyleScopedClasses['column-filter-input']} */ ;
/** @type {__VLS_StyleScopedClasses['column-filter-input']} */ ;
/** @type {__VLS_StyleScopedClasses['column-filter-input']} */ ;
/** @type {__VLS_StyleScopedClasses['entity-link-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['uri-link']} */ ;
/** @type {__VLS_StyleScopedClasses['entity-link-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['entity-link-list']} */ ;
/** @type {__VLS_StyleScopedClasses['entity-link-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['entity-iri']} */ ;
/** @type {__VLS_StyleScopedClasses['uri-link']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['two-columns']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['entity-link-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['uri-link']} */ ;
/** @type {__VLS_StyleScopedClasses['nested-class-row']} */ ;
/** @type {__VLS_StyleScopedClasses['entity-link-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['nested-entity-link']} */ ;
/** @type {__VLS_StyleScopedClasses['uri-link']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['entity-link-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['uri-link']} */ ;
/** @type {__VLS_StyleScopedClasses['nested-class-row']} */ ;
/** @type {__VLS_StyleScopedClasses['entity-link-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['nested-entity-link']} */ ;
/** @type {__VLS_StyleScopedClasses['uri-link']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['two-columns']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['entity-link-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['uri-link']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['entity-link-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['uri-link']} */ ;
/** @type {__VLS_StyleScopedClasses['entity-iri']} */ ;
/** @type {__VLS_StyleScopedClasses['uri-link']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['two-columns']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['entity-link-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['uri-link']} */ ;
/** @type {__VLS_StyleScopedClasses['nested-class-row']} */ ;
/** @type {__VLS_StyleScopedClasses['entity-link-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['nested-entity-link']} */ ;
/** @type {__VLS_StyleScopedClasses['uri-link']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['entity-link-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['uri-link']} */ ;
/** @type {__VLS_StyleScopedClasses['nested-class-row']} */ ;
/** @type {__VLS_StyleScopedClasses['entity-link-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['nested-entity-link']} */ ;
/** @type {__VLS_StyleScopedClasses['uri-link']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['two-columns']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['entity-link-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['uri-link']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['entity-link-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['uri-link']} */ ;
/** @type {__VLS_StyleScopedClasses['error']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            RicoClassTreeNode: RicoClassTreeNode,
            activeTab: activeTab,
            activeDetailsKind: activeDetailsKind,
            classSearchText: classSearchText,
            classIsSearching: classIsSearching,
            classHasSearched: classHasSearched,
            classSearchError: classSearchError,
            classSearchResults: classSearchResults,
            selectedClassIri: selectedClassIri,
            classDetails: classDetails,
            treeExpanded: treeExpanded,
            treeError: treeError,
            dataPropertySearchText: dataPropertySearchText,
            dataPropertyIsSearching: dataPropertyIsSearching,
            dataPropertyHasSearched: dataPropertyHasSearched,
            dataPropertyError: dataPropertyError,
            dataPropertyResults: dataPropertyResults,
            selectedDataPropertyIri: selectedDataPropertyIri,
            dataPropertyDetails: dataPropertyDetails,
            objectPropertySearchText: objectPropertySearchText,
            objectPropertyIsSearching: objectPropertyIsSearching,
            objectPropertyHasSearched: objectPropertyHasSearched,
            objectPropertyError: objectPropertyError,
            objectPropertyResults: objectPropertyResults,
            selectedObjectPropertyIri: selectedObjectPropertyIri,
            objectPropertyDetails: objectPropertyDetails,
            domainPropertyFilters: domainPropertyFilters,
            rangePropertyFilters: rangePropertyFilters,
            loadError: loadError,
            treeChildrenByParent: treeChildrenByParent,
            treeRootNodes: treeRootNodes,
            activeDetailsError: activeDetailsError,
            filteredClassPropertiesByDomain: filteredClassPropertiesByDomain,
            filteredClassPropertiesByRange: filteredClassPropertiesByRange,
            toggleTreeNode: toggleTreeNode,
            runClassSearch: runClassSearch,
            selectClass: selectClass,
            selectClassFromTree: selectClassFromTree,
            runPropertySearch: runPropertySearch,
            selectProperty: selectProperty,
            openClassFromProperty: openClassFromProperty,
            openRelatedProperty: openRelatedProperty,
            closeDetailsModal: closeDetailsModal,
            activateTab: activateTab,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
