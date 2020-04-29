'use strict';

import { NotifierEvent } from '../types/notifier-task';
import { Rule } from '../types/rule';

/**
 * WhatToReceive property values
 */
export enum WhatToReceive {
  All = 'ALL',
  New = 'ONLY_NEW',
}

/**
 * Helper class to filter notification rules
 */
export default class RuleValidator {
  /**
   * Received event
   */
  private readonly event: NotifierEvent;

  /**
   * Rule to validate
   */
  private readonly rule: Rule;

  /**
   * Constructor
   *
   * @param {Rule} rule - rule to validate
   * @param {NotifierEvent} event - received event
   */
  constructor(rule: Rule, event: NotifierEvent) {
    this.event = event;
    this.rule = rule;
  }

  /**
   * Check if rule is enabled
   *
   * @throws {Error} if rule is disabled
   *
   * @returns {RuleValidator}
   */
  public checkIfRuleIsOn(): RuleValidator {
    const { rule } = this;

    if (!rule.isEnabled) {
      throw Error('Rule is disabled');
    }

    return this;
  }

  /**
   * Check if event fits whatToReceive rule
   *
   * @throws {Error} if event doesn't fit
   *
   * @returns {RuleValidator}
   */
  public checkWhatToReceive(): RuleValidator {
    const { rule, event } = this;
    const result = rule.whatToReceive === WhatToReceive.All ||
      (event.isNew && rule.whatToReceive === WhatToReceive.New);

    if (!result) {
      throw Error('Event doesn\'t match `what to receive` filter');
    }

    return this;
  }

  /**
   * Check if event title includes required words
   *
   * @throws {Error} if event title doesn't include required words
   *
   * @returns {RuleValidator}
   */
  public checkIncludingWords(): RuleValidator {
    const { rule, event } = this;
    const { including = [] } = rule;
    let result;

    if (!including.length) {
      result = true;
    } else {
      result = including.some((word: string) => event.title.includes(word));
    }

    if (!result) {
      throw Error('Event title doesn\'t include required words');
    }

    return this;
  }

  /**
   * Check if event title doesn't contain excluding words
   *
   * @throws {Error} if title contains excluding words
   *
   * @returns {RuleValidator}
   */
  public checkExcludingWords(): RuleValidator {
    const { rule, event } = this;
    const { excluding = [] } = rule;
    let result;

    if (!excluding.length) {
      result = true;
    } else {
      result = !excluding.some((word: string) => event.title.toLowerCase().includes(word));
    }

    if (!result) {
      throw Error('Event title includes unwanted words');
    }

    return this;
  }

  /**
   * Call all checks
   *
   * @throws {Error} if some of checks doesn't fit
   *
   * @returns {RuleValidator}
   */
  public checkAll(): RuleValidator {
    return this
      .checkIfRuleIsOn()
      .checkWhatToReceive()
      .checkIncludingWords()
      .checkExcludingWords();
  }
}
