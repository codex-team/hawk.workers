import * as path from "path";
import * as fs from "fs";
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

  constructor() {
  }

  /**
   * Create a bundle via Webpack
   */
  build() {
    return new Promise((resolve, reject) => {
      webpack({
        mode: 'production',
        entry: this.entry,
        output: {
          path: this.outputDir,
          libraryExport: 'default',
        }
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
  getBundle() {
    return new Promise((resolve, reject) => {
      fs.readFile(path.resolve(this.outputDir, 'main.js'), (error, data) => {
        if (error) {
          reject(error);
        }

        resolve(data);
      });
    })
  }


  /**
   * Clears created bundle
   */
  clear() {

  }
}
