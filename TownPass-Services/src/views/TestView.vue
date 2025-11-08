<script setup lang="ts">
import { ref } from 'vue';
type DataItem = {
  name: string;
  swimPeopleNum: number;
  swimPeopleNumMax: number;
  gymPeopleNum: number;
  gymPeopleNumMax: number;
  latitude: number;
  longitude: number;
};
const data = ref<DataItem[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
</script>
<template>
  <main>
    <div class="py-4">
      <h1 class="text-4xl font-bold text-center py-[100px] bg-red-500 text-green-500">Test View</h1>
    </div>
  </main>
</template>
