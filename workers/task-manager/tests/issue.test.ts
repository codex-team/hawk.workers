import { ObjectId } from 'mongodb';
import type { GroupedEventDBScheme, ProjectDBScheme } from '@hawk.so/types';
import { formatIssueFromEvent } from '../src/utils/issue';

describe('formatIssueFromEvent', () => {
  const mockProject: ProjectDBScheme = {
    _id: new ObjectId('507f1f77bcf86cd799439011'),
    name: 'Test Project',
    workspaceId: new ObjectId('507f1f77bcf86cd799439012'),
  } as ProjectDBScheme;

  beforeEach(() => {
    /**
     * Reset GARAGE_URL env var
     */
    delete process.env.GARAGE_URL;
  });

  afterEach(() => {
    /**
     * Clean up env var
     */
    delete process.env.GARAGE_URL;
  });

  it('should format issue with basic event data', () => {
    const event: GroupedEventDBScheme = {
      _id: new ObjectId(),
      groupHash: 'test-hash-123',
      totalCount: 42,
      catcherType: 'javascript',
      payload: {
        title: 'Test Error',
      },
      usersAffected: 1,
      visitedBy: [],
      timestamp: 1234567890,
    };

    const result = formatIssueFromEvent(event, mockProject);

    expect(result.title).toBe('[Hawk] Test Error');
    expect(result.body).toBe(
      `**View in Hawk:** https://garage.hawk.so/project/507f1f77bcf86cd799439011/event/test-hash-123
**Total occurrences:** 42

<!-- hawk_groupHash: test-hash-123 -->`
    );
  });


  it('should include stacktrace when backtrace is present', () => {
    const event: GroupedEventDBScheme = {
      _id: new ObjectId(),
      groupHash: 'test-hash-789',
      totalCount: 5,
      catcherType: 'javascript',
      payload: {
        title: 'Error with stacktrace',
        backtrace: [
          {
            file: 'src/index.js',
            line: 10,
            column: 5,
            function: 'handleRequest',
          },
          {
            file: 'src/app.js',
            line: 20,
            column: 0,
            function: 'process',
          },
        ],
      },
      usersAffected: 1,
      visitedBy: [],
      timestamp: 1234567890,
    };

    const result = formatIssueFromEvent(event, mockProject);

    expect(result.body).toBe(
      `**View in Hawk:** https://garage.hawk.so/project/507f1f77bcf86cd799439011/event/test-hash-789
**Total occurrences:** 5

**Stacktrace:**
\`\`\`
at handleRequest (src/index.js:10:5)
at process (src/app.js:20:0)
\`\`\`

<!-- hawk_groupHash: test-hash-789 -->`
    );
  });

  it('should limit stacktrace to 10 frames', () => {
    const backtrace = Array.from({ length: 15 }, (_, i) => ({
      file: `src/file${i}.js`,
      line: i,
      column: 0,
      function: `func${i}`,
    }));

    const event: GroupedEventDBScheme = {
      _id: new ObjectId(),
      groupHash: 'test-hash-many-frames',
      totalCount: 1,
      catcherType: 'javascript',
      payload: {
        title: 'Error with many frames',
        backtrace,
      },
      usersAffected: 1,
      visitedBy: [],
      timestamp: 1234567890,
    };

    const result = formatIssueFromEvent(event, mockProject);

    const expectedBody = `**View in Hawk:** https://garage.hawk.so/project/507f1f77bcf86cd799439011/event/test-hash-many-frames
**Total occurrences:** 1

**Stacktrace:**
\`\`\`
at func0 (src/file0.js:0:0)
at func1 (src/file1.js:1:0)
at func2 (src/file2.js:2:0)
at func3 (src/file3.js:3:0)
at func4 (src/file4.js:4:0)
at func5 (src/file5.js:5:0)
at func6 (src/file6.js:6:0)
at func7 (src/file7.js:7:0)
at func8 (src/file8.js:8:0)
at func9 (src/file9.js:9:0)
\`\`\`

<!-- hawk_groupHash: test-hash-many-frames -->`;

    expect(result.body).toBe(expectedBody);
  });

  it('should include source code snippets when available', () => {
    const event: GroupedEventDBScheme = {
      _id: new ObjectId(),
      groupHash: 'test-hash-source',
      totalCount: 1,
      catcherType: 'javascript',
      payload: {
        title: 'Error with source code',
        backtrace: [
          {
            file: 'src/index.js',
            line: 10,
            column: 5,
            function: 'handleRequest',
            sourceCode: [
              { line: 8, content: 'const x = 1;' },
              { line: 9, content: 'const y = 2;' },
              { line: 10, content: 'throw new Error("test");' },
              { line: 11, content: 'const z = 3;' },
            ],
          },
        ],
      },
      usersAffected: 1,
      visitedBy: [],
      timestamp: 1234567890,
    };

    const result = formatIssueFromEvent(event, mockProject);

    expect(result.body).toBe(
      `**View in Hawk:** https://garage.hawk.so/project/507f1f77bcf86cd799439011/event/test-hash-source
**Total occurrences:** 1

**Stacktrace:**
\`\`\`
at handleRequest (src/index.js:10:5)
  8: const x = 1;
  9: const y = 2;
  10: throw new Error("test");
\`\`\`

<!-- hawk_groupHash: test-hash-source -->`
    );
  });

  it('should handle missing frame properties with defaults', () => {
    const event: GroupedEventDBScheme = {
      _id: new ObjectId(),
      groupHash: 'test-hash-defaults',
      totalCount: 1,
      catcherType: 'javascript',
      payload: {
        title: 'Error with missing properties',
        backtrace: [
          {
            file: undefined,
            line: undefined,
            column: undefined,
            function: undefined,
          },
        ],
      },
      usersAffected: 1,
      visitedBy: [],
      timestamp: 1234567890,
    };

    const result = formatIssueFromEvent(event, mockProject);

    expect(result.body).toBe(
      `**View in Hawk:** https://garage.hawk.so/project/507f1f77bcf86cd799439011/event/test-hash-defaults
**Total occurrences:** 1

**Stacktrace:**
\`\`\`
at <anonymous> (<unknown>:0:0)
\`\`\`

<!-- hawk_groupHash: test-hash-defaults -->`
    );
  });

  it('should not include stacktrace section when backtrace is empty', () => {
    const event: GroupedEventDBScheme = {
      _id: new ObjectId(),
      groupHash: 'test-hash-no-stacktrace',
      totalCount: 1,
      catcherType: 'javascript',
      payload: {
        title: 'Error without stacktrace',
        backtrace: [],
      },
      usersAffected: 1,
      visitedBy: [],
      timestamp: 1234567890,
    };

    const result = formatIssueFromEvent(event, mockProject);

    expect(result.body).toBe(
      `**View in Hawk:** https://garage.hawk.so/project/507f1f77bcf86cd799439011/event/test-hash-no-stacktrace
**Total occurrences:** 1

<!-- hawk_groupHash: test-hash-no-stacktrace -->`
    );
  });

  it('should not include stacktrace section when backtrace is missing', () => {
    const event: GroupedEventDBScheme = {
      _id: new ObjectId(),
      groupHash: 'test-hash-no-backtrace',
      totalCount: 1,
      catcherType: 'javascript',
      payload: {
        title: 'Error without backtrace',
      },
      usersAffected: 1,
      visitedBy: [],
      timestamp: 1234567890,
    };

    const result = formatIssueFromEvent(event, mockProject);

    expect(result.body).toBe(
      `**View in Hawk:** https://garage.hawk.so/project/507f1f77bcf86cd799439011/event/test-hash-no-backtrace
**Total occurrences:** 1

<!-- hawk_groupHash: test-hash-no-backtrace -->`
    );
  });

  it('should format complete issue with all fields', () => {
    const event: GroupedEventDBScheme = {
      _id: new ObjectId(),
      groupHash: 'complete-test-hash',
      totalCount: 100,
      catcherType: 'javascript',
      payload: {
        title: 'Complete Error Example',
        backtrace: [
          {
            file: 'src/main.js',
            line: 42,
            column: 10,
            function: 'main',
            sourceCode: [
              { line: 40, content: 'const data = fetchData();' },
              { line: 41, content: 'processData(data);' },
              { line: 42, content: 'throw new Error("Failed");' },
            ],
          },
        ],
      },
      usersAffected: 5,
      visitedBy: [],
      timestamp: 1234567890,
    };

    const result = formatIssueFromEvent(event, mockProject);

    expect(result.title).toBe('[Hawk] Complete Error Example');
    expect(result.body).toBe(
      `**View in Hawk:** https://garage.hawk.so/project/507f1f77bcf86cd799439011/event/complete-test-hash
**Total occurrences:** 100

**Stacktrace:**
\`\`\`
at main (src/main.js:42:10)
  40: const data = fetchData();
  41: processData(data);
  42: throw new Error("Failed");
\`\`\`

<!-- hawk_groupHash: complete-test-hash -->`
    );
  });
});
