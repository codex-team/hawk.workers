import Buffer from '../src/buffer';

describe('Buffer', () => {
  describe('getField', () => {
    const field = 'field';
    const defaultValue = 1;

    it('should set field if not exists', () => {
      const obj = {};
      const buffer = new Buffer();

      // @ts-ignore
      buffer.getField(obj, field, defaultValue);

      expect(field in obj).toBeTruthy();
    });

    it('should return default value if field doesn\'t exist', () => {
      const obj = {};
      const buffer = new Buffer();

      // @ts-ignore
      buffer.getField(obj, field, defaultValue);

      expect(obj[field]).toEqual(defaultValue);
    });

    it('should return existing value if field exists', () => {
      const value = 5;
      const obj = {
        [field]: value,
      };
      const buffer = new Buffer();

      // @ts-ignore
      buffer.getField(obj, field, defaultValue);

      expect(obj[field]).toEqual(value);
    });
  });

  const projectId = 'project';
  const ruleId = 'rule';
  const channelName = 'channel';
  const key = 'event';

  describe('push', () => {

    it('should add new key with 1 as default value', () => {
      const buffer = new Buffer();

      buffer.push([projectId, ruleId, channelName, key]);

      // @ts-ignore
      expect(buffer.projects[projectId][ruleId][channelName].payload[key]).toBeDefined();
      // @ts-ignore
      expect(buffer.projects[projectId][ruleId][channelName].payload[key]).toEqual(1);
    });

    it('should increment value by key', () => {
      const buffer = new Buffer();

      buffer.push([projectId, ruleId, channelName, key]);
      buffer.push([projectId, ruleId, channelName, key]);

      // @ts-ignore
      expect(buffer.projects[projectId][ruleId][channelName].payload[key]).toEqual(2);
    });
  });

  describe('get', () => {
    it('should return value by key', () => {
      const buffer = new Buffer();

      buffer.push([projectId, ruleId, channelName, key]);

      const data = buffer.get([projectId, ruleId, channelName, key]);

      // @ts-ignore
      expect(data).toEqual(buffer.projects[projectId][ruleId][channelName].payload[key]);
    });

    it('should return array of tuples if key not specified', () => {
      const buffer = new Buffer();

      buffer.push([projectId, ruleId, channelName, key]);

      // @ts-ignore
      const tuples = Object.entries(buffer.projects[projectId][ruleId][channelName].payload)
        .map(([k, count]) => ({key: k, count}));

      expect(buffer.get([projectId, ruleId, channelName])).toStrictEqual(tuples);
    });

    it('should return undefined if key doesn\'t exist', () => {
      const buffer = new Buffer();

      expect(buffer.get([projectId, ruleId, channelName, key])).toBeUndefined();
    });
  });

  describe('size', () => {
    it('should return 0 if buffer is empty', () => {
      const buffer = new Buffer();

      expect(buffer.size([projectId, ruleId, channelName])).toEqual(0);
    });

    it('should return buffer size', () => {
      const buffer = new Buffer();

      buffer.push([projectId, ruleId, channelName, 'event1']);

      expect(buffer.size([projectId, ruleId, channelName])).toEqual(1);

      buffer.push([projectId, ruleId, channelName, 'event2']);

      expect(buffer.size([projectId, ruleId, channelName])).toEqual(2);
    });
  });

  describe('setTimer', () => {
    it('should set timer', () => {
      const buffer = new Buffer();

      buffer.setTimer([projectId, ruleId, channelName], 10, () => {});

      // @ts-ignore
      const timer = buffer.projects[projectId][ruleId][channelName].timer;

      expect(timer).not.toEqual(0);
    });

    it('should call callback', (done) => {
      const buffer = new Buffer();

      const callback = jest.fn(() => {
        expect(callback).toBeCalled();
        done();
      });

      buffer.setTimer([projectId, ruleId, channelName], 1000, callback);
    });

    it('should call callback with arguments', (done) => {
      const buffer = new Buffer();

      const callback = jest.fn(() => {
        expect(callback).toBeCalledWith([projectId, ruleId, channelName]);
        done();
      });

      buffer.setTimer([projectId, ruleId, channelName], 1000, callback);
    });
  });

  describe('getTimer', () => {
    it('should return null timer doesn\'t exist', () => {
      const buffer = new Buffer();

      expect(buffer.getTimer([projectId, ruleId, channelName])).toBeNull();
    });

    it('should return timer', () => {
      const buffer = new Buffer();

      buffer.setTimer([projectId, ruleId, channelName], 10, () => {});

      // @ts-ignore
      const timer = buffer.projects[projectId][ruleId][channelName].timer;

      expect(buffer.getTimer([projectId, ruleId, channelName])).toEqual(timer);
    });
  });

  describe('clearTimer', () => {
    it('should clear timer', () => {
      const buffer = new Buffer();

      jest.useFakeTimers();

      buffer.setTimer([projectId, ruleId, channelName], 10000, () => {});

      buffer.clearTimer([projectId, ruleId, channelName]);

      // @ts-ignore
      const timer = buffer.projects[projectId][ruleId][channelName].timer;

      expect(timer).toBeNull();
      expect(clearTimeout).toBeCalled();

      jest.useRealTimers();
    });
  });

  describe('flush', () => {
    it('should clear payload', () => {
      const buffer = new Buffer();

      buffer.push([projectId, ruleId, channelName, key]);

      expect(buffer.get([projectId, ruleId, channelName, key])).toEqual(1);

      buffer.flush([projectId, ruleId, channelName]);

      // @ts-ignore
      expect(buffer.projects[projectId][ruleId][channelName].payload).toEqual({});
    });

    it('should return payload after flush', () => {
      const buffer = new Buffer();

      buffer.push([projectId, ruleId, channelName, key]);

      const data = buffer.get([projectId, ruleId, channelName]);

      expect(buffer.flush([projectId, ruleId, channelName])).toStrictEqual(data);
    });
  });

  describe('flushAll', () => {
    it('should clear project payload', () => {
      const buffer = new Buffer();

      buffer.push([projectId, ruleId, channelName, key]);

      expect(buffer.get([projectId, ruleId, channelName, key])).toEqual(1);

      buffer.flushAll(projectId);

      // @ts-ignore
      expect(buffer.projects[projectId]).toEqual({});
    });

    it('should clear all projects', () => {
      const buffer = new Buffer();

      buffer.push([projectId, ruleId, channelName, key]);

      expect(buffer.get([projectId, ruleId, channelName, key])).toEqual(1);

      buffer.flushAll();

      // @ts-ignore
      expect(buffer.projects).toEqual({});
    });
  });
});
