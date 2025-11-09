<script setup lang="ts">
import MessageModal from '@/components/molecules/MessageModal.vue';
import { useGoogleMapsStore } from '@/stores/googleMaps';
import axios from 'axios';
import { onMounted, ref, watch, computed } from 'vue';
import { MarkerClusterer, SuperClusterAlgorithm } from '@googlemaps/markerclusterer';

// ==================== Types ====================
export interface Spot {
  id: string;
  name: string;
  area: string;
  address: string;
  lat: number;
  lng: number;
  distance?: number;
  swimPeopleNum?: number;
  swimPeopleNumMax?: number;
  gymPeopleNum?: number;
  gymPeopleNumMax?: number;
  [key: string]: any;
}

interface DataItem {
  name: string;
  swimPeopleNum?: number;
  swimPeopleNumMax?: number;
  gymPeopleNum?: number;
  gymPeopleNumMax?: number;
  latitude: number;
  longitude: number;
  address: string;
}

interface DistrictCoordinates {
  latitude: number;
  longitude: number;
}

// ==================== Constants ====================
const DISTRICT_COORDINATES: Record<string, DistrictCoordinates> = {
  北投: { latitude: 25.116499631184173, longitude: 121.50983145269343 },
  大安: { latitude: 25.0207374694988, longitude: 121.54575719476065 },
  大同: { latitude: 25.065371179032034, longitude: 121.51619920587748 },
  中正: { latitude: 25.038517677819875, longitude: 121.51933133187974 },
  內湖: { latitude: 25.078155736925535, longitude: 121.57476476642667 },
  士林: { latitude: 25.08942122491574, longitude: 121.52156330976973 },
  松山: { latitude: 25.04879199681975, longitude: 121.58187521229682 },
  萬華: { latitude: 25.047456736404317, longitude: 121.50686764837137 },
  文山: { latitude: 24.997014158084, longitude: 121.55945597940692 },
  信義: { latitude: 25.031698544420017, longitude: 121.56676886503183 },
  中山: { latitude: 25.05484192557673, longitude: 121.5213455316616 },
  南港: { latitude: 25.04879289615886, longitude: 121.58187402886895 }
};

const DISTRICT_ADDRESS: Record<string, string> = {
  北投: '臺北市北投區石牌路一段39巷100號',
  大安: '臺北市大安區辛亥路三段55號',
  大同: '臺北市大同區大龍街51號',
  中正: '臺北市中正區信義路一段1號',
  內湖: '臺北市內湖區洲子街12號',
  士林: '臺北市士林區士商路一號',
  松山: '臺北市松山區敦化北路1號',
  萬華: '臺北市萬華區西寧南路6-1號',
  文山: '臺北市文山區興隆路三段222號',
  信義: '臺北市信義區松勤街100號',
  中山: '臺北市中山區中山北路二段44巷2號',
  南港: '臺北市南港區玉成街69號'
};

const DEFAULT_CENTER = { lat: 25.0325917, lng: 121.5624999 };

// ==================== State ====================
const searchSpotList = ref<Spot[]>([]);
const filteredSpotList = ref<Spot[]>([]);
const selectedSpot = ref<Spot | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);
const isMapReady = ref(false);
const isShowGeoError = ref(false);
const sportType = ref<'swim' | 'gym'>('swim');
// Map related state
let map: google.maps.Map | null = null;
let marker: google.maps.Marker | null = null;
let markers: google.maps.Marker[] = [];
let markerCluster: MarkerClusterer | null = null;

const currentLocation = ref<{ lat: number; lng: number }>({
  lat: DEFAULT_CENTER.lat,
  lng: DEFAULT_CENTER.lng
});

const googleMapsStore = useGoogleMapsStore();

// ==================== Helper Functions ====================
function getLatLongByName(name: string): DistrictCoordinates {
  return DISTRICT_COORDINATES[name] || { latitude: 25.0375, longitude: 121.5625 };
}

function getAddrByName(name: string): string {
  return DISTRICT_ADDRESS[name] || 'no address';
}

const navigationUrl = computed(() => {
  // 檢查 selectedSpot 是否有值
  if (!selectedSpot.value) {
    return '#'; // 如果沒有選擇的點，返回一個安全的 'href'
  }

  // 使用「地址」來導航 (您程式碼中的 selectedSpot.address)
  const destination = selectedSpot.value.address;

  // 關鍵！對地址進行 URL 編碼，處理空格和特殊字元
  const encodedDestination = encodeURIComponent(destination);

  // 返回從「目前位置」(省略 origin) 到「目的地」的網址
  return `https://www.google.com/maps/dir/?api=1&destination=${encodedDestination}&travelmode=driving`;
});

