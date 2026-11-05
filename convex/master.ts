import { v } from "convex/values";

import type { Doc } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

import { mutation, query } from "./_generated/server";
import {
  assertStrongPassword,
  classById,
  fail,
  flag,
  newHash,
  nowIso,
  randomId,
  requireAuth,
  revokeSessions,
  strip,
  studentById,
  teacherOut,
  userById,
} from "./lib";
import { LIMITS } from "./limits";
import { RULES, isAcademicYear } from "./rules";

const classInput = v.object({
  class_id: v.optional(v.string()),
  class_name: v.string(),
  grade_level: v.string(),
  academic_year: v.string(),
  homeroom_teacher: v.string(),
});

const studentInput = v.object({
  student_id: v.optional(v.string()),
  nis: v.optional(v.string()),
  nisn: v.optional(v.string()),
  full_name: v.optional(v.string()),
  gender: v.optional(v.string()),
  class_id: v.optional(v.string()), // hanya saat siswa baru
  is_active: v.optional(v.boolean()),
});

// Semua opsional: tombol Aktif/Nonaktifkan hanya mengirim { user_id, is_active }
const teacherInput = v.object({
  user_id: v.optional(v.string()),
  full_name: v.optional(v.string()),
  nip: v.optional(v.string()),
  phone: v.optional(v.string()),
  email: v.optional(v.string()),
  username: v.optional(v.string()),
  password: v.optional(v.string()),
  assigned_classes: v.optional(v.array(v.string())),
  is_active: v.optional(v.boolean()),
});

/* ---------- baca ---------- */

export const fetchMasterData = query({
  args: { token: v.string(), type: v.string() },
  handler: async (ctx, { token, type }) => {
    const user = await requireAuth(ctx, token);
    if (type === "teachers") {
      if (user.role !== "admin") fail("FORBIDDEN");
      const rows = await ctx.db
        .query("users")
        .withIndex("by_role", (q) => q.eq("role", "guru"))
        .collect();
      return { data: rows.map(teacherOut) };
    }
    if (type === "classes") {
      return {
        data: (await ctx.db.query("classes").collect()).map(strip),
      };
    }
    if (type === "students") {
      if (user.role !== "admin") fail("FORBIDDEN");
      return {
        data: (await ctx.db.query("students").collect()).map(strip),
      };
    }
    return { data: [] };
  },
});

/* ---------- akun siswa ---------- */

function studentUserDoc(
  s: Doc<"students">,
  now: string,
): Omit<Doc<"users">, "_id" | "_creationTime"> {
  const nis = s.nis.trim();
  return {
    user_id: randomId("USR"),
    username: nis,
    username_lc: nis.toLowerCase(),
    // Password awal = NISN: dicocokkan langsung ke data siswa, tidak di-hash (wajib diganti saat login)
    hash_algo: "nisn",
    password_hash: "",
    password_salt: "",
    full_name: s.full_name || "Siswa",
    role: "siswa",
    assigned_classes: [],
    is_active: true,
    nip: "",
    phone: "",
    email: "",
    student_id: s.student_id,
    must_change_password: true,
    created_at: now,
    updated_at: now,
  };
}

/** Samakan akun login siswa dengan data siswa (NIS, nama, status aktif). Mengembalikan peringatan atau "". */
async function syncStudentAccount(ctx: MutationCtx, studentId: string) {
  const s = await studentById(ctx, studentId);
  const u = await ctx.db
    .query("users")
    .withIndex("by_student_id", (q) => q.eq("student_id", studentId))
    .unique();
  if (!s || !u) return "";

  const nis = s.nis.trim();
  const patch: Partial<Doc<"users">> = {
    full_name: s.full_name || u.full_name,
    is_active: s.is_active,
    updated_at: nowIso(),
  };
  let warning = "";
  if (nis && nis !== u.username) {
    const clash = await ctx.db
      .query("users")
      .withIndex("by_username_lc", (q) =>
        q.eq("username_lc", nis.toLowerCase()),
      )
      .collect();
    if (clash.some((x) => x.user_id !== u.user_id))
      warning =
        "Username akun siswa tidak diubah karena NIS baru bentrok dengan akun lain.";
    else {
      patch.username = nis;
      patch.username_lc = nis.toLowerCase();
    }
  }
  await ctx.db.patch(u._id, patch);
  await revokeSessions(ctx, u.user_id);
  return warning;
}

