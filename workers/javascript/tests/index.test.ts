import JavascriptEventWorker from '../src';
import '../../../env-test';
import { JavaScriptEventWorkerTask } from '../types/javascript-event-worker-task';
import { Db, MongoClient, ObjectId } from 'mongodb';
import * as WorkerNames from '../../../lib/workerNames';
import { ReleaseDBScheme } from '@hawk.so/types';
import cloneDeep from 'lodash.clonedeep';

describe('JavaScript event worker', () => {
  let connection: MongoClient;
  let db: Db;

  /**
   * Returns new ObjectId as string
   */
  const objectIdAsString = (): string => {
    return (new ObjectId()).toHexString();
  };

  /**
   * Original user agent before beautification
   */
  const originalUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:80.0) Gecko/20100101 Firefox/80.0';

  /**
   * Parsed user agent for comparing
   */
  const beautifiedUserAgent = {
    os: 'Windows',
    osVersion: '10.0.0',
    browser: 'Firefox',
    browserVersion: '80.0.0',
  };

  /**
   * Original backtrace before beautification
   */
  const originalBacktrace = [
    {
      file: 'file:///main.js',
      line: 1,
      column: 339,
    },
    {
      file: 'file:///static/js/second.js',
      line: 1,
      column: 339,
    },
  ];

  /**
   * Parsed backtrace frame is used for comparing with beautified backtrace
   */
  const parsedBacktraceFrame = {
    column: 20,
    file: 'App.js',
    line: 9,
    function: 'App',
    sourceCode: [ {
      content: '  // throw new Error("Before render")',
      line: 4,
    }, {
      content: '',
      line: 5,
    }, {
      content: '  return (',
      line: 6,
    }, {
      content: '    <div className="App">',
      line: 7,
    }, {
      content: '      <button onClick={() => {',
      line: 8,
    }, {
      content: '          throw new Error("Sourcemaps #12345")',
      line: 9,
    }, {
      content: '      }}>Throw new error</button>',
      line: 10,
    }, {
      content: '    </div>',
      line: 11,
    }, {
      content: '  );',
      line: 12,
    }, {
      content: '}',
      line: 13,
    }, {
      content: '',
      line: 14,
    } ],
  };

  /**
   * Creates event object for JS worker
   *
   * @param withUserAgent - is event with user agent
   * @param withBacktrace - is event with backtrace
   */
  const createEventMock = ({ withUserAgent, withBacktrace }: {withUserAgent?: boolean, withBacktrace?: boolean}): JavaScriptEventWorkerTask => {
    return {
      catcherType: 'errors/javascript',
      projectId: objectIdAsString(),
      timestamp: Date.now(),
      payload: {
        title: 'Mocked event for JS event worker',
        type: 'Error',
        release: '3fa0f290c014',
        addons: {
          window: {
            innerHeight: 1337,
            innerWidth: 960,
          },
          userAgent: withUserAgent && originalUserAgent,
          url: 'https://error.hawk.so',
        },
        backtrace: withBacktrace && originalBacktrace,
      },
    };
  };

  /**
   * Creates release object
   *
   * @param projectId - for what project is this release
   * @param release - release id
   */
  const createReleaseMock = ({ projectId, release }: { projectId: string, release: string }): ReleaseDBScheme => {
    return {
      _id: new ObjectId(),
      projectId,
      release,
      commits: [],
      files: [
        {
          mapFileName: 'main.js.map',
          originFileName: 'main.js',
          _id: new ObjectId(),
        },
        {
          mapFileName: 'second.js.map',
          originFileName: 'static/js/second.js',
          _id: new ObjectId(),
        },
      ],
    };
  };

  const sourceMapFileContent = "{\"version\":3,\"sources\":[\"App.js\",\"reportWebVitals.js\",\"index.js\"],\"names\":[\"App\",\"className\",\"onClick\",\"Error\",\"reportWebVitals\",\"onPerfEntry\",\"Function\",\"then\",\"getCLS\",\"getFID\",\"getFCP\",\"getLCP\",\"getTTFB\",\"HawkCatcher\",\"token\",\"release\",\"ReactDOM\",\"render\",\"StrictMode\",\"document\",\"getElementById\"],\"mappings\":\"2NAceA,MAZf,WAGE,OACE,qBAAKC,UAAU,MAAf,SACE,wBAAQC,QAAS,WACb,MAAM,IAAIC,MAAM,sBADpB,gCCKSC,EAZS,SAAAC,GAClBA,GAAeA,aAAuBC,UACxC,6BAAqBC,MAAK,YAAkD,IAA/CC,EAA8C,EAA9CA,OAAQC,EAAsC,EAAtCA,OAAQC,EAA8B,EAA9BA,OAAQC,EAAsB,EAAtBA,OAAQC,EAAc,EAAdA,QAC3DJ,EAAOH,GACPI,EAAOJ,GACPK,EAAOL,GACPM,EAAON,GACPO,EAAQP,O,OCCD,I,OAAIQ,GAAY,CACzBC,MAAO,gKACPC,QAAS,yBAObC,IAASC,OACP,cAAC,IAAMC,WAAP,UACE,cAAC,EAAD,MAEFC,SAASC,eAAe,SAM1BhB,K\",\"file\":\"static/js/main.423baaa5.chunk.js\",\"sourcesContent\":[\"import './App.css';\\n\\nfunction App() {\\n  // throw new Error(\\\"Before render\\\")\\n\\n  return (\\n    <div className=\\\"App\\\">\\n      <button onClick={() => {\\n          throw new Error(\\\"Sourcemaps #12345\\\")\\n      }}>Throw new error</button>\\n    </div>\\n  );\\n}\\n\\nexport default App;\\n\",\"const reportWebVitals = onPerfEntry => {\\n  if (onPerfEntry && onPerfEntry instanceof Function) {\\n    import('web-vitals').then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {\\n      getCLS(onPerfEntry);\\n      getFID(onPerfEntry);\\n      getFCP(onPerfEntry);\\n      getLCP(onPerfEntry);\\n      getTTFB(onPerfEntry);\\n    });\\n  }\\n};\\n\\nexport default reportWebVitals;\\n\",\"import React from 'react';\\nimport ReactDOM from 'react-dom';\\nimport './index.css';\\nimport App from './App';\\nimport reportWebVitals from './reportWebVitals';\\nimport HawkCatcher from '@hawk.so/javascript';\\nimport * as Hawk from \\\"@hawk/hawk\\\";\\n\\nconst hawk = new HawkCatcher({\\n    token: \\\"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJwcm9qZWN0SWQiOiI2MGUzNGQ1NTEyNzE4OThiMDZkNjIxNTkiLCJpYXQiOjE2MjU1MDkyMDV9.NZk6X2ENnec4b7kaMJtiRLpi2MMFajpO_i8C15O3hXI\\\",\\n    release: \\\"9e8a34877fba73ff773c\\\"\\n})\\n\\n// Hawk.init({\\n//     dsn: \\\"https://844104bee9c74c408d1d7eabbeea6ae7@o294015.ingest/5863244\\\",\\n// });\\n\\nReactDOM.render(\\n  <React.StrictMode>\\n    <App />\\n  </React.StrictMode>,\\n  document.getElementById('root')\\n);\\n\\n// If you want to start measuring performance in your app, pass a function\\n// to log results (for example: reportWebVitals(console.log))\\n// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals\\nreportWebVitals();\\n\"],\"sourceRoot\":\"\"}";

  beforeAll(async () => {
    connection = await MongoClient.connect(process.env.MONGO_EVENTS_DATABASE_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    db = connection.db(); // Use default database from connection URI, same as worker
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should process an event without errors and add a task with correct event information to grouper', async () => {
    /**
     * Arrange
     */
    const worker = new JavascriptEventWorker();

    jest.spyOn(worker, 'addTask');
    await worker.start();
    const workerEvent = createEventMock({});

    /**
     * Act
     *
     * Handle event
     */
    await worker.handle(workerEvent);

    /**
     * Assert
     */
    expect(worker.addTask).toHaveBeenCalledTimes(1);
    expect(worker.addTask).toHaveBeenCalledWith(
      WorkerNames.GROUPER,
      expect.objectContaining({
        projectId: workerEvent.projectId,
        catcherType: workerEvent.catcherType,
        payload: workerEvent.payload,
      })
    );
    await worker.finish();
  });

  it('should parse user agent correctly', async () => {
    /**
     * Arrange
     */
    const worker = new JavascriptEventWorker();

    jest.spyOn(worker, 'addTask');
    await worker.start();
    const workerEvent = createEventMock({ withUserAgent: true });

    /**
     * Act
     *
     * Handle event
     */
    await worker.handle(workerEvent);

    /**
     * Assert
     */
    expect(worker.addTask).toHaveBeenCalledTimes(1);
    expect(worker.addTask).toHaveBeenCalledWith(
      WorkerNames.GROUPER,
      {
        projectId: workerEvent.projectId,
        catcherType: workerEvent.catcherType,
        timestamp: workerEvent.timestamp,
        payload: {
          ...workerEvent.payload,
          addons: {
            ...workerEvent.payload.addons,
            beautifiedUserAgent: expect.objectContaining(beautifiedUserAgent),
          },
        },
      }
    );
    await worker.finish();
  });

  it('should parse source maps correctly', async () => {
    /**
     * Arrange
     */
    const worker = new JavascriptEventWorker();

    jest.spyOn(worker, 'addTask');
    /**
     * Dirty trick to mock source map content resolved from MongoDB
     */
    jest.spyOn(JavascriptEventWorker.prototype as any, 'loadSourceMapFile')
      .mockResolvedValue(sourceMapFileContent);
    await worker.start();

    const workerEvent = createEventMock({ withBacktrace: true });
    const release = createReleaseMock({
      projectId: workerEvent.projectId,
      release: workerEvent.payload.release,
    });

    await db.collection('releases').insertOne(release);

    /**
     * Act
     */
    await worker.handle(workerEvent);

    /**
     * Assert
     */
    expect(worker.addTask).toHaveBeenCalledTimes(1);
    expect(worker.addTask).toHaveBeenCalledWith(
      WorkerNames.GROUPER,
      {
        projectId: workerEvent.projectId,
        catcherType: workerEvent.catcherType,
        timestamp: workerEvent.timestamp,
        payload: {
          ...workerEvent.payload,
          backtrace: [
            expect.objectContaining(parsedBacktraceFrame),
            expect.objectContaining(parsedBacktraceFrame),
          ],
        },
      }
    );
    await worker.finish();
  });

  it('should use cache while processing source maps', async () => {
    /**
     * Arrange
     */
    const worker = new JavascriptEventWorker();

    await worker.start();
    jest.spyOn(worker.releasesDbCollection, 'findOne');

    const workerEvent = createEventMock({ withBacktrace: true });
    const release = createReleaseMock({
      projectId: workerEvent.projectId,
      release: workerEvent.payload.release,
    });

    await db.collection('releases').insertOne(release);

    /**
     * Act
     *
     * Handle event twice
     */
    await worker.handle(workerEvent);
    await worker.handle(workerEvent);

    /**
     * Assert
     *
     * Did only one request to database
     */
    expect(worker.releasesDbCollection.findOne).toHaveBeenCalledTimes(1);
    await worker.finish();
  });

  it('should memoize beautifyBacktrace within several handle calls', async () => {
    // Arrange
    const worker = new JavascriptEventWorker();

    await worker.start();

    // Create event with two frames mapping to the same origin file
    const workerEvent = {
      ...createEventMock({ withBacktrace: true }),
    } as JavaScriptEventWorkerTask;

    workerEvent.payload.backtrace = [
      {
        file: 'file:///main.js',
        line: 1,
        column: 100,
      },
      {
        file: 'file:///main.js',
        line: 1,
        column: 200,
      },
    ] as any;

    const workerEventDuplicate = cloneDeep(workerEvent);

    // Create a release with a single map file used by both frames
    const singleMapRelease = {
      ...createReleaseMock({
        projectId: workerEvent.projectId,
        release: workerEvent.payload.release,
      }),
    } as any;
    const firstFileId = singleMapRelease.files[0]._id;

    singleMapRelease.files = [
      {
        mapFileName: 'main.js.map',
        originFileName: 'main.js',
        _id: firstFileId,
      },
    ];

    await db.collection('releases').insertOne(singleMapRelease);

    /**
     * Cast prototype to any because getReleaseRecord is ts private
     */
    const getReleaseRecordSpy = jest.spyOn(JavascriptEventWorker.prototype as any, 'getReleaseRecord');

    // Act
    await worker.handle(workerEvent);
    await worker.handle(workerEventDuplicate);

    // Assert: Since beautifyBacktrace is now memoized, the entire method should only be called once
    expect(getReleaseRecordSpy).toHaveBeenCalledTimes(1);

    await worker.finish();
  });

  it('should not memoize beautifyBacktrace within several calls with different arguments', async () => {
    // Arrange
    const worker = new JavascriptEventWorker();

    await worker.start();

    // Create event with two frames mapping to the same origin file
    const workerEvent = {
      ...createEventMock({ withBacktrace: true }),
    } as JavaScriptEventWorkerTask;

    workerEvent.payload.backtrace = [
      {
        file: 'file:///main.js',
        line: 1,
        column: 100,
      },
    ] as any;

    /**
     * Worker event with different backtrace
     */
    const anotherWorkerEvent = {
      ...createEventMock({ withBacktrace: true }),
    } as JavaScriptEventWorkerTask;

    anotherWorkerEvent.payload.backtrace = [
      {
        file: 'file:///main.js',
        line: 10,
        column: 14,
      },
    ] as any;

    // Create a release with a single map file used by both frames
    const singleMapRelease = {
      ...createReleaseMock({
        projectId: workerEvent.projectId,
        release: workerEvent.payload.release,
      }),
    } as any;
    const firstFileId = singleMapRelease.files[0]._id;

    singleMapRelease.files = [
      {
        mapFileName: 'main.js.map',
        originFileName: 'main.js',
        _id: firstFileId,
      },
    ];

    await db.collection('releases').insertOne(singleMapRelease);

    /**
     * Cast prototype to any because getReleaseRecord is ts private
     */
    const getReleaseRecordSpy = jest.spyOn(JavascriptEventWorker.prototype as any, 'getReleaseRecord');

    // Act
    await worker.handle(workerEvent);
    await worker.handle(anotherWorkerEvent);

    // Assert: Since beautifyBacktrace is now memoized, the entire method should only be called once
    expect(getReleaseRecordSpy).toHaveBeenCalledTimes(2);

    await worker.finish();
  });

  it('should resolve function context for TypeScript function with angle-bracket type assertion', () => {
    const worker = new JavascriptEventWorker();

    const tsSource = `
      const foo: string | null = 'bar';

      function throwError() {
        const value = <string>foo;
        throw new Error(value);
      }

      export { throwError };
    `;

    /**
     * String with throw new Error(...) is the 6th line (if counting from 1)
     * 1: ''
     * 2: const foo...
     * 3: ''
     * 4: function throwError() {
     * 5:   const value = <string>foo;
     * 6:   throw new Error(value);
     * ...
     */
    const context = (worker as any).getFunctionContext(tsSource, 6, 'example.ts');

    /**
     * We expect that the build with fixes will return the function name,
     * but with the current configuration the jsx+typescript parser fails
     * and getFunctionContext returns null.
     */
    expect(context).toBe('throwError');
  });

  it('should resolve function context for TypeScript generic arrow function', () => {
    const worker = new JavascriptEventWorker();

    const tsSource = `
      type User = {
        id: string;
        name: string;
      };

      const wrap = <T>(value: T): T => {
        return value;
      };

      export const useUser = () => {
        const user: User = wrap<User>({ id: '1', name: 'John' });

        return user;
      };
    `;

    /**
     * String inside useUser - where we want to get context:
     * 1: ''
     * 2: type User = { ...
     * ...
     * 7: const wrap = <T>(value: T): T => {
     * ...
     * 12: export const useUser = () => {
     * 13:   const user: User = wrap<User>({ id: '1', name: 'John' });
     * 14: 
     * 15:   return user;
     * 16: };
     */
    const context = (worker as any).getFunctionContext(tsSource, 13, 'example.ts');

    expect(context).toBe('useUser');
  });

  it('should resolve class method context for TypeScript class with type assertion', () => {
    const worker = new JavascriptEventWorker();

    const tsSource = `
      class ApiClient {
        private baseUrl: string = 'https://example.com';

        public request() {
          const raw = '{"ok":true}';
          const parsed = <Record<string, unknown>>JSON.parse(raw);

          if (!parsed.ok) {
            throw new Error('Request failed');
          }

          return parsed;
        }
      }

      export default ApiClient;
    `;

    /**
     * String where we want to get context - inside the request method:
     * 1: ''
     * 2: class ApiClient {
     * 3:   private baseUrl...
     * 4: 
     * 5:   public request() {
     * 6:     const raw = '{"ok":true}';
     * 7:     const parsed = <Record<string, unknown>>JSON.parse(raw);
     * 8: 
     * 9:     if (!parsed.ok) {
     * 10:      throw new Error('Request failed');
     * ...
     */
    const context = (worker as any).getFunctionContext(tsSource, 7, 'example.ts');

    // We expect "ApiClient.request"
    expect(context).toBe('ApiClient.request');
  });
});
