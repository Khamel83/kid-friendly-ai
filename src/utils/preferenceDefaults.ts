/**
 * Preference Defaults and Validation for Kid-Friendly AI
 * Provides age-appropriate defaults, validation rules, and migration scripts
 */

import {
  UserPreference,
  PreferenceCategory,
  PreferenceValidationRule,
  PreferenceConstraint,
  PreferencePreset,
  PreferenceValidationResult,
  PreferenceConstraintViolation,
  PreferenceDataType
} from '../types/preferences';
import { ParentalControlLevel } from '../types/parental';

export class PreferenceDefaults {
  private static readonly PREFERENCES_VERSION = '1.0.0';

  // Age group definitions for preference defaults
  static readonly AGE_GROUPS = {
    TODDLER: { min: 2, max: 4, name: 'Toddler (2-4)' },
    PRESCHOOL: { min: 5, max: 7, name: 'Preschool (5-7)' },
    ELEMENTARY: { min: 8, max: 12, name: 'Elementary (8-12)' },
    TEEN: { min: 13, max: 17, name: 'Teen (13-17)' }
  };

  // Default preferences by category
  static readonly DEFAULT_CATEGORIES: PreferenceCategory[] = [
    {
      id: 'appearance',
      name: 'Appearance',
      description: 'Customize how the app looks and feels',
      icon: '🎨',
      color: '#8B5CF6',
      order: 1,
      isCollapsed: false,
      isParentalOnly: false,
      preferences: []
    },
    {
      id: 'behavior',
      name: 'Behavior',
      description: 'Control how the app behaves and responds',
      icon: '⚙️',
      color: '#10B981',
      order: 2,
      isCollapsed: false,
      isParentalOnly: false,
      preferences: []
    },
    {
      id: 'accessibility',
      name: 'Accessibility',
      description: 'Make the app easier to use for everyone',
      icon: '♿',
      color: '#F59E0B',
      order: 3,
      isCollapsed: false,
      isParentalOnly: false,
      preferences: []
    },
    {
      id: 'parental',
      name: 'Parental Controls',
      description: 'Manage safety and privacy settings',
      icon: '👨‍👩‍👧‍👦',
      color: '#EF4444',
      order: 4,
      isCollapsed: false,
      isParentalOnly: true,
      preferences: []
    },
    {
      id: 'sound',
      name: 'Sound & Audio',
      description: 'Control sound effects and audio settings',
      icon: '🔊',
      color: '#3B82F6',
      order: 5,
      isCollapsed: false,
      isParentalOnly: false,
      preferences: []
    },
    {
      id: 'privacy',
      name: 'Privacy & Data',
      description: 'Manage your data and privacy settings',
      icon: '🔒',
      color: '#6366F1',
      order: 6,
      isCollapsed: false,
      isParentalOnly: false,
      preferences: []
    },
    {
      id: 'advanced',
      name: 'Advanced',
      description: 'Advanced settings and debugging options',
      icon: '🔧',
      color: '#6B7280',
      order: 7,
      isCollapsed: true,
      isParentalOnly: true,
      preferences: []
    }
  ];

