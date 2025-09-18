/**
 * Alert management system for the kid-friendly-ai monitoring
 * Provides multi-channel alerting, escalation policies, deduplication,
 * routing, automation, and integration with external systems
 */

import {
  Alert,
  AlertRule,
  AlertCondition,
  AlertSeverity,
  AlertChannel,
  AlertChannelConfig,
  AlertResponse,
  EscalationPolicy,
  EscalationLevel,
  MonitoringEvent
} from '../types/monitoring';
import { monitoringManager } from './monitoringManager';
import { PerformanceMetric } from '../types/monitoring';

export interface AlertManagerConfig {
  enabled: boolean;
  maxActiveAlerts: number;
  deduplicationWindow: number;
  escalationEnabled: boolean;
  defaultEscalationPolicy?: string;
  channels: AlertChannel[];
  suppressionRules: SuppressionRule[];
}

export interface SuppressionRule {
  id: string;
  name: string;
  description: string;
  condition: AlertCondition;
  duration: number;
  reason: string;
  createdBy: string;
  createdAt: number;
  active: boolean;
}

export interface AlertNotification {
  alert: Alert;
  channel: AlertChannel;
  message: string;
  timestamp: number;
  status: 'pending' | 'sent' | 'failed' | 'delivered';
  attempt: number;
  maxAttempts: number;
  nextAttempt?: number;
  error?: string;
}

