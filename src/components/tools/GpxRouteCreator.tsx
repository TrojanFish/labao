import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  MapPin, Mountain, Download, Upload, RefreshCw, Navigation, Play, Plus, Trash2, Search,
  ArrowRightLeft, ArrowUp, ArrowDown, FileCode, CheckCircle2, X, Wind, Zap, Compass,
  Flame, Droplets, Bike, Sliders, ChevronRight, Activity, BarChart2, Share2, Gauge
} from 'lucide-react';
import { Line } from 'react-chartjs-2';
import L from 'leaflet';
import { createCachedTileLayer } from '../../utils/mapTileCache';
import { useToast } from '../../context/ToastContext';
import { useRiderProfile } from '../../context/RiderProfileContext';
import { useLanguageAndUnit } from '../../context/LanguageAndUnitContext';
import { IOSCard, IOSCardHeader, IOSMetricTile } from '../common/IOSCard';
import { IOSToolHeader } from '../common/IOSToolHeader';
import { IOSSegmentedControl } from '../common/IOSSegmentedControl';
import { NumberStepper } from '../common/NumberStepper';
import { ShareCardModal } from '../common/ShareCardModal';
import { generateRoadbookPoster, generateCoursePacingPoster } from '../../utils/shareCardGenerators';
import {
  computeCoursePacingPlan,
  CourseSegment,
  CoursePacingSummary
} from '../../utils/routePacingEngine';
import { ZHEJIANG_XINGZHE_ROUTES } from '../../data/zhejiangRoutes';
import { consumePendingTransfer } from '../../hooks/useToolDraftState';

interface Waypoint {
  id: string;
  lat: number;
  lng: number;
  elevation: number;
  name?: string;
}

const WIND_COMPASS_PRESETS = [
  { label: '北 N', deg: 0, sub: '0°' },
  { label: '东北 NE', deg: 45, sub: '45°' },
  { label: '东 E', deg: 90, sub: '90°' },
  { label: '东南 SE', deg: 135, sub: '135°' },
  { label: '南 S', deg: 180, sub: '180°' },
  { label: '西南 SW', deg: 225, sub: '225°' },
  { label: '西 W', deg: 270, sub: '270°' },
  { label: '西北 NW', deg: 315, sub: '315°' },
];

