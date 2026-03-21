interface EnrollmentDashboardProps {
  summary: {
    total_members: number;
    additions: number;
    changes: number;
    terminations: number;
    members: any[];
  };
}

const maintenanceColors: Record<string, string> = {
  '021': 'badge-success',    // Addition
  '001': 'badge-info',       // Change
  '024': 'badge-error',      // Termination
  '025': 'badge-success',    // Reinstatement
  '026': 'badge-warning',    // Correction
};

export default function EnrollmentDashboard({ summary }: EnrollmentDashboardProps) {
  return (
    <div className="glass-card p-4 animate-fade-in">
      <h3 className="text-lg font-bold text-slate-100 mb-4 flex items-center gap-2">
        👤 834 Enrollment Dashboard
      </h3>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="bg-accent-blue/20 border border-accent-blue/30 rounded-xl p-4">
          <div className="text-xs text-slate-400 mb-1">Total Members</div>
          <div className="text-2xl font-bold text-accent-blue">{summary.total_members}</div>
        </div>
        <div className="bg-green/20 border border-green/30 rounded-xl p-4">
          <div className="text-xs text-slate-400 mb-1">Additions</div>
          <div className="text-2xl font-bold text-green">{summary.additions}</div>
        </div>
        <div className="bg-orange/20 border border-orange/30 rounded-xl p-4">
          <div className="text-xs text-slate-400 mb-1">Changes</div>
          <div className="text-2xl font-bold text-orange">{summary.changes}</div>
        </div>
        <div className="bg-red-accent/20 border border-red-accent/30 rounded-xl p-4">
          <div className="text-xs text-slate-400 mb-1">Terminations</div>
          <div className="text-2xl font-bold text-red-accent">{summary.terminations}</div>
        </div>
      </div>

      {/* Members Table */}
      <h4 className="text-sm font-semibold text-slate-300 mb-3">Member Details</h4>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left py-2 px-3 text-slate-400 font-medium">Name</th>
              <th className="text-left py-2 px-3 text-slate-400 font-medium">Type</th>
              <th className="text-left py-2 px-3 text-slate-400 font-medium">Action</th>
              <th className="text-left py-2 px-3 text-slate-400 font-medium">DOB</th>
              <th className="text-left py-2 px-3 text-slate-400 font-medium">Gender</th>
              <th className="text-left py-2 px-3 text-slate-400 font-medium">Coverage</th>
              <th className="text-left py-2 px-3 text-slate-400 font-medium">Location</th>
            </tr>
          </thead>
          <tbody>
            {summary.members.map((member, i) => (
              <tr key={i} className="border-b border-slate-800 hover:bg-white/5 transition-colors">
                <td className="py-2.5 px-3 font-medium text-slate-200">
                  {member.name || 'N/A'}
                </td>
                <td className="py-2.5 px-3">
                  <span className={`badge ${member.is_subscriber ? 'badge-info' : 'badge-warning'}`}>
                    {member.is_subscriber ? 'Subscriber' : 'Dependent'}
                  </span>
                </td>
                <td className="py-2.5 px-3">
                  <span className={`badge ${maintenanceColors[member.maintenance_type] || 'badge-info'}`}>
                    {member.maintenance_label}
                  </span>
                </td>
                <td className="py-2.5 px-3 font-mono text-slate-400 text-xs">
                  {member.dob ? `${member.dob.slice(0,4)}-${member.dob.slice(4,6)}-${member.dob.slice(6,8)}` : 'N/A'}
                </td>
                <td className="py-2.5 px-3 text-slate-400">{member.gender || 'N/A'}</td>
                <td className="py-2.5 px-3 text-teal font-medium">{member.coverage || 'N/A'}</td>
                <td className="py-2.5 px-3 text-slate-400 text-xs">
                  {member.city && member.state ? `${member.city}, ${member.state} ${member.zip}` : 'N/A'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
