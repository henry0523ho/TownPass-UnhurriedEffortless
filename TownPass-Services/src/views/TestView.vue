<template>
  <div class="center-status-container max-w-7xl mx-auto my-8 px-4 sm:px-6">
    <div
      class="header-bar mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6"
    >
      <h2 class="text-3xl font-bold text-gray-800 m-0">台北市運動中心即時人數</h2>

      <div class="sort-controls flex items-center flex-wrap gap-3" role="toolbar">
        <label for="sort-select" class="text-sm text-gray-600 whitespace-nowrap">排序方式：</label>

        <div class="relative">
          <select
            id="sort-select"
            v-model="sortBy"
            class="appearance-none block w-full sm:w-auto bg-white border border-gray-300 rounded-lg py-2.5 px-4 pr-10 text-sm shadow-sm cursor-pointer hover:bg-gray-50 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-150"
          >
            <option value="name">依名稱 (筆劃)</option>
            <option value="total">依總人數</option>
            <option value="gym">依健身房人數</option>
            <option value="swim">依游泳池人數</option>
          </select>
          <div
            class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-700"
          >
            <svg
              class="h-5 w-5"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fill-rule="evenodd"
                d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                clip-rule="evenodd"
              />
            </svg>
          </div>
        </div>

        <button
          @click="toggleSortDirection"
          class="sort-direction-btn min-w-[90px] text-left border border-gray-300 rounded-lg py-2.5 px-4 bg-white text-sm shadow-sm cursor-pointer hover:bg-gray-50 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-150"
        >
          {{ sortDirection === 'asc' ? '🔼 升冪' : '🔽 降冪' }}
        </button>

        <button
          class="border border-gray-300 rounded-lg p-2.5 bg-white text-sm shadow-sm cursor-pointer hover:bg-gray-50 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-150"
          @click.prevent="isShowLocaionModal = true"
        >
          <img src="@/assets/images/icon-geo.svg" alt="開啟地圖" class="h-5 w-5" />
        </button>
      </div>
    </div>

    <div
      v-if="loading"
      class="loading-message flex flex-col justify-center items-center gap-4 py-16 px-8 min-h-[200px] text-lg text-gray-600"
    >
      <div
        class="w-10 h-10 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin"
      ></div>
      正在從API獲取即時數據...
    </div>

    <div
      v-else-if="error"
      class="error-message text-center text-lg text-red-600 p-8 border border-red-600 bg-red-50 rounded-xl"
    >
      資料加載失敗：{{ error }}
    </div>

    <div
      v-else-if="data.length > 0"
      class="center-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-7"
    >
      <div
        v-for="center in sortedData"
        :key="center.name"
        class="center-card rounded-2xl p-6 bg-white shadow-md hover:shadow-xl hover:-translate-y-1.5 transition-all duration-200 ease-out"
      >
        <h3 class="mt-0 mb-4 text-gray-900 text-2xl font-semibold border-b border-gray-100 pb-3.5">
          {{ center.name }}
        </h3>

        <div class="facility-status mb-5 last:mb-0">
          <h4 class="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            🏊 游泳池
          </h4>
          <div class="status-display flex gap-6">
            <div class="data-point current-count flex flex-col items-center flex-1">
              <span class="label text-sm text-gray-500 mb-1.5">現在人數</span>
              <strong
                :class="[
                  'text-4xl font-bold tracking-tight',
                  getStatusColor(center.swimPeopleNum, center.swimPeopleNumMax)
                ]"
              >
                {{ center.swimPeopleNum }}
              </strong>
            </div>
            <div class="data-point capacity-count flex flex-col items-center flex-1">
              <span class="label text-sm text-gray-500 mb-1.5">總容量</span>
              <strong class="text-4xl font-bold tracking-tight text-blue-700">
                {{ center.swimPeopleNumMax }}
              </strong>
            </div>
          </div>
        </div>

        <div class="facility-status mb-5 last:mb-0">
          <h4 class="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            🏋️ 健身房
          </h4>
          <div class="status-display flex gap-6">
            <div class="data-point current-count flex flex-col items-center flex-1">
              <span class="label text-sm text-gray-500 mb-1.5">現在人數</span>
              <strong
                :class="[
                  'text-4xl font-bold tracking-tight',
                  getStatusColor(center.gymPeopleNum, center.gymPeopleNumMax)
                ]"
              >
                {{ center.gymPeopleNum }}
              </strong>
              >
            </div>
            <div class="data-point capacity-count flex flex-col items-center flex-1">
              <span class="label text-sm text-gray-500 mb-1.5">總容量</span>
              <strong class="text-4xl font-bold tracking-tight text-blue-700">
                {{ center.gymPeopleNumMax }}
              </strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, onUnmounted } from 'vue';
import axios from 'axios';

type DataItem = {
  name: string;
  swimPeopleNum?: number;
  swimPeopleNumMax?: number;
  gymPeopleNum?: number;
  gymPeopleNumMax?: number;
  latitude: number;
  longitude: number;
};

const initialCenters = [
  '北投',
  '大安',
  '大同',
  '中正',
  '內湖',
  '士林',
  '松山',
  '萬華',
  '文山',
  '信義',
  '中山',
  '南港'
];

