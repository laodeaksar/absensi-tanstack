// Simpan sebagai convex/limits.ts
// Batas yang dipakai bersama oleh server (Convex) dan klien (zod).
// Hanya konstanta murni: jangan mengimpor apa pun dari "convex/server" atau "./_generated/*"
// agar aman diimpor dari browser lewat "~/convex/limits".
//
// Nilai di bawah sama dengan yang saat ini ditulis langsung di convex/assignment.ts
// dan ~/lib/assignment-schema.ts. Ubah di sini saja.

export const LIMITS = {
  // tugas
  title: 150,
  description: 1000,
  durationMinutes: 600, // 0 = tanpa batas durasi

  // soal
  questionText: 2000,
  optionText: 300,
  optionsMin: 2,
  optionsMax: 6,
  pointsMin: 1,
  pointsMax: 100,

  // jawaban dan penilaian
  essayAnswer: 5000,
  feedback: 500,
  
  // kelas
  className: 50,
  gradeLevel: 20,

  // Pindahkan juga dari ~/lib/attendance-schema dengan nilai yang sama:
  // notesMin: <nilai NOTES_MIN sekarang>,
  notesMin: 3,
  notesMax: 200
} as const

/** Status yang mewajibkan keterangan. Ubah di sini untuk mengatur aturan. */
export const NOTES_REQUIRED: readonly string[] = ['Sakit', 'Izin']
export const needsNotes = (status: string) => NOTES_REQUIRED.includes(status)
