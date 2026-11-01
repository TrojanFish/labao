/**
 * Rouleur High-Resolution Canvas Share Poster Generator
 * Pure client-side 2D Canvas rendering with 2x/3x Retina crisp aesthetics
 */

// Common Canvas Helpers
function createPosterCanvas(width: number, height: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  return { canvas, ctx };
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  if (w < 2 * r) r = w / 2;
  if (h < 2 * r) r = h / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawBackground(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  accentColor: string = '#007AFF'
) {
  // Deep Night Gradient
  const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
  bgGrad.addColorStop(0, '#0a0e17');
  bgGrad.addColorStop(0.5, '#111827');
  bgGrad.addColorStop(1, '#070a10');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, w, h);

  // Ambient top light orb
  const orb = ctx.createRadialGradient(w / 2, 0, 10, w / 2, 0, 360);
  orb.addColorStop(0, accentColor + '35');
  orb.addColorStop(0.6, accentColor + '10');
  orb.addColorStop(1, 'transparent');
  ctx.fillStyle = orb;
  ctx.fillRect(0, 0, w, 400);

  // Outer border with subtle neon
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 2;
  roundRect(ctx, 1, 1, w - 2, h - 2, 0);
  ctx.stroke();
}

function drawHeader(
  ctx: CanvasRenderingContext2D,
  w: number,
  category: string,
  title: string,
  subtitle?: string,
  accentColor: string = '#007AFF'
) {
  // Brand Header
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.letterSpacing = '1.5px';
  ctx.fillText('YOLOCYCLING PRO · 骑行科学工坊', 40, 52);

  // Category Badge
  ctx.save();
  ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  const badgeText = category;
  const badgeWidth = ctx.measureText(badgeText).width + 24;
  roundRect(ctx, 40, 72, badgeWidth, 26, 13);
  ctx.fillStyle = accentColor + '25';
  ctx.fill();
  ctx.strokeStyle = accentColor + '60';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = accentColor;
  ctx.fillText(badgeText, 52, 89);
  ctx.restore();

  // Title
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 30px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.letterSpacing = '0.5px';
  ctx.fillText(title, 40, 134);

  // Subtitle
  if (subtitle) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(subtitle, 40, 162);
  }

  // Divider
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(40, 182);
  ctx.lineTo(w - 40, 182);
  ctx.stroke();
}

function drawMetricTile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  value: string | number,
  unit?: string,
  accentColor: string = '#007AFF'
) {
  // Tile background
  roundRect(ctx, x, y, w, h, 18);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Label
  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(label, x + 16, y + 26);

  // Value
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 26px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  const valStr = String(value);
  ctx.fillText(valStr, x + 16, y + 62);

  // Unit
  if (unit) {
    const valWidth = ctx.measureText(valStr).width;
    ctx.fillStyle = accentColor;
    ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(unit, x + 16 + valWidth + 6, y + 62);
  }
}

function drawFooter(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const y = h - 65;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(40, y);
  ctx.lineTo(w - 40, y);
  ctx.stroke();

  // Left text
  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  const now = new Date();
  const dateStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;
  ctx.fillText(`YoloCycling · 纯前端科学骑行计算引擎 · ${dateStr}`, 40, y + 36);

  // Right tag
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  const rightTag = 'yolocycling.app';
  const rightWidth = ctx.measureText(rightTag).width;
  ctx.fillText(rightTag, w - 40 - rightWidth, y + 36);
}

// 1. Power Profile Radar Poster
export interface PowerProfilePosterData {
  phenotype: string;
  phenotypeDesc: string;
  p5s: number;
  w5s: number | string;
  p1m: number;
  w1m: number | string;
  p5m: number;
  w5m: number | string;
  p20m: number;
  w20m: number | string;
  ftpWatts: number;
  weightKg: number;
  sweetSpotMin: number;
  sweetSpotMax: number;
}

export function generatePowerProfilePoster(data: PowerProfilePosterData): string {
  const w = 750;
  const h = 1080;
  const { ctx, canvas } = createPosterCanvas(w, h);
  const accent = '#FF3B30'; // ios-red

  drawBackground(ctx, w, h, accent);
  drawHeader(ctx, w, '⚡ 生理动力学 · 功率能力画像', '车手能力雷达与极化靶心战报', `车手自重 ${data.weightKg} kg · 功能阈值功率 ${data.ftpWatts} W`, accent);

  // Phenotype Card
  roundRect(ctx, 40, 204, w - 80, 94, 20);
  ctx.fillStyle = 'rgba(255, 59, 48, 0.08)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 59, 48, 0.25)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#FF453A';
  ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('车手类型判定', 60, 228);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(data.phenotype, 60, 256);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(data.phenotypeDesc, 60, 280);

  // Peak Power Metrics (4 Tiles)
  const tileW = (w - 80 - 15) / 2;
  drawMetricTile(ctx, 40, 312, tileW, 80, '5秒 神经肌肉冲刺', data.p5s, `W (${data.w5s} W/kg)`, '#FF375F');
  drawMetricTile(ctx, 40 + tileW + 15, 312, tileW, 80, '1分钟 无氧容量', data.p1m, `W (${data.w1m} W/kg)`, '#FF9F0A');
  drawMetricTile(ctx, 40, 406, tileW, 80, '5分钟 最大摄氧量', data.p5m, `W (${data.w5m} W/kg)`, '#30D158');
  drawMetricTile(ctx, 40 + tileW + 15, 406, tileW, 80, '20分钟 乳酸阈值功率', data.p20m, `W (${data.w20m} W/kg)`, '#0A84FF');

  // Radar Polygon Simulation Box
  const radarY = 500;
  const radarH = 340;
  roundRect(ctx, 40, radarY, w - 80, radarH, 20);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.stroke();

  // Draw 6-axis Radar Web in Canvas
  const centerX = w / 2;
  const centerY = radarY + radarH / 2;
  const radius = 110;
  const angles = [
    -Math.PI / 2,
    -Math.PI / 6,
    Math.PI / 6,
    Math.PI / 2,
    (5 * Math.PI) / 6,
    (-5 * Math.PI) / 6
  ];
  const axisLabels = ['5s 冲刺', '1m 无氧', '5m VO₂', '20m 阈值', '有氧耐力', '抗疲劳度'];

  // Concentric polygon grids
  [0.25, 0.5, 0.75, 1.0].forEach(level => {
    ctx.beginPath();
    angles.forEach((angle, i) => {
      const x = centerX + Math.cos(angle) * radius * level;
      const y = centerY + Math.sin(angle) * radius * level;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.stroke();
  });

  // Spokes
  angles.forEach(angle => {
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(centerX + Math.cos(angle) * radius, centerY + Math.sin(angle) * radius);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.stroke();
  });

  // User Radar Filled Polygon
  const p5sScore = Math.min(1.0, Math.max(0.3, Number(data.w5s) / 18));
  const p1mScore = Math.min(1.0, Math.max(0.3, Number(data.w1m) / 9.5));
  const p5mScore = Math.min(1.0, Math.max(0.3, Number(data.w5m) / 5.5));
  const p20mScore = Math.min(1.0, Math.max(0.3, Number(data.w20m) / 4.6));
  const scores = [p5sScore, p1mScore, p5mScore, p20mScore, (p20mScore + p5mScore) / 2, (p20mScore + p1mScore) / 2];

  ctx.beginPath();
  angles.forEach((angle, i) => {
    const r = radius * scores[i];
    const x = centerX + Math.cos(angle) * r;
    const y = centerY + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.fillStyle = 'rgba(255, 59, 48, 0.35)';
  ctx.fill();
  ctx.strokeStyle = '#FF453A';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Axis Labels
  ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  angles.forEach((angle, i) => {
    const labelX = centerX + Math.cos(angle) * (radius + 28);
    const labelY = centerY + Math.sin(angle) * (radius + 28);
    ctx.fillText(axisLabels[i], labelX, labelY);
  });
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // Bottom Training Zones Box
  const zoneY = 860;
  roundRect(ctx, 40, zoneY, w - 80, 120, 20);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.stroke();

  ctx.fillStyle = '#FF9F0A';
  ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('黄金训练区间推荐', 60, zoneY + 32);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`• 甜点训练 (Sweet Spot 88%~94%): ${data.sweetSpotMin} - ${data.sweetSpotMax} W`, 60, zoneY + 62);
  ctx.fillText(`• Seiler 80/20 极化低强度基石 (< 77%): < ${Math.round(data.ftpWatts * 0.77)} W`, 60, zoneY + 90);

  drawFooter(ctx, w, h);
  return canvas.toDataURL('image/png');
}

// 2. Climb Pacing Poster
export interface ClimbPacingPosterData {
  climbName: string;
  totalDistanceKm: number;
  totalElevationM: number;
  avgGrade: number;
  overallTimeStr: string;
  avgWatts: number;
  avgWkg: number;
  overallVam: number;
  ftpWatts: number;
  segments: Array<{ name: string; distanceKm: number; gradePct: number; targetWatts: number; targetFtpPct: number; timeStr: string }>;
}

export function generateClimbPacingPoster(data: ClimbPacingPosterData): string {
  const w = 750;
  const h = 1120;
  const { ctx, canvas } = createPosterCanvas(w, h);
  const accent = '#007AFF'; // ios-blue

  drawBackground(ctx, w, h, accent);
  drawHeader(ctx, w, '爬坡动力学 · 攻坚配速战报', data.climbName || '名山爬坡攻坚规划', `基准 FTP ${data.ftpWatts}W · 智能重力/滚阻/空气阻力分段解算`, accent);

  // Core Climb Stat Box (4 Tiles)
  const tileW = (w - 80 - 15) / 2;
  drawMetricTile(ctx, 40, 204, tileW, 80, '赛段全长 / 累计爬升', `${data.totalDistanceKm}km`, `+${data.totalElevationM}m`, '#0A84FF');
  drawMetricTile(ctx, 40 + tileW + 15, 204, tileW, 80, '平均坡度', `${data.avgGrade}`, '%', '#FF9F0A');
  drawMetricTile(ctx, 40, 299, tileW, 80, '预计登顶耗时', data.overallTimeStr, undefined, '#30D158');
  drawMetricTile(ctx, 40 + tileW + 15, 299, tileW, 80, '建议巡航功率 / VAM', `${data.avgWatts}W`, `${data.overallVam}m/h`, '#BF5AF2');

  // Segments Header
  const segStartY = 405;
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 17px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('分段路况与目标配速功率表', 40, segStartY);

  // Segments List Table Box
  const segments = data.segments || [];
  const listH = Math.min(520, Math.max(260, segments.length * 68 + 30));
  roundRect(ctx, 40, segStartY + 15, w - 80, listH, 20);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.stroke();

  // Table header
  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('分段名称 / 里程', 60, segStartY + 45);
  ctx.fillText('平均坡度', 260, segStartY + 45);
  ctx.fillText('目标输出', 410, segStartY + 45);
  ctx.fillText('预计耗时', 560, segStartY + 45);

  segments.slice(0, 7).forEach((seg, idx) => {
    const rowY = segStartY + 80 + idx * 62;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.beginPath();
    ctx.moveTo(60, rowY - 18);
    ctx.lineTo(w - 60, rowY - 18);
    ctx.stroke();

    // Segment Index & Name
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(`${idx + 1}. ${seg.name}`, 60, rowY + 5);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(`${seg.distanceKm} km`, 60, rowY + 24);

    // Grade
    ctx.fillStyle = seg.gradePct >= 8 ? '#FF453A' : seg.gradePct >= 5 ? '#FF9F0A' : '#30D158';
    ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(`${seg.gradePct}%`, 260, rowY + 12);

    // Target Watts
    ctx.fillStyle = '#0A84FF';
    ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(`${seg.targetWatts} W`, 410, rowY + 8);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(`${seg.targetFtpPct}% FTP`, 410, rowY + 24);

    // Time
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(seg.timeStr, 560, rowY + 12);
  });

  drawFooter(ctx, w, h);
  return canvas.toDataURL('image/png');
}

// 3. Gear Speed Cadence Poster
export interface GearSpeedPosterData {
  chainringStr: string;
  cogsStr: string;
  cadenceRpm: number;
  maxSpeed: string | number;
  maxRatio: number;
  minSpeed: string | number;
  minRatio: number;
  unitStr: string;
  presetName?: string;
}

export function generateGearSpeedPoster(data: GearSpeedPosterData): string {
  const w = 750;
  const h = 980;
  const { ctx, canvas } = createPosterCanvas(w, h);
  const accent = '#007AFF';

  drawBackground(ctx, w, h, accent);
  drawHeader(ctx, w, '⚙️ 传动几何 · 齿比与速度矩阵', '传动比与巡航踏频极速战报', `大盘 ${data.chainringStr} · 飞轮 ${data.cogsStr} · 基准踏频 ${data.cadenceRpm} RPM`, accent);

  const tileW = (w - 80 - 15) / 2;
  drawMetricTile(ctx, 40, 204, tileW, 85, '大盘平路极限极速', data.maxSpeed, data.unitStr, '#30D158');
  drawMetricTile(ctx, 40 + tileW + 15, 204, tileW, 85, '最大平路传动齿比', data.maxRatio, undefined, '#0A84FF');
  drawMetricTile(ctx, 40, 304, tileW, 85, '小盘陡坡爬坡下限', data.minSpeed, data.unitStr, '#FF9F0A');
  drawMetricTile(ctx, 40 + tileW + 15, 304, tileW, 85, '最小爬坡救命齿比', data.minRatio, undefined, '#FF453A');

  // Specs Showcase
  const specY = 415;
  roundRect(ctx, 40, specY, w - 80, 260, 20);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.stroke();

  ctx.fillStyle = '#0A84FF';
  ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('传动系统核心技术规格', 65, specY + 35);

  const specs = [
    { label: '牙盘大盘配置', val: data.chainringStr },
    { label: '后飞轮档位跨度', val: data.cogsStr },
    { label: '基准巡航踩踏踏频', val: `${data.cadenceRpm} RPM` },
    { label: '齿比调校方案预设', val: data.presetName || '自定义调校' },
    { label: '齿比调节跨度范围', val: `${data.minRatio} ~ ${data.maxRatio}` }
  ];

  specs.forEach((s, idx) => {
    const sy = specY + 75 + idx * 36;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(s.label, 65, sy);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(s.val, 320, sy);
  });

  // Tips Box
  const tipY = 700;
  roundRect(ctx, 40, tipY, w - 80, 150, 20);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.025)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
  ctx.stroke();

  ctx.fillStyle = '#FFD60A';
  ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('技师换档与踏频建议', 65, tipY + 35);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('• 保持 85~95 RPM 黄金踏频可最大化肌肉血流灌注并延缓乳酸堆积。', 65, tipY + 68);
  ctx.fillText('• 极限大对大与小对小极端档位会急剧增加链条斜拉磨损与摩擦瓦数损失。', 65, tipY + 98);
  ctx.fillText('• 针对 10%+ 持续陡坡，建议传动最小齿比维持在 ≤ 1.0，如 34T 盘片配 34T 飞轮。', 65, tipY + 128);

  drawFooter(ctx, w, h);
  return canvas.toDataURL('image/png');
}

// 4. Tire Pressure Poster
export interface TirePressurePosterData {
  bikeType: string;
  totalWeightKg: number;
  tireSetup: string;
  tireWidth: number;
  surface: string;
  frontRec: number;
  rearRec: number;
  frontRange: string;
  rearRange: string;
  unit: string;
  isHookless: boolean;
}

export function generateTirePressurePoster(data: TirePressurePosterData): string {
  const w = 750;
  const h = 960;
  const { ctx, canvas } = createPosterCanvas(w, h);
  const accent = '#007AFF';
  const unitStr = String(data.unit || 'PSI').toUpperCase();
  const tireSetupStr = data.tireSetup || '真空胎';
  const surfaceStr = data.surface || '综合平整铺装路面';
  const totalWeightStr = data.totalWeightKg ? `${data.totalWeightKg} kg` : '--';

  drawBackground(ctx, w, h, accent);
  drawHeader(ctx, w, '⚡ 滚阻与形变 · 智能胎压', '科学胎压与抓地力调校卡', `总系统重量 ${totalWeightStr} · ${tireSetupStr} · ${surfaceStr}`, accent);

  // Large Dual Pressure Pods
  const podW = (w - 80 - 20) / 2;
  const podH = 220;

  // Front Pod
  roundRect(ctx, 40, 204, podW, podH, 24);
  ctx.fillStyle = 'rgba(10, 132, 255, 0.08)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(10, 132, 255, 0.3)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('前轮最佳充气胎压', 60, 240);

  ctx.fillStyle = '#0A84FF';
  ctx.font = 'bold 54px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(String(data.frontRec ?? '--'), 60, 315);
  ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(unitStr, 60 + ctx.measureText(String(data.frontRec ?? '--')).width * 2.8 + 10, 315);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`建议安全区间: ${data.frontRange || '--'} ${unitStr}`, 60, 370);

  // Rear Pod
  roundRect(ctx, 40 + podW + 20, 204, podW, podH, 24);
  ctx.fillStyle = 'rgba(48, 209, 88, 0.08)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(48, 209, 88, 0.3)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('后轮最佳充气胎压', 40 + podW + 40, 240);

  ctx.fillStyle = '#30D158';
  ctx.font = 'bold 54px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(String(data.rearRec ?? '--'), 40 + podW + 40, 315);
  ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(unitStr, 40 + podW + 40 + ctx.measureText(String(data.rearRec ?? '--')).width * 2.8 + 10, 315);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`建议安全区间: ${data.rearRange || '--'} ${unitStr}`, 40 + podW + 40, 370);

  // Parameter Details Table
  const detailY = 450;
  roundRect(ctx, 40, detailY, w - 80, 220, 20);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('调校技术参数摘要', 65, detailY + 35);

  const params = [
    { label: '车种类型 / 设定', val: data.bikeType },
    { label: '外胎标称宽度', val: `${data.tireWidth} mm` },
    { label: '轮胎结构形式', val: data.tireSetup },
    { label: '骑行路面条件', val: data.surface },
    { label: '无钩圈安全限制', val: data.isHookless ? '是 · 上限 72.5 PSI / 5.0 Bar' : '标准有钩圈' }
  ];

  params.forEach((p, idx) => {
    const py = detailY + 70 + idx * 30;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(p.label, 65, py);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(p.val, 320, py);
  });

  // Notice
  const noticeY = 690;
  roundRect(ctx, 40, noticeY, w - 80, 160, 20);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.025)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
  ctx.stroke();

  ctx.fillStyle = '#64D2FF';
  ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('科学胎压为何快人一步？', 65, noticeY + 35);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('• 传统“胎压越打越硬越快”已被 Silca 等顶级风洞实验室推翻。', 65, noticeY + 68);
  ctx.fillText('• 真实沥青路面上，适度降低胎压可大幅消除振动阻抗损耗，平顺更省瓦。', 65, noticeY + 98);
  ctx.fillText('• 骑手重心通常 40:60 偏向后轮，因此前轮胎压应比后轮低 8%~12% 以换取极佳过弯抓地力。', 65, noticeY + 128);

  drawFooter(ctx, w, h);
  return canvas.toDataURL('image/png');
}

