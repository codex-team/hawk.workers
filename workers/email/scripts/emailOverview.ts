/**
 * Sample HTTP server for previewing of email template
 *
 * How to use [requires Node.js 10.0.0+ and npm install]:
 *
 * 1. yarn email-overview
 * 2. Open http://localhost:4444/
 *
 */
import * as http from 'http';
import * as url from 'url';
import templates, { Template } from '../src/templates';
import {EventsTemplateVariables, TemplateEventData} from 'hawk-worker-sender/types/template-variables';
import * as Twig from 'twig';
import {DatabaseController} from '../../../lib/db/controller';
import {GroupedEvent} from 'hawk-worker-grouper/types/grouped-event';
import {ObjectID, ObjectId} from 'mongodb';
import * as path from "path";
import * as dotenv from 'dotenv';
import {Project} from 'hawk-worker-sender/types/project';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

class ServerExample {
  /**
   * Node.js http server
   */
  private server: http.Server;

  /**
   * Events DB
   */
  private eventsDb: DatabaseController = new DatabaseController();

  /**
   * Accounts DB
   */
  private accountsDb: DatabaseController = new DatabaseController();
  /**
   * Server port
   */
  private readonly port: number;

  /**
   * Creates server
   *
   * @param port - port to expose
   */
  constructor(port: number) {
    this.port = port;
    this.server = http.createServer(async (req, res) => {
      try {
        await this.onRequest(req, res)
      } catch (error){
        console.log('Error: ', error);
        this.sendHTML(error.message, res);
      }
    });
  }

  /**
   * Starts server
   */
  public async start(): Promise<void> {
    await this.eventsDb.connect(process.env.EVENTS_DB_NAME!);
    await this.accountsDb.connect(process.env.ACCOUNTS_DB_NAME!);

    this.server.listen(this.port);

    this.server.on('listening', () => {
      const link = `http://localhost:${this.port}/`;

      console.log('\x1b[36m%s\x1b[0m', '\nEmail overview is now available on ' + link + '\n');
    });

    this.server.on('error', (error) => {
      console.log('Failed to run server', error);
    });
  }

  /**
   * Request handler
   *
   * @param request - accepted request
   * @param response - response that will be sent
   */
  async onRequest(request: http.IncomingMessage, response: http.ServerResponse) {
    const queryObject = url.parse(request.url,true).query;

    console.log('Got request: ', request.url);

    if (!queryObject){
      return;
    }

    const { email, projectId, eventIds, type } = queryObject;

    if (!email) {
      this.showForm(response);

      return;
    }

    const project = await this.getProject(projectId as string);
    const events = await Promise.all((eventIds as string).split('\n').map(async (eventId: string) => {
        const [event, daysRepeated] = await this.getEventData(projectId as string, eventId.trim());

        return {
          event,
          daysRepeated,
          newCount: 3,
          usersAffected: 144,
        }
    })) as TemplateEventData[];



    const templateData = {
      events,
      host: process.env.GARAGE_URL,
      project,
      period: 10,
    }

    try {
      const { subject, text, html } = await this.render(email as string, templateData);

      switch (type) {
        case 'text':
          this.sendHTML(text.replace(/([^>\r\n]?)(\r\n|\n\r|\r|\n)/g, '$1' + '<br>' + '$2'), response);
          break;
        case 'subject':
          this.sendHTML(subject, response);
          break;
        default:
        case 'html':
          this.sendHTML(html, response);
          break;
      }

    } catch (e) {
      console.log('Rendering error', e);
    }
  }

  /**
   * Render form to fill GET params
   *
   * @param response - node http response stream
   */
  private async showForm(response: http.ServerResponse): Promise<void> {
    const renderForm = () => new Promise((resolve, reject) => {
      Twig.renderFile(path.resolve(__dirname, 'emailOverviewForm.twig'),
        {
        // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
        // @ts-ignore because @types/twig doesn't match the docs
          templates: Object.keys(templates)
        },
        (err: Error, result: any) => {
        if (err) {
          reject(err);
        }

        resolve(result);
      })});

    const form = await renderForm();

    this.sendHTML(form as string, response);
  }

  /**
   * Sends HTML to browser
   *
   * @param html - what to send
   * @param response - node http response stream
   */
  private sendHTML(html: string, response: http.ServerResponse): void {
    response.writeHead(200, {
      'Content-Type': 'text/html',
    });
    response.write(html);
    response.end();
  }

  /**
   * Render email template
   *
   * @param templateName - template to render
   * @param variables - variables for template
   *
   * @returns {Promise<Template>}
   */
  private async render(templateName: string, variables: EventsTemplateVariables): Promise<Template> {
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
          // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
          // @ts-ignore because @types/twig doesn't match the docs
          variables,
          (err: Error, res: string): void => {
            if (err) {
              console.log('Rendering error', err);
              reject(err);
            }

            renderedTemplate[key as keyof Template] = res;

            resolve();
          })
      );
    }));

    return renderedTemplate;
  }


  /**
   * Get event data for email
   *
   * @param {string} projectId - project events are related to
   * @param {string} eventId - id of event
   *
   * @returns {Promise<[GroupedEvent, number]>}
   */
  private async getEventData(
    projectId: string,
    eventId: string
  ): Promise<[GroupedEvent, number]> {
    const connection = await this.eventsDb.getConnection();

    const event = await connection.collection(`events:${projectId}`).findOne({
      '_id': new ObjectId(eventId)
    });
    const daysRepeated = await connection.collection(`dailyEvents:${projectId}`).countDocuments({
      groupHash: event.groupHash
    });

    return [event, daysRepeated];
  }

  /**
   * Get project info
   *
   * @param {string} projectId - project id
   * @returns {Promise<Project>}
   */
  private async getProject(projectId: string): Promise<Project | null> {
    const connection = await this.accountsDb.getConnection();

    return connection.collection('projects').findOne({ _id: new ObjectID(projectId) });
  }
}

const server = new ServerExample(4444);

server.start();