/* ---------- siswa ---------- */

const STUDENT_FIELDS = [
  "nis",
  "nisn",
  "full_name",
  "gender",
  "birth_place",
  "birth_date",
  "address",
  "parent_name",
  "parent_phone",
] as const;

export const saveStudent = mutation({
  args: { token: v.string(), data: studentInput },
  handler: async (ctx, { token, data }) => {
    await requireAuth(ctx, token, { admin: true });
    if (!data) fail("Data siswa tidak boleh kosong.");
    const d = data as Record<string, unknown>;

    // Hanya field yang diizinkan yang diterima dari klien
    const clean: Record<string, string> = {};
    for (const k of STUDENT_FIELDS)
      if (d[k] !== undefined && d[k] !== null) clean[k] = String(d[k]).trim();

    // Validasi dijalankan SETELAH clean terisi
    if (
      clean.nis !== undefined &&
      (clean.nis.length < 3 || clean.nis.length > LIMITS.nisMax)
    )
      fail(`NIS harus ${LIMITS.nisMin}-${LIMITS.nisMax} karakter.`);
    // NISN boleh kosong (siswa tanpa NISN belum bisa dibuatkan akun), tapi bila diisi harus 10 digit
    if (clean.nisn && !RULES.nisn.test(clean.nisn))
      fail("NISN harus 10 digit angka.");
    if (clean.full_name !== undefined && !clean.full_name)
      fail("Nama lengkap wajib diisi.");
    if (
      clean.full_name !== undefined &&
      (clean.full_name.length < LIMITS.studentNameMin ||
        clean.full_name.length > LIMITS.personName)
    )
      fail(
        `Nama lengkap harus ${LIMITS.studentNameMin}-${LIMITS.personName} karakter.`,
      );
    if (clean.gender && clean.gender !== "L" && clean.gender !== "P")
      fail("Jenis kelamin tidak valid.");

    const id = String(d.student_id ?? "");
    const existing = id ? await studentById(ctx, id) : null;
    if (id && !existing) fail("Data siswa tidak ditemukan.");

    const nis = clean.nis ?? existing?.nis ?? "";
    const nisn = clean.nisn ?? existing?.nisn ?? "";
    if (!nis) fail("NIS wajib diisi.");
    if (!existing && !clean.full_name) fail("Nama lengkap wajib diisi.");

    const sameNis = await ctx.db
      .query("students")
      .withIndex("by_nis", (q) => q.eq("nis", nis))
      .collect();
    const sameNisn = nisn
      ? await ctx.db
          .query("students")
          .withIndex("by_nisn", (q) => q.eq("nisn", nisn))
          .collect()
      : [];
    if ([...sameNis, ...sameNisn].some((s) => s.student_id !== id))
      fail("NIS atau NISN sudah digunakan.");

    const now = nowIso();

    if (existing) {
      const patch: Record<string, unknown> = {
        ...clean,
        updated_at: now,
      };
      if (d.is_active !== undefined) patch.is_active = flag(d.is_active);
      await ctx.db.patch(existing._id, patch as Partial<Doc<"students">>);
      const warning = await syncStudentAccount(ctx, existing.student_id);
      return {
        message:
          "Data siswa berhasil disimpan." + (warning ? " " + warning : ""),
      };
    }

    const cls = d.class_id ? await classById(ctx, String(d.class_id)) : null;
    if (d.class_id && !cls) fail("Kelas tidak ditemukan.");

    const student_id = randomId("STD");
    await ctx.db.insert("students", {
      student_id,
      nis,
      nisn,
      full_name: clean.full_name,
      gender: clean.gender ?? "",
      birth_place: clean.birth_place ?? "",
      birth_date: clean.birth_date ?? "",
      address: clean.address ?? "",
      parent_name: clean.parent_name ?? "",
      parent_phone: clean.parent_phone ?? "",
      is_active: true,
      created_at: now,
      updated_at: now,
    });
    if (cls) {
      await ctx.db.insert("student_class_history", {
        history_id: randomId("HST"),
        student_id,
        class_id: cls.class_id,
        academic_year: cls.academic_year,
        start_date: now,
        end_date: "",
        is_active: true,
        created_at: now,
      });
    }
    return { message: "Data siswa berhasil disimpan." };
  },
});

