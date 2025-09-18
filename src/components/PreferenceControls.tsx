/**
 * Individual Preference Controls for Kid-Friendly AI
 * Provides various input types for different preference data types
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  UserPreference,
  PreferenceControlProps,
  PreferenceValidationResult,
  PreferenceDataType
} from '../types/preferences';

interface PreferenceControlsProps {
  preference: UserPreference;
  value: any;
  onChange: (value: any) => void;
  onReset: () => void;
  onFavorite: () => void;
  isModified: boolean;
  isFavorite: boolean;
  isReadOnly: boolean;
  showDescription: boolean;
  showValidation: boolean;
  validation?: PreferenceValidationResult;
  className?: string;
}

export const PreferenceControls: React.FC<PreferenceControlsProps> = ({
  preference,
  value,
  onChange,
  onReset,
  onFavorite,
  isModified,
  isFavorite,
  isReadOnly,
  showDescription,
  showValidation,
  validation,
  className = ''
}) => {
  const [localValue, setLocalValue] = useState(value);
  const [isFocused, setIsFocused] = useState(false);
  const debouncedTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleValueChange = (newValue: any) => {
    setLocalValue(newValue);

    // Debounce the change to avoid excessive updates
    if (debouncedTimeoutRef.current) {
      clearTimeout(debouncedTimeoutRef.current);
    }

    debouncedTimeoutRef.current = setTimeout(() => {
      onChange(newValue);
    }, 300);
  };

  const handleReset = () => {
    onReset();
    setLocalValue(preference.defaultValue);
  };

  const handleToggleFavorite = () => {
    onFavorite();
  };

  const renderControl = () => {
    switch (preference.dataType) {
      case 'boolean':
        return (
          <BooleanControl
            value={localValue}
            onChange={handleValueChange}
            disabled={isReadOnly}
            preference={preference}
          />
        );
      case 'string':
        return (
          <StringControl
            value={localValue}
            onChange={handleValueChange}
            disabled={isReadOnly}
            preference={preference}
          />
        );
      case 'number':
        return (
          <NumberControl
            value={localValue}
            onChange={handleValueChange}
            disabled={isReadOnly}
            preference={preference}
          />
        );
      case 'range':
        return (
          <RangeControl
            value={localValue}
            onChange={handleValueChange}
            disabled={isReadOnly}
            preference={preference}
          />
        );
      case 'select':
        return (
          <SelectControl
            value={localValue}
            onChange={handleValueChange}
            disabled={isReadOnly}
            preference={preference}
          />
        );
      case 'color':
        return (
          <ColorControl
            value={localValue}
            onChange={handleValueChange}
            disabled={isReadOnly}
            preference={preference}
          />
        );
      case 'multiselect':
        return (
          <MultiSelectControl
            value={localValue}
            onChange={handleValueChange}
            disabled={isReadOnly}
            preference={preference}
          />
        );
      default:
        return (
          <div className="text-gray-500 italic">
            Unknown control type: {preference.dataType}
          </div>
        );
    }
  };

  const getValidationSeverity = () => {
    if (!validation || validation.isValid) return null;
    const hasError = validation.violations.some(v => v.severity === 'error');
    return hasError ? 'error' : 'warning';
  };

  const validationSeverity = getValidationSeverity();

  return (
    <div
      className={`preference-control ${className} ${isModified ? 'modified' : ''} ${
        validationSeverity ? `validation-${validationSeverity}` : ''
      } ${isReadOnly ? 'read-only' : ''}`}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
    >
      <div className="preference-header">
        <div className="preference-title">
          <h3 className="preference-name">{preference.id.replace(/_/g, ' ')}</h3>
          {isFavorite && <span className="favorite-indicator">⭐</span>}
          {isModified && <span className="modified-indicator">●</span>}
          {preference.isAgeRestricted && (
            <span className="age-restricted-indicator" title={`Age ${preference.minAge}-${preference.maxAge}`}>
              👶
            </span>
          )}
        </div>

        <div className="preference-actions">
          <button
            onClick={handleToggleFavorite}
            className={`action-button favorite-button ${isFavorite ? 'active' : ''}`}
            title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            {isFavorite ? '★' : '☆'}
          </button>

          {isModified && !isReadOnly && (
            <button
              onClick={handleReset}
              className="action-button reset-button"
              title="Reset to default"
              aria-label="Reset to default"
            >
              ↺
            </button>
          )}
        </div>
      </div>

      <div className="preference-control-container">
        {renderControl()}
      </div>

      {showDescription && (
        <p className="preference-description">{preference.description}</p>
      )}

      {showValidation && validation && !validation.isValid && (
        <div className="validation-messages">
          {validation.violations.map((violation, index) => (
            <div
              key={index}
              className={`validation-message ${violation.severity}`}
            >
              <span className="validation-icon">
                {violation.severity === 'error' ? '❌' : '⚠️'}
              </span>
              {violation.message}
            </div>
          ))}
          {validation.suggestions.length > 0 && (
            <div className="validation-suggestions">
              <strong>Suggestions:</strong>
              <ul>
                {validation.suggestions.map((suggestion, index) => (
                  <li key={index}>{suggestion}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        .preference-control {
          padding: 1rem;
          border: 1px solid #e5e7eb;
          border-radius: 0.5rem;
          margin-bottom: 1rem;
          transition: all 0.2s ease;
          background: white;
        }

        .preference-control:hover {
          border-color: #d1d5db;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .preference-control.modified {
          border-left: 4px solid #3b82f6;
          background: #f8fafc;
        }

        .preference-control.validation-error {
          border-left: 4px solid #ef4444;
        }

        .preference-control.validation-warning {
          border-left: 4px solid #f59e0b;
        }

        .preference-control.read-only {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .preference-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.75rem;
        }

        .preference-title {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .preference-name {
          margin: 0;
          font-size: 1rem;
          font-weight: 600;
          color: #1f2937;
        }

        .favorite-indicator {
          color: #fbbf24;
        }

        .modified-indicator {
          color: #3b82f6;
          font-size: 0.75rem;
        }

        .age-restricted-indicator {
          font-size: 0.875rem;
        }

        .preference-actions {
          display: flex;
          gap: 0.5rem;
        }

        .action-button {
          background: none;
          border: 1px solid #d1d5db;
          border-radius: 0.25rem;
          padding: 0.25rem 0.5rem;
          cursor: pointer;
          font-size: 0.875rem;
          transition: all 0.2s ease;
        }

        .action-button:hover {
          background: #f3f4f6;
        }

        .action-button.favorite-button.active {
          color: #fbbf24;
          border-color: #fbbf24;
        }

        .action-button.reset-button {
          color: #6b7280;
        }

        .preference-control-container {
          margin-bottom: 0.5rem;
        }

        .preference-description {
          margin: 0.5rem 0;
          font-size: 0.875rem;
          color: #6b7280;
          line-height: 1.4;
        }

        .validation-messages {
          margin-top: 0.75rem;
        }

        .validation-message {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem;
          border-radius: 0.25rem;
          font-size: 0.875rem;
          margin-bottom: 0.25rem;
        }

        .validation-message.error {
          background: #fef2f2;
          color: #dc2626;
          border: 1px solid #fecaca;
        }

        .validation-message.warning {
          background: #fffbeb;
          color: #d97706;
          border: 1px solid #fed7aa;
        }

        .validation-suggestions {
          margin-top: 0.5rem;
          padding: 0.5rem;
          background: #f0f9ff;
          border-radius: 0.25rem;
          font-size: 0.875rem;
        }

        .validation-suggestions ul {
          margin: 0.25rem 0 0 1rem;
          padding: 0;
        }

        .validation-suggestions li {
          margin-bottom: 0.25rem;
        }
      `}</style>
    </div>
  );
};

// Boolean Control Component
const BooleanControl: React.FC<{
  value: boolean;
  onChange: (value: boolean) => void;
  disabled: boolean;
  preference: UserPreference;
}> = ({ value, onChange, disabled, preference }) => {
  return (
    <div className="boolean-control">
      <label className="toggle-switch">
        <input
          type="checkbox"
          checked={value}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className="toggle-input"
        />
        <span className="toggle-slider"></span>
        <span className="toggle-label">
          {value ? 'On' : 'Off'}
        </span>
      </label>

      <style jsx>{`
        .toggle-switch {
          position: relative;
          display: inline-block;
          width: 60px;
          height: 34px;
          margin: 0;
        }

        .toggle-input {
          opacity: 0;
          width: 0;
          height: 0;
        }

        .toggle-slider {
          position: absolute;
          cursor: pointer;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: #ccc;
          transition: 0.4s;
          border-radius: 34px;
        }

        .toggle-slider:before {
          position: absolute;
          content: "";
          height: 26px;
          width: 26px;
          left: 4px;
          bottom: 4px;
          background-color: white;
          transition: 0.4s;
          border-radius: 50%;
        }

        .toggle-input:checked + .toggle-slider {
          background-color: #3b82f6;
        }

        .toggle-input:checked + .toggle-slider:before {
          transform: translateX(26px);
        }

        .toggle-label {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-size: 0.875rem;
          font-weight: 500;
          pointer-events: none;
          color: white;
        }
      `}</style>
    </div>
  );
};

// String Control Component
const StringControl: React.FC<{
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  preference: UserPreference;
}> = ({ value, onChange, disabled, preference }) => {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="string-input"
      placeholder={preference.description}
    />
  );
};

// Number Control Component
const NumberControl: React.FC<{
  value: number;
  onChange: (value: number) => void;
  disabled: boolean;
  preference: UserPreference;
}> = ({ value, onChange, disabled }) => {
  return (
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      disabled={disabled}
      className="number-input"
    />
  );
};

// Range Control Component
const RangeControl: React.FC<{
  value: number;
  onChange: (value: number) => void;
  disabled: boolean;
  preference: UserPreference;
}> = ({ value, onChange, disabled, preference }) => {
  // Determine min/max values based on preference key
  const getRangeProps = () => {
    switch (preference.key) {
      case 'appearance.typography.fontSize':
        return { min: 12, max: 24, step: 1 };
      case 'sound.volume.master':
        return { min: 0, max: 1, step: 0.1 };
      case 'parental.time.limits.daily':
        return { min: 10, max: 300, step: 5 };
      default:
        return { min: 0, max: 100, step: 1 };
    }
  };

  const { min, max, step } = getRangeProps();

  return (
    <div className="range-control">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        className="range-input"
      />
      <div className="range-value-display">
        <span className="range-value">{value}</span>
        <span className="range-min">{min}</span>
        <span className="range-max">{max}</span>
      </div>

      <style jsx>{`
        .range-control {
          width: 100%;
        }

        .range-input {
          width: 100%;
          height: 6px;
          border-radius: 3px;
          background: #e5e7eb;
          outline: none;
          -webkit-appearance: none;
          margin-bottom: 0.5rem;
        }

        .range-input::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
        }

        .range-input::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: none;
        }

        .range-value-display {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.875rem;
          color: #6b7280;
        }

        .range-value {
          font-weight: 600;
          color: #1f2937;
        }
      `}</style>
    </div>
  );
};

// Select Control Component
const SelectControl: React.FC<{
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  preference: UserPreference;
}> = ({ value, onChange, disabled, preference }) => {
  // Get options based on preference key
  const getOptions = () => {
    switch (preference.key) {
      case 'appearance.theme.mode':
        return [
          { value: 'light', label: 'Light' },
          { value: 'dark', label: 'Dark' },
          { value: 'auto', label: 'Auto' }
        ];
      case 'behavior.response.speed':
        return [
          { value: 'slow', label: 'Slow' },
          { value: 'normal', label: 'Normal' },
          { value: 'fast', label: 'Fast' }
        ];
      case 'parental.control.level':
        return [
          { value: 'low', label: 'Low' },
          { value: 'medium', label: 'Medium' },
          { value: 'high', label: 'High' }
        ];
      case 'privacy.data.retention':
        return [
          { value: 7, label: '7 days' },
          { value: 30, label: '30 days' },
          { value: 90, label: '90 days' },
          { value: 365, label: '1 year' }
        ];
      default:
        return [];
    }
  };

  const options = getOptions();

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="select-input"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
};

// Color Control Component
const ColorControl: React.FC<{
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  preference: UserPreference;
}> = ({ value, onChange, disabled }) => {
  const presetColors = [
    '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
    '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16'
  ];

  return (
    <div className="color-control">
      <div className="color-picker-wrapper">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="color-input"
        />
        <span className="color-value">{value}</span>
      </div>

      <div className="color-presets">
        {presetColors.map((color) => (
          <button
            key={color}
            onClick={() => onChange(color)}
            disabled={disabled}
            className={`color-preset ${value === color ? 'active' : ''}`}
            style={{ backgroundColor: color }}
            title={color}
            aria-label={`Select color ${color}`}
          />
        ))}
      </div>

      <style jsx>{`
        .color-control {
          width: 100%;
        }

        .color-picker-wrapper {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 0.5rem;
        }

        .color-input {
          width: 50px;
          height: 50px;
          border: 2px solid #e5e7eb;
          border-radius: 0.5rem;
          cursor: pointer;
          padding: 0;
        }

        .color-value {
          font-family: monospace;
          font-size: 0.875rem;
          color: #6b7280;
        }

        .color-presets {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .color-preset {
          width: 30px;
          height: 30px;
          border: 2px solid #e5e7eb;
          border-radius: 0.25rem;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .color-preset:hover {
          transform: scale(1.1);
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .color-preset.active {
          border-color: #1f2937;
          box-shadow: 0 0 0 2px #3b82f6;
        }
      `}</style>
    </div>
  );
};

// Multi-Select Control Component
const MultiSelectControl: React.FC<{
  value: string[];
  onChange: (value: string[]) => void;
  disabled: boolean;
  preference: UserPreference;
}> = ({ value, onChange, disabled, preference }) => {
  // Get options based on preference key
  const getOptions = () => {
    switch (preference.key) {
      case 'accessibility.features':
        return [
          { value: 'screen_reader', label: 'Screen Reader' },
          { value: 'high_contrast', label: 'High Contrast' },
          { value: 'large_text', label: 'Large Text' },
          { value: 'reduced_motion', label: 'Reduced Motion' }
        ];
      default:
        return [];
    }
  };

  const options = getOptions();

  const handleOptionChange = (optionValue: string, checked: boolean) => {
    if (checked) {
      onChange([...value, optionValue]);
    } else {
      onChange(value.filter(v => v !== optionValue));
    }
  };

  return (
    <div className="multiselect-control">
      {options.map((option) => (
        <label key={option.value} className="multiselect-option">
          <input
            type="checkbox"
            checked={value.includes(option.value)}
            onChange={(e) => handleOptionChange(option.value, e.target.checked)}
            disabled={disabled}
            className="multiselect-input"
          />
          <span className="multiselect-label">{option.label}</span>
        </label>
      ))}

      <style jsx>{`
        .multiselect-control {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .multiselect-option {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          cursor: pointer;
          padding: 0.25rem;
          border-radius: 0.25rem;
          transition: background-color 0.2s ease;
        }

        .multiselect-option:hover {
          background-color: #f3f4f6;
        }

        .multiselect-input {
          width: 16px;
          height: 16px;
          cursor: pointer;
        }

        .multiselect-label {
          font-size: 0.875rem;
          color: #1f2937;
        }
      `}</style>
    </div>
  );
};

export default PreferenceControls;