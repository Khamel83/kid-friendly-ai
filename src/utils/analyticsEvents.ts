/**
 * Analytics Events System
 * Standardized event definitions, tracking, and validation for analytics
 */

import {
  AnalyticsEvent,
  PrivacyLevel,
  EventProcessor,
  EventPipeline
} from '../types/analytics';

interface EventDefinition {
  id: string;
  name: string;
  category: string;
  description: string;
  version: string;
  schema: EventSchema;
  required: boolean;
  sampling: number;
  retention: number;
  piiFields: string[];
  sensitiveFields: string[];
  tags: string[];
}

interface EventSchema {
  properties: Record<string, PropertyDefinition>;
  required: string[];
  additionalProperties: boolean;
}

interface PropertyDefinition {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required: boolean;
  default?: any;
  enum?: any[];
  minimum?: number;
  maximum?: number;
  pattern?: string;
  format?: string;
}

interface EventValidation {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

interface ValidationError {
  field: string;
  message: string;
  value: any;
  constraint: string;
}

interface ValidationWarning {
  field: string;
  message: string;
  value: any;
  suggestion: string;
}

interface EventMapping {
  fromEvent: string;
  toEvent: string;
  transformations: Transformation[];
  conditions: Condition[];
}

interface Transformation {
  field: string;
  type: 'rename' | 'extract' | 'combine' | 'calculate' | 'filter' | 'format';
  config: Record<string, any>;
}

interface Condition {
  field: string;
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'exists';
  value: any;
}

interface EventSampling {
  enabled: boolean;
  rate: number;
  strategy: 'random' | 'deterministic' | 'adaptive';
  userBased: boolean;
}

interface EventQuality {
  score: number;
  issues: QualityIssue[];
  recommendations: string[];
}

interface QualityIssue {
  type: 'missing_field' | 'invalid_format' | 'out_of_range' | 'duplicate_event' | 'schema_violation';
  field?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  suggestion: string;
}

export class AnalyticsEvents {
  private static instance: AnalyticsEvents;
  private eventDefinitions: Map<string, EventDefinition> = new Map();
  private eventMappings: Map<string, EventMapping[]> = new Map();
  private eventSampling: EventSampling;
  private eventPipeline: EventPipeline;
  private eventQualityCache: Map<string, EventQuality> = new Map();

  private constructor() {
    this.eventSampling = {
      enabled: true,
      rate: 1.0,
      strategy: 'random',
      userBased: true,
    };

    this.eventPipeline = {
      id: 'default',
      name: 'Default Event Pipeline',
      processors: [],
      enabled: true,
      created: new Date(),
      updated: new Date(),
    };

    this.initializeEventDefinitions();
    this.initializeEventMappings();
    this.initializeEventPipeline();
  }

  static getInstance(): AnalyticsEvents {
    if (!AnalyticsEvents.instance) {
      AnalyticsEvents.instance = new AnalyticsEvents();
    }
    return AnalyticsEvents.instance;
  }

