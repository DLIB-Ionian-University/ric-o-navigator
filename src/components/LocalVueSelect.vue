<template>
  <div ref="rootEl" class="vselect-lite">
    <button type="button" class="vselect-trigger" @click="toggleOpen">
      <span :class="{ placeholder: !selectedOption }">{{ selectedOption ? selectedOption.displayLabel : placeholder }}</span>
      <span class="caret">▾</span>
    </button>

    <div v-if="isOpen" class="vselect-menu">
      <input
        v-model="searchText"
        type="text"
        class="vselect-search"
        placeholder="Search..."
        @click.stop
      />
      <ul v-if="filteredOptions.length" class="vselect-list">
        <li v-for="option in filteredOptions" :key="option.iri">
          <button type="button" class="vselect-option" @click="selectOption(option.iri)">
            {{ option.displayLabel }}
          </button>
        </li>
      </ul>
      <p v-else class="empty-state">No classes found</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

type SelectOption = {
  iri: string;
  displayLabel: string;
};

const props = withDefaults(
  defineProps<{
    modelValue: string;
    options: SelectOption[];
    placeholder?: string;
  }>(),
  {
    placeholder: 'Select...'
  }
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

const rootEl = ref<HTMLElement | null>(null);
const isOpen = ref(false);
const searchText = ref('');

const selectedOption = computed(() => props.options.find((option) => option.iri === props.modelValue) ?? null);
const filteredOptions = computed(() => {
  const q = searchText.value.trim().toLocaleLowerCase();
  if (!q) return props.options;
  return props.options.filter((option) => option.displayLabel.toLocaleLowerCase().includes(q));
});

const toggleOpen = () => {
  isOpen.value = !isOpen.value;
  if (isOpen.value) searchText.value = '';
};

const closeIfOutside = (event: MouseEvent) => {
  const target = event.target as Node | null;
  if (!target || !rootEl.value) return;
  if (!rootEl.value.contains(target)) isOpen.value = false;
};

const selectOption = (iri: string) => {
  emit('update:modelValue', iri);
  isOpen.value = false;
};

onMounted(() => {
  window.addEventListener('mousedown', closeIfOutside);
});

onBeforeUnmount(() => {
  window.removeEventListener('mousedown', closeIfOutside);
});
</script>

<style scoped>
.vselect-lite {
  position: relative;
  width: 100%;
}
.vselect-trigger {
  width: 100%;
  height: 38px;
  border: 1px solid #c2d4e3;
  border-radius: 8px;
  padding: 8px 10px;
  font: inherit;
  color: #16384f;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  text-align: left;
  cursor: pointer;
}
.placeholder {
  color: #60798e;
}
.caret {
  color: #4a667b;
  font-size: 0.8rem;
}
.vselect-menu {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  z-index: 15;
  border: 1px solid #c2d4e3;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 8px 18px rgba(18, 47, 68, 0.14);
  padding: 8px;
}
.vselect-search {
  width: 100%;
  height: 34px;
  border: 1px solid #c2d4e3;
  border-radius: 6px;
  padding: 6px 8px;
  font: inherit;
  box-sizing: border-box;
}
.vselect-search:focus {
  outline: none;
  border-color: #2f709f;
  box-shadow: 0 0 0 3px rgba(47, 112, 159, 0.16);
}
.vselect-list {
  margin: 8px 0 0;
  padding: 0;
  list-style: none;
  max-height: 220px;
  overflow: auto;
  display: grid;
  gap: 4px;
}
.vselect-option {
  width: 100%;
  border: none;
  background: #f7fbff;
  border-radius: 6px;
  padding: 7px 8px;
  color: #19374c;
  text-align: left;
  font: inherit;
  cursor: pointer;
}
.vselect-option:hover {
  background: #e9f4fc;
}
.empty-state {
  margin: 8px 0 0;
  color: #4e687d;
  font-size: 0.9rem;
}
</style>
