"use client";

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { XIcon, CameraIcon, ImageIcon, PlusIcon, TrashIcon, PencilIcon } from "lucide-react";
import { useAppSelector } from "@/app/redux";
import { getTranslation } from "@/lib/translations";
import { useCurrency } from "@/lib/useCurrency";
import {
  NewProduct,
  Product,
  useAddVariantMutation,
  useCreateProductMutation,
  useDeleteVariantMutation,
  useUpdateProductMutation,
  useUpdateVariantMutation,
} from "@/state/api";

type ProductFormModalProps = {
  isOpen:  boolean;
  onClose: () => void;
  product?: Product | null; // kosong = mode tambah, ada isi = mode edit
};

// Satu varian (baru maupun yang sedang diubah). Untuk varian yang diubah, key = variantId.
type VariantDraft = {
  key:         string;
  name:        string;       // nama varian (contoh: Safa Ather)
  value:       string;       // ukuran (contoh: 30ml), opsional
  imageUrl:    string | null;
  price:       string;       // hanya angka (contoh: "30000")
  stockGudang: string;
  stockToko:   string;
};

const emptyDraft = (): VariantDraft => ({
  key:         Math.random().toString(36).slice(2),
  name:        "",
  value:       "",
  imageUrl:    null,
  price:       "",
  stockGudang: "0",
  stockToko:   "0",
});

// "" dianggap 0. Mengembalikan null jika bukan bilangan bulat >= 0
const parseStock = (s: string): number | null => {
  if (s.trim() === "") return 0;
  const n = Number(s);
  return Number.isInteger(n) && n >= 0 ? n : null;
};

const parsePrice = (s: string): number | null => {
  if (s.trim() === "") return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

// withStock = false saat mengubah varian lama (stok tidak diubah dari form ini)
const validateDraft = (d: VariantDraft, withStock: boolean): string | null => {
  if (!d.name.trim()) return "Nama varian wajib diisi";
  if (d.price.trim() === "") return "Harga varian wajib diisi";
  if (parsePrice(d.price) === null) return "Harga varian harus berupa angka 0 atau lebih";
  if (withStock) {
    if (parseStock(d.stockGudang) === null) return "Stok gudang varian harus bilangan bulat 0 atau lebih";
    if (parseStock(d.stockToko)   === null) return "Stok toko varian harus bilangan bulat 0 atau lebih";
  }
  return null;
};

const getErrorMessage = (err: unknown): string => {
  const data = (err as { data?: { message?: string } })?.data;
  return data?.message ?? "Terjadi kesalahan. Silakan coba lagi.";
};

// "30000" → "30.000" (pemisah ribuan gaya Indonesia)
const formatDigits = (digits: string): string =>
  digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

// ── Input harga Rupiah: hanya angka, tampil dengan titik ribuan ──
// Titik/koma/huruf yang diketik atau ditempel dibuang, sehingga
// "30.000" dan "30000" sama-sama menjadi 30000.
type PriceInputProps = {
  value:        string;
  onChange:     (digits: string) => void;
  className:    string;
  placeholder?: string;
};

const PriceInput = ({ value, onChange, className, placeholder }: PriceInputProps) => (
  <input
    type="text"
    inputMode="numeric"
    className={className}
    placeholder={placeholder}
    value={formatDigits(value)}
    onChange={(e) =>
      onChange(e.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, ""))
    }
  />
);

// Kompres gambar & ubah ke base64
const compressImage = (file: File, maxSize: number, quality: number): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Gagal membaca file"));
    reader.onloadend = () => {
      const img = document.createElement("img");
      img.onerror = () => reject(new Error("File bukan gambar yang valid"));
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;
        if (width > height) {
          if (width > maxSize) { height = (height * maxSize) / width; width = maxSize; }
        } else {
          if (height > maxSize) { width = (width * maxSize) / height; height = maxSize; }
        }
        canvas.width  = width;
        canvas.height = height;
        canvas.getContext("2d")?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });

// ── Komponen pemilih gambar (dipakai untuk sampul produk & foto varian) ──
type ImagePickerProps = {
  value:      string | null;
  onChange:   (v: string | null) => void;
  onError:    (msg: string) => void;
  isDarkMode: boolean;
  size:       "lg" | "sm";
  emptyText?: string;
};