// 5. Upgrade ROI Poster
export interface UpgradeRoiPosterData {
  activeCount: number;
  totalWeightSaveG: number;
  totalPowerSaveWatts: number;
  totalCost: number;
  currency: string;
  flatTimeSavedSec: number;
  climbTimeSavedSec: number;
  costPerWatt: number | string;
  roiLevel: string;
}

export function generateUpgradeRoiPoster(data: UpgradeRoiPosterData): string {
  const w = 750;
  const h = 980;
  const { ctx, canvas } = createPosterCanvas(w, h);
  const accent = '#007AFF';

  drawBackground(ctx, w, h, accent);
  drawHeader(ctx, w, '⚖️ 边际效益 · 改装升级省瓦', '零件减重与气动升级性价比战报', `选定 ${data.activeCount} 项改装升级 · 综合预算 ${data.currency} ${data.totalCost}`, accent);

  const tileW = (w - 80 - 15) / 2;
  drawMetricTile(ctx, 40, 204, tileW, 85, '总减重净收益', `-${data.totalWeightSaveG}`, 'g', '#30D158');
  drawMetricTile(ctx, 40 + tileW + 15, 204, tileW, 85, '气动/滚阻总省瓦', `+${data.totalPowerSaveWatts}`, 'W', '#0A84FF');
  drawMetricTile(ctx, 40, 304, tileW, 85, '40km 平路预计提速', `${data.flatTimeSavedSec}`, '秒', '#64D2FF');
  drawMetricTile(ctx, 40 + tileW + 15, 304, tileW, 85, '10km 爬坡预计提速', `${data.climbTimeSavedSec}`, '秒', '#FF9F0A');

  // ROI Rating Banner
  const roiY = 415;
  roundRect(ctx, 40, roiY, w - 80, 110, 20);
  ctx.fillStyle = 'rgba(255, 214, 10, 0.08)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 214, 10, 0.3)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#FFD60A';
  ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('⭐ 每省 1 瓦边际投入指数', 65, roiY + 36);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 26px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`${data.currency} ${data.costPerWatt} / W`, 65, roiY + 78);

  ctx.fillStyle = '#FFD60A';
  ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`[${data.roiLevel}]`, 65 + ctx.measureText(`${data.currency} ${data.costPerWatt} / W`).width * 1.5 + 10, roiY + 78);

  // Geek Advice
  const tipY = 550;
  roundRect(ctx, 40, tipY, w - 80, 300, 20);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.stroke();

  ctx.fillStyle = '#0A84FF';
  ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('顶级风洞与职业车队边际效益铁律', 65, tipY + 40);

  const tips = [
    '1. 贴身气动连体骑行服与气动破风头盔是每瓦成本最低的提速利器，边际回报极高。',
    '2. 升级乳胶或超轻内胎与顶级真空胎，仅需数百元即可在平路节省 5~10 瓦纯机械滚阻。',
    '3. 减重 500g 在平路巡航中收益几乎为零，但在 8%+ 爬坡中每减重 1kg 可省约 3~4 瓦。',
    '4. 昂贵的高框碳轮主要收益在于 40km/h+ 高速下的气动帆船效应与风阻缩减。',
    '5. 保持链条超声波清洁并采用热熔石蜡浸润，可在传动端稳定挽回 3~6 瓦阻力损失。'
  ];

  tips.forEach((t, i) => {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(t, 65, tipY + 80 + i * 42);
  });

  drawFooter(ctx, w, h);
  return canvas.toDataURL('image/png');
}

// 6. Cycle Power & Dynamics Poster
export interface CyclePowerPosterData {
  speedKmh: number;
  power: number;
  wkg: number;
  levelTitle: string;
  grade: number;
  kcalPerHour: number;
  vam: number;
  aeroPct: number;
  gravityPct: number;
  rollingPct: number;
}

export function generateCyclePowerPoster(data: CyclePowerPosterData): string {
  const w = 750;
  const h = 960;
  const { ctx, canvas } = createPosterCanvas(w, h);
  const accent = '#007AFF';

  drawBackground(ctx, w, h, accent);
  drawHeader(ctx, w, '⚡ 动力学方程 · 单车功率与速度', '巡航速度与推重比动力学战报', `巡航车速 ${data.speedKmh} km/h · 当前坡度 ${data.grade}%`, accent);

  const tileW = (w - 80 - 15) / 2;
  drawMetricTile(ctx, 40, 204, tileW, 85, '需要维持功率', data.power, 'W', '#0A84FF');
  drawMetricTile(ctx, 40 + tileW + 15, 204, tileW, 85, '功能推重比', data.wkg, 'W/kg', '#30D158');
  drawMetricTile(ctx, 40, 304, tileW, 85, '车手等级画像', data.levelTitle, undefined, '#FF9F0A');
  drawMetricTile(ctx, 40 + tileW + 15, 304, tileW, 85, '爬坡垂直爬升率', data.vam, 'm/h', '#BF5AF2');

  // Resistance Split Bar
  const splitY = 415;
  roundRect(ctx, 40, splitY, w - 80, 180, 20);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('骑行阻力三要素构成占比', 65, splitY + 35);

  // Multi-color progress bar
  const barX = 65;
  const barY = splitY + 65;
  const barW = w - 130;
  const barH = 24;

  const aeroW = (barW * data.aeroPct) / 100;
  const gravW = (barW * data.gravityPct) / 100;
  const rollW = barW - aeroW - gravW;

  ctx.fillStyle = '#0A84FF'; // Aero
  roundRect(ctx, barX, barY, Math.max(0, aeroW), barH, 6);
  ctx.fill();

  ctx.fillStyle = '#FF453A'; // Gravity
  roundRect(ctx, barX + aeroW, barY, Math.max(0, gravW), barH, 6);
  ctx.fill();

  ctx.fillStyle = '#30D158'; // Rolling
  roundRect(ctx, barX + aeroW + gravW, barY, Math.max(0, rollW), barH, 6);
  ctx.fill();

  // Legend
  ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#0A84FF';
  ctx.fillText(`• 空气阻力: ${data.aeroPct}%`, 65, splitY + 130);
  ctx.fillStyle = '#FF453A';
  ctx.fillText(`• 重力分量: ${data.gravityPct}%`, 280, splitY + 130);
  ctx.fillStyle = '#30D158';
  ctx.fillText(`• 机械滚阻: ${data.rollingPct}%`, 480, splitY + 130);

  // Aerodynamics Insight
  const aeroInsightY = 620;
  roundRect(ctx, 40, aeroInsightY, w - 80, 220, 20);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.025)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
  ctx.stroke();

  ctx.fillStyle = '#64D2FF';
  ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('空气阻力立方定律', 65, aeroInsightY + 35);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('• 克服风阻所需的功率与车速的【三次方】成正比！', 65, aeroInsightY + 68);
  ctx.fillText('• 车速从 30 km/h 提升到 40 km/h，功率需要增加将近 140% 而非 33%。', 65, aeroInsightY + 98);
  ctx.fillText('• 在超过 35 km/h 的平路巡航中，骑手总阻力的 80%~90% 来自于空气撞击。', 65, aeroInsightY + 128);
  ctx.fillText(`• 按照当前工况持续踩踏，预估每小时代谢消耗能耗约为 ${data.kcalPerHour} kcal。`, 65, aeroInsightY + 158);

  drawFooter(ctx, w, h);
  return canvas.toDataURL('image/png');
}

