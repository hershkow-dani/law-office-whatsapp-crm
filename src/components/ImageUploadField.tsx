import { useRef, useState } from 'react';

const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2MB

export function ImageUploadField({
  value,
  onChange,
  alt,
  round = false,
  size = 56,
}: {
  value: string;
  onChange: (value: string) => void;
  alt: string;
  round?: boolean;
  size?: number;
}) {
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);

    if (!file.type.startsWith('image/')) {
      setError('יש לבחור קובץ תמונה');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError('הקובץ גדול מדי (מקסימום 2MB)');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => onChange(reader.result as string);
    reader.onerror = () => setError('שגיאה בקריאת הקובץ');
    reader.readAsDataURL(file);
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {value ? (
          <img
            src={value}
            alt={alt}
            style={{
              height: size,
              width: size,
              objectFit: 'contain',
              border: '1px solid var(--border)',
              borderRadius: round ? '50%' : 6,
              background: '#fff',
            }}
            onError={() => setError('לא ניתן לטעון את התמונה מהכתובת שהוזנה')}
          />
        ) : (
          <div
            style={{
              height: size,
              width: size,
              border: '1px dashed var(--border)',
              borderRadius: round ? '50%' : 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              color: 'var(--muted)',
              textAlign: 'center',
            }}
          >
            אין תמונה
          </div>
        )}
        <div style={{ display: 'flex', gap: 6 }}>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
          <button type="button" onClick={() => fileInputRef.current?.click()}>
            העלאת תמונה
          </button>
          {value && (
            <button
              type="button"
              className="danger"
              onClick={() => {
                onChange('');
                setError(null);
              }}
            >
              הסרה
            </button>
          )}
        </div>
      </div>
      {error && <span className="status error">{error}</span>}
      <input
        type="text"
        value={value.startsWith('data:') ? '' : value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={value.startsWith('data:') ? 'הועלתה תמונה — אפשר להדביק כאן כתובת URL כדי להחליף אותה' : 'או הדביקו כתובת URL לתמונה'}
        style={{ marginTop: 6 }}
      />
    </div>
  );
}
