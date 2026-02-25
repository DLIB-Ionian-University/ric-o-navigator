<template>
  <section class="rico-helper-page">
    <div class="header-row">
      <div class="title-row">
        <img :src="appLogoUrl" alt="RiC-O Navigator logo" class="app-logo" />
        <h1>RiC-O Navigator</h1>
      </div>
      <p v-if="loadError" class="error">{{ loadError }}</p>
    </div>

    <article class="card tabs-card">
      <div class="tab-row">
        <button type="button" :class="['tab-btn', { active: activeTab === 'classes' }]" @click="activateTab('classes')">Search classes</button>
        <button type="button" :class="['tab-btn', { active: activeTab === 'tree' }]" @click="activateTab('tree')">Class hierarchy</button>
        <button
          type="button"
          :class="['tab-btn', { active: activeTab === 'data-properties' }]"
          @click="activateTab('data-properties')"
        >
          Search data properties
        </button>
        <button
          type="button"
          :class="['tab-btn', { active: activeTab === 'object-properties' }]"
          @click="activateTab('object-properties')"
        >
          Search object properties
        </button>
        <button
          type="button"
          :class="['tab-btn', { active: activeTab === 'playground' }]"
          @click="activateTab('playground')"
        >
          Nav Playground
        </button>
      </div>

      <section v-if="activeTab === 'classes'" class="tab-panel">
        <article class="search-card">
          <form class="search-row" @submit.prevent="runClassSearch">
            <input v-model="classSearchText" type="text" placeholder="Search RiC-O class/entity" />
            <button type="submit">Search</button>
          </form>

          <p v-if="classSearchError" class="error">{{ classSearchError }}</p>
          <div v-if="classSearchResults.length > 0" class="result-list">
            <button
              v-for="entity in classSearchResults"
              :key="entity.iri"
              class="result-item"
              :class="{ active: selectedClassIri === entity.iri }"
              type="button"
              @click="selectClass(entity.iri)"
            >
              <strong>{{ entity.label }}</strong>
              <small><a class="uri-link" :href="entity.iri" target="_blank" rel="noopener noreferrer" @click.stop>{{ entity.iri }}</a></small>
              <small v-if="entity.description">{{ entity.description }}</small>
            </button>
          </div>
          <p v-else-if="classHasSearched && !classIsSearching">No classes found.</p>
        </article>
      </section>

      <section v-else-if="activeTab === 'tree'" class="tab-panel">
        <article class="search-card hierarchy-search-card">
          <p v-if="treeError" class="error">{{ treeError }}</p>
          <div class="tree-scroll-panel">
            <ul class="tree-root" v-if="treeRootNodes.length > 0">
              <RicoClassTreeNode
                v-for="node in treeRootNodes"
                :key="node.iri"
                :node="node"
                :children-by-parent="treeChildrenByParent"
                :expanded-map="treeExpanded"
                :toggle-node="toggleTreeNode"
                :on-select="selectClassFromTree"
              />
            </ul>
            <p v-else>No class hierarchy data available.</p>
          </div>
        </article>
      </section>

      <section v-else-if="activeTab === 'data-properties'" class="tab-panel">
        <article class="search-card">
          <form class="search-row" @submit.prevent="runPropertySearch('data')">
            <input v-model="dataPropertySearchText" type="text" placeholder="Search data properties" />
            <button type="submit">Search</button>
          </form>

          <p v-if="dataPropertyError" class="error">{{ dataPropertyError }}</p>
          <div v-if="dataPropertyResults.length > 0" class="result-list">
            <button
              v-for="prop in dataPropertyResults"
              :key="prop.iri"
              class="result-item"
              :class="{ active: selectedDataPropertyIri === prop.iri }"
              type="button"
              @click="selectProperty('data', prop.iri)"
            >
              <strong>{{ prop.label }}</strong>
              <small><a class="uri-link" :href="prop.iri" target="_blank" rel="noopener noreferrer" @click.stop>{{ prop.iri }}</a></small>
              <small v-if="prop.description">{{ prop.description }}</small>
            </button>
          </div>
          <p v-else-if="dataPropertyHasSearched && !dataPropertyIsSearching">No data properties found.</p>
        </article>
      </section>

      <section v-else-if="activeTab === 'object-properties'" class="tab-panel">
        <article class="search-card">
          <form class="search-row" @submit.prevent="runPropertySearch('object')">
            <input v-model="objectPropertySearchText" type="text" placeholder="Search object properties" />
            <button type="submit">Search</button>
          </form>

          <p v-if="objectPropertyError" class="error">{{ objectPropertyError }}</p>
          <div v-if="objectPropertyResults.length > 0" class="result-list">
            <button
              v-for="prop in objectPropertyResults"
              :key="prop.iri"
              class="result-item"
              :class="{ active: selectedObjectPropertyIri === prop.iri }"
              type="button"
              @click="selectProperty('object', prop.iri)"
            >
              <strong>{{ prop.label }}</strong>
              <small><a class="uri-link" :href="prop.iri" target="_blank" rel="noopener noreferrer" @click.stop>{{ prop.iri }}</a></small>
              <small v-if="prop.description">{{ prop.description }}</small>
            </button>
          </div>
          <p v-else-if="objectPropertyHasSearched && !objectPropertyIsSearching">No object properties found.</p>
        </article>
      </section>

      <section v-else-if="activeTab === 'playground'" class="tab-panel">
        <article class="playground-card">
          <div class="playground-grid">
            <section class="playground-controls">
              <h3>Create graph</h3>
              <p class="playground-hint">Add classes as nodes, then connect them with RiC-O properties.</p>

              <div class="playground-control-group">
                <label for="playground-class-select">Class/Literal</label>
                <div class="playground-action-row">
                  <LocalVueSelect
                    id="playground-class-select"
                    v-model="playgroundSelectedClassIri"
                    :options="playgroundClassHierarchyOptions"
                    placeholder="Select a class or literal"
                  />
                  <div class="playground-action-buttons">
                    <button
                      v-if="playgroundSelectedClassForInfo"
                      type="button"
                      class="icon-btn info-icon-btn"
                      title="Show class details"
                      aria-label="Show class details"
                      @click="openPlaygroundClassInfo"
                    >
                      i
                    </button>
                    <button type="button" class="secondary-btn" @click="addPlaygroundNode">Add node</button>
                  </div>
                </div>
              </div>

              <div class="playground-control-group">
                <label for="playground-source-select">Source node</label>
                <select id="playground-source-select" v-model="playgroundEdgeSourceId">
                  <option value="">No source selected</option>
                  <option v-for="node in playgroundNodes" :key="`source-${node.id}`" :value="node.id">
                    {{ node.id }} - {{ node.label }}
                  </option>
                </select>
              </div>

              <div class="playground-control-group">
                <label for="playground-property-select">Property</label>
                <div class="playground-action-row">
                  <select id="playground-property-select" v-model="playgroundSelectedPropertyIri">
                    <option value="" disabled>Select property</option>
                    <optgroup v-for="group in playgroundPropertyGroups" :key="group.label" :label="group.label">
                      <option v-for="prop in group.options" :key="prop.iri" :value="prop.iri">
                        {{ prop.label }}
                      </option>
                    </optgroup>
                  </select>
                  <button
                    v-if="playgroundSelectedPropertyForInfo"
                    type="button"
                    class="icon-btn info-icon-btn"
                    title="Show property details"
                    aria-label="Show property details"
                    @click="openPlaygroundPropertyInfo"
                  >
                    i
                  </button>
                </div>
              </div>

              <div class="playground-control-group">
                <label for="playground-target-select">Target node</label>
                <div class="playground-action-row">
                  <select id="playground-target-select" v-model="playgroundEdgeTargetId">
                    <option value="">No target selected</option>
                    <option v-for="node in playgroundNodes" :key="`target-${node.id}`" :value="node.id">
                      {{ node.id }} - {{ node.label }}
                    </option>
                  </select>
                  <button type="button" class="secondary-btn" @click="addPlaygroundEdge">Add edge</button>
                </div>
              </div>

              <div class="playground-action-row">
                <button type="button" class="secondary-btn" @click="clearPlaygroundGraph">Clear graph</button>
              </div>
              <div class="playground-action-row export-row">
                <button type="button" class="secondary-btn export-btn" :disabled="!hasPlaygroundGraph" @click="exportPlaygroundSvg">Export SVG</button>
                <button type="button" class="secondary-btn export-btn" :disabled="!hasPlaygroundGraph" @click="exportPlaygroundPng">Export PNG</button>
                <button type="button" class="secondary-btn export-btn" :disabled="!hasPlaygroundGraph" @click="exportPlaygroundJpg">Export JPG</button>
              </div>

              <p v-if="playgroundError" class="error">{{ playgroundError }}</p>

              <div class="playground-list">
                <h4>Nodes ({{ playgroundNodes.length }})</h4>
                <ul v-if="playgroundNodes.length">
                  <li v-for="node in playgroundNodes" :key="`list-${node.id}`">
                    <span>{{ node.id }}: {{ node.label }}</span>
                    <button
                      type="button"
                      class="icon-btn delete-icon-btn"
                      title="Delete node"
                      aria-label="Delete node"
                      @click="removePlaygroundNode(node.id)"
                    >
                      X
                    </button>
                  </li>
                </ul>
                <p v-else>No nodes yet.</p>
              </div>

              <div class="playground-list">
                <h4>Edges ({{ playgroundEdges.length }})</h4>
                <ul v-if="playgroundEdges.length">
                  <li v-for="edge in playgroundEdges" :key="`edge-${edge.id}`">
                    <span>{{ edge.sourceId }}:{{ edge.sourceLabel }} -{{ edge.label }}→ {{ edge.targetId }}:{{ edge.targetLabel }}</span>
                    <button
                      type="button"
                      class="icon-btn delete-icon-btn"
                      title="Delete edge"
                      aria-label="Delete edge"
                      @click="removePlaygroundEdge(edge.id)"
                    >
                      X
                    </button>
                  </li>
                </ul>
                <p v-else>No edges yet.</p>
              </div>
            </section>

            <section class="playground-canvas">
              <div class="playground-canvas-toolbar">
                <button type="button" class="icon-btn zoom-btn" title="Zoom out" aria-label="Zoom out" @click="zoomOutPlayground">-</button>
                <span class="zoom-label">{{ Math.round(playgroundZoom * 100) }}%</span>
                <button type="button" class="icon-btn zoom-btn" title="Zoom in" aria-label="Zoom in" @click="zoomInPlayground">+</button>
                <button type="button" class="secondary-btn zoom-reset-btn" @click="resetPlaygroundZoom">Reset</button>
              </div>
              <v-network-graph
                v-if="playgroundNodes.length"
                ref="playgroundGraphRef"
                class="playground-network"
                :nodes="playgroundNetworkNodes"
                :edges="playgroundNetworkEdges"
                v-model:layouts="playgroundNetworkLayouts"
                v-model:zoom-level="playgroundZoom"
                :configs="playgroundNetworkConfigs"
              >
                <template #override-node-label="{ nodeId, x, y, textAnchor, dominantBaseline }">
                  <text :x="x" :y="y" :text-anchor="textAnchor" :dominant-baseline="dominantBaseline">
                    <tspan class="playground-node-title-label">{{ playgroundNodeLabelById[nodeId]?.title ?? '' }}</tspan>
                    <tspan x="0" dy="12" class="playground-node-id-label">{{ playgroundNodeLabelById[nodeId]?.id ?? '' }}</tspan>
                  </text>
                </template>
                <template #edge-label="{ edgeId, area }">
                  <text
                    class="playground-edge-text-label"
                    :x="(area.source.above.x + area.target.above.x) / 2"
                    :y="(area.source.above.y + area.target.above.y) / 2 - 5"
                    text-anchor="middle"
                  >
                    {{ playgroundEdgeLabelById[edgeId] ?? '' }}
                  </text>
                </template>
              </v-network-graph>
              <p v-else class="playground-empty">Add class nodes to start building a graph.</p>
            </section>
          </div>
        </article>
      </section>

      <div v-if="activeDetailsKind" class="details-modal-backdrop" @click.self="closeDetailsModal">
        <article class="details-card details-modal">
          <div class="details-modal-actions">
            <button type="button" class="icon-btn close-btn" @click="closeDetailsModal" title="Close details">✕</button>
          </div>

          <template v-if="activeDetailsKind === 'class' && classDetails">
          <div class="entity-header">
            <div>
              <h2>{{ classDetails.entity.label }}</h2>
              <p class="entity-iri"><a class="uri-link" :href="classDetails.entity.iri " target="_blank" rel="noopener noreferrer">{{ classDetails.entity.iri  }}</a></p>
            </div>
          </div>

          <section class="description-box" v-if="classDetails.entity.description">
            <h3>Description</h3>
            <p>{{ classDetails.entity.description }}</p>
          </section>

          <section class="block" v-if="classDetails.scopeNotes.length">
            <h3>Scope Notes</h3>
            <ul>
              <li v-for="(note, idx) in classDetails.scopeNotes" :key="`${idx}-${note.slice(0, 20)}`">{{ note }}</li>
            </ul>
          </section>

          <section class="block" v-if="classDetails.ricCmNotes.length">
            <h3>RiC-CM Corresponding Component</h3>
            <ul>
              <li v-for="(note, idx) in classDetails.ricCmNotes" :key="`riccm-${idx}-${note.slice(0, 20)}`">{{ note }}</li>
            </ul>
          </section>

          <div class="grid two-columns">
            <section class="block">
              <h3>Superclasses</h3>
              <ul v-if="classDetails.superclasses.length">
                <li v-for="cls in classDetails.superclasses" :key="cls.iri">
                  <button v-if="!isLiteralIri(cls.iri)" class="entity-link-btn" type="button" @click="selectClass(cls.iri)">{{ cls.label }}</button>
                  <span v-else class="entity-text">{{ cls.label }}</span>
                  <small v-if="!isLiteralIri(cls.iri)"><a class="uri-link" :href="cls.iri" target="_blank" rel="noopener noreferrer">{{ cls.iri }}</a></small>
                  <small v-else>{{ cls.iri }}</small>
                </li>
              </ul>
              <p v-else>No superclasses found.</p>
            </section>

            <section class="block">
              <h3>Subclasses</h3>
              <ul v-if="classDetails.subclasses.length">
                <li v-for="cls in classDetails.subclasses" :key="cls.iri">
                  <button v-if="!isLiteralIri(cls.iri)" class="entity-link-btn" type="button" @click="selectClass(cls.iri)">{{ cls.label }}</button>
                  <span v-else class="entity-text">{{ cls.label }}</span>
                  <small v-if="!isLiteralIri(cls.iri)"><a class="uri-link" :href="cls.iri" target="_blank" rel="noopener noreferrer">{{ cls.iri }}</a></small>
                  <small v-else>{{ cls.iri }}</small>
                </li>
              </ul>
              <p v-else>No subclasses found.</p>
            </section>
          </div>

          <section class="block">
            <div class="class-props-head">
              <h3 v-if="classPropertyTableMode === 'domain'">Properties With Domain (Inherited Included)</h3>
              <h3 v-else>Properties With Range (Inherited Included)</h3>
              <div class="class-props-toggle">
                <button
                  type="button"
                  :class="['mini-toggle-btn', { active: classPropertyTableMode === 'domain' }]"
                  @click="classPropertyTableMode = 'domain'"
                >
                  Domain
                </button>
                <button
                  type="button"
                  :class="['mini-toggle-btn', { active: classPropertyTableMode === 'range' }]"
                  @click="classPropertyTableMode = 'range'"
                >
                  Range
                </button>
              </div>
            </div>

            <table v-if="classPropertyTableMode === 'domain' ? classDetails.propertiesByDomain.length : classDetails.propertiesByRange.length" class="prop-table">
              <thead>
                <tr v-if="classPropertyTableMode === 'domain'">
                  <th>Property</th>
                  <th>Type</th>
                  <th>Domain Class</th>
                  <th>Range Class</th>
                </tr>
                <tr v-else>
                  <th>Property</th>
                  <th>Type</th>
                  <th>Range Class</th>
                  <th>Domain Class</th>
                </tr>
                <tr class="filter-row" v-if="classPropertyTableMode === 'domain'">
                  <th><input v-model="domainPropertyFilters.property" class="column-filter-input" type="text" placeholder="Filter property" /></th>
                  <th><input v-model="domainPropertyFilters.type" class="column-filter-input" type="text" placeholder="Filter type" /></th>
                  <th><input v-model="domainPropertyFilters.sourceClass" class="column-filter-input" type="text" placeholder="Filter domain class" /></th>
                  <th><input v-model="domainPropertyFilters.relatedClass" class="column-filter-input" type="text" placeholder="Filter range class" /></th>
                </tr>
                <tr class="filter-row" v-else>
                  <th><input v-model="rangePropertyFilters.property" class="column-filter-input" type="text" placeholder="Filter property" /></th>
                  <th><input v-model="rangePropertyFilters.type" class="column-filter-input" type="text" placeholder="Filter type" /></th>
                  <th><input v-model="rangePropertyFilters.sourceClass" class="column-filter-input" type="text" placeholder="Filter range class" /></th>
                  <th><input v-model="rangePropertyFilters.relatedClass" class="column-filter-input" type="text" placeholder="Filter domain class" /></th>
                </tr>
              </thead>

              <tbody v-if="classPropertyTableMode === 'domain'">
                <tr v-for="prop in filteredClassPropertiesByDomain" :key="`${prop.iri}|domain|${prop.viaClassIri}`">
                  <td>
                    <button
                      class="entity-link-btn"
                      type="button"
                      @click="openRelatedProperty({ iri: prop.iri, label: prop.label, description: '', kind: prop.kind })"
                    >
                      {{ prop.label }}
                    </button>
                    <small><a class="uri-link" :href="prop.iri" target="_blank" rel="noopener noreferrer" @click.stop>{{ prop.iri }}</a></small>
                  </td>
                  <td>{{ prop.kind }}</td>
                  <td>
                    <button v-if="!isLiteralIri(prop.viaClassIri)" class="entity-link-btn" type="button" @click="selectClass(prop.viaClassIri)">{{ prop.viaClassLabel }}</button>
                    <span v-else class="entity-text">{{ prop.viaClassLabel }}</span>
                  </td>
                  <td>
                    <div v-if="prop.relatedEntities.length" class="entity-link-list">
                      <template v-for="entity in prop.relatedEntities" :key="`${prop.iri}-range-${entity.iri}`">
                        <button
                          v-if="!isLiteralIri(entity.iri)"
                          class="entity-link-btn"
                          type="button"
                          @click="selectClass(entity.iri)"
                        >
                          {{ entity.label }}
                        </button>
                        <span v-else class="entity-text">{{ entity.label }}</span>
                      </template>
                    </div>
                    <small v-else>-</small>
                  </td>
                </tr>

                <tr v-if="!filteredClassPropertiesByDomain.length">
                  <td colspan="4">No matching domain properties found.</td>
                </tr>
              </tbody>

              <tbody v-else>
                <tr v-for="prop in filteredClassPropertiesByRange" :key="`${prop.iri}|range|${prop.viaClassIri}`">
                  <td>
                    <button
                      class="entity-link-btn"
                      type="button"
                      @click="openRelatedProperty({ iri: prop.iri, label: prop.label, description: '', kind: prop.kind })"
                    >
                      {{ prop.label }}
                    </button>
                    <small><a class="uri-link" :href="prop.iri" target="_blank" rel="noopener noreferrer" @click.stop>{{ prop.iri }}</a></small>
                  </td>
                  <td>{{ prop.kind }}</td>
                  <td>
                    <button v-if="!isLiteralIri(prop.viaClassIri)" class="entity-link-btn" type="button" @click="selectClass(prop.viaClassIri)">{{ prop.viaClassLabel }}</button>
                    <span v-else class="entity-text">{{ prop.viaClassLabel }}</span>
                  </td>
                  <td>
                    <div v-if="prop.relatedEntities.length" class="entity-link-list">
                      <template v-for="entity in prop.relatedEntities" :key="`${prop.iri}-domain-${entity.iri}`">
                        <button
                          v-if="!isLiteralIri(entity.iri)"
                          class="entity-link-btn"
                          type="button"
                          @click="selectClass(entity.iri)"
                        >
                          {{ entity.label }}
                        </button>
                        <span v-else class="entity-text">{{ entity.label }}</span>
                      </template>
                    </div>
                    <small v-else>-</small>
                  </td>
                </tr>

                <tr v-if="!filteredClassPropertiesByRange.length">
                  <td colspan="4">No matching range properties found.</td>
                </tr>
              </tbody>
            </table>
            <p v-else>
              {{ classPropertyTableMode === 'domain' ? 'No matching domain properties found.' : 'No matching range properties found.' }}
            </p>
          </section>
        </template>

                <template v-else-if="activeDetailsKind === 'data' && dataPropertyDetails">
          <h2>{{ dataPropertyDetails.property.label }}</h2>
          <p class="entity-iri"><a class="uri-link" :href="dataPropertyDetails.property.iri " target="_blank" rel="noopener noreferrer">{{ dataPropertyDetails.property.iri  }}</a></p>

          <section class="block" v-if="dataPropertyDetails.comments.length">
            <h3>Definition</h3>
            <ul>
              <li v-for="(comment, index) in dataPropertyDetails.comments" :key="'data-comment-' + index">{{ comment }}</li>
            </ul>
          </section>

          <div class="grid two-columns">
            <section class="block">
              <h3>Domain Class</h3>
              <ul v-if="dataPropertyDetails.domains.length">
                <li v-for="cls in dataPropertyDetails.domains" :key="cls.iri">
                  <button v-if="!isLiteralIri(cls.iri)" class="entity-link-btn" type="button" @click="openClassFromProperty(cls.iri)">{{ cls.label }}</button>
                  <span v-else class="entity-text">{{ cls.label }}</span>
                  <small v-if="!isLiteralIri(cls.iri)"><a class="uri-link" :href="cls.iri" target="_blank" rel="noopener noreferrer">{{ cls.iri }}</a></small>
                  <small v-else>{{ cls.iri }}</small>
                </li>
                <li v-for="cls in dataPropertyDetails.domainSubclasses" :key="'data-domain-sub-merged-' + cls.iri" class="nested-class-row">
                  <button v-if="!isLiteralIri(cls.iri)" class="entity-link-btn nested-entity-link" type="button" @click="openClassFromProperty(cls.iri)">{{ cls.label }}</button>
                  <span v-else class="entity-text nested-entity-link">{{ cls.label }}</span>
                  <small v-if="!isLiteralIri(cls.iri)"><a class="uri-link" :href="cls.iri" target="_blank" rel="noopener noreferrer">{{ cls.iri }}</a></small>
                  <small v-else>{{ cls.iri }}</small>
                </li>
              </ul>
              <p v-else>No domain classes.</p>
            </section>
            <section class="block">
              <h3>Range Class</h3>
              <ul v-if="dataPropertyDetails.ranges.length">
                <li v-for="cls in dataPropertyDetails.ranges" :key="cls.iri">
                  <button v-if="!isLiteralIri(cls.iri)" class="entity-link-btn" type="button" @click="openClassFromProperty(cls.iri)">{{ cls.label }}</button>
                  <span v-else class="entity-text">{{ cls.label }}</span>
                  <small v-if="!isLiteralIri(cls.iri)"><a class="uri-link" :href="cls.iri" target="_blank" rel="noopener noreferrer">{{ cls.iri }}</a></small>
                  <small v-else>{{ cls.iri }}</small>
                </li>
                <li v-for="cls in dataPropertyDetails.rangeSubclasses" :key="'data-range-sub-merged-' + cls.iri" class="nested-class-row">
                  <button v-if="!isLiteralIri(cls.iri)" class="entity-link-btn nested-entity-link" type="button" @click="openClassFromProperty(cls.iri)">{{ cls.label }}</button>
                  <span v-else class="entity-text nested-entity-link">{{ cls.label }}</span>
                  <small v-if="!isLiteralIri(cls.iri)"><a class="uri-link" :href="cls.iri" target="_blank" rel="noopener noreferrer">{{ cls.iri }}</a></small>
                  <small v-else>{{ cls.iri }}</small>
                </li>
              </ul>
              <p v-else>No range classes.</p>
            </section>
          </div>
          <div class="grid two-columns">
            <section class="block">
              <h3>Superproperties</h3>
              <ul v-if="dataPropertyDetails.superproperties.length">
                <li v-for="prop in dataPropertyDetails.superproperties" :key="prop.iri">
                  <button class="entity-link-btn" type="button" @click="openRelatedProperty(prop)">{{ prop.label }}</button>
                  <small><a class="uri-link" :href="prop.iri" target="_blank" rel="noopener noreferrer" @click.stop>{{ prop.iri }}</a></small>
                </li>
              </ul>
              <p v-else>No superproperties.</p>
            </section>
            <section class="block">
              <h3>Subproperties</h3>
              <ul v-if="dataPropertyDetails.subproperties.length">
                <li v-for="prop in dataPropertyDetails.subproperties" :key="prop.iri">
                  <button class="entity-link-btn" type="button" @click="openRelatedProperty(prop)">{{ prop.label }}</button>
                  <small><a class="uri-link" :href="prop.iri" target="_blank" rel="noopener noreferrer" @click.stop>{{ prop.iri }}</a></small>
                </li>
              </ul>
              <p v-else>No subproperties.</p>
            </section>
          </div>
        </template>

        <template v-else-if="activeDetailsKind === 'object' && objectPropertyDetails">
          <h2>{{ objectPropertyDetails.property.label }}</h2>
          <p class="entity-iri"><a class="uri-link" :href="objectPropertyDetails.property.iri " target="_blank" rel="noopener noreferrer">{{ objectPropertyDetails.property.iri  }}</a></p>

          <section class="block" v-if="objectPropertyDetails.comments.length">
            <h3>Definition</h3>
            <ul>
              <li v-for="(comment, index) in objectPropertyDetails.comments" :key="'object-comment-' + index">{{ comment }}</li>
            </ul>
          </section>

          <div class="grid two-columns">
            <section class="block">
              <h3>Domain Class</h3>
              <ul v-if="objectPropertyDetails.domains.length">
                <li v-for="cls in objectPropertyDetails.domains" :key="cls.iri">
                  <button v-if="!isLiteralIri(cls.iri)" class="entity-link-btn" type="button" @click="openClassFromProperty(cls.iri)">{{ cls.label }}</button>
                  <span v-else class="entity-text">{{ cls.label }}</span>
                  <small v-if="!isLiteralIri(cls.iri)"><a class="uri-link" :href="cls.iri" target="_blank" rel="noopener noreferrer">{{ cls.iri }}</a></small>
                  <small v-else>{{ cls.iri }}</small>
                </li>
                <li v-for="cls in objectPropertyDetails.domainSubclasses" :key="'object-domain-sub-merged-' + cls.iri" class="nested-class-row">
                  <button v-if="!isLiteralIri(cls.iri)" class="entity-link-btn nested-entity-link" type="button" @click="openClassFromProperty(cls.iri)">{{ cls.label }}</button>
                  <span v-else class="entity-text nested-entity-link">{{ cls.label }}</span>
                  <small v-if="!isLiteralIri(cls.iri)"><a class="uri-link" :href="cls.iri" target="_blank" rel="noopener noreferrer">{{ cls.iri }}</a></small>
                  <small v-else>{{ cls.iri }}</small>
                </li>
              </ul>
              <p v-else>No domain classes.</p>
            </section>
            <section class="block">
              <h3>Range Class</h3>
              <ul v-if="objectPropertyDetails.ranges.length">
                <li v-for="cls in objectPropertyDetails.ranges" :key="cls.iri">
                  <button v-if="!isLiteralIri(cls.iri)" class="entity-link-btn" type="button" @click="openClassFromProperty(cls.iri)">{{ cls.label }}</button>
                  <span v-else class="entity-text">{{ cls.label }}</span>
                  <small v-if="!isLiteralIri(cls.iri)"><a class="uri-link" :href="cls.iri" target="_blank" rel="noopener noreferrer">{{ cls.iri }}</a></small>
                  <small v-else>{{ cls.iri }}</small>
                </li>
                <li v-for="cls in objectPropertyDetails.rangeSubclasses" :key="'object-range-sub-merged-' + cls.iri" class="nested-class-row">
                  <button v-if="!isLiteralIri(cls.iri)" class="entity-link-btn nested-entity-link" type="button" @click="openClassFromProperty(cls.iri)">{{ cls.label }}</button>
                  <span v-else class="entity-text nested-entity-link">{{ cls.label }}</span>
                  <small v-if="!isLiteralIri(cls.iri)"><a class="uri-link" :href="cls.iri" target="_blank" rel="noopener noreferrer">{{ cls.iri }}</a></small>
                  <small v-else>{{ cls.iri }}</small>
                </li>
              </ul>
              <p v-else>No range classes.</p>
            </section>
          </div>
          <div class="grid two-columns">
            <section class="block">
              <h3>Superproperties</h3>
              <ul v-if="objectPropertyDetails.superproperties.length">
                <li v-for="prop in objectPropertyDetails.superproperties" :key="prop.iri">
                  <button class="entity-link-btn" type="button" @click="openRelatedProperty(prop)">{{ prop.label }}</button>
                  <small><a class="uri-link" :href="prop.iri" target="_blank" rel="noopener noreferrer" @click.stop>{{ prop.iri }}</a></small>
                </li>
              </ul>
              <p v-else>No superproperties.</p>
            </section>
            <section class="block">
              <h3>Subproperties</h3>
              <ul v-if="objectPropertyDetails.subproperties.length">
                <li v-for="prop in objectPropertyDetails.subproperties" :key="prop.iri">
                  <button class="entity-link-btn" type="button" @click="openRelatedProperty(prop)">{{ prop.label }}</button>
                  <small><a class="uri-link" :href="prop.iri" target="_blank" rel="noopener noreferrer" @click.stop>{{ prop.iri }}</a></small>
                </li>
              </ul>
              <p v-else>No subproperties.</p>
            </section>
          </div>
          </template>

          <p v-if="activeDetailsError" class="error">{{ activeDetailsError }}</p>
        </article>
      </div>
    </article>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import RicoClassTreeNode from './components/RicoClassTreeNode.vue';
