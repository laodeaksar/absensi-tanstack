import { useForm } from "@tanstack/react-form";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";

import { PasswordStrength } from "~/components/password-strength";
import {
  ErrorAlert,
  SelectField,
  TextField,
  PasswordField,
  CheckboxField,
} from "~/components/ui";
import { LIMITS } from "~/convex/limits";
import { isMonthDay, periodFor, SEMESTER_LABEL } from "~/convex/rules";
import { api } from "~/lib/api";
import { todayStr } from "~/lib/date";
import { qk, settingsQuery } from "~/lib/queries";
import { makePasswordSchema, schoolSchema } from "~/lib/settings-schema";
import { toast } from "~/lib/toast";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
});

const ROLE_LABEL = {
  admin: "Administrator",
  guru: "Guru",
  siswa: "Siswa",
} as const;

function SettingsPage() {
  const { me } = Route.useRouteContext();
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Pengaturan</h2>
      {me.must_change_password ? (
        <div
          role="alert"
          className="alert alert-info alert-soft"
        >
          Demi keamanan, ganti password bawaan Anda sekarang.
        </div>
      ) : null}
      {/* Akun wajib ganti password: kartu password di atas agar tidak terlewat */}
      {me.must_change_password ? <PasswordCard /> : null}
      {me.role === "admin" ? <SchoolSettings /> : null}
      {me.must_change_password ? null : <PasswordCard />}
    </div>
  );
}

