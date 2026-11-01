import React from 'react';
import { CheckCircle2, AlertTriangle, FileSpreadsheet, Loader2, X, Sparkles } from 'lucide-react';
import { BatchImportProgress } from '../../utils/batchFitImporter';

interface BatchImportModalProps {
  isOpen: boolean;
  progress: BatchImportProgress | null;
  onClose: () => void;
}

export const BatchImportModal: React.FC<BatchImportModalProps> = ({
  isOpen,
  progress,
  onClose
}) => {
  if (!isOpen || !progress) return null;

  const isDone = progress.currentStatus === 'done' || progress.percent === 100;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full sm:max-w-lg bg-white dark:bg-[#1C1C1E] border border-slate-200/80 dark:border-white/10 rounded-t-[28px] sm:rounded-2xl shadow-ios-popover overflow-hidden flex flex-col max-h-[90vh] animate-spring-up pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-0"
        role="dialog"
        aria-modal="true"
      >
        {/* iOS Drag Handle on Mobile */}
        <div className="sm:hidden pt-3 pb-1 flex justify-center">
          <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
        </div>

        {/* Modal Header */}
        <div className="px-4 sm:px-5 py-3.5 border-b border-slate-100 dark:border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-ios-blue/10 text-ios-blue flex items-center justify-center">
              {isDone ? (
                <CheckCircle2 className="w-4 h-4 text-ios-green" />
              ) : (
                <Loader2 className="w-4 h-4 animate-spin text-ios-blue" />
              )}
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                {isDone ? '多文件批量导入完成' : '正在批量导入骑行数据'}
              </h3>
              <p className="text-xs text-slate-500">
                {isDone
                  ? '所有活动已持久化至浏览器 Local-First 数据库'
                  : '正在并发解析 FIT / GPX / TCX 并提取关键功率矩阵'}
              </p>
            </div>
          </div>

          {isDone && (
            <button
              type="button"
              onClick={onClose}
              className="apple-touch w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-500 flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto">
          {/* Progress Bar & Percentage */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-slate-600 dark:text-slate-300 truncate max-w-[280px]">
                {progress.currentFileName || '准备中...'}
              </span>
              <span className="text-ios-blue font-bold tabular-nums">
                {progress.current} / {progress.total} ({progress.percent}%)
              </span>
            </div>

            <div className="w-full h-2.5 bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-ios-blue transition-all duration-300 ease-out rounded-full"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
          </div>

          {/* KPI Metrics Chips */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2.5 rounded-xl bg-ios-green/10 border border-ios-green/20">
              <div className="text-[11px] text-slate-500 font-medium">成功入库</div>
              <div className="text-lg font-bold text-ios-green tabular-nums">
                {progress.successfulCount}
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200/60 dark:border-white/10">
              <div className="text-[11px] text-slate-500 font-medium">已跳过重复</div>
              <div className="text-lg font-bold text-slate-700 dark:text-slate-300 tabular-nums">
                {progress.skippedCount}
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-ios-red/10 border border-ios-red/20">
              <div className="text-[11px] text-slate-500 font-medium">解析异常</div>
              <div className="text-lg font-bold text-ios-red tabular-nums">
                {progress.failedCount}
              </div>
            </div>
          </div>

          {/* Errors list if any */}
          {progress.errors.length > 0 && (
            <div className="p-3 rounded-xl bg-ios-red/10 border border-ios-red/20 space-y-1">
              <div className="text-xs font-bold text-ios-red flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>以下文件未能正常解析：</span>
              </div>
              <ul className="text-[11px] text-slate-600 dark:text-slate-300 space-y-0.5 max-h-24 overflow-y-auto">
                {progress.errors.map((e, idx) => (
                  <li key={idx} className="truncate">
                    {e.fileName}: {e.error}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Explanatory note */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 flex items-start gap-2 text-xs text-slate-500">
            <Sparkles className="w-4 h-4 text-ios-blue shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              数据已自动进行智能去重（基于起始精确秒级时间戳与距离校验）。所有功率时序与
              TSS 已自动载入 PMC 赛季时序引擎与 90 天最佳能力包络。
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 pt-0 border-t border-slate-100 dark:border-white/10 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={!isDone}
            className={`apple-touch h-9 w-full sm:w-auto px-5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition ${
              isDone
                ? 'bg-ios-blue text-white shadow-ios-sm hover:bg-ios-blue/90'
                : 'bg-slate-100 dark:bg-white/10 text-slate-400 cursor-not-allowed'
            }`}
          >
            {isDone ? '完成并查看分析' : '后台导入中...'}
          </button>
        </div>
      </div>
    </div>
  );
};