import LocalVueSelect from './components/LocalVueSelect.vue';
import type { UserConfigs, VNetworkGraphInstance } from 'v-network-graph';

type TabKey = 'classes' | 'tree' | 'data-properties' | 'object-properties' | 'playground';
type DetailsKind = 'class' | 'data' | 'object' | '';

type RicoEntitySummary = {
  iri: string;
  label: string;
  description: string;
};

type RicoClassRef = {
  iri: string;
  label: string;
  ricCmNotes: string[];
};

type RicoPropertyRef = {
  iri: string;
  label: string;
  kind: 'object' | 'data' | 'other';
  matchedBy: 'domain' | 'range';
  viaClassIri: string;
  viaClassLabel: string;
  relatedEntities: RicoClassRef[];
};

type RicoEntityDetails = {
  entity: RicoEntitySummary;
  scopeNotes: string[];
  ricCmNotes: string[];
  superclasses: RicoClassRef[];
  subclasses: RicoClassRef[];
  propertiesByDomain: RicoPropertyRef[];
  propertiesByRange: RicoPropertyRef[];
};

type RicoTreeNode = {
  iri: string;
  label: string;
  parentIris: string[];
};

type RicoPropertySummary = {
  iri: string;
  label: string;
  description: string;
  kind: 'object' | 'data' | 'other';
};