const ImagePicker = ({ value, onChange, onError, isDarkMode, size, emptyText }: ImagePickerProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const isLarge  = size === "lg";

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      onError("Ukuran foto maksimal 5MB");
      return;
    }
    try {
      onChange(await compressImage(file, isLarge ? 400 : 300, 0.8));
    } catch (err) {
      onError(err instanceof Error ? err.message : "Gagal memproses gambar");
    }
    if (inputRef.current) inputRef.current.value = "";
  };

  const boxSize = isLarge ? "h-36 w-36" : "h-20 w-20";

  return (
    <div className="flex flex-col items-center">
      {value ? (
        <div className="relative">
          <Image
            src={value}
            alt="Foto"
            width={isLarge ? 150 : 80}
            height={isLarge ? 150 : 80}
            unoptimized
            className={`${boxSize} rounded-2xl object-cover border-2 border-blue-400`}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="absolute bottom-1 right-1 rounded-full bg-blue-500 p-1.5 text-white shadow hover:bg-blue-600"
            aria-label="Ganti foto"
          >
            <CameraIcon className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={`${boxSize} flex flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed transition-colors ${
            isDarkMode
              ? "border-gray-600 hover:border-blue-500 hover:bg-gray-700"
              : "border-gray-300 hover:border-blue-400 hover:bg-blue-50"
          }`}
        >
          <ImageIcon className={`${isLarge ? "h-8 w-8" : "h-5 w-5"} ${isDarkMode ? "text-gray-500" : "text-gray-400"}`} />
          <span className={`px-1 text-center text-[10px] ${isDarkMode ? "text-gray-500" : "text-gray-400"}`}>
            {emptyText ?? "Upload"}
          </span>
        </button>
      )}
      {value && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className={`mt-1 text-xs underline ${isDarkMode ? "text-red-400" : "text-red-500"}`}
        >
          Hapus foto
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  );
};