export class AlertManager {
  private static instance: AlertManager;
  private config: AlertManagerConfig;
  private rules: Map<string, AlertRule> = new Map();
  private alerts: Map<string, Alert> = new Map();
  private notifications: Map<string, AlertNotification[]> = new Map();
  activeNotifications: Set<string> = new Set();
  private escalationPolicies: Map<string, EscalationPolicy> = new Map();
  private suppressionRules: Map<string, SuppressionRule> = new Map();
  private eventListeners: Set<(event: MonitoringEvent) => void> = new Set();
  private processingInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.config = this.getDefaultConfig();
    this.initialize();
  }

  static getInstance(): AlertManager {
    if (!AlertManager.instance) {
      AlertManager.instance = new AlertManager();
    }
    return AlertManager.instance;
  }

  private getDefaultConfig(): AlertManagerConfig {
    return {
      enabled: true,
      maxActiveAlerts: 1000,
      deduplicationWindow: 300000, // 5 minutes
      escalationEnabled: true,
      channels: [],
      suppressionRules: []
    };
  }

  private initialize(): void {
    this.setupDefaultRules();
    this.setupEscalationPolicies();
    this.startProcessing();
  }

  private setupDefaultRules(): void {
    // High memory usage alert
    this.createAlertRule({
      id: 'high_memory_usage',
      name: 'High Memory Usage',
      description: 'Memory usage exceeds critical threshold',
      condition: {
        metric: 'memory_usage',
        operator: 'gt',
        value: 90,
        duration: 300000 // 5 minutes
      },
      severity: 'critical',
      channels: [],
      enabled: true,
      cooldown: 600000, // 10 minutes
      triggerCount: 0
    });

    // High error rate alert
    this.createAlertRule({
      id: 'high_error_rate',
      name: 'High Error Rate',
      description: 'Error rate exceeds threshold',
      condition: {
        metric: 'error_rate',
        operator: 'gt',
        value: 5,
        duration: 180000 // 3 minutes
      },
      severity: 'error',
      channels: [],
      enabled: true,
      cooldown: 300000, // 5 minutes
      triggerCount: 0
    });

    // Service health critical alert
    this.createAlertRule({
      id: 'service_health_critical',
      name: 'Service Health Critical',
      description: 'Service health status is critical',
      condition: {
        metric: 'service_health',
        operator: 'eq',
        value: 2, // Critical status
        duration: 60000 // 1 minute
      },
      severity: 'critical',
      channels: [],
      enabled: true,
      cooldown: 300000, // 5 minutes
      triggerCount: 0
    });
  }

  private setupEscalationPolicies(): void {
    this.createEscalationPolicy({
      id: 'default_escalation',
      name: 'Default Escalation Policy',
      description: 'Default escalation for critical alerts',
      levels: [
        {
          level: 1,
          timeout: 300000, // 5 minutes
          targets: ['on-call-engineer'],
          channels: []
        },
        {
          level: 2,
          timeout: 900000, // 15 minutes
          targets: ['senior-engineer', 'team-lead'],
          channels: []
        },
        {
          level: 3,
          timeout: 1800000, // 30 minutes
          targets: ['engineering-manager'],
          channels: []
        }
      ],
      repeatInterval: 3600000, // 1 hour
      maxEscalations: 3
    });
  }

  private startProcessing(): void {
    this.processingInterval = setInterval(() => {
      this.processAlertRules();
      this.processNotifications();
      this.checkEscalations();
      this.cleanupOldAlerts();
    }, 30000); // Every 30 seconds
  }

  // Alert Rule Management
  public createAlertRule(rule: AlertRule): void {
    this.rules.set(rule.id, rule);
    this.emitEvent({
      id: `rule_created_${rule.id}`,
      type: 'custom',
      source: 'alert_manager',
      timestamp: Date.now(),
      data: { action: 'rule_created', rule },
      tags: { ruleId: rule.id }
    });
  }

  public updateAlertRule(id: string, updates: Partial<AlertRule>): void {
    const rule = this.rules.get(id);
    if (rule) {
      Object.assign(rule, updates);
      this.rules.set(id, rule);
    }
  }

  public deleteAlertRule(id: string): void {
    this.rules.delete(id);
  }

  public getAlertRules(): AlertRule[] {
    return Array.from(this.rules.values());
  }

  // Alert Management
  public createAlert(alertData: Omit<Alert, 'id' | 'timestamp'>): Alert {
    const alert: Alert = {
      ...alertData,
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now()
    };

    this.alerts.set(alert.id, alert);
    this.notifications.set(alert.id, []);

    // Check for suppression
    if (!this.isAlertSuppressed(alert)) {
      this.triggerAlert(alert);
    }

    this.emitEvent({
      id: `alert_created_${alert.id}`,
      type: 'custom',
      source: 'alert_manager',
      timestamp: alert.timestamp,
      data: { action: 'alert_created', alert },
      tags: { alertId: alert.id, severity: alert.severity }
    });

    return alert;
  }

  public updateAlert(id: string, updates: Partial<Alert>): void {
    const alert = this.alerts.get(id);
    if (alert) {
      Object.assign(alert, updates, { updatedAt: Date.now() });
      this.alerts.set(id, alert);

      this.emitEvent({
        id: `alert_updated_${id}`,
        type: 'custom',
        source: 'alert_manager',
        timestamp: Date.now(),
        data: { action: 'alert_updated', alert },
        tags: { alertId: id, status: alert.status }
      });
    }
  }

  public acknowledgeAlert(id: string, user: string, message?: string): void {
    this.updateAlert(id, {
      status: 'acknowledged',
      acknowledgedBy: user,
      acknowledgedAt: Date.now()
    });
  }

  public resolveAlert(id: string, user?: string, message?: string): void {
    this.updateAlert(id, {
      status: 'resolved',
      resolvedAt: Date.now()
    });
  }

  public suppressAlert(id: string, duration: number, reason: string, user: string): void {
    this.updateAlert(id, {
      status: 'suppressed'
    });

    // Create suppression rule
    const suppressionRule: SuppressionRule = {
      id: `suppression_${id}`,
      name: `Suppression for ${id}`,
      description: reason,
      condition: {
        metric: '',
        operator: 'eq',
        value: 0
      },
      duration,
      reason,
      createdBy: user,
      createdAt: Date.now(),
      active: true
    };

    this.suppressionRules.set(suppressionRule.id, suppressionRule);

    // Auto-expire suppression
    setTimeout(() => {
      suppressionRule.active = false;
      this.suppressionRules.delete(suppressionRule.id);
    }, duration);
  }

  public getAlerts(status?: Alert['status']): Alert[] {
    const alerts = Array.from(this.alerts.values());
    return status ? alerts.filter(alert => alert.status === status) : alerts;
  }

  // Alert Processing
  private processAlertRules(): void {
    if (!this.config.enabled) return;

    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;

      // Check cooldown
      if (rule.lastTriggered && Date.now() - rule.lastTriggered < rule.cooldown) {
        continue;
      }

      // Evaluate rule condition
      if (this.evaluateAlertRule(rule)) {
        this.triggerRuleAlert(rule);
      }
    }
  }

  private evaluateAlertRule(rule: AlertRule): boolean {
    const metrics = monitoringManager.getPerformanceMetrics(rule.condition.metric);

    if (metrics.length === 0) return false;

    // Filter metrics by duration if specified
    const cutoff = rule.condition.duration ? Date.now() - rule.condition.duration : 0;
    const recentMetrics = metrics.filter(m => m.timestamp >= cutoff);

    if (recentMetrics.length === 0) return false;

    // Apply aggregation
    let value: number;
    switch (rule.condition.aggregation || 'avg') {
      case 'avg':
        value = recentMetrics.reduce((sum, m) => sum + m.value, 0) / recentMetrics.length;
        break;
      case 'max':
        value = Math.max(...recentMetrics.map(m => m.value));
        break;
      case 'min':
        value = Math.min(...recentMetrics.map(m => m.value));
        break;
      case 'sum':
        value = recentMetrics.reduce((sum, m) => sum + m.value, 0);
        break;
      case 'count':
        value = recentMetrics.length;
        break;
      default:
        value = recentMetrics[recentMetrics.length - 1].value;
    }

    // Evaluate condition
    switch (rule.condition.operator) {
      case 'gt': return value > rule.condition.value;
      case 'gte': return value >= rule.condition.value;
      case 'lt': return value < rule.condition.value;
      case 'lte': return value <= rule.condition.value;
      case 'eq': return value === rule.condition.value;
      case 'ne': return value !== rule.condition.value;
      default: return false;
    }
  }

  private triggerRuleAlert(rule: AlertRule): void {
    const alert = this.createAlert({
      ruleId: rule.id,
      name: rule.name,
      description: rule.description,
      severity: rule.severity,
      status: 'active',
      timestamp: Date.now(),
      metric: rule.condition.metric,
      value: 0, // Will be set in the actual evaluation
      threshold: rule.condition.value,
      channels: rule.channels.length > 0 ? rule.channels : this.config.channels
    });

    // Update rule
    rule.lastTriggered = Date.now();
    rule.triggerCount++;
    this.rules.set(rule.id, rule);
  }

  private triggerAlert(alert: Alert): void {
    // Check for deduplication
    if (this.isDuplicateAlert(alert)) {
      return;
    }

    // Create notifications for each channel
    for (const channel of alert.channels) {
      if (!channel.enabled) continue;

      const notification: AlertNotification = {
        alert,
        channel,
        message: this.formatAlertMessage(alert, channel),
        timestamp: Date.now(),
        status: 'pending',
        attempt: 0,
        maxAttempts: 3
      };

      const notifications = this.notifications.get(alert.id) || [];
      notifications.push(notification);
      this.notifications.set(alert.id, notifications);
    }

    monitoringManager.addAlert(alert);
  }

  private isDuplicateAlert(alert: Alert): boolean {
    const recentAlerts = Array.from(this.alerts.values()).filter(a =>
      a.ruleId === alert.ruleId &&
      a.status === 'active' &&
      Date.now() - a.timestamp < this.config.deduplicationWindow
    );

    return recentAlerts.length > 0;
  }

  private isAlertSuppressed(alert: Alert): boolean {
    for (const rule of this.suppressionRules.values()) {
      if (!rule.active) continue;

      if (Date.now() - rule.createdAt > rule.duration) {
        rule.active = false;
        continue;
      }

      // Check if suppression applies to this alert
      if (this.evaluateSuppression(rule, alert)) {
        return true;
      }
    }

    return false;
  }

  private evaluateSuppression(rule: SuppressionRule, alert: Alert): boolean {
    // Simple suppression logic - can be expanded based on specific needs
    return alert.ruleId === rule.id || alert.severity === 'critical';
  }

  // Notification Processing
  private processNotifications(): void {
    const allNotifications: AlertNotification[] = [];

    this.notifications.forEach(notifications => {
      allNotifications.push(...notifications.filter(n => n.status === 'pending'));
    });

    for (const notification of allNotifications) {
      this.sendNotification(notification);
    }
  }

  private async sendNotification(notification: AlertNotification): Promise<void> {
    const notificationId = `${notification.alert.id}_${notification.channel.id}_${notification.attempt}`;

    if (this.activeNotifications.has(notificationId)) {
      return; // Already processing
    }

    this.activeNotifications.add(notificationId);

    try {
      let success = false;

      switch (notification.channel.type) {
        case 'email':
          success = await this.sendEmailNotification(notification);
          break;
        case 'slack':
          success = await this.sendSlackNotification(notification);
          break;
        case 'webhook':
          success = await this.sendWebhookNotification(notification);
          break;
        case 'sms':
          success = await this.sendSmsNotification(notification);
          break;
        case 'pagerduty':
          success = await this.sendPagerDutyNotification(notification);
          break;
        default:
          console.warn(`Unknown notification channel type: ${notification.channel.type}`);
          success = false;
      }

      if (success) {
        notification.status = 'sent';
      } else {
        notification.status = 'failed';
        notification.error = 'Failed to send notification';
      }
    } catch (error) {
      notification.status = 'failed';
      notification.error = error instanceof Error ? error.message : String(error);
    } finally {
      this.activeNotifications.delete(notificationId);

      // Schedule retry if failed
      if (notification.status === 'failed' && notification.attempt < notification.maxAttempts) {
        notification.attempt++;
        notification.status = 'pending';
        notification.nextAttempt = Date.now() + (30000 * Math.pow(2, notification.attempt)); // Exponential backoff
      }
    }
  }

  private async sendEmailNotification(notification: AlertNotification): Promise<boolean> {
    // Placeholder for email notification implementation
    console.log('📧 Email notification:', notification.message);
    return true;
  }

  private async sendSlackNotification(notification: AlertNotification): Promise<boolean> {
    const config = notification.channel.config.slack;
    if (!config) return false;

    const payload = {
      text: notification.message,
      attachments: [{
        color: this.getSeverityColor(notification.alert.severity),
        fields: [
          { title: 'Alert', value: notification.alert.name, short: true },
          { title: 'Severity', value: notification.alert.severity, short: true },
          { title: 'Metric', value: notification.alert.metric, short: true },
          { title: 'Value', value: `${notification.alert.value}`, short: true },
          { title: 'Threshold', value: `${notification.alert.threshold}`, short: true }
        ]
      }]
    };

    try {
      const response = await fetch(config.webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      return response.ok;
    } catch (error) {
      console.error('Slack notification failed:', error);
      return false;
    }
  }

  private async sendWebhookNotification(notification: AlertNotification): Promise<boolean> {
    const config = notification.channel.config.webhook;
    if (!config) return false;

    const payload = {
      alert: notification.alert,
      message: notification.message,
      timestamp: Date.now()
    };

    try {
      const response = await fetch(config, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      return response.ok;
    } catch (error) {
      console.error('Webhook notification failed:', error);
      return false;
    }
  }

  private async sendSmsNotification(notification: AlertNotification): Promise<boolean> {
    // Placeholder for SMS notification implementation
    console.log('📱 SMS notification:', notification.message);
    return true;
  }

  private async sendPagerDutyNotification(notification: AlertNotification): Promise<boolean> {
    // Placeholder for PagerDuty notification implementation
    console.log('🚨 PagerDuty notification:', notification.message);
    return true;
  }

  private formatAlertMessage(alert: Alert, channel: AlertChannel): string {
    const timestamp = new Date(alert.timestamp).toLocaleString();

    switch (channel.type) {
      case 'slack':
        return `🚨 *${alert.name}*\n${alert.description}\n\n*Severity:* ${alert.severity.toUpperCase()}\n*Metric:* ${alert.metric}\n*Value:* ${alert.value}\n*Threshold:* ${alert.threshold}\n*Time:* ${timestamp}`;

      case 'email':
        return `Alert: ${alert.name}\n\nDescription: ${alert.description}\nSeverity: ${alert.severity}\nMetric: ${alert.metric}\nValue: ${alert.value}\nThreshold: ${alert.threshold}\nTime: ${timestamp}`;

      case 'sms':
        return `${alert.name} (${alert.severity.toUpperCase()}): ${alert.description}`;

      default:
        return `${alert.name}: ${alert.description}`;
    }
  }

  private getSeverityColor(severity: AlertSeverity): string {
    switch (severity) {
      case 'critical': return 'danger';
      case 'error': return 'warning';
      case 'warning': return '#ffcc00';
      case 'info': return 'good';
      default: return '#808080';
    }
  }

  // Escalation Management
  private checkEscalations(): void {
    if (!this.config.escalationEnabled) return;

    const activeAlerts = this.getAlerts('active');

    for (const alert of activeAlerts) {
      const timeSinceTriggered = Date.now() - alert.timestamp;

      // Check if alert needs escalation
      if (timeSinceTriggered > 300000) { // 5 minutes
        this.escalateAlert(alert);
      }
    }
  }

  private escalateAlert(alert: Alert): void {
    const policy = this.escalationPolicies.get(this.config.defaultEscalationPolicy || 'default_escalation');
    if (!policy) return;

    // Find appropriate escalation level based on time
    const timeSinceTriggered = Date.now() - alert.timestamp;
    let escalationLevel: EscalationLevel | null = null;

    for (const level of policy.levels) {
      if (timeSinceTriggered >= level.timeout) {
        escalationLevel = level;
      } else {
        break;
      }
    }

    if (escalationLevel) {
      // Send escalation notifications
      for (const channel of escalationLevel.channels) {
        const notification: AlertNotification = {
          alert,
          channel,
          message: `🚨 ESCALATION (${escalationLevel.level}): ${alert.name}`,
          timestamp: Date.now(),
          status: 'pending',
          attempt: 0,
          maxAttempts: 3
        };

        const notifications = this.notifications.get(alert.id) || [];
        notifications.push(notification);
        this.notifications.set(alert.id, notifications);
      }
    }
  }

  // Channel Management
  public addChannel(channel: AlertChannel): void {
    this.config.channels.push(channel);
  }

  public removeChannel(channelId: string): void {
    this.config.channels = this.config.channels.filter(c => c.id !== channelId);
  }

  public updateChannel(channelId: string, updates: Partial<AlertChannel>): void {
    const channel = this.config.channels.find(c => c.id === channelId);
    if (channel) {
      Object.assign(channel, updates);
    }
  }

  // Escalation Policy Management
  public createEscalationPolicy(policy: EscalationPolicy): void {
    this.escalationPolicies.set(policy.id, policy);
  }

  public updateEscalationPolicy(id: string, updates: Partial<EscalationPolicy>): void {
    const policy = this.escalationPolicies.get(id);
    if (policy) {
      Object.assign(policy, updates);
      this.escalationPolicies.set(id, policy);
    }
  }

  // Suppression Rule Management
  public createSuppressionRule(rule: SuppressionRule): void {
    this.suppressionRules.set(rule.id, rule);
  }

  public removeSuppressionRule(ruleId: string): void {
    this.suppressionRules.delete(ruleId);
  }

  // Utility Methods
  private cleanupOldAlerts(): void {
    const cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 days

    this.alerts.forEach((alert, id) => {
      if (alert.status === 'resolved' && alert.resolvedAt && alert.resolvedAt < cutoff) {
        this.alerts.delete(id);
        this.notifications.delete(id);
      }
    });
  }

  private emitEvent(event: MonitoringEvent): void {
    this.eventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in alert manager event listener:', error);
      }
    });
  }

  public addEventListener(listener: (event: MonitoringEvent) => void): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  public getNotifications(alertId?: string): AlertNotification[] {
    if (alertId) {
      return this.notifications.get(alertId) || [];
    }

    const allNotifications: AlertNotification[] = [];
    this.notifications.forEach(notifications => {
      allNotifications.push(...notifications);
    });
    return allNotifications;
  }

  public getConfig(): AlertManagerConfig {
    return { ...this.config };
  }

  public updateConfig(config: Partial<AlertManagerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  public stop(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
  }
}

// Export singleton instance
export const alertManager = AlertManager.getInstance();

// Export utility functions
export const createAlert = (alertData: Omit<Alert, 'id' | 'timestamp'>) => alertManager.createAlert(alertData);
export const acknowledgeAlert = (id: string, user: string, message?: string) => alertManager.acknowledgeAlert(id, user, message);
export const resolveAlert = (id: string, user?: string, message?: string) => alertManager.resolveAlert(id, user, message);
export const suppressAlert = (id: string, duration: number, reason: string, user: string) => alertManager.suppressAlert(id, duration, reason, user);
export const getAlerts = (status?: Alert['status']) => alertManager.getAlerts(status);
export const createAlertRule = (rule: AlertRule) => alertManager.createAlertRule(rule);
export const addAlertChannel = (channel: AlertChannel) => alertManager.addChannel(channel);