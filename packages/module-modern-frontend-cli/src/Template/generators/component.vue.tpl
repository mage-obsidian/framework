<template>
    <div class="__KEBAB__">
        <h2 class="text-xl font-semibold">{{ title }}</h2>
    </div>
</template>

<script setup>
// __COMPONENT_NAME__ — scaffolded by mage-obsidian:generate:component.
defineProps({
    /** Heading text rendered by the component. */
    title: { type: String, default: "__COMPONENT_NAME__" },
});
</script>
