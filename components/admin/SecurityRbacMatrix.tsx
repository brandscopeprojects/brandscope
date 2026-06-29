// SecurityRbacMatrix — the role × permission matrix for the Security Centre
// (Screen 28), read from rbac_config. Compact table: permissions down the rows,
// roles across the columns, ✓ (opportunity/good) where allowed and ✗
// (ink-faint, neutral) where denied. Tokens only — ✓ is the only semantic
// colour (a granted permission is a positive); a denial is neutral, never red.

import type { RbacMatrixVM } from "@/lib/data/internal-security";

function roleLabel(role: string): string {
  return role
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function permissionLabel(key: string): string {
  return key.replace(/[_.:]/g, " ").replace(/\s+/g, " ").trim();
}

export function SecurityRbacMatrix({ matrix }: { matrix: RbacMatrixVM }) {
  return (
    <div className="overflow-x-auto rounded-card border border-divider bg-card shadow-sh1">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-base-secondary">
            <th className="sticky left-0 z-10 bg-base-secondary px-4 py-2.5 text-left text-xs font-medium text-ink-secondary">
              Permission
            </th>
            {matrix.roles.map((role) => (
              <th
                key={role}
                className="px-4 py-2.5 text-center text-xs font-medium text-ink-secondary"
              >
                {roleLabel(role)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.permissions.map((perm) => (
            <tr key={perm} className="border-t border-divider">
              <td className="sticky left-0 z-10 bg-card px-4 py-2.5 text-left font-medium text-ink">
                {permissionLabel(perm)}
              </td>
              {matrix.roles.map((role) => {
                const allowed = matrix.allowed[role]?.[perm] ?? false;
                return (
                  <td key={role} className="px-4 py-2.5 text-center">
                    {allowed ? (
                      <span
                        className="font-mono text-sm font-semibold text-opportunity"
                        aria-label="Allowed"
                        title="Allowed"
                      >
                        ✓
                      </span>
                    ) : (
                      <span
                        className="font-mono text-sm text-ink-faint"
                        aria-label="Denied"
                        title="Denied"
                      >
                        ✗
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
