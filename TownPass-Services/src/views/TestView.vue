<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import axios, { AxiosError } from 'axios';
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
const loading = ref(true);
const error = ref<string | null>(null);

async function fetchTaipeiSportsCenters() {
  const apiUrl = '/api/TaipeiSportsCenters';
  try {
    const response = await axios.post(apiUrl);
    console.log('TaipeiSportsCenters response data:', response);
    const rawData: {
      locationPeopleNums: {
        LID: string;
        lidName: string;
        swPeopleNum: number;
        swMaxPeopleNum: number;
        gymPeopleNum: number;
        gymMaxPeopleNum: number;
      }[];
    } = response.data;
    const dataItems = rawData.locationPeopleNums.map((item) => ({
      name: item.lidName,
      swimPeopleNum: item.swPeopleNum,
      swimPeopleNumMax: item.swMaxPeopleNum,
      gymPeopleNum: item.gymPeopleNum,
      gymPeopleNumMax: item.gymMaxPeopleNum,
      latitude: 0,
      longitude: 0
    }));
    return dataItems;
  } catch (err) {
    if (axios.isAxiosError(err)) {
      if (err.response) {
        throw Error(
          `TaipeiSportsCenters: Axios response error: ${err.response.status} ${err.response.statusText}`
        );
      } else if (err.request) {
        throw Error('TaipeiSportsCenters: Axios request error: No response received');
      } else {
        throw Error(`TaipeiSportsCenters: Axios error: ${err.message}`);
      }
    } else {
      throw Error('TaipeiSportsCenters: Unknown error: ' + String(err));
    }
  }
}

async function fetchAllData() {
  data.value = [];
  error.value = null;
  const allPromises = [fetchTaipeiSportsCenters()];
  const results = await Promise.allSettled(allPromises);
  results.forEach((result) => {
    if (result.status === 'fulfilled' && result.value) {
      data.value = data.value.concat(result.value);
    } else if (result.status === 'rejected') {
      console.error('Error fetching data:', result.reason);
      error.value += result.reason + ' ';
    }
  });
  loading.value = false;
}
let intervalId: number | null = null;
onMounted(() => {
  intervalId = setInterval(fetchAllData, 10 * 1000);
  loading.value = true;
  fetchAllData();
});
onUnmounted(() => {
  if (intervalId !== null) {
    clearInterval(intervalId);
  }
});
</script>
<template>
  <main>
    <div class="py-4">
      <h1 class="text-4xl font-bold text-center py-[100px] bg-red-500 text-green-500">Test View</h1>
      <div>data: {{ data }}</div>
      <div>error: {{ error }}</div>
      <div>loading: {{ loading }}</div>
    </div>
  </main>
</template>
