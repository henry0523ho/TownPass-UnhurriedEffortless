<template>
  <div class="center-status-container">
    <div class="header-bar">
      <h2>台北市運動中心即時人數</h2>

      <div class="sort-controls">
        <label for="sort-select">排序方式：</label>
        <select id="sort-select" v-model="sortBy">
          <option value="name">依名稱 (筆劃)</option>
          <option value="total">依總人數</option>
          <option value="gym">依健身房人數</option>
          <option value="swim">依游泳池人數</option>
        </select>
        <button @click="toggleSortDirection" class="sort-direction-btn">
          {{ sortDirection === 'asc' ? '🔼 升冪' : '🔽 降冪' }}
        </button>
        <button
          class="absolute top-[23px] -translate-y-[11px] right-2"
          @click.prevent="isShowLocaionModal = true"
        >
          <img src="@/assets/images/icon-geo.svg" alt="開啟地圖" />
        </button>
      </div>
    </div>

    <div v-if="loading" class="loading-message">正在從API獲取即時數據...</div>
    <div v-else-if="error" class="error-message">資料加載失敗：{{ error }}</div>

    <div v-else-if="data.length > 0" class="center-grid">
      <div v-for="center in sortedData" :key="center.name" class="center-card">
        <h3>{{ center.name }}</h3>

        <div class="facility-status">
          <h4>🏊 游泳池</h4>
          <div class="status-display">
            <div class="data-point current-count">
              <span class="label">現在人數</span>
              <strong>{{ center.swimPeopleNum }}</strong>
            </div>
            <div class="data-point capacity-count">
              <span class="label">總容量</span>
              <strong>{{ center.swimPeopleNumMax }}</strong>
            </div>
          </div>
        </div>

        <div class="facility-status">
          <h4>🏋️ 健身房</h4>
          <div class="status-display">
            <div class="data-point current-count">
              <span class="label">現在人數</span>
              <strong>{{ center.gymPeopleNum }}</strong>
            </div>
            <div class="data-point capacity-count">
              <span class="label">總容量</span>
              <strong>{{ center.gymPeopleNumMax }}</strong>
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

<style scoped>
/* 8. 新增/修改 CSS 樣式 */

.center-status-container {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial,
    sans-serif;
  max-width: 1200px;
  margin: 2rem auto;
  padding: 0 1rem;
}

/* 新增：標題和排序控制的容器 */
.header-bar {
  display: flex;
  justify-content: space-between; /* 讓標題在左、控制在右 */
  align-items: center;
  margin-bottom: 2rem;
  flex-wrap: wrap; /* 在小螢幕時換行 */
  gap: 1rem;
}

h2 {
  text-align: left;
  color: #333;
  margin: 0; /* 移除 h2 的預設 margin */
}

/* 新增：排序控制項的樣式 */
.sort-controls {
  display: flex;
  align-items: center;
  gap: 0.75rem; /* 控制項之間的間距 */
}

.sort-controls label {
  font-size: 0.95rem;
  color: #555;
  white-space: nowrap; /* 避免 "排序方式：" 換行 */
}

.sort-controls select,
.sort-controls button {
  padding: 0.5rem 0.75rem;
  border: 1px solid #ccc;
  border-radius: 6px;
  background-color: #fff;
  font-size: 0.9rem;
  font-family: inherit; /* 繼承字體 */
}

.sort-controls button {
  cursor: pointer;
  transition: background-color 0.2s;
}

.sort-controls button:hover {
  background-color: #f4f4f4;
}

/* 讓按鈕寬度固定，避免文字改變時跳動 */
.sort-direction-btn {
  min-width: 90px;
  text-align: left;
  padding-left: 0.5rem;
  padding-right: 0.5rem;
}

/* 以下為舊樣式 (不變) */

.loading-message {
  text-align: center;
  font-size: 1.2rem;
  color: #888;
  padding: 2rem;
}

.error-message {
  text-align: center;
  font-size: 1.2rem;
  color: #d9534f;
  padding: 2rem;
  border: 1px solid #d9534f;
  background-color: #fdf2f2;
  border-radius: 8px;
}

.center-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
}

.center-card {
  border: 1px solid #e0e0e0;
  border-radius: 12px;
  padding: 1.5rem;
  background-color: #ffffff;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  transition:
    transform 0.2s ease-in-out,
    box-shadow 0.2s ease-in-out;
}

.center-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08);
}

.center-card h3 {
  margin-top: 0;
  margin-bottom: 1rem;
  color: #1a1a1a;
  font-size: 1.3rem;
  border-bottom: 2px solid #f0f0f0;
  padding-bottom: 0.75rem;
}

.facility-status {
  margin-bottom: 1.25rem;
}

.facility-status:last-of-type {
  margin-bottom: 0;
}

.facility-status h4 {
  font-size: 1.1rem;
  font-weight: 600;
  color: #444;
  margin-top: 0;
  margin-bottom: 0.75rem;
}

.status-display {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}

.data-point {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex-grow: 1;
}

.data-point .label {
  font-size: 0.9rem;
  color: #666;
  margin-bottom: 0.25rem;
}

.data-point strong {
  font-size: 2.2rem;
  font-weight: 600;
}

.current-count strong {
  color: #d9534f;
}

.capacity-count strong {
  color: #0275d8;
}
</style>
