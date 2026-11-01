import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Printer, Check, User, Wrench, Bike, FileText, Award, Compass } from 'lucide-react';
import { YoloCyclingLogo } from '../common/YoloCyclingLogo';
import { useSwipeToDismiss } from '../../hooks/useSwipeToDismiss';

export interface FittingWorkOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialRiderName?: string;
  initialBikeModel?: string;
  data: {
    height: number;
    inseam: number;
    torso: number;
    armLength: number;
    shoulderWidth?: number;
    sittingHeight?: number;
    thighLength?: number;
    lowerLegLength?: number;
    ridingStyle: string;
    saddleHeight: number;
    saddleHeightHamley: number;
    effectiveTopTube: number;
    stemLength: number;
    saddleDrop: number;
    handlebarWidth: number;
    crankLength: number | string;
    saddleSetback: number;
    frameSize: string;
    estimatedStack: number;
    estimatedReach: number;
    sittingHeightNote?: string;
    thighLowerLegNote?: string;
  };
}

interface FittingSheetContentProps {
  riderName: string;
  fitterName: string;
  bikeModel: string;
  orderDate: string;
  orderNo: string;
  ridingStyleName: string;
  data: FittingWorkOrderModalProps['data'];
}

const FittingSheetContent: React.FC<FittingSheetContentProps> = ({
  riderName,
  fitterName,
  bikeModel,
  orderDate,
  orderNo,
  ridingStyleName,
  data,
}) => {
  return (
    <div className="w-full max-w-[190mm] mx-auto bg-white text-slate-900 space-y-2.5 text-[11px] font-sans select-none antialiased print:m-0">
      {/* 1. Ultra-Clean Architectural Header */}
      <div className="flex items-start justify-between border-b border-slate-900 pb-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0 shadow-xs">
            <YoloCyclingLogo className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-mono font-bold text-xs tracking-wider text-slate-900">YOLOCYCLING PRO</span>
              <span className="text-[8px] font-mono font-semibold px-1 py-0.2 rounded bg-slate-100 text-slate-700 border border-slate-300">
                CAD SPECIFICATION
              </span>
            </div>
            <h1 className="text-xs font-bold text-slate-900 tracking-tight">
              公路车 Fitting 设定工单
            </h1>
          </div>
        </div>

        <div className="text-right font-mono text-[9px] text-slate-500 space-y-0.5">
          <div>DOC NO: <span className="font-bold text-slate-900">{orderNo}</span></div>
          <div>DATE: <span className="text-slate-800">{orderDate}</span></div>
          <div>DISCIPLINE: <span className="font-semibold text-slate-900">{ridingStyleName}</span></div>
        </div>
      </div>

      {/* 2. Rider & Chassis Spec Strip */}
      <div className="grid grid-cols-4 gap-2 py-1.5 px-2 bg-slate-50/80 rounded border border-slate-200/80 font-mono text-[10px]">
        <div>
          <span className="text-slate-400 block text-[8px] uppercase tracking-wider">Rider / 车手</span>
          <span className="font-bold text-slate-900 truncate block">{riderName}</span>
        </div>
        <div className="border-l border-slate-200 pl-2">
          <span className="text-slate-400 block text-[8px] uppercase tracking-wider">技师</span>
          <span className="font-bold text-slate-900 truncate block">{fitterName}</span>
        </div>
        <div className="border-l border-slate-200 pl-2">
          <span className="text-slate-400 block text-[8px] uppercase tracking-wider">车型</span>
          <span className="font-bold text-slate-900 truncate block">{bikeModel}</span>
        </div>
        <div className="border-l border-slate-200 pl-2">
          <span className="text-slate-400 block text-[8px] uppercase tracking-wider">规范</span>
          <span className="font-bold text-emerald-700 block">ISO 4210 CERT</span>
        </div>
      </div>

      {/* 3. Section 01: Anthropometrics */}
      <div className="space-y-1">
        <div className="flex items-center justify-between border-b border-slate-200 pb-0.5">
          <span className="text-[10px] font-mono font-bold tracking-wider text-slate-800 uppercase flex items-center gap-1">
            <span className="text-slate-400">01 //</span> 人体解剖学测量数据
          </span>
          <span className="text-[9px] font-mono text-slate-400">UNIT: CM</span>
        </div>
        <div className="grid grid-cols-4 gap-1.5 text-center">
          <div className="border border-slate-200 rounded p-1 bg-white">
            <div className="text-[9px] text-slate-400 font-medium">身高</div>
            <div className="font-mono font-bold text-xs text-slate-900 tabular-nums">{data.height}</div>
          </div>
          <div className="border border-slate-200 rounded p-1 bg-white">
            <div className="text-[9px] text-slate-400 font-medium">跨高</div>
            <div className="font-mono font-bold text-xs text-slate-900 tabular-nums">{data.inseam}</div>
          </div>
          <div className="border border-slate-200 rounded p-1 bg-white">
            <div className="text-[9px] text-slate-400 font-medium">躯干长</div>
            <div className="font-mono font-bold text-xs text-slate-900 tabular-nums">{data.torso}</div>
          </div>
          <div className="border border-slate-200 rounded p-1 bg-white">
            <div className="text-[9px] text-slate-400 font-medium">手臂长</div>
            <div className="font-mono font-bold text-xs text-slate-900 tabular-nums">{data.armLength}</div>
          </div>
        </div>
        {(data.sittingHeightNote || data.thighLowerLegNote) && (
          <div className="text-[9px] font-mono text-slate-600 bg-slate-50 border border-slate-200 rounded px-2 py-0.5">
            <span className="text-slate-900 font-bold">比例特征：</span>
            {data.sittingHeightNote} {data.thighLowerLegNote}
          </div>
        )}
      </div>

      {/* 4. Section 02: Recommended Geometry Settings */}
      <div className="space-y-1">
        <div className="flex items-center justify-between border-b border-slate-200 pb-0.5">
          <span className="text-[10px] font-mono font-bold tracking-wider text-slate-800 uppercase flex items-center gap-1">
            <span className="text-slate-400">02 //</span> 推荐车架与座舱装车设定
          </span>
          <span className="text-[9px] font-mono text-slate-400">LEMOND / HAMLEY DUAL-MODEL</span>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          <div className="border-2 border-slate-900 rounded p-1.5 bg-slate-50/50">
            <div className="text-[9px] text-slate-500 font-medium">推荐坐高</div>
            <div className="text-sm font-bold font-mono text-slate-900 tabular-nums">{data.saddleHeight} <span className="text-[9px] font-normal text-slate-500">cm</span></div>
            <div className="text-[8px] text-slate-400 font-mono">BB中心至座垫顶点</div>
          </div>

          <div className="border border-slate-300 rounded p-1.5 bg-white">
            <div className="text-[9px] text-slate-500 font-medium">有效上管</div>
            <div className="text-sm font-bold font-mono text-slate-900 tabular-nums">{data.effectiveTopTube} <span className="text-[9px] font-normal text-slate-500">cm</span></div>
            <div className="text-[8px] text-slate-400 font-mono">水平虚拟几何跨距</div>
          </div>

          <div className="border border-slate-300 rounded p-1.5 bg-white">
            <div className="text-[9px] text-slate-500 font-medium">推荐把立规格</div>
            <div className="text-sm font-bold font-mono text-slate-900 tabular-nums">{data.stemLength} <span className="text-[9px] font-normal text-slate-500">mm</span></div>
            <div className="text-[8px] text-slate-400 font-mono">把立中对中中心线</div>
          </div>

          <div className="border border-slate-300 rounded p-1.5 bg-white">
            <div className="text-[9px] text-slate-500 font-medium">座舱垂直落差</div>
            <div className="text-sm font-bold font-mono text-slate-900 tabular-nums">{data.saddleDrop} <span className="text-[9px] font-normal text-slate-500">cm</span></div>
            <div className="text-[8px] text-slate-400 font-mono">座垫顶面至车把顶</div>
          </div>

          <div className="border border-slate-300 rounded p-1.5 bg-white">
            <div className="text-[9px] text-slate-500 font-medium">车把下把宽度</div>
            <div className="text-sm font-bold font-mono text-slate-900 tabular-nums">{data.handlebarWidth} <span className="text-[9px] font-normal text-slate-500">cm</span></div>
            <div className="text-[8px] text-slate-400 font-mono">对齐肩关节肩峰轴</div>
          </div>

          <div className="border border-slate-300 rounded p-1.5 bg-white">
            <div className="text-[9px] text-slate-500 font-medium">推荐曲柄长度</div>
            <div className="text-sm font-bold font-mono text-slate-900 tabular-nums">{data.crankLength} <span className="text-[9px] font-normal text-slate-500">mm</span></div>
            <div className="text-[8px] text-slate-400 font-mono">关节灵活性高频踩踏</div>
          </div>

          <div className="border border-slate-300 rounded p-1.5 bg-white">
            <div className="text-[9px] text-slate-500 font-medium">坐垫后移量</div>
            <div className="text-sm font-bold font-mono text-slate-900 tabular-nums">{data.saddleSetback} <span className="text-[9px] font-normal text-slate-500">cm</span></div>
            <div className="text-[8px] text-slate-400 font-mono">座垫鼻尖距BB垂线</div>
          </div>

          <div className="border-2 border-slate-900 rounded p-1.5 bg-slate-900 text-white">
            <div className="text-[9px] text-slate-300 font-medium">建议车架标称尺码</div>
            <div className="text-sm font-bold font-mono text-white">{data.frameSize}</div>
            <div className="text-[8px] text-slate-300 font-mono">Stack ~{data.estimatedStack} / Reach ~{data.estimatedReach}</div>
          </div>
        </div>
      </div>

      {/* 5. Section 03: Precision Engineering CAD Bike Blueprint */}
      <div className="space-y-1">
        <div className="flex items-center justify-between border-b border-slate-200 pb-0.5">
          <span className="text-[10px] font-mono font-bold tracking-wider text-slate-800 uppercase flex items-center gap-1">
            <span className="text-slate-400">03 //</span> 几何基准线矢量工程图解
          </span>
          <span className="text-[9px] font-mono text-slate-400">CAD SCALE 1:10 PROJECTION</span>
        </div>

        <div className="border border-slate-200 rounded p-1 bg-slate-50/50 flex justify-center relative overflow-hidden">
          <svg viewBox="0 0 520 150" className="w-full max-w-[440px] h-auto text-slate-900 select-none">
            <defs>
              {/* Engineering Blueprint Grid Pattern */}
              <pattern id="cad-grid" width="10" height="10" patternUnits="userSpaceOnUse">
                <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#E2E8F0" strokeWidth="0.4" />
              </pattern>
              {/* Dimension Arrowhead Markers */}
              <marker id="arrow-blue" viewBox="0 0 6 6" refX="3" refY="3" markerWidth="4" markerHeight="4" orient="auto">
                <path d="M 0 1.5 L 4.5 3 L 0 4.5 z" fill="#2563EB" />
              </marker>
              <marker id="arrow-green" viewBox="0 0 6 6" refX="3" refY="3" markerWidth="4" markerHeight="4" orient="auto">
                <path d="M 0 1.5 L 4.5 3 L 0 4.5 z" fill="#059669" />
              </marker>
              <marker id="arrow-purple" viewBox="0 0 6 6" refX="3" refY="3" markerWidth="4" markerHeight="4" orient="auto">
                <path d="M 0 1.5 L 4.5 3 L 0 4.5 z" fill="#7C3AED" />
              </marker>
            </defs>

            {/* CAD Grid Background */}
            <rect width="520" height="150" fill="url(#cad-grid)" />

            {/* Ground Level Baseline */}
            <line x1="20" y1="138" x2="500" y2="138" stroke="#94A3B8" strokeWidth="0.8" strokeDasharray="4 2" />
            <text x="25" y="146" fill="#94A3B8" fontSize="7" fontFamily="monospace">GROUND BASELINE 0.00mm</text>

            {/* Rear Aero Wheel (cx: 95, cy: 104, r: 34) */}
            <circle cx="95" cy="104" r="34" fill="none" stroke="#64748B" strokeWidth="2.5" />
            <circle cx="95" cy="104" r="26" fill="none" stroke="#CBD5E1" strokeWidth="0.6" strokeDasharray="2 2" />
            <circle cx="95" cy="104" r="10" fill="none" stroke="#94A3B8" strokeWidth="0.8" />
            <circle cx="95" cy="104" r="3" fill="#0F172A" />

            {/* Front Aero Wheel (cx: 415, cy: 104, r: 34) */}
            <circle cx="415" cy="104" r="34" fill="none" stroke="#64748B" strokeWidth="2.5" />
            <circle cx="415" cy="104" r="26" fill="none" stroke="#CBD5E1" strokeWidth="0.6" strokeDasharray="2 2" />
            <circle cx="415" cy="104" r="10" fill="none" stroke="#94A3B8" strokeWidth="0.8" />
            <circle cx="415" cy="104" r="3" fill="#0F172A" />

            {/* Bottom Bracket Datum (cx: 215, cy: 104) */}
            <circle cx="215" cy="104" r="6" fill="#0F172A" />
            <circle cx="215" cy="104" r="8" fill="none" stroke="#0F172A" strokeWidth="0.8" strokeDasharray="2 2" />
            <text x="202" y="120" fill="#0F172A" fontSize="7" fontWeight="bold" fontFamily="monospace">BB (0,0)</text>

            {/* Modern Dropped-Stay Aero Frame Silhouette */}
            {/* Chainstay: Rear Axle (95, 104) -> BB (215, 104) */}
            <line x1="95" y1="104" x2="215" y2="104" stroke="#0F172A" strokeWidth="2.8" />

            {/* Downtube: BB (215, 104) -> Headtube bottom (348, 62) */}
            <line x1="215" y1="104" x2="348" y2="62" stroke="#0F172A" strokeWidth="3.6" />

            {/* Headtube: (340, 44) to (348, 64) */}
            <line x1="340" y1="44" x2="348" y2="64" stroke="#0F172A" strokeWidth="4.2" strokeLinecap="round" />

            {/* Aero Fork: Headtube bottom (348, 64) curving to Front Axle (415, 104) */}
            <path d="M 348 64 L 375 92 Q 385 104 415 104" fill="none" stroke="#0F172A" strokeWidth="3" />

            {/* Top Tube (Slight Sloping Aero): Headtube top (340, 44) -> Seat Cluster (192, 52) */}
            <line x1="340" y1="44" x2="192" y2="52" stroke="#0F172A" strokeWidth="2.8" />

            {/* Seat Tube: BB (215, 104) -> Seat Cluster (192, 52) */}
            <line x1="215" y1="104" x2="192" y2="52" stroke="#0F172A" strokeWidth="3.2" />

            {/* Dropped Aero Seatstay: Seat Tube (197, 68) -> Rear Axle (95, 104) */}
            <line x1="197" y1="68" x2="95" y2="104" stroke="#0F172A" strokeWidth="2.4" />

            {/* Aero Seatpost & Saddle: (192, 52) up to (180, 24) */}
            <line x1="192" y1="52" x2="180" y2="24" stroke="#475569" strokeWidth="2.2" />
            {/* Saddle Wing Profile */}
            <path d="M 160 22 C 175 21, 185 22, 202 24 C 196 26, 178 26, 160 22 Z" fill="#0F172A" stroke="#0F172A" strokeWidth="1" />

            {/* Integrated Stem & Compact Drop Handlebars */}
            {/* Stem from Headtube (340, 44) forward-down to (372, 36) */}
            <line x1="340" y1="44" x2="372" y2="36" stroke="#475569" strokeWidth="3" strokeLinecap="round" />
            {/* Drop Bar Curve */}
            <path d="M 372 36 C 384 36, 388 42, 386 50 C 383 56, 372 56, 366 56" fill="none" stroke="#0F172A" strokeWidth="2.4" strokeLinecap="round" />

            {/* DIMENSION 1: SADDLE HEIGHT (BB to Saddle Top) */}
            <line x1="215" y1="104" x2="180" y2="22" stroke="#2563EB" strokeWidth="1.2" strokeDasharray="3 2" />
            <rect x="156" y="65" width="76" height="13" rx="2" fill="#EFF6FF" stroke="#2563EB" strokeWidth="0.8" />
            <text x="160" y="74" fill="#1D4ED8" fontSize="7.5" fontWeight="bold" fontFamily="monospace">
              坐高: {data.saddleHeight} cm
            </text>

            {/* DIMENSION 2: ETT (Effective Top Tube) */}
            <line x1="192" y1="40" x2="340" y2="40" stroke="#059669" strokeWidth="1.2" markerEnd="url(#arrow-green)" />
            <line x1="192" y1="36" x2="192" y2="44" stroke="#059669" strokeWidth="1" />
            <line x1="340" y1="36" x2="340" y2="44" stroke="#059669" strokeWidth="1" />
            <rect x="235" y="32" width="65" height="12" rx="2" fill="#ECFDF5" stroke="#059669" strokeWidth="0.6" />
            <text x="240" y="41" fill="#059669" fontSize="7.5" fontWeight="bold" fontFamily="monospace">
              ETT: {data.effectiveTopTube} cm
            </text>

            {/* DIMENSION 3: SADDLE DROP */}
            <line x1="180" y1="22" x2="420" y2="22" stroke="#7C3AED" strokeWidth="0.8" strokeDasharray="2 2" />
            <line x1="372" y1="36" x2="420" y2="36" stroke="#7C3AED" strokeWidth="0.8" strokeDasharray="2 2" />
            <line x1="412" y1="22" x2="412" y2="36" stroke="#7C3AED" strokeWidth="1.2" markerEnd="url(#arrow-purple)" />
            <rect x="418" y="24" width="70" height="12" rx="2" fill="#F5F3FF" stroke="#7C3AED" strokeWidth="0.6" />
            <text x="422" y="33" fill="#7C3AED" fontSize="7" fontWeight="bold" fontFamily="monospace">
              落差: {data.saddleDrop} cm
            </text>

            {/* DIMENSION 4: REACH & STACK INDICATORS */}
            <line x1="215" y1="104" x2="215" y2="44" stroke="#94A3B8" strokeWidth="0.7" strokeDasharray="2 2" />
            <line x1="215" y1="44" x2="340" y2="44" stroke="#94A3B8" strokeWidth="0.7" strokeDasharray="2 2" />
            <text x="235" y="55" fill="#64748B" fontSize="6.5" fontFamily="monospace">
              REACH: ~{data.estimatedReach}mm | STACK: ~{data.estimatedStack}mm
            </text>
          </svg>
        </div>
      </div>

      {/* 6. Section 04: Workshop Protocol */}
      <div className="space-y-1">
        <div className="flex items-center justify-between border-b border-slate-200 pb-0.5">
          <span className="text-[10px] font-mono font-bold tracking-wider text-slate-800 uppercase flex items-center gap-1">
            <span className="text-slate-400">04 //</span> 车间施工调校与初骑备忘
          </span>
          <span className="text-[9px] font-mono text-slate-400">CHECKLIST</span>
        </div>
        <div className="border border-slate-200 rounded p-1.5 bg-white text-[9px] text-slate-600 space-y-1 font-mono">
          <div className="flex items-start gap-1.5">
            <span className="text-slate-900 font-bold shrink-0">[1] 锁片轴心对齐：</span>
            <span>锁片中心轴线必须精密对齐脚掌第 1 与第 5 跖骨突起连线中点，避免跟腱张力过大及足底局部压迫。</span>
          </div>
          <div className="flex items-start gap-1.5">
            <span className="text-slate-900 font-bold shrink-0">[2] 动态膝关节角度：</span>
            <span>踏频处于下死点（BDC 6点钟方向）时，受试者膝关节屈曲角保持在 25°~35°，盆骨无左右倾斜代偿。</span>
          </div>
          <div className="flex items-start gap-1.5">
            <span className="text-slate-900 font-bold shrink-0">[3] 舵管垫圈安全冗余：</span>
            <span>新车把立下方建议保留 15~20mm 调校垫圈，待完成 200~500KM 身体适应与核心稳定性建立后再行最终截管。</span>
          </div>
        </div>
      </div>

      {/* 7. Section 05: Signatures & Certification Seal */}
      <div className="pt-2 border-t border-slate-900 flex items-center justify-between text-[9px] font-mono">
        <div className="space-y-2">
          <div className="flex items-center gap-4">
            <div>
              <span className="text-slate-400 block text-[8px] uppercase">技师签章</span>
              <div className="font-bold text-slate-900 border-b border-slate-400 pb-0.5 min-w-[120px]">{fitterName}</div>
            </div>
            <div>
              <span className="text-slate-400 block text-[8px] uppercase">车手确认</span>
              <div className="font-bold text-slate-900 border-b border-slate-400 pb-0.5 min-w-[120px]">{riderName}</div>
            </div>
          </div>
          <div className="text-slate-400 text-[8px]">
            WARRANTY: 30-DAY / 500KM COMPLIMENTARY RE-FIT & FINE-TUNING SUPPORT
          </div>
        </div>

        {/* Circular Engineering Seal */}
        <div className="w-16 h-16 rounded-full border-2 border-slate-800 flex flex-col items-center justify-center text-center p-1 relative rotate-[-6deg] shrink-0 opacity-85">
          <div className="text-[6px] font-bold tracking-tighter text-slate-700 uppercase">YOLOCYCLING PRO</div>
          <Award className="w-4 h-4 text-slate-900 my-0.5" />
          <div className="text-[5px] font-mono tracking-widest text-slate-600">VERIFIED FIT</div>
          <div className="text-[5px] text-slate-500 font-mono">2026</div>
        </div>
      </div>

      {/* 8. Micro Footer Watermark */}
      <div className="text-center pt-1 text-[8px] text-slate-400 font-mono tracking-wider border-t border-slate-100">
        YOLOCYCLING PRO BIOMECHANICAL SUITE · COMPUTED VIA SCIENTIFIC CAD MOTOR DYNAMICS · ALL RIGHTS RESERVED
      </div>
    </div>
  );
};

