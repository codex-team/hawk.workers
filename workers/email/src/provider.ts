import * as nodemailer from 'nodemailer';
import * as Twig from 'twig';
import { AllNotifications, TemplateVariables, NotificationTypes } from 'hawk-worker-sender/types/template-variables';
import templates, { Template } from './templates';
import NotificationsProvider from 'hawk-worker-sender/src/provider';
import * as utils from '../../../lib/utils';

import Templates from './templates/names';

/**
 * Class to provide email notifications
 */
export default class EmailProvider extends NotificationsProvider {
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private transporter = nodemailer.createTransport(this.smtpConfig as { [key: string]: any });

  /**
   * Send email to recipient
   *
   * @param {string} to - recipient email
   * @param {TemplateVariables} variables - variables wrapped in a payload with type
   */
  public async send(to: string, variables: AllNotifications): Promise<void> {
    let templateName: Templates;

    if (variables?.type == NotificationTypes.Event) {
      templateName = Templates.NewEvent;
    } else if (variables?.type == NotificationTypes.SeveralEvents) {
      templateName = Templates.SeveralEvents;
    } else if (variables?.type == NotificationTypes.Assignee) {
      templateName = Templates.Assignee;
    }

    this.sendNotification(to, variables, templateName);
  }

  /**
   * Send notification to user email
   *
   * @param to - recipient email. Person who was assigned to solve the issue
   * @param variables - variables for template
   * @param templateName - name of the template to render
   */
  public async sendNotification(to: string, variables: AllNotifications, templateName: Templates): Promise<void> {
    let content: Template;

    try {
      content = await this.render(templateName, variables.payload);
    } catch (e) {
      this.logger.error(`Failed to render ${templateName} template `, e);

      return;
    }

    const mailOptions = {
      from: `'${process.env.SMTP_SENDER_NAME}' <${process.env.SMTP_SENDER_ADDRESS}>`,
      to,
      ...content,
    };

    if (process.env.NODE_ENV === 'development') {
      this.logger.info(`Mail sent to ${to}: \n\n + ${content}`);
    }

    try {
      await this.transporter.sendMail(mailOptions);
    } catch (e) {
      this.logger.error(
        'Error sending letter. Try to check the environment settings (in .env file).', e
      );

      utils.sendReport('📮 Email worker\n\n' + (e.message || e.toString()));
    }
  }

  /**
   * Render email templates
   *
   * @param {string} templateName - template to render
   * @param {TemplateVariables} variables - variables for template
   *
   * @returns {Promise<Template>}
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
        (resolve, reject) => Twig.renderFile(
          template[key as keyof Template],
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore because @types/twig doesn't match the docs
          variables,
          (err: Error, res: string): void => {
            if (err) {
              reject(err);
            }

            renderedTemplate[key as keyof Template] = res;

            resolve();
          })
      );
    }));

    return renderedTemplate;
  }
}