function SchoolSettings() {
  const qc = useQueryClient();
  const { data: s } = useSuspenseQuery(settingsQuery);

  const save = useMutation({
    mutationFn: api.saveSettings,
    onSuccess: (r) => {
      toast.success(r.message || "Pengaturan tersimpan");
      void qc.invalidateQueries({
        queryKey: qk.settings,
      });
    },
  });

  const form = useForm({
    defaultValues: {
      school_name: s.school_name ?? "",
      school_address: s.school_address ?? "",
      principal_name: s.principal_name ?? "",
      principal_nip: s.principal_nip ?? "",
      active_academic_year: s.active_academic_year ?? "",
      active_semester: s.active_semester ?? "",
      auto_semester: s.auto_semester === "1",
      semester_ganjil_start: s.semester_ganjil_start ?? "07-15",
      semester_genap_start: s.semester_genap_start ?? "01-12",
      edit_window_days: s.edit_window_days ?? "0",
    },
    validators: {
      onChange: schoolSchema,
      onSubmit: schoolSchema,
    },
    onSubmitInvalid: () =>
      toast.error("Periksa kembali isian yang ditandai merah."),
    onSubmit: async ({ value }) => {
      await save
        .mutateAsync({
          school_name: value.school_name.trim(),
          school_address: value.school_address.trim(),
          principal_name: value.principal_name.trim(),
          principal_nip: value.principal_nip.trim(),
          active_academic_year: value.active_academic_year.trim(),
          active_semester: value.active_semester,
          auto_semester: value.auto_semester ? "1" : "0",
          semester_ganjil_start: value.semester_ganjil_start.trim(),
          semester_genap_start: value.semester_genap_start.trim(),
          edit_window_days: value.edit_window_days.trim() || "0",
        })
        .catch(() => {});
    },
  });

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void form.handleSubmit();
      }}
      className="space-y-6"
    >
      <div className="card border border-base-300 bg-base-100">
        <div className="card-body max-w-2xl">
          <h3 className="card-title text-base">Data Sekolah</h3>
          <p className="text-sm text-base-content/60">
            Dipakai pada judul aplikasi dan kop laporan cetak.
          </p>
          <form.Field name="school_name">
            {(f) => (
              <TextField
                label="Nama Sekolah"
                field={f}
                maxLength={LIMITS.schoolName}
              />
            )}
          </form.Field>
          <form.Field name="school_address">
            {(f) => (
              <TextField
                label="Alamat Sekolah"
                field={f}
                maxLength={LIMITS.schoolAddress}
              />
            )}
          </form.Field>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <form.Field name="principal_name">
              {(f) => (
                <TextField
                  label="Nama Kepala Sekolah"
                  field={f}
                  maxLength={LIMITS.personName}
                />
              )}
            </form.Field>
            <form.Field name="principal_nip">
              {(f) => (
                <TextField
                  label="NIP Kepala Sekolah"
                  field={f}
                  inputMode="numeric"
                />
              )}
            </form.Field>
          </div>
        </div>
      </div>

      <div className="card border border-base-300 bg-base-100">
        <div className="card-body">
          <h3 className="card-title text-base">Tahun Ajaran dan Semester</h3>
          <form.Field name="auto_semester">
            {(f) => (
              <CheckboxField
                toggle
                label="Lanjut otomatis ke semester dan tahun ajaran berikutnya"
                hint="Tahun ajaran dan semester aktif mengikuti kalender di bawah."
                field={f}
              />
            )}
          </form.Field>
          <form.Subscribe
            selector={(st) =>
              [
                st.values.auto_semester,
                st.values.semester_ganjil_start,
                st.values.semester_genap_start,
              ] as const
            }
          >
            {([auto, ganjil, genap]) => {
              if (!auto)
                return (
                  <div className="grid max-w-2xl grid-cols-1 gap-4 md:grid-cols-2">
                    <form.Field name="active_academic_year">
                      {(f) => (
                        <TextField
                          label="Tahun Ajaran Aktif"
                          field={f}
                          placeholder="2025/2026"
                          hint="Terisi otomatis saat menambah kelas baru."
                        />
                      )}
                    </form.Field>
                    <form.Field name="active_semester">
                      {(f) => (
                        <SelectField
                          label="Semester Aktif"
                          field={f}
                        >
                          <option value="">-- Belum diatur --</option>
                          <option value="ganjil">Ganjil</option>
                          <option value="genap">Genap</option>
                        </SelectField>
                      )}
                    </form.Field>
                  </div>
                );
              const valid =
                isMonthDay(ganjil) && isMonthDay(genap) && genap < ganjil;
              const now = valid
                ? periodFor(
                    todayStr(Number(s.tz_offset_minutes ?? 0)),
                    ganjil,
                    genap,
                  )
                : null;
              return (
                <>
                  <div className="grid max-w-2xl grid-cols-1 gap-4 md:grid-cols-2">
                    <form.Field name="semester_ganjil_start">
                      {(f) => (
                        <TextField
                          label="Awal Semester Ganjil"
                          field={f}
                          placeholder="07-15"
                          hint="Format bulan-tanggal (BB-HH). Tahun ajaran baru dimulai di sini."
                        />
                      )}
                    </form.Field>
                    <form.Field name="semester_genap_start">
                      {(f) => (
                        <TextField
                          label="Awal Semester Genap"
                          field={f}
                          placeholder="01-12"
                          hint="Format BB-HH, lebih awal dari semester ganjil dalam satu tahun kalender."
                        />
                      )}
                    </form.Field>
                  </div>
                  {now ? (
                    <p className="text-sm">
                      Saat ini:{" "}
                      <b>
                        Semester {SEMESTER_LABEL[now.semester]}{" "}
                        {now.academicYear}
                      </b>
                    </p>
                  ) : null}
                </>
              );
            }}
          </form.Subscribe>
        </div>
      </div>

      <div className="card border border-base-300 bg-base-100">
        <div className="card-body">
          <h3 className="card-title text-base">Absensi</h3>
          <div className="grid max-w-2xl grid-cols-1 gap-4 md:grid-cols-2">
            <form.Field name="edit_window_days">
              {(f) => (
                <TextField
                  label="Batas Edit Absensi Guru (hari)"
                  field={f}
                  inputMode="numeric"
                  hint="0 = tanpa batas. Admin tidak dibatasi."
                />
              )}
            </form.Field>
          </div>
          <ErrorAlert message={save.error?.message} />
          <div className="card-actions mt-2">
            <form.Subscribe selector={(st) => st.isSubmitting}>
              {(busy) => (
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={busy}
                >
                  {busy ? (
                    <span className="loading loading-spinner loading-sm" />
                  ) : null}
                  Simpan Pengaturan
                </button>
              )}
            </form.Subscribe>
          </div>
        </div>
      </div>
    </form>
  );
}

