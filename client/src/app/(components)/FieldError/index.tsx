// Pesan error di bawah satu kolom form (tidak tampil jika kosong)
const FieldError = ({ message }: { message?: string }) =>
  message ? (
    <p role="alert" className="mt-1 text-xs font-medium text-red-500 dark:text-red-400">
      {message}
    </p>
  ) : null;

export default FieldError;
