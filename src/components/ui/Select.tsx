"use client";

import React from "react";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps {
  label?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[] | string[];
  disabled?: boolean;
  required?: boolean;
  error?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function Select({
  label,
  placeholder = "Vyberte...",
  value,
  onChange,
  options,
  disabled = false,
  required = false,
  error,
  className = "",
  size = "md",
}: SelectProps) {
  // Normalize options to SelectOption[]
  const normalizedOptions: SelectOption[] = options.map((opt) =>
    typeof opt === "string" ? { value: opt, label: opt } : opt
  );

  const sizeClasses = {
    sm: "px-2.5 py-1.5 text-xs",
    md: "px-3 py-2.5 text-sm",
    lg: "px-4 py-3 text-base",
  };

  return (
    <div className={className}>
      {label && (
        <label className="mb-2 block text-xs text-slate-400">
          {label}
          {required && <span className="ml-1 text-accentDanger">*</span>}
        </label>
      )}
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          required={required}
          className={`
            w-full appearance-none rounded-xl border bg-slate-800 text-slate-100
            transition-all duration-150
            ${sizeClasses[size]}
            ${
              error
                ? "border-accentDanger focus:border-accentDanger focus:ring-accentDanger/20"
                : "border-borderSoft focus:border-accentPrimary focus:ring-accentPrimary/20"
            }
            ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:border-slate-600"}
            focus:outline-none focus:ring-2
            pr-10
          `}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {normalizedOptions.map((option) => (
            <option
              key={option.value}
              value={option.value}
              disabled={option.disabled}
            >
              {option.label}
            </option>
          ))}
        </select>
        {/* Dropdown arrow */}
        <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M2.5 4.5L6 8L9.5 4.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
      {error && <p className="mt-1.5 text-xs text-accentDanger">{error}</p>}
    </div>
  );
}

// Combobox - Select with search/filter and ability to add new items
interface ComboboxProps {
  label?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[] | string[];
  disabled?: boolean;
  required?: boolean;
  error?: string;
  className?: string;
  allowCreate?: boolean;
  createLabel?: string; // e.g. "+ Přidat novou kategorii"
  onCreateNew?: (value: string) => void;
}

export function Combobox({
  label,
  placeholder = "Vyberte nebo napište...",
  value,
  onChange,
  options,
  disabled = false,
  required = false,
  error,
  className = "",
  allowCreate = false,
  createLabel = "+ Přidat novou",
  onCreateNew,
}: ComboboxProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Normalize options
  const normalizedOptions: SelectOption[] = options.map((opt) =>
    typeof opt === "string" ? { value: opt, label: opt } : opt
  );

  // Filter options based on search
  const filteredOptions = normalizedOptions.filter((opt) =>
    opt.label.toLowerCase().includes(search.toLowerCase())
  );

  // Check if current search matches an existing option
  const searchMatchesExisting = normalizedOptions.some(
    (opt) => opt.label.toLowerCase() === search.toLowerCase()
  );

  // Get display value
  const displayValue =
    normalizedOptions.find((opt) => opt.value === value)?.label || value;

  // Handle click outside
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
    setSearch("");
  };

  const handleCreateNew = () => {
    if (search && onCreateNew) {
      onCreateNew(search);
      onChange(search);
    } else if (search) {
      onChange(search);
    }
    setIsOpen(false);
    setSearch("");
  };

  return (
    <div className={className} ref={containerRef}>
      {label && (
        <label className="mb-2 block text-xs text-slate-400">
          {label}
          {required && <span className="ml-1 text-accentDanger">*</span>}
        </label>
      )}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={isOpen ? search : displayValue}
          onChange={(e) => {
            setSearch(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          className={`
            w-full rounded-xl border bg-slate-800 px-3 py-2.5 text-sm text-slate-100
            transition-all duration-150
            ${
              error
                ? "border-accentDanger focus:border-accentDanger focus:ring-accentDanger/20"
                : "border-borderSoft focus:border-accentPrimary focus:ring-accentPrimary/20"
            }
            ${disabled ? "cursor-not-allowed opacity-50" : ""}
            focus:outline-none focus:ring-2
            pr-10
          `}
        />
        {/* Dropdown arrow */}
        <button
          type="button"
          onClick={() => {
            if (!disabled) {
              setIsOpen(!isOpen);
              if (!isOpen) inputRef.current?.focus();
            }
          }}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
          >
            <path
              d="M2.5 4.5L6 8L9.5 4.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {/* Dropdown */}
        {isOpen && (
          <div className="absolute z-50 mt-1 w-full rounded-xl border border-borderSoft bg-slate-800 py-1 shadow-lg">
            <div className="max-h-48 overflow-y-auto">
              {filteredOptions.length === 0 && !allowCreate && (
                <div className="px-3 py-2 text-sm text-slate-500">
                  Žádné výsledky
                </div>
              )}
              {filteredOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option.value)}
                  disabled={option.disabled}
                  className={`w-full px-3 py-2 text-left text-sm transition-colors
                    ${
                      value === option.value
                        ? "bg-accentPrimary/20 text-accentPrimary"
                        : "text-slate-200 hover:bg-slate-700"
                    }
                    ${option.disabled ? "cursor-not-allowed opacity-50" : ""}
                  `}
                >
                  {option.label}
                </button>
              ))}
              {/* Create new option */}
              {allowCreate && search && !searchMatchesExisting && (
                <button
                  type="button"
                  onClick={handleCreateNew}
                  className="w-full border-t border-borderSoft px-3 py-2 text-left text-sm text-accentPrimary hover:bg-slate-700"
                >
                  {createLabel}: &quot;{search}&quot;
                </button>
              )}
            </div>
          </div>
        )}
      </div>
      {error && <p className="mt-1.5 text-xs text-accentDanger">{error}</p>}
    </div>
  );
}












