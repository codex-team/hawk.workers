import * as fs from 'fs';
import * as path from 'path';
import rimraf from 'rimraf';
import webpack from 'webpack';

/**
 * Create a webpack-bundle for mock app in ./mock/src/
 */
export default class MockBundle {
  /**
   * Index.js file of testing app
   */
  private readonly entry: string = path.resolve(__dirname, 'mock', 'src', 'index.js');

  /**
   * Where to store bundle
   */
  private readonly outputDir: string = path.resolve(__dirname, 'mock', 'dist');

  /**
   * Create a bundle via Webpack
   */
  public build(): Promise<void> {
    return new Promise((resolve, reject) => {
      webpack({
        mode: 'production',
        entry: this.entry,
        output: {
          path: this.outputDir,
          filename: 'main.js',
          library: {
            type: 'commonjs2',
            export: 'default',
          },
        },
        devtool: 'source-map',
        /**
         * Webpack 5 requires explicit target configuration
         */
        target: 'node',
      }, (err, stats) => {
        if (err) {
          console.error('[MockBundle] Webpack compilation error:', err);
          reject(err);

          return;
        }

        if (!stats) {
          reject(new Error('Webpack stats is undefined'));

          return;
        }

        const info = stats.toJson();

        if (stats.hasErrors()) {
          console.error('[MockBundle] Webpack compilation errors:');
          console.error(JSON.stringify(info.errors, null, 2));
          reject(info.errors);

          return;
        }

        if (stats.hasWarnings()) {
          console.warn('[MockBundle] Webpack compilation warnings:');
          console.warn(JSON.stringify(info.warnings, null, 2));
        }

        resolve();
      });
    });
  }

  /**
   * Load bundle file and return it's content
   */
  public getBundle(): Promise<string> {
    return new Promise((resolve, reject) => {
      fs.readFile(path.resolve(this.outputDir, 'main.js'), (error, data) => {
        if (error) {
          reject(error);
        }

        /**
         * Convert content from Binary to base64
         */
        const dataStringified = data.toString('base64');

        resolve(dataStringified);
      });
    });
  }

  /**
   * Load source map file and return it's content in base64
   */
  public getSourceMap(): Promise<string> {
    return new Promise((resolve, reject) => {
      fs.readFile(path.resolve(this.outputDir, 'main.js.map'), (error, data) => {
        if (error) {
          reject(error);
        }

        /**
         * Convert content from Binary to base64
         */
        const dataStringified = data.toString('base64');

        resolve(dataStringified);
      });
    });
  }

  /**
   * Clears created bundle
   */
  public clear(): Promise<void> {
    return new Promise((resolve) => {
      rimraf.sync(this.outputDir);
      resolve();
    });
  }
}