type RicoPropertyDetails = {
  property: RicoPropertySummary;
  comments: string[];
  domains: RicoClassRef[];
  ranges: RicoClassRef[];
  domainSubclasses: RicoClassRef[];
  rangeSubclasses: RicoClassRef[];
  superproperties: RicoPropertySummary[];
  subproperties: RicoPropertySummary[];
};

type NavigatorClass = {
  iri: string;
  label: string;
  scopeNotes: string[];
  comments: string[];
  ricCmNotes: string[];
  superclasses: string[];
};

type NavigatorProperty = {
  iri: string;
  label: string;
  description: string;
  comments: string[];
  kind: 'object' | 'data' | 'other';
  domains: string[];
  ranges: string[];
  superproperties: string[];
  subproperties: string[];
};

type NavigatorData = {
  generatedAt: string;
  sourceFile: string;
  classes: NavigatorClass[];
  properties: NavigatorProperty[];
};

type PlaygroundNode = {
  id: string;
  classIri: string;
  label: string;
  shortLabel: string;
};

type PlaygroundEdge = {
  id: string;
  sourceId: string;
  targetId: string;
  propertyIri: string;
  label: string;
  shortLabel: string;
  sourceLabel: string;
  targetLabel: string;
};

type PlaygroundPropertyOption = {
  iri: string;
  label: string;
  kind: 'object' | 'data';
};

