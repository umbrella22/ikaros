<template>
  <div class="hello-world">
    <h2>{{ greeting }}</h2>
    <p class="message">{{ message }}</p>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  name: {
    type: String,
    default: 'World',
  },
  message: {
    type: String,
    default: 'This component is from ikaros vue3 library example.',
  },
})

const greeting = computed(() => `Hello, ${props.name}!`)
</script>

<style scoped>
.hello-world {
  padding: 16px 24px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  text-align: center;
  font-family: sans-serif;
}

.hello-world h2 {
  margin: 0 0 8px;
  color: #42b883;
}

.hello-world .message {
  margin: 0;
  color: #666;
  font-size: 14px;
}
</style>