function generateSVG(
  color: string,
  sportType: string,
  size: string,
  currentNum?: number,
  maxNum?: number
): string {
  let iconColor = color;
  if (maxNum !== undefined && currentNum !== undefined) {
    const usageRate = currentNum / maxNum;
    if (usageRate >= 0.8) {
      iconColor = '#ff0000'; // Red
    } else if (usageRate >= 0.5) {
      iconColor = '#ff9d00'; // Orange
    } else {
      iconColor = '#00d916'; // Green
    }
  } else {
    iconColor = '#979ba1';
  }
  if (size == 'small') {
    const iconType = sportType === 'swim' ? 'swimming' : 'dumbbell';
    const swimSvg = `<g fill="white" transform="scale(0.45) translate(67, 30)">
      <path d="M127.7,108.4c-2.8,0-5.5-0.6-7.8-1.7c-2.5-1.1-5.2-1.8-8.1-1.8c-2.9,0-5.7,0.7-8.1,1.8c-2.4,1.1-5,1.7-7.8,1.7 c-2.8,0-5.5-0.6-7.8-1.7c-2.5-1.1-5.3-1.8-8.1-1.8c-2.9,0-5.7,0.7-8.1,1.8c-2.4,1.1-5.1,1.7-7.9,1.7c-2.8,0-5.5-0.6-7.9-1.7 c-2.5-1.1-5.2-1.8-8.1-1.8c-2.9,0-5.7,0.7-8.1,1.8c-2.4,1.1-5.1,1.7-7.9,1.7c-2.8,0-5.5-0.6-7.8-1.7c-2.5-1.1-5.2-1.8-8.1-1.8 c-2.9,0-5.6,0.7-8.1,1.8c-2.4,1.1-5.1,1.7-7.9,1.7V96.6C2.9,96.6,5.6,96,8,95c2.4-1.1,5.2-1.8,8.1-1.8c2.9,0,5.6,0.7,8.1,1.8 c2.4,1,5.1,1.7,7.8,1.7c2.8,0,5.5-0.6,7.9-1.7c2.4-1.1,5.2-1.8,8.1-1.8c2.8,0,5.6,0.7,8.1,1.8c2.4,1,5.1,1.7,7.9,1.7 c2.8,0,5.5-0.6,7.9-1.7c2.4-1.1,5.2-1.8,8.1-1.8c2.8,0,5.6,0.7,8.1,1.8c2.4,1,5,1.7,7.8,1.7c2.8,0,5.5-0.6,7.8-1.7 c2.5-1.1,5.2-1.8,8.1-1.8c2.9,0,5.6,0.7,8.1,1.8c2.4,1,5,1.7,7.8,1.7V108.4z"/>
      <path d="M109.2,75.1c8.4,0,15.2-6.8,15.2-15.2c0-8.4-6.8-15.2-15.2-15.2c-8.4,0-15.2,6.8-15.2,15.2C94,68.3,100.2,75.1,109.2,75.1"/>
      <path d="M20.8,83.7c1.2,0.3,2.3,0.7,3.3,1.2c2.4,1.1,5.1,1.7,7.8,1.7c2.8,0,5.5-0.6,7.9-1.7c2.4-1.1,5.2-1.8,8.1-1.8 c2.9,0,5.6,0.7,8.1,1.8c2.4,1.1,5.1,1.7,7.9,1.7c2.8,0,5.5-0.6,7.9-1.7c2.4-1.1,5.2-1.8,8.1-1.8c2.9,0,5.6,0.7,8.1,1.8 c2.4,1.1,5,1.7,7.8,1.7c2,0,4-0.4,5.9-0.9L76.3,40l29.4-5.4c4.3-0.8,7.5-4.2,7.5-8.6c0-4.8-3.9-8.6-8.7-8.6c-0.3,0-0.7,0-1,0 l-45.5,8.3c-3.2,0.7-7.4,5.4-5,11.1c0.1,0.3,0.3,0.6,0.4,0.9l11.9,21.4L20.8,83.7z"/>
    </g>`;
    const gymSvg = `<g fill="white" transform="scale(1.4) translate(20, 12)">
      <path d="M41.573,15.879v-1.675c0-1.922-1.558-3.495-3.479-3.495h-2.761c-1.921,0-3.479,1.573-3.479,3.495v4.693H13.319v-4.693 c0-1.922-1.558-3.495-3.479-3.495H7.079c-1.921,0-3.479,1.573-3.479,3.495v1.675c-1.979,0-3.6,1.617-3.6,3.613v6.172 c0,1.996,1.71,3.613,3.6,3.613v1.674c0,1.922,1.558,3.513,3.479,3.513H9.84c1.921,0,3.479-1.591,3.479-3.513v-4.676h18.536v4.676 c0,1.922,1.558,3.513,3.479,3.513h2.762c1.92,0,3.479-1.591,3.479-3.513v-1.674c1.979,0,3.6-1.619,3.6-3.613v-6.172 C45.172,17.496,43.462,15.879,41.573,15.879z"/>
    </g>`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 124 124" fill="none">
  <g transform="scale(1.1) translate(-4,-2)">
    <path d="M12 21a1 1 0 0 1-.744-.332C10.615 19.954 5 13.59 5 10a7 7 0 0 1 14 0c0 3.59-5.615 9.954-6.256 10.668A1 1 0 0 1 12 21z" fill="${iconColor}" transform="scale(6) translate(-2, -2)"/>
    ${iconType === 'swimming' ? swimSvg : gymSvg}
  </g>
</svg>`;
    return `data:image/svg+xml;base64,${btoa(svg)}`;
  } else if (size == 'big') {
    const swimSvg = `<g fill="white" transform="scale(0.05) translate(60,50)">
    <path d="M127.7,108.4c-2.8,0-5.5-0.6-7.8-1.7c-2.5-1.1-5.2-1.8-8.1-1.8c-2.9,0-5.7,0.7-8.1,1.8c-2.4,1.1-5,1.7-7.8,1.7 c-2.8,0-5.5-0.6-7.8-1.7c-2.5-1.1-5.3-1.8-8.1-1.8c-2.9,0-5.7,0.7-8.1,1.8c-2.4,1.1-5.1,1.7-7.9,1.7c-2.8,0-5.5-0.6-7.9-1.7 c-2.5-1.1-5.2-1.8-8.1-1.8c-2.9,0-5.7,0.7-8.1,1.8c-2.4,1.1-5.1,1.7-7.9,1.7c-2.8,0-5.5-0.6-7.8-1.7c-2.5-1.1-5.2-1.8-8.1-1.8 c-2.9,0-5.6,0.7-8.1,1.8c-2.4,1.1-5.1,1.7-7.9,1.7V96.6C2.9,96.6,5.6,96,8,95c2.4-1.1,5.2-1.8,8.1-1.8c2.9,0,5.6,0.7,8.1,1.8 c2.4,1,5.1,1.7,7.8,1.7c2.8,0,5.5-0.6,7.9-1.7c2.4-1.1,5.2-1.8,8.1-1.8c2.8,0,5.6,0.7,8.1,1.8c2.4,1,5.1,1.7,7.9,1.7 c2.8,0,5.5-0.6,7.9-1.7c2.4-1.1,5.2-1.8,8.1-1.8c2.8,0,5.6,0.7,8.1,1.8c2.4,1,5,1.7,7.8,1.7c2.8,0,5.5-0.6,7.8-1.7 c2.5-1.1,5.2-1.8,8.1-1.8c2.9,0,5.6,0.7,8.1,1.8c2.4,1,5,1.7,7.8,1.7V108.4z"/>
    <path d="M109.2,75.1c8.4,0,15.2-6.8,15.2-15.2c0-8.4-6.8-15.2-15.2-15.2c-8.4,0-15.2,6.8-15.2,15.2C94,68.3,100.2,75.1,109.2,75.1"/>
    <path d="M20.8,83.7c1.2,0.3,2.3,0.7,3.3,1.2c2.4,1.1,5.1,1.7,7.8,1.7c2.8,0,5.5-0.6,7.9-1.7c2.4-1.1,5.2-1.8,8.1-1.8 c2.9,0,5.6,0.7,8.1,1.8c2.4,1.1,5.1,1.7,7.9,1.7c2.8,0,5.5-0.6,7.9-1.7c2.4-1.1,5.2-1.8,8.1-1.8c2.9,0,5.6,0.7,8.1,1.8 c2.4,1.1,5,1.7,7.8,1.7c2,0,4-0.4,5.9-0.9L76.3,40l29.4-5.4c4.3-0.8,7.5-4.2,7.5-8.6c0-4.8-3.9-8.6-8.7-8.6c-0.3,0-0.7,0-1,0 l-45.5,8.3c-3.2,0.7-7.4,5.4-5,11.1c0.1,0.3,0.3,0.6,0.4,0.9l11.9,21.4L20.8,83.7z"/>
  </g>`;
    const gymSvg = `<g fill="white" transform="scale(0.14) translate(22,21)">
    <path d="M41.573,15.879v-1.675c0-1.922-1.558-3.495-3.479-3.495h-2.761c-1.921,0-3.479,1.573-3.479,3.495v4.693H13.319v-4.693 c0-1.922-1.558-3.495-3.479-3.495H7.079c-1.921,0-3.479,1.573-3.479,3.495v1.675c-1.979,0-3.6,1.617-3.6,3.613v6.172 c0,1.996,1.71,3.613,3.6,3.613v1.674c0,1.922,1.558,3.513,3.479,3.513H9.84c1.921,0,3.479-1.591,3.479-3.513v-4.676h18.536v4.676 c0,1.922,1.558,3.513,3.479,3.513h2.762c1.92,0,3.479-1.591,3.479-3.513v-1.674c1.979,0,3.6-1.619,3.6-3.613v-6.172 C45.172,17.496,43.462,15.879,41.573,15.879z"/>
  </g>`;
    const svg = `<svg viewBox="0 0 24 24" width="200" height="200" fill="none" xmlns="http://www.w3.org/2000/svg">
  <g transform="scale(1,0.6)">
    <path fill-rule="evenodd" clip-rule="evenodd" d="M6.93417 2C6.95604 2 6.97799 2 7 2L17.0658 2C17.9523 1.99995 18.7161 1.99991 19.3278 2.08215C19.9833 2.17028 20.6117 2.36902 21.1213 2.87868C21.631 3.38835 21.8297 4.0167 21.9179 4.67221C22.0001 5.28388 22.0001 6.0477 22 6.9342V13.0658C22.0001 13.9523 22.0001 14.7161 21.9179 15.3278C21.8297 15.9833 21.631 16.6117 21.1213 17.1213C20.6117 17.631 19.9833 17.8297 19.3278 17.9179C18.7161 18.0001 17.9523 18.0001 17.0658 18L15.0543 18L12.984 21.3124C12.5295 22.0396 11.4705 22.0396 11.016 21.3124L8.94576 18L6.9342 18C6.0477 18.0001 5.28388 18.0001 4.67221 17.9179C4.0167 17.8297 3.38835 17.631 2.87868 17.1213C2.36902 16.6117 2.17028 15.9833 2.08215 15.3278C1.99991 14.7161 1.99995 13.9523 2 13.0658L2 7C2 6.97799 2 6.95604 2 6.93417C1.99995 6.04769 1.99991 5.28387 2.08215 4.67221C2.17028 4.0167 2.36902 3.38835 2.87868 2.87868C3.38835 2.36902 4.0167 2.17028 4.67221 2.08215C5.28387 1.99991 6.04769 1.99995 6.93417 2Z" fill="${iconColor}"/>
  </g>
  ${sportType === 'swim' ? swimSvg : gymSvg}
  <g>
    <text x="15.5" y="4" style="fill:white" text-anchor="middle" font-size="4" dominant-baseline="middle" font-family="roboto,arial,sans-serif">${currentNum ?? '-'}</text>
    <line x1="11.5" y1="5.5" x2="19.5" y2="5.5" style="stroke:white;stroke-width:0.3" />
    <text x="15.5" y="8" style="fill:white" text-anchor="middle" font-size="4" dominant-baseline="middle" font-family="roboto,arial,sans-serif">${maxNum ?? '-'}</text>
  </g>
</svg>`;
    return `data:image/svg+xml;base64,${btoa(svg)}`;
  }
  return '';
}

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
        address: string;
      }[];
    } = response.data;
    const dataItems = rawData.locationPeopleNums.map((item) => ({
      name: item.lidName,
      swimPeopleNum: item.swPeopleNum,
      swimPeopleNumMax: item.swMaxPeopleNum,
      gymPeopleNum: item.gymPeopleNum,
      gymPeopleNumMax: item.gymMaxPeopleNum,
      latitude: getLatLongByName(item.lidName).latitude,
      longitude: getLatLongByName(item.lidName).longitude,
      address: getAddrByName(item.lidName)
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
      longitude: getLatLongByName('南港').longitude,
      address: getAddrByName('南港')
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
  // const allPromises = [fetchTaipeiSportsCenters(), fetchNanGangSportsCenters()];
  const allPromises = [fetchTaipeiSportsCenters()];
  const results = await Promise.allSettled(allPromises);

  const newData: DataItem[] = [];
  let fetchError = '';

  results.forEach((result) => {
    if (result.status === 'fulfilled' && result.value) {
      newData.push(...result.value);
    } else if (result.status === 'rejected') {
      console.error('Error fetching data:', result.reason);
      fetchError += result.reason + ' ';
    }
  });

  if (fetchError) {
    if (loading.value) {
      error.value = fetchError.trim();
      searchSpotList.value = [];
    } else {
      console.error('Background refresh failed, keeping stale data:', fetchError.trim());
    }
  } else {
    searchSpotList.value = newData.map((item) => ({
      id: 'taipei-sports-centers',
      name: item.name,
      lat: item.latitude,
      lng: item.longitude,
      area: '',
      address: item.address,
      swimPeopleNum: item.swimPeopleNum,
      swimPeopleNumMax: item.swimPeopleNumMax,
      gymPeopleNum: item.gymPeopleNum,
      gymPeopleNumMax: item.gymPeopleNumMax
    }));
    error.value = null;
    console.log('Fetched data (seamlessly updated):', searchSpotList.value);
  }
  loading.value = false;
}

// ==================== Lifecycle ====================
onMounted(async () => {
  await fetchAllData();
  initMap(currentLocation.value.lat, currentLocation.value.lng);
  // 移除這裡的 updateMarkers() 調用，因為會在 initMap 完成後自動調用
});

// ==================== Map Functions ====================
const setMapHeight = () => {
  const mapElement = document.getElementById('map');
  if (mapElement) {
    mapElement.style.height = `${window.innerHeight}px`;
  }
};

/**
 * 初始化地圖
 * @param lat 緯度
 * @param lng 經度
 */
const initMap = (lat: number, lng: number) => {
  googleMapsStore.loader.load().then(async () => {
    const { Map } = (await google.maps.importLibrary('maps')) as google.maps.MapsLibrary;

    map = new Map(document.getElementById('map') as HTMLElement, {
      // 設定地圖的中心點經緯度位置
      center: { lat, lng },
      // 設定地圖縮放比例 0-20
      zoom: 13,
      // 限制使用者能縮放地圖的最大比例
      maxZoom: 20,
      // 限制使用者能縮放地圖的最小比例
      minZoom: 3,
      // 設定是否呈現右下角街景小人
      streetViewControl: false,
      // 設定是否讓使用者可以切換地圖樣式：一般、衛星圖等
      mapTypeControl: false,
      fullscreenControl: false,
      zoomControl: false,
      // 替換成您的 MAP ID
      mapId: ''
    });

    // init marker
    marker = new google.maps.Marker({
      position: {
        lat,
        lng
      },
      map,
      title: 'your location',
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        fillColor: '#4285F4',
        fillOpacity: 1,
        scale: 8, // 控制大小
        strokeColor: 'white',
        strokeWeight: 2
      }
    });

    // get current location
    getPositionClick();

    // 在地圖的dragend事件上使用該函數
    map.addListener('dragend', function () {
      updateMarkers();
    });

    // // 在地圖的zoom_changed事件上使用該函數
    map.addListener('zoom_changed', function () {
      updateMarkers();
    });

    // 地圖完全加載後觸發 idle 事件
    map.addListener('idle', function () {
      console.log('Map is idle, updating markers...');
      updateMarkers();
    });

    isMapReady.value = true;
    setMapHeight();
    window.addEventListener('resize', setMapHeight);

    // 地圖初始化完成後，延遲一下確保 bounds 已經準備好
    setTimeout(() => {
      console.log('Initial marker update after map load');
      updateMarkers();
    }, 100);
  });
};

function toggleSportType() {
  sportType.value = sportType.value === 'swim' ? 'gym' : 'swim';
  updateMarkers();
}
const getPositionClick = () => {
  googleMapsStore
    .gettingPosition()!!
    .then((position: any) => successCallback(position))
    .catch((error) => errorCallback(error));
};

const successCallback = (position: GeolocationPosition) => {
  currentLocation.value.lat = position.coords.latitude;
  currentLocation.value.lng = position.coords.longitude;

  if (marker && map) {
    marker.setPosition(new google.maps.LatLng(position.coords.latitude, position.coords.longitude));
    map.setCenter(marker.getPosition()!);
  }
};

const errorCallback = (error: any) => {
  console.log(error);
  if (error.code === 1) {
    isShowGeoError.value = true;
  }
};

const updateMarkers = async () => {
  console.log('Updating markers based on current map bounds.');
  if (!map) {
    console.log('Map not initialized yet, skipping marker update');
    return;
  }

  const bounds = map.getBounds();
  if (!bounds) {
    console.log('Map bounds not available yet, skipping marker update');
    return;
  }

  if (searchSpotList.value.length === 0) {
    console.log('No spot data available yet, skipping marker update');
    return;
  }

  filteredSpotList.value = searchSpotList.value
    .map((spot) => ({
      ...spot,
      position: new google.maps.LatLng(spot.lat, spot.lng)
    }))
    .filter((spot) => bounds.contains(spot.position))
    .map((spot) => ({
      ...spot,
      distance: parseFloat(
        (
          google.maps.geometry.spherical.computeDistanceBetween(
            new google.maps.LatLng(currentLocation.value.lat, currentLocation.value.lng),
            new google.maps.LatLng(spot.lat, spot.lng)
          ) / 1000
        ).toFixed(1)
      )
    }));

  console.log('filteredSpotList:', filteredSpotList.value);

  // Clear existing markers
  clearMarkers();

  let currentFocusedMarker: any = null;

  filteredSpotList.value.forEach((spot) => {
    const greenDotIcon = {
      url: generateSVG(
        'red',
        sportType.value,
        'small',
        sportType.value === 'swim' ? spot.swimPeopleNum : spot.gymPeopleNum,
        sportType.value === 'swim' ? spot.swimPeopleNumMax : spot.gymPeopleNumMax
      ), // 預設綠色小圓點圖標的路徑
      scaledSize: new google.maps.Size(40, 40), // 設置圖標的大小
      anchor: new google.maps.Point(20, 40) // 設置圖標的錨點，使其中心對齊底部
    };

    const marker = new google.maps.Marker({
      position: { lat: Number(spot.lat), lng: Number(spot.lng) },
      map,
      icon: greenDotIcon
    });

    marker.addListener('click', () => {
      // 如果點擊的是當前已選中的標記，則取消選取
      if (currentFocusedMarker === marker) {
        // 恢復為預設圖標
        marker.setIcon(greenDotIcon);
        selectedSpot.value = null;
        currentFocusedMarker = null;
        console.log('Deselected spot');
        return;
      }

      // 如果之前有其他聚焦的標記，恢復為預設圖標
      if (currentFocusedMarker && currentFocusedMarker !== marker) {
        currentFocusedMarker.setIcon(greenDotIcon);
      }

      // 獲取所選擇的 spot 的所有屬性
      selectedSpot.value = spot;
      const focusedIcon = {
        url: generateSVG(
          'red',
          sportType.value,
          'big',
          sportType.value === 'swim'
            ? selectedSpot.value?.swimPeopleNum
            : selectedSpot.value?.gymPeopleNum,
          sportType.value === 'swim'
            ? selectedSpot.value?.swimPeopleNumMax
            : selectedSpot.value?.gymPeopleNumMax
        ), // 點擊後聚焦圖標的路徑
        scaledSize: new google.maps.Size(150, 90), // 設置圖標的大小
        anchor: new google.maps.Point(75, 50) // 設置圖標的錨點，使其中心對齊底部
      };

      // 設置當前標記為聚焦圖標
      marker.setIcon(focusedIcon);
      currentFocusedMarker = marker;

      console.log('Selected spot:', selectedSpot);
    });

    markers.push(marker);
  });

  // Add a marker clusterer to manage the markers.
  markerCluster = new MarkerClusterer({
    markers,
    map,
    algorithm: new SuperClusterAlgorithm({ radius: 10 }), // 设置gridSize
    renderer: {
      render({ count, position }, stats) {
        // change color if this cluster has more markers than the mean cluster
        const circleRadius =
          count > Math.max(10, stats.clusters.markers.mean)
            ? count > Math.max(100, stats.clusters.markers.mean)
              ? '100'
              : '90'
            : '80';
        // create svg literal with fill color
        const svg =
          window.btoa(`<svg fill="#2eb6c7" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" width="50" height="50">
          <circle fill="#2eb6c7" cx="120" cy="120" opacity=".6" r="${circleRadius}" />
          <circle fill="#fff" cx="120" cy="120" r="70" />
          <text x="50%" y="50%" style="fill:#2eb6c7" text-anchor="middle" font-size="50" dominant-baseline="middle" font-family="roboto,arial,sans-serif">${count}</text>
          </svg>`);

        // create marker using svg icon
        return new google.maps.Marker({
          position,
          icon: {
            url: `data:image/svg+xml;base64,${svg}`,
            scaledSize: new google.maps.Size(75, 75)
          },
          // adjust zIndex to be above other markers
          zIndex: Number(google.maps.Marker.MAX_ZINDEX) + count
        });
      }
    }
  });
};

const clearMarkers = () => {
  markers.forEach((marker) => marker.setMap(null));
  markers = [];
  if (markerCluster) {
    markerCluster.clearMarkers();
  }
  selectedSpot.value = null;
};

// Watch for changes in searchSpotList
watch(searchSpotList, updateMarkers);
watch(loading, updateMarkers);
</script>

<template>
  <div class="absolute h-screen w-screen">
    <!-- <div
      :class="{ hidden: isExpandList || isExpandDetail, visible: !isExpandList && !isExpandDetail }"
      class="h-full w-full"
    > -->
    <div class="h-full w-full">
      <!-- 找地點搜尋框 -->
      <!-- <div class="flex items-center">
        <FindPlace
          @onSearchChange="(value) => handleSearchChange(value)"
          @update:isExpand="handleExpandChange"
        />
      </div> -->
      <!-- 地圖 -->
      <!-- <div class="relative flex-1 h-full w-full" :class="{ hidden: isExpand, visible: !isExpand }"> -->
      <div class="relative flex-1 h-full w-full">
        <div class="google-map h-full w-full" id="map" style="height: 100%"></div>
        <div v-if="isMapReady" class="gps" @click="getPositionClick">
          <img src="@/assets/images/gps.png" width="20" alt="" />
        </div>
      </div>
      <!-- 選取的點 -->
      <div v-if="selectedSpot" class="floating-box bottom-24 left-[50%] translate-x-[-50%] w-[90%]">
        <div>
          <p class="font-bold mb-2">{{ selectedSpot.name }}運動中心</p>
          <div class="flex mb-2">
            <img src="@/assets/images/icon-geo.svg" alt="Location" />
            <a :href="navigationUrl" target="_blank">
              <span class="underline">{{ selectedSpot.address }}</span>
            </a>
          </div>
          <div class="flex text-grey-500">
            <!-- <span>{{ selectedSpot.distance }}公里</span> -->
            <span>健身房{{ selectedSpot.gymPeopleNum }}/{{ selectedSpot.gymPeopleNumMax }}</span>
            <span>游泳池{{ selectedSpot.swimPeopleNum }}/{{ selectedSpot.swimPeopleNumMax }}</span>
          </div>
        </div>
        <img src="@/assets/images/down-icon.svg" class="-rotate-90" alt="Expand" />
      </div>
      <div
        v-if="selectedSpot == null"
        class="absolute w-screen bottom-24 flex items-center justify-center"
      >
        <div class="w-28 h-16 bg-sky-300 rounded-full" @click="toggleSportType">
          <div v-if="sportType == 'swim'" class="w-16 h-16 rounded-full bg-white z-10">
            <svg
              viewBox="0 0 128 128"
              width="48"
              height="48"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              class="m-auto pt-2"
            >
              <g fill="#74d4ff">
                <path
                  d="M127.7,108.4c-2.8,0-5.5-0.6-7.8-1.7c-2.5-1.1-5.2-1.8-8.1-1.8c-2.9,0-5.7,0.7-8.1,1.8c-2.4,1.1-5,1.7-7.8,1.7 c-2.8,0-5.5-0.6-7.8-1.7c-2.5-1.1-5.3-1.8-8.1-1.8c-2.9,0-5.7,0.7-8.1,1.8c-2.4,1.1-5.1,1.7-7.9,1.7c-2.8,0-5.5-0.6-7.9-1.7 c-2.5-1.1-5.2-1.8-8.1-1.8c-2.9,0-5.7,0.7-8.1,1.8c-2.4,1.1-5.1,1.7-7.9,1.7c-2.8,0-5.5-0.6-7.8-1.7c-2.5-1.1-5.2-1.8-8.1-1.8 c-2.9,0-5.6,0.7-8.1,1.8c-2.4,1.1-5.1,1.7-7.9,1.7V96.6C2.9,96.6,5.6,96,8,95c2.4-1.1,5.2-1.8,8.1-1.8c2.9,0,5.6,0.7,8.1,1.8 c2.4,1,5.1,1.7,7.8,1.7c2.8,0,5.5-0.6,7.9-1.7c2.4-1.1,5.2-1.8,8.1-1.8c2.8,0,5.6,0.7,8.1,1.8c2.4,1,5.1,1.7,7.9,1.7 c2.8,0,5.5-0.6,7.9-1.7c2.4-1.1,5.2-1.8,8.1-1.8c2.8,0,5.6,0.7,8.1,1.8c2.4,1,5,1.7,7.8,1.7c2.8,0,5.5-0.6,7.8-1.7 c2.5-1.1,5.2-1.8,8.1-1.8c2.9,0,5.6,0.7,8.1,1.8c2.4,1,5,1.7,7.8,1.7V108.4z"
                />
                <path
                  d="M109.2,75.1c8.4,0,15.2-6.8,15.2-15.2c0-8.4-6.8-15.2-15.2-15.2c-8.4,0-15.2,6.8-15.2,15.2C94,68.3,100.2,75.1,109.2,75.1"
                />
                <path
                  d="M20.8,83.7c1.2,0.3,2.3,0.7,3.3,1.2c2.4,1.1,5.1,1.7,7.8,1.7c2.8,0,5.5-0.6,7.9-1.7c2.4-1.1,5.2-1.8,8.1-1.8 c2.9,0,5.6,0.7,8.1,1.8c2.4,1.1,5.1,1.7,7.9,1.7c2.8,0,5.5-0.6,7.9-1.7c2.4-1.1,5.2-1.8,8.1-1.8c2.9,0,5.6,0.7,8.1,1.8 c2.4,1.1,5,1.7,7.8,1.7c2,0,4-0.4,5.9-0.9L76.3,40l29.4-5.4c4.3-0.8,7.5-4.2,7.5-8.6c0-4.8-3.9-8.6-8.7-8.6c-0.3,0-0.7,0-1,0 l-45.5,8.3c-3.2,0.7-7.4,5.4-5,11.1c0.1,0.3,0.3,0.6,0.4,0.9l11.9,21.4L20.8,83.7z"
                />
              </g>
            </svg>
          </div>
          <div v-if="sportType == 'gym'" class="w-16 h-16 rounded-full bg-white ml-12">
            <svg
              viewBox="0 0 45.174 45.174"
              width="54"
              height="54"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              class="m-auto pt-2 ml-1"
            >
              <g fill="#74d4ff">
                <path
                  d="M41.573,15.879v-1.675c0-1.922-1.558-3.495-3.479-3.495h-2.761c-1.921,0-3.479,1.573-3.479,3.495v4.693H13.319v-4.693 c0-1.922-1.558-3.495-3.479-3.495H7.079c-1.921,0-3.479,1.573-3.479,3.495v1.675c-1.979,0-3.6,1.617-3.6,3.613v6.172 c0,1.996,1.71,3.613,3.6,3.613v1.674c0,1.922,1.558,3.513,3.479,3.513H9.84c1.921,0,3.479-1.591,3.479-3.513v-4.676h18.536v4.676 c0,1.922,1.558,3.513,3.479,3.513h2.762c1.92,0,3.479-1.591,3.479-3.513v-1.674c1.979,0,3.6-1.619,3.6-3.613v-6.172 C45.172,17.496,43.462,15.879,41.573,15.879z"
                />
              </g>
            </svg>
          </div>
        </div>
      </div>
      <!-- 底部搜尋結果 -->
      <!-- <div v-if="selectedSearchData.id && !isExpand" class="floating-box bottom-0 w-full">
        <div class="flex items-center">
          <span class="font-bold mr-2">{{ selectedSearchData.name }}</span>
          <div class="text-primary-500 border border-primary-500 rounded-full px-2">
            {{ filteredSpotList.length }}筆結果
          </div>
        </div>
        <a class="text-primary-500" @click="isExpandList = true">展開列表</a>
      </div> -->
    </div>
    <!-- 搜尋結果列表 -->
    <!-- <SpotList
      v-if="isExpandList"
      :selectedSearchData="selectedSearchData"
      :filteredSpotList="filteredSpotList"
      @update:isExpandList="(value: boolean) => (isExpandList = value)"
      @update:selectedSpot="
        (value: Spot) => {
          selectedSpot = value;
          isExpandDetail = true;
          isFrom = 'list';
        }
      "
    /> -->
    <!-- 搜尋結果明細 -->
    <!-- <SpotDetail
      v-if="selectedSpot && isExpandDetail && isFrom"
      :selectedSearchData="selectedSearchData"
      :selectedSpot="selectedSpot"
      @update:isExpandDetail="
        (value) => {
          isExpandDetail = value;
          selectedSpot = null;
          if (isFrom === 'list') {
            isExpandList = true;
          }
          isFrom = '';
        }
      "
    /> -->
  </div>

  <!-- geo modal -->
  
</template>

<style lang="postcss" scoped>
.google-map {
  width: 100%;
  height: 100%;
}

.marker {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 60px;
}

.gps {
  position: absolute;
  right: 10px;
  top: 10px;
  background-color: rgb(255, 255, 255);
  width: 40px;
  height: 40px;
  user-select: none;
  box-shadow: rgba(0, 0, 0, 0.3) 0px 1px 4px -1px;
  border-radius: 20px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.floating-box {
  @apply absolute flex items-center justify-between bg-white px-4 py-6 rounded-xl;
  box-shadow: rgba(0, 0, 0, 0.04) 0px -4px 10px;
}
</style>
