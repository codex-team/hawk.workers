import * as fs from 'fs';
import './extensions';

/**
 * Interface describes email template object
 */
export interface Template {
  /**
   * Subject template
   */
  subject: string;

  /**
   * Letter HTML content
   */
  html: string;

  /**
   * Plain text version of the letter
   */
  text: string;
}

/**
 * Collects template files
 */
const templates: {[name: string]: Template} = fs.readdirSync(__dirname) // read templates directory
  .filter((name) => {
    return !name.endsWith('.ts') && name !== 'blocks';
  }) // leave only template folders
  .reduce((accumulator, templateName) => {
    const templateDir = `${__dirname}/${templateName}/`;
    const templateContent = fs.readdirSync(templateDir);

    // go to each folder and find the template files
    const subjectFilename = templateContent.find((fileName) =>
      fileName.startsWith('subject'),
    );
    const htmlFilename = templateContent.find((fileName) =>
      fileName.startsWith('html'),
    );
    const textFilename = templateContent.find((fileName) =>
      fileName.startsWith('text'),
    );

    // write content of the template files to the object
    accumulator[templateName] = {
      subject: templateDir + subjectFilename,
      html: templateDir + htmlFilename,
      text: templateDir + textFilename,
    };

    return accumulator;
  }, {});

export default templates;