  /**
   * Validate analytics event
   */
  validateEvent(event: AnalyticsEvent): EventValidation {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Check required fields
    if (!event.id) {
      errors.push({
        field: 'id',
        message: 'Event ID is required',
        value: event.id,
        constraint: 'required',
      });
    }

    if (!event.timestamp) {
      errors.push({
        field: 'timestamp',
        message: 'Event timestamp is required',
        value: event.timestamp,
        constraint: 'required',
      });
    }

    if (!event.type) {
      errors.push({
        field: 'type',
        message: 'Event type is required',
        value: event.type,
        constraint: 'required',
      });
    }

    if (!event.category) {
      errors.push({
        field: 'category',
        message: 'Event category is required',
        value: event.category,
        constraint: 'required',
      });
    }

    if (!event.sessionId) {
      errors.push({
        field: 'sessionId',
        message: 'Event session ID is required',
        value: event.sessionId,
        constraint: 'required',
      });
    }

    // Validate event against definition
    const definition = this.eventDefinitions.get(event.type);
    if (definition) {
      this.validateAgainstSchema(event, definition, errors, warnings);
    } else {
      warnings.push({
        field: 'type',
        message: `Unknown event type: ${event.type}`,
        value: event.type,
        suggestion: 'Register event definition or use standard event types',
      });
    }

    // Validate data quality
    this.validateDataQuality(event, errors, warnings);

    // Validate privacy compliance
    this.validatePrivacyCompliance(event, errors, warnings);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Create analytics event from definition
   */
  createEvent(
    type: string,
    data: Record<string, any>,
    options: {
      userId?: string;
      sessionId?: string;
      privacyLevel?: PrivacyLevel;
      metadata?: Record<string, any>;
    } = {}
  ): AnalyticsEvent {
    const definition = this.eventDefinitions.get(type);
    if (!definition) {
      throw new Error(`Unknown event type: ${type}`);
    }

    // Apply sampling
    if (this.eventSampling.enabled && !this.shouldSampleEvent(type, options.userId)) {
      throw new Error('Event sampled out');
    }

    // Create base event
    const event: AnalyticsEvent = {
      id: this.generateEventId(),
      timestamp: new Date(),
      type,
      category: definition.category,
      userId: options.userId,
      sessionId: options.sessionId || this.generateSessionId(),
      eventData: data,
      metadata: options.metadata,
      privacyLevel: options.privacyLevel || PrivacyLevel.Anonymous,
    };

    // Apply event transformations
    const transformedEvent = this.applyEventTransformations(event);

    return transformedEvent;
  }

  /**
   * Get event definition
   */
  getEventDefinition(eventType: string): EventDefinition | undefined {
    return this.eventDefinitions.get(eventType);
  }

  /**
   * Register custom event definition
   */
  registerEventDefinition(definition: EventDefinition): void {
    // Validate definition
    this.validateEventDefinition(definition);

    this.eventDefinitions.set(definition.id, definition);

    console.log(`Event definition registered: ${definition.name} (${definition.id})`);
  }

  /**
   * Get all event definitions
   */
  getAllEventDefinitions(): EventDefinition[] {
    return Array.from(this.eventDefinitions.values());
  }

  /**
   * Get event categories
   */
  getEventCategories(): string[] {
    const categories = new Set<string>();
    this.eventDefinitions.forEach(def => categories.add(def.category));
    return Array.from(categories).sort();
  }

  /**
   * Get events by category
   */
  getEventsByCategory(category: string): EventDefinition[] {
    return Array.from(this.eventDefinitions.values()).filter(def => def.category === category);
  }

  /**
   * Apply event transformations
   */
  applyEventTransformations(event: AnalyticsEvent): AnalyticsEvent {
    const mappings = this.eventMappings.get(event.type) || [];
    let transformedEvent = { ...event };

    for (const mapping of mappings) {
      if (this.shouldApplyMapping(event, mapping)) {
        transformedEvent = this.applyMapping(transformedEvent, mapping);
      }
    }

    return transformedEvent;
  }

  /**
   * Assess event quality
   */
  assessEventQuality(event: AnalyticsEvent): EventQuality {
    const cacheKey = `${event.type}_${event.id}`;

    if (this.eventQualityCache.has(cacheKey)) {
      return this.eventQualityCache.get(cacheKey)!;
    }

    const issues: QualityIssue[] = [];
    let score = 100;

    // Check for missing required fields
    const definition = this.eventDefinitions.get(event.type);
    if (definition) {
      definition.schema.required.forEach(field => {
        if (!event.eventData[field]) {
          issues.push({
            type: 'missing_field',
            field,
            severity: 'high',
            description: `Required field '${field}' is missing`,
            suggestion: 'Include all required fields in event data',
          });
          score -= 20;
        }
      });
    }

    // Check data types
    if (definition) {
      Object.entries(definition.schema.properties).forEach(([field, propDef]) => {
        const value = event.eventData[field];
        if (value !== undefined && !this.validateDataType(value, propDef.type)) {
          issues.push({
            type: 'invalid_format',
            field,
            severity: 'medium',
            description: `Field '${field}' has invalid type. Expected ${propDef.type}, got ${typeof value}`,
            suggestion: `Ensure '${field}' is of type ${propDef.type}`,
          });
          score -= 10;
        }
      });
    }

    // Check for PII in non-anonymous events
    if (event.privacyLevel !== PrivacyLevel.Anonymous) {
      const piiFields = this.detectPII(event.eventData);
      if (piiFields.length > 0) {
        issues.push({
          type: 'schema_violation',
          severity: 'high',
          description: `PII fields detected in non-anonymous event: ${piiFields.join(', ')}`,
          suggestion: 'Use anonymous privacy level or remove PII fields',
        });
        score -= 30;
      }
    }

    // Ensure score is not negative
    score = Math.max(0, score);

    const quality: EventQuality = {
      score,
      issues,
      recommendations: this.generateQualityRecommendations(issues),
    };

    this.eventQualityCache.set(cacheKey, quality);
    return quality;
  }

  /**
   * Get event statistics
   */
  getEventStatistics(): {
    totalDefinitions: number;
    categories: string[];
    requiredEvents: number;
    sampledEvents: number;
    averageRetention: number;
  } {
    const definitions = Array.from(this.eventDefinitions.values());
    const categories = this.getEventCategories();

    return {
      totalDefinitions: definitions.length,
      categories,
      requiredEvents: definitions.filter(def => def.required).length,
      sampledEvents: definitions.filter(def => def.sampling < 1.0).length,
      averageRetention: definitions.reduce((sum, def) => sum + def.retention, 0) / definitions.length,
    };
  }

  /**
   * Export event definitions
   */
  exportEventDefinitions(format: 'json' | 'csv' | 'yaml' = 'json'): string {
    const definitions = Array.from(this.eventDefinitions.values());

    switch (format) {
      case 'json':
        return JSON.stringify(definitions, null, 2);
      case 'csv':
        return this.exportToCSV(definitions);
      case 'yaml':
        return this.exportToYAML(definitions);
      default:
        return JSON.stringify(definitions, null, 2);
    }
  }

  /**
   * Import event definitions
   */
  importEventDefinitions(definitions: EventDefinition[]): void {
    definitions.forEach(definition => {
      this.registerEventDefinition(definition);
    });
  }

  // Private methods
  private initializeEventDefinitions(): void {
    // Standard web analytics events
    this.registerEventDefinition({
      id: 'page_view',
      name: 'Page View',
      category: 'navigation',
      description: 'User views a page',
      version: '1.0',
      schema: {
        properties: {
          page: { type: 'string', description: 'Page URL or path', required: true },
          title: { type: 'string', description: 'Page title', required: false },
          referrer: { type: 'string', description: 'Referring page', required: false },
          loadTime: { type: 'number', description: 'Page load time in ms', required: false },
        },
        required: ['page'],
        additionalProperties: true,
      },
      required: false,
      sampling: 1.0,
      retention: 90,
      piiFields: [],
      sensitiveFields: ['page', 'referrer'],
      tags: ['navigation', 'web', 'standard'],
    });

    this.registerEventDefinition({
      id: 'user_interaction',
      name: 'User Interaction',
      category: 'engagement',
      description: 'User interacts with page elements',
      version: '1.0',
      schema: {
        properties: {
          action: { type: 'string', description: 'Interaction type', required: true },
          target: { type: 'string', description: 'Target element', required: true },
          value: { type: 'string', description: 'Interaction value', required: false },
          elementId: { type: 'string', description: 'Element ID', required: false },
          elementClass: { type: 'string', description: 'Element class', required: false },
        },
        required: ['action', 'target'],
        additionalProperties: true,
      },
      required: false,
      sampling: 0.5,
      retention: 30,
      piiFields: [],
      sensitiveFields: [],
      tags: ['engagement', 'interaction', 'standard'],
    });

    this.registerEventDefinition({
      id: 'conversion',
      name: 'Conversion',
      category: 'business',
      description: 'User completes a conversion action',
      version: '1.0',
      schema: {
        properties: {
          conversionType: { type: 'string', description: 'Type of conversion', required: true },
          value: { type: 'number', description: 'Conversion value', required: false },
          currency: { type: 'string', description: 'Currency code', required: false },
          funnelStage: { type: 'string', description: 'Funnel stage', required: false },
        },
        required: ['conversionType'],
        additionalProperties: true,
      },
      required: true,
      sampling: 1.0,
      retention: 365,
      piiFields: [],
      sensitiveFields: [],
      tags: ['business', 'conversion', 'standard'],
    });

    this.registerEventDefinition({
      id: 'session_start',
      name: 'Session Start',
      category: 'session',
      description: 'User session starts',
      version: '1.0',
      schema: {
        properties: {
          userId: { type: 'string', description: 'User ID', required: false },
          entryPage: { type: 'string', description: 'First page in session', required: true },
      },
        required: ['entryPage'],
        additionalProperties: true,
      },
      required: true,
      sampling: 1.0,
      retention: 180,
      piiFields: ['userId'],
      sensitiveFields: ['userId'],
      tags: ['session', 'lifecycle', 'standard'],
    });

    this.registerEventDefinition({
      id: 'session_end',
      name: 'Session End',
      category: 'session',
      description: 'User session ends',
      version: '1.0',
      schema: {
        properties: {
          duration: { type: 'number', description: 'Session duration in ms', required: true },
          pageViews: { type: 'number', description: 'Number of page views', required: true },
          events: { type: 'number', description: 'Number of events', required: true },
        },
        required: ['duration', 'pageViews', 'events'],
        additionalProperties: true,
      },
      required: true,
      sampling: 1.0,
      retention: 180,
      piiFields: [],
      sensitiveFields: [],
      tags: ['session', 'lifecycle', 'standard'],
    });

    // Kid-specific events
    this.registerEventDefinition({
      id: 'game_start',
      name: 'Game Start',
      category: 'engagement',
      description: 'Child starts playing a game',
      version: '1.0',
      schema: {
        properties: {
          gameId: { type: 'string', description: 'Game identifier', required: true },
          difficulty: { type: 'string', description: 'Difficulty level', required: false },
          ageGroup: { type: 'string', description: 'Target age group', required: false },
        },
        required: ['gameId'],
        additionalProperties: true,
      },
      required: false,
      sampling: 0.8,
      retention: 90,
      piiFields: [],
      sensitiveFields: [],
      tags: ['game', 'engagement', 'kid-specific'],
    });

    this.registerEventDefinition({
      id: 'learning_complete',
      name: 'Learning Activity Complete',
      category: 'education',
      description: 'Child completes a learning activity',
      version: '1.0',
      schema: {
        properties: {
          activityId: { type: 'string', description: 'Activity identifier', required: true },
          score: { type: 'number', description: 'Activity score', required: false },
          timeSpent: { type: 'number', description: 'Time spent in seconds', required: false },
          skills: { type: 'array', description: 'Skills practiced', required: false },
        },
        required: ['activityId'],
        additionalProperties: true,
      },
      required: false,
      sampling: 1.0,
      retention: 365,
      piiFields: [],
      sensitiveFields: [],
      tags: ['education', 'learning', 'kid-specific'],
    });

    this.registerEventDefinition({
      id: 'parental_control_access',
      name: 'Parental Control Access',
      category: 'security',
      description: 'Parent accesses control settings',
      version: '1.0',
      schema: {
        properties: {
          action: { type: 'string', description: 'Control action', required: true },
          setting: { type: 'string', description: 'Setting modified', required: false },
          oldValue: { type: 'string', description: 'Previous value', required: false },
          newValue: { type: 'string', description: 'New value', required: false },
        },
        required: ['action'],
        additionalProperties: true,
      },
      required: true,
      sampling: 1.0,
      retention: 730,
      piiFields: [],
      sensitiveFields: [],
      tags: ['security', 'parental', 'kid-specific'],
    });
  }

  private initializeEventMappings(): void {
    // Map page_view to pageview for some analytics providers
    this.eventMappings.set('page_view', [{
      fromEvent: 'page_view',
      toEvent: 'pageview',
      transformations: [
        {
          field: 'page',
          type: 'rename',
          config: { newName: 'path' },
        },
      ],
      conditions: [],
    }]);

    // Map user_interaction to click for specific actions
    this.eventMappings.set('user_interaction', [{
      fromEvent: 'user_interaction',
      toEvent: 'click',
      transformations: [
        {
          field: 'target',
          type: 'rename',
          config: { newName: 'element' },
        },
      ],
      conditions: [
        {
          field: 'action',
          operator: 'equals',
          value: 'click',
        },
      ],
    }]);
  }

  private initializeEventPipeline(): void {
    // Add default processors
    this.eventPipeline.processors = [
      {
        id: 'validator',
        name: 'Event Validator',
        type: 'validate',
        config: { strict: true },
        conditions: [],
        order: 1,
        enabled: true,
      },
      {
        id: 'enricher',
        name: 'Event Enricher',
        type: 'enrich',
        config: { addTimestamp: true, addDeviceInfo: true },
        conditions: [],
        order: 2,
        enabled: true,
      },
      {
        id: 'sampler',
        name: 'Event Sampler',
        type: 'filter',
        config: { rate: 0.1 },
        conditions: [
          {
            field: 'type',
            operator: 'equals',
            value: 'user_interaction',
          },
        ],
        order: 3,
        enabled: true,
      },
    ];
  }

  private validateAgainstSchema(
    event: AnalyticsEvent,
    definition: EventDefinition,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    const schema = definition.schema;

    // Check required fields
    schema.required.forEach(field => {
      if (!event.eventData[field]) {
        errors.push({
          field,
          message: `Required field '${field}' is missing`,
          value: event.eventData[field],
          constraint: 'required',
        });
      }
    });

    // Check field types and constraints
    Object.entries(schema.properties).forEach(([field, propDef]) => {
      const value = event.eventData[field];

      if (value === undefined && propDef.required) {
        errors.push({
          field,
          message: `Required field '${field}' is missing`,
          value,
          constraint: 'required',
        });
        return;
      }

      if (value !== undefined) {
        // Validate type
        if (!this.validateDataType(value, propDef.type)) {
          errors.push({
            field,
            message: `Field '${field}' has invalid type. Expected ${propDef.type}, got ${typeof value}`,
            value,
            constraint: `type: ${propDef.type}`,
          });
        }

        // Validate enum values
        if (propDef.enum && !propDef.enum.includes(value)) {
          errors.push({
            field,
            message: `Field '${field}' has invalid value. Expected one of: ${propDef.enum.join(', ')}`,
            value,
            constraint: `enum: ${propDef.enum.join(', ')}`,
          });
        }

        // Validate numeric constraints
        if (propDef.type === 'number') {
          if (propDef.minimum !== undefined && value < propDef.minimum) {
            errors.push({
              field,
              message: `Field '${field}' is below minimum value ${propDef.minimum}`,
              value,
              constraint: `minimum: ${propDef.minimum}`,
            });
          }

          if (propDef.maximum !== undefined && value > propDef.maximum) {
            errors.push({
              field,
              message: `Field '${field}' exceeds maximum value ${propDef.maximum}`,
              value,
              constraint: `maximum: ${propDef.maximum}`,
            });
          }
        }

        // Validate string patterns
        if (propDef.type === 'string' && propDef.pattern) {
          const regex = new RegExp(propDef.pattern);
          if (!regex.test(value)) {
            warnings.push({
              field,
              message: `Field '${field}' does not match expected pattern`,
              value,
              suggestion: `Ensure value matches pattern: ${propDef.pattern}`,
            });
          }
        }
      }
    });

    // Check for additional properties
    if (!schema.additionalProperties) {
      const allowedFields = Object.keys(schema.properties);
      const actualFields = Object.keys(event.eventData);

      actualFields.forEach(field => {
        if (!allowedFields.includes(field)) {
          warnings.push({
            field,
            message: `Additional field '${field}' not allowed in schema`,
            value: event.eventData[field],
            suggestion: 'Remove extra fields or update schema to allow them',
          });
        }
      });
    }
  }

  private validateDataQuality(
    event: AnalyticsEvent,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    // Check timestamp validity
    if (event.timestamp) {
      const now = new Date();
      const eventTime = new Date(event.timestamp);
      const timeDiff = Math.abs(now.getTime() - eventTime.getTime());

      if (timeDiff > 86400000) { // More than 1 day
        warnings.push({
          field: 'timestamp',
          message: 'Event timestamp is more than 1 day from current time',
          value: event.timestamp,
          suggestion: 'Ensure events are tracked with accurate timestamps',
        });
      }

      if (eventTime > now) {
        errors.push({
          field: 'timestamp',
          message: 'Event timestamp is in the future',
          value: event.timestamp,
          constraint: 'timestamp <= current_time',
        });
      }
    }

    // Check session ID format
    if (event.sessionId && !/^[a-zA-Z0-9_-]+$/.test(event.sessionId)) {
      warnings.push({
        field: 'sessionId',
        message: 'Session ID contains invalid characters',
        value: event.sessionId,
        suggestion: 'Use alphanumeric characters, hyphens, and underscores only',
      });
    }

    // Check for suspiciously large data
    const dataSize = JSON.stringify(event.eventData).length;
    if (dataSize > 10000) { // 10KB
      warnings.push({
        field: 'eventData',
        message: 'Event data is unusually large',
        value: `${dataSize} characters`,
        suggestion: 'Consider reducing event data size or splitting into multiple events',
      });
    }
  }

  private validatePrivacyCompliance(
    event: AnalyticsEvent,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    const definition = this.eventDefinitions.get(event.type);
    if (!definition) return;

    // Check for PII fields
    const detectedPII = this.detectPII(event.eventData);
    if (detectedPII.length > 0) {
      if (event.privacyLevel !== PrivacyLevel.Anonymous) {
        warnings.push({
          field: 'privacy',
          message: `PII fields detected: ${detectedPII.join(', ')}`,
          value: event.privacyLevel,
          suggestion: 'Consider using anonymous privacy level or removing PII',
        });
      }
    }

    // Check sensitive fields
    definition.sensitiveFields.forEach(field => {
      if (event.eventData[field] && event.privacyLevel !== PrivacyLevel.Anonymous) {
        warnings.push({
          field,
          message: `Sensitive field '${field}' present in non-anonymous event`,
          value: event.eventData[field],
          suggestion: 'Use anonymous privacy level or remove sensitive data',
        });
      }
    });
  }

  private validateEventDefinition(definition: EventDefinition): void {
    if (!definition.id || !definition.name || !definition.category) {
      throw new Error('Event definition must include id, name, and category');
    }

    if (!definition.schema || !definition.schema.properties) {
      throw new Error('Event definition must include a valid schema');
    }

    // Validate schema structure
    Object.entries(definition.schema.properties).forEach(([field, propDef]) => {
      if (!propDef.type || !propDef.description) {
        throw new Error(`Property definition for '${field}' must include type and description`);
      }
    });
  }

  private shouldSampleEvent(eventType: string, userId?: string): boolean {
    if (!this.eventSampling.enabled) {
      return true;
    }

    const definition = this.eventDefinitions.get(eventType);
    const samplingRate = definition?.sampling || this.eventSampling.rate;

    switch (this.eventSampling.strategy) {
      case 'random':
        return Math.random() < samplingRate;

      case 'deterministic':
        if (this.eventSampling.userBased && userId) {
          const hash = this.simpleHash(userId + eventType);
          return (hash % 100) / 100 < samplingRate;
        }
        return Math.random() < samplingRate;

      case 'adaptive':
        // Adaptive sampling based on event volume
        return this.adaptiveSampling(eventType, samplingRate);

      default:
        return true;
    }
  }

  private adaptiveSampling(eventType: string, baseRate: number): boolean {
    // Simple adaptive sampling - in production, this would be more sophisticated
    const volume = this.getEventVolume(eventType);
    const adjustedRate = Math.max(0.1, baseRate * (1000 / Math.max(volume, 100)));
    return Math.random() < adjustedRate;
  }

  private getEventVolume(eventType: string): number {
    // In production, this would query actual event volume
    return Math.floor(Math.random() * 1000) + 100;
  }

  private shouldApplyMapping(event: AnalyticsEvent, mapping: EventMapping): boolean {
    return mapping.conditions.every(condition => {
      const fieldValue = this.getNestedValue(event, condition.field);

      switch (condition.operator) {
        case 'equals':
          return fieldValue === condition.value;
        case 'contains':
          return typeof fieldValue === 'string' && fieldValue.includes(condition.value);
        case 'greater_than':
          return typeof fieldValue === 'number' && fieldValue > condition.value;
        case 'less_than':
          return typeof fieldValue === 'number' && fieldValue < condition.value;
        case 'exists':
          return fieldValue !== undefined;
        default:
          return false;
      }
    });
  }

  private applyMapping(event: AnalyticsEvent, mapping: EventMapping): AnalyticsEvent {
    let mappedEvent = { ...event };

    // Change event type
    mappedEvent.type = mapping.toEvent;

    // Apply transformations
    mapping.transformations.forEach(transformation => {
      mappedEvent = this.applyTransformation(mappedEvent, transformation);
    });

    return mappedEvent;
  }

  private applyTransformation(event: AnalyticsEvent, transformation: Transformation): AnalyticsEvent {
    const transformed = { ...event };

    switch (transformation.type) {
      case 'rename':
        const { newName } = transformation.config;
        const oldValue = transformed.eventData[transformation.field];
        delete transformed.eventData[transformation.field];
        transformed.eventData[newName] = oldValue;
        break;

      case 'extract':
        // Extract nested data
        break;

      case 'combine':
        // Combine multiple fields
        break;

      case 'calculate':
        // Calculate derived values
        break;

      case 'filter':
        // Filter out unwanted data
        break;

      case 'format':
        // Format data values
        break;
    }

    return transformed;
  }

  private detectPII(data: Record<string, any>): string[] {
    const piiFields: string[] = [];
    const piiPatterns = [
      { field: 'email', pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/ },
      { field: 'phone', pattern: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/ },
      { field: 'name', pattern: /\b[A-Z][a-z]+ [A-Z][a-z]+\b/ },
      { field: 'address', pattern: /\d+\s+[\w\s]+,\s*[\w\s]+,\s*[A-Z]{2}\s*\d{5}/ },
    ];

    Object.entries(data).forEach(([field, value]) => {
      if (typeof value === 'string') {
        piiPatterns.forEach(pii => {
          if (pii.pattern.test(value)) {
            piiFields.push(field);
          }
        });
      }
    });

    return piiFields;
  }

  private validateDataType(value: any, expectedType: string): boolean {
    switch (expectedType) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'array':
        return Array.isArray(value);
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      default:
        return false;
    }
  }

