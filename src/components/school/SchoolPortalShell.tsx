import React, { useState } from "react";
import {
  Menu, X, LogOut, ChevronDown, Building2, Bell,
} from "lucide-react";
import MasterMindsLogo from "@/components/brand/MasterMindsLogo";
import { useUser } from "@/context/UserContext";
import { SchoolRole, useSchoolPortal } from "@/context/SchoolPortalContext";

export type SchoolNavItem = {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

type PortalRole = SchoolRole | "super_admin";

const roleLabels: Record<PortalRole, string> = {
  manager: "School Manager",
  admin: "School Admin",
  teacher: "Teacher",
  finance: "Finance",
  parent: "Parent",
  student: "Student",
  super_admin: "Super Admin",
};

type SchoolPortalShellProps = {
  role: PortalRole;
  title: string;
  navItems: SchoolNavItem[];
  activeItem: string;
  onNavigate: (id: string) => void;
  children: React.ReactNode;
  headerActions?: React.ReactNode;
  roleLabelOverride?: string;
};

export default function SchoolPortalShell({
  role, title, navItems, activeItem, onNavigate, children, headerActions, roleLabelOverride,
}: SchoolPortalShellProps) {
  const { user, logout } = useUser();
  const { memberships, activeMembership, activeSchool, switchSchool } = useSchoolPortal();
  const [mobileOpen, setMobileOpen] = useState(false);
  const roleMemberships = role === "super_admin" ? [] : memberships.filter((membership) => membership.school_role === role);
  const initials = (user?.name || "User").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();

  const renderNavigation = (mobile = false) => (
    <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-5">
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = activeItem === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              onNavigate(item.id);
              if (mobile) setMobileOpen(false);
            }}
            className={[
              "group flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-medium transition-colors",
              active
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-300 hover:bg-slate-800 hover:text-white",
            ].join(" ")}
            aria-current={active ? "page" : undefined}
          >
            <Icon className="h-[18px] w-[18px] shrink-0" />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );

  const sidebar = (mobile = false) => (
    <div className="flex h-full flex-col bg-[#0A1526] text-white">
      <div className="border-b border-white/10 px-5 py-5">
        <MasterMindsLogo variant="light" layout="horizontal" className="gap-3" symbolClassName="h-9 w-9" />
        <div className="mt-5 border-t border-white/10 pt-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-blue-300">
            <Building2 className="h-3.5 w-3.5" />
            School workspace
          </div>
          <p className="mt-2 truncate text-sm font-semibold text-white">{role === "super_admin" ? "All schools" : activeSchool?.name || "Loading school"}</p>
          <p className="mt-1 text-xs text-slate-400">{role === "super_admin" ? "Platform-wide oversight" : activeSchool?.school_code || " "}</p>
          <span className="mt-3 inline-flex rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-slate-200">
            {roleLabelOverride || roleLabels[role]}
          </span>
        </div>
      </div>
      {renderNavigation(mobile)}
      <div className="border-t border-white/10 p-3">
        <div className="mb-3 flex items-center gap-3 rounded-lg px-2 py-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">{initials}</div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{user?.name || "Account"}</p>
            <p className="truncate text-xs text-slate-400">{user?.username ? `@${user.username}` : (roleLabelOverride || roleLabels[role])}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void logout()}
          className="flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
        >
          <LogOut className="h-[18px] w-[18px]" />
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[252px] border-r border-slate-800 lg:block">
        {sidebar()}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-slate-950/60"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-[min(86vw,300px)] shadow-2xl">
            <div className="absolute right-3 top-3 z-10">
              <button type="button" onClick={() => setMobileOpen(false)} className="rounded-md p-2 text-white hover:bg-white/10" aria-label="Close menu">
                <X className="h-5 w-5" />
              </button>
            </div>
            {sidebar(true)}
          </aside>
        </div>
      )}

      <div className="min-h-screen lg:pl-[252px]">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              className="rounded-lg border border-slate-200 p-2 text-slate-700 hover:bg-slate-50 lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold text-slate-900 sm:text-lg">{title}</h1>
              <p className="hidden truncate text-xs text-slate-500 sm:block">{role === "super_admin" ? "Platform-wide school oversight" : activeSchool?.name || "School workspace"}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            {headerActions}
            {roleMemberships.length > 1 && (
              <label className="hidden items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 md:flex">
                <span className="sr-only">Switch school</span>
                <Building2 className="h-4 w-4" />
                <select
                  value={activeMembership?.id || ""}
                  onChange={(event) => switchSchool(event.target.value)}
                  className="max-w-[180px] bg-transparent text-sm font-medium text-slate-700 outline-none"
                >
                  {roleMemberships.map((membership) => (
                    <option key={membership.id} value={membership.id}>{membership.school.name}</option>
                  ))}
                </select>
                <ChevronDown className="h-3.5 w-3.5" />
              </label>
            )}
            <div className="hidden h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 sm:flex">
              <Bell className="h-4 w-4" />
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">{initials}</div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1600px] px-4 py-5 sm:px-6 sm:py-7">
          {activeSchool && activeMembership ? children : (
            <div className="rounded-lg border border-slate-200 bg-white px-5 py-8 text-sm text-slate-600">
              This account does not have an active school membership for this portal.
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
