import RuleValidator, { WhatToReceive } from '../src/validator';

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('RuleValidator', () => {
  const ruleMock = {
    isEnabled: true,
    whatToReceive: WhatToReceive.All,
    including: [],
    excluding: [],
  };

  const eventMock = {
    isNew: true,
    title: 'Some test title',
  } as any;

  describe('checkIfRuleIsOn', () => {
    it('should pass if rule is enabled', () => {
      const rule = { ...ruleMock } as any;

      rule.isEnabled = true;

      const validator = new RuleValidator(rule, eventMock);

      expect(() => validator.checkIfRuleIsOn()).not.toThrowError();
      expect(validator.checkIfRuleIsOn()).toBeInstanceOf(RuleValidator);
    });

    it('should fail if rule is disabled', () => {
      const rule = { ...ruleMock } as any;

      rule.isEnabled = false;

      const validator = new RuleValidator(rule, eventMock);

      expect(() => validator.checkIfRuleIsOn()).toThrowError('Rule is disabled');
    });
  });

  describe('checkWhatToReceive', () => {
    it('should pass if what to receive is \'all\'', () => {
      const rule = { ...ruleMock } as any;

      rule.whatToReceive = WhatToReceive.All;

      const validator = new RuleValidator(rule, eventMock);

      expect(() => validator.checkWhatToReceive()).not.toThrowError();
      expect(validator.checkWhatToReceive()).toBeInstanceOf(RuleValidator);
    });

    it('should pass if what to receive is \'new\' and event is new', () => {
      const rule = { ...ruleMock } as any;
      const event = { ...eventMock };

      rule.whatToReceive = WhatToReceive.New;
      event.isNew = true;

      const validator = new RuleValidator(rule, event);

      expect(() => validator.checkWhatToReceive()).not.toThrowError();
      expect(validator.checkWhatToReceive()).toBeInstanceOf(RuleValidator);
    });

    it('should fail if what to receive is \'new\' but event is not new', () => {
      const rule = { ...ruleMock } as any;
      const event = { ...eventMock };

      rule.whatToReceive = WhatToReceive.New;
      event.isNew = false;

      const validator = new RuleValidator(rule, event);

      expect(() => validator.checkWhatToReceive()).toThrowError('Event doesn\'t match `what to receive` filter');
    });
  });

  describe('checkIncludingWords', () => {
    it('should pass if event title includes some of the words', () => {
      const rule = { ...ruleMock } as any;
      const event = { ...eventMock };

      rule.including = ['included', 'excluded'];
      event.title = 'Included word is included';

      const validator = new RuleValidator(rule, event);

      expect(() => validator.checkIncludingWords()).not.toThrowError();
      expect(validator.checkIncludingWords()).toBeInstanceOf(RuleValidator);
    });

    it('should pass if words list is empty', () => {
      const rule = { ...ruleMock } as any;
      const event = { ...eventMock };

      rule.including = [];
      event.title = 'Included word is included, and excluded is also included';

      const validator = new RuleValidator(rule, event);

      expect(() => validator.checkIncludingWords()).not.toThrowError();
      expect(validator.checkIncludingWords()).toBeInstanceOf(RuleValidator);
    });

    it('should fail if event title doesn\'t include any of the words', () => {
      const rule = { ...ruleMock } as any;
      const event = { ...eventMock };

      rule.including = [ 'exclude' ];
      event.title = 'Title doesn\'t include any of the words';

      const validator = new RuleValidator(rule, event);

      expect(() => validator.checkIncludingWords()).toThrowError('Event title doesn\'t include required words');
    });
  });

  describe('checkExcludingWords', () => {
    it('should pass if event title doesn\'t include any of the words', () => {
      const rule = { ...ruleMock } as any;
      const event = { ...eventMock };

      rule.excluding = ['included', 'excluded'];
      event.title = 'This title doesn\'t have any of the words';

      const validator = new RuleValidator(rule, event);

      expect(() => validator.checkIncludingWords()).not.toThrowError();
      expect(validator.checkExcludingWords()).toBeInstanceOf(RuleValidator);
    });

    it('should fail if event title includes some of the words', () => {
      const rule = { ...ruleMock } as any;
      const event = { ...eventMock };

      rule.excluding = ['included', 'excluded'];
      event.title = 'Included word is included';

      const validator = new RuleValidator(rule, event);

      expect(() => validator.checkExcludingWords()).toThrowError('Event title includes unwanted words');
    });

    it('should pass if words list is empty', () => {
      const rule = { ...ruleMock } as any;
      const event = { ...eventMock };

      rule.excluding = [];
      event.title = 'Included word is included, and excluded is also included';

      const validator = new RuleValidator(rule, event);

      expect(() => validator.checkExcludingWords()).not.toThrowError();
      expect(validator.checkIncludingWords()).toBeInstanceOf(RuleValidator);
    });
  });

  describe('checkAll', () => {
    it('should return instance of RuleValidator', () => {
      const rule = { ...ruleMock } as any;
      const event = { ...eventMock };

      const validator = new RuleValidator(rule, event);

      expect(validator.checkAll()).toBeInstanceOf(RuleValidator);
    });

    it('should call all check methods', () => {
      const rule = { ...ruleMock } as any;
      const event = { ...eventMock };

      const validator = new RuleValidator(rule, event);

      validator.checkIfRuleIsOn = jest.fn(() => validator);
      validator.checkWhatToReceive = jest.fn(() => validator);
      validator.checkIncludingWords = jest.fn(() => validator);
      validator.checkExcludingWords = jest.fn(() => validator);

      validator.checkAll();

      expect(validator.checkIfRuleIsOn).toBeCalledTimes(1);
      expect(validator.checkWhatToReceive).toBeCalledTimes(1);
      expect(validator.checkIncludingWords).toBeCalledTimes(1);
      expect(validator.checkExcludingWords).toBeCalledTimes(1);
    });
  });
});