/** Kelas aktif tiap siswa, diambil dari riwayat kelas yang belum ditutup. */
export const listStudentClasses = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    await requireAuth(ctx, token, { admin: true });
    const hist = await ctx.db.query("student_class_history").collect();
    return hist
      .filter((h) => h.is_active)
      .map((h) => ({
        student_id: h.student_id,
        class_id: h.class_id,
        academic_year: h.academic_year,
        start_date: h.start_date,
      }));
  },
});

export const moveStudent = mutation({
  args: {
    token: v.string(),
    studentId: v.string(),
    classId: v.string(),
  },
  handler: async (ctx, { token, studentId, classId }) => {
    await requireAuth(ctx, token, { admin: true });

    const student = await studentById(ctx, studentId);
    if (!student) fail("Data siswa tidak ditemukan.");
    if (!student!.is_active)
      fail("Siswa nonaktif. Aktifkan dulu sebelum memindahkan kelas.");

    const cls = await classById(ctx, classId);
    if (!cls || !cls.is_active) fail("Kelas tujuan tidak valid.");

    const hist = await ctx.db
      .query("student_class_history")
      .withIndex("by_student", (q) => q.eq("student_id", studentId))
      .collect();
    const active = hist.filter((h) => h.is_active);
    if (active.some((h) => h.class_id === classId))
      fail("Siswa sudah berada di kelas ini.");

    // Tutup riwayat aktif (bisa lebih dari satu bila data lama tidak rapi), lalu buka yang baru
    const now = nowIso();
    for (const h of active)
      await ctx.db.patch(h._id, {
        is_active: false,
        end_date: now,
      });
    await ctx.db.insert("student_class_history", {
      history_id: randomId("HST"),
      student_id: studentId,
      class_id: cls!.class_id,
      academic_year: cls!.academic_year,
      start_date: now,
      end_date: "",
      is_active: true,
      created_at: now,
    });
    return {
      message: `${student!.full_name} dipindahkan ke ${cls!.class_name}.`,
    };
  },
});

export const generateStudentAccounts = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    await requireAuth(ctx, token, { admin: true });
    const users = await ctx.db.query("users").collect();
    const hasAccount = new Set(
      users.filter((u) => u.student_id).map((u) => u.student_id),
    );
    const taken = new Set(users.map((u) => u.username_lc));

    const students = (await ctx.db.query("students").collect()).filter(
      (s) => s.is_active,
    );
    const now = nowIso();
    let created = 0;
    const skipped: string[] = [];

    for (const s of students) {
      if (hasAccount.has(s.student_id)) continue;
      const nis = s.nis.trim();
      const nisn = s.nisn.trim();
      if (nis.length < 3) {
        skipped.push(
          `${s.full_name || s.student_id}: NIS kosong/kurang dari 3 karakter`,
        );
        continue;
      }
      if (nisn.length < 6) {
        skipped.push(`${nis}: NISN kosong/kurang dari 6 karakter`);
        continue;
      }
      if (taken.has(nis.toLowerCase())) {
        skipped.push(`${nis}: username sudah dipakai akun lain`);
        continue;
      }
      await ctx.db.insert("users", studentUserDoc(s, now));
      taken.add(nis.toLowerCase());
      created++;
    }

    let msg = `${created} akun siswa dibuat.`;
    if (skipped.length > 0)
      msg += ` ${skipped.length} dilewati (${skipped.slice(0, 3).join("; ")}${skipped.length > 3 ? "; ..." : ""}).`;
    return { message: msg };
  },
});

