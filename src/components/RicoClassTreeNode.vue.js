import { computed } from 'vue';
const props = defineProps();
const children = computed(() => props.childrenByParent[props.node.iri] ?? []);
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({
    ...{ class: "tree-node" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "tree-row" },
});
if (__VLS_ctx.children.length > 0) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.children.length > 0))
                    return;
                __VLS_ctx.toggleNode(__VLS_ctx.node.iri);
            } },
        type: "button",
        ...{ class: "tree-toggle" },
    });
    (__VLS_ctx.expandedMap[__VLS_ctx.node.iri] ? '▾' : '▸');
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "tree-spacer" },
    });
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.onSelect(__VLS_ctx.node.iri);
        } },
    type: "button",
    ...{ class: "tree-label" },
});
(__VLS_ctx.node.label);
if (__VLS_ctx.children.length > 0 && __VLS_ctx.expandedMap[__VLS_ctx.node.iri]) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.ul, __VLS_intrinsicElements.ul)({
        ...{ class: "tree-children" },
    });
    for (const [child] of __VLS_getVForSourceType((__VLS_ctx.children))) {
        const __VLS_0 = {}.RicoClassTreeNode;
        /** @type {[typeof __VLS_components.RicoClassTreeNode, ]} */ ;
        // @ts-ignore
        const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
            key: (child.iri),
            node: (child),
            childrenByParent: (__VLS_ctx.childrenByParent),
            expandedMap: (__VLS_ctx.expandedMap),
            toggleNode: (__VLS_ctx.toggleNode),
            onSelect: (__VLS_ctx.onSelect),
        }));
        const __VLS_2 = __VLS_1({
            key: (child.iri),
            node: (child),
            childrenByParent: (__VLS_ctx.childrenByParent),
            expandedMap: (__VLS_ctx.expandedMap),
            toggleNode: (__VLS_ctx.toggleNode),
            onSelect: (__VLS_ctx.onSelect),
        }, ...__VLS_functionalComponentArgsRest(__VLS_1));
    }
}
/** @type {__VLS_StyleScopedClasses['tree-node']} */ ;
/** @type {__VLS_StyleScopedClasses['tree-row']} */ ;
/** @type {__VLS_StyleScopedClasses['tree-toggle']} */ ;
/** @type {__VLS_StyleScopedClasses['tree-spacer']} */ ;
/** @type {__VLS_StyleScopedClasses['tree-label']} */ ;
/** @type {__VLS_StyleScopedClasses['tree-children']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            children: children,
        };
    },
    __typeProps: {},
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
    __typeProps: {},
});
; /* PartiallyEnd: #4569/main.vue */