type PlaygroundPropertyInfo = {
  iri: string;
  label: string;
  description: string;
  kind: 'object' | 'data';
};

const LITERAL_NODE_IRI = '__literal__';

const activeTab = ref<TabKey>('classes');
const activeDetailsKind = ref<DetailsKind>('');

const classSearchText = ref('');
const classIsSearching = ref(false);
const classHasSearched = ref(false);
const classSearchError = ref('');
const classDetailsError = ref('');
const classSearchResults = ref<RicoEntitySummary[]>([]);
const selectedClassIri = ref('');
const classDetails = ref<RicoEntityDetails | null>(null);

const treeNodes = ref<RicoTreeNode[]>([]);
const treeExpanded = ref<Record<string, boolean>>({});
const treeError = ref('');

const dataPropertySearchText = ref('');
const dataPropertyIsSearching = ref(false);
const dataPropertyHasSearched = ref(false);
const dataPropertyError = ref('');
const dataPropertyResults = ref<RicoPropertySummary[]>([]);
const selectedDataPropertyIri = ref('');
const dataPropertyDetails = ref<RicoPropertyDetails | null>(null);

const objectPropertySearchText = ref('');
const objectPropertyIsSearching = ref(false);
const objectPropertyHasSearched = ref(false);
const objectPropertyError = ref('');
const objectPropertyResults = ref<RicoPropertySummary[]>([]);
const selectedObjectPropertyIri = ref('');
const objectPropertyDetails = ref<RicoPropertyDetails | null>(null);

const domainPropertyFilters = ref({ property: '', type: '', sourceClass: '', relatedClass: '' });
const rangePropertyFilters = ref({ property: '', type: '', sourceClass: '', relatedClass: '' });
const classPropertyTableMode = ref<'domain' | 'range'>('domain');

const allClasses = ref<NavigatorClass[]>([]);
const allProperties = ref<NavigatorProperty[]>([]);
const loadError = ref('');

const playgroundSelectedClassIri = ref('');
const playgroundSelectedPropertyIri = ref('');
const playgroundEdgeSourceId = ref('');
const playgroundEdgeTargetId = ref('');
const playgroundNodes = ref<PlaygroundNode[]>([]);
const playgroundEdges = ref<PlaygroundEdge[]>([]);
const playgroundError = ref('');
const playgroundNodeCounter = ref(1);
const playgroundEdgeCounter = ref(1);

const playgroundBaseWidth = 960;
const playgroundBaseHeight = 560;
const playgroundGraphRef = ref<VNetworkGraphInstance | null>(null);
const playgroundZoom = ref(1);
const appBaseUrl = import.meta.env.BASE_URL;
const appLogoUrl = `${appBaseUrl}rico-logo.svg`;
const dataJsonUrl = `${appBaseUrl}rico-data.json`;

const localName = (iri: string) => {
  const hash = iri.lastIndexOf('#');
  if (hash >= 0 && hash < iri.length - 1) return iri.slice(hash + 1);
  const slash = iri.lastIndexOf('/');
  if (slash >= 0 && slash < iri.length - 1) return iri.slice(slash + 1);
  return iri;
};

const isLiteralIri = (iri: string) => iri === LITERAL_NODE_IRI || localName(iri).toLocaleLowerCase() === 'literal';

const classesByIri = computed(() => new Map(allClasses.value.map((c) => [c.iri, c])));
const propertiesByIri = computed(() => new Map(allProperties.value.map((p) => [p.iri, p])));
const excludedNavigatorClassIris = new Set([
  'http://www.w3.org/2004/02/skos/core#ConceptScheme',
  'http://www.w3.org/2004/02/skos/core#Concept',
  'http://purl.org/vocommons/voaf#Vocabulary'
]);
const visibleClasses = computed(() => allClasses.value.filter((cls) => !excludedNavigatorClassIris.has(cls.iri)));

const subclassesBySuperclass = computed(() => {
  const out = new Map<string, Set<string>>();
  for (const cls of allClasses.value) {
    for (const parent of cls.superclasses) {
      const set = out.get(parent) ?? new Set<string>();
      set.add(cls.iri);
      out.set(parent, set);
    }
  }
  return out;
});

