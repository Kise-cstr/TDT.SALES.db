import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export default function PasswordField({
  value,
  onChange,
  placeholder,
  required = false,
  autoComplete,
  name,
  id,
  onBlur,
  onFocus,
  disabled = false,
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="password-input-shell">
      <input
        id={id}
        name={name}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        onFocus={onFocus}
        placeholder={placeholder}
        required={required}
        autoComplete={autoComplete}
        disabled={disabled}
      />
      <button
        className="password-visibility-btn"
        type="button"
        onClick={() => setVisible(current => !current)}
        aria-label={visible ? 'Hide password' : 'Show password'}
      >
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}
