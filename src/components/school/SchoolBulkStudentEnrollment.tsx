import React, { useState } from "react";
import { Copy, Plus, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  SchoolPanel, SchoolField, SchoolPrimaryButton, SchoolSecondaryButton,
  schoolInputClass, schoolSelectClass,
} from "@/components/school/SchoolPortalPrimitives";

type StudentRow = {
  key: number;
  name: string;
  section_id: string;
  age: string;
  parent_membership_ids: string[];
};

type Props = {
  schoolId: string;
  sections: any[];
  parents: any[];
  memberName: (membershipId: string) => string;
  onCreated: () => Promise<void> | void;
};

let nextKey = 1;
const newRow = (): StudentRow => ({ key: nextKey++, name: "", section_id: "", age: "12", parent_membership_ids: [] });

export default function SchoolBulkStudentEnrollment({ schoolId, sections, parents, memberName, onCreated }: Props) {
  const [rows, setRows] = useState<StudentRow[]>([newRow()]);
  const [loading, setLoading] = useState(false);
  const [credentials, setCredentials] = useState<any[]>([]);
  const [failed, setFailed] = useState<any[]>([]);

  const updateRow = (key: number, patch: Partial<StudentRow>) => {
    setRows((current) => current.map((row) => row.key === key ? { ...row, ...patch } : row));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setCredentials([]);
    setFailed([]);
    if (!rows.length || rows.length > 100) return toast.error("Enroll between 1 and 100 students at a time.");
    for (const row of rows) {
      if (!row.name.trim() || !row.section_id || !Number.isInteger(Number(row.age)) || Number(row.age) < 3 || Number(row.age) > 120) {
        return toast.error("Every student needs a name, section, and valid age.");
      }
    }

    const accounts = rows.map((row) => {
      const section = sections.find((item) => item.id === row.section_id);
      return {
        name: row.name.trim(),
        grade_label: section?.grade_label,
        section_id: row.section_id,
        age: Number(row.age),
        parent_membership_ids: row.parent_membership_ids,
      };
    });

    setLoading(true);
    const { data, error } = await supabase.functions.invoke("school-provision-account", {
      body: { action: "create_accounts", school_id: schoolId, role: "student", accounts },
    });
    setLoading(false);

    if (error) {
      toast.error(error.message || "Student enrollment failed.");
      return;
    }
    const created = data?.created ?? [];
    const errors = data?.failed ?? [];
    setCredentials(created);
    setFailed(errors);
    if (created.length) {
      toast.success(`${created.length} student account(s) created.`);
      setRows([newRow()]);
      await onCreated();
    }
    if (errors.length) toast.error(`${errors.length} student account(s) could not be created.`);
  };

  const copyCredentials = async () => {
    const text = credentials.map((item) => `${item.username}\t${item.initial_password}`).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Credentials copied. Deliver each student's details privately.");
    } catch {
      toast.error("Clipboard is unavailable. Copy the credentials from the list.");
    }
  };

  return (
    <SchoolPanel
      title="Bulk student enrollment"
      description="Enter multiple students in one operation. Each student receives a school-coded username and a unique grade-based ID."
      action={<span className="text-xs font-medium text-slate-500">{rows.length}/100 students</span>}
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-3">
          {rows.map((row, index) => (
            <div key={row.key} className="rounded-lg border border-slate-200 p-3">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Student {index + 1}</p>
                {rows.length > 1 && <button type="button" onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))} className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={`Remove student ${index + 1}`}><Trash2 className="h-4 w-4" /></button>}
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <SchoolField label="Full name"><input className={schoolInputClass} value={row.name} onChange={(event) => updateRow(row.key, { name: event.target.value })} placeholder="Student full name" /></SchoolField>
                <SchoolField label="Grade and section"><select className={schoolSelectClass} value={row.section_id} onChange={(event) => updateRow(row.key, { section_id: event.target.value })}><option value="">Choose section</option>{sections.map((section) => <option key={section.id} value={section.id}>{section.grade_label} {section.section_name}</option>)}</select></SchoolField>
                <SchoolField label="Age at enrollment"><input type="number" min="3" max="120" className={schoolInputClass} value={row.age} onChange={(event) => updateRow(row.key, { age: event.target.value })} /></SchoolField>
                <SchoolField label="Linked parent accounts"><select multiple className="min-h-10 w-full rounded-md border border-slate-200 bg-white p-2 text-xs" value={row.parent_membership_ids} onChange={(event) => updateRow(row.key, { parent_membership_ids: Array.from(event.target.selectedOptions).map((option) => option.value) })}><option value="" disabled>Select one or more parents</option>{parents.map((parent) => <option key={parent.id} value={parent.id}>{memberName(parent.id)}</option>)}</select></SchoolField>
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SchoolSecondaryButton onClick={() => setRows((current) => current.length < 100 ? [...current, newRow()] : current)} disabled={rows.length >= 100}><Plus className="mr-2 h-4 w-4" />Add student</SchoolSecondaryButton>
          <SchoolPrimaryButton type="submit" disabled={loading || !sections.length}><UserPlus className="mr-2 h-4 w-4" />{loading ? "Creating accounts…" : `Create ${rows.length} student account(s)`}</SchoolPrimaryButton>
        </div>
      </form>

      {credentials.length > 0 && (
        <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div><p className="text-sm font-semibold text-emerald-900">New student credentials</p><p className="mt-1 text-xs text-emerald-800">These initial passwords are shown once. Deliver each student's credentials privately.</p></div>
            <button type="button" onClick={() => void copyCredentials()} className="inline-flex min-h-9 items-center gap-2 rounded-md border border-emerald-300 bg-white px-3 text-xs font-semibold text-emerald-800"><Copy className="h-3.5 w-3.5" />Copy all</button>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {credentials.map((item, index) => <div key={index} className="rounded-md border border-emerald-200 bg-white p-3 text-xs"><p className="font-semibold text-slate-800">{item.name || `Student ${index + 1}`}</p><p className="mt-1 text-slate-600"><span className="font-semibold">Username:</span> {item.username}</p><p className="mt-1 break-all text-slate-600"><span className="font-semibold">Initial password:</span> {item.initial_password}</p></div>)}
          </div>
        </div>
      )}

      {failed.length > 0 && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm font-semibold text-amber-900">Some accounts were not created</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-amber-900">{failed.map((item, index) => <li key={index}>{item.name || `Student ${index + 1}`}: {item.message}</li>)}</ul>
        </div>
      )}
    </SchoolPanel>
  );
}