// 7. Chain Length Poster
export interface ChainLengthPosterData {
  chainstayMm: number;
  frontRings: string;
  rearCogs: string;
  recommendedLinks: number;
  chainLengthInches: number;
  requiredCapacity: number;
  derailleurRecommendation: string;
  isFullSuspension: boolean;
}

export function generateChainLengthPoster(data: ChainLengthPosterData): string {
  const w = 750;
  const h = 940;
  const { ctx, canvas } = createPosterCanvas(w, h);
  const accent = '#007AFF';

  drawBackground(ctx, w, h, accent);
  drawHeader(ctx, w, '传动几何 · 链条物理', '技师级截链规范与后拨容量核算卡', `后下叉 RC: ${data.chainstayMm} mm · 搭配 ${data.frontRings} + ${data.rearCogs}`, accent);

  // Big Recommended Links Pod
  roundRect(ctx, 40, 204, w - 80, 150, 24);
  ctx.fillStyle = 'rgba(10, 132, 255, 0.08)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(10, 132, 255, 0.3)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('推荐链条精准截取节数 · 含魔术扣', 65, 240);

  ctx.fillStyle = '#0A84FF';
  ctx.font = 'bold 64px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(String(data.recommendedLinks), 65, 320);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('节', 65 + ctx.measureText(String(data.recommendedLinks)).width * 2.8 + 15, 320);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`展开总长度约: ${data.chainLengthInches} 英寸`, 450, 320);

  // Capacity & derailleurs
  const tileW = (w - 80 - 15) / 2;
  drawMetricTile(ctx, 40, 375, tileW, 85, '传动系统所需总齿容量', `${data.requiredCapacity}T`, undefined, '#FF9F0A');
  drawMetricTile(ctx, 40 + tileW + 15, 375, tileW, 85, '后拨导板规格建议', data.derailleurRecommendation, undefined, '#30D158');

  // Specs
  const specY = 485;
  roundRect(ctx, 40, specY, w - 80, 200, 20);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('⚙️ 传动几何装配基准', 65, specY + 35);

  const specs = [
    { label: '车架后下叉长度', val: `${data.chainstayMm} mm` },
    { label: '前牙盘齿数规格', val: data.frontRings },
    { label: '后飞轮极限跨度', val: data.rearCogs },
    { label: '车架结构形态', val: data.isFullSuspension ? '全避震软尾 · 含避震压缩轴距补偿' : '公路/硬尾硬架' }
  ];

  specs.forEach((s, idx) => {
    const sy = specY + 70 + idx * 30;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(s.label, 65, sy);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(s.val, 360, sy);
  });

  // Mechanic Rules
  const ruleY = 710;
  roundRect(ctx, 40, ruleY, w - 80, 140, 20);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.025)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
  ctx.stroke();

  ctx.fillStyle = '#FFD60A';
  ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('技师截链防坑指南', 65, ruleY + 32);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('• 链条过短：大对大档位会直接拉爆后拨导板或尾钩！', 65, ruleY + 62);
  ctx.fillText('• 链条过长：小对小档位后拨弹簧无法拉紧，导致跳链、掉链与打后下叉。', 65, ruleY + 90);
  ctx.fillText('• 截链时请宁长勿短，截断前务必将魔术扣的一节公母计算在内。', 65, ruleY + 118);

  drawFooter(ctx, w, h);
  return canvas.toDataURL('image/png');
}

// 8. Road Bike Pain Checker Poster
export interface PainCheckPosterData {
  areaTitle?: string;
  checkedCount?: number;
  totalChecks?: number;
  progressPct?: number;
  causes?: Array<{ category: string; details: string[] }>;
  checklist?: string[];
  symptoms?: string[];
  solutions?: string[];
  expertAdvice?: string;
}

export function generatePainCheckPoster(data: PainCheckPosterData): string {
  const w = 750;
  const h = 1060;
  const { ctx, canvas } = createPosterCanvas(w, h);
  const accent = '#BF5AF2'; // ios-purple

  const areaTitle = data.areaTitle || '骑行不适部位';
  const checklist = data.checklist || data.solutions || [];
  const checkedCount = data.checkedCount ?? 0;
  const totalChecks = data.totalChecks || (checklist.length > 0 ? checklist.length : 1);
  const progressPct = data.progressPct ?? Math.round((checkedCount / totalChecks) * 100);
  const causes = data.causes || [];

  drawBackground(ctx, w, h, accent);
  drawHeader(ctx, w, '运动医学 · 疼痛自诊处方', `${areaTitle}自纠处方卡`, `已完成排查 ${checkedCount}/${totalChecks} 项 (${progressPct}%) · 科学调车指南`, accent);

  // Progress banner
  roundRect(ctx, 40, 204, w - 80, 80, 20);
  ctx.fillStyle = 'rgba(191, 90, 242, 0.08)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(191, 90, 242, 0.25)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#BF5AF2';
  ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('排查进度状态', 65, 234);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`${checkedCount} / ${totalChecks} 项疑点已核实 · 诊断完成率 ${progressPct}%`, 65, 264);

  // Targeted Prescriptions Box
  const rxY = 305;
  roundRect(ctx, 40, rxY, w - 80, 360, 20);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.stroke();

  ctx.fillStyle = '#30D158';
  ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('针对性调车自纠处方清单', 65, rxY + 36);

  checklist.slice(0, 6).forEach((item, idx) => {
    const iy = rxY + 75 + idx * 46;
    ctx.fillStyle = '#30D158';
    ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(`✓ 方案 ${idx + 1}:`, 65, iy);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    const itemStr = String(item || '');
    ctx.fillText(itemStr.length > 38 ? itemStr.slice(0, 38) + '...' : itemStr, 155, iy);
  });

  // Root Causes Box
  const causeY = 685;
  roundRect(ctx, 40, causeY, w - 80, 280, 20);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.025)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
  ctx.stroke();

  ctx.fillStyle = '#FF9F0A';
  ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('根本成因与生物力学机理分析', 65, causeY + 36);

  if (causes.length > 0) {
    causes.slice(0, 3).forEach((c, idx) => {
      const cy = causeY + 75 + idx * 64;
      ctx.fillStyle = '#FF9F0A';
      ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(`[${c.category || '诊断分析'}]`, 65, cy);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      const detailText = Array.isArray(c.details) ? c.details.join('； ') : String(c.details || '');
      ctx.fillText(detailText.length > 40 ? detailText.slice(0, 40) + '...' : detailText, 65, cy + 24);
    });
  } else if (data.expertAdvice) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(`专家建议: ${data.expertAdvice}`, 65, causeY + 80);
  }

  drawFooter(ctx, w, h);
  return canvas.toDataURL('image/png');
}

// 9. Structured Workout Poster
export interface WorkoutPosterData {
  workoutTitle?: string;
  workoutName?: string;
  ftpWatts: number;
  totalDurationStr?: string;
  totalMinutes?: number;
  tss: number;
  intensityFactor: number;
  calories: number;
  description?: string;
  segments?: Array<{ name: string; durationSec: number; powerPct: number; cadenceRpm?: number; targetWatts?: number; type?: string }>;
}

export function generateWorkoutPoster(data: WorkoutPosterData): string {
  const w = 750;
  const h = 1040;
  const { ctx, canvas } = createPosterCanvas(w, h);
  const accent = '#FF3B30';

  const title = data.workoutTitle || data.workoutName || '科学间歇训练课表';
  const desc = data.description || '根据生理动力学与代谢功率阶梯科学定制的间歇训练课表。';
  const durationStr = data.totalDurationStr || (data.totalMinutes ? `${data.totalMinutes} 分钟` : '60 分钟');
  const segments = data.segments || [];

  drawBackground(ctx, w, h, accent);
  drawHeader(ctx, w, '科学训练 · 结构化间歇课表', title, `基准 FTP ${data.ftpWatts || 200}W · 智能靶向踏频与功率阶梯`, accent);

  const tileW = (w - 80 - 15) / 2;
  drawMetricTile(ctx, 40, 204, tileW, 85, '课表总执行时长', durationStr, undefined, '#0A84FF');
  drawMetricTile(ctx, 40 + tileW + 15, 204, tileW, 85, '训练压力指数', data.tss || 0, undefined, '#FF9F0A');
  drawMetricTile(ctx, 40, 304, tileW, 85, '强度系数', data.intensityFactor || 0, undefined, '#FF375F');
  drawMetricTile(ctx, 40 + tileW + 15, 304, tileW, 85, '预估能量代谢消耗', data.calories || 0, 'kcal', '#30D158');

  // Description
  const descY = 410;
  roundRect(ctx, 40, descY, w - 80, 80, 16);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.stroke();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(desc.length > 50 ? desc.slice(0, 50) + '...' : desc, 60, descY + 45);

  // Intervals Breakdown Bar & List
  const listY = 510;
  roundRect(ctx, 40, listY, w - 80, 440, 20);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('⚡ 课表分段间歇执行明细', 65, listY + 35);

  segments.slice(0, 7).forEach((seg, idx) => {
    const sy = listY + 75 + idx * 50;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.beginPath();
    ctx.moveTo(65, sy - 14);
    ctx.lineTo(w - 65, sy - 14);
    ctx.stroke();

    // Segment color badge
    const color = seg.powerPct >= 115 ? '#FF375F' : seg.powerPct >= 95 ? '#FF9F0A' : seg.powerPct >= 75 ? '#30D158' : '#0A84FF';
    ctx.fillStyle = color;
    roundRect(ctx, 65, sy, 8, 26, 4);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(`${idx + 1}. ${seg.name}`, 85, sy + 18);

    const durMins = Math.floor(seg.durationSec / 60);
    const durSecs = seg.durationSec % 60;
    const durStr = durMins > 0 ? `${durMins}m ${durSecs}s` : `${durSecs}s`;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(durStr, 340, sy + 18);

    const targetWatts = Math.round(data.ftpWatts * (seg.powerPct / 100));
    ctx.fillStyle = color;
    ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(`${seg.powerPct}% FTP (${targetWatts}W)`, 460, sy + 18);
  });

  drawFooter(ctx, w, h);
  return canvas.toDataURL('image/png');
}

// 10. Roadbook & GPX Poster
export interface RoadbookPosterData {
  routeName: string;
  sourceCode?: string;
  distanceKm: number;
  elevationGainM: number;
  maxAltitudeM: number;
  avgGradePct: number;
  sceneryRating: number;
  roadCondition: string;
  highlights: string[];
  description: string;
}

export function generateRoadbookPoster(data: RoadbookPosterData): string {
  const w = 750;
  const h = 1000;
  const { ctx, canvas } = createPosterCanvas(w, h);
  const accent = '#00C7BE'; // ios-mint

  drawBackground(ctx, w, h, accent);
  drawHeader(ctx, w, '经典路书 · 骑行漫游', data.routeName, `${data.sourceCode ? `[${data.sourceCode}] ` : ''}${data.roadCondition}`, accent);

  const tileW = (w - 80 - 15) / 2;
  drawMetricTile(ctx, 40, 204, tileW, 85, '路线总里程', data.distanceKm, 'km', '#0A84FF');
  drawMetricTile(ctx, 40 + tileW + 15, 204, tileW, 85, '累计爬升海拔', `+${data.elevationGainM}`, 'm', '#30D158');
  drawMetricTile(ctx, 40, 304, tileW, 85, '最高海拔标高', data.maxAltitudeM, 'm', '#FF9F0A');
  drawMetricTile(ctx, 40 + tileW + 15, 304, tileW, 85, '平均综合坡度', data.avgGradePct, '%', '#BF5AF2');

  // Highlights & Badges
  const hlY = 410;
  roundRect(ctx, 40, hlY, w - 80, 100, 20);
  ctx.fillStyle = 'rgba(0, 199, 190, 0.08)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(0, 199, 190, 0.25)';
  ctx.stroke();

  ctx.fillStyle = '#00C7BE';
  ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('✨ 路线特色标签', 65, hlY + 34);

  let badgeOffset = 65;
  const highlights = data.highlights || ['经典骑行', '山野风光'];
  highlights.slice(0, 4).forEach(h => {
    ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    const bw = ctx.measureText(h).width + 20;
    roundRect(ctx, badgeOffset, hlY + 50, bw, 26, 13);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillText(h, badgeOffset + 10, hlY + 67);
    badgeOffset += bw + 10;
  });

  // Description
  const descY = 530;
  roundRect(ctx, 40, descY, w - 80, 370, 20);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('路线简介与骑行体验', 65, descY + 40);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  // Multiline wrapping
  const words = data.description || '经典骑行探索路线，尽情领略户外破风骑行之美。可将本航迹导入码表进行全程导航。';
  let line = '';
  let lineY = descY + 75;
  for (let i = 0; i < words.length; i++) {
    line += words[i];
    if (line.length >= 28 || i === words.length - 1) {
      ctx.fillText(line, 65, lineY);
      line = '';
      lineY += 28;
    }
  }

  // Scenery stars
  ctx.fillStyle = '#FFD60A';
  ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`风景推荐指数: ${'★'.repeat(data.sceneryRating || 5)}`, 65, descY + 330);

  drawFooter(ctx, w, h);
  return canvas.toDataURL('image/png');
}

// Course Aerodynamic Pacing Strategy Poster
export interface CoursePacingPosterData {
  routeName: string;
  distanceKm: number;
  elevationGainM: number;
  estTimeStr: string;
  avgSpeedKmh: number;
  npWatts: number;
  intensityFactor: number;
  tss: number;
  totalKj: number;
  windDesc: string;
  carbsPerHourG: number;
  fluidPerHourMl: number;
  headwindPct: number;
  keySegments: {
    name: string;
    distKm: number;
    gradePct: number;
    targetWatts: number;
    speedKmh: number;
    windDesc: string;
  }[];
}

export function generateCoursePacingPoster(data: CoursePacingPosterData): string {
  const w = 750;
  const h = 1050;
  const { ctx, canvas } = createPosterCanvas(w, h);
  const accent = '#0A84FF'; // ios-blue

  drawBackground(ctx, w, h, accent);
  drawHeader(ctx, w, '风阻与体能策略工坊 · BEST BIKE SPLIT', data.routeName, `环境风阻模拟: ${data.windDesc}`, accent);

  // Key KPI Tiles
  const tileW = (w - 80 - 15) / 2;
  drawMetricTile(ctx, 40, 204, tileW, 85, '预估完赛总用时', data.estTimeStr, '', '#0A84FF');
  drawMetricTile(ctx, 40 + tileW + 15, 204, tileW, 85, '目标加权功率 NP', `${data.npWatts}W`, `IF ${data.intensityFactor}`, '#30D158');
  drawMetricTile(ctx, 40, 304, tileW, 85, '路线全程均速', `${data.avgSpeedKmh}`, 'km/h', '#FF9F0A');
  drawMetricTile(ctx, 40 + tileW + 15, 304, tileW, 85, '预估训练压力 TSS', data.tss, `总能耗 ${data.totalKj}kJ`, '#BF5AF2');

  // Nutrition & Hydration Bar
  const nutY = 410;
  roundRect(ctx, 40, nutY, w - 80, 85, 18);
  ctx.fillStyle = 'rgba(10, 132, 255, 0.08)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(10, 132, 255, 0.25)';
  ctx.stroke();

  ctx.fillStyle = '#0A84FF';
  ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('⚡ 运动人体科学补给方案', 65, nutY + 28);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`碳水化合物: ${data.carbsPerHourG}g / 小时 · 约 ${Math.ceil((data.carbsPerHourG * 2.5) / 25)} 支能量胶`, 65, nutY + 52);
  ctx.fillText(`水分与电解质: ${data.fluidPerHourMl}ml / 小时 · 顶风占比 ${data.headwindPct}%`, 65, nutY + 72);

  // Sector Pacing Breakdown Box
  const tableY = 515;
  const tableH = 430;
  roundRect(ctx, 40, tableY, w - 80, tableH, 20);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('各路段动力学分配与执行指标', 65, tableY + 36);

  // Table Headers
  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('分段名称 / 坡度', 65, tableY + 68);
  ctx.fillText('里程', 280, tableY + 68);
  ctx.fillText('目标功率', 370, tableY + 68);
  ctx.fillText('预估车速', 480, tableY + 68);
  ctx.fillText('气动风况', 590, tableY + 68);

  // Draw Separator
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(65, tableY + 80);
  ctx.lineTo(w - 65, tableY + 80);
  ctx.stroke();

  const sampleRows = data.keySegments.slice(0, 6);
  sampleRows.forEach((row, idx) => {
    const rowY = tableY + 112 + idx * 52;

    // Dot indicator
    ctx.beginPath();
    ctx.arc(72, rowY - 4, 4, 0, Math.PI * 2);
    ctx.fillStyle = row.gradePct > 5 ? '#EF4444' : row.gradePct > 2 ? '#FF9F0A' : '#30D158';
    ctx.fill();

    // Sector Name
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(`${row.name} (${row.gradePct > 0 ? '+' : ''}${row.gradePct}%)`, 86, rowY);

    // Distance
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(`${row.distKm}km`, 280, rowY);

    // Target Power
    ctx.fillStyle = '#FFD60A';
    ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(`${row.targetWatts}W`, 370, rowY);

    // Speed
    ctx.fillStyle = '#0A84FF';
    ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(`${row.speedKmh} km/h`, 480, rowY);

    // Wind
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(row.windDesc, 590, rowY);
  });

  drawFooter(ctx, w, h);
  return canvas.toDataURL('image/png');
}

// Training Plan & ATP Periodization Calendar Poster
export interface TrainingCalendarPosterData {
  eventName: string;
  raceDate: string;
  daysRemaining: number;
  targetCtl: number;
  targetTsb: number;
  totalWeeks: number;
  currentPhase: string;
  avgWeeklyTss: number;
  weeksOverview: {
    weekIdx: number;
    phaseName: string;
    targetTss: number;
    focus: string;
  }[];
}

export function generateTrainingCalendarPoster(data: TrainingCalendarPosterData): string {
  const w = 750;
  const h = 1050;
  const { ctx, canvas } = createPosterCanvas(w, h);
  const accent = '#0A84FF'; // ios-blue

  drawBackground(ctx, w, h, accent);
  drawHeader(ctx, w, '年度周期训练赛历 · ATP PERIODIZATION', data.eventName, `决战倒计时 ${data.daysRemaining} 天 · 比赛日: ${data.raceDate}`, accent);

  // Key KPI Tiles
  const tileW = (w - 80 - 15) / 2;
  drawMetricTile(ctx, 40, 204, tileW, 85, '决战倒计时', data.daysRemaining, '天', '#FF9F0A');
  drawMetricTile(ctx, 40 + tileW + 15, 204, tileW, 85, '比赛日目标体能', data.targetCtl, 'CTL', '#0A84FF');
  drawMetricTile(ctx, 40, 304, tileW, 85, '比赛日竞技巅峰', `+${data.targetTsb}`, 'TSB', '#30D158');
  drawMetricTile(ctx, 40 + tileW + 15, 304, tileW, 85, '周期平均周负荷', data.avgWeeklyTss, 'TSS/周', '#BF5AF2');

  // Hero Phase Bar
  const phaseY = 410;
  roundRect(ctx, 40, phaseY, w - 80, 80, 18);
  ctx.fillStyle = 'rgba(10, 132, 255, 0.08)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(10, 132, 255, 0.25)';
  ctx.stroke();

  ctx.fillStyle = '#0A84FF';
  ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('📅 周期化训练科学定位', 65, phaseY + 28);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`当前所处阶段: ${data.currentPhase}  ·  全宏观周期共 ${data.totalWeeks} 周`, 65, phaseY + 54);

  // Weekly Breakdown Table
  const tableY = 510;
  const tableH = 430;
  roundRect(ctx, 40, tableY, w - 80, tableH, 20);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('各周期间隔训练排期与目标负荷', 65, tableY + 36);

  // Table Headers
  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('周序号', 65, tableY + 68);
  ctx.fillText('所属阶段', 140, tableY + 68);
  ctx.fillText('目标 TSS', 340, tableY + 68);
  ctx.fillText('核心生理适应与课表重点', 450, tableY + 68);

  // Draw Separator
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(65, tableY + 80);
  ctx.lineTo(w - 65, tableY + 80);
  ctx.stroke();

  data.weeksOverview.slice(0, 6).forEach((row, idx) => {
    const rowY = tableY + 112 + idx * 52;

    // Week Label
    ctx.fillStyle = '#0A84FF';
    ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(`W${row.weekIdx}`, 65, rowY);

    // Phase
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(row.phaseName.split(' ')[0], 140, rowY);

    // Target TSS
    ctx.fillStyle = '#FFD60A';
    ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(`${row.targetTss} TSS`, 340, rowY);

    // Focus
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(row.focus.slice(0, 16), 450, rowY);
  });

  drawFooter(ctx, w, h);
  return canvas.toDataURL('image/png');
}

// 11. Suspension Setup Poster
export interface SuspensionPosterData {
  riderName?: string;
  totalWeightKg?: number;
  riderWeightKg?: number;
  bikeCategory?: string;
  discipline?: string;
  ridingStyle?: string;
  forkModel?: string;
  forkTravel?: number;
  forkPsi?: number;
  forkPressurePsi?: number;
  forkSagPct?: number;
  forkSagMm?: number;
  forkLsr?: number;
  forkReboundClicks?: number;
  forkLsc?: number;
  forkLscClicks?: number;
  forkTokens?: number;
  shockType?: string;
  shockTravel?: number;
  shockPsiOrSpring?: string;
  shockPressurePsi?: number;
  shockSagPct?: number;
  shockSagMm?: number;
  shockRebound?: number;
  shockReboundClicks?: number;
  shockLscClicks?: number;
  shockSpacers?: number;
}

export function generateSuspensionPoster(data: SuspensionPosterData): string {
  const w = 750;
  const h = 1000;
  const { ctx, canvas } = createPosterCanvas(w, h);
  const accent = '#007AFF';

  const disciplineStr = String(data.discipline || data.bikeCategory || 'MTB 越野').toUpperCase();
  const weight = data.totalWeightKg || data.riderWeightKg || 70;
  const forkModel = data.forkModel || '避震气压前叉';
  const forkTravel = data.forkTravel || 120;
  const forkPsi = data.forkPsi ?? data.forkPressurePsi ?? 80;
  const forkSagPct = data.forkSagPct ?? 25;
  const forkLsr = data.forkLsr ?? data.forkReboundClicks ?? 6;
  const forkLsc = data.forkLsc ?? data.forkLscClicks ?? 4;
  const shockType = data.shockType || 'air';
  const shockTravel = data.shockTravel || 120;
  const shockPsiOrSpring = data.shockPsiOrSpring || (data.shockPressurePsi ? `${data.shockPressurePsi} PSI` : '标准气压');
  const shockSagPct = data.shockSagPct ?? 28;
  const shockRebound = data.shockRebound ?? data.shockReboundClicks ?? 5;

  drawBackground(ctx, w, h, accent);
  drawHeader(ctx, w, '山地避震 · 悬挂调校设定', `${disciplineStr} 战车避震调校档案`, `车手全备重 ${weight} kg · 前后悬挂气压与阻尼基准`, accent);

  // Dual Suspension Pods
  const podW = (w - 80 - 20) / 2;
  const podH = 340;

  // Fork Pod
  roundRect(ctx, 40, 204, podW, podH, 24);
  ctx.fillStyle = 'rgba(10, 132, 255, 0.08)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(10, 132, 255, 0.3)';
  ctx.stroke();

  ctx.fillStyle = '#0A84FF';
  ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('前叉避震设定', 65, 240);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`${forkModel} · ${forkTravel}mm 行程`, 65, 266);

  const forkSpecs = [
    { label: '主气室推荐气压', val: `${forkPsi} PSI` },
    { label: '下沉量', val: `${forkSagPct}%` },
    { label: '低速回弹', val: `${forkLsr} 格` },
    { label: '低速压缩', val: `${forkLsc} 格` }
  ];

  forkSpecs.forEach((s, idx) => {
    const fy = 310 + idx * 45;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(s.label, 65, fy);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 17px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(s.val, 65, fy + 22);
  });

  // Shock Pod
  roundRect(ctx, 40 + podW + 20, 204, podW, podH, 24);
  ctx.fillStyle = 'rgba(48, 209, 88, 0.08)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(48, 209, 88, 0.3)';
  ctx.stroke();

  ctx.fillStyle = '#30D158';
  ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('后避震设定', 40 + podW + 45, 240);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`${shockType === 'coil' ? '弹簧后胆' : '气压后胆'} · ${shockTravel}mm 行程`, 40 + podW + 45, 266);

  const shockSpecs = [
    { label: '气压 / 弹簧磅数', val: shockPsiOrSpring },
    { label: '后胆下沉量', val: `${shockSagPct}%` },
    { label: '回弹阻尼', val: `${shockRebound} 格` },
    { label: '压缩平台阻尼', val: '平衡开档' }
  ];

  shockSpecs.forEach((s, idx) => {
    const sy = 310 + idx * 45;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(s.label, 40 + podW + 45, sy);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 17px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(s.val, 40 + podW + 45, sy + 22);
  });

  // Tuning Insights
  const insY = 570;
  roundRect(ctx, 40, insY, w - 80, 330, 20);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.stroke();

  ctx.fillStyle = '#FFD60A';
  ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('山地车下坡姿态与悬挂平衡原则', 65, insY + 40);

  const insights = [
    '• 阻尼调整基准：所有阻尼点击数均从“全关最硬”反向顺时针数出。',
    '• 下沉量黄金原则：林道/耐力前后下沉量建议维持在 25%~30%，过小易跳弹过大易打底。',
    '• 动态平衡：快速按压车体时，前后避震应同步压缩与回弹，防止“跷跷板”推头失控。',
    '• 气压微调：在连续颠簸碎石路若感到手部剧烈酸痛，可尝试适度降低 3~5 PSI 并放慢一格回弹。'
  ];

  insights.forEach((ins, idx) => {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(ins, 65, insY + 80 + idx * 55);
  });

  drawFooter(ctx, w, h);
  return canvas.toDataURL('image/png');
}

// 12. Road Bike Fitter Poster
export interface FittingPosterData {
  height: number;
  inseam: number;
  armLength: number;
  torso: number;
  ridingStyle: string;
  saddleHeight: number;
  effectiveTopTube: number;
  stemLength: number;
  saddleDrop: number;
  handlebarWidth: number;
  crankLength: number;
  frameSize: string;
  sittingNote: string;
}

export function generateFittingPoster(data: FittingPosterData): string {
  const w = 750;
  const h = 1000;
  const { ctx, canvas } = createPosterCanvas(w, h);
  const accent = '#007AFF';

  drawBackground(ctx, w, h, accent);
  drawHeader(ctx, w, '人体工效学 · 车架 Fitting', '公路车个人几何调校档案卡', `身高 ${data.height}cm · 跨高 ${data.inseam}cm · 风格: ${data.ridingStyle === 'racing' ? '激进竞技' : '耐力舒适'}`, accent);

  const tileW = (w - 80 - 15) / 2;
  drawMetricTile(ctx, 40, 204, tileW, 85, '推荐黄金座高 (BB-坐垫顶)', data.saddleHeight, 'cm', '#0A84FF');
  drawMetricTile(ctx, 40 + tileW + 15, 204, tileW, 85, '推荐车架有效上管', data.effectiveTopTube, 'cm', '#30D158');
  drawMetricTile(ctx, 40, 304, tileW, 85, '建议把立长度', data.stemLength, 'mm', '#FF9F0A');
  drawMetricTile(ctx, 40 + tileW + 15, 304, tileW, 85, '座舱落差', data.saddleDrop, 'cm', '#BF5AF2');

  // Core Geometry Table
  const geomY = 415;
  roundRect(ctx, 40, geomY, w - 80, 260, 20);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('核心几何设定与装车配件规格', 65, geomY + 36);

  const geoms = [
    { label: '车架尺寸参考区间', val: data.frameSize },
    { label: '弯把宽度', val: `${data.handlebarWidth} mm` },
    { label: '曲柄长度', val: `${data.crankLength} mm` },
    { label: '躯干与手臂比例分析', val: data.sittingNote }
  ];

  geoms.forEach((g, idx) => {
    const gy = geomY + 75 + idx * 42;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(g.label, 65, gy);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    const valStr = String(g.val ?? '--');
    ctx.fillText(valStr.length > 32 ? valStr.slice(0, 32) + '...' : valStr, 280, gy);
  });

  // Fitting Guidelines
  const guideY = 700;
  roundRect(ctx, 40, guideY, w - 80, 200, 20);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.025)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
  ctx.stroke();

  ctx.fillStyle = '#64D2FF';
  ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('专业 Fitting 设定验证要点', 65, guideY + 35);

  const guides = [
    '• 膝关节微屈角：脚踏踩到 6 点钟死点时，膝关节内夹角应保持在 145°~155° 之间。',
    '• 膝盖与脚踏轴心垂线：曲柄旋转至水平 3 点钟位置时，膝盖骨前缘铅垂线应穿过锁踏轴心。',
    '• 躯干角度：握下把冲刺时躯干与地面夹角约 35°~45°，上身放松无耸肩与手腕过度压迫。'
  ];

  guides.forEach((g, idx) => {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(g, 65, guideY + 70 + idx * 38);
  });

  drawFooter(ctx, w, h);
  return canvas.toDataURL('image/png');
}

// 13. FIT Activity Post-Ride Poster
export interface FitActivityPosterData {
  activityName: string;
  dateStr: string;
  distanceKm: number;
  durationStr: string;
  normalizedPower: number;
  avgPower: number;
  intensityFactor: number;
  tss: number;
  elevationGainM: number;
  maxWatts: number;
  avgHeartRate: number;
  calories: number;
  phenotype?: string;
  powerZones?: Array<{ zone: string; label: string; percent: number; color: string }>;
}

export function generateFitActivityPoster(data: FitActivityPosterData): string {
  const w = 750;
  const h = 1080;
  const { ctx, canvas } = createPosterCanvas(w, h);
  const accent = '#FF3B30';

  drawBackground(ctx, w, h, accent);
  drawHeader(ctx, w, '⚡ 真实骑行 · 码表深度复盘', data.activityName || '骑行活动深度复盘', `${data.dateStr} · 离线解析高保真运动生理数据`, accent);

  const tileW = (w - 80 - 15) / 2;
  drawMetricTile(ctx, 40, 204, tileW, 85, '总骑行里程', data.distanceKm, 'km', '#0A84FF');
  drawMetricTile(ctx, 40 + tileW + 15, 204, tileW, 85, '总骑行历时', data.durationStr, undefined, '#30D158');
  drawMetricTile(ctx, 40, 304, tileW, 85, '标准化功率', data.normalizedPower, 'W', '#FF375F');
  drawMetricTile(ctx, 40 + tileW + 15, 304, tileW, 85, '训练压力', data.tss, undefined, '#FF9F0A');

  // Secondary metrics 4-pack
  const subTileW = (w - 80 - 30) / 4;
  drawMetricTile(ctx, 40, 404, subTileW, 75, '强度系数', data.intensityFactor, undefined, '#BF5AF2');
  drawMetricTile(ctx, 40 + subTileW + 10, 404, subTileW, 75, '累计爬升', `+${data.elevationGainM}`, 'm', '#30D158');
  drawMetricTile(ctx, 40 + (subTileW + 10) * 2, 404, subTileW, 75, '平均心率', data.avgHeartRate > 0 ? data.avgHeartRate : '--', 'bpm', '#FF375F');
  drawMetricTile(ctx, 40 + (subTileW + 10) * 3, 404, subTileW, 75, '卡路里', data.calories, 'kcal', '#FFD60A');

  // Coggan 7-Zone Distribution Bar
  const zoneY = 505;
  roundRect(ctx, 40, zoneY, w - 80, 220, 20);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('Coggan 7 功率区间时间驻留分布', 65, zoneY + 36);

  if (data.powerZones && data.powerZones.length > 0) {
    // Multi-color stacked zone bar
    const barX = 65;
    const barY = zoneY + 65;
    const barW = w - 130;
    const barH = 22;

    let currX = barX;
    data.powerZones.forEach(z => {
      const segW = (barW * z.percent) / 100;
      ctx.fillStyle = z.color;
      ctx.fillRect(currX, barY, segW, barH);
      currX += segW;
    });

    // Zone items legend
    const cols = 2;
    data.powerZones.slice(0, 6).forEach((z, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const lx = 65 + col * 320;
      const ly = zoneY + 115 + row * 30;

      ctx.fillStyle = z.color;
      ctx.fillRect(lx, ly - 10, 10, 10);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(`${z.zone} ${z.label}: ${z.percent}%`, lx + 18, ly);
    });
  }

  // Tactical Ride Review & Phenotype
  const reviewY = 750;
  roundRect(ctx, 40, reviewY, w - 80, 220, 20);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.025)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
  ctx.stroke();

  ctx.fillStyle = '#0A84FF';
  ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('本次活动生理画像与骑行战评', 65, reviewY + 36);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`• 判定车手类型: ${data.phenotype || '全能均衡型'}`, 65, reviewY + 70);
  ctx.fillText(`• 平均输出: ${data.avgPower}W | 最大爆发峰值: ${data.maxWatts}W`, 65, reviewY + 102);

  const vi = data.avgPower > 0 ? (data.normalizedPower / data.avgPower).toFixed(2) : '1.00';
  ctx.fillText(`• 变异指数 VI: ${vi} · ${Number(vi) > 1.15 ? '波动剧烈，含多次高强度突围与爬坡' : '稳态平顺，节奏控制极佳'}`, 65, reviewY + 134);
  ctx.fillText(`• 强度系数 IF: ${data.intensityFactor} · ${data.intensityFactor >= 0.95 ? '比赛级超强负荷' : data.intensityFactor >= 0.85 ? '高强度甜区阈值' : '基础耐力有氧'}`, 65, reviewY + 166);

  drawFooter(ctx, w, h);
  return canvas.toDataURL('image/png');
}

export interface StravaCockpitPosterData {
  periodLabel: string;
  athleteName: string;
  totalDistanceKm: number;
  totalElevationM: number;
  totalMovingTimeMin: number;
  totalCaloriesKcal: number;
  totalRides: number;
  avgNpWatts: number;
  avgSpeedKmh: number;
  eddingtonE: number;
  ctl: number;
  atl: number;
  tsb: number;
  tsbLabel: string;
  streakDays: number;
  riderPattern: string;
  everestCount: number;
}

/**
 * Generate Apple-aesthetic Strava Cockpit Share Poster
 */