export const FittingWorkOrderModal: React.FC<FittingWorkOrderModalProps> = ({
  isOpen,
  onClose,
  initialRiderName = '车手客户',
  initialBikeModel = '气动碟刹公路车',
  data,
}) => {
  const todayStr = new Date().toISOString().split('T')[0];
  const [riderName, setRiderName] = useState<string>(initialRiderName);
  const [fitterName, setFitterName] = useState<string>('YoloCycling 认证 Fitter');
  const [bikeModel, setBikeModel] = useState<string>(initialBikeModel);
  const [orderDate, setOrderDate] = useState<string>(todayStr);
  const [orderNo] = useState<string>(() => `SPEC-YLC-${Date.now().toString().slice(-6)}`);

  React.useEffect(() => {
    if (initialBikeModel) setBikeModel(initialBikeModel);
  }, [initialBikeModel]);

  React.useEffect(() => {
    if (initialRiderName) setRiderName(initialRiderName);
  }, [initialRiderName]);

  const { sheetStyle, handlers: swipeHandlers } = useSwipeToDismiss({ onClose });

  React.useEffect(() => {
    return () => {
      document.body.classList.remove('is-printing-work-order');
    };
  }, []);

  const handlePrint = () => {
    document.body.classList.add('is-printing-work-order');
    const cleanup = () => {
      document.body.classList.remove('is-printing-work-order');
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup, { once: true });

    // Allow DOM repaint and layout pass before print dialog blocks thread
    requestAnimationFrame(() => {
      setTimeout(() => {
        window.print();
        // Safe generous fallback cleanup timeout (60s instead of 2.5s)
        setTimeout(cleanup, 60000);
      }, 80);
    });
  };

  const ridingStyleName =
    data.ridingStyle === 'racing'
      ? '竞技激进'
      : data.ridingStyle === 'endurance'
      ? '长途耐力'
      : '舒适巡航';

  const sheetProps: FittingSheetContentProps = {
    riderName,
    fitterName,
    bikeModel,
    orderDate,
    orderNo,
    ridingStyleName,
    data,
  };

  if (!isOpen) return null;

  const modalContent = (
    <>
      {/* Dual Platform Modal (matching ShareCardModal iOS bottom sheet / macOS centered panel) */}
      <div
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
        className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 dark:bg-black/75 backdrop-blur-2xl animate-in fade-in duration-200 no-print"
      >
        <div
          style={sheetStyle}
          className="relative w-full max-w-4xl max-h-[92vh] sm:max-h-[90vh] flex flex-col bg-white dark:bg-[#1C1C1E] border-t sm:border border-slate-200/80 dark:border-white/10 rounded-t-[28px] sm:rounded-2xl shadow-ios-popover overflow-hidden text-slate-900 dark:text-white isolate animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-0"
        >
          {/* iOS Presentation Detent Drag Indicator (Mobile only) */}
          <div
            {...swipeHandlers}
            className="sm:hidden w-full pt-2.5 pb-2 flex items-center justify-center touch-none cursor-grab active:cursor-grabbing select-none"
          >
            <div className="w-10 h-1.5 rounded-full bg-black/20 dark:bg-white/30" />
          </div>

          {/* Ambient Top Glow */}
          <div className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 w-96 h-40 bg-ios-purple/15 dark:bg-ios-purple/25 blur-3xl rounded-full" />

          {/* Modal Header */}
          <div
            {...swipeHandlers}
            className="relative z-10 flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b border-slate-200/80 dark:border-white/10 bg-white/95 dark:bg-[#1C1C1E]/90 backdrop-blur-md select-none touch-none sm:touch-auto"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-ios-purple/10 dark:bg-ios-purple/15 border border-ios-purple/20 text-ios-purple flex items-center justify-center">
                <Compass className="w-4 h-4 text-ios-purple" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight">
                  公路车 Fitting 设定工单
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  A4 国际标准单页蓝图 · 适合车店专业施工与车手留档
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 text-slate-500 hover:text-slate-800 dark:text-slate-300 dark:hover:text-white flex items-center justify-center transition apple-touch"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Streamlined Meta Info Toolbar */}
          <div className="relative z-10 px-4 sm:px-5 py-2.5 bg-slate-50/80 dark:bg-black/20 border-b border-slate-200/80 dark:border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs shrink-0">
            <div>
              <label className="text-[10px] font-mono text-slate-500 dark:text-slate-400 block mb-0.5">车手姓名</label>
              <input
                type="text"
                value={riderName}
                onChange={(e) => setRiderName(e.target.value)}
                className="w-full h-7 px-2 rounded-lg bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-ios-blue"
              />
            </div>
            <div>
              <label className="text-[10px] font-mono text-slate-500 dark:text-slate-400 block mb-0.5">认证技师</label>
              <input
                type="text"
                value={fitterName}
                onChange={(e) => setFitterName(e.target.value)}
                className="w-full h-7 px-2 rounded-lg bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-ios-blue"
              />
            </div>
            <div>
              <label className="text-[10px] font-mono text-slate-500 dark:text-slate-400 block mb-0.5">车架型号</label>
              <input
                type="text"
                value={bikeModel}
                onChange={(e) => setBikeModel(e.target.value)}
                className="w-full h-7 px-2 rounded-lg bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-ios-blue"
              />
            </div>
            <div>
              <label className="text-[10px] font-mono text-slate-500 dark:text-slate-400 block mb-0.5">拟合日期</label>
              <input
                type="date"
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
                className="w-full h-7 px-2 rounded-lg bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-ios-blue font-mono"
              />
            </div>
          </div>

          {/* Architectural Paper Preview Canvas Body */}
          <div className="relative z-10 flex-1 overflow-y-auto p-4 sm:p-5 flex flex-col items-center justify-start bg-slate-100/80 dark:bg-black/40">
            <div className="w-full max-w-[210mm] bg-white text-slate-900 shadow-ios-popover border border-slate-200/80 dark:border-white/10 rounded-xl p-5 sm:p-7">
              <FittingSheetContent {...sheetProps} />
            </div>
          </div>

          {/* Modal Footer Actions */}
          <div className="relative z-10 p-3.5 sm:p-4 border-t border-slate-200/80 dark:border-white/10 bg-white/95 dark:bg-[#1C1C1E]/95 flex flex-wrap items-center justify-between gap-2.5">
            <div className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:flex items-center gap-1.5">
              <span>* 系统将自动以纯净 A4 单页送印 · 支持直接打印或导出标准 PDF</span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onClose}
                className="apple-touch flex-1 sm:flex-initial h-9 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 text-xs font-semibold transition active:scale-95 flex items-center justify-center"
              >
                关闭
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="apple-touch flex-1 sm:flex-initial h-9 px-5 rounded-xl bg-ios-blue hover:bg-ios-blue/90 text-white font-semibold text-xs shadow-ios-sm transition active:scale-95 flex items-center justify-center gap-2"
              >
                <Printer className="w-4 h-4" />
                <span>打印 A4 工单</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Top-Level Portal strictly for printing, isolated from modal scroll/layout context */}
      <div id="print-work-order-portal" aria-hidden="true" className="w-full bg-white text-slate-900 p-4 print:p-0">
        <FittingSheetContent {...sheetProps} />
      </div>
    </>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};
