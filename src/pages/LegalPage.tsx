import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, ShieldCheck } from 'lucide-react';

interface LegalSection {
  heading: string;
  body: string[];
}

const PRIVACY_SECTIONS: LegalSection[] = [
  {
    heading: 'Data yang kami simpan',
    body: [
      'Saat kamu masuk dengan Google, kami menerima nama, alamat email, dan foto profil dari akun Google kamu. Data ini dipakai untuk membuat dan menampilkan profil akunmu.',
      'Catatan immersion (judul, kategori, durasi, jumlah kartu, dan catatan), target harian, serta pengaturan aplikasi disimpan pada database Supabase milik project ini.',
    ],
  },
  {
    heading: 'Cara kami memakainya',
    body: [
      'Data hanya digunakan untuk menampilkan progres immersion-mu, menghitung statistik, dan menyinkronkan akun lintas perangkat.',
      'Kami tidak menjual, menyewakan, atau membagikan data pribadimu kepada pihak ketiga untuk keperluan iklan.',
    ],
  },
  {
    heading: 'Penyimpanan & keamanan',
    body: [
      'Data disimpan di Supabase dengan Row Level Security aktif, sehingga setiap pengguna hanya bisa membaca dan mengubah data miliknya sendiri.',
      'Sesi login disimpan di browser kamu agar kamu tidak perlu masuk ulang setiap kali membuka aplikasi.',
    ],
  },
  {
    heading: 'Menghapus data',
    body: [
      'Kamu dapat menghapus catatan immersion kapan saja dari dalam aplikasi. Untuk menghapus akun beserta seluruh datanya, hubungi alamat email dukungan di bawah.',
    ],
  },
];

const TERMS_SECTIONS: LegalSection[] = [
  {
    heading: 'Penggunaan layanan',
    body: [
      'ImmersionTrack adalah alat bantu pencatatan progres belajar bahasa. Kamu bertanggung jawab atas kebenaran data yang kamu masukkan dan atas keamanan akun Google yang kamu gunakan untuk masuk.',
    ],
  },
  {
    heading: 'Akun',
    body: [
      'Satu akun digunakan untuk satu orang. Kamu tidak diperkenankan membagikan akses akun kepada orang lain atau menggunakan layanan untuk aktivitas yang melanggar hukum.',
    ],
  },
  {
    heading: 'Ketersediaan layanan',
    body: [
      'Layanan disediakan apa adanya. Kami dapat mengubah, menangguhkan, atau menghentikan sebagian fitur untuk perbaikan tanpa pemberitahuan sebelumnya.',
    ],
  },
  {
    heading: 'Batasan tanggung jawab',
    body: [
      'Kami tidak menjamin layanan selalu bebas gangguan atau kehilangan data. Simpan salinan catatan pentingmu sendiri bila diperlukan.',
    ],
  },
];

export const LegalPage: React.FC = () => {
  const { pathname } = useLocation();
  const isTerms = pathname.endsWith('/terms');
  const title = isTerms ? 'Syarat & Ketentuan' : 'Kebijakan Privasi';
  const sections = isTerms ? TERMS_SECTIONS : PRIVACY_SECTIONS;

  return (
    <div className="min-h-screen app-bg-canvas text-slate-900 px-4 py-10">
      <div className="max-w-2xl w-full mx-auto space-y-5">
        <Link
          to="/login"
          className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-rose-600 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Kembali
        </Link>

        <div className="card-pro p-6 sm:p-8 space-y-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/85 border border-rose-200 text-xs font-bold text-rose-700">
              <ShieldCheck className="w-3.5 h-3.5" />
              ImmersionTrack • nihongotracker.my.id
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900">{title}</h1>
            <p className="text-xs font-medium text-slate-500">
              Terakhir diperbarui: 22 November 2026
            </p>
          </div>

          <div className="space-y-5">
            {sections.map((section) => (
              <section key={section.heading} className="space-y-1.5">
                <h2 className="text-sm font-extrabold text-slate-900">
                  {section.heading}
                </h2>
                {section.body.map((paragraph) => (
                  <p
                    key={paragraph.slice(0, 32)}
                    className="text-sm leading-relaxed font-medium text-slate-600"
                  >
                    {paragraph}
                  </p>
                ))}
              </section>
            ))}
          </div>

          <div className="pt-4 border-t border-slate-100 text-xs font-medium text-slate-500">
            <p>
              Pertanyaan? Hubungi{' '}
              <a
                href="mailto:movicbaem@gmail.com"
                className="font-bold text-rose-600 hover:underline"
              >
                movicbaem@gmail.com
              </a>
              .
            </p>
            <p className="mt-1.5">
              {isTerms ? (
                <Link to="/privacy" className="text-rose-600 font-bold hover:underline">
                  Lihat Kebijakan Privasi
                </Link>
              ) : (
                <Link to="/terms" className="text-rose-600 font-bold hover:underline">
                  Lihat Syarat & Ketentuan
                </Link>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LegalPage;
