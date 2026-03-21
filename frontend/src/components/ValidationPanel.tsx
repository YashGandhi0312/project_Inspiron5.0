import { useState } from 'react';

interface ValidationError {
  error_id: string;
  severity: string;
  segment_id: string;
  element_index: number;
  loop_location: string;
  line_number: number;
  message: string;
  suggestion: string;
  fixable: boolean;
  fix_value: string;
}

interface ValidationPanelProps {
  validation: {
    is_valid: boolean;
    error_count: number;
    warning_count: number;
    info_count: number;
    errors: ValidationError[];
  };
  onFix: (errorId: string, fixValue: string) => void;
  onFixAll: () => void;
}

export default function ValidationPanel({ validation, onFix, onFixAll }: ValidationPanelProps) {
  const [filter, setFilter] = useState<'all' | 'error' | 'warning' | 'info'>('all');

  const filtered = validation.errors.filter(
    (e) => filter === 'all' || e.severity === filter
  );

  const fixableCount = validation.errors.filter((e) => e.fixable).length;

  const severityIcon = (severity: string) => {
    switch (severity) {
      case 'error': return '🔴';
      case 'warning': return '🟡';
      case 'info': return '🔵';
      default: return '⚪';
    }
  };

  return (
    <div className="glass-card p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
          {validation.is_valid ? '✅' : '⚠️'} Validation Results
        </h3>
        {fixableCount > 0 && (
          <button onClick={onFixAll} className="btn-success text-sm py-2 px-4">
            ⚡ Fix All ({fixableCount})
          </button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-red-accent/10 border border-red-accent/20 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-red-accent">{validation.error_count}</div>
          <div className="text-xs text-slate-400">Errors</div>
        </div>
        <div className="bg-orange/10 border border-orange/20 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-orange">{validation.warning_count}</div>
          <div className="text-xs text-slate-400">Warnings</div>
        </div>
        <div className="bg-accent-blue/10 border border-accent-blue/20 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-accent-blue">{validation.info_count}</div>
          <div className="text-xs text-slate-400">Info</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 mb-4 bg-surface rounded-lg p-1">
        {(['all', 'error', 'warning', 'info'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex-1 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              filter === f ? 'bg-accent-blue text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            {f === 'all' ? `All (${validation.errors.length})` :
             f === 'error' ? `Errors (${validation.error_count})` :
             f === 'warning' ? `Warnings (${validation.warning_count})` :
             `Info (${validation.info_count})`}
          </button>
        ))}
      </div>

      {/* Error List */}
      <div className="max-h-[400px] overflow-y-auto space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            {validation.is_valid ? '🎉 No issues found!' : 'No items match the selected filter.'}
          </div>
        ) : (
          filtered.map((err, i) => (
            <div
              key={`${err.error_id}-${i}`}
              className="bg-surface/50 border border-slate-700/50 rounded-lg p-3 animate-fade-in hover:border-slate-600/50 transition-colors"
            >
              <div className="flex items-start gap-2">
                <span className="text-sm mt-0.5">{severityIcon(err.severity)}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs font-bold text-accent-blue">{err.error_id}</span>
                    <span className="font-mono text-xs text-slate-500">
                      {err.segment_id}{err.element_index > 0 ? `${String(err.element_index).padStart(2, '0')}` : ''}
                    </span>
                    {err.loop_location && (
                      <span className="text-xs text-slate-600">Loop {err.loop_location}</span>
                    )}
                    {err.line_number > 0 && (
                      <span className="text-xs text-slate-600">Line {err.line_number}</span>
                    )}
                  </div>
                  <p className="text-sm text-slate-300 mb-1">{err.message}</p>
                  {err.suggestion && (
                    <p className="text-xs text-teal">💡 {err.suggestion}</p>
                  )}
                </div>
                {err.fixable && (
                  <button
                    onClick={() => onFix(err.error_id, err.fix_value)}
                    className="btn-primary text-xs py-1 px-3 whitespace-nowrap"
                  >
                    🔧 Fix
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