  private generateQualityRecommendations(issues: QualityIssue[]): string[] {
    const recommendations: string[] = [];

    if (issues.some(issue => issue.type === 'missing_field')) {
      recommendations.push('Ensure all required fields are included in event data');
    }

    if (issues.some(issue => issue.type === 'invalid_format')) {
      recommendations.push('Validate data types and formats before sending events');
    }

    if (issues.some(issue => issue.field === 'timestamp')) {
      recommendations.push('Use accurate timestamps for all events');
    }

    if (issues.some(issue => issue.type === 'schema_violation')) {
      recommendations.push('Review and update event schemas if needed');
    }

    return recommendations;
  }

  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSessionId(): string {
    return `ses_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private exportToCSV(definitions: EventDefinition[]): string {
    const headers = ['ID', 'Name', 'Category', 'Required', 'Sampling', 'Retention', 'PII Fields', 'Sensitive Fields'];
    const rows = definitions.map(def => [
      def.id,
      def.name,
      def.category,
      def.required.toString(),
      def.sampling.toString(),
      def.retention.toString(),
      def.piiFields.join(';'),
      def.sensitiveFields.join(';'),
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }

  private exportToYAML(definitions: EventDefinition[]): string {
    // Simple YAML export - in production, use a proper YAML library
    return definitions.map(def => {
      return `
${def.id}:
  name: ${def.name}
  category: ${def.category}
  description: ${def.description}
  version: ${def.version}
  required: ${def.required}
  sampling: ${def.sampling}
  retention: ${def.retention}
  pii_fields: [${def.piiFields.join(', ')}]
  sensitive_fields: [${def.sensitiveFields.join(', ')}]
  tags: [${def.tags.join(', ')}]
      `.trim();
    }).join('\n');
  }
}

// Export singleton instance
export const analyticsEvents = AnalyticsEvents.getInstance();

// Export utility functions
export const validateEvent = (event: AnalyticsEvent) => analyticsEvents.validateEvent(event);
export const createEvent = (type: string, data: any, options?: any) => analyticsEvents.createEvent(type, data, options);
export const getEventDefinition = (eventType: string) => analyticsEvents.getEventDefinition(eventType);
export const registerEventDefinition = (definition: EventDefinition) => analyticsEvents.registerEventDefinition(definition);
export const getAllEventDefinitions = () => analyticsEvents.getAllEventDefinitions();
export const getEventCategories = () => analyticsEvents.getEventCategories();
export const getEventsByCategory = (category: string) => analyticsEvents.getEventsByCategory(category);
export const assessEventQuality = (event: AnalyticsEvent) => analyticsEvents.assessEventQuality(event);
export const getEventStatistics = () => analyticsEvents.getEventStatistics();
export const exportEventDefinitions = (format?: 'json' | 'csv' | 'yaml') => analyticsEvents.exportEventDefinitions(format);
export const importEventDefinitions = (definitions: EventDefinition[]) => analyticsEvents.importEventDefinitions(definitions);