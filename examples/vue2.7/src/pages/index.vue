<template>
  <div class="app">
    <img class="img" :src="avatar" />
    <div class="title">{{ present }}</div>
    <button class=" button" @click="runing = !runing">
      {{ runing ? 'stop' : 'start' }}
    </button>
  </div>
</template>

<script setup>
import { defineComponent } from 'vue'
import avatar from '../assets/avatar.png'
import useScroll from '../hooks/use-scroll'

defineComponent({
  name: 'page-index',
})

const { present, runing } = useScroll('Hi, welcome to Vue2 Template')
console.log("present", "runing")
</script>

<style lang="scss" scoped>
.app {
  position: absolute;
  top: 43%;
  left: 50%;
  width: 300px;
  text-align: center;
  transform: translate(-50%, -50%);

  img {
    width: 170px;
    height: 170px;
    border-radius: 50%;
    overflow: hidden;
  }

  button {
    padding: 5px 10px;
    font-size: 14px;
  }

  .title {
    height: 1.3em;
    margin: 30px 0;
    font-size: 23px;
    font-weight: bold;
    white-space: pre;
  }
}
</style>
