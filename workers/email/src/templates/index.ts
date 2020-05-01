import * as fs from 'fs';
import * as path from 'path';
import './extensions';
import Templates from './names';

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
 * This folder contains available emails templates
 */
const emailTemplatesDir = 'emails';

/**
 * Path to email templates folder
 */
const emailTemplatesPath = path.resolve(__dirname, emailTemplatesDir);

/**
 * Collects template files
 * Return object like
 * {
 * 'new-event': {
 *   subject: '/Users/.../hawk.mono/workers/workers/email/src/templates/emails/new-event/subject.twig',
 *   html: '/Users/.../hawk.mono/workers/workers/email/src/templates/emails/new-event/html.twig',
 *   text: '/Users/.../hawk.mono/workers/workers/email/src/templates/emails/new-event/text.twig'
 * },
 * 'several-events': {
 *   subject: '/Users/.../hawk.mono/workers/workers/email/src/templates/emails/several-events/subject.twig',
 *   html: '/Users/.../hawk.mono/workers/workers/email/src/templates/emails/several-events/html.twig',
 *   text: '/Users/.../hawk.mono/workers/workers/email/src/templates/emails/several-events/text.twig'
 * }
}
 */
const templates: {[name: string]: Template} = fs.readdirSync(emailTemplatesPath)
  .reduce((accumulator, templateName) => {
    const templateDir = `${emailTemplatesPath}/${templateName}/`;
    const templateContent = fs.readdirSync(templateDir);

    // go to each folder and find the template files
    const subjectFilename = templateContent.find((fileName) =>
      fileName.startsWith('subject')
    );
    const htmlFilename = templateContent.find((fileName) =>
      fileName.startsWith('html')
    );
    const textFilename = templateContent.find((fileName) =>
      fileName.startsWith('text')
    );

    // write content of the template files to the object
    accumulator[templateName as Templates] = {
      subject: templateDir + subjectFilename,
      html: templateDir + htmlFilename,
      text: templateDir + textFilename,
    };

    return accumulator;
  }, {} as {[K in Templates]: Template});

export default templates;
