import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

type SchoolRole = "manager" | "admin" | "teacher" | "finance" | "parent" | "student";
type AccountInput = {
  name: string;
  grade_label?: string;
  age?: number;
  section_id?: string;
  parent_membership_ids?: string[];
  student_membership_ids?: string[];
  assignments?: Array<{ section_id: string; subject_name: string; assignment_kind?: "subject" | "homeroom" }>;
};

const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
const randomString = (length: number) => {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
};
const randomDigits = (length: number) => {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (byte) => String(byte % 10)).join("");
};
const normalize = (value: unknown) => typeof value === "string" ? value.trim() : "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let createdUserId: string | null = null;
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Authentication required" }, 401);

    const url = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !anonKey || !serviceRoleKey) return json({ error: "Account service unavailable" }, 503);

    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) return json({ error: "Invalid or expired session" }, 401);
    const actorId = authData.user.id;

    const admin = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const payload = await req.json();
    const action = normalize(payload?.action);

    const { data: globalRoles, error: rolesError } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", actorId);
    if (rolesError) return json({ error: "Unable to verify account permissions" }, 503);
    const isExtremeAdmin = (globalRoles ?? []).some((row: { role: string }) => row.role === "extreme_admin");
    const isSuperAdmin = (globalRoles ?? []).some((row: { role: string }) => row.role === "super_admin");
    const canProvisionNetwork = isExtremeAdmin || isSuperAdmin;

    const createAuthAccount = async (name: string, username: string, grade?: string, age?: number) => {
      const password = randomString(18);
      const email = `${crypto.randomUUID()}@accounts.masterminds.app`;
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          account_type: "school",
          name: name.trim(),
          username: username.toLowerCase(),
          ...(grade ? { grade } : {}),
          ...(age !== undefined ? { age } : {}),
          must_change_password: true,
        },
      });
      if (error || !data.user) throw new Error("Could not create the account");
      createdUserId = data.user.id;
      return { userId: data.user.id, password };
    };

    const uniqueStaffUsername = async (prefix = "u") => {
      for (let attempt = 0; attempt < 12; attempt++) {
        const candidate = (prefix + randomDigits(10)).toLowerCase();
        const { data, error } = await admin.from("profiles").select("id").ilike("username", candidate).maybeSingle();
        if (error) throw new Error("Could not check username availability");
        if (!data) return candidate;
      }
      throw new Error("Could not generate a unique username");
    };

    const attachAccount = async (
      schoolId: string,
      role: SchoolRole,
      userId: string,
      username: string,
      input: AccountInput,
      studentNumber?: number,
    ) => {
      const { data, error } = await admin.rpc("school_attach_account", {
        p_actor_id: actorId,
        p_school_id: schoolId,
        p_user_id: userId,
        p_school_role: role,
        p_school_username: username,
        p_grade_label: input.grade_label ?? null,
        p_age_at_enrollment: input.age ?? null,
        p_section_id: input.section_id ?? null,
        p_student_number: studentNumber ?? null,
        p_parent_membership_ids: [...new Set(input.parent_membership_ids ?? [])],
        p_student_membership_ids: [...new Set(input.student_membership_ids ?? [])],
        p_teacher_assignments: input.assignments ?? [],
      });
      if (error || !data) throw new Error(error?.message || "Could not attach the account to the school");
      return data as string;
    };

    if (action === "create_school") {
      if (!canProvisionNetwork) return json({ error: "Only the Super Admin or Extreme Admin can create schools and Managers" }, 403);
      const name = normalize(payload?.school?.name);
      const schoolCode = normalize(payload?.school?.school_code).toUpperCase();
      const managerName = normalize(payload?.manager?.name);
      if (name.length < 2 || name.length > 160 || !/^[A-Z0-9]{2,8}$/.test(schoolCode) || managerName.length < 2) {
        return json({ error: "School name, school code, and Manager name are required" }, 400);
      }
      const { data: network, error: networkError } = await admin
        .from("school_networks")
        .select("id")
        .eq("network_key", true)
        .single();
      if (networkError || !network) return json({ error: "School network is unavailable" }, 503);

      const { data: school, error: schoolError } = await admin
        .from("schools")
        .insert({ name, school_code: schoolCode, network_id: network.id, created_by: actorId })
        .select("id,name,school_code")
        .single();
      if (schoolError || !school) return json({ error: "Could not create the school" }, 409);
      await admin.from("admin_audit_logs").insert({
        actor_id: actorId,
        action: "school_registered",
        target_type: "school",
        target_id: school.id,
        metadata: { school_code: schoolCode, network_id: network.id, manager_provisioned: true },
      });

      try {
        const username = await uniqueStaffUsername();
        const account = await createAuthAccount(managerName, username);
        const membershipId = await attachAccount(school.id, "manager", account.userId, username, { name: managerName });
        createdUserId = null;
        return json({
          school,
          manager: {
            membership_id: membershipId,
            username,
            initial_password: account.password,
            must_change_password: true,
          },
        }, 201);
      } catch (error) {
        if (createdUserId) await admin.auth.admin.deleteUser(createdUserId);
        await admin.from("schools").delete().eq("id", school.id);
        createdUserId = null;
        throw error;
      }
    }

    if (action === "create_accounts") {
      const schoolId = normalize(payload?.school_id);
      const role = normalize(payload?.role) as SchoolRole;
      const accounts = payload?.accounts as AccountInput[];
      const validRoles: SchoolRole[] = ["manager", "admin", "teacher", "finance", "parent", "student"];
      if (!schoolId || !validRoles.includes(role) || !Array.isArray(accounts) || accounts.length < 1 || accounts.length > 100) {
        return json({ error: "Provide a school, valid role, and between 1 and 100 accounts" }, 400);
      }
      if (role === "manager" && !canProvisionNetwork) {
        return json({ error: "Only the Super Admin or Extreme Admin can create a school Manager" }, 403);
      }
      if (role !== "manager" && !canProvisionNetwork) {
        const { data: membership, error } = await admin
          .from("school_memberships")
          .select("school_role")
          .eq("school_id", schoolId)
          .eq("user_id", actorId)
          .eq("status", "active")
          .in("school_role", ["manager", "admin"])
          .order("school_role", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (error || !membership) return json({ error: "Only this school's Manager or Admin can create its staff, parent, and student accounts" }, 403);
      }

      const { data: school, error: schoolError } = await admin
        .from("schools").select("id,school_code,status").eq("id", schoolId).maybeSingle();
      if (schoolError || !school || school.status !== "active") return json({ error: "School is unavailable" }, 404);

      const created: Array<Record<string, unknown>> = [];
      const failed: Array<{ index: number; message: string }> = [];

      for (let index = 0; index < accounts.length; index++) {
        const input = accounts[index];
        createdUserId = null;
        try {
          const name = normalize(input?.name);
          if (name.length < 2 || name.length > 160) throw new Error("A valid full name is required");

          let username = "";
          let studentNumber: number | undefined;
          if (role === "student") {
            const grade = normalize(input.grade_label);
            const age = Number(input.age);
            const sectionId = normalize(input.section_id);
            if (!grade || !Number.isInteger(age) || age < 3 || age > 120 || !sectionId) {
              throw new Error("Student name, grade, age, and section are required");
            }
            for (let attempt = 0; attempt < 12; attempt++) {
              const { data: number, error: numberError } = await userClient.rpc("school_next_student_number", {
                p_school_id: schoolId,
                p_grade_label: grade,
              });
              if (numberError || !number) throw new Error("Could not allocate a student ID");
              const candidateNumber = Number(number);
              const candidateUsername = `${school.school_code.toLowerCase()}/${candidateNumber}/${age}`;
              const { data: existingProfile, error: usernameError } = await admin
                .from("profiles")
                .select("id")
                .ilike("username", candidateUsername)
                .maybeSingle();
              if (usernameError) throw new Error("Could not verify student username availability");
              if (!existingProfile) {
                studentNumber = candidateNumber;
                username = candidateUsername;
                break;
              }
            }
            if (!username || !studentNumber) throw new Error("Could not generate a unique student username");
          } else if (role === "parent") {
            username = await uniqueStaffUsername("pa");
          } else {
            username = await uniqueStaffUsername();
          }

          const account = await createAuthAccount(name, username, role === "student" ? normalize(input.grade_label) : undefined, role === "student" ? Number(input.age) : undefined);
          const membershipId = await attachAccount(schoolId, role, account.userId, username, input, studentNumber);
          created.push({
            index,
            membership_id: membershipId,
            username,
            initial_password: account.password,
            role,
            ...(studentNumber ? { student_id: studentNumber } : {}),
            ...(role === "student" ? { grade: input.grade_label, age_at_enrollment: input.age } : {}),
          });
          createdUserId = null;
        } catch (error) {
          if (createdUserId) await admin.auth.admin.deleteUser(createdUserId);
          createdUserId = null;
          failed.push({ index, message: error instanceof Error ? error.message : "Account creation failed" });
        }
      }

      return json({ created, failed, total: accounts.length }, created.length > 0 ? 201 : 400);
    }

    if (action === "link_parent_students") {
      const parentMembershipId = normalize(payload?.parent_membership_id);
      const studentMembershipIds = Array.isArray(payload?.student_membership_ids)
        ? [...new Set(payload.student_membership_ids.map((id: unknown) => normalize(id)).filter(Boolean))]
        : [];
      if (!parentMembershipId || studentMembershipIds.length === 0 || studentMembershipIds.length > 100) {
        return json({ error: "Parent account and at least one student are required" }, 400);
      }
      const { data, error } = await admin.rpc("school_link_parent_students", {
        p_actor_id: actorId,
        p_parent_membership_id: parentMembershipId,
        p_student_membership_ids: studentMembershipIds,
      });
      if (error) return json({ error: "Could not update parent-child links" }, 400);
      return json({ linked: data });
    }

    if (action === "transfer_student" || action === "graduate_student") {
      const membershipId = normalize(payload?.membership_id);
      if (!membershipId) return json({ error: "Student membership is required" }, 400);
      const { data, error } = await userClient.rpc("school_deactivate_student_membership", {
        p_membership_id: membershipId,
        p_status: action === "transfer_student" ? "transferred" : "graduated",
        p_reason: normalize(payload?.reason) || null,
      });
      if (error || data !== true) return json({ error: "Could not update the student's school enrollment" }, 403);
      return json({ ok: true, status: action === "transfer_student" ? "transferred" : "graduated" });
    }

    return json({ error: "Unsupported account action" }, 400);
  } catch (error) {
    if (createdUserId) {
      const url = Deno.env.get("SUPABASE_URL");
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (url && serviceRoleKey) {
        const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
        await admin.auth.admin.deleteUser(createdUserId);
      }
    }
    console.error("School account operation failed:", error);
    return json({ error: error instanceof Error ? error.message : "School account operation failed" }, 500);
  }
});