  // Default preference definitions
  static readonly DEFAULT_PREFERENCES: UserPreference[] = [
    // Appearance preferences
    {
      id: 'theme_mode',
      key: 'appearance.theme.mode',
      value: 'auto',
      category: 'appearance' as any,
      dataType: 'select',
      description: 'Choose the app theme',
      isAgeRestricted: false,
      defaultValue: 'auto',
      isRequired: false,
      isReadOnly: false,
      lastModified: new Date(),
      version: 1
    },
    {
      id: 'theme_color',
      key: 'appearance.theme.color',
      value: '#8B5CF6',
      category: 'appearance' as any,
      dataType: 'color',
      description: 'Choose your favorite accent color',
      isAgeRestricted: false,
      defaultValue: '#8B5CF6',
      isRequired: false,
      isReadOnly: false,
      lastModified: new Date(),
      version: 1
    },
    {
      id: 'font_size',
      key: 'appearance.typography.fontSize',
      value: 16,
      category: 'appearance' as any,
      dataType: 'range',
      description: 'Adjust the size of text',
      isAgeRestricted: false,
      minAge: 5,
      maxAge: 17,
      defaultValue: 16,
      isRequired: false,
      isReadOnly: false,
      lastModified: new Date(),
      version: 1
    },
    {
      id: 'animations_enabled',
      key: 'appearance.animations.enabled',
      value: true,
      category: 'appearance' as any,
      dataType: 'boolean',
      description: 'Show animations and transitions',
      isAgeRestricted: false,
      defaultValue: true,
      isRequired: false,
      isReadOnly: false,
      lastModified: new Date(),
      version: 1
    },

    // Behavior preferences
    {
      id: 'response_speed',
      key: 'behavior.response.speed',
      value: 'normal',
      category: 'behavior' as any,
      dataType: 'select',
      description: 'How fast the AI responds',
      isAgeRestricted: false,
      defaultValue: 'normal',
      isRequired: false,
      isReadOnly: false,
      lastModified: new Date(),
      version: 1
    },
    {
      id: 'auto_save_conversations',
      key: 'behavior.conversations.autoSave',
      value: true,
      category: 'behavior' as any,
      dataType: 'boolean',
      description: 'Automatically save your conversations',
      isAgeRestricted: false,
      defaultValue: true,
      isRequired: false,
      isReadOnly: false,
      lastModified: new Date(),
      version: 1
    },
    {
      id: 'character_companion',
      key: 'behavior.character.enabled',
      value: true,
      category: 'behavior' as any,
      dataType: 'boolean',
      description: 'Show the character companion',
      isAgeRestricted: false,
      defaultValue: true,
      isRequired: false,
      isReadOnly: false,
      lastModified: new Date(),
      version: 1
    },
    {
      id: 'celebration_effects',
      key: 'behavior.celebration.enabled',
      value: true,
      category: 'behavior' as any,
      dataType: 'boolean',
      description: 'Show celebration effects for achievements',
      isAgeRestricted: false,
      defaultValue: true,
      isRequired: false,
      isReadOnly: false,
      lastModified: new Date(),
      version: 1
    },

    // Accessibility preferences
    {
      id: 'screen_reader',
      key: 'accessibility.screenReader.enabled',
      value: false,
      category: 'accessibility' as any,
      dataType: 'boolean',
      description: 'Enable screen reader support',
      isAgeRestricted: false,
      defaultValue: false,
      isRequired: false,
      isReadOnly: false,
      lastModified: new Date(),
      version: 1
    },
    {
      id: 'high_contrast',
      key: 'accessibility.contrast.high',
      value: false,
      category: 'accessibility' as any,
      dataType: 'boolean',
      description: 'Use high contrast colors',
      isAgeRestricted: false,
      defaultValue: false,
      isRequired: false,
      isReadOnly: false,
      lastModified: new Date(),
      version: 1
    },
    {
      id: 'large_text',
      key: 'accessibility.typography.largeText',
      value: false,
      category: 'accessibility' as any,
      dataType: 'boolean',
      description: 'Use larger text throughout the app',
      isAgeRestricted: false,
      defaultValue: false,
      isRequired: false,
      isReadOnly: false,
      lastModified: new Date(),
      version: 1
    },
    {
      id: 'reduced_motion',
      key: 'accessibility.motion.reduced',
      value: false,
      category: 'accessibility' as any,
      dataType: 'boolean',
      description: 'Reduce motion and animations',
      isAgeRestricted: false,
      defaultValue: false,
      isRequired: false,
      isReadOnly: false,
      lastModified: new Date(),
      version: 1
    },

    // Parental controls
    {
      id: 'parental_level',
      key: 'parental.control.level',
      value: 'medium',
      category: 'parental' as any,
      dataType: 'select',
      description: 'Set the parental control level',
      isAgeRestricted: true,
      minAge: 18,
      defaultValue: 'medium',
      isRequired: true,
      isReadOnly: false,
      lastModified: new Date(),
      version: 1
    },
    {
      id: 'content_filtering',
      key: 'parental.content.filtering',
      value: true,
      category: 'parental' as any,
      dataType: 'boolean',
      description: 'Filter inappropriate content',
      isAgeRestricted: true,
      minAge: 18,
      defaultValue: true,
      isRequired: true,
      isReadOnly: false,
      lastModified: new Date(),
      version: 1
    },
    {
      id: 'time_limits',
      key: 'parental.time.limits.enabled',
      value: false,
      category: 'parental' as any,
      dataType: 'boolean',
      description: 'Enable time limits for app usage',
      isAgeRestricted: true,
      minAge: 18,
      defaultValue: false,
      isRequired: false,
      isReadOnly: false,
      lastModified: new Date(),
      version: 1
    },
    {
      id: 'daily_time_limit',
      key: 'parental.time.limits.daily',
      value: 60,
      category: 'parental' as any,
      dataType: 'range',
      description: 'Maximum daily usage time in minutes',
      isAgeRestricted: true,
      minAge: 18,
      defaultValue: 60,
      isRequired: false,
      isReadOnly: false,
      lastModified: new Date(),
      version: 1
    },

    // Sound preferences
    {
      id: 'master_volume',
      key: 'sound.volume.master',
      value: 0.7,
      category: 'sound' as any,
      dataType: 'range',
      description: 'Master volume level',
      isAgeRestricted: false,
      defaultValue: 0.7,
      isRequired: false,
      isReadOnly: false,
      lastModified: new Date(),
      version: 1
    },
    {
      id: 'sound_effects',
      key: 'sound.effects.enabled',
      value: true,
      category: 'sound' as any,
      dataType: 'boolean',
      description: 'Play sound effects',
      isAgeRestricted: false,
      defaultValue: true,
      isRequired: false,
      isReadOnly: false,
      lastModified: new Date(),
      version: 1
    },
    {
      id: 'background_music',
      key: 'sound.music.enabled',
      value: false,
      category: 'sound' as any,
      dataType: 'boolean',
      description: 'Play background music',
      isAgeRestricted: false,
      defaultValue: false,
      isRequired: false,
      isReadOnly: false,
      lastModified: new Date(),
      version: 1
    },
    {
      id: 'voice_feedback',
      key: 'sound.voice.enabled',
      value: true,
      category: 'sound' as any,
      dataType: 'boolean',
      description: 'Enable voice responses',
      isAgeRestricted: false,
      defaultValue: true,
      isRequired: false,
      isReadOnly: false,
      lastModified: new Date(),
      version: 1
    },

    // Privacy preferences
    {
      id: 'analytics_enabled',
      key: 'privacy.analytics.enabled',
      value: true,
      category: 'privacy' as any,
      dataType: 'boolean',
      description: 'Help improve the app with anonymous usage data',
      isAgeRestricted: true,
      minAge: 18,
      defaultValue: true,
      isRequired: false,
      isReadOnly: false,
      lastModified: new Date(),
      version: 1
    },
    {
      id: 'crash_reports',
      key: 'privacy.crashReports.enabled',
      value: true,
      category: 'privacy' as any,
      dataType: 'boolean',
      description: 'Send crash reports to help fix problems',
      isAgeRestricted: true,
      minAge: 18,
      defaultValue: true,
      isRequired: false,
      isReadOnly: false,
      lastModified: new Date(),
      version: 1
    },
    {
      id: 'data_retention',
      key: 'privacy.data.retention',
      value: 30,
      category: 'privacy' as any,
      dataType: 'select',
      description: 'How long to keep your data',
      isAgeRestricted: true,
      minAge: 18,
      defaultValue: 30,
      isRequired: false,
      isReadOnly: false,
      lastModified: new Date(),
      version: 1
    }
  ];

