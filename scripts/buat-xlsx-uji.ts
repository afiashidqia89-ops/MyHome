// Buat file XLSX uji impor untuk POST /api/master/import
import * as XLSX from "xlsx";

const aoa: (string | number)[][] = [
  ["ESTATE", "KEBUN", "AFDELING", "PERUMAHAN", "TIPE", "KAPASITAS", "LAT", "LNG"],
  ["Estate Kalbar 1", "Kebun Mandor", "Afdeling I", "Perumahan I-5", "Perumahan TK Pemeliharaan", 20, -0.0505, 109.3215],
  ["Estate Kalbar 1", "Kebun Mandor", "Afdeling I", "Perumahan I-6", "", 18, "", ""],
  ["Estate Uji Baru", "Kebun Uji", "Afdeling Uji", "Perumahan Uji-1", "", 12, "", ""],
  ["Estate Kalbar 1", "Kebun Mandor", "Afdeling I", "Perumahan I-1", "", 24, "", ""], // duplikat → dilewati
  ["Estate Kalbar 1", "Kebun Mandor", "", "Perumahan I-9", "", 10, "", ""], // AFDELING kosong → gagal
  ["", "", "", ""], // baris kosong → dilewati diam
];

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), "Data Master");
const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
await Bun.write("/tmp/uji-impor.xlsx", buf);
console.log("File uji dibuat: /tmp/uji-impor.xlsx");

// juga versi header salah untuk uji error
const wb2 = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb2, XLSX.utils.aoa_to_sheet([["NAMA", "ALAMAT"], ["x", "y"]]), "Salah");
const buf2 = XLSX.write(wb2, { type: "buffer", bookType: "xlsx" }) as Buffer;
await Bun.write("/tmp/uji-impor-salah.xlsx", buf2);
console.log("File header-salah dibuat: /tmp/uji-impor-salah.xlsx");
