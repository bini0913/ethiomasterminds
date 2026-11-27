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
  student_usernames?: string[];
  assignments?: Array<{ section_id: string; subject_name: string; assignment_kind?: "subject" | "homeroom" }>;
  leadership_position?: string;
  division_scope?: string | null;
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
      if (role === "teacher" && input.leadership_position) {
        const { data, error } = await admin.rpc("school_attach_leadership_account", {
          p_actor_id: actorId,
          p_school_id: schoolId,
          p_user_id: userId,
          p_school_username: username,
          p_position: input.leadership_position,
          p_division_scope: input.division_scope ?? null,
        });
        if (error || !data) throw new Error(error?.message || "Could not attach the leadership account to the school");
        return data as string;
      }
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

    const resolveStudentMembershipIds = async (schoolId: string, rawUsernames: unknown): Promise<string[]> => {
      const usernames = Array.isArray(rawUsernames)
        ? [...new Set(rawUsernames.map((value: unknown) => normalize(value).toLowerCase()).filter(Boolean))]
        : [];
      if (usernames.length === 0) throw new Error("A parent account must be linked to at least one enrolled student username");
      const { data: studentProfiles, error: profilesError } = await admin
        .from("profiles")
        .select("id,username")
        .in("username", usernames);
      if (profilesError) throw new Error("Could not verify the linked student usernames");
      if ((studentProfiles ?? []).length !== usernames.length) {
        throw new Error("Every linked username must belong to an existing student in the selected school");
      }
      const { data: studentMemberships, error: membershipsError } = await admin
        .from("school_memberships")
        .select("id,user_id")
        .eq("school_id", schoolId)
        .eq("school_role", "student")
        .eq("status", "active")
        .in("user_id", (studentProfiles ?? []).map((profile: { id: string }) => profile.id));
      if (membershipsError) throw new Error("Could not verify active student enrollments");
      if ((studentMemberships ?? []).length !== usernames.length) {
        throw new Error("Every linked username must be actively enrolled as a student in the selected school");
      }
      return (studentMemberships ?? []).map((membership: { id: string }) => membership.id);
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
      try {
        const username = await uniqueStaffUsername();
        const account = await createAuthAccount(managerName, username);
        const membershipId = await attachAccount(school.id, "manager", account.userId, username, { name: managerName });
        const { error: managerAuditError } = await admin.from("admin_audit_logs").insert({
          actor_id: actorId,
          action: "school_manager_account_created",
          target_type: "school_membership",
          target_id: membershipId,
          metadata: { school_id: school.id, user_id: account.userId, username },
        });
        const { error: schoolAuditError } = await admin.from("admin_audit_logs").insert({
          actor_id: actorId,
          action: "school_registered",
          target_type: "school",
          target_id: school.id,
          metadata: {
            school_code: schoolCode,
            network_id: network.id,
            manager_provisioned: true,
            manager_user_id: account.userId,
            manager_membership_id: membershipId,
          },
        });
        createdUserId = null;
        return json({
          school: {
            ...school,
            audit_recorded: !schoolAuditError,
            ...(schoolAuditError ? { audit_warning: "School created but its registration audit event could not be written." } : {}),
          },
          manager: {
            membership_id: membershipId,
            username,
            initial_password: account.password,
            must_change_password: true,
            audit_recorded: !managerAuditError,
            ...(managerAuditError ? { audit_warning: "School Manager account created but its audit event could not be written." } : {}),
          },
        }, 201);
      } catch (error) {
        if (createdUserId) await admin.auth.admin.deleteUser(createdUserId);
        await admin.from("schools").delete().eq("id", school.id);
        createdUserId = null;
        throw error;
      }
    }

    if (action === "attach_existing_teacher") {
      const schoolId = normalize(payload?.school_id);
      const targetUsername = normalize(payload?.username).toLowerCase();
      if (!schoolId || targetUsername.length < 3 || targetUsername.length > 64) {
        return json({ error: "Provide a school and a valid existing username" }, 400);
      }

      const { data: actorMemberships, error: actorMembershipError } = await admin
        .from("school_memberships")
        .select("id,school_role")
        .eq("school_id", schoolId)
        .eq("user_id", actorId)
        .eq("status", "active")
        .eq("school_role", "manager");
      if (actorMembershipError) return json({ error: "Unable to verify this school's authority" }, 503);
      if (!(actorMemberships ?? []).length) return json({ error: "Only this school's Manager can attach an existing teacher account" }, 403);

      const { data: targetProfile, error: profileError } = await admin
        .from("profiles")
        .select("id,username")
        .eq("username", targetUsername)
        .maybeSingle();
      if (profileError) return json({ error: "Unable to look up the existing account" }, 503);
      if (!targetProfile?.id || !targetProfile.username) return json({ error: "No existing account was found for that username" }, 404);

      const { data: membershipId, error: attachError } = await admin.rpc("school_attach_existing_teacher_account", {
        p_actor_id: actorId,
        p_school_id: schoolId,
        p_user_id: targetProfile.id,
      });
      if (attachError || !membershipId) {
        return json({ error: attachError?.message || "The existing teacher account could not be attached" }, 400);
      }

      return json({
        membership_id: membershipId,
        username: targetProfile.username,
        role: "teacher",
        requires_assignment: true,
        global_role_unchanged: true,
      }, 201);
    }

    if (action === "create_division_staff") {
      const schoolId = normalize(payload?.school_id);
      const position = normalize(payload?.position);
      const name = normalize(payload?.name);
      const sectionId = normalize(payload?.section_id);
      const assignmentKind = normalize(payload?.assignment_kind);
      const subjectName = normalize(payload?.subject_name);
      const teamName = normalize(payload?.team_name);
      if (!schoolId || !["teacher", "team_leader"].includes(position) || name.length < 2 || name.length > 160) {
        return json({ error: "Provide a valid name and account type" }, 400);
      }
      if (position === "team_leader" && (teamName.length < 2 || teamName.length > 100)) {
        return json({ error: "Enter a valid Team Leader team name" }, 400);
      }
      if (position === "teacher" && (!sectionId || !["subject", "homeroom"].includes(assignmentKind) || (assignmentKind === "subject" && !subjectName))) {
        return json({ error: "Choose the class, assignment type and subject for this teacher" }, 400);
      }

      const { data: actorMembership, error: actorError } = await admin
        .from("school_memberships").select("id")
        .eq("school_id", schoolId).eq("user_id", actorId)
        .eq("school_role", "teacher").eq("status", "active").maybeSingle();
      if (actorError || !actorMembership) return json({ error: "An active school staff account is required" }, 403);

      const today = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Addis_Ababa" });
      const { data: directorAppointment, error: directorError } = await admin
        .from("school_leadership_appointments").select("id,division_scope")
        .eq("school_id", schoolId).eq("membership_id", actorMembership.id)
        .in("position", ["kg_director", "elementary_director", "middle_school_director", "high_school_director"])
        .eq("status", "active").lte("start_date", today)
        .or("end_date.is.null,end_date.gte." + today).limit(1).maybeSingle();
      if (directorError || !directorAppointment) return json({ error: "Only an active Division Director can create Team Leaders and Teachers" }, 403);

      if (position === "teacher") {
        const { data: section, error: sectionError } = await admin
          .from("school_sections").select("id,grade_label,academic_year_id")
          .eq("id", sectionId).eq("school_id", schoolId).maybeSingle();
        if (sectionError || !section) return json({ error: "Choose a class section in your division" }, 400);
        const { data: mapping, error: mappingError } = await admin
          .from("school_division_grade_mappings").select("id")
          .eq("school_id", schoolId).eq("division_scope", directorAppointment.division_scope)
          .eq("grade_label", section.grade_label).maybeSingle();
        if (mappingError || !mapping) return json({ error: "That class is outside your assigned division" }, 403);
        const { data: year, error: yearError } = await admin
          .from("school_academic_years").select("id")
          .eq("id", section.academic_year_id).eq("school_id", schoolId)
          .eq("is_current", true).maybeSingle();
        if (yearError || !year) return json({ error: "Choose a class in the current academic year" }, 400);
        if (assignmentKind === "subject") {
          const { data: subject, error: subjectError } = await admin
            .from("school_subjects").select("id")
            .eq("school_id", schoolId).eq("academic_year_id", section.academic_year_id)
            .eq("grade_label", section.grade_label).eq("subject_name", subjectName)
            .eq("active", true).maybeSingle();
          if (subjectError || !subject) return json({ error: "Choose an active subject for this grade" }, 400);
        }
      }

      try {
        const username = await uniqueStaffUsername();
        const account = await createAuthAccount(name, username);
        const { data: membershipId, error: attachError } = await admin.rpc("school_attach_division_staff_account", {
          p_actor_id: actorId, p_school_id: schoolId, p_user_id: account.userId,
          p_school_username: username, p_section_id: position === "teacher" ? sectionId : null,
          p_subject_name: position === "teacher" ? (assignmentKind === "homeroom" ? "Homeroom" : subjectName) : null,
          p_assignment_kind: position === "teacher" ? assignmentKind : null,
          p_position: position, p_team_name: position === "team_leader" ? teamName : null, p_team_leader_appointment_id: position === "teacher" ? (normalize(payload?.team_leader_appointment_id) || null) : null,
        });
        if (attachError || !membershipId) throw new Error(attachError?.message || "Could not attach the new account to your division");
        createdUserId = null;
        return json({ created: { membership_id: membershipId, username, initial_password: account.password, role: position } }, 201);
      } catch (error) {
        if (createdUserId) await admin.auth.admin.deleteUser(createdUserId);
        createdUserId = null;
        return json({ error: error instanceof Error ? error.message : "Account creation failed" }, 400);
      }
    }

    if (action === "attach_existing_account") {
      if (!canProvisionNetwork) return json({ error: "Only the Super Admin or Extreme Admin can assign existing accounts to the school network" }, 403);
      const schoolId = normalize(payload?.school_id);
      const targetUsername = normalize(payload?.username).toLowerCase();
      const role = normalize(payload?.role) as SchoolRole;
      const reason = normalize(payload?.reason);
      const assignableRoles: SchoolRole[] = ["manager", "finance", "parent"];
      let studentMembershipIds: string[] = [];
      if (role === "parent") {
        try {
          studentMembershipIds = await resolveStudentMembershipIds(schoolId, payload?.student_usernames);
        } catch (error) {
          return json({ error: error instanceof Error ? error.message : "Could not verify linked students" }, 400);
        }
      }
      if (!schoolId || targetUsername.length < 3 || targetUsername.length > 64 || !assignableRoles.includes(role) || !reason) {
        return json({ error: "Provide an active school, existing username, and supported school role" }, 400);
      }
      const { data: school, error: schoolError } = await admin
        .from("schools").select("id,status").eq("id", schoolId).maybeSingle();
      if (schoolError || !school || school.status !== "active") return json({ error: "School is unavailable" }, 404);

      const { data: targetProfile, error: profileError } = await admin
        .from("profiles").select("id,username,account_status").ilike("username", targetUsername).maybeSingle();
      if (profileError) return json({ error: "Unable to look up the existing account" }, 503);
      if (!targetProfile?.id || !targetProfile.username) return json({ error: "No existing account was found for that username" }, 404);
      if (targetProfile.account_status !== "active") return json({ error: "Only active accounts can be assigned to a school" }, 409);

      const { data: targetRoles, error: targetRolesError } = await admin
        .from("user_roles").select("role").eq("user_id", targetProfile.id);
      if (targetRolesError) return json({ error: "Unable to verify the target account's platform authority" }, 503);
      if ((targetRoles ?? []).some((row: { role: string }) => row.role === "extreme_admin" || row.role === "super_admin")) {
        return json({ error: "Platform authority accounts cannot be assigned to a school portal" }, 409);
      }

      const { data: membershipId, error: attachError } = await admin.rpc("school_attach_account", {
        p_actor_id: actorId,
        p_school_id: schoolId,
        p_user_id: targetProfile.id,
        p_school_role: role,
        p_school_username: targetProfile.username,
        p_grade_label: null,
        p_age_at_enrollment: null,
        p_section_id: null,
        p_student_number: null,
        p_parent_membership_ids: [],
        p_student_membership_ids: studentMembershipIds,
        p_teacher_assignments: [],
      });
      if (attachError || !membershipId) {
        return json({ error: attachError?.message || "The existing account could not be assigned to this school" }, 400);
      }

      const { error: auditError } = await admin.from("admin_audit_logs").insert({
        actor_id: actorId,
        action: "school_network_existing_account_assigned",
        target_type: "school_membership",
        target_id: membershipId,
        metadata: { school_id: schoolId, user_id: targetProfile.id, school_role: role, reason },
      });

      return json({
        membership_id: membershipId,
        user_id: targetProfile.id,
        username: targetProfile.username,
        role,
        audit_recorded: !auditError,
        ...(auditError ? { warning: "The account was assigned, but the audit event could not be written. Review the audit log before repeating this action." } : {}),
      }, 201);
    }

    if (action === "create_accounts") {
      const schoolId = normalize(payload?.school_id);
      const role = normalize(payload?.role) as SchoolRole;
      const accounts = payload?.accounts as AccountInput[];
      const validRoles: SchoolRole[] = ["manager", "teacher", "finance", "parent", "student"];
      if (!schoolId || !validRoles.includes(role) || !Array.isArray(accounts) || accounts.length < 1 || accounts.length > 100) {
        return json({ error: "Provide a school, valid role, and between 1 and 100 accounts" }, 400);
      }
      if (role === "teacher" && accounts.some((account) => !normalize(account?.leadership_position))) {
        return json({ error: "The School Manager creates Director accounts; Division Directors create Teacher accounts" }, 403);
      }
      if (role === "manager" && !canProvisionNetwork) {
        return json({ error: "Only the Super Admin or Extreme Admin can create a school Manager" }, 403);
      }
      if (role !== "manager" && !canProvisionNetwork) {
        const { data: memberships, error: membershipError } = await admin
          .from("school_memberships")
          .select("id")
          .eq("school_id", schoolId)
          .eq("user_id", actorId)
          .eq("status", "active")
          .eq("school_role", "manager");
        if (membershipError) return json({ error: "Unable to verify this school's provisioning authority" }, 503);
        if (!(memberships ?? []).length) return json({ error: "Only this school's Manager can create parent and student accounts or appoint school Directors" }, 403);
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
          const accountInput: AccountInput = { ...input };
          if (role === "parent") {
            accountInput.student_membership_ids = await resolveStudentMembershipIds(schoolId, input.student_usernames);
          }
          const membershipId = await attachAccount(schoolId, role, account.userId, username, accountInput, studentNumber);
          const { error: auditError } = await admin.from("admin_audit_logs").insert({
            actor_id: actorId,
            action: "school_account_created",
            target_type: "school_membership",
            target_id: membershipId,
            metadata: { school_id: schoolId, user_id: account.userId, school_role: role, username },
          });
          created.push({
            index,
            membership_id: membershipId,
            username,
            initial_password: account.password,
            role,
            audit_recorded: !auditError,
            ...(auditError ? { audit_warning: "Account created but its audit event could not be written." } : {}),
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