  // Validation rules for preferences
  static readonly VALIDATION_RULES: Record<string, PreferenceValidationRule[]> = {
    'appearance.typography.fontSize': [
      {
        type: 'min',
        value: 12,
        message: 'Font size must be at least 12px',
        severity: 'error'
      },
      {
        type: 'max',
        value: 24,
        message: 'Font size must be no more than 24px',
        severity: 'error'
      }
    ],
    'sound.volume.master': [
      {
        type: 'min',
        value: 0,
        message: 'Volume must be between 0 and 1',
        severity: 'error'
      },
      {
        type: 'max',
        value: 1,
        message: 'Volume must be between 0 and 1',
        severity: 'error'
      }
    ],
    'parental.time.limits.daily': [
      {
        type: 'min',
        value: 10,
        message: 'Daily time limit must be at least 10 minutes',
        severity: 'warning'
      },
      {
        type: 'max',
        value: 300,
        message: 'Daily time limit must be no more than 300 minutes',
        severity: 'warning'
      }
    ]
  };

  // Preference constraints
  static readonly CONSTRAINTS: Record<string, PreferenceConstraint[]> = {
    'appearance.typography.largeText': [
      {
        key: 'accessibility.motion.reduced',
        operator: 'equals',
        value: true,
        message: 'Large text works best with reduced motion enabled'
      }
    ],
    'sound.music.enabled': [
      {
        key: 'sound.voice.enabled',
        operator: 'equals',
        value: false,
        message: 'Background music is automatically disabled when voice is enabled'
      }
    ]
  };