export const resetStudentAccount = mutation({
  args: { token: v.string(), studentId: v.string() },
  handler: async (ctx, { token, studentId }) => {
    await requireAuth(ctx, token, { admin: true });
    if (!studentId) fail("Siswa tidak valid.");
    const student = await studentById(ctx, studentId);
    if (!student) fail("Data siswa tidak ditemukan.");
    const s = student!;

    const nis = s.nis.trim();
    const nisn = s.nisn.trim();
    if (nis.length < 3) fail("NIS siswa kosong atau terlalu pendek.");
    if (nisn.length < 6)
      fail(
        "NISN siswa kosong atau terlalu pendek untuk dijadikan password awal.",
      );

    const clash = await ctx.db
      .query("users")
      .withIndex("by_username_lc", (q) =>
        q.eq("username_lc", nis.toLowerCase()),
      )
      .collect();
    const existing = await ctx.db
      .query("users")
      .withIndex("by_student_id", (q) => q.eq("student_id", studentId))
      .unique();
    if (clash.some((u) => u.user_id !== existing?.user_id))
      fail("NIS sudah dipakai sebagai username akun lain.");

    const now = nowIso();
    if (existing) {
      if (!s.is_active)
        fail("Siswa nonaktif. Aktifkan dulu sebelum mereset akun.");
      await ctx.db.patch(existing._id, {
        username: nis,
        username_lc: nis.toLowerCase(),
        full_name: s.full_name || "Siswa",
        is_active: true,
        hash_algo: "nisn",
        hash_iterations: undefined, // patch dengan undefined menghapus field
        password_hash: "",
        password_salt: "",
        must_change_password: true,
        updated_at: now,
      });
      await revokeSessions(ctx, existing.user_id);
      return {
        message: "Akun siswa direset: username = NIS, password = NISN.",
      };
    }

    await ctx.db.insert("users", studentUserDoc(s, now));
    return {
      message: "Akun siswa dibuat. Username = NIS, password awal = NISN.",
    };
  },
});

/* ---------- kelas ---------- */

export const saveClass = mutation({
  args: { token: v.string(), data: classInput },
  handler: async (ctx, { token, data }) => {
    await requireAuth(ctx, token, { admin: true });
    if (!data) fail("Data kelas tidak boleh kosong.");
    const d = data as Record<string, unknown>;

    const className = String(d.class_name ?? "").trim();
    const grade = String(d.grade_level ?? "").trim();
    const year = String(d.academic_year ?? "").trim();
    const homeroom = String(d.homeroom_teacher ?? "").trim();
    if (!className) fail("Nama kelas wajib diisi.");
    if (className.length > LIMITS.className)
      fail(`Nama kelas maksimal ${LIMITS.className} karakter.`);
    if (!grade) fail("Tingkat wajib diisi.");
    if (grade.length > LIMITS.gradeLevel)
      fail(`Tingkat maksimal ${LIMITS.gradeLevel} karakter.`);
    if (!isAcademicYear(year)) fail("Tahun ajaran harus berformat 2025/2026.");

    const id = String(d.class_id ?? "");
    const existing = id ? await classById(ctx, id) : null;
    if (id && !existing) fail("Kelas tidak ditemukan.");

    const all = await ctx.db.query("classes").collect();
    if (
      all.some(
        (c) =>
          c.class_name === className &&
          c.academic_year === year &&
          c.class_id !== id,
      )
    ) {
      fail("Nama kelas sudah ada pada tahun ajaran tersebut.");
    }

    if (homeroom) {
      const wali = await userById(ctx, homeroom);
      const changedTeacher = homeroom !== existing?.homeroom_teacher;
      // Wali kelas harus guru aktif (wali yang sudah ada tetap boleh dipertahankan walau nonaktif)
      if (changedTeacher && (!wali || wali.role !== "guru" || !wali.is_active))
        fail("Wali kelas tidak valid.");

      // Satu guru hanya boleh menjadi wali satu kelas aktif per tahun ajaran.
      // Hanya diperiksa saat wali atau tahun ajarannya diubah, supaya data lama tidak menghalangi edit lain.
      if (changedTeacher || year !== existing?.academic_year) {
        const other = all.find(
          (c) =>
            c.is_active &&
            c.class_id !== id &&
            c.homeroom_teacher === homeroom &&
            c.academic_year === year,
        );
        if (other)
          fail(
            `${wali?.full_name ?? "Guru ini"} sudah menjadi wali kelas ${other.class_name} pada tahun ajaran ${year}.`,
          );
      }
    }

    const now = nowIso();
    if (existing) {
      await ctx.db.patch(existing._id, {
        class_name: className,
        grade_level: grade,
        academic_year: year,
        homeroom_teacher: homeroom,
        updated_at: now,
      });
    } else {
      await ctx.db.insert("classes", {
        class_id: randomId("CLS"),
        class_name: className,
        grade_level: grade,
        academic_year: year,
        homeroom_teacher: homeroom,
        description: String(d.description ?? ""),
        is_active: true,
        created_at: now,
        updated_at: now,
      });
    }
    return { message: "Data kelas berhasil disimpan." };
  },
});

