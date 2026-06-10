import type { Permission } from "@/lib/auth/rbac";

export interface NavItem {
  href: string;
  label: string;
  icon: string; // simple emoji/glyph to avoid an icon dependency
  permission: Permission;
}

/**
 * Sidebar items; each is filtered by the viewer's RBAC permissions.
 *
 * Resulting visibility:
 *   admin   → Dashboard, Patients, Reports, Admin Panel, User Management
 *   encoder → Dashboard, Patients (+ Add Patient button)
 *   analyst → Dashboard, Patients (read-only), Reports
 *   viewer  → Dashboard only
 */
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "▤", permission: "dashboard:read" },
  { href: "/patients", label: "Patients", icon: "☰", permission: "patient:read" },
  { href: "/reports", label: "Reports", icon: "◷", permission: "page:reports" },
  { href: "/admin", label: "Admin Panel", icon: "⚙", permission: "page:admin" },
  { href: "/admin/users", label: "User Management", icon: "◐", permission: "user:manage" },
];
