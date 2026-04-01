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

const severityClass: Record<string, string> = {
  error: 'severity-error',
  warning: 'severity-warning',
  info: 'severity-info',
};

const severityBadgeClass: Record<string, string> = {
  error: 'badge-error',
  warning: 'badge-warning',
  info: 'badge-info',
};

export default function ValidationPanel({ validation, onFix, onFixAll }: ValidationPanelProps) {
  const [filter, setFilter] = useState<'all' | 'error' | 'warning' | 'info'>('all');

  const filtered = validation.errors.filter((error) => filter === 'all' || error.severity === filter);
  const fixableCount = validation.errors.filter((error) => error.fixable).length;

  return (
    <section className="glass-card panel-card">
      <div className="panel-header">
        <div>
          <h3 className="panel-title">
            Validation results
            <span className={`badge ${validation.is_valid ? 'badge-success' : 'badge-warning'}`}>
              {validation.is_valid ? 'Passing' : 'Needs attention'}
            </span>
          </h3>
          <p className="panel-subtitle">Filter findings, inspect context, and apply deterministic corrections.</p>
        </div>
        {fixableCount > 0 && (
          <button onClick={onFixAll} className="btn-success px-4 py-3 text-sm">
            Fix all ({fixableCount})
          </button>
        )}
      </div>

      <div className="stat-grid mb-5">
        <div className="summary-stat surface-panel">
          <span className="text-muted">Errors</span>
          <strong className="text-red">{validation.error_count}</strong>
          <small>Blocking issues</small>
        </div>
        <div className="summary-stat surface-panel">
          <span className="text-muted">Warnings</span>
          <strong className="text-amber">{validation.warning_count}</strong>
          <small>Review recommended</small>
        </div>
        <div className="summary-stat surface-panel">
          <span className="text-muted">Info</span>
          <strong className="text-accent">{validation.info_count}</strong>
          <small>Helpful notes</small>
        </div>
        <div className="summary-stat surface-panel">
          <span className="text-muted">Fixable</span>
          <strong className="text-green">{fixableCount}</strong>
          <small>Automatic candidates</small>
        </div>
      </div>

      <div className="toggle-group mb-5 w-fit flex-wrap">
        {(['all', 'error', 'warning', 'info'] as const).map((value) => (
          <button key={value} onClick={() => setFilter(value)} className={`toggle-button ${filter === value ? 'active' : ''}`}>
            {value === 'all' ? `All (${validation.errors.length})` : `${value[0].toUpperCase()}${value.slice(1)}`}
          </button>
        ))}
      </div>

      <div className="validation-list">
        {filtered.length === 0 ? (
          <div className="surface-panel empty-state">
            {validation.is_valid ? 'No validation issues found.' : 'No items match the selected filter.'}
          </div>
        ) : (
          filtered.map((err, index) => (
            <article key={`${err.error_id}-${index}`} className="validation-item">
              <div className="validation-item-head">
                <div className="flex gap-3">
                  <span className={`severity-dot ${severityClass[err.severity] || 'severity-info'}`} />
                  <div>
                    <div className="validation-meta">
                      <span className={`badge ${severityBadgeClass[err.severity] || 'badge-info'}`}>{err.severity}</span>
                      <span className="status-chip subtle">{err.error_id}</span>
                      <span className="status-chip subtle">{err.segment_id}{err.element_index > 0 ? String(err.element_index).padStart(2, '0') : ''}</span>
                      {err.loop_location && <span className="status-chip subtle">Loop {err.loop_location}</span>}
                      {err.line_number > 0 && <span className="status-chip subtle">Line {err.line_number}</span>}
                    </div>
                    <p className="mb-2 text-sm leading-6 text-slate-100">{err.message}</p>
                    {err.suggestion && <p className="text-sm leading-6 text-slate-400">Suggestion: {err.suggestion}</p>}
                  </div>
                </div>

                {err.fixable && (
                  <button onClick={() => onFix(err.error_id, err.fix_value)} className="btn-primary px-4 py-2 text-sm">
                    Apply fix
                  </button>
                )}
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
