export default class RuleValidator {
  private readonly event: any;
  private readonly rule: any;

  constructor(rule, event) {
    this.event = event;
    this.rule = rule;
  }

  public checkIfRuleIsOn() {
    const { rule } = this;

    if (!rule.isEnabled) {
      throw Error('Rule is disabled');
    }

    return this;
  }

  public checkWhatToReceive() {
    const {rule, event} = this;
    const result = rule.whatToReceive === 'all' || (event.isNew && rule.whatToReceive === 'new');

    if (!result) {
      throw Error('Event doesn\'t match `what to receive` filter');
    }

    return this;
  }

  public checkIncludingWords() {
    const {rule, event} = this;
    const { including = [] } = rule;
    let result;

    if (!including.length) {
      result = true;
    } else {
      result = including.some((word: string) => event.title.includes(word))
    }

    if (!result) {
      throw Error('Event title doesn\'t include required words');
    }

    return this;
  }

  public checkExcludingWords() {
    const {rule, event} = this;
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

  public checkAll() {
    return this
      .checkIfRuleIsOn()
      .checkWhatToReceive()
      .checkIncludingWords()
      .checkExcludingWords();
  }
}