function getLatLongByName(name: string): { latitude: number; longitude: number } {
  switch (name) {
    case '北投':
      return { latitude: 25.116499631184173, longitude: 121.50983145269343 };
    case '大安':
      return { latitude: 25.0207374694988, longitude: 121.54575719476065 };
    case '大同':
      return { latitude: 25.065371179032034, longitude: 121.51619920587748 };
    case '中正':
      return { latitude: 25.038517677819875, longitude: 121.51933133187974 };
    case '內湖':
      return { latitude: 25.078155736925535, longitude: 121.57476476642667 };
    case '士林':
      return { latitude: 25.08942122491574, longitude: 121.52156330976973 };
    case '松山':
      return { latitude: 25.04879199681975, longitude: 121.58187521229682 };
    case '萬華':
      return { latitude: 25.047456736404317, longitude: 121.50686764837137 };
    case '文山':
      return { latitude: 24.997014158084, longitude: 121.55945597940692 };
    case '信義':
      return { latitude: 25.031698544420017, longitude: 121.56676886503183 };
    case '中山':
      return { latitude: 25.05484192557673, longitude: 121.5213455316616 };
    case '南港':
      return { latitude: 25.04879289615886, longitude: 121.58187402886895 };
    default:
      return { latitude: 25.0375, longitude: 121.5625 };
  }
}

const data = ref<DataItem[]>(
  initialCenters.map((name) => ({
    name: name,
    swimPeopleNum: 0,
    swimPeopleNumMax: 0,
    gymPeopleNum: 0,
    gymPeopleNumMax: 0,
    latitude: getLatLongByName(name).latitude,
    longitude: getLatLongByName(name).longitude
  }))
);
const isShowLocaionModal = ref(false);
const loading = ref(true);
const error = ref<string | null>(null);

type SortKey = 'name' | 'total' | 'gym' | 'swim';
const sortBy = ref<SortKey>('name');
const sortDirection = ref<'asc' | 'desc'>('asc');

function toggleSortDirection() {
  sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc';
}

// ======================================================
// !!!! NEW FUNCTION !!!!
// 根據百分比回傳 Tailwind 顏色 class
// ======================================================
function getStatusColor(current?: number, max?: number): string {
  // 處理 'undefined' 或 max 為 0 的情況
  if (current === undefined || max === undefined || max === 0) {
    return 'text-green-500'; // 預設為綠色 (不擁擠)
  }

  const percentage = current / max;

  if (percentage > 0.5) {
    return 'text-red-500'; // 80% 以上 (紅色)
  }
  if (percentage >= 0.3) {
    return 'text-orange-500'; // 50% - 80% (橘色)
  }
  if (percentage >= 0.15) {
    return 'text-yellow-500'; // 30% - 50% (黃色)
  }
  return 'text-green-500'; // 30% 以下 (綠色)
}
// ======================================================

const sortedData = computed(() => {
  const dataCopy = [...data.value];

  dataCopy.sort((a, b) => {
    let comparison = 0;

    switch (sortBy.value) {
      case 'name':
        comparison = a.name.localeCompare(b.name, 'zh-Hant');
        break;
      case 'total': {
        const totalA = (a.gymPeopleNum ?? -1) + (a.swimPeopleNum ?? -1);
        const totalB = (b.gymPeopleNum ?? -1) + (b.swimPeopleNum ?? -1);
        comparison = totalA - totalB;
        break;
      }
      case 'gym':
        comparison = (a.gymPeopleNum ?? -1) - (b.gymPeopleNum ?? -1);
        break;
      case 'swim':
        comparison = (a.swimPeopleNum ?? -1) - (b.swimPeopleNum ?? -1);
        break;
    }

    return sortDirection.value === 'asc' ? comparison : -comparison;
  });

  return dataCopy;
});

async function fetchTaipeiSportsCenters() {
  const apiUrl = '/api/TaipeiSportsCenters';
  try {
    const response = await axios.post(apiUrl);
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
      latitude: getLatLongByName(item.lidName).latitude,
      longitude: getLatLongByName(item.lidName).longitude
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

async function fetchNanGangSportsCenters() {
  const apiUrl = '/api/NanGangSportsCenter';
  try {
    const response = await axios.post(apiUrl, null, {
      headers: {
        Accept: 'application/json, text/javascript, */*; q=0.01',
        'X-Requested-With': 'XMLHttpRequest'
      },
      withCredentials: true
    });
    const rawData: {
      gym: number[];
      swim: number[];
    } = response.data;
    const dataItems: DataItem[] = [];
    const dataItem: DataItem = {
      name: '南港',
      swimPeopleNum: rawData.swim[0],
      swimPeopleNumMax: rawData.swim[1],
      gymPeopleNum: rawData.gym[0],
      gymPeopleNumMax: rawData.gym[1],
      latitude: getLatLongByName('南港').latitude,
      longitude: getLatLongByName('南港').longitude
    };
    dataItems.push(dataItem);
    return dataItems;
  } catch (err) {
    if (axios.isAxiosError(err)) {
      if (err.response) {
        throw Error(
          `NanGangSportsCenters: Axios response error: ${err.response.status} ${err.response.statusText}`
        );
      } else if (err.request) {
        throw Error('NanGangSportsCenters: Axios request error: No response received');
      } else {
        throw Error(`NanGangSportsCenters: Axios error: ${err.message}`);
      }
    } else {
      throw Error('NanGangSportsCenters: Unknown error: ' + String(err));
    }
  }
}

async function fetchAllData() {
  data.value = [];
  error.value = null;
  const allPromises = [fetchTaipeiSportsCenters(), fetchNanGangSportsCenters()];
  const results = await Promise.allSettled(allPromises);
  results.forEach((result) => {
    if (result.status === 'fulfilled' && result.value) {
      data.value = data.value.concat(result.value);
    } else if (result.status === 'rejected') {
      console.error('Error fetching data:', result.reason);
      error.value += result.reason + ' ';
    }
  });
  console.log('Fetched data:', data.value);
  loading.value = false;
}
let intervalId: number | null = null;
onMounted(() => {
  intervalId = setInterval(fetchAllData, 60 * 1000);
  loading.value = true;
  fetchAllData();
});
onUnmounted(() => {
  if (intervalId !== null) {
    clearInterval(intervalId);
  }
});
</script>
