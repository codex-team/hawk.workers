import * as nodemailer from 'nodemailer';
import * as Twig from 'twig';
import {Logger} from 'winston';
import {TemplateVariables} from '../types/template-variables';
import templates, {Template} from './templates';

export default class EmailProvider {
  /**
   * NodeMailer SMTP config
   */
  private smtpConfig = {
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: true,
    auth: {
      user: process.env.SMTP_USERNAME,
      pass: process.env.SMTP_PASSWORD,
    },
  };

  /**
   *  NodeMailer SMTP transport
   *
   * 'as any' used because @types/nodemailer doesn't match the docs
   */
  private transporter = nodemailer.createTransport(this.smtpConfig as any);

  /**
   * Logger instance
   */
  private logger: Logger;

  /**
   * @constructor
   */
  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Send email to recipient
   *
   * @param {string} to - recipient email
   * @param {string} templateName - template name
   * @param {TemplateVariables} variables - variables for template
   */
  public async send(to: string, templateName: string, variables: TemplateVariables) {
    if (!templateName) {
      throw new Error('Template name must be specified');
    }

    const content = await this.render(templateName, variables);

    const mailOptions = {
      from: `"${process.env.SMTP_SENDER_NAME}" <${process.env.SMTP_SENDER_ADDRESS}>`,
      to,
      ...content,
    };

    if (process.env.NODE_ENV === 'development') {
      this.logger.info(content);
    }

    try {
      await this.transporter.sendMail(mailOptions);
    } catch (e) {
      this.logger.error(
        'Error sending letter. Try to check the environment settings (in .env file).',
      );
    }
  }

  /**
   * Render email templates
   *
   * @param {string} templateName - template to render
   * @param {TemplateVariables} variables - variables for template
   *
   * @return {Promise<Template>}
   */
  private async render(templateName: string, variables: TemplateVariables): Promise<Template> {
    const template: Template = templates[templateName];
    const renderedTemplate: Template = {
      subject: '',
      text: '',
      html: '',
    };

    await Promise.all(Object.keys(template).map((key) => {
      return new Promise(
        (resolve) => Twig.renderFile(
          template[key],
          // @ts-ignore because @types/twig doesn't match the docs
          variables,
          (err, res) => {
            renderedTemplate[key] = res;

            resolve();
          }),
      );
    }));

    return renderedTemplate;
  }
}
