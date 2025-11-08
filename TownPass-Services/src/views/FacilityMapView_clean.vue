<script setup lang="ts">
import MessageModal from '@/components/molecules/MessageModal.vue';
import { useGoogleMapsStore } from '@/stores/googleMaps';
import axios from 'axios';
import { onMounted, ref, watch } from 'vue';
import { MarkerClusterer, SuperClusterAlgorithm } from '@googlemaps/markerclusterer';
import greenDotIconUrl from '/public/images/map/youbike/mappin-green.svg';
import defaultFocusIconUrl from '/public/images/map/icon_mappin-garbagetruck-green-pressed.svg';

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

const DEFAULT_CENTER = { lat: 25.0325917, lng: 121.5624999 };

const MARKER_ICON = {
  DEFAULT: {
    url: greenDotIconUrl,
    scaledSize: { width: 20, height: 20 },
    anchor: { x: 10, y: 20 }
  },
  FOCUSED: {
    url: defaultFocusIconUrl,
    scaledSize: { width: 48, height: 69 },
    anchor: { x: 24, y: 69 }
  }
};

// ==================== State ====================
const searchSpotList = ref<Spot[]>([]);
const filteredSpotList = ref<Spot[]>([]);
const selectedSpot = ref<Spot | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);
const isMapReady = ref(false);
const isShowGeoError = ref(false);

// Map related state
let map: google.maps.Map | null = null;
let marker: google.maps.Marker | null = null;
let markers: google.maps.Marker[] = [];
let markerCluster: MarkerClusterer | null = null;
let currentFocusedMarker: google.maps.Marker | null = null;

const currentLocation = ref<{ lat: number; lng: number }>({
  lat: DEFAULT_CENTER.lat,
  lng: DEFAULT_CENTER.lng
});

const googleMapsStore = useGoogleMapsStore();

// ==================== Helper Functions ====================
function getLatLongByName(name: string): DistrictCoordinates {
  return DISTRICT_COORDINATES[name] || { latitude: 25.0375, longitude: 121.5625 };
}

// ==================== API Functions ====================
async function fetchTaipeiSportsCenters(): Promise<DataItem[]> {
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

    return rawData.locationPeopleNums.map((item) => ({
      name: item.lidName,
      swimPeopleNum: item.swPeopleNum,
      swimPeopleNumMax: item.swMaxPeopleNum,
      gymPeopleNum: item.gymPeopleNum,
      gymPeopleNumMax: item.gymMaxPeopleNum,
      latitude: getLatLongByName(item.lidName).latitude,
      longitude: getLatLongByName(item.lidName).longitude
    }));
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
      address: '',
      swimPeopleNum: item.swimPeopleNum,
      swimPeopleNumMax: item.swimPeopleNumMax,
      gymPeopleNum: item.gymPeopleNum,
      gymPeopleNumMax: item.gymPeopleNumMax
    }));
    error.value = null;
    console.log('Fetched data:', searchSpotList.value);
  }

  loading.value = false;
}

// ==================== Map Functions ====================
const setMapHeight = () => {
  const mapElement = document.getElementById('map');
  if (mapElement) {
    mapElement.style.height = `${window.innerHeight}px`;
  }
};

const initMap = (lat: number, lng: number) => {
  googleMapsStore.loader.load().then(async () => {
    const { Map } = (await google.maps.importLibrary('maps')) as google.maps.MapsLibrary;

    map = new Map(document.getElementById('map') as HTMLElement, {
      center: { lat, lng },
      zoom: 13,
      maxZoom: 20,
      minZoom: 3,
      streetViewControl: false,
      mapTypeControl: false,
      fullscreenControl: false,
      zoomControl: false,
      mapId: ''
    });

    marker = new google.maps.Marker({
      position: { lat, lng },
      map,
      title: 'your location',
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        fillColor: '#4285F4',
        fillOpacity: 1,
        scale: 8,
        strokeColor: 'white',
        strokeWeight: 2
      }
    });

    getPositionClick();

    map.addListener('dragend', updateMarkers);
    map.addListener('zoom_changed', updateMarkers);

    isMapReady.value = true;
    setMapHeight();
    window.addEventListener('resize', setMapHeight);
  });
};

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

const calculateDistance = (spot: Spot): number => {
  return parseFloat(
    (
      google.maps.geometry.spherical.computeDistanceBetween(
        new google.maps.LatLng(currentLocation.value.lat, currentLocation.value.lng),
        new google.maps.LatLng(spot.lat, spot.lng)
      ) / 1000
    ).toFixed(1)
  );
};

const createMarkerIcon = (
  url: string,
  size: { width: number; height: number },
  anchor: { x: number; y: number }
) => ({
  url,
  scaledSize: new google.maps.Size(size.width, size.height),
  anchor: new google.maps.Point(anchor.x, anchor.y)
});

const createClusterRenderer = () => ({
  render({ count, position }: any, stats: any) {
    const circleRadius =
      count > Math.max(10, stats.clusters.markers.mean)
        ? count > Math.max(100, stats.clusters.markers.mean)
          ? '100'
          : '90'
        : '80';

    const svg =
      window.btoa(`<svg fill="#2eb6c7" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" width="50" height="50">
      <circle fill="#2eb6c7" cx="120" cy="120" opacity=".6" r="${circleRadius}" />
      <circle fill="#fff" cx="120" cy="120" r="70" />
      <text x="50%" y="50%" style="fill:#2eb6c7" text-anchor="middle" font-size="50" dominant-baseline="middle" font-family="roboto,arial,sans-serif">${count}</text>
      </svg>`);

    return new google.maps.Marker({
      position,
      icon: {
        url: `data:image/svg+xml;base64,${svg}`,
        scaledSize: new google.maps.Size(75, 75)
      },
      zIndex: Number(google.maps.Marker.MAX_ZINDEX) + count
    });
  }
});

const updateMarkers = async () => {
  if (!map) return;

  const bounds = map.getBounds();
  if (!bounds) return;

  console.log('Updating markers based on current map bounds.');

  filteredSpotList.value = searchSpotList.value
    .map((spot) => ({
      ...spot,
      position: new google.maps.LatLng(spot.lat, spot.lng)
    }))
    .filter((spot) => bounds.contains(spot.position))
    .map((spot) => ({
      ...spot,
      distance: calculateDistance(spot)
    }));

  console.log('filteredSpotList:', filteredSpotList.value);

  clearMarkers();

  const defaultIcon = createMarkerIcon(
    MARKER_ICON.DEFAULT.url,
    MARKER_ICON.DEFAULT.scaledSize,
    MARKER_ICON.DEFAULT.anchor
  );

  const focusedIcon = createMarkerIcon(
    MARKER_ICON.FOCUSED.url,
    MARKER_ICON.FOCUSED.scaledSize,
    MARKER_ICON.FOCUSED.anchor
  );

  filteredSpotList.value.forEach((spot) => {
    const markerInstance = new google.maps.Marker({
      position: { lat: Number(spot.lat), lng: Number(spot.lng) },
      map,
      icon: defaultIcon
    });

    markerInstance.addListener('click', () => {
      if (currentFocusedMarker && currentFocusedMarker !== markerInstance) {
        currentFocusedMarker.setIcon(defaultIcon);
        selectedSpot.value = null;
      }

      markerInstance.setIcon(focusedIcon);
      currentFocusedMarker = markerInstance;
      selectedSpot.value = spot;
      console.log('Selected spot:', selectedSpot.value);
    });

    markers.push(markerInstance);
  });

  markerCluster = new MarkerClusterer({
    markers,
    map,
    algorithm: new SuperClusterAlgorithm({ radius: 300 }),
    renderer: createClusterRenderer()
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

// ==================== Lifecycle ====================
onMounted(() => {
  fetchAllData();
  initMap(currentLocation.value.lat, currentLocation.value.lng);
});

// ==================== Watchers ====================
watch(searchSpotList, updateMarkers);
</script>

<template>
  <div class="absolute h-screen w-screen">
    <div class="h-full w-full">
      <!-- 地圖 -->
      <div class="relative flex-1 h-full w-full">
        <div class="google-map h-full w-full" id="map" style="height: 100%"></div>
        <div v-if="isMapReady" class="gps" @click="getPositionClick">
          <img src="@/assets/images/gps.png" width="20" alt="GPS" />
        </div>
      </div>

      <!-- 選取的點 -->
      <div v-if="selectedSpot" class="floating-box bottom-24 left-[50%] translate-x-[-50%] w-[90%]">
        <div>
          <p class="font-bold mb-2">{{ selectedSpot.name }}</p>
          <div class="flex mb-2">
            <img src="@/assets/images/icon-geo.svg" alt="Location" />
            <span class="underline">{{ selectedSpot.address }}</span>
          </div>
          <div class="flex text-grey-500">
            <span>{{ selectedSpot.distance }}公里</span>
          </div>
        </div>
        <img src="@/assets/images/down-icon.svg" class="-rotate-90" alt="Expand" />
      </div>
    </div>
  </div>

  <!-- geo modal -->
  <MessageModal :is-show="isShowGeoError">
    <template #header>
      <p>請啟用定位服務</p>
    </template>
    <template #body>
      <p class="text-grey-700">打開定位服務來允許"城市通"確認您的位置</p>
    </template>
    <template #footer>
      <button class="text-primary-500 px-7 py-2 w-full" @click="isShowGeoError = false">
        確認
      </button>
    </template>
  </MessageModal>
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