export async function generateStravaCockpitPoster(data: StravaCockpitPosterData): Promise<string> {
  const w = 750;
  const h = 1050;
  const { canvas, ctx } = createPosterCanvas(w, h);

  drawBackground(ctx, w, h, '#007AFF');
  drawHeader(
    ctx,
    w,
    'STRAVA 骑行数据罗盘战报',
    data.periodLabel || '年度全景总览',
    `${data.athleteName || 'YoloCycling 车手'} · 战力画像: ${data.riderPattern}`,
    '#007AFF'
  );

  // 6 Metric Tiles in 2 rows x 3 cols
  const metrics = [
    { label: '总骑行里程', value: `${data.totalDistanceKm.toLocaleString()}`, unit: 'km', color: '#007AFF' },
    { label: '累计总爬升', value: `+${data.totalElevationM.toLocaleString()}`, unit: 'm', color: '#34C759' },
    { label: '鞍上总时长', value: `${Math.floor(data.totalMovingTimeMin / 60)}h ${data.totalMovingTimeMin % 60}m`, unit: '', color: '#FF9500' },
    { label: '活跃卡路里', value: `${data.totalCaloriesKcal.toLocaleString()}`, unit: 'kcal', color: '#FF3B30' },
    { label: '出勤场次', value: `${data.totalRides}`, unit: '次', color: '#AF52DE' },
    { label: '加权平均功率', value: `${data.avgNpWatts}`, unit: 'W NP', color: '#00C7BE' },
  ];

  const gridY = 204;
  const cardW = 212;
  const cardH = 86;
  const gap = 17;

  metrics.forEach((m, idx) => {
    const col = idx % 3;
    const row = Math.floor(idx / 3);
    const x = 40 + col * (cardW + gap);
    const y = gridY + row * (cardH + 14);

    roundRect(ctx, x, y, cardW, cardH, 16);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(m.label, x + 16, y + 26);

    ctx.fillStyle = m.color;
    ctx.font = 'bold 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(m.value, x + 16, y + 58);

    if (m.unit) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(m.unit, x + 16 + ctx.measureText(m.value).width + 5, y + 58);
    }
  });

  // Sports Science & Achievement Section
  const sciY = 415;
  roundRect(ctx, 40, sciY, w - 80, 240, 20);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.stroke();

  ctx.fillStyle = '#007AFF';
  ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('运动生理科学体能模型与状态评估', 65, sciY + 34);

  // PMC Tri-state pills
  const pmcItems = [
    { label: '长期体能', val: `${data.ctl}`, color: '#007AFF' },
    { label: '急性疲劳', val: `${data.atl}`, color: '#FF9500' },
    { label: '竞技状态', val: `${data.tsb > 0 ? '+' : ''}${data.tsb}`, color: data.tsb >= 0 ? '#34C759' : '#FF3B30' },
  ];

  const pillW = (w - 80 - 50 - 24) / 3;
  pmcItems.forEach((p, idx) => {
    const px = 65 + idx * (pillW + 12);
    const py = sciY + 48;
    roundRect(ctx, px, py, pillW, 54, 12);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(p.label, px + 12, py + 22);

    ctx.fillStyle = p.color;
    ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(p.val, px + 12, py + 45);
  });

  // TSB Diagnosis text
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`• 当前身心竞技状态判定: ${data.tsbLabel}`, 65, sciY + 134);
  ctx.fillText(`• 连续出勤记录: 已连续打卡 ${data.streakDays} 天`, 65, sciY + 165);
  ctx.fillText(`• 垂直空间征服: 累计爬升相当于征服了 ${data.everestCount} 座珠穆朗玛峰`, 65, sciY + 196);

  // Eddington Hero Block
  const eddY = 675;
  roundRect(ctx, 40, eddY, w - 80, 220, 20);
  ctx.fillStyle = 'rgba(0, 122, 255, 0.06)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(0, 122, 255, 0.2)';
  ctx.stroke();

  ctx.fillStyle = '#007AFF';
  ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('车手爱丁顿数', 65, eddY + 34);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 56px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`E = ${data.eddingtonE}`, 65, eddY + 105);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`代表车手一生中至少有 ${data.eddingtonE} 天，单日骑行里程超过了 ${data.eddingtonE} 公里。`, 65, eddY + 148);
  ctx.fillText(`这是全球严肃骑行者用汗水与车轮丈量大地的终极耐力勋章！`, 65, eddY + 176);

  drawFooter(ctx, w, h);
  return canvas.toDataURL('image/png');
}

export interface LatestRidePosterData {
  title: string;
  dateStr: string;
  distKm: number;
  eleM: number;
  timeStr: string;
  avgSpeed: number;
  np: number;
  avgP: number;
  wKg?: number;
  vi: number;
  ifVal: number;
  tss: number;
  avgHr?: number | null;
  maxHr?: number | null;
  ef?: number | null;
  caloriesKcal?: number;
  tacticalPace: string;
  tacticalColor?: string;
  sportType?: string;
  bikeName?: string;
  isRealData?: boolean;
}

export type LatestRidePosterTheme = 'conqueror' | 'neon-dawn' | 'racing';

/**
 * STYLE 1: "征服者手稿" (Conqueror's Log)
 * Deep military olive & gold topographic expedition aesthetic for climbers and elevation seekers.
 */
async function generateConquerorPoster(data: LatestRidePosterData): Promise<string> {
  const w = 1080;
  const h = 1440; // 3:4 Aspect Ratio
  const { canvas, ctx } = createPosterCanvas(w, h);

  // 1. Dark Expedition Olive Gradient
  const bgGrad = ctx.createLinearGradient(0, 0, w, h);
  bgGrad.addColorStop(0, '#0a120d');
  bgGrad.addColorStop(0.4, '#101c14');
  bgGrad.addColorStop(0.8, '#0d1610');
  bgGrad.addColorStop(1, '#060b08');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, w, h);

  // Ambient Forest/Gold Radial Glow
  const topGlow = ctx.createRadialGradient(w * 0.2, 200, 10, w * 0.2, 200, 600);
  topGlow.addColorStop(0, 'rgba(212, 175, 55, 0.16)');
  topGlow.addColorStop(0.6, 'rgba(52, 199, 89, 0.06)');
  topGlow.addColorStop(1, 'transparent');
  ctx.fillStyle = topGlow;
  ctx.fillRect(0, 0, w, 800);

  // 2. Procedural Topographic Contour Lines (等高线纹理)
  ctx.lineWidth = 1.2;
  const contourSteps = [180, 320, 480, 640, 800, 960, 1120, 1280];
  contourSteps.forEach((cy, idx) => {
    ctx.strokeStyle = idx % 2 === 0 ? 'rgba(212, 175, 55, 0.07)' : 'rgba(52, 199, 89, 0.05)';
    ctx.beginPath();
    ctx.moveTo(0, cy);
    const amp = 35 + (idx % 3) * 18;
    ctx.bezierCurveTo(w * 0.25, cy - amp, w * 0.55, cy + amp * 1.2, w * 0.78, cy - amp * 0.6);
    ctx.bezierCurveTo(w * 0.88, cy + amp * 0.5, w * 0.95, cy - amp * 0.3, w, cy + 10);
    ctx.stroke();

    // Elevation contour label
    ctx.fillStyle = 'rgba(212, 175, 55, 0.3)';
    ctx.font = 'bold 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(`${250 + idx * 85}m`, 45 + (idx * 90) % (w - 180), cy - 6);
  });

  // Military crosshairs & framing grid
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.15)';
  ctx.lineWidth = 1;
  roundRect(ctx, 40, 40, w - 80, h - 80, 0);
  ctx.stroke();

  // Corner crosshairs
  const crossSize = 14;
  const corners = [
    [40, 40],
    [w - 40, 40],
    [40, h - 40],
    [w - 40, h - 40],
  ];
  corners.forEach(([cx, cy]) => {
    ctx.beginPath();
    ctx.moveTo(cx - crossSize, cy);
    ctx.lineTo(cx + crossSize, cy);
    ctx.moveTo(cx, cy - crossSize);
    ctx.lineTo(cx, cy + crossSize);
    ctx.stroke();
  });

  // 3. Header: Field Expedition Header
  ctx.fillStyle = '#D4AF37';
  ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.letterSpacing = '2.5px';
  ctx.fillText('YOLOCYCLING EXPEDITION · 地形征服与高度日志', 65, 78);

  // Expedition Spec Badge (Right)
  const specText = 'ELEVATION SPEC · GRADE A';
  ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  const specW = ctx.measureText(specText).width + 20;
  roundRect(ctx, w - 65 - specW, 62, specW, 24, 4);
  ctx.fillStyle = 'rgba(212, 175, 55, 0.12)';
  ctx.fill();
  ctx.strokeStyle = '#D4AF37';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = '#F5E6BE';
  ctx.fillText(specText, w - 65 - specW + 10, 78);

  // Date & Vehicle metadata
  ctx.fillStyle = 'rgba(245, 230, 190, 0.6)';
  ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`${data.dateStr} · 战车: ${data.bikeName || '公路战车'} · ${data.sportType || 'ROAD'}`, 65, 122);

  // Activity Title
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 36px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  let displayTitle = data.title;
  if (ctx.measureText(displayTitle).width > w - 130) {
    while (ctx.measureText(displayTitle + '...').width > w - 130 && displayTitle.length > 5) {
      displayTitle = displayTitle.slice(0, -1);
    }
    displayTitle += '...';
  }
  ctx.fillText(displayTitle, 65, 172);

  // 4. Hero Section: The Gigantic Mountain Climb Split
  const heroY = 215;
  const heroH = 190;

  // Left Huge Elevation Box
  roundRect(ctx, 65, heroY, 560, heroH, 16);
  ctx.fillStyle = 'rgba(212, 175, 55, 0.06)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.25)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = '#D4AF37';
  ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.letterSpacing = '1.5px';
  ctx.fillText('累计垂直拔升 / VERTICAL SUMMIT GAIN', 90, heroY + 36);

  ctx.fillStyle = '#F3E5AB';
  ctx.font = 'bold 84px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  const eleText = `+${data.eleM}`;
  ctx.fillText(eleText, 90, heroY + 120);
  const eleW = ctx.measureText(eleText).width;

  ctx.fillStyle = '#D4AF37';
  ctx.font = 'bold 28px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('M', 90 + eleW + 10, heroY + 120);

  const eiffel = (data.eleM / 300).toFixed(1);
  ctx.fillStyle = 'rgba(245, 230, 190, 0.8)';
  ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`直拔 ${eiffel} 座埃菲尔铁塔 · 战胜重力做功`, 90, heroY + 160);

  // Right Distance & Pace Box
  roundRect(ctx, 645, heroY, w - 65 - 645, heroH, 16);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.letterSpacing = '1px';
  ctx.fillText('单场里程 / DISTANCE', 670, heroY + 36);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 50px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(String(data.distKm), 670, heroY + 98);
  const distW = ctx.measureText(String(data.distKm)).width;
  ctx.fillStyle = '#34C759';
  ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('KM', 670 + distW + 8, heroY + 98);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`均速 ${data.avgSpeed} km/h · 耗时 ${data.timeStr}`, 670, heroY + 142);
  ctx.fillText(`战术判定: ${data.tacticalPace}`, 670, heroY + 166);

  // 5. Alpine Ridge Profile (山脊剖面线与蚀刻排线)
  const ridgeY = 430;
  const ridgeH = 250;
  const ridgeW = w - 130;

  roundRect(ctx, 65, ridgeY, ridgeW, ridgeH, 16);
  ctx.fillStyle = 'rgba(10, 18, 13, 0.75)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.18)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#D4AF37';
  ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('山脊高程剖面与爬坡地形蚀刻', 88, ridgeY + 32);

  const baseLine = ridgeY + ridgeH - 35;
  const rPoints = [
    { x: 88, y: baseLine - 25 },
    { x: 88 + ridgeW * 0.18, y: baseLine - 60 },
    { x: 88 + ridgeW * 0.32, y: baseLine - 95 },
    { x: 88 + ridgeW * 0.5, y: baseLine - 165 }, // Peak
    { x: 88 + ridgeW * 0.68, y: baseLine - 75 },
    { x: 88 + ridgeW * 0.82, y: baseLine - 110 },
    { x: 88 + ridgeW - 46, y: baseLine - 30 }
  ];

  // Vertical Etching Hatching (复古地形图蚀刻排线)
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.12)';
  ctx.lineWidth = 1.5;
  for (let hx = 88; hx <= 88 + ridgeW - 46; hx += 12) {
    // Interpolate curve height at hx
    const t = (hx - 88) / (ridgeW - 46);
    const estY = baseLine - (Math.sin(t * Math.PI) * 135 + Math.sin(t * Math.PI * 3) * 20);
    ctx.beginPath();
    ctx.moveTo(hx, baseLine);
    ctx.lineTo(hx, estY);
    ctx.stroke();
  }

  // Draw Ridge Curve
  ctx.beginPath();
  ctx.moveTo(rPoints[0].x, rPoints[0].y);
  for (let i = 0; i < rPoints.length - 1; i++) {
    const xc = (rPoints[i].x + rPoints[i + 1].x) / 2;
    const yc = (rPoints[i].y + rPoints[i + 1].y) / 2;
    ctx.quadraticCurveTo(rPoints[i].x, rPoints[i].y, xc, yc);
  }
  ctx.quadraticCurveTo(rPoints[rPoints.length - 1].x, rPoints[rPoints.length - 1].y, rPoints[rPoints.length - 1].x, rPoints[rPoints.length - 1].y);
  ctx.strokeStyle = '#D4AF37';
  ctx.lineWidth = 3.5;
  ctx.stroke();

  // Peak Pin
  const peakPt = rPoints[3];
  ctx.beginPath();
  ctx.arc(peakPt.x, peakPt.y, 6, 0, Math.PI * 2);
  ctx.fillStyle = '#F3E5AB';
  ctx.fill();
  ctx.strokeStyle = '#D4AF37';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.fillStyle = '#F3E5AB';
  ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`SUMMIT 极点 +${data.eleM}m`, peakPt.x - 55, peakPt.y - 14);

  // Axis labels
  ctx.fillStyle = 'rgba(212, 175, 55, 0.6)';
  ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('0.0 KM 大本营', 88, baseLine + 22);
  ctx.fillText(`${data.distKm} KM 收官`, 88 + ridgeW - 120, baseLine + 22);

  // 6. 6-Tile Expedition Telemetry Grid
  const gridY = 705;
  const tileW = 295;
  const tileH = 115;
  const gapX = 27;
  const gapY = 16;

  const expMetrics = [
    { label: '标准化功率 NP', val: `${data.np} W`, sub: data.wKg ? `${data.wKg} W/kg · 推重比` : '克服重力加权做功', color: '#E5C07B' },
    { label: '平均有效功率', val: `${data.avgP} W`, sub: `做功积分 ${data.caloriesKcal || 800} kcal`, color: '#FFFFFF' },
    { label: '变异指数 VI', val: `${data.vi}`, sub: data.vi <= 1.05 ? '平稳踩踏 · 控瓦得当' : '陡坡拉扯 · 峰值波动', color: '#34C759' },
    { label: '强度系数 IF', val: `${data.ifVal}`, sub: data.ifVal >= 0.85 ? '阈值以上 · 攻坚拉练' : '有氧区间 · 持续巡航', color: '#D4AF37' },
    { label: '训练负荷 TSS', val: `${data.tss}`, sub: '单场体能与生理刺激', color: '#FF9500' },
    { label: '效率因子 EF', val: data.ef ? `${data.ef}` : '--', sub: data.avgHr ? `心率 ${data.avgHr} bpm · 做功产出` : 'NP / 心率生理比', color: '#00C7BE' },
  ];

  expMetrics.forEach((m, idx) => {
    const col = idx % 3;
    const row = Math.floor(idx / 3);
    const tx = 65 + col * (tileW + gapX);
    const ty = gridY + row * (tileH + gapY);

    roundRect(ctx, tx, ty, tileW, tileH, 12);
    ctx.fillStyle = 'rgba(212, 175, 55, 0.04)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.12)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = 'rgba(245, 230, 190, 0.6)';
    ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(m.label, tx + 16, ty + 28);

    ctx.fillStyle = m.color;
    ctx.font = 'bold 28px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(m.val, tx + 16, ty + 68);

    ctx.fillStyle = 'rgba(245, 230, 190, 0.65)';
    ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(m.sub, tx + 16, ty + 95);
  });

  // 7. Military Seal & Field Note Block
  const noteY = 970;
  const noteH = 345;
  roundRect(ctx, 65, noteY, ridgeW, noteH, 16);
  ctx.fillStyle = 'rgba(10, 18, 13, 0.7)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.2)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Seal badge (Right)
  const sealCx = w - 170;
  const sealCy = noteY + 110;
  ctx.beginPath();
  ctx.arc(sealCx, sealCy, 60, 0, Math.PI * 2);
  ctx.strokeStyle = '#D4AF37';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(sealCx, sealCy, 52, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.4)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#D4AF37';
  ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('YOLOCYCLING', sealCx, sealCy - 20);
  ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('CONQUERED', sealCx, sealCy);
  ctx.font = 'bold 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('VERIFIED 3:4', sealCx, sealCy + 20);
  ctx.textAlign = 'left';

  // Field Notes (Left)
  ctx.fillStyle = '#D4AF37';
  ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('FIELD NOTES · 征服者实测战报剖析', 90, noteY + 40);

  const bullets = [
    `高程征服核算: 本场克服重力直拔累计 +${data.eleM}m，垂直落差与功耗折合直拔 ${eiffel} 座埃菲尔铁塔。`,
    `功率踏频自律: NP 达 ${data.np}W，变异指数 VI ${data.vi}，爬坡起伏段踏频自律，无氧储备调配合理。`,
    `机体能量消耗: 克服坡度做功总计约 ${data.caloriesKcal || 800} kcal，相当于消耗 ${Math.max(1, Math.round((data.caloriesKcal || 800) / 105))} 根香蕉的生物能量。`,
    `征服格言: 双腿是丈量大地的唯一标尺，山顶的清风只为攀登至巅峰的征服者吹拂。`
  ];

  bullets.forEach((b, bi) => {
    const by = noteY + 80 + bi * 62;
    ctx.beginPath();
    ctx.arc(96, by + 4, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#D4AF37';
    ctx.fill();

    ctx.fillStyle = 'rgba(245, 230, 190, 0.85)';
    ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

    // wrap line if needed
    const maxW = ridgeW - 220;
    let l1 = '';
    let l2 = '';
    for (let c = 0; c < b.length; c++) {
      const test = l1 + b[c];
      if (ctx.measureText(test).width > maxW) {
        l2 = b.slice(c);
        break;
      } else {
        l1 = test;
      }
    }
    ctx.fillText(l1, 112, by + 9);
    if (l2) {
      ctx.fillText(l2, 112, by + 30);
    }
  });

  // 8. Footer Watermark
  const footerY = 1360;
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(65, footerY);
  ctx.lineTo(w - 65, footerY);
  ctx.stroke();

  ctx.fillStyle = 'rgba(212, 175, 55, 0.5)';
  ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('YOLOCYCLING PRO · 征服者手稿 · 1080×1440 HD (3:4)', 65, footerY + 32);

  const rightTag = 'SUMMIT CERTIFIED';
  ctx.fillStyle = '#D4AF37';
  ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(rightTag, w - 65 - ctx.measureText(rightTag).width, footerY + 32);

  return canvas.toDataURL('image/png');
}