const subpropertiesBySuperproperty = computed(() => {
  const out = new Map<string, Set<string>>();
  for (const prop of allProperties.value) {
    for (const parent of prop.superproperties) {
      const set = out.get(parent) ?? new Set<string>();
      set.add(prop.iri);
      out.set(parent, set);
    }
  }
  return out;
});

const classRefFromIri = (iri: string): RicoClassRef => {
  const cls = classesByIri.value.get(iri);
  if (!cls) return { iri, label: localName(iri), ricCmNotes: [] };
  return { iri: cls.iri, label: cls.label, ricCmNotes: cls.ricCmNotes };
};

const sortByLabel = <T extends { label: string }>(rows: T[]) =>
  [...rows].sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));

const trimLabel = (text: string, max = 24) => (text.length <= max ? text : text.slice(0, max - 1) + '…');

const playgroundClassHierarchyOptions = computed(() => {
  const nodes = visibleClasses.value.map((cls) => ({
    iri: cls.iri,
    label: cls.label || localName(cls.iri),
    parents: cls.superclasses
  }));
  const byIri = new Map(nodes.map((node) => [node.iri, node]));
  const childrenByParent = new Map<string, string[]>();

  for (const node of nodes) {
    for (const parentIri of node.parents) {
      if (!byIri.has(parentIri)) continue;
      const children = childrenByParent.get(parentIri) ?? [];
      children.push(node.iri);
      childrenByParent.set(parentIri, children);
    }
  }

  for (const [parent, children] of childrenByParent.entries()) {
    childrenByParent.set(
      parent,
      children.sort((a, b) => {
        const aNode = byIri.get(a);
        const bNode = byIri.get(b);
        return (aNode?.label || '').localeCompare(bNode?.label || '', undefined, { sensitivity: 'base' });
      })
    );
  }

  const roots = nodes
    .filter((node) => !node.parents.some((parentIri) => byIri.has(parentIri)))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));

  const visited = new Set<string>();
  const out: { iri: string; displayLabel: string }[] = [];

  const visit = (iri: string, depth: number, trail: Set<string>) => {
    if (trail.has(iri)) return;
    if (visited.has(iri)) return;
    const node = byIri.get(iri);
    if (!node) return;

    visited.add(iri);
    trail.add(iri);
    out.push({
      iri,
      displayLabel: `${depth > 0 ? '-- '.repeat(depth) : ''}${node.label}`
    });

    const children = childrenByParent.get(iri) ?? [];
    for (const childIri of children) {
      visit(childIri, depth + 1, trail);
    }

    trail.delete(iri);
  };

  for (const root of roots) {
    visit(root.iri, 0, new Set<string>());
  }

  const unvisited = nodes
    .filter((node) => !visited.has(node.iri))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));

  for (const node of unvisited) {
    visit(node.iri, 0, new Set<string>());
  }

  return [{ iri: LITERAL_NODE_IRI, displayLabel: 'Literal' }, ...out];
});

const playgroundSelectedSourceNode = computed(() =>
  playgroundNodes.value.find((node) => node.id === playgroundEdgeSourceId.value) ?? null
);

const playgroundSelectedTargetNode = computed(() =>
  playgroundNodes.value.find((node) => node.id === playgroundEdgeTargetId.value) ?? null
);

const classMatchesIriConstraint = (selectedClassIri: string, constraints: string[]) => {
  if (!constraints.length) return false;
  const validClasses = new Set<string>([selectedClassIri, ...collectSuperclasses(selectedClassIri)]);
  return constraints.some((iri) => validClasses.has(iri));
};

const playgroundPropertyOptions = computed(() => {
  let rows = allProperties.value.filter(
    (prop): prop is NavigatorProperty & { kind: 'object' | 'data' } => prop.kind === 'data' || prop.kind === 'object'
  );

  const sourceNode = playgroundSelectedSourceNode.value;
  const targetNode = playgroundSelectedTargetNode.value;

  if (sourceNode) {
    if (sourceNode.classIri === LITERAL_NODE_IRI) return [];
    rows = rows.filter((prop) => classMatchesIriConstraint(sourceNode.classIri, prop.domains));
  }

  if (targetNode) {
    if (targetNode.classIri === LITERAL_NODE_IRI) {
      rows = rows.filter((prop) => prop.kind === 'data');
    } else {
      rows = rows.filter((prop) => classMatchesIriConstraint(targetNode.classIri, prop.ranges));
    }
  }

  return sortByLabel(rows.map((prop) => ({ iri: prop.iri, label: prop.label || localName(prop.iri), kind: prop.kind })));
});

const playgroundPropertyGroups = computed(() => {
  const objectOptions = playgroundPropertyOptions.value.filter((prop) => prop.kind === 'object');
  const dataOptions = playgroundPropertyOptions.value.filter((prop) => prop.kind === 'data');
  const groups: { label: string; options: PlaygroundPropertyOption[] }[] = [];
  if (objectOptions.length) groups.push({ label: 'Object properties', options: objectOptions });
  if (dataOptions.length) groups.push({ label: 'Data properties', options: dataOptions });
  return groups;
});

const playgroundNetworkNodes = computed(() =>
  Object.fromEntries(
    playgroundNodes.value.map((node) => [node.id, { name: `${node.shortLabel}\n${node.id.toLowerCase()}`, fullName: node.label }])
  )
);
const playgroundNodeLabelById = computed(() =>
  Object.fromEntries(playgroundNodes.value.map((node) => [node.id, { title: node.shortLabel, id: node.id.toLowerCase() }]))
);

const playgroundNetworkEdges = computed(() =>
  Object.fromEntries(playgroundEdges.value.map((edge) => [edge.id, { source: edge.sourceId, target: edge.targetId, name: edge.label }]))
);
const playgroundEdgeLabelById = computed(() => Object.fromEntries(playgroundEdges.value.map((edge) => [edge.id, edge.label])));

const playgroundNetworkLayouts = ref<{ nodes: Record<string, { x: number; y: number }> }>({ nodes: {} });

watch(
  playgroundNodes,
  (nodes) => {
    const next = { ...playgroundNetworkLayouts.value.nodes };
    const validIds = new Set(nodes.map((node) => node.id));
    for (const key of Object.keys(next)) {
      if (!validIds.has(key)) delete next[key];
    }
    for (const node of nodes) {
      if (!next[node.id]) {
        next[node.id] = { x: playgroundBaseWidth / 2, y: playgroundBaseHeight / 2 };
      }
    }
    playgroundNetworkLayouts.value = { nodes: next };
  },
  { deep: true, immediate: true }
);

const playgroundNetworkConfigs: UserConfigs = {
  view: {
    scalingObjects: true,
    minZoomLevel: 0.2,
    maxZoomLevel: 4,
    panEnabled: true,
    zoomEnabled: true,
    autoPanAndZoomOnLoad: 'center-content'
  },
  node: {
    normal: {
      type: 'rect',
      width: 140,
      height: 44,
      borderRadius: 10,
      radius: 10,
      color: '#e6f2fb',
      strokeColor: '#3f749a',
      strokeWidth: 1.3
    },
    hover: {
      type: 'rect',
      width: 140,
      height: 44,
      borderRadius: 10,
      radius: 10,
      color: '#e6f2fb',
      strokeColor: '#3f749a',
      strokeWidth: 1.3
    },
    draggable: true,
    selectable: false,
    label: {
      visible: true,
      text: 'name',
      fontSize: 11,
      lineHeight: 1.15,
      color: '#0f3047',
      direction: 'center',
      directionAutoAdjustment: false
    }
  },
  edge: {
    selectable: false,
    type: 'straight',
    normal: {
      width: 2,
      color: '#2f5e84',
      dasharray: 0,
      linecap: 'round',
      animate: false,
      animationSpeed: 50
    },
    marker: {
      source: {
        type: 'none',
        width: 5,
        height: 5,
        margin: -1,
        offset: 0,
        units: 'strokeWidth',
        color: null
      },
      target: {
        type: 'arrow',
        width: 5,
        height: 5,
        margin: -1,
        offset: 0,
        units: 'strokeWidth',
        color: null
      }
    },
    label: {
      visible: true,
      text: 'name',
      fontSize: 11,
      lineHeight: 1,
      color: '#1f4f74',
      margin: 5,
      padding: 2
    }
  }
} as any;

const playgroundSelectedClassForInfo = computed(() => classesByIri.value.get(playgroundSelectedClassIri.value) ?? null);
const playgroundSelectedPropertyForInfo = computed<PlaygroundPropertyInfo | null>(() => {
  const prop = propertiesByIri.value.get(playgroundSelectedPropertyIri.value);
  if (!prop || (prop.kind !== 'data' && prop.kind !== 'object')) return null;
  return {
    iri: prop.iri,
    label: prop.label || localName(prop.iri),
    description: prop.description || '',
    kind: prop.kind
  };
});
const hasPlaygroundGraph = computed(() => playgroundNodes.value.length > 0);

const uniqueClassRefs = (rows: RicoClassRef[]) => {
  const seen = new Set<string>();
  const out: RicoClassRef[] = [];
  for (const row of rows) {
    if (!row.iri || seen.has(row.iri)) continue;
    seen.add(row.iri);
    out.push(row);
  }
  return out;
};

const collectSuperclasses = (startIri: string) => {
  const out = new Set<string>();
  const visit = (iri: string) => {
    const cls = classesByIri.value.get(iri);
    if (!cls) return;
    for (const parent of cls.superclasses) {
      if (out.has(parent)) continue;
      out.add(parent);
      visit(parent);
    }
  };
  visit(startIri);
  return out;
};