function PasswordCard() {
  const { me, convexQueryClient } = Route.useRouteContext();
  const qc = useQueryClient();
  const navigate = useNavigate();

  // Kebijakan password kuat; username dan nama akun tidak boleh masuk ke password
  const schema = useMemo(
    () =>
      makePasswordSchema({
        username: me.username,
        fullName: me.full_name,
      }),
    [me.username, me.full_name],
  );

  const change = useMutation({
    mutationFn: (v: { oldPw: string; newPw: string }) =>
      api.changePassword(v.oldPw, v.newPw),
    onSuccess: async () => {
      toast.success("Password diubah. Silakan login kembali.");
      // Hapus cache sesi dulu agar /login tidak mengira pengguna masih masuk,
      // pindah halaman, baru kosongkan sisa cache (saat layout sudah tidak aktif,
      // supaya query yang masih terpasang tidak memuat ulang tanpa cookie).
      qc.removeQueries({ queryKey: qk.me });
      // Sesi lama sudah dicabut server: hentikan langganan realtime-nya sekarang
      convexQueryClient.convexClient.clearAuth();
      await navigate({ to: "/login" });
      qc.clear();
    },
  });

  const form = useForm({
    defaultValues: {
      old: "",
      next: "",
      confirm: "",
    },
    validators: {
      onChange: schema,
      onSubmit: schema,
    },
    onSubmitInvalid: () =>
      toast.error("Periksa kembali isian yang ditandai merah."),
    onSubmit: async ({ value }) => {
      await change
        .mutateAsync({
          oldPw: value.old,
          newPw: value.next,
        })
        .catch(() => {});
    },
  });

  return (
    <div className="card border border-base-300 bg-base-100">
      <form
        noValidate
        className="card-body max-w-md"
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void form.handleSubmit();
        }}
      >
        <h3 className="card-title text-base">Akun Saya</h3>
        <p className="text-sm text-base-content/60">
          {me.full_name || me.username} ({me.username}) -{" "}
          {ROLE_LABEL[me.role] ?? me.role}
        </p>

        <form.Field name="old">
          {(f) => (
            <PasswordField
              label="Password Lama"
              field={f}
              autoComplete="current-password"
            />
          )}
        </form.Field>
        <form.Field name="next">
          {(f) => (
            <PasswordField
              label="Password Baru"
              field={f}
              autoComplete="new-password"
              placeholder="Minimal 8 karakter"
            />
          )}
        </form.Field>
        <form.Subscribe selector={(s) => s.values.next}>
          {(next) => (
            <PasswordStrength
              value={next}
              forbidden={[me.username, me.full_name]}
            />
          )}
        </form.Subscribe>
        <form.Field name="confirm">
          {(f) => (
            <PasswordField
              label="Ulangi Password Baru"
              field={f}
              autoComplete="new-password"
            />
          )}
        </form.Field>

        <ErrorAlert message={change.error?.message} />

        <div className="card-actions mt-2">
          <form.Subscribe selector={(st) => st.isSubmitting}>
            {(busy) => (
              <button
                type="submit"
                className="btn btn-primary"
                disabled={busy}
              >
                {busy ? (
                  <span className="loading loading-spinner loading-sm" />
                ) : null}
                Ubah Password
              </button>
            )}
          </form.Subscribe>
        </div>
      </form>
    </div>
  );
}