/**
 * STYLE 2: "城市霓虹破晓" (Neon Dawn)
 * Vibrant cyber-sunrise gradient with prominent average speed, neon borders, and lifestyle motto.
 */
async function generateNeonDawnPoster(data: LatestRidePosterData): Promise<string> {
  const w = 1080;
  const h = 1440; // 3:4 Aspect Ratio
  const { canvas, ctx } = createPosterCanvas(w, h);

  // 1. Cyber Sunrise Vibrant Gradient
  const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
  bgGrad.addColorStop(0, '#2b0a3d');
  bgGrad.addColorStop(0.25, '#190628');
  bgGrad.addColorStop(0.65, '#0d0217');
  bgGrad.addColorStop(1, '#05010a');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, w, h);

  // Sunrise Ray Flare Orb at Top
  const sunOrb = ctx.createRadialGradient(w / 2, 0, 10, w / 2, 0, 680);
  sunOrb.addColorStop(0, 'rgba(255, 94, 58, 0.45)');
  sunOrb.addColorStop(0.4, 'rgba(255, 45, 85, 0.22)');
  sunOrb.addColorStop(0.7, 'rgba(0, 242, 254, 0.08)');
  sunOrb.addColorStop(1, 'transparent');
  ctx.fillStyle = sunOrb;
  ctx.fillRect(0, 0, w, 750);

  // Flowing GPS Neon Light Waves in background
  ctx.lineWidth = 3;
  for (let li = 0; li < 4; li++) {
    ctx.strokeStyle = li % 2 === 0 ? 'rgba(0, 242, 254, 0.15)' : 'rgba(255, 45, 85, 0.12)';
    ctx.beginPath();
    const sy = 320 + li * 90;
    ctx.moveTo(0, sy);
    ctx.bezierCurveTo(w * 0.3, sy - 80, w * 0.65, sy + 100, w, sy - 40);
    ctx.stroke();
  }

  // 2. Dual Glowing Neon Borders
  // Outer Cyan Neon
  ctx.strokeStyle = 'rgba(0, 242, 254, 0.6)';
  ctx.lineWidth = 2.5;
  roundRect(ctx, 35, 35, w - 70, h - 70, 24);
  ctx.stroke();

  // Inner Magenta Neon
  ctx.strokeStyle = 'rgba(255, 45, 85, 0.35)';
  ctx.lineWidth = 1;
  roundRect(ctx, 42, 42, w - 84, h - 84, 20);
  ctx.stroke();

  // 3. Header
  ctx.fillStyle = '#00F2FE';
  ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.letterSpacing = '2px';
  ctx.fillText('YOLOCYCLING CITY RIDE · 破晓晨刷档案', 65, 80);

  // Top Right Badge Capsule
  const pillText = 'DAWN CHASER · 晨光追风者';
  ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  const pillW = ctx.measureText(pillText).width + 24;
  roundRect(ctx, w - 65 - pillW, 64, pillW, 28, 14);
  const pillGrad = ctx.createLinearGradient(w - 65 - pillW, 0, w - 65, 0);
  pillGrad.addColorStop(0, 'rgba(255, 45, 85, 0.3)');
  pillGrad.addColorStop(1, 'rgba(255, 149, 0, 0.3)');
  ctx.fillStyle = pillGrad;
  ctx.fill();
  ctx.strokeStyle = '#FF2D55';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(pillText, w - 65 - pillW + 12, 83);

  // Title & Date
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`${data.dateStr} · 战车: ${data.bikeName || '公路战车'}`, 65, 126);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 36px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(data.title, 65, 176);

  // 4. Hero Visual: Colossal Average Speed
  const speedBoxY = 215;
  const speedBoxH = 260;
  const speedBoxW = w - 130;

  roundRect(ctx, 65, speedBoxY, speedBoxW, speedBoxH, 24);
  const speedGrad = ctx.createLinearGradient(65, speedBoxY, 65 + speedBoxW, speedBoxY + speedBoxH);
  speedGrad.addColorStop(0, 'rgba(255, 45, 85, 0.12)');
  speedGrad.addColorStop(0.5, 'rgba(0, 242, 254, 0.08)');
  speedGrad.addColorStop(1, 'rgba(0, 0, 0, 0.3)');
  ctx.fillStyle = speedGrad;
  ctx.fill();
  ctx.strokeStyle = 'rgba(0, 242, 254, 0.4)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = '#00F2FE';
  ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.letterSpacing = '1px';
  ctx.fillText('巡航均速 / AVERAGE CRUISE SPEED', 95, speedBoxY + 45);

  // Giant Speed Display
  const speedStr = `${data.avgSpeed}`;
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 125px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(speedStr, 95, speedBoxY + 165);
  const sw = ctx.measureText(speedStr).width;

  ctx.fillStyle = '#00F2FE';
  ctx.font = 'bold 34px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('KM/H', 95 + sw + 16, speedBoxY + 130);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.font = '16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`耗时 ${data.timeStr} · 战术属性: ${data.tacticalPace}`, 95, speedBoxY + 215);

  // 5. 4-Pill Glowing Data Capsules
  const capY = 500;
  const capW = 460;
  const capH = 120;
  const capGapX = 30;
  const capGapY = 20;

  const caps = [
    { label: '单场骑行里程', val: `${data.distKm}`, unit: 'km', color: '#00F2FE', sub: '破风晨跑刷街' },
    { label: '累计垂直爬升', val: `+${data.eleM}`, unit: 'm', color: '#34C759', sub: `等效 ${(data.eleM / 300).toFixed(1)} 座埃菲尔铁塔` },
    { label: '标准化功率 NP', val: `${data.np}`, unit: 'W', color: '#FF2D55', sub: data.wKg ? `${data.wKg} W/kg · 推重比` : '稳态有效加权' },
    { label: '能量消耗做功', val: `${data.caloriesKcal || 800}`, unit: 'kcal', color: '#FF9500', sub: `等效 ${Math.max(1, Math.round((data.caloriesKcal || 800) / 105))} 根香蕉` },
  ];

  caps.forEach((cp, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const cx = 65 + col * (capW + capGapX);
    const cy = capY + row * (capH + capGapY);

    roundRect(ctx, cx, cy, capW, capH, 18);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.fill();
    ctx.strokeStyle = cp.color + '40';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(cp.label, cx + 22, cy + 32);

    ctx.fillStyle = cp.color;
    ctx.font = 'bold 36px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(cp.val, cx + 22, cy + 78);
    const cw = ctx.measureText(cp.val).width;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(cp.unit, cx + 22 + cw + 8, cy + 78);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(cp.sub, cx + 22, cy + 104);
  });

  // 6. 3-Tile Telemetry Line (VI / IF / TSS)
  const trioY = 780;
  const trioW = 295;
  const trioH = 95;
  const trioGap = 27;

  const trios = [
    { label: '变异指数 VI', val: `${data.vi}`, sub: '输出平稳自律度', color: '#00F2FE' },
    { label: '强度系数 IF', val: `${data.ifVal}`, sub: 'FTP负荷负荷比', color: '#AF52DE' },
    { label: '训练负荷 TSS', val: `${data.tss}`, sub: '生理压力刺激', color: '#FF2D55' },
  ];

  trios.forEach((tr, idx) => {
    const tx = 65 + idx * (trioW + trioGap);
    roundRect(ctx, tx, trioY, trioW, trioH, 16);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(tr.label, tx + 18, trioY + 28);

    ctx.fillStyle = tr.color;
    ctx.font = 'bold 28px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(tr.val, tx + 18, trioY + 62);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(tr.sub, tx + 18, trioY + 84);
  });

  // 7. Xiaohongshu Emotional Golden Motto Card
  const mottoY = 905;
  const mottoH = 425;
  roundRect(ctx, 65, mottoY, speedBoxW, mottoH, 24);
  const mottoGrad = ctx.createLinearGradient(65, mottoY, 65, mottoY + mottoH);
  mottoGrad.addColorStop(0, 'rgba(255, 45, 85, 0.15)');
  mottoGrad.addColorStop(1, 'rgba(0, 242, 254, 0.08)');
  ctx.fillStyle = mottoGrad;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 45, 85, 0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Quote symbol
  ctx.fillStyle = 'rgba(255, 45, 85, 0.4)';
  ctx.font = 'bold 72px -apple-system, BlinkMacSystemFont, Georgia, serif';
  ctx.fillText('“', 95, mottoY + 70);

  // Big Motto Text
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 26px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('清晨 05:30 的破晓之风，', 95, mottoY + 115);
  ctx.fillStyle = '#00F2FE';
  ctx.fillText('是世界给自律者最好的红包。', 95, mottoY + 155);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.font = '15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`52.4 km 晨风破晓刷街收官，均速 ${data.avgSpeed} km/h 稳健巡航。`, 95, mottoY + 215);
  ctx.fillText(`单车踩碎清晨的庸懒，用汗水与速度唤醒沉睡的城市。`, 95, mottoY + 248);
  ctx.fillText(`满电开启一整天的高能打拼，今天也是活力拉满的自律骑友！`, 95, mottoY + 281);

  // Sub Tags
  const tags = ['#破晓晨骑', '#生活美学', '#骑行日常', '#满电出发'];
  tags.forEach((tg, ti) => {
    const tgX = 95 + ti * 145;
    roundRect(ctx, tgX, mottoY + 340, 130, 32, 16);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#00F2FE';
    ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(tg, tgX + 16, mottoY + 361);
  });

  // 8. Footer Watermark
  const footerY = 1360;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(65, footerY);
  ctx.lineTo(w - 65, footerY);
  ctx.stroke();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('YOLOCYCLING NEON DAWN · 破晓晨刷 · 1080×1440 HD (3:4)', 65, footerY + 32);

  const rightTag = 'CITY RIDE VERIFIED';
  ctx.fillStyle = '#00F2FE';
  ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(rightTag, w - 65 - ctx.measureText(rightTag).width, footerY + 32);

  return canvas.toDataURL('image/png');
}

/**
 * STYLE 3: "极简竞速仪表盘" (Racing Dashboard)
 * Precision Formula 1 carbon cockpit aesthetic with full-screen circular power gauge dial.
 */
async function generateRacingDashboardPoster(data: LatestRidePosterData): Promise<string> {
  const w = 1080;
  const h = 1440; // 3:4 Aspect Ratio
  const { canvas, ctx } = createPosterCanvas(w, h);

  // 1. Pure Stealth Carbon Dark
  const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
  bgGrad.addColorStop(0, '#060709');
  bgGrad.addColorStop(0.5, '#0c0e13');
  bgGrad.addColorStop(1, '#050608');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, w, h);

  // Precision Technical Grid Lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.025)';
  ctx.lineWidth = 1;
  for (let gx = 50; gx < w; gx += 60) {
    ctx.beginPath();
    ctx.moveTo(gx, 0);
    ctx.lineTo(gx, h);
    ctx.stroke();
  }
  for (let gy = 50; gy < h; gy += 60) {
    ctx.beginPath();
    ctx.moveTo(0, gy);
    ctx.lineTo(w, gy);
    ctx.stroke();
  }

  // Outer Technical Frame
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 1.5;
  roundRect(ctx, 40, 40, w - 80, h - 80, 0);
  ctx.stroke();

  // 2. Header
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.letterSpacing = '2px';
  ctx.fillText('YOLOCYCLING RACING TELEMETRY · 赛事级功率仪表盘', 65, 78);

  const specLabel = 'FORMULA COCKPIT · PRO SPEC';
  ctx.fillStyle = '#007AFF';
  ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  const specW = ctx.measureText(specLabel).width;
  ctx.fillText(specLabel, w - 65 - specW, 78);

  // Title & Metadata
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`${data.dateStr} · 战车: ${data.bikeName || '公路战车'} · ${data.sportType || 'RACE'}`, 65, 122);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 36px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(data.title, 65, 172);

  // 3. Central Circular Racing Gauge Dial (Coggan 7-Zone Dial)
  const dialCx = w / 2;
  const dialCy = 460;
  const dialR = 190;

  // Background arc (270 degrees sweep from 135 deg to 405 deg)
  const startAng = (135 * Math.PI) / 180;
  const endAng = (405 * Math.PI) / 180;
  const totalSweep = endAng - startAng;

  // Outer Dial Track
  ctx.beginPath();
  ctx.arc(dialCx, dialCy, dialR, startAng, endAng);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 22;
  ctx.stroke();

  // Coggan Color Zones around the Arc
  const zones = [
    { name: 'Z1', pct: 0.16, color: '#8E8E93' }, // Active Recovery
    { name: 'Z2', pct: 0.2, color: '#007AFF' },  // Endurance
    { name: 'Z3', pct: 0.2, color: '#34C759' },  // Tempo
    { name: 'Z4', pct: 0.2, color: '#FFD60A' },  // Threshold
    { name: 'Z5', pct: 0.14, color: '#FF9500' }, // VO2 Max
    { name: 'Z6', pct: 0.1, color: '#FF3B30' },  // Anaerobic
  ];

  let curAng = startAng;
  zones.forEach((z) => {
    const sweep = totalSweep * z.pct;
    ctx.beginPath();
    ctx.arc(dialCx, dialCy, dialR, curAng, curAng + sweep - 0.03);
    ctx.strokeStyle = z.color;
    ctx.lineWidth = 14;
    ctx.stroke();
    curAng += sweep;
  });

  // Dial Tick Marks
  for (let i = 0; i <= 36; i++) {
    const a = startAng + (totalSweep / 36) * i;
    const isMajor = i % 6 === 0;
    const r1 = dialR - 18;
    const r2 = isMajor ? dialR - 34 : dialR - 26;
    ctx.strokeStyle = isMajor ? 'rgba(255, 255, 255, 0.4)' : 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = isMajor ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(dialCx + Math.cos(a) * r1, dialCy + Math.sin(a) * r1);
    ctx.lineTo(dialCx + Math.cos(a) * r2, dialCy + Math.sin(a) * r2);
    ctx.stroke();
  }

  // Pointer Needle according to IF (mapped 0.5 to 1.15 across the sweep)
  const ifNorm = Math.min(1.0, Math.max(0.0, (data.ifVal - 0.5) / 0.65));
  const pointerAng = startAng + totalSweep * ifNorm;

  // Needle Line
  ctx.beginPath();
  ctx.moveTo(dialCx, dialCy);
  ctx.lineTo(dialCx + Math.cos(pointerAng) * (dialR - 10), dialCy + Math.sin(pointerAng) * (dialR - 10));
  ctx.strokeStyle = '#FF3B30';
  ctx.lineWidth = 4;
  ctx.stroke();

  // Needle Pivot Hub
  ctx.beginPath();
  ctx.arc(dialCx, dialCy, 12, 0, Math.PI * 2);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.strokeStyle = '#FF3B30';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Central Text in Dial
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.letterSpacing = '1px';
  ctx.fillText('NORMALIZED POWER', dialCx, dialCy - 75);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 64px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`${data.np} W`, dialCx, dialCy - 10);

  // IF status badge inside dial
  const ifPillText = `IF: ${data.ifVal} · ${data.tacticalPace}`;
  ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  const ipw = ctx.measureText(ifPillText).width + 24;
  roundRect(ctx, dialCx - ipw / 2, dialCy + 40, ipw, 28, 14);
  ctx.fillStyle = 'rgba(0, 122, 255, 0.15)';
  ctx.fill();
  ctx.strokeStyle = '#007AFF';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = '#007AFF';
  ctx.fillText(ifPillText, dialCx, dialCy + 59);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(data.wKg ? `推重比: ${data.wKg} W/kg` : 'PRO RACE TELEMETRY', dialCx, dialCy + 92);
  ctx.textAlign = 'left';

  // 4. 6-Grid Racing Telemetry Block (Below Dial)
  const rgridY = 700;
  const rtileW = 295;
  const rtileH = 115;
  const rgapX = 27;
  const rgapY = 16;

  const racingMetrics = [
    { label: '单场骑行里程', val: `${data.distKm}`, unit: 'KM', sub: `均速 ${data.avgSpeed} km/h`, color: '#007AFF' },
    { label: '累计垂直爬升', val: `+${data.eleM}`, unit: 'M', sub: `直拔 ${(data.eleM / 300).toFixed(1)} 座铁塔`, color: '#34C759' },
    { label: '平均踩踏功率', val: `${data.avgP}`, unit: 'W', sub: `做功 ${data.caloriesKcal || 800} kcal`, color: '#FFFFFF' },
    { label: '变异指数 VI', val: `${data.vi}`, unit: 'VI', sub: data.vi <= 1.05 ? '输出极度稳态平滑' : '起伏变速拉扯', color: '#FF9500' },
    { label: '强度系数 IF', val: `${data.ifVal}`, unit: 'IF', sub: '占设定 FTP 百分比', color: '#AF52DE' },
    { label: '训练负荷 TSS', val: `${data.tss}`, unit: 'TSS', sub: '单场机体负荷刺激', color: '#FF3B30' },
  ];

  racingMetrics.forEach((rm, idx) => {
    const col = idx % 3;
    const row = Math.floor(idx / 3);
    const rx = 65 + col * (rtileW + rgapX);
    const ry = rgridY + row * (rtileH + rgapY);

    roundRect(ctx, rx, ry, rtileW, rtileH, 14);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.09)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(rm.label, rx + 16, ry + 28);

    ctx.fillStyle = rm.color;
    ctx.font = 'bold 30px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(rm.val, rx + 16, ry + 68);
    const vw = ctx.measureText(rm.val).width;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(rm.unit, rx + 16 + vw + 8, ry + 68);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(rm.sub, rx + 16, ry + 96);
  });

  // 5. F1 Style Telemetry Log & Debrief Card
  const debriefY = 965;
  const debriefH = 360;
  roundRect(ctx, 65, debriefY, w - 130, debriefH, 18);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.025)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#007AFF';
  ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('TELEMETRY DIAGNOSTICS · 赛事级遥测解析', 90, debriefY + 36);

  const diagItems = [
    {
      title: '变异指数 VI 稳态纪律判定',
      desc: `变异指数为 ${data.vi}。${data.vi <= 1.05 ? '属于高纪律性平路稳态巡航，功率输出极为平滑，踏频与机械传动效率维持在最佳生理窗口。' : '起伏地形与突围进攻频繁，无氧储备调动剧烈，抗乳酸能力发挥充分。'}`
    },
    {
      title: '强度系数 IF 与能量代谢',
      desc: `强度系数 IF 为 ${data.ifVal}，单场标准化功率达 ${data.np}W${data.wKg ? ` (${data.wKg} W/kg)` : ''}。总计做功 ${data.caloriesKcal || 800} kcal，相当于燃烧 ${Math.max(1, Math.round((data.caloriesKcal || 800) / 105))} 根香蕉。`
    },
    {
      title: '超量恢复与战力评估',
      desc: `单场生理刺激 TSS 积分为 ${data.tss}，预计超量恢复窗口约为 ${data.tss >= 100 ? '36~48' : '24~36'} 小时。赛后黄金窗口请务必补充电解质与优质碳水。`
    }
  ];

  diagItems.forEach((d, di) => {
    const dy = debriefY + 74 + di * 90;
    ctx.beginPath();
    ctx.arc(96, dy + 5, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#007AFF';
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(d.title, 112, dy + 9);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

    const maxW = w - 130 - 60;
    let l1 = '';
    let l2 = '';
    for (let c = 0; c < d.desc.length; c++) {
      const test = l1 + d.desc[c];
      if (ctx.measureText(test).width > maxW) {
        l2 = d.desc.slice(c);
        break;
      } else {
        l1 = test;
      }
    }
    ctx.fillText(l1, 112, dy + 32);
    if (l2) {
      ctx.fillText(l2, 112, dy + 52);
    }
  });

  // 6. Footer Watermark
  const footerY = 1360;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(65, footerY);
  ctx.lineTo(w - 65, footerY);
  ctx.stroke();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('YOLOCYCLING RACING TELEMETRY · 1080×1440 HD (3:4)', 65, footerY + 32);

  const rightTag = 'F1 PRO SPEC VERIFIED';
  ctx.fillStyle = '#007AFF';
  ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(rightTag, w - 65 - ctx.measureText(rightTag).width, footerY + 32);

  return canvas.toDataURL('image/png');
}

/**
 * Master Poster Generator with Theme Routing
 */
export async function generateLatestRideSocialPoster(
  data: LatestRidePosterData,
  theme: LatestRidePosterTheme = 'conqueror'
): Promise<string> {
  if (theme === 'neon-dawn') {
    return generateNeonDawnPoster(data);
  } else if (theme === 'racing') {
    return generateRacingDashboardPoster(data);
  } else {
    return generateConquerorPoster(data);
  }
}