const collectSubclasses = (startIri: string) => {
  const out = new Set<string>();
  const visit = (iri: string) => {
    const children = subclassesBySuperclass.value.get(iri);
    if (!children) return;
    for (const child of children) {
      if (out.has(child)) continue;
      out.add(child);
      visit(child);
    }
  };
  visit(startIri);
  return out;
};

const collectSuperproperties = (startIri: string) => {
  const out = new Set<string>();
  const visit = (iri: string) => {
    const prop = propertiesByIri.value.get(iri);
    if (!prop) return;
    for (const parent of prop.superproperties) {
      if (out.has(parent)) continue;
      out.add(parent);
      visit(parent);
    }
  };
  visit(startIri);
  return out;
};

const collectSubproperties = (startIri: string) => {
  const out = new Set<string>();
  const visit = (iri: string) => {
    const children = subpropertiesBySuperproperty.value.get(iri);
    if (!children) return;
    for (const child of children) {
      if (out.has(child)) continue;
      out.add(child);
      visit(child);
    }
  };
  visit(startIri);
  return out;
};

const treeChildrenByParent = computed<Record<string, RicoTreeNode[]>>(() => {
  const out: Record<string, RicoTreeNode[]> = {};
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
  if (activeDetailsKind.value === 'class') return classDetailsError.value;
  if (activeDetailsKind.value === 'data') return dataPropertyError.value;
  if (activeDetailsKind.value === 'object') return objectPropertyError.value;
  return '';
});

const valueContains = (value: string, query: string) => value.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());

const filteredClassPropertiesByDomain = computed(() => {
  if (!classDetails.value) return [];
  return classDetails.value.propertiesByDomain.filter((prop) => {
    const related = prop.relatedEntities.map((e) => e.label).join(' ');
    return (
      valueContains(prop.label, domainPropertyFilters.value.property) &&
      valueContains(prop.kind, domainPropertyFilters.value.type) &&
      valueContains(prop.viaClassLabel, domainPropertyFilters.value.sourceClass) &&
      valueContains(related, domainPropertyFilters.value.relatedClass)
    );
  });
});

const filteredClassPropertiesByRange = computed(() => {
  if (!classDetails.value) return [];
  return classDetails.value.propertiesByRange.filter((prop) => {
    const related = prop.relatedEntities.map((e) => e.label).join(' ');
    return (
      valueContains(prop.label, rangePropertyFilters.value.property) &&
      valueContains(prop.kind, rangePropertyFilters.value.type) &&
      valueContains(prop.viaClassLabel, rangePropertyFilters.value.sourceClass) &&
      valueContains(related, rangePropertyFilters.value.relatedClass)
    );
  });
});

const toggleTreeNode = (iri: string) => {
  treeExpanded.value = { ...treeExpanded.value, [iri]: !treeExpanded.value[iri] };
};

const runClassSearch = async () => {
  classIsSearching.value = true;
  classHasSearched.value = true;
  classSearchError.value = '';
  try {
    const q = classSearchText.value.trim().toLowerCase();
    let rows = visibleClasses.value.map((cls) => ({
      iri: cls.iri,
      label: cls.label,
      description: cls.scopeNotes[0] || cls.comments[0] || cls.ricCmNotes[0] || ''
    }));
    if (q) {
      rows = rows.filter((row) => (row.label + ' ' + row.iri + ' ' + localName(row.iri)).toLowerCase().includes(q));
    }
    classSearchResults.value = sortByLabel(rows);
  } catch (err) {
    classSearchError.value = err instanceof Error ? err.message : 'Unable to search RiC-O classes.';
    classSearchResults.value = [];
  } finally {
    classIsSearching.value = false;
  }
};

