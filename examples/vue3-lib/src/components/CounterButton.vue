<template>
  <button class="counter-btn" @click="count++">
    {{ label }} {{ count }}
  </button>
</template>

<script setup>
import { ref } from 'vue'

defineProps({
  label: {
    type: String,
    default: 'Count:',
  },
})

const count = ref(0)
</script>

<style scoped>
.counter-btn {
  padding: 8px 16px;
  font-size: 14px;
  color: #fff;
  background-color: #42b883;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.counter-btn:hover {
  background-color: #36a273;
}
</style>
