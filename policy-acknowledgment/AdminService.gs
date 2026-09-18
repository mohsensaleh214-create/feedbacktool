/**
 * Aggregates for the admin dashboard: overall completion, per-policy
 * completion, and a per-staff breakdown with how long each outstanding
 * policy has been outstanding. Admin-gated by CONFIG.ADMIN_EMAILS.
 */
function getAdminDashboardData() {
  var email = Session.getActiveUser().getEmail();
  if (!isAdmin_(email)) throw new Error('Admin only.');

  var policies = getPolicyConfig_();
  var ackLog = getAckLog_();
  var staff = getStaffDirectory_();

  function isCurrentlyComplete(staffEmail, policy) {
    return ackLog.some(function(a) {
      return a.StaffEmail === staffEmail && a.PolicyID === policy.PolicyID && String(a.VersionHash) === String(policy.CurrentVersionHash);
    });
  }

  var byPolicy = policies.map(function(p) {
    var completed = staff.filter(function(s) { return isCurrentlyComplete(s.StaffEmail, p); }).length;
    return {
      policyId: p.PolicyID,
      name: p.PolicyName,
      tier: Number(p.Tier),
      totalStaff: staff.length,
      completed: completed,
      completionRate: staff.length ? Math.round((completed / staff.length) * 100) : 0
    };
  });

  var byStaff = staff.map(function(s) {
    var completedPolicies = policies.filter(function(p) { return isCurrentlyComplete(s.StaffEmail, p); });
    var outstanding = policies.filter(function(p) { return !isCurrentlyComplete(s.StaffEmail, p); })
      .map(function(p) {
        return { policyId: p.PolicyID, name: p.PolicyName, daysOutstanding: daysOutstandingFor_(s.StaffEmail, p.PolicyID, ackLog) };
      });

    return {
      email: s.StaffEmail,
      name: s.StaffName,
      department: s.Department || '',
      campus: s.Campus || '',
      totalPolicies: policies.length,
      completed: completedPolicies.length,
      completionRate: policies.length ? Math.round((completedPolicies.length / policies.length) * 100) : 0,
      outstanding: outstanding
    };
  });

  var overallCompletion = byStaff.length
    ? Math.round(byStaff.reduce(function(sum, s) { return sum + s.completionRate; }, 0) / byStaff.length)
    : 0;
  var totalOutstanding = byStaff.reduce(function(sum, s) { return sum + s.outstanding.length; }, 0);

  return {
    summary: {
      overallCompletion: overallCompletion,
      totalOutstanding: totalOutstanding,
      staffCount: staff.length,
      policyCount: policies.length
    },
    byPolicy: byPolicy,
    byStaff: byStaff
  };
}
