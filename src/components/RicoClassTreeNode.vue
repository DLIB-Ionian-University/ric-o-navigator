<template>
  <li class="tree-node">
    <div class="tree-row">
      <button v-if="children.length > 0" type="button" class="tree-toggle" @click="toggleNode(node.iri)">
        {{ expandedMap[node.iri] ? '▾' : '▸' }}
      </button>
      <span v-else class="tree-spacer"></span>

      <button type="button" class="tree-label" @click="onSelect(node.iri)">
        {{ node.label }}
      </button>
    </div>

    <ul v-if="children.length > 0 && expandedMap[node.iri]" class="tree-children">
      <RicoClassTreeNode
        v-for="child in children"
        :key="child.iri"
        :node="child"
        :children-by-parent="childrenByParent"
        :expanded-map="expandedMap"
        :toggle-node="toggleNode"
        :on-select="onSelect"
      />
    </ul>
  </li>
</template>

<script setup lang="ts">
import { computed } from 'vue';

type RicoTreeNode = {
  iri: string;
  label: string;
  parentIris: string[];
};

const props = defineProps<{
  node: RicoTreeNode;
  childrenByParent: Record<string, RicoTreeNode[]>;
  expandedMap: Record<string, boolean>;
  toggleNode: (iri: string) => void;
  onSelect: (iri: string) => void;
}>();

const children = computed(() => props.childrenByParent[props.node.iri] ?? []);
</script>

<style scoped>
.tree-node {
  list-style: none;
}
.tree-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 30px;
}
.tree-toggle {
  width: 22px;
  height: 22px;
  border: 1px solid #b9cad7;
  border-radius: 4px;
  background: #f2f8fd;
  color: #1d4058;
  padding: 0;
}
.tree-spacer {
  width: 22px;
  height: 22px;
  display: inline-block;
}
.tree-label {
  border: none;
  background: transparent;
  color: #103147;
  text-align: left;
  padding: 0;
  cursor: pointer;
  text-decoration: underline;
  font: inherit;
}
.tree-children {
  margin: 0;
  padding: 0 0 0 18px;
}
</style>
