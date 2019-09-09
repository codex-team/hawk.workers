import * as fs from 'fs';
import * as path from 'path';
import * as rimraf from 'rimraf';
import * as webpack from 'webpack';

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
  public build() {
    return new Promise((resolve, reject) => {
      webpack({
        mode: 'production',
        entry: this.entry,
        output: {
          path: this.outputDir,
          libraryExport: 'default',
        },
        devtool: 'source-map',
      }, (err, stats) => {
        if (err) {
          reject(err);
          return;
        }

        const info = stats.toJson();

        if (stats.hasErrors()) {
          reject(info.errors);
        }

        if (stats.hasWarnings()) {
          console.warn(info.warnings);
        }

        resolve(info);
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
  public clear() {
    return new Promise((resolve) => {
      rimraf(this.outputDir, resolve);
    });
  }
}