  // Age-appropriate presets
  static readonly PRESETS: PreferencePreset[] = [
    {
      id: 'toddler_friendly',
      name: 'Toddler Friendly',
      description: 'Simple interface for young children',
      category: 'appearance',
      icon: '👶',
      color: '#F59E0B',
      ageRange: { min: 2, max: 4 },
      preferences: {
        'appearance.typography.fontSize': 20,
        'appearance.animations.enabled': true,
        'behavior.character.enabled': true,
        'behavior.celebration.enabled': true,
        'sound.effects.enabled': true,
        'sound.voice.enabled': true,
        'accessibility.screenReader.enabled': false
      },
      isRecommended: true,
      usageCount: 0,
      rating: 4.8,
      tags: ['simple', 'visual', 'fun'],
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'preschool_learning',
      name: 'Preschool Learning',
      description: 'Educational settings for preschoolers',
      category: 'behavior',
      icon: '📚',
      color: '#10B981',
      ageRange: { min: 5, max: 7 },
      preferences: {
        'appearance.typography.fontSize': 18,
        'behavior.response.speed': 'slow',
        'behavior.character.enabled': true,
        'behavior.celebration.enabled': true,
        'sound.effects.enabled': true,
        'sound.voice.enabled': true,
        'parental.control.level': 'high',
        'parental.content.filtering': true
      },
      isRecommended: true,
      usageCount: 0,
      rating: 4.6,
      tags: ['educational', 'safe', 'engaging'],
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'elementary_explorer',
      name: 'Elementary Explorer',
      description: 'Balanced settings for elementary school children',
      category: 'behavior',
      icon: '🔍',
      color: '#3B82F6',
      ageRange: { min: 8, max: 12 },
      preferences: {
        'appearance.typography.fontSize': 16,
        'behavior.response.speed': 'normal',
        'behavior.character.enabled': true,
        'behavior.celebration.enabled': true,
        'sound.effects.enabled': true,
        'sound.voice.enabled': true,
        'parental.control.level': 'medium',
        'parental.content.filtering': true,
        'parental.time.limits.enabled': true,
        'parental.time.limits.daily': 120
      },
      isRecommended: true,
      usageCount: 0,
      rating: 4.5,
      tags: ['balanced', 'educational', 'age-appropriate'],
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'teen_independence',
      name: 'Teen Independence',
      description: 'More freedom for teenagers',
      category: 'parental',
      icon: '🎓',
      color: '#8B5CF6',
      ageRange: { min: 13, max: 17 },
      preferences: {
        'appearance.typography.fontSize': 14,
        'behavior.response.speed': 'fast',
        'behavior.character.enabled': false,
        'behavior.celebration.enabled': false,
        'sound.effects.enabled': true,
        'sound.voice.enabled': true,
        'parental.control.level': 'low',
        'parental.content.filtering': false,
        'parental.time.limits.enabled': false
      },
      isRecommended: true,
      usageCount: 0,
      rating: 4.3,
      tags: ['independent', 'mature', 'customizable'],
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'accessibility_focused',
      name: 'Accessibility Focus',
      description: 'Enhanced accessibility for all ages',
      category: 'accessibility',
      icon: '♿',
      color: '#F59E0B',
      ageRange: { min: 2, max: 17 },
      preferences: {
        'appearance.typography.fontSize': 20,
        'appearance.typography.largeText': true,
        'accessibility.screenReader.enabled': true,
        'accessibility.contrast.high': true,
        'accessibility.motion.reduced': true,
        'sound.voice.enabled': true,
        'sound.volume.master': 0.9
      },
      isRecommended: true,
      usageCount: 0,
      rating: 4.7,
      tags: ['accessible', 'inclusive', 'supportive'],
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  static getAgeBasedDefaults(age: number): Record<string, any> {
    const defaults: Record<string, any> = {};

    if (age >= this.AGE_GROUPS.TODDLER.min && age <= this.AGE_GROUPS.TODDLER.max) {
      Object.assign(defaults, this.PRESETS.find(p => p.id === 'toddler_friendly')?.preferences);
    } else if (age >= this.AGE_GROUPS.PRESCHOOL.min && age <= this.AGE_GROUPS.PRESCHOOL.max) {
      Object.assign(defaults, this.PRESETS.find(p => p.id === 'preschool_learning')?.preferences);
    } else if (age >= this.AGE_GROUPS.ELEMENTARY.min && age <= this.AGE_GROUPS.ELEMENTARY.max) {
      Object.assign(defaults, this.PRESETS.find(p => p.id === 'elementary_explorer')?.preferences);
    } else if (age >= this.AGE_GROUPS.TEEN.min && age <= this.AGE_GROUPS.TEEN.max) {
      Object.assign(defaults, this.PRESETS.find(p => p.id === 'teen_independence')?.preferences);
    }

    return defaults;
  }

  static validatePreference(key: string, value: any, allPreferences: Record<string, any>): PreferenceValidationResult {
    const violations: PreferenceConstraintViolation[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Check validation rules
    const rules = this.VALIDATION_RULES[key] || [];
    for (const rule of rules) {
      if (!this.checkValidationRule(rule, value)) {
        violations.push({
          preferenceKey: key,
          constraint: {
            key: 'validation',
            operator: 'equals',
            value: rule.value,
            message: rule.message
          },
          actualValue: value,
          expectedValue: rule.value,
          severity: rule.severity,
          message: rule.message,
          suggestions: this.getSuggestionsForRule(rule, value)
        });
      }
    }

    // Check constraints
    const constraints = this.CONSTRAINTS[key] || [];
    for (const constraint of constraints) {
      const dependentValue = allPreferences[constraint.key];
      if (!this.checkConstraint(constraint, dependentValue)) {
        violations.push({
          preferenceKey: key,
          constraint,
          actualValue: value,
          expectedValue: dependentValue,
          severity: 'warning',
          message: constraint.message,
          suggestions: ['Consider adjusting the related setting']
        });
      }
    }

    // Calculate score
    const maxViolations = rules.length + constraints.length;
    const score = maxViolations > 0 ? Math.max(0, 100 - (violations.length / maxViolations) * 100) : 100;

    return {
      isValid: violations.filter(v => v.severity === 'error').length === 0,
      violations,
      warnings,
      suggestions,
      score
    };
  }

  private static checkValidationRule(rule: PreferenceValidationRule, value: any): boolean {
    switch (rule.type) {
      case 'required':
        return value !== null && value !== undefined && value !== '';
      case 'min':
        return typeof value === 'number' && value >= rule.value;
      case 'max':
        return typeof value === 'number' && value <= rule.value;
      case 'pattern':
        return typeof value === 'string' && new RegExp(rule.value).test(value);
      default:
        return true;
    }
  }

  private static checkConstraint(constraint: PreferenceConstraint, dependentValue: any): boolean {
    switch (constraint.operator) {
      case 'equals':
        return dependentValue === constraint.value;
      case 'notEquals':
        return dependentValue !== constraint.value;
      case 'greaterThan':
        return typeof dependentValue === 'number' && dependentValue > constraint.value;
      case 'lessThan':
        return typeof dependentValue === 'number' && dependentValue < constraint.value;
      case 'contains':
        return Array.isArray(dependentValue) && dependentValue.includes(constraint.value);
      case 'matches':
        return typeof dependentValue === 'string' && new RegExp(constraint.value).test(dependentValue);
      default:
        return true;
    }
  }

  private static getSuggestionsForRule(rule: PreferenceValidationRule, value: any): string[] {
    switch (rule.type) {
      case 'min':
        return [`Try a value of at least ${rule.value}`];
      case 'max':
        return [`Try a value of no more than ${rule.value}`];
      case 'pattern':
        return ['Check the format of your input'];
      default:
        return [];
    }
  }

  static getRecommendedPreset(age: number, parentalLevel: ParentalControlLevel): PreferencePreset | null {
    const eligiblePresets = this.PRESETS.filter(preset =>
      age >= preset.ageRange.min && age <= preset.ageRange.max
    );

    if (eligiblePresets.length === 0) return null;

    // Sort by recommendation status and rating
    eligiblePresets.sort((a, b) => {
      if (a.isRecommended && !b.isRecommended) return -1;
      if (!a.isRecommended && b.isRecommended) return 1;
      return b.rating - a.rating;
    });

    return eligiblePresets[0];
  }

  static getVersion(): string {
    return this.PREFERENCES_VERSION;
  }

  static getAllPreferences(): UserPreference[] {
    return [...this.DEFAULT_PREFERENCES];
  }

  static getPreferenceByKey(key: string): UserPreference | undefined {
    return this.DEFAULT_PREFERENCES.find(p => p.key === key);
  }

  static getPreferencesByCategory(categoryId: string): UserPreference[] {
    return this.DEFAULT_PREFERENCES.filter(p => p.category === categoryId);
  }

  static getCategories(): PreferenceCategory[] {
    return [...this.DEFAULT_CATEGORIES];
  }

  static getPresets(): PreferencePreset[] {
    return [...this.PRESETS];
  }

  static getAgeGroups() {
    return this.AGE_GROUPS;
  }
}