interface EnrollmentDashboardProps {
  summary: {
    total_members: number;
    additions: number;
    changes: number;
    terminations: number;
    members: any[];
  };
}

const maintenanceBadgeClass: Record<string, string> = {
  '021': 'badge-success',
  '001': 'badge-info',
  '024': 'badge-error',
  '025': 'badge-success',
  '026': 'badge-warning',
};

export default function EnrollmentDashboard({ summary }: EnrollmentDashboardProps) {
  return (
    <section className="glass-card panel-card animate-fade-in">
      <div className="panel-header">
        <div>
          <h3 className="panel-title">834 enrollment dashboard</h3>
          <p className="panel-subtitle">Member changes grouped for quick eligibility and coverage review.</p>
        </div>
        <span className="badge badge-info">{summary.total_members} members</span>
      </div>

      <div className="stat-grid mb-5">
        <div className="summary-stat surface-panel">
          <span>Total members</span>
          <strong>{summary.total_members}</strong>
        </div>
        <div className="summary-stat surface-panel">
          <span>Additions</span>
          <strong className="text-green">{summary.additions}</strong>
        </div>
        <div className="summary-stat surface-panel">
          <span>Changes</span>
          <strong className="text-accent">{summary.changes}</strong>
        </div>
        <div className="summary-stat surface-panel">
          <span>Terminations</span>
          <strong className="text-red">{summary.terminations}</strong>
        </div>
      </div>

      <div className="table-wrap surface-panel">
        <table className="data-table text-sm">
          <thead>
            <tr>
              <th className="text-left">Name</th>
              <th className="text-left">Role</th>
              <th className="text-left">Action</th>
              <th className="text-left">DOB</th>
              <th className="text-left">Gender</th>
              <th className="text-left">Coverage</th>
              <th className="text-left">Location</th>
            </tr>
          </thead>
          <tbody>
            {summary.members.map((member, index) => (
              <tr key={index} className="table-row">
                <td className="font-medium text-slate-100">{member.name || 'N/A'}</td>
                <td>
                  <span className={`badge ${member.is_subscriber ? 'badge-info' : 'badge-warning'}`}>
                    {member.is_subscriber ? 'Subscriber' : 'Dependent'}
                  </span>
                </td>
                <td>
                  <span className={`badge ${maintenanceBadgeClass[member.maintenance_type] || 'badge-info'}`}>
                    {member.maintenance_label}
                  </span>
                </td>
                <td className="font-mono text-slate-400">
                  {member.dob ? `${member.dob.slice(0, 4)}-${member.dob.slice(4, 6)}-${member.dob.slice(6, 8)}` : 'N/A'}
                </td>
                <td className="text-slate-300">{member.gender || 'N/A'}</td>
                <td className="text-green">{member.coverage || 'N/A'}</td>
                <td className="text-slate-400">{member.city && member.state ? `${member.city}, ${member.state} ${member.zip}` : 'N/A'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