/* ---------- guru ---------- */

export const saveTeacher = mutation({
  args: { token: v.string(), data: teacherInput },
  handler: async (ctx, { token, data }) => {
    await requireAuth(ctx, token, { admin: true });
    if (!data) fail("Data guru tidak boleh kosong.");
    const d = data as Record<string, unknown>;

    const id = String(d.user_id ?? "");
    const existing = id ? await userById(ctx, id) : null;
    if (id && !existing) fail("Data guru tidak ditemukan.");
    if (existing && existing.role !== "guru")
      fail("Hanya akun guru yang dapat diubah di sini.");

    // Field yang tidak dikirim dipertahankan dari data lama (mis. hanya is_active saat toggle)
    const pick = (k: "username" | "full_name" | "nip" | "phone" | "email") =>
      String(
        d[k] !== undefined && d[k] !== null
          ? d[k]
          : existing
            ? existing[k]
            : "",
      ).trim();

    const username = pick("username");
    const fullName = pick("full_name");
    const nip = pick("nip");
    const phone = pick("phone");
    const email = pick("email");

    if (!fullName) fail("Nama lengkap wajib diisi.");
    if (!RULES.username.test(username))
      fail(
        "Username 3-30 karakter: huruf, angka, titik, garis bawah, atau strip.",
      );
    if (nip && !RULES.nip.test(nip))
      fail("NIP hanya berisi angka (5-30 digit).");
    if (phone && !RULES.phone.test(phone)) fail("Nomor HP tidak valid.");
    if (email && !RULES.email.test(email)) fail("Format email tidak valid.");

    const sameName = await ctx.db
      .query("users")
      .withIndex("by_username_lc", (q) =>
        q.eq("username_lc", username.toLowerCase()),
      )
      .collect();
    if (sameName.some((u) => u.user_id !== existing?.user_id))
      fail("Username sudah digunakan.");
    if (nip) {
      const sameNip = await ctx.db
        .query("users")
        .withIndex("by_nip", (q) => q.eq("nip", nip))
        .collect();
      if (sameNip.some((u) => u.user_id !== existing?.user_id))
        fail("NIP sudah digunakan.");
    }

    const pw = d.password ? String(d.password) : "";
    if (!existing && !pw) fail("Password guru baru wajib diisi.");
    if (pw) assertStrongPassword(pw, [username, fullName, nip, phone]);

    let assigned = existing ? existing.assigned_classes : [];
    if (d.assigned_classes !== undefined) {
      if (!Array.isArray(d.assigned_classes)) fail("Data kelas tidak valid.");
      const valid: string[] = [];
      for (const cid of d.assigned_classes as unknown[]) {
        const c = typeof cid === "string" ? await classById(ctx, cid) : null;
        if (c && !valid.includes(c.class_id)) valid.push(c.class_id);
      }
      assigned = valid;
    }

    const isActive =
      d.is_active !== undefined
        ? flag(d.is_active)
        : existing
          ? existing.is_active
          : true;
    const now = nowIso();

    if (existing) {
      const patch: Partial<Doc<"users">> = {
        username,
        username_lc: username.toLowerCase(),
        full_name: fullName,
        assigned_classes: assigned,
        is_active: isActive,
        nip,
        phone,
        email,
        updated_at: now,
      };
      if (pw)
        Object.assign(patch, await newHash(pw), {
          must_change_password: true,
        });
      await ctx.db.patch(existing._id, patch);
      await revokeSessions(ctx, existing.user_id); // paksa login ulang agar perubahan berlaku
    } else {
      await ctx.db.insert("users", {
        user_id: randomId("USR"),
        username,
        username_lc: username.toLowerCase(),
        ...(await newHash(pw)),
        full_name: fullName,
        role: "guru",
        assigned_classes: assigned,
        is_active: isActive,
        nip,
        phone,
        email,
        student_id: "",
        must_change_password: true,
        created_at: now,
        updated_at: now,
      });
    }
    return { message: "Data guru berhasil disimpan." };
  },
});