const ProductFormModal = ({ isOpen, onClose, product }: ProductFormModalProps) => {
  const isEdit = !!product;

  const isDarkMode = useAppSelector((state) => state.global.isDarkMode);
  const t = getTranslation().products;
  const { formatCurrency } = useCurrency();

  const [createProduct, { isLoading: isCreating }] = useCreateProductMutation();
  const [updateProduct, { isLoading: isUpdating }] = useUpdateProductMutation();
  const [addVariant,    { isLoading: isAddingVariant }]   = useAddVariantMutation();
  const [updateVariant, { isLoading: isUpdatingVariant }] = useUpdateVariantMutation();
  const [deleteVariant] = useDeleteVariantMutation();

  const [form, setForm] = useState({ name: "", category: "", description: "" });
  const [image,      setImage]      = useState<string | null>(null);        // foto sampul produk
  const [drafts,     setDrafts]     = useState<VariantDraft[]>([]);          // varian baru (mode tambah)
  const [newVariant, setNewVariant] = useState<VariantDraft | null>(null);   // varian baru (mode edit)
  const [editing,    setEditing]    = useState<VariantDraft | null>(null);   // varian lama yang diubah
  const [error,      setError]      = useState<string | null>(null);

  // Isi ulang form setiap modal dibuka atau produk yang diedit berganti
  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setDrafts([]);
    setNewVariant(null);
    setEditing(null);
    if (product) {
      setForm({
        name:        product.name,
        category:    product.category    ?? "",
        description: product.description ?? "",
      });
      setImage(product.imageUrl ?? null);
    } else {
      setForm({ name: "", category: "", description: "" });
      setImage(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, product?.productId]);

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  // ── Submit: tambah / edit produk ──
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!form.name.trim()) { setError("Nama produk wajib diisi"); return; }

    try {
      if (isEdit && product) {
        await updateProduct({
          productId:   product.productId,
          name:        form.name.trim(),
          description: form.description.trim(),
          category:    form.category.trim(),
          imageUrl:    image,
        }).unwrap();
        onClose();
        return;
      }

      // Mode tambah: wajib minimal 1 varian
      if (drafts.length === 0) {
        setError("Produk wajib memiliki minimal 1 varian. Klik \"Tambah varian\" untuk mengisi harga dan stok.");
        return;
      }
      for (let i = 0; i < drafts.length; i++) {
        const err = validateDraft(drafts[i], true);
        if (err) { setError(`Varian ${i + 1}: ${err}`); return; }
      }

      const body: NewProduct = {
        name:        form.name.trim(),
        description: form.description.trim() || undefined,
        category:    form.category.trim()    || undefined,
        imageUrl:    image,
        variants: drafts.map((d) => ({
          name:        d.name.trim(),
          value:       d.value.trim() || undefined,
          imageUrl:    d.imageUrl,
          price:       parsePrice(d.price) ?? 0,
          stockGudang: parseStock(d.stockGudang) ?? 0,
          stockToko:   parseStock(d.stockToko)   ?? 0,
        })),
      };

      await createProduct(body).unwrap();
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  // ── Mode edit: tambah varian baru ──
  const handleAddVariant = async () => {
    if (!product || !newVariant) return;
    setError(null);
    const err = validateDraft(newVariant, true);
    if (err) { setError(err); return; }
    try {
      await addVariant({
        productId:   product.productId,
        name:        newVariant.name.trim(),
        value:       newVariant.value.trim() || undefined,
        imageUrl:    newVariant.imageUrl,
        price:       parsePrice(newVariant.price) ?? 0,
        stockGudang: parseStock(newVariant.stockGudang) ?? 0,
        stockToko:   parseStock(newVariant.stockToko)   ?? 0,
      }).unwrap();
      setNewVariant(null);
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  // ── Mode edit: simpan perubahan varian lama ──
  const handleSaveVariant = async () => {
    if (!product || !editing) return;
    setError(null);
    const err = validateDraft(editing, false);
    if (err) { setError(err); return; }
    try {
      await updateVariant({
        productId: product.productId,
        variantId: editing.key,
        name:      editing.name.trim(),
        value:     editing.value.trim() || "-",
        imageUrl:  editing.imageUrl,
        price:     parsePrice(editing.price) ?? 0,
      }).unwrap();
      setEditing(null);
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  // ── Mode edit: hapus varian ──
  const handleDeleteVariant = async (variantId: string, label: string) => {
    if (!product) return;
    if (product.Variants.length <= 1) {
      setError("Produk wajib memiliki minimal 1 varian. Tambah varian lain dulu, atau hapus produknya.");
      return;
    }
    if (!window.confirm(`Hapus varian "${label}"? Stok dan harga produk akan dihitung ulang.`)) return;
    setError(null);
    try {
      await deleteVariant({ productId: product.productId, variantId }).unwrap();
      if (editing?.key === variantId) setEditing(null);
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  if (!isOpen) return null;

  const isSaving = isCreating || isUpdating;

  const labelCss = `block text-sm font-medium mb-1 ${isDarkMode ? "text-gray-300" : "text-gray-700"}`;
  const inputCss = `mb-4 block w-full rounded-lg border-2 p-2.5 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
    isDarkMode
      ? "border-gray-600 bg-gray-700 text-gray-100 placeholder-gray-400"
      : "border-gray-300 bg-white text-gray-900 placeholder-gray-400"
  }`;
  const smallInputCss = `w-full rounded-lg border p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
    isDarkMode
      ? "border-gray-600 bg-gray-700 text-gray-100 placeholder-gray-400"
      : "border-gray-300 bg-white text-gray-900 placeholder-gray-400"
  }`;
  const boxCss = `rounded-xl border p-3 ${
    isDarkMode ? "border-gray-600 bg-gray-700/40" : "border-gray-200 bg-gray-50"
  }`;
  const mutedCss = isDarkMode ? "text-gray-400" : "text-gray-500";

  // Isian satu varian: foto, nama, ukuran, harga, (stok awal)
  const renderVariantFields = (
    d: VariantDraft,
    onChange: (next: VariantDraft) => void,
    withStock: boolean
  ) => (
    <div className="flex gap-3">
      <div className="shrink-0">
        <ImagePicker
          size="sm"
          value={d.imageUrl}
          onChange={(v) => onChange({ ...d, imageUrl: v })}
          onError={setError}
          isDarkMode={isDarkMode}
          emptyText="Foto varian"
        />
      </div>
      <div className="grid flex-1 grid-cols-2 gap-2">
        <div className="col-span-2">
          <label className={`${mutedCss} text-xs`}>Nama varian *</label>
          <input
            className={smallInputCss}
            placeholder="contoh: Safa Ather"
            value={d.name}
            onChange={(e) => onChange({ ...d, name: e.target.value })}
          />
        </div>
        <div>
          <label className={`${mutedCss} text-xs`}>Ukuran (opsional)</label>
          <input
            className={smallInputCss}
            placeholder="contoh: 30ml"
            value={d.value}
            onChange={(e) => onChange({ ...d, value: e.target.value })}
          />
        </div>
        <div>
          <label className={`${mutedCss} text-xs`}>Harga (Rp) *</label>
          <PriceInput
            className={smallInputCss}
            placeholder="contoh: 50.000"
            value={d.price}
            onChange={(digits) => onChange({ ...d, price: digits })}
          />
        </div>
        {withStock && (
          <>
            <div>
              <label className={`${mutedCss} text-xs`}>Stok awal Gudang</label>
              <input
                type="number"
                min="0"
                className={smallInputCss}
                value={d.stockGudang}
                onChange={(e) => onChange({ ...d, stockGudang: e.target.value })}
              />
            </div>
            <div>
              <label className={`${mutedCss} text-xs`}>Stok awal Toko</label>
              <input
                type="number"
                min="0"
                className={smallInputCss}
                value={d.stockToko}
                onChange={(e) => onChange({ ...d, stockToko: e.target.value })}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal card */}
      <div
        className={`relative z-50 mx-4 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl p-6 shadow-2xl ${
          isDarkMode ? "bg-gray-800 text-gray-100" : "bg-white text-gray-800"
        }`}
      >
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold">{isEdit ? "Edit Produk" : t.createProduct}</h2>
          <button
            type="button"
            onClick={onClose}
            className={`rounded-lg p-1.5 transition-colors ${
              isDarkMode
                ? "text-gray-400 hover:bg-gray-700 hover:text-gray-200"
                : "text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            }`}
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Pesan error */}
        {error && (
          <div className="mb-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* ── Foto sampul produk ── */}
          <label className={labelCss}>Foto Sampul Produk</label>
          <div className="mb-4 flex justify-center">
            <ImagePicker
              size="lg"
              value={image}
              onChange={setImage}
              onError={setError}
              isDarkMode={isDarkMode}
              emptyText="Klik untuk upload gambar"
            />
          </div>

          {/* Nama */}
          <label className={labelCss}>{t.labelName}</label>
          <input
            type="text"
            name="name"
            placeholder={t.placeholderName}
            value={form.name}
            onChange={handleChange}
            className={inputCss}
          />

          {/* Kategori */}
          <label className={labelCss}>Kategori</label>
          <input
            type="text"
            name="category"
            placeholder="contoh: Parfum Wanita"
            value={form.category}
            onChange={handleChange}
            className={inputCss}
          />

          {/* Deskripsi */}
          <label className={labelCss}>Deskripsi</label>
          <textarea
            name="description"
            rows={2}
            placeholder="Deskripsi singkat produk (opsional)"
            value={form.description}
            onChange={handleChange}
            className={inputCss}
          />

          {/* ───────── MODE TAMBAH: varian ───────── */}
          {!isEdit && (
            <div className="mb-4">
              <p className={`mb-1 text-sm font-medium ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}>
                Varian *
              </p>
              <p className={`mb-3 text-xs ${mutedCss}`}>
                Harga, stok awal, dan foto diisi per varian. Produk wajib punya minimal 1 varian.
                Harga produk yang tampil adalah harga terendah dari variannya.
              </p>

              <div className="space-y-3">
                {drafts.map((d, idx) => (
                  <div key={d.key} className={boxCss}>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm font-semibold">Varian {idx + 1}</span>
                      <button
                        type="button"
                        onClick={() => setDrafts((prev) => prev.filter((x) => x.key !== d.key))}
                        className="text-red-500 hover:text-red-600"
                        aria-label="Hapus varian"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                    {renderVariantFields(
                      d,
                      (next) => setDrafts((prev) => prev.map((x) => (x.key === d.key ? next : x))),
                      true
                    )}
                    {parsePrice(d.price) !== null && Number(d.price) > 0 && (
                      <p className={`mt-2 text-xs ${mutedCss}`}>
                        Preview harga: <span className="font-semibold">{formatCurrency(Number(d.price))}</span>
                      </p>
                    )}
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setDrafts((prev) => [...prev, emptyDraft()])}
                className="mt-3 flex items-center gap-1 text-sm font-medium text-blue-500 hover:text-blue-600"
              >
                <PlusIcon className="h-4 w-4" />
                Tambah varian
              </button>
            </div>
          )}

          {/* ───────── MODE EDIT: kelola varian ───────── */}
          {isEdit && product && (
            <div className="mb-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className={`text-sm font-medium ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}>Varian</p>
                <p className={`text-right text-xs ${mutedCss}`}>
                  Mulai dari {formatCurrency(product.price)} · Gudang {product.stockGudang} · Toko {product.stockToko}
                </p>
              </div>

              {product.Variants.length === 0 && (
                <p className={`mb-2 text-xs ${mutedCss}`}>
                  Produk ini belum punya varian. Tambahkan minimal 1 varian di bawah.
                </p>
              )}

              <div className="space-y-2">
                {product.Variants.map((v) => {
                  const isEditingThis = editing?.key === v.variantId;
                  const sizeLabel = v.value && v.value !== "-" ? v.value : "";
                  return (
                    <div key={v.variantId} className={boxCss}>
                      {isEditingThis && editing ? (
                        <div className="space-y-2">
                          {renderVariantFields(editing, setEditing, false)}
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setEditing(null)}
                              className={`rounded-lg px-3 py-1.5 text-xs ${
                                isDarkMode ? "bg-gray-700 text-gray-200" : "bg-gray-100 text-gray-700"
                              }`}
                            >
                              {t.cancel}
                            </button>
                            <button
                              type="button"
                              disabled={isUpdatingVariant}
                              onClick={handleSaveVariant}
                              className="rounded-lg bg-blue-500 px-3 py-1.5 text-xs text-white hover:bg-blue-600 disabled:opacity-60"
                            >
                              Simpan varian
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-3">
                            {v.imageUrl ? (
                              <Image
                                src={v.imageUrl}
                                alt={v.name}
                                width={44}
                                height={44}
                                unoptimized
                                className="h-11 w-11 shrink-0 rounded-lg object-cover"
                              />
                            ) : (
                              <div
                                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${
                                  isDarkMode ? "bg-gray-600" : "bg-gray-200"
                                }`}
                              >
                                <ImageIcon className="h-5 w-5 text-gray-400" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold">
                                {v.name}
                                {sizeLabel && (
                                  <span className={`ml-1 text-xs font-normal ${mutedCss}`}>· {sizeLabel}</span>
                                )}
                              </p>
                              <p className={`text-xs ${mutedCss}`}>
                                {v.price != null ? formatCurrency(v.price) : "Harga belum diisi"} ·
                                {" "}Gudang {v.stockGudang} · Toko {v.stockToko}
                              </p>
                            </div>
                          </div>
                          <div className="flex shrink-0 gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                setEditing({
                                  key:         v.variantId,
                                  name:        v.name,
                                  value:       sizeLabel,
                                  imageUrl:    v.imageUrl ?? null,
                                  price:       v.price != null ? String(Math.round(v.price)) : "",
                                  stockGudang: "0",
                                  stockToko:   "0",
                                })
                              }
                              className="text-blue-500 hover:text-blue-600"
                              aria-label="Ubah varian"
                            >
                              <PencilIcon className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteVariant(v.variantId, v.name)}
                              className="text-red-500 hover:text-red-600"
                              aria-label="Hapus varian"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <p className={`mt-2 text-xs ${mutedCss}`}>
                Stok varian diubah lewat restock, purchase order, dan transaksi, bukan dari form ini.
              </p>

              {/* Tambah varian baru */}
              {newVariant ? (
                <div className={`mt-3 ${boxCss}`}>
                  <p className="mb-2 text-sm font-semibold">Varian baru</p>
                  {renderVariantFields(newVariant, setNewVariant, true)}
                  {parsePrice(newVariant.price) !== null && Number(newVariant.price) > 0 && (
                    <p className={`mt-2 text-xs ${mutedCss}`}>
                      Preview harga: <span className="font-semibold">{formatCurrency(Number(newVariant.price))}</span>
                    </p>
                  )}
                  <div className="mt-3 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setNewVariant(null)}
                      className={`rounded-lg px-3 py-1.5 text-xs ${
                        isDarkMode ? "bg-gray-700 text-gray-200" : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {t.cancel}
                    </button>
                    <button
                      type="button"
                      disabled={isAddingVariant}
                      onClick={handleAddVariant}
                      className="rounded-lg bg-blue-500 px-3 py-1.5 text-xs text-white hover:bg-blue-600 disabled:opacity-60"
                    >
                      Simpan varian baru
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setNewVariant(emptyDraft())}
                  className="mt-3 flex items-center gap-1 text-sm font-medium text-blue-500 hover:text-blue-600"
                >
                  <PlusIcon className="h-4 w-4" />
                  Tambah varian
                </button>
              )}
            </div>
          )}

          {/* Aksi */}
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                isDarkMode
                  ? "bg-gray-700 text-gray-200 hover:bg-gray-600"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {isEdit ? "Tutup" : t.cancel}
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-600 disabled:opacity-60"
            >
              {isSaving ? "Menyimpan..." : isEdit ? "Simpan perubahan" : t.create}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProductFormModal;