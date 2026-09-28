import React, { useState, useEffect, useRef } from 'react';
import { CloudSun, Wind, Navigation, AlertTriangle, Droplets, Sun, Compass, Play, ArrowRight, ShieldCheck, Thermometer, MapPin, Download, Upload, AlertCircle, Clock, CheckCircle2 } from 'lucide-react';
import L from 'leaflet';
import { createCachedTileLayer } from '../../utils/mapTileCache';
import { IOSCard, IOSCardHeader, IOSMetricTile } from '../common/IOSCard';
import { IOSToolHeader } from '../common/IOSToolHeader';
import { NumberStepper } from '../common/NumberStepper';
import { ZHEJIANG_XINGZHE_ROUTES } from '../../data/zhejiangRoutes';
import { useToast } from '../../context/ToastContext';
import { useLanguageAndUnit } from '../../context/LanguageAndUnitContext';

interface RoutePoint {
  lat: number;
  lng: number;
  name?: string;
}

interface SegmentWeather {
  pointIndex: number;
  lat: number;
  lng: number;
  distanceKm: number;
  estimatedTimeStr: string;
  temp: number;
  feelsLike: number;
  precipProb: number;
  humidity: number;
  windSpeedKmh: number;
  windDirectionDeg: number;
  windRelation: string;
  uvIndex: number;
  /** True when the Open-Meteo API request for this waypoint failed and fixed
   *  fallback values were used. The UI should clearly mark such segments. */
  isFallback?: boolean;
}

export const CyclingWeatherAdvisor: React.FC = () => {
  const { showToast } = useToast();
  const { unitSystem, language } = useLanguageAndUnit();
  const isImperial = unitSystem === 'imperial';

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const routePolylineRef = useRef<L.Polyline | null>(null);

  const [customRouteName, setCustomRouteName] = useState<string>('西湖龙井起伏路线');
  const [routePoints, setRoutePoints] = useState<RoutePoint[]>(
    ZHEJIANG_XINGZHE_ROUTES[0].waypoints.map(w => ({ lat: w.lat, lng: w.lng, name: w.name }))
  );

  const [departureTime, setDepartureTime] = useState<string>('07:30');
  const [avgSpeedKmh, setAvgSpeedKmh] = useState<number>(25);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [weatherSegments, setWeatherSegments] = useState<SegmentWeather[]>([]);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [30.22, 120.15],
      zoom: 12,
    });

    const voyagerLayer = createCachedTileLayer(L, 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      maxZoom: 20,
      detectRetina: true,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
    });

    const satelliteLayer = createCachedTileLayer(L, 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Earthstar Geographics'
    });

    const positronLayer = createCachedTileLayer(L, 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      maxZoom: 20,
      detectRetina: true,
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
    });

    voyagerLayer.addTo(map);

    L.control.layers({
      '高清骑行': voyagerLayer,
      '卫星实景': satelliteLayer,
      '极简底图': positronLayer,
    }, undefined, { position: 'topright' }).addTo(map);

    map.on('click', (e: L.LeafletMouseEvent) => {
      setRoutePoints(prev => [...prev, { lat: e.latlng.lat, lng: e.latlng.lng, name: `航点 #${prev.length + 1}` }]);
    });

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update map polyline
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (routePolylineRef.current) {
      routePolylineRef.current.remove();
    }

    if (routePoints.length >= 2) {
      const latLngs = routePoints.map(p => [p.lat, p.lng] as [number, number]);
      const polyline = L.polyline(latLngs, {
        color: '#00AFFF',
        weight: 4,
        opacity: 0.85
      }).addTo(map);
      routePolylineRef.current = polyline;
      map.fitBounds(polyline.getBounds(), { padding: [20, 20] });
    }
  }, [routePoints]);

  const calculateBearing = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaLambda = ((lng2 - lng1) * Math.PI) / 180;
    const y = Math.sin(deltaLambda) * Math.cos(phi2);
    const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
    const theta = Math.atan2(y, x);
    return ((theta * 180) / Math.PI + 360) % 360;
  };

  const getWindRelation = (ridingBearing: number, windFromDeg: number) => {
    const diff = Math.abs(ridingBearing - windFromDeg) % 360;
    const angle = diff > 180 ? 360 - diff : diff;
    if (angle <= 45) return '强顶风';
    if (angle <= 80) return '侧顶风';
    if (angle <= 100) return '纯侧风';
    if (angle <= 135) return '侧顺风';
    return '顺风推进';
  };

  // Handle Manual GPX / TCX Route File Upload
  const handleGpxUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(content, 'text/xml');
        
        // Find trackpoints in GPX or TCX
        let trkpts = xmlDoc.getElementsByTagName('trkpt');
        if (trkpts.length === 0) {
          trkpts = xmlDoc.getElementsByTagName('rtept');
        }
        if (trkpts.length === 0) {
          trkpts = xmlDoc.getElementsByTagName('Trackpoint');
        }

        if (trkpts.length === 0) {
          showToast('未在文件中找到有效的路线轨迹点！', 'error', '请确认上传的是标准 .gpx / .tcx 路线文件');
          return;
        }

        const rawPoints: RoutePoint[] = [];
        for (let i = 0; i < trkpts.length; i++) {
          const pt = trkpts[i];
          let lat = 0;
          let lng = 0;

          if (pt.getAttribute('lat')) {
            lat = parseFloat(pt.getAttribute('lat') || '0');
            lng = parseFloat(pt.getAttribute('lon') || '0');
          } else {
            const pos = pt.getElementsByTagName('Position')[0];
            if (pos) {
              const latNode = pos.getElementsByTagName('LatitudeDegrees')[0];
              const lngNode = pos.getElementsByTagName('LongitudeDegrees')[0];
              if (latNode && lngNode) {
                lat = parseFloat(latNode.textContent || '0');
                lng = parseFloat(lngNode.textContent || '0');
              }
            }
          }

          if (lat && lng) {
            rawPoints.push({ lat, lng });
          }
        }

        if (rawPoints.length === 0) {
          showToast('无法解析坐标经纬度数据！', 'error');
          return;
        }

        // Downsample to 12~24 evenly spaced sampling waypoints for high accuracy & responsive API query
        const targetCount = Math.min(24, Math.max(8, Math.floor(rawPoints.length / 8)));
        const sampledPoints: RoutePoint[] = [];
        const step = Math.max(1, Math.floor(rawPoints.length / targetCount));

        for (let i = 0; i < rawPoints.length; i += step) {
          sampledPoints.push({
            lat: rawPoints[i].lat,
            lng: rawPoints[i].lng,
            name: i === 0 ? '出发起点' : `沿途航点 #${sampledPoints.length + 1}`
          });
        }
        if (rawPoints.length > 1 && sampledPoints[sampledPoints.length - 1] !== rawPoints[rawPoints.length - 1]) {
          sampledPoints.push({
            lat: rawPoints[rawPoints.length - 1].lat,
            lng: rawPoints[rawPoints.length - 1].lng,
            name: '终点目的地'
          });
        }

        setRoutePoints(sampledPoints);
        const parsedName = file.name.replace(/\.[^/.]+$/, '');
        setCustomRouteName(parsedName);
        setSelectedRouteId('custom');
        showToast('GPX 路线导入成功！', 'success', `成功解析 ${rawPoints.length} 个轨迹点，已生成 ${sampledPoints.length} 个气象监测断面`);
      } catch (err) {
        showToast('文件解析失败，请检查文件格式！', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const fetchWeatherAdvice = async () => {
    if (routePoints.length < 2) {
      alert('请至少在地图上选定 2 个路段航点！');
      return;
    }

    setIsLoading(true);
    try {
      let accumulatedDistanceKm = 0;
      const segmentsToQuery: { pt: RoutePoint; distKm: number; bearing: number }[] = [];

      for (let i = 0; i < routePoints.length; i++) {
        const curr = routePoints[i];
        let bearing = 90;
        if (i > 0) {
          const prev = routePoints[i - 1];
          const p1 = L.latLng(prev.lat, prev.lng);
          const p2 = L.latLng(curr.lat, curr.lng);
          accumulatedDistanceKm += p1.distanceTo(p2) / 1000;
          bearing = calculateBearing(prev.lat, prev.lng, curr.lat, curr.lng);
        }
        segmentsToQuery.push({
          pt: curr,
          distKm: parseFloat(accumulatedDistanceKm.toFixed(1)),
          bearing
        });
      }

      // Query Open-Meteo Forecast API
      const [depHour, depMin] = departureTime.split(':').map(Number);
      const departureDate = new Date();
      departureDate.setHours(depHour || 7, depMin || 30, 0, 0);

      const segmentResults: SegmentWeather[] = [];

      for (let i = 0; i < segmentsToQuery.length; i++) {
        const seg = segmentsToQuery[i];
        const elapsedHours = seg.distKm / Math.max(10, avgSpeedKmh);
        const arrivalDate = new Date(departureDate.getTime() + elapsedHours * 3600 * 1000);
        const arrivalHour = arrivalDate.getHours();

        const timeStr = `${arrivalHour.toString().padStart(2, '0')}:${arrivalDate.getMinutes().toString().padStart(2, '0')}`;

        try {
          const res = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${seg.pt.lat.toFixed(4)}&longitude=${seg.pt.lng.toFixed(4)}&hourly=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation_probability,wind_speed_10m,wind_direction_10m,uv_index&timezone=auto`
          );
          const data = await res.json();
          const hourly = data.hourly;

          if (hourly && hourly.temperature_2m) {
            const temp = Math.round(hourly.temperature_2m[arrivalHour] ?? 22);
            const feelsLike = Math.round(hourly.apparent_temperature[arrivalHour] ?? temp);
            const precipProb = Math.round(hourly.precipitation_probability[arrivalHour] ?? 0);
            const humidity = Math.round(hourly.relative_humidity_2m[arrivalHour] ?? 60);
            const windSpeedKmh = Math.round(hourly.wind_speed_10m[arrivalHour] ?? 12);
            const windDirectionDeg = Math.round(hourly.wind_direction_10m[arrivalHour] ?? 90);
            const uvIndex = Math.round(hourly.uv_index[arrivalHour] ?? 4);

            const windRel = getWindRelation(seg.bearing, windDirectionDeg);

            segmentResults.push({
              pointIndex: i,
              lat: seg.pt.lat,
              lng: seg.pt.lng,
              distanceKm: seg.distKm,
              estimatedTimeStr: timeStr,
              temp,
              feelsLike,
              precipProb,
              humidity,
              windSpeedKmh,
              windDirectionDeg,
              windRelation: windRel,
              uvIndex
            });
          }
        } catch (e) {
          // API request for this waypoint failed — push clearly-flagged fallback estimates.
          // The UI will display a visual warning on these segments.
          segmentResults.push({
            pointIndex: i,
            lat: seg.pt.lat,
            lng: seg.pt.lng,
            distanceKm: seg.distKm,
            estimatedTimeStr: timeStr,
            temp: 24,
            feelsLike: 25,
            precipProb: 10,
            humidity: 65,
            windSpeedKmh: 14,
            windDirectionDeg: 120,
            windRelation: getWindRelation(seg.bearing, 120),
            uvIndex: 5,
            isFallback: true
          });
        }
      }

      setWeatherSegments(segmentResults);
      showToast('沿途气象顾问分析完毕！', 'success', `已推演全程 ${segmentsToQuery.length} 个断面的天气与风向`);
    } catch (err) {
      showToast('气象数据获取异常，请检查网络！', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const [selectedRouteId, setSelectedRouteId] = useState<string>(ZHEJIANG_XINGZHE_ROUTES[0].id);

  const loadPresetRoute = (routeId: string) => {
    const found = ZHEJIANG_XINGZHE_ROUTES.find(r => r.id === routeId);
    if (found) {
      setSelectedRouteId(found.id);
      setCustomRouteName(found.name);
      setRoutePoints(found.waypoints.map(w => ({ lat: w.lat, lng: w.lng, name: w.name })));
      showToast(`已载入路书: ${found.name}`, 'info');
    }
  };

  // Weather overview summary
  const maxTemp = weatherSegments.length ? Math.max(...weatherSegments.map(s => s.temp)) : 25;
  const maxUv = weatherSegments.length ? Math.max(...weatherSegments.map(s => s.uvIndex)) : 5;
  const maxCrosswindKmh = weatherSegments.length
    ? Math.max(0, ...weatherSegments.filter(s => s.windRelation.includes('侧风')).map(s => s.windSpeedKmh))
    : 0;

  const displayAvgSpeed = isImperial ? Math.round(avgSpeedKmh * 0.621371) : avgSpeedKmh;
  const handleAvgSpeedChange = (val: number) => {
    setAvgSpeedKmh(isImperial ? Math.round((val / 0.621371) * 10) / 10 : val);
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Standard Apple HIG Tool Header */}
      <IOSToolHeader
        category={language === 'zh-TW' ? '路線與氣象' : '路线与气象'}
        categoryIcon={CloudSun}
        title={language === 'zh-TW' ? '天氣與風向' : '天气与风向'}
        description="结合实时气象与顺逆风判定，精准计算沿途各路段到达时刻的气温、降雨概率、风阻及出行穿衣建议。"
        tint="mint"
        actions={
          <>
            <label className="apple-touch h-9 px-3.5 sm:px-4 rounded-xl bg-white/80 dark:bg-white/10 hover:bg-white dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200/80 dark:border-white/10 cursor-pointer transition shadow-xs flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0">
              <Upload className="w-3.5 h-3.5 text-ios-mint" />
              <span>导入 GPX / TCX 路线</span>
              <input type="file" accept=".gpx,.tcx,.xml" onChange={handleGpxUpload} className="hidden" />
            </label>

            <button
              onClick={fetchWeatherAdvice}
              disabled={isLoading}
              className="apple-touch h-9 px-3.5 sm:px-4 bg-ios-mint hover:bg-ios-mint/90 text-slate-950 rounded-xl font-bold text-xs transition shadow-ios-sm flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              {isLoading ? '正在获取沿途气象...' : '生成全路段天气顾问'}
            </button>
          </>
        }
      />

      {/* Hero Weather Metric Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <IOSMetricTile
          label="全程最高气温"
          value={isImperial ? Math.round(maxTemp * 9/5 + 32) : maxTemp}
          unit={isImperial ? '°F' : '°C'}
          subValue="气象预测最高"
          accent="orange"
        />
        <IOSMetricTile
          label="紫外线指数峰值"
          value={`UV ${maxUv}`}
          unit=""
          subValue={maxUv >= 6 ? '强防晒需防护' : '适度温和'}
          accent="blue"
        />
        <IOSMetricTile
          label="侧向横风风速"
          value={isImperial ? Math.round(maxCrosswindKmh * 0.621371) : maxCrosswindKmh}
          unit={isImperial ? 'mph' : 'km/h'}
          subValue={maxCrosswindKmh >= 20 ? '高框轮组警惕' : '平稳巡航'}
          accent="purple"
        />
        <IOSMetricTile
          label="路线监测断面"
          value={weatherSegments.length || routePoints.length}
          unit="个"
          subValue="全轨迹采样"
          accent="green"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
        {/* Left Inputs & Map */}
        <div className="lg:col-span-5 space-y-4 sm:space-y-5">
          <IOSCard variant="default" className="space-y-4">
            <IOSCardHeader
              title="路线与出发参数"
              icon={Compass}
              iconColor="blue"
              action={
                <span className="text-xs text-ios-blue font-mono font-medium truncate max-w-[140px] sm:max-w-[180px]" title={customRouteName}>
                  {customRouteName}
                </span>
              }
            />

            {/* Departure Time & Speed */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">计划出发时间</label>
                <input
                  type="time"
                  value={departureTime}
                  onChange={(e) => setDepartureTime(e.target.value)}
                  className="w-full bg-white/80 dark:bg-black/40 border border-slate-200/80 dark:border-white/15 rounded-xl px-3 py-1.5 text-xs text-ios-blue font-mono focus:border-ios-blue focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  预计均速 ({isImperial ? 'mph' : 'km/h'})
                </label>
                <NumberStepper
                  value={displayAvgSpeed}
                  onChange={handleAvgSpeedChange}
                  min={10}
                  max={70}
                  step={1}
                  unit={isImperial ? 'mph' : 'km/h'}
                />
              </div>
            </div>

            {/* Presets Grid */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">行者精选·浙江经典实测路线:</span>
                <label className="text-[11px] text-ios-blue hover:underline cursor-pointer font-medium flex items-center gap-1 apple-touch">
                  <Upload className="w-3 h-3" />
                  自定义 GPX
                  <input type="file" accept=".gpx,.tcx,.xml" onChange={handleGpxUpload} className="hidden" />
                </label>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {ZHEJIANG_XINGZHE_ROUTES.map((r) => {
                  const isSelected = selectedRouteId === r.id;
                  return (
                    <button
                      key={r.id}
                      onClick={() => loadPresetRoute(r.id)}
                      className={`px-2 py-1.5 rounded-xl border text-left text-xs transition apple-touch ${
                        isSelected
                          ? 'bg-ios-blue text-white border-ios-blue font-bold shadow-ios-md ring-2 ring-ios-blue/30 scale-[1.01]'
                          : 'bg-white/70 dark:bg-white/5 border-slate-200/80 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-white/20'
                      }`}
                    >
                      <span className={`truncate block ${isSelected ? 'font-bold text-white' : 'font-semibold'}`}>
                        {r.name.split('-')[0].replace('宁波', '').replace('德清', '').replace('舟山', '').replace('安吉', '')}
                      </span>
                      <span className={`text-[11px] block font-mono ${isSelected ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'}`}>
                        {isImperial ? `${Math.round(r.distanceKm * 0.621371)}mi` : `${r.distanceKm}km`} | {r.city}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Map Canvas */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400 font-medium">
                <span>在地图上点击添加/微调路线航点</span>
                <span className="font-mono text-ios-blue font-semibold">{routePoints.length} 个航点</span>
              </div>
              <div ref={mapContainerRef} className="w-full h-72 rounded-xl border border-slate-200/80 dark:border-white/10 shadow-inner overflow-hidden"></div>
            </div>
          </IOSCard>
        </div>

        {/* Right Segment Weather Details */}
        <div className="lg:col-span-7 space-y-4 sm:space-y-5">
          {weatherSegments.length === 0 ? (
            <div className="ios-card p-4 sm:p-5 py-10 sm:py-12 rounded-2xl border border-slate-200/80 dark:border-white/10 text-center flex flex-col items-center justify-center space-y-2.5 shadow-ios-card">
              <div className="w-12 h-12 rounded-xl bg-ios-blue/10 border border-ios-blue/20 flex items-center justify-center text-ios-blue shadow-ios-sm">
                <CloudSun className="w-6 h-6" />
              </div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">暂无路段气象数据</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
                请在左侧设定出发时间与均速，点击上方「生成全路段天气顾问」按钮获取实时气象分析。
              </p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {/* Cycling Gear & Hydration Recommendations Card */}
              <div className="ios-card p-4 rounded-2xl border border-ios-blue/25 bg-ios-blue/10 flex items-start gap-3 shadow-ios-card">
                <ShieldCheck className="w-4 h-4 text-ios-blue shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs">
                  <span className="font-bold text-slate-900 dark:text-white block">智能装备与补水补给建议</span>
                  <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                    全程最高气温约 <strong>{isImperial ? `${Math.round(maxTemp * 9/5 + 32)}°F` : `${maxTemp}°C`}</strong>，紫外线峰值 <strong>UV {maxUv}</strong>。
                    {maxTemp > 28 ? '建议携带双水壶，每小时饮水补给 600~800ml 并补充电解质泡腾片。' : '气温舒适，建议每小时补充 500ml 水分。'}
                    {maxUv >= 6 ? ' 紫外线较强，请涂抹 SPF50+ 运动防晒霜或穿戴冰丝袖套。' : ''}
                  </p>
                </div>
              </div>

              {/* Crosswind Gust Alert for Carbon Wheels */}
              {maxCrosswindKmh >= 20 && (
                <div className="ios-card p-4 rounded-2xl border border-ios-orange/30 bg-ios-orange/10 flex items-start gap-3 shadow-ios-card">
                  <AlertTriangle className="w-4 h-4 text-ios-orange shrink-0 mt-0.5" />
                  <div className="space-y-1 text-xs">
                    <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span>强侧风预警</span>
                      <span className="font-mono px-2 py-0.5 bg-ios-orange/20 text-ios-orange rounded-full text-[11px] font-bold">
                        侧风峰值 {isImperial ? `${Math.round(maxCrosswindKmh * 0.621371)} mph` : `${maxCrosswindKmh} km/h`}
                      </span>
                    </div>
                    <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                      监测到沿途存在明显侧向风/侧顶风！使用 <strong>≥50mm 高框碳纤维轮组</strong>（特别是前轮）在跨海大桥、山脊风口或遭遇大货车交汇时，将产生强烈的横向偏航力矩引起车头突发晃动。<strong>操稳建议：</strong>通过侧风区时请提前握牢下把位以降低重心、拓宽臂展杠杆控制，切忌在此区间单手离把饮水或看表！
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-2.5">
                {weatherSegments.map((seg) => (
                  <div key={seg.pointIndex} className={`ios-card p-3.5 rounded-xl border space-y-2.5 shadow-ios-card ${seg.isFallback ? 'border-amber-400/40 dark:border-amber-400/30' : 'border-slate-200/80 dark:border-white/10'}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 dark:border-white/10 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-ios-blue/15 text-ios-blue flex items-center justify-center text-[11px] font-bold font-mono">
                          {seg.pointIndex}
                        </span>
                        <span className="text-xs font-semibold text-slate-900 dark:text-white">
                          {seg.distanceKm === 0 ? '出发起点' : `路程 ${isImperial ? `${(seg.distanceKm * 0.621371).toFixed(1)} mi` : `${seg.distanceKm} km`} 处`}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 font-mono">
                          <Clock className="w-3 h-3 text-slate-400" />
                          预计 {seg.estimatedTimeStr} 到达
                        </span>
                        {seg.isFallback && (
                          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-400/15 border border-amber-400/40 text-amber-600 dark:text-amber-400 text-[10px] font-semibold" title="该断面的气象 API 请求失败，以下数据为固定估算值，仅供参考，请勿用于安全判断">
                            <AlertTriangle className="w-2.5 h-2.5" />
                            估算数据
                          </span>
                        )}
                      </div>

                      <div className="text-xs font-semibold text-ios-blue flex items-center gap-1">
                        <Wind className="w-3.5 h-3.5" />
                        <span>{seg.windRelation}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div className="flex items-center gap-2">
                        <Thermometer className="w-4 h-4 text-ios-orange" />
                        <div>
                          <span className="text-slate-500 dark:text-slate-400 block text-[11px]">气温 / 体感</span>
                          <span className="text-slate-900 dark:text-white font-mono font-semibold">
                            {isImperial
                              ? `${Math.round(seg.temp * 9/5 + 32)}°F / ${Math.round(seg.feelsLike * 9/5 + 32)}°F`
                              : `${seg.temp}°C / ${seg.feelsLike}°C`}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Wind className="w-4 h-4 text-ios-blue" />
                        <div>
                          <span className="text-slate-500 dark:text-slate-400 block text-[11px]">风速风向</span>
                          <span className="text-slate-900 dark:text-white font-mono font-semibold">
                            {isImperial
                              ? `${Math.round(seg.windSpeedKmh * 0.621371)} mph`
                              : `${seg.windSpeedKmh} km/h`} ({seg.windDirectionDeg}°)
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Droplets className="w-4 h-4 text-ios-blue" />
                        <div>
                          <span className="text-slate-500 dark:text-slate-400 block text-[11px]">湿度 / 降水率</span>
                          <span className="text-slate-900 dark:text-white font-mono font-semibold">{seg.humidity}% / {seg.precipProb}%</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Sun className="w-4 h-4 text-ios-orange" />
                        <div>
                          <span className="text-slate-500 dark:text-slate-400 block text-[11px]">紫外线指数</span>
                          <span className="text-slate-900 dark:text-white font-mono font-semibold">UV {seg.uvIndex} ({seg.uvIndex >= 6 ? '强' : '中等'})</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