const buildClassDetails = (iri: string): RicoEntityDetails => {
  const cls = classesByIri.value.get(iri);
  if (!cls) throw new Error('RiC-O class not found: ' + iri);

  const superSet = collectSuperclasses(iri);
  const subSet = collectSubclasses(iri);
  const inheritanceSet = new Set<string>([iri, ...superSet]);

  const superclasses = sortByLabel(uniqueClassRefs([...superSet].map(classRefFromIri)));
  const subclasses = sortByLabel(uniqueClassRefs([...subSet].map(classRefFromIri)));

  const propertiesByDomain: RicoPropertyRef[] = [];
  const propertiesByRange: RicoPropertyRef[] = [];

  for (const prop of allProperties.value) {
    for (const domainIri of prop.domains) {
      if (!inheritanceSet.has(domainIri)) continue;
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
      if (!inheritanceSet.has(rangeIri)) continue;
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

  const uniqRows = (rows: RicoPropertyRef[]) => {
    const seen = new Set<string>();
    return rows.filter((row) => {
      const key = row.iri + '|' + row.matchedBy + '|' + row.viaClassIri;
      if (seen.has(key)) return false;
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

const selectClass = async (iri: string) => {
  selectedClassIri.value = iri;
  classDetailsError.value = '';
  activeDetailsKind.value = 'class';
  classPropertyTableMode.value = 'domain';
  domainPropertyFilters.value = { property: '', type: '', sourceClass: '', relatedClass: '' };
  rangePropertyFilters.value = { property: '', type: '', sourceClass: '', relatedClass: '' };
  try {
    classDetails.value = buildClassDetails(iri);
  } catch (err) {
    classDetailsError.value = err instanceof Error ? err.message : 'Unable to load class details.';
    classDetails.value = null;
  }
};

const selectClassFromTree = async (iri: string) => {
  await selectClass(iri);
};

const loadClassTree = async () => {
  treeError.value = '';
  try {
    const classIris = new Set(visibleClasses.value.map((c) => c.iri));
    treeNodes.value = sortByLabel(
      visibleClasses.value.map((cls) => ({
        iri: cls.iri,
        label: cls.label,
        parentIris: cls.superclasses.filter((iri) => classIris.has(iri))
      }))
    );
  } catch (err) {
    treeError.value = err instanceof Error ? err.message : 'Unable to load class tree.';
    treeNodes.value = [];
  }
};

const runPropertySearch = async (kind: 'data' | 'object') => {
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
  } catch (err) {
    errorRef.value = err instanceof Error ? err.message : 'Unable to search properties.';
    resultsRef.value = [];
  } finally {
    isSearchingRef.value = false;
  }
};

const buildPropertyDetails = (iri: string, kind: 'data' | 'object'): RicoPropertyDetails => {
  const prop = propertiesByIri.value.get(iri);
  if (!prop || prop.kind !== kind) throw new Error('RiC-O property not found: ' + iri);

  const domains = sortByLabel(uniqueClassRefs(prop.domains.map(classRefFromIri)));
  const ranges = sortByLabel(uniqueClassRefs(prop.ranges.map(classRefFromIri)));

  const domainSubclasses = sortByLabel(
    uniqueClassRefs(prop.domains.flatMap((classIri) => [...collectSubclasses(classIri)]).map(classRefFromIri))
  );

  const rangeSubclasses = sortByLabel(
    uniqueClassRefs(prop.ranges.flatMap((classIri) => [...collectSubclasses(classIri)]).map(classRefFromIri))
  );

  const toSummary = (propertyIri: string): RicoPropertySummary | null => {
    const item = propertiesByIri.value.get(propertyIri);
    if (!item) return null;
    return { iri: item.iri, label: item.label, description: item.description || '', kind: item.kind };
  };

  const superproperties = sortByLabel(
    [...collectSuperproperties(prop.iri)]
      .map(toSummary)
      .filter((item): item is RicoPropertySummary => Boolean(item))
  );

  const subproperties = sortByLabel(
    [...collectSubproperties(prop.iri)]
      .map(toSummary)
      .filter((item): item is RicoPropertySummary => Boolean(item))
  );

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

const selectProperty = async (kind: 'data' | 'object', iri: string) => {
  activeDetailsKind.value = kind;
  if (kind === 'data') selectedDataPropertyIri.value = iri;
  else selectedObjectPropertyIri.value = iri;

  try {
    const details = buildPropertyDetails(iri, kind);
    if (kind === 'data') dataPropertyDetails.value = details;
    else objectPropertyDetails.value = details;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unable to load property details.';
    if (kind === 'data') {
      dataPropertyError.value = message;
      dataPropertyDetails.value = null;
    } else {
      objectPropertyError.value = message;
      objectPropertyDetails.value = null;
    }
  }
};

const openClassFromProperty = async (iri: string) => {
  activeTab.value = 'classes';
  await selectClass(iri);
};

const openRelatedProperty = async (property: RicoPropertySummary) => {
  if (property.kind !== 'data' && property.kind !== 'object') return;
  activeTab.value = property.kind === 'data' ? 'data-properties' : 'object-properties';
  await selectProperty(property.kind, property.iri);
};

const closeDetailsModal = () => {
  activeDetailsKind.value = '';
};

const syncPlaygroundDefaults = () => {
  if (!playgroundSelectedClassIri.value && playgroundClassHierarchyOptions.value.length) {
    playgroundSelectedClassIri.value = playgroundClassHierarchyOptions.value[0].iri;
  }
  if (!playgroundSelectedPropertyIri.value && playgroundPropertyOptions.value.length) {
    playgroundSelectedPropertyIri.value = playgroundPropertyOptions.value[0].iri;
  }
};

watch(playgroundPropertyOptions, (options) => {
  if (playgroundSelectedPropertyIri.value && !options.some((option) => option.iri === playgroundSelectedPropertyIri.value)) {
    playgroundSelectedPropertyIri.value = '';
  }
});

const addPlaygroundNode = () => {
  playgroundError.value = '';
  if (!playgroundSelectedClassIri.value) {
    playgroundError.value = 'Select a class before adding a node.';
    return;
  }

  const nodeId = `n${playgroundNodeCounter.value++}`;
  const node: PlaygroundNode | null =
    playgroundSelectedClassIri.value === LITERAL_NODE_IRI
      ? {
          id: nodeId,
          classIri: LITERAL_NODE_IRI,
          label: 'Literal',
          shortLabel: 'Literal'
        }
      : (() => {
          const cls = classesByIri.value.get(playgroundSelectedClassIri.value);
          if (!cls) {
            playgroundError.value = 'Selected class was not found in loaded data.';
            return null;
          }
          return {
            id: nodeId,
            classIri: cls.iri,
            label: cls.label || localName(cls.iri),
            shortLabel: trimLabel(cls.label || localName(cls.iri), 20)
          };
        })();
  if (!node) return;
  playgroundNodes.value = [...playgroundNodes.value, node];
};

const removePlaygroundNode = (nodeId: string) => {
  playgroundNodes.value = playgroundNodes.value.filter((node) => node.id !== nodeId);
  playgroundEdges.value = playgroundEdges.value.filter((edge) => edge.sourceId !== nodeId && edge.targetId !== nodeId);

  if (playgroundEdgeSourceId.value === nodeId) playgroundEdgeSourceId.value = '';
  if (playgroundEdgeTargetId.value === nodeId) playgroundEdgeTargetId.value = '';
};

const addPlaygroundEdge = () => {
  playgroundError.value = '';

  if (playgroundNodes.value.length < 2) {
    playgroundError.value = 'Add at least two nodes before connecting them.';
    return;
  }

  if (!playgroundEdgeSourceId.value || !playgroundEdgeTargetId.value || !playgroundSelectedPropertyIri.value) {
    playgroundError.value = 'Select source node, property, and target node.';
    return;
  }

  if (playgroundEdgeSourceId.value === playgroundEdgeTargetId.value) {
    playgroundError.value = 'Source and target nodes must be different.';
    return;
  }

  const sourceNode = playgroundNodes.value.find((node) => node.id === playgroundEdgeSourceId.value);
  const targetNode = playgroundNodes.value.find((node) => node.id === playgroundEdgeTargetId.value);
  const prop = propertiesByIri.value.get(playgroundSelectedPropertyIri.value);

  if (!sourceNode || !targetNode || !prop) {
    playgroundError.value = 'Could not resolve the selected graph items.';
    return;
  }

  const isPropertyAllowed = playgroundPropertyOptions.value.some((option) => option.iri === prop.iri);
  if (!isPropertyAllowed) {
    playgroundError.value = 'Selected property is not valid for the selected source and target classes.';
    return;
  }

  const isDuplicate = playgroundEdges.value.some(
    (edge) =>
      edge.sourceId === sourceNode.id && edge.targetId === targetNode.id && edge.propertyIri === playgroundSelectedPropertyIri.value
  );
  if (isDuplicate) {
    playgroundError.value = 'This edge already exists.';
    return;
  }

  const edge: PlaygroundEdge = {
    id: `e${playgroundEdgeCounter.value++}`,
    sourceId: sourceNode.id,
    targetId: targetNode.id,
    propertyIri: prop.iri,
    label: prop.label || localName(prop.iri),
    shortLabel: trimLabel(prop.label || localName(prop.iri), 18),
    sourceLabel: sourceNode.label,
    targetLabel: targetNode.label
  };
  playgroundEdges.value = [...playgroundEdges.value, edge];
};

const removePlaygroundEdge = (edgeId: string) => {
  playgroundEdges.value = playgroundEdges.value.filter((edge) => edge.id !== edgeId);
};

const openPlaygroundClassInfo = async () => {
  if (!playgroundSelectedClassForInfo.value) return;
  await selectClass(playgroundSelectedClassForInfo.value.iri);
};

const openPlaygroundPropertyInfo = async () => {
  if (!playgroundSelectedPropertyForInfo.value) return;
  await selectProperty(playgroundSelectedPropertyForInfo.value.kind, playgroundSelectedPropertyForInfo.value.iri);
};

const zoomInPlayground = () => {
  playgroundGraphRef.value?.zoomIn();
};

const zoomOutPlayground = () => {
  playgroundGraphRef.value?.zoomOut();
};

const resetPlaygroundZoom = async () => {
  playgroundZoom.value = 1;
  await playgroundGraphRef.value?.panToCenter();
};

const buildPlaygroundSvgElement = async () => {
  if (!playgroundGraphRef.value) throw new Error('Graph preview is not ready.');
  return (await playgroundGraphRef.value.exportAsSvgElement()) as SVGSVGElement;
};

const buildPlaygroundSvgMarkup = async () => {
  const svgEl = await buildPlaygroundSvgElement();
  svgEl.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  return new XMLSerializer().serializeToString(svgEl);
};

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

const exportPlaygroundSvg = async () => {
  playgroundError.value = '';
  try {
    const svgMarkup = await buildPlaygroundSvgMarkup();
    const blob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
    downloadBlob(blob, 'rico-playground-graph.svg');
  } catch (err) {
    playgroundError.value = err instanceof Error ? err.message : 'Unable to export SVG.';
  }
};

const exportPlaygroundRaster = async (format: 'png' | 'jpg') => {
  playgroundError.value = '';
  try {
    const svgElement = await buildPlaygroundSvgElement();
    svgElement.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const svgMarkup = new XMLSerializer().serializeToString(svgElement);
    const svgBlob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);

    const img = new Image();
    try {
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Unable to render graph for export.'));
        img.src = svgUrl;
      });

      const svgViewBox = svgElement.viewBox.baseVal;
      const baseWidth = Math.max(1, Math.round(svgViewBox.width || img.width || playgroundBaseWidth));
      const baseHeight = Math.max(1, Math.round(svgViewBox.height || img.height || playgroundBaseHeight));
      const scale = 4;
      const exportWidth = baseWidth * scale;
      const exportHeight = baseHeight * scale;
      const canvas = document.createElement('canvas');
      canvas.width = exportWidth;
      canvas.height = exportHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Unable to create export canvas.');

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      if (format === 'jpg') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, exportWidth, exportHeight);
      }
      ctx.drawImage(img, 0, 0, exportWidth, exportHeight);

      const mime = format === 'png' ? 'image/png' : 'image/jpeg';
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mime, 0.95));
      if (!blob) throw new Error('Unable to encode exported image.');
      downloadBlob(blob, `rico-playground-graph.${format}`);
    } finally {
      URL.revokeObjectURL(svgUrl);
    }
  } catch (err) {
    playgroundError.value = err instanceof Error ? err.message : `Unable to export ${format.toUpperCase()}.`;
  }
};

const exportPlaygroundPng = async () => {
  await exportPlaygroundRaster('png');
};

const exportPlaygroundJpg = async () => {
  await exportPlaygroundRaster('jpg');
};

const clearPlaygroundGraph = () => {
  playgroundNodes.value = [];
  playgroundEdges.value = [];
  playgroundEdgeSourceId.value = '';
  playgroundEdgeTargetId.value = '';
  playgroundError.value = '';
  playgroundNodeCounter.value = 1;
  playgroundEdgeCounter.value = 1;
  playgroundNetworkLayouts.value = { nodes: {} };
  playgroundZoom.value = 1;
};

const activateTab = async (tab: TabKey) => {
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
    const res = await fetch(dataJsonUrl, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to load rico-data.json (' + res.status + ')');
    const payload = (await res.json()) as NavigatorData;
    allClasses.value = payload.classes ?? [];
    allProperties.value = payload.properties ?? [];
    syncPlaygroundDefaults();
  } catch (err) {
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
  syncPlaygroundDefaults();
});
</script>
<style scoped>
.rico-helper-page {
  display: grid;
  gap: 14px;
}
.header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.title-row {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}
.title-row h1 {
  margin: 0;
}
.app-logo {
  width: 34px;
  height: 34px;
  border-radius: 9px;
  box-shadow: 0 2px 6px rgba(20, 66, 98, 0.25);
}
.tabs-card {
  display: grid;
  gap: 12px;
}
.tab-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.tab-btn {
  border: 1px solid #9fb4c5;
  background: #f2f5f8;
  color: #21445f;
  border-radius: 8px;
  padding: 8px 12px;
}
.tab-btn.active {
  background: #1f4f74;
  color: #fff;
  border-color: #1f4f74;
}
.tab-panel {
  display: grid;
  gap: 12px;
}
.search-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  height: calc(100vh - 220px);
  min-height: 420px;
}
.hierarchy-search-card {
  height: calc(100vh - 220px);
}
.playground-card {
  height: calc(100vh - 220px);
  min-height: 420px;
  border: 1px solid #d2e0ea;
  border-radius: 12px;
  background: #f8fbff;
  padding: 12px;
}
.playground-grid {
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
  gap: 12px;
  height: 100%;
  min-height: 0;
}
.playground-controls {
  border: 1px solid #d0deea;
  border-radius: 10px;
  background: #ffffff;
  padding: 10px;
  overflow: auto;
  min-height: 0;
}
.playground-controls h3 {
  margin: 0;
}
.playground-hint {
  margin: 6px 0 10px;
  color: #3d596e;
  font-size: 0.92rem;
}
.playground-control-group {
  display: grid;
  gap: 6px;
  margin-bottom: 10px;
}
.playground-control-group label {
  font-size: 0.88rem;
  color: #29475e;
  font-weight: 600;
}
.playground-control-group select {
  width: 100%;
  height: 38px;
  border: 1px solid #c2d4e3;
  border-radius: 8px;
  padding: 8px 10px;
  font: inherit;
  color: #16384f;
  background: #fff;
}
.playground-action-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
  align-items: center;
}
.export-row {
  grid-template-columns: repeat(3, auto);
  justify-content: start;
  margin-top: 8px;
}
.playground-action-buttons {
  display: inline-flex;
  gap: 6px;
  align-items: center;
}
.secondary-btn {
  border: 1px solid #2c628a;
  background: #f4f9fd;
  color: #1f4f74;
  border-radius: 8px;
  padding: 8px 10px;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}