export const GpxRouteCreator: React.FC = () => {
  const { showToast } = useToast();
  const { profile, activeBike } = useRiderProfile();
  const { language } = useLanguageAndUnit();

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const hoverMarkerRef = useRef<L.CircleMarker | null>(null);

  // Active view mode: Route Studio (Map/Editing) vs Pacing & Aero Engine
  const [activeTab, setActiveTab] = useState<'route_studio' | 'pacing_engine'>('route_studio');

  const [waypoints, setWaypoints] = useState<Waypoint[]>(ZHEJIANG_XINGZHE_ROUTES[0].waypoints);
  const [selectedPresetId, setSelectedPresetId] = useState<string>(ZHEJIANG_XINGZHE_ROUTES[0].id);

  // Share Poster State
  const [sharePosterUrl, setSharePosterUrl] = useState<string | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);
  const [sharePosterTitle, setSharePosterTitle] = useState<string>('GPX 航迹路书海报');

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [routeName, setRouteName] = useState<string>(ZHEJIANG_XINGZHE_ROUTES[0].name);

  // Environmental & Aerodynamic Pacing State
  const [windSpeedKmh, setWindSpeedKmh] = useState<number>(14);
  const [windDirectionDeg, setWindDirectionDeg] = useState<number>(90); // 90° = East wind
  const [ambientTempC, setAmbientTempC] = useState<number>(22);
  const [strategyMode, setStrategyMode] = useState<'conservative' | 'balanced' | 'aggressive'>('balanced');
  const [selectedHoverSegment, setSelectedHoverSegment] = useState<CourseSegment | null>(null);

  // Check for route transferred from RoadbookLibrary
  useEffect(() => {
    const pending = consumePendingTransfer<{ name?: string; waypoints?: any[] }>('solorider_pending_gpx_route');
    if (pending && Array.isArray(pending.waypoints) && pending.waypoints.length > 0) {
      const mapped: Waypoint[] = pending.waypoints.map((wp: any, idx: number) => ({
        id: 'wp-' + Date.now() + '-' + idx,
        lat: wp.lat,
        lng: wp.lng,
        elevation: wp.elevation || 20,
        name: wp.name || `航点 #${idx + 1}`
      }));
      setWaypoints(mapped);
      if (pending.name) {
        setRouteName(pending.name);
      }
      setSelectedPresetId('custom');
      showToast(`已成功载入路书「${pending.name || '外部路线'}」共 ${mapped.length} 个航点，可自由编辑与测算！`, 'success');
    }
  }, [showToast]);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [30.22, 120.10],
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

    map.on('click', async (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      let elevation = 20;
      try {
        const res = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lat.toFixed(5)}&longitude=${lng.toFixed(5)}`);
        const data = await res.json();
        if (data.elevation && data.elevation[0]) {
          elevation = Math.round(data.elevation[0]);
        }
      } catch (err) {
        elevation = Math.round(15 + Math.random() * 50);
      }

      setWaypoints(prev => [
        ...prev,
        { id: Date.now().toString(), lat, lng, elevation, name: `航点 #${prev.length + 1}` }
      ]);
    });

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update map polyline & markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (polylineRef.current) {
      polylineRef.current.remove();
    }
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    if (waypoints.length >= 1) {
      const latLngs = waypoints.map(w => [w.lat, w.lng] as [number, number]);

      if (waypoints.length >= 2) {
        const polyline = L.polyline(latLngs, {
          color: '#0A84FF',
          weight: 4,
          opacity: 0.88
        }).addTo(map);
        polylineRef.current = polyline;
        map.fitBounds(polyline.getBounds(), { padding: [30, 30] });
      }

      // Add Start & End Markers with custom crisp DivIcon
      if (waypoints[0]) {
        const startIcon = L.divIcon({
          className: 'custom-map-start-pin',
          html: `
            <div style="display:flex; flex-direction:column; align-items:center; filter:drop-shadow(0 3px 6px rgba(0,0,0,0.35)); pointer-events:auto; cursor:pointer;">
              <div style="background:#10B981; color:#FFFFFF; font-weight:700; font-size:11px; padding:2px 8px; border-radius:12px; border:2px solid #FFFFFF; white-space:nowrap; box-shadow:0 1px 4px rgba(0,0,0,0.2);">
                起点
              </div>
              <div style="width:0; height:0; border-left:5px solid transparent; border-right:5px solid transparent; border-top:6px solid #10B981; margin-top:-1px;"></div>
            </div>
          `,
          iconSize: [42, 30],
          iconAnchor: [21, 29],
          popupAnchor: [0, -29]
        });
        const startMarker = L.marker([waypoints[0].lat, waypoints[0].lng], { icon: startIcon })
          .addTo(map)
          .bindPopup(`<b>起点: ${waypoints[0].name || '起点'}</b><br/>海拔: ${waypoints[0].elevation}m`);
        markersRef.current.push(startMarker);
      }
      if (waypoints.length > 1) {
        const endW = waypoints[waypoints.length - 1];
        const endIcon = L.divIcon({
          className: 'custom-map-end-pin',
          html: `
            <div style="display:flex; flex-direction:column; align-items:center; filter:drop-shadow(0 3px 6px rgba(0,0,0,0.35)); pointer-events:auto; cursor:pointer;">
              <div style="background:#EF4444; color:#FFFFFF; font-weight:700; font-size:11px; padding:2px 8px; border-radius:12px; border:2px solid #FFFFFF; white-space:nowrap; box-shadow:0 1px 4px rgba(0,0,0,0.2);">
                终点
              </div>
              <div style="width:0; height:0; border-left:5px solid transparent; border-right:5px solid transparent; border-top:6px solid #EF4444; margin-top:-1px;"></div>
            </div>
          `,
          iconSize: [42, 30],
          iconAnchor: [21, 29],
          popupAnchor: [0, -29]
        });
        const endMarker = L.marker([endW.lat, endW.lng], { icon: endIcon })
          .addTo(map)
          .bindPopup(`<b>终点: ${endW.name || '终点'}</b><br/>海拔: ${endW.elevation}m`);
        markersRef.current.push(endMarker);
      }
    }
  }, [waypoints]);

  // Reactive Physics & Aerodynamic Pacing Engine Solver
  const pacingPlan: CoursePacingSummary = useMemo(() => {
    return computeCoursePacingPlan(
      waypoints.map(w => ({ lat: w.lat, lng: w.lng, elevation: w.elevation, name: w.name })),
      {
        ftpWatts: profile.ftpWatts || 220,
        riderWeightKg: profile.weightKg || 68,
        bikeWeightKg: activeBike?.weightKg || profile.bikeWeightKg || 8.5,
        cda: activeBike?.cda || 0.32,
        crr: activeBike?.crr || 0.0035,
        windSpeedKmh,
        windDirectionDeg,
        ambientTempC,
        strategyMode
      }
    );
  }, [waypoints, profile.ftpWatts, profile.weightKg, profile.bikeWeightKg, activeBike, windSpeedKmh, windDirectionDeg, ambientTempC, strategyMode]);

  // High-Resolution Gradient Elevation Chart with Dual Y-Axis (Elevation + Target Watts)
  const chartData = useMemo(() => {
    const segs = pacingPlan.segments;
    if (segs.length === 0) {
      return { labels: [], datasets: [] };
    }

    return {
      labels: segs.map(s => `${s.endDistKm} km`),
      datasets: [
        {
          type: 'line' as const,
          label: '海拔剖面 (m)',
          data: segs.map(s => s.endEleM),
          yAxisID: 'y',
          fill: true,
          tension: 0.3,
          pointRadius: 2,
          pointHoverRadius: 6,
          segment: {
            borderColor: (ctx: any) => {
              const seg = segs[ctx.p1DataIndex];
              return seg ? seg.color : '#10B981';
            },
            backgroundColor: (ctx: any) => {
              const seg = segs[ctx.p1DataIndex];
              return seg ? `${seg.color}25` : 'rgba(16, 185, 129, 0.15)';
            }
          }
        },
        {
          type: 'line' as const,
          label: '目标配速功率 (W)',
          data: segs.map(s => s.targetWatts),
          yAxisID: 'y1',
          borderColor: '#F59E0B', // Apple Amber
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderDash: [3, 3],
          tension: 0.25,
          pointRadius: 1.5,
          pointHoverRadius: 5,
          pointBackgroundColor: '#F59E0B',
          fill: false
        }
      ]
    };
  }, [pacingPlan]);

  // Hover chart sync marker on Leaflet map
  const handleChartHover = (event: any, activeElements: any[]) => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (activeElements && activeElements.length > 0) {
      const index = activeElements[0].index;
      const seg = pacingPlan.segments[index];
      if (seg) {
        setSelectedHoverSegment(seg);
        if (!hoverMarkerRef.current) {
          hoverMarkerRef.current = L.circleMarker([seg.lat, seg.lng], {
            radius: 8,
            color: '#ffffff',
            fillColor: seg.color,
            fillOpacity: 1,
            weight: 3
          }).addTo(map);
        } else {
          hoverMarkerRef.current.setLatLng([seg.lat, seg.lng]);
          hoverMarkerRef.current.setStyle({ fillColor: seg.color });
        }
      }
    } else {
      if (hoverMarkerRef.current) {
        hoverMarkerRef.current.remove();
        hoverMarkerRef.current = null;
      }
      setSelectedHoverSegment(null);
    }
  };

  // Load Preset Route from Xingzhe Database
  const loadPresetRoute = (routeId: string) => {
    const targetRoute = ZHEJIANG_XINGZHE_ROUTES.find(r => r.id === routeId);
    if (targetRoute) {
      setSelectedPresetId(targetRoute.id);
      setRouteName(targetRoute.name);
      setWaypoints(targetRoute.waypoints);
      showToast(`已加载行者实测路书: ${targetRoute.name}`, 'success', `全长 ${targetRoute.distanceKm}km | 累计爬升 +${targetRoute.elevationGainM}m`);
    }
  };

  // Search Location via Nominatim
  const handleSearchLocation = async () => {
    if (!searchQuery.trim() || !mapInstanceRef.current) return;
    setIsSearching(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      if (data && data.length > 0) {
        const first = data[0];
        const lat = parseFloat(first.lat);
        const lng = parseFloat(first.lon);
        mapInstanceRef.current.setView([lat, lng], 14);
        showToast('已定位至地名位置', 'success', first.display_name);
      } else {
        showToast('未找到该地点，请换个关键词重试', 'warning');
      }
    } catch (e) {
      showToast('地名搜索失败，请检查网络连接', 'error');
    } finally {
      setIsSearching(false);
    }
  };

  // Reverse route
  const handleReverseRoute = () => {
    setWaypoints(prev => [...prev].reverse());
    showToast('已成功反转路书航迹方向！', 'info');
  };

  // Import GPX File
  const handleGpxFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(content, 'text/xml');
        const trkpts = xmlDoc.getElementsByTagName('trkpt');

        if (trkpts.length === 0) {
          showToast('无法识别 GPX 航点数据，请确认文件格式！', 'error');
          return;
        }

        const parsedWaypoints: Waypoint[] = [];
        // Sample points if too dense (up to 60 key points for high performance)
        const step = Math.max(1, Math.floor(trkpts.length / 60));

        for (let i = 0; i < trkpts.length; i += step) {
          const pt = trkpts[i];
          const lat = parseFloat(pt.getAttribute('lat') || '0');
          const lng = parseFloat(pt.getAttribute('lon') || '0');
          const eleNode = pt.getElementsByTagName('ele')[0];
          const elevation = eleNode ? Math.round(parseFloat(eleNode.textContent || '0')) : 30;

          if (lat && lng) {
            parsedWaypoints.push({
              id: Date.now().toString() + i,
              lat,
              lng,
              elevation,
              name: `导入点 #${parsedWaypoints.length + 1}`
            });
          }
        }

        setWaypoints(parsedWaypoints);
        setRouteName(file.name.replace(/\.[^/.]+$/, ''));
        setSelectedPresetId('custom');
        showToast('GPX 文件解析导入成功！', 'success', `共导入 ${parsedWaypoints.length} 个核心航迹点`);
      } catch (err) {
        showToast('GPX 解析失败，请检查文件格式！', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Export GPX XML
  const handleExportGpx = () => {
    if (waypoints.length < 2) {
      showToast('航点数量不足，请在地图上至少添加 2 个点！', 'warning');
      return;
    }

    const gpxXml = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="LaBao PRO Roadbook Studio" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${routeName}</name>
    <time>${new Date().toISOString()}</time>
  </metadata>
  <trk>
    <name>${routeName}</name>
    <trkseg>
${waypoints.map(w => `      <trkpt lat="${w.lat}" lon="${w.lng}">
        <ele>${w.elevation}</ele>
        <time>${new Date().toISOString()}</time>
      </trkpt>`).join('\n')}
    </trkseg>
  </trk>
</gpx>`;

    const blob = new Blob([gpxXml], { type: 'application/gpx+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${routeName.replace(/\s+/g, '_')}.gpx`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('标准 GPX 路书文件已生成并下载！', 'success');
  };

  // Generate Roadbook / Pacing Poster
  const handleGeneratePoster = () => {
    try {
      if (activeTab === 'pacing_engine') {
        const windDesc = `${windSpeedKmh}km/h (${windDirectionDeg}°) · 顶风 ${pacingPlan.headwindPct}%`;
        const keySegs = pacingPlan.segments.slice(0, 7).map(s => ({
          name: `第${s.index}区段 ${s.gradientLabel}`,
          distKm: s.distKm,
          gradePct: s.gradePct,
          targetWatts: s.targetWatts,
          speedKmh: s.speedKmh,
          windDesc: s.windRelationLabel.split(' ')[0]
        }));

        const url = generateCoursePacingPoster({
          routeName: routeName || '自制航迹路书',
          distanceKm: pacingPlan.totalDistanceKm,
          elevationGainM: pacingPlan.totalElevationGainM,
          estTimeStr: pacingPlan.totalDurationFormatted,
          avgSpeedKmh: pacingPlan.avgSpeedKmh,
          npWatts: pacingPlan.normalizedPowerWatts,
          intensityFactor: pacingPlan.intensityFactor,
          tss: pacingPlan.trainingStressScore,
          totalKj: pacingPlan.totalWorkKj,
          windDesc,
          carbsPerHourG: pacingPlan.nutrition.recommendedCarbsPerHourG,
          fluidPerHourMl: pacingPlan.nutrition.recommendedFluidPerHourMl,
          headwindPct: pacingPlan.headwindPct,
          keySegments: keySegs
        });
        setSharePosterUrl(url);
        setSharePosterTitle('风阻配速策略长图海报');
        setIsShareModalOpen(true);
      } else {
        const maxAlt = waypoints.reduce((max, w) => Math.max(max, w.elevation), 0);
        const url = generateRoadbookPoster({
          routeName: routeName || '自制航迹路书',
          sourceCode: 'GPX ROUTE',
          distanceKm: pacingPlan.totalDistanceKm,
          elevationGainM: pacingPlan.totalElevationGainM,
          maxAltitudeM: maxAlt,
          avgGradePct: pacingPlan.avgGradePct,
          sceneryRating: 5,
          roadCondition: pacingPlan.totalDistanceKm > 80 ? '进阶耐力路线' : '优质骑行绿道',
          highlights: [
            `规划航点 ${waypoints.length} 个`,
            `累计爬升 +${pacingPlan.totalElevationGainM}m`,
            `预估完赛 ${pacingPlan.totalDurationFormatted}`,
            'GIS拓扑校准航迹'
          ],
          description: `包含 ${waypoints.length} 个核心航迹点，起止于 ${waypoints[0]?.name || '起点'} 至 ${waypoints[waypoints.length - 1]?.name || '终点'}。`
        });
        setSharePosterUrl(url);
        setSharePosterTitle('GPX 航迹路书海报');
        setIsShareModalOpen(true);
      }
    } catch (e) {
      showToast('海报生成失败，请重试', 'error');
    }
  };

  // Waypoint operations
  const deleteWaypoint = (id: string) => {
    setWaypoints(prev => prev.filter(w => w.id !== id));
  };

  const moveWaypoint = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === waypoints.length - 1) return;

    setWaypoints(prev => {
      const copy = [...prev];
      const targetIdx = direction === 'up' ? index - 1 : index + 1;
      const temp = copy[index];
      copy[index] = copy[targetIdx];
      copy[targetIdx] = temp;
      return copy;
    });
  };

  // Wind speed Beaufort helper
  const getBeaufortTag = (speed: number) => {
    if (speed <= 5) return '0-1级 微风徐徐';
    if (speed <= 19) return '2-3级 清爽和风';
    if (speed <= 28) return '4级 强劲清风';
    if (speed <= 38) return '5级 显著疾风';
    return '6级+ 强风阻力';
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Standard Apple HIG Tool Header */}
      <IOSToolHeader
        category={language === 'zh-TW' ? '路線與氣象' : '路线与气象'}
        categoryIcon={Navigation}
        title={language === 'zh-TW' ? '路線規劃' : '路线规划'}
        description="地名智能搜索、航点编辑、气动风阻矢量推演与 Best Bike Split 式分段体能策略解算。"
        tint="mint"
        onShare={handleGeneratePoster}
        shareTitle={activeTab === 'pacing_engine' ? '生成配速策略长图' : '生成航迹长图海报'}
        actions={
          <>
            <label className="apple-touch h-9 px-3.5 sm:px-4 rounded-xl bg-white/80 dark:bg-white/10 hover:bg-white dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200/80 dark:border-white/10 cursor-pointer shadow-xs transition flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0">
              <Upload className="w-3.5 h-3.5 text-ios-mint shrink-0" />
              <span>导入 GPX</span>
              <input type="file" accept=".gpx,.xml" onChange={handleGpxFileUpload} className="hidden" />
            </label>
            <button
              onClick={handleReverseRoute}
              className="apple-touch h-9 px-3.5 sm:px-4 rounded-xl bg-white/80 dark:bg-white/10 hover:bg-white dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200/80 dark:border-white/10 shadow-xs transition flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
              title="一键反转起点与终点"
            >
              <ArrowRightLeft className="w-3.5 h-3.5 text-ios-mint shrink-0" />
              <span>反转路线</span>
            </button>
            <button
              onClick={handleExportGpx}
              className="apple-touch h-9 px-3.5 sm:px-4 bg-ios-mint hover:bg-ios-mint/90 text-slate-950 font-bold rounded-xl text-xs transition shadow-ios-sm flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5 shrink-0" />
              <span>导出 .GPX</span>
            </button>
          </>
        }
      />

      {/* Dual Mode Switcher: Apple HIG Segmented Control */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <IOSSegmentedControl
          options={[
            {
              id: 'route_studio',
              value: 'route_studio',
              label: (
                <>
                  <span className="sm:hidden">航迹编辑</span>
                  <span className="hidden sm:inline">航迹地图与编辑</span>
                </>
              ),
              icon: MapPin
            },
            {
              id: 'pacing_engine',
              value: 'pacing_engine',
              label: (
                <>
                  <span className="sm:hidden">策略引擎</span>
                  <span className="hidden sm:inline">风阻与体能策略引擎</span>
                </>
              ),
              icon: Zap
            }
          ]}
          value={activeTab}
          onChange={(val) => setActiveTab(val as 'route_studio' | 'pacing_engine')}
          tint="blue"
          mobileFullWidth={true}
          className="w-full sm:w-auto"
        />

        {/* Garage Active Bike Status Pill */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 text-xs text-slate-600 dark:text-slate-300">
          <Bike className="w-3.5 h-3.5 text-ios-blue shrink-0" />
          <span className="font-semibold truncate max-w-[170px] sm:max-w-xs">
            {activeBike ? activeBike.name : '标准综合公路车'}
          </span>
          <span className="text-[11px] font-mono tabular-nums text-slate-400">
            {activeBike ? `${activeBike.weightKg}kg · CdA ${activeBike.cda}` : '8.5kg · CdA 0.32'}
          </span>
        </div>
      </div>

      {/* Xingzhe Verified Zhejiang Routes Showcase Bar */}
      <IOSCard variant="default" padding="none" className="p-3.5 sm:p-4 space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
              <Mountain className="w-3.5 h-3.5 text-ios-mint" />
              行者精选·浙江实测经典路书 (6条经典高频):
            </span>
          </div>

          <div className="flex items-center gap-2 flex-1 max-w-sm">
            <label className="text-xs text-slate-500 dark:text-slate-400 shrink-0">当前路书:</label>
            <input
              type="text"
              value={routeName}
              onChange={(e) => setRouteName(e.target.value)}
              className="w-full bg-white/90 dark:bg-black/40 border border-slate-200/80 dark:border-white/15 rounded-xl px-3 py-1 text-xs text-ios-blue font-bold focus:outline-none focus:border-ios-blue truncate"
            />
          </div>
        </div>

        {/* 6 Route Pills Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {ZHEJIANG_XINGZHE_ROUTES.map((route) => {
            const isSelected = selectedPresetId === route.id;
            return (
              <button
                key={route.id}
                onClick={() => loadPresetRoute(route.id)}
                className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between apple-touch ${
                  isSelected
                    ? 'bg-ios-blue text-white border-ios-blue ring-2 ring-ios-blue/30 shadow-ios-md scale-[1.01]'
                    : 'bg-white/70 dark:bg-white/5 border-slate-200/70 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-white/20'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className={`text-[11px] px-1.5 py-0.5 rounded-md font-mono font-bold ${
                      isSelected
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-200/70 dark:bg-white/10 text-slate-700 dark:text-slate-300'
                    }`}>
                      {route.city}
                    </span>
                    <span className={`text-[11px] font-mono ${isSelected ? 'text-white/90' : 'text-ios-blue'}`}>
                      {route.xingzheRoadbookId}
                    </span>
                  </div>
                  <div className={`text-xs font-bold truncate ${isSelected ? 'text-white' : ''}`} title={route.name}>
                    {route.name.split('-')[0].replace('宁波', '').replace('德清', '').replace('舟山', '').replace('安吉', '')}
                  </div>
                </div>

                <div className={`flex items-center justify-between text-[11px] font-mono mt-1.5 pt-1.5 border-t ${
                  isSelected
                    ? 'border-white/20 text-white/80'
                    : 'border-slate-200/60 dark:border-white/10 text-slate-500 dark:text-slate-400'
                }`}>
                  <span className="tabular-nums">{route.distanceKm}km</span>
                  <span className={`tabular-nums ${isSelected ? 'text-amber-200 font-bold' : 'text-ios-orange font-semibold'}`}>+{route.elevationGainM}m</span>
                </div>
              </button>
            );
          })}
        </div>
      </IOSCard>

      {/* Main Workspace Layout */}
      {activeTab === 'route_studio' ? (
        /* TAB 1: Route Studio & Map Editing */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
          {/* Left Map Area */}
          <div className="lg:col-span-7 space-y-3.5">
            {/* Search Bar */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="搜索定位地名/山峰 (如: 杭州西湖, 莫干山, 雁荡山)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearchLocation()}
                className="w-full h-9 bg-white/90 dark:bg-black/40 border border-slate-200/80 dark:border-white/15 rounded-xl pl-8.5 pr-20 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-ios-blue transition shadow-xs"
              />
              <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                {isSearching ? (
                  <div className="p-1 text-ios-blue pointer-events-none">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  </div>
                ) : (
                  <>
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="w-5 h-5 rounded-full bg-slate-200/70 dark:bg-white/15 text-slate-400 hover:text-slate-600 dark:hover:text-white flex items-center justify-center transition"
                        title="清除输入"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleSearchLocation}
                      className="apple-touch h-9 px-3 rounded-xl bg-ios-blue/10 hover:bg-ios-blue/20 text-ios-blue dark:text-ios-blue-dark text-xs font-semibold border border-ios-blue/20 transition flex items-center gap-1 shadow-ios-sm shrink-0"
                      title="定位所输地名"
                    >
                      <span>定位</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Leaflet Map Canvas */}
            <IOSCard variant="default" padding="none" className="p-2 overflow-hidden">
              <div ref={mapContainerRef} className="w-full h-[430px] rounded-xl border border-slate-200/60 dark:border-white/10 overflow-hidden"></div>
            </IOSCard>
          </div>

          {/* Right Route Stats & Elevation Profile */}
          <div className="lg:col-span-5 space-y-4">
            {/* Key Distance & Elevation Stats: 3 columns on mobile */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <IOSMetricTile
                label="全程总距离"
                value={pacingPlan.totalDistanceKm}
                unit="km"
                subtext={`${waypoints.length} 航点`}
                theme="blue"
                className="p-2.5 sm:p-4"
              />
              <IOSMetricTile
                label="累计爬升"
                value={`+${pacingPlan.totalElevationGainM}`}
                unit="m"
                subtext="海拔增益"
                theme="green"
                className="p-2.5 sm:p-4"
              />
              <IOSMetricTile
                label="累计下降"
                value={`-${pacingPlan.totalDescentM}`}
                unit="m"
                subtext="下坡缓释"
                theme="amber"
                className="p-2.5 sm:p-4"
              />
            </div>

            {/* Elevation Profile Chart with Hover Sync */}
            <IOSCard variant="default" padding="none" className="p-4 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-800 dark:text-white flex items-center gap-1.5">
                  <Mountain className="w-3.5 h-3.5 text-ios-blue" />
                  高分辨率海拔剖面 · 悬浮联动
                </span>
                <span className="text-[11px] text-slate-400 dark:text-slate-500">*坡度语义分色</span>
              </div>

              <div className="h-44">
                <Line
                  data={chartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    onHover: handleChartHover,
                    plugins: {
                      legend: { display: false },
                      tooltip: {
                        backgroundColor: 'rgba(28, 28, 30, 0.95)',
                        titleColor: '#0A84FF',
                        bodyColor: '#ffffff',
                        borderColor: 'rgba(10, 132, 255, 0.3)',
                        borderWidth: 1,
                        padding: 8
                      }
                    },
                    scales: {
                      x: { grid: { color: 'rgba(148, 163, 184, 0.1)' } },
                      y: { grid: { color: 'rgba(148, 163, 184, 0.1)' }, title: { display: true, text: '海拔 (m)' } },
                      y1: { display: false }
                    }
                  }}
                />
              </div>
            </IOSCard>

            {/* Waypoints List with Move/Delete Operations */}
            <IOSCard variant="default" padding="none" className="p-4 space-y-2.5">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-800 dark:text-white">航点序列明细:</span>
                <span className="text-slate-500 text-[11px]">可调整顺序或重命名</span>
              </div>
              <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
                {waypoints.map((w, idx) => (
                  <div key={w.id} className="p-2 rounded-xl bg-white/70 dark:bg-white/5 border border-slate-200/70 dark:border-white/10 flex items-center justify-between text-xs gap-2">
                    <div className="flex items-center gap-2 truncate flex-1">
                      <span className="w-5 h-5 rounded-full bg-ios-blue/15 text-ios-blue flex items-center justify-center text-[11px] font-bold font-mono shrink-0 tabular-nums">
                        {idx + 1}
                      </span>
                      <input
                        type="text"
                        value={w.name || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setWaypoints(prev => prev.map(item => item.id === w.id ? { ...item, name: val } : item));
                        }}
                        className="bg-transparent text-slate-800 dark:text-white text-xs truncate focus:outline-none focus:text-ios-blue w-full"
                        placeholder={`航点 #${idx + 1}`}
                      />
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono text-ios-blue font-semibold text-[11px] tabular-nums">
                        {w.elevation}m
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => moveWaypoint(idx, 'up')}
                          disabled={idx === 0}
                          className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-white/10 disabled:opacity-30 transition apple-touch"
                          title="上移"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => moveWaypoint(idx, 'down')}
                          disabled={idx === waypoints.length - 1}
                          className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-white/10 disabled:opacity-30 transition apple-touch"
                          title="下移"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => deleteWaypoint(w.id)}
                          disabled={waypoints.length <= 2}
                          className="p-1 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-900/30 text-rose-500 disabled:opacity-30 transition apple-touch"
                          title="删除航点"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </IOSCard>
          </div>
        </div>
      ) : (
        /* TAB 2: Aerodynamic Wind & Pacing Strategy Engine (Best Bike Split) */
        <div className="space-y-4 sm:space-y-5">
          {/* Virtual Wind & Environment Simulator Console */}
          <IOSCard variant="default" className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 dark:border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Wind className="w-4 h-4 text-ios-blue" />
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  虚拟风阻与微气候模拟器
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span className="font-mono text-ios-blue font-bold tabular-nums">ISA 空气密度: {pacingPlan.avgAirDensity} kg/m³</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Wind Direction Dial & Cardinal Buttons */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-600 dark:text-slate-300 font-semibold flex items-center gap-1">
                    <Compass className="w-3.5 h-3.5 text-ios-blue" />
                    来风方向:
                  </span>
                  <span className="font-mono text-ios-blue font-bold tabular-nums">
                    {windDirectionDeg}°
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-1.5">
                  {WIND_COMPASS_PRESETS.map(p => (
                    <button
                      key={p.deg}
                      onClick={() => setWindDirectionDeg(p.deg)}
                      className={`apple-touch h-8 px-1.5 rounded-lg text-xs font-semibold border transition flex flex-col items-center justify-center ${
                        windDirectionDeg === p.deg
                          ? 'bg-ios-blue text-white border-ios-blue shadow-ios-sm'
                          : 'bg-white/60 dark:bg-white/5 border-slate-200/70 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:border-ios-blue/40'
                      }`}
                    >
                      <span>{p.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Wind Speed & Temperature Steppers */}
              <div className="space-y-3">
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-600 dark:text-slate-300 font-semibold flex items-center gap-1">
                      <Wind className="w-3.5 h-3.5 text-ios-blue" />
                      风速强度:
                    </span>
                    <span className="text-[11px] text-ios-orange font-semibold">
                      {getBeaufortTag(windSpeedKmh)}
                    </span>
                  </div>
                  <NumberStepper
                    value={windSpeedKmh}
                    onChange={setWindSpeedKmh}
                    min={0}
                    max={65}
                    step={2}
                    unit="km/h"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-600 dark:text-slate-300 font-semibold">
                      环境气温:
                    </span>
                    <span className="text-[11px] text-slate-400">
                      影响空气密度与出汗率
                    </span>
                  </div>
                  <NumberStepper
                    value={ambientTempC}
                    onChange={setAmbientTempC}
                    min={-10}
                    max={45}
                    step={1}
                    unit="°C"
                  />
                </div>
              </div>

              {/* Pacing Strategy Style */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-600 dark:text-slate-300 font-semibold flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5 text-ios-blue" />
                    配速策略基调:
                  </span>
                  <span className="font-mono text-ios-blue font-bold">
                    {strategyMode === 'conservative' ? '90% FTP' : strategyMode === 'balanced' ? '100% FTP' : '108% FTP'}
                  </span>
                </div>

                <div className="space-y-1.5">
                  <button
                    onClick={() => setStrategyMode('conservative')}
                    className={`w-full p-2 rounded-xl text-left border transition apple-touch flex items-center justify-between ${
                      strategyMode === 'conservative'
                        ? 'bg-ios-blue/15 border-ios-blue text-ios-blue dark:text-white'
                        : 'bg-white/60 dark:bg-white/5 border-slate-200/70 dark:border-white/10 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-bold">保守耐力巡航</div>
                      <div className="text-[10px] text-slate-400">适合超长距离拉练，避免过早力竭</div>
                    </div>
                    {strategyMode === 'conservative' && <CheckCircle2 className="w-4 h-4 text-ios-blue shrink-0" />}
                  </button>

                  <button
                    onClick={() => setStrategyMode('balanced')}
                    className={`w-full p-2 rounded-xl text-left border transition apple-touch flex items-center justify-between ${
                      strategyMode === 'balanced'
                        ? 'bg-ios-blue/15 border-ios-blue text-ios-blue dark:text-white'
                        : 'bg-white/60 dark:bg-white/5 border-slate-200/70 dark:border-white/10 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-bold">均衡节奏挑战</div>
                      <div className="text-[10px] text-slate-400">大组挑战赛最优解，上坡发力平路巡航</div>
                    </div>
                    {strategyMode === 'balanced' && <CheckCircle2 className="w-4 h-4 text-ios-blue shrink-0" />}
                  </button>

                  <button
                    onClick={() => setStrategyMode('aggressive')}
                    className={`w-full p-2 rounded-xl text-left border transition apple-touch flex items-center justify-between ${
                      strategyMode === 'aggressive'
                        ? 'bg-ios-blue/15 border-ios-blue text-ios-blue dark:text-white'
                        : 'bg-white/60 dark:bg-white/5 border-slate-200/70 dark:border-white/10 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-bold">极限竞速突围</div>
                      <div className="text-[10px] text-slate-400">全力以赴刷 KOM，高心率阈值极限输出</div>
                    </div>
                    {strategyMode === 'aggressive' && <CheckCircle2 className="w-4 h-4 text-ios-blue shrink-0" />}
                  </button>
                </div>
              </div>
            </div>
          </IOSCard>

          {/* Strategy KPIs Dashboard: 6 Tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
            <IOSMetricTile
              label="预估完赛总用时"
              value={pacingPlan.totalDurationFormatted}
              unit=""
              subtext={`均速 ${pacingPlan.avgSpeedKmh} km/h`}
              theme="blue"
              className="p-3 sm:p-4"
            />
            <IOSMetricTile
              label="目标加权功率 NP"
              value={pacingPlan.normalizedPowerWatts}
              unit="W"
              subtext={`强度系数 IF ${pacingPlan.intensityFactor}`}
              theme="green"
              className="p-3 sm:p-4"
            />
            <IOSMetricTile
              label="预估训练压力 TSS"
              value={pacingPlan.trainingStressScore}
              unit=""
              subtext={`总做功 ${pacingPlan.totalWorkKj} kJ`}
              theme="purple"
              className="p-3 sm:p-4"
            />
            <IOSMetricTile
              label="顶风 / 顺风分布"
              value={`${pacingPlan.headwindPct}%`}
              unit="顶风"
              subtext={`顺风 ${pacingPlan.tailwindPct}% · 侧风 ${pacingPlan.crosswindPct}%`}
              theme="amber"
              className="p-3 sm:p-4"
            />
            <IOSMetricTile
              label="碳水补给推荐"
              value={pacingPlan.nutrition.recommendedCarbsPerHourG}
              unit="g/h"
              subtext={`全程需备 ${pacingPlan.nutrition.energyGelsCount} 支能量胶`}
              theme="orange"
              className="p-3 sm:p-4"
            />
            <IOSMetricTile
              label="水分与电解质"
              value={pacingPlan.nutrition.recommendedFluidPerHourMl}
              unit="ml/h"
              subtext={`全程约需 ${pacingPlan.nutrition.hydrationBottlesCount} 壶水`}
              theme="blue"
              className="p-3 sm:p-4"
            />
          </div>

          {/* Dual-Axis Elevation & Target Power Chart */}
          <IOSCard variant="default" padding="none" className="p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-ios-blue" />
                <span className="font-bold text-slate-900 dark:text-white">
                  全赛段坡度分色切片与目标功率曲线
                </span>
              </div>
              <div className="flex items-center gap-3 text-[11px]">
                <span className="flex items-center gap-1 text-slate-500">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span> 平路 &lt;2%
                </span>
                <span className="flex items-center gap-1 text-slate-500">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span> 缓坡 2-5%
                </span>
                <span className="flex items-center gap-1 text-slate-500">
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block"></span> 攻坚 5-8%
                </span>
                <span className="flex items-center gap-1 text-slate-500">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span> 陡坡 &gt;8%
                </span>
                <span className="flex items-center gap-1 text-amber-500 font-bold">
                  <span className="w-3 h-0.5 bg-amber-500 inline-block"></span> 目标功率
                </span>
              </div>
            </div>

            {/* Hover Segment Detailed Telemetry Ribbon */}
            {selectedHoverSegment ? (
              <div className="p-2.5 rounded-xl bg-ios-blue/10 border border-ios-blue/20 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md font-bold text-white text-[11px]" style={{ backgroundColor: selectedHoverSegment.color }}>
                    第 {selectedHoverSegment.index} 区段 · {selectedHoverSegment.gradientLabel}
                  </span>
                  <span className="font-semibold text-slate-800 dark:text-white tabular-nums">
                    里程 {selectedHoverSegment.startDistKm} ~ {selectedHoverSegment.endDistKm}km ({selectedHoverSegment.distKm}km)
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs font-mono tabular-nums">
                  <span>坡度: <b className="text-slate-900 dark:text-white">{selectedHoverSegment.gradePct > 0 ? `+${selectedHoverSegment.gradePct}%` : `${selectedHoverSegment.gradePct}%`}</b></span>
                  <span>目标功率: <b className="text-amber-500 font-bold">{selectedHoverSegment.targetWatts}W ({selectedHoverSegment.targetFtpPct}% FTP)</b></span>
                  <span>预估速度: <b className="text-ios-blue font-bold">{selectedHoverSegment.speedKmh} km/h</b></span>
                  <span>耗时: <b className="text-slate-700 dark:text-slate-300">{selectedHoverSegment.durationStr}</b></span>
                  <span className="text-slate-500">{selectedHoverSegment.windRelationLabel}</span>
                </div>
              </div>
            ) : (
              <div className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
                <span>💡 鼠标悬浮或滑动图表，可实时联动地图定位，并预览各分段动力学目标与阻力矢量</span>
              </div>
            )}

            <div className="h-56">
              <Line
                data={chartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  onHover: handleChartHover,
                  plugins: {
                    legend: { display: false },
                    tooltip: {
                      backgroundColor: 'rgba(28, 28, 30, 0.95)',
                      titleColor: '#0A84FF',
                      bodyColor: '#ffffff',
                      borderColor: 'rgba(10, 132, 255, 0.3)',
                      borderWidth: 1,
                      padding: 10
                    }
                  },
                  scales: {
                    x: { grid: { color: 'rgba(148, 163, 184, 0.08)' } },
                    y: {
                      grid: { color: 'rgba(148, 163, 184, 0.08)' },
                      title: { display: true, text: '海拔标高 (m)' }
                    },
                    y1: {
                      position: 'right',
                      grid: { drawOnChartArea: false },
                      title: { display: true, text: '目标功率 (W)' }
                    }
                  }
                }}
              />
            </div>
          </IOSCard>

          {/* Sector-by-Sector Pacing Breakdown Table */}
          <IOSCard variant="default" padding="none" className="p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 dark:border-white/10 pb-2.5">
              <div className="flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-ios-blue" />
                <span className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">
                  赛段动力学配速执行计划表 ({pacingPlan.segments.length} 个均质切片区段)
                </span>
              </div>
              <button
                onClick={handleGeneratePoster}
                className="apple-touch h-9 px-3 rounded-xl bg-ios-blue/10 hover:bg-ios-blue/20 text-ios-blue text-xs font-bold border border-ios-blue/20 transition flex items-center gap-1.5 self-start sm:self-auto shrink-0"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>导出配速策略工单海报</span>
              </button>
            </div>

            {/* Responsive Table Container */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-slate-200/70 dark:border-white/10 text-slate-400 text-[11px]">
                    <th className="pb-2 font-medium">区段</th>
                    <th className="pb-2 font-medium">距离区间</th>
                    <th className="pb-2 font-medium">坡度级别</th>
                    <th className="pb-2 font-medium">气动风阻矢量</th>
                    <th className="pb-2 font-medium text-right">目标功率</th>
                    <th className="pb-2 font-medium text-right">预估速度</th>
                    <th className="pb-2 font-medium text-right">分段耗时</th>
                    <th className="pb-2 font-medium text-right">攀爬率 VAM</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/50 dark:divide-white/5 font-mono">
                  {pacingPlan.segments.map(seg => {
                    const isHovered = selectedHoverSegment?.id === seg.id;
                    return (
                      <tr
                        key={seg.id}
                        onMouseEnter={() => setSelectedHoverSegment(seg)}
                        onMouseLeave={() => setSelectedHoverSegment(null)}
                        className={`transition hover:bg-slate-50 dark:hover:bg-white/5 ${isHovered ? 'bg-ios-blue/10 dark:bg-ios-blue/20' : ''}`}
                      >
                        <td className="py-2.5 font-bold text-slate-700 dark:text-slate-300">
                          #{seg.index}
                        </td>
                        <td className="py-2.5 text-slate-600 dark:text-slate-300 tabular-nums">
                          {seg.startDistKm} ~ {seg.endDistKm}km
                        </td>
                        <td className="py-2.5">
                          <span
                            className="px-2 py-0.5 rounded-md font-bold text-white text-[10px] inline-flex items-center gap-1 font-sans tabular-nums"
                            style={{ backgroundColor: seg.color }}
                          >
                            {seg.gradePct > 0 ? `+${seg.gradePct}%` : `${seg.gradePct}%`} · {seg.gradientLabel}
                          </span>
                        </td>
                        <td className="py-2.5 font-sans text-[11px] text-slate-600 dark:text-slate-300">
                          <span className={seg.headwindComponentMs > 2 ? 'text-rose-500 font-bold' : seg.headwindComponentMs < -2 ? 'text-emerald-500 font-bold' : 'text-slate-500'}>
                            {seg.windRelationLabel.split(' ')[0]}
                          </span>
                          <span className="text-[10px] text-slate-400 ml-1 font-mono tabular-nums">({seg.bearingDeg}°)</span>
                        </td>
                        <td className="py-2.5 text-right font-bold text-amber-500 tabular-nums">
                          {seg.targetWatts}W
                          <span className="text-[10px] text-slate-400 font-normal ml-1">({seg.targetFtpPct}%)</span>
                        </td>
                        <td className="py-2.5 text-right font-bold text-ios-blue tabular-nums">
                          {seg.speedKmh} <span className="text-[10px] font-normal text-slate-400">km/h</span>
                        </td>
                        <td className="py-2.5 text-right text-slate-700 dark:text-slate-300 tabular-nums">
                          {seg.durationStr}
                        </td>
                        <td className="py-2.5 text-right text-slate-500 tabular-nums">
                          {seg.vam > 0 ? `${seg.vam} m/h` : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </IOSCard>
        </div>
      )}

      {/* Social / Pacing Strategy Poster Modal */}
      <ShareCardModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        posterUrl={sharePosterUrl}
        fileName={`${routeName || 'GPX_Route'}_策略路书海报.png`}
        title={sharePosterTitle}
      />
    </div>
  );
};