.secondary-btn:hover {
  background: #e9f4fc;
}
.secondary-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.export-btn {
  border-color: #1f5b84;
  background: linear-gradient(180deg, #2d78ab 0%, #1f5b84 100%);
  color: #fff;
  box-shadow: 0 2px 6px rgba(20, 66, 98, 0.2);
  padding: 6px 9px;
  font-size: 0.78rem;
  line-height: 1.1;
}
.export-btn:hover:not(:disabled) {
  text-decoration: underline;
  background: linear-gradient(180deg, #2d78ab 0%, #1f5b84 100%);
  filter: none;
}
.playground-list {
  margin-top: 10px;
}
.playground-list h4 {
  margin: 0 0 6px;
  font-size: 0.95rem;
  color: #24475f;
}
.playground-list ul {
  padding-left: 0;
}
.playground-list li {
  list-style: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  border: 1px solid #d7e3ed;
  border-radius: 8px;
  padding: 7px 8px;
  background: #fbfdff;
}
.inline-btn {
  border: 1px solid #cfddeb;
  background: #fff;
  color: #27516f;
  border-radius: 6px;
  padding: 4px 7px;
  font: inherit;
  font-size: 0.82rem;
  cursor: pointer;
}
.info-icon-btn {
  width: 32px;
  height: 32px;
  border-radius: 999px;
  font-weight: 700;
  font-size: 0.95rem;
  line-height: 1;
}
.delete-icon-btn {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  font-size: 0.78rem;
  font-weight: 700;
}
.playground-canvas {
  border: 1px solid #d0deea;
  border-radius: 10px;
  background: linear-gradient(180deg, #ffffff 0%, #f2f8fc 100%);
  overflow: auto;
  min-height: 0;
  display: flex;
  position: relative;
}
.playground-canvas-toolbar {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 3;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px;
  border: 1px solid #cdddea;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.92);
}
.zoom-btn {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: 700;
}
.zoom-label {
  min-width: 44px;
  text-align: center;
  color: #24475f;
  font-size: 0.82rem;
  font-weight: 700;
}
.zoom-reset-btn {
  padding: 6px 8px;
  font-size: 0.78rem;
}
.playground-network {
  width: 100%;
  height: 100%;
  display: block;
}
.playground-empty {
  margin: auto;
  color: #4a677d;
}
.playground-edge {
  stroke: #2f5e84;
  stroke-width: 2;
  opacity: 0.88;
}
.playground-edge-label {
  text-anchor: middle;
  font-size: 11px;
  fill: #1f4f74;
}
.playground-node {
  fill: #e6f2fb;
  stroke: #3f749a;
  stroke-width: 1.3;
}
.playground-node-title {
  text-anchor: middle;
  font-size: 12px;
  fill: #0f3047;
  font-weight: 700;
}
.playground-node-id {
  text-anchor: middle;
  font-size: 10px;
  fill: #5a7488;
  font-weight: 500;
}
.playground-node-group {
  cursor: grab;
}
.playground-node-group.dragging {
  cursor: grabbing;
}
.playground-node-title-label {
  fill: #0f3047;
  font-size: 12px;
  font-weight: 700;
}
.playground-node-id-label {
  fill: #5a7488;
  font-size: 10px;
  font-weight: 500;
}
.playground-edge-text-label {
  fill: #1f4f74;
  font-size: 11px;
}
.tree-scroll-panel {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding-right: 4px;
}
.search-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 10px;
  align-items: center;
}
.search-row input[type='text'] {
  border: 1px solid #b8cbdb;
  border-radius: 999px;
  padding: 10px 14px;
  font: inherit;
  color: #123247;
  background: linear-gradient(180deg, #ffffff 0%, #f7fbff 100%);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9), 0 1px 2px rgba(17, 52, 78, 0.08);
  transition: border-color 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease;
}
.search-row input[type='text']::placeholder {
  color: #5b7488;
}
.search-row input[type='text']:focus {
  outline: none;
  border-color: #2f709f;
  box-shadow: 0 0 0 3px rgba(47, 112, 159, 0.16), 0 2px 6px rgba(15, 54, 82, 0.16);
  background: #fff;
}
.search-row button[type='submit'] {
  border: 1px solid #1f5b84;
  background: linear-gradient(180deg, #2d78ab 0%, #1f5b84 100%);
  color: #fff;
  border-radius: 999px;
  padding: 10px 16px;
  font: inherit;
  font-weight: 600;
  letter-spacing: 0.01em;
  cursor: pointer;
  box-shadow: 0 2px 5px rgba(14, 53, 79, 0.24);
}
.search-row button[type='submit']:hover {
  filter: brightness(1.05);
}
.search-row button[type='submit']:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(47, 112, 159, 0.2), 0 2px 6px rgba(14, 53, 79, 0.24);
}
.result-list {
  display: grid;
  gap: 8px;
  flex: 1;
  min-height: 0;
  overflow: auto;
  align-content: start;
}
.result-item {
  text-align: left;
  border: 1px solid #cfdce8;
  border-radius: 8px;
  background: #f8fbff;
  color: #132a3c;
  padding: 8px 10px;
  display: grid;
  gap: 2px;
}
.result-item.active {
  border-color: #3e7fb0;
  background: #edf6ff;
}
.details-card {
  border: 1px solid #d5e0ea;
  border-radius: 10px;
  padding: 12px;
}
.details-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(8, 18, 28, 0.45);
  z-index: 1200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}
.details-modal {
  width: min(1100px, 100%);
  max-height: calc(100vh - 40px);
  overflow: auto;
  background: #ffffff;
}
.details-modal-actions {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 6px;
}
.icon-btn {
  border: 1px solid #b8c9d8;
  background: #f4f8fc;
  color: #1e3f59;
  border-radius: 8px;
  width: 32px;
  height: 32px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.close-btn {
  font-size: 0.95rem;
  line-height: 1;
}
.entity-header h2 {
  margin: 0;
}
.entity-iri {
  margin: 4px 0 0;
  color: #354f63;
  font-size: 0.9rem;
}
.uri-link {
  color: #1a4d73;
  text-decoration: underline;
  word-break: break-all;
}
.uri-link:hover {
  color: #0f3652;
}
.block {
  margin-top: 10px;
}
.description-box {
  margin-top: 10px;
  border: 1px solid #d6e2ec;
  background: #f7fbff;
  border-radius: 8px;
  padding: 10px;
}
.description-box h3 {
  margin: 0 0 6px;
}
.description-box p {
  margin: 0;
  color: #18384f;
}
.block h3 {
  margin: 0 0 8px;
}
.class-props-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}
.class-props-toggle {
  display: inline-flex;
  gap: 6px;
}
.mini-toggle-btn {
  border: 1px solid #afc6d8;
  background: #f5f9fc;
  color: #21445f;
  border-radius: 8px;
  padding: 5px 10px;
  font: inherit;
  font-size: 0.84rem;
  font-weight: 600;
  cursor: pointer;
}
.mini-toggle-btn.active {
  border-color: #1f5b84;
  background: #1f5b84;
  color: #fff;
}
.grid.two-columns {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}
ul {
  margin: 0;
  padding-left: 16px;
  display: grid;
  gap: 6px;
}
li small,
.result-item small,
.prop-table small {
  display: block;
  color: #40596d;
  word-break: break-all;
}
.entity-link-btn {
  border: none;
  background: transparent;
  color: #1a4d73;
  text-decoration: underline;
  padding: 0;
  cursor: pointer;
  text-align: left;
  font: inherit;
}
.entity-text {
  color: #21445f;
}
.entity-link-list {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.nested-class-row {
  margin-left: 16px;
  list-style: circle;
}
.nested-entity-link {
  opacity: 0.92;
}
.tree-root {
  margin: 0;
  padding: 0;
}
.prop-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}
.prop-table th,
.prop-table td {
  border: 1px solid #d3e0eb;
  padding: 8px;
  vertical-align: top;
}
.prop-table th {
  text-align: left;
  background: #f0f6fb;
}
.filter-row th {
  background: #f7fbff;
}
.column-filter-input {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
  display: block;
  border: 1px solid #c7d8e6;
  border-radius: 6px;
  padding: 6px 8px;
  font: inherit;
  color: #18384f;
  background: #fff;
}
.error {
  color: #9a2424;
}
@media (max-width: 900px) {
  .grid.two-columns {
    grid-template-columns: 1fr;
  }
  .playground-grid {
    grid-template-columns: 1fr;
  }
}
</style>
