/**
 * Sample HTTP server for previewing of email templates
 *
 * How to use:
 *
 * 1. yarn email-overview
 * 2. Open http://localhost:4444/
 *
 */
import * as http from 'http';
import * as url from 'url';
import templates, { Template } from '../src/templates';
import type { TemplateVariables, TemplateEventData } from 'hawk-worker-sender/types/template-variables';
import * as Twig from 'twig';
import { DatabaseController } from '../../../lib/db/controller';
import { GroupedEventDBScheme, ProjectDBScheme, UserDBScheme, WorkspaceDBScheme } from '@hawk.so/types';

import { ObjectId } from 'mongodb';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { HttpStatusCode, HOURS_IN_DAY, MINUTES_IN_HOUR, SECONDS_IN_MINUTE, MS_IN_SEC } from '../../../lib/utils/consts';

/**
 * Merge email worker .env and root workers .env
 */
const rootEnv = dotenv.config({ path: path.resolve(__dirname, '../../../.env') }).parsed;
const localEnv = dotenv.config({ path: path.resolve(__dirname, '../.env') }).parsed;

Object.assign(process.env, rootEnv, localEnv);

/**
 * Milliseconds in day. Needs for calculating difference between dates in days.
 */
const MILLISECONDS_IN_DAY = HOURS_IN_DAY * MINUTES_IN_HOUR * SECONDS_IN_MINUTE * MS_IN_SEC;

/**
 * Server for rendering email templates
 */
class EmailTestServer {
  /**
   * Node.js http server
   */
  private server: http.Server;

  /**
   * Events DB
   */
  private eventsDb: DatabaseController = new DatabaseController(process.env.MONGO_EVENTS_DATABASE_URI);

  /**
   * Accounts DB
   */
  private accountsDb: DatabaseController = new DatabaseController(process.env.MONGO_ACCOUNTS_DATABASE_URI);

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
        await this.onRequest(req, res);
      } catch (error) {
        console.log('Error: ', error);
        this.sendHTML(error.message, res);
      }
    });
  }

  /**
   * Starts server
   */
  public async start(): Promise<void> {
    await this.eventsDb.connect();
    await this.accountsDb.connect();

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
  private async onRequest(request: http.IncomingMessage, response: http.ServerResponse): Promise<void> {
    const queryParams = (new url.URL(request.url, `http://localhost:${this.port}`)).searchParams;

    console.log('Got request: ', request.url);

    if (!queryParams) {
      return;
    }

    const email = queryParams.get('email');
    const projectId = queryParams.get('projectId');
    const workspaceId = queryParams.get('workspaceId');
    const userId = queryParams.get('users');
    const eventIds = queryParams.getAll('eventIds');
    const type = queryParams.get('type');

    if (request.url.includes('fetchEvents')) {
      this.fetchEvents(projectId as string, response);

      return;
    }

    if (!email) {
      this.showForm(response);

      return;
    }

    const project = await this.getProject(projectId);
    const workspace = await this.getWorkspace(workspaceId);
    const user = await this.getUser(userId);
    const ids = typeof eventIds === 'string' ? [ eventIds ] : eventIds;
    const events = await Promise.all(ids.map(async (eventId: string) => {
      const [event, daysRepeated] = await this.getEventData(projectId as string, eventId.trim());

      return {
        event,
        daysRepeated,
        newCount: 3,
        usersAffected: 144,
      };
    })) as TemplateEventData[];

    const templateData = {
      events,
      host: process.env.GARAGE_URL || 'http://localhost:8080',
      hostOfStatic: process.env.API_STATIC_URL || 'http://localhost:4000/static',
      project,
      workspace,
      user,
      period: 10,
      reason: 'error on the payment server side',
      daysAfterPayday: await this.calculateDaysAfterPayday(workspace),
    };

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
    const projects = await this.getAllProjects();
    const workspaces = await this.getAllWorkspaces();
    const users = await this.getAllUsers();

    const renderForm = (): Promise<string> => new Promise((resolve, reject): void => {
      Twig.renderFile(path.resolve(__dirname, 'emailOverviewForm.twig'),
        {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore because @types/twig doesn't match the docs
          templates: Object.keys(templates),
          projects,
          workspaces,
          users,
        },
        (err: Error, result: string) => {
          if (err) {
            reject(err);
          }

          resolve(result);
        });
    });

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
    response.writeHead(HttpStatusCode.Ok, {
      'Content-Type': 'text/html; charset=utf-8',
    });
    response.write(html);
    response.end();
  }

  /**
   * Sends JSON to browser
   *
   * @param json - what to send
   * @param response - node http response stream
   */
  private sendJSON(json: Record<string, unknown> | unknown[], response: http.ServerResponse): void {
    response.writeHead(HttpStatusCode.Ok, {
      'Content-Type': 'application/json',
    });
    response.write(JSON.stringify(json));
    response.end();
  }

  /**
   * Render email template
   *
   * @param templateName - template to render
   * @param variables - variables for template
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
              console.log('Rendering error', err);
              reject(err);
            }

            renderedTemplate[key as keyof Template] = res;

            resolve(null);
          })
      );
    }));

    return renderedTemplate;
  }

  /**
   * Return events by project id
   *
   * @param projectId - events owner
   * @param response - http response stream
   */
  private async fetchEvents(projectId: string, response: http.ServerResponse): Promise<void> {
    const events = await this.getEventsByProjectId(projectId);

    this.sendJSON(events, response);
  }

  /**
   * Get event data for email
   *
   * @param projectId - project events are related to
   * @param eventId - id of event
   */
  private async getEventData(
    projectId: string,
    eventId: string
  ): Promise<[GroupedEventDBScheme, number]> {
    const connection = await this.eventsDb.getConnection();

    const event = await connection.collection(`events:${projectId}`).findOne({
      _id: new ObjectId(eventId),
    });
    const daysRepeated = await connection.collection(`dailyEvents:${projectId}`).countDocuments({
      groupHash: event.groupHash,
    });

    return [event, daysRepeated];
  }

  /**
   * Get project info
   *
   * @param projectId - project id
   */
  private async getProject(projectId: string): Promise<ProjectDBScheme | null> {
    const connection = await this.accountsDb.getConnection();

    return connection.collection('projects').findOne({ _id: new ObjectId(projectId) });
  }

  /**
   * Get workspace info
   *
   * @param workspaceId - workspace id
   */
  private async getWorkspace(workspaceId: string): Promise<WorkspaceDBScheme | null> {
    const connection = await this.accountsDb.getConnection();

    return connection.collection('workspaces').findOne({ _id: new ObjectId(workspaceId) });
  }

  /**
   * Calculate days after payday
   * Return number of days after payday. If payday is in the future, return 0
   *
   * @param workspace - workspace data
   * @returns {Promise<number>} number of days after payday
   */
  private async calculateDaysAfterPayday(
    workspace: WorkspaceDBScheme
  ): Promise<number> {
    /**
     * Calculate number of days after payday
     * The expected payday is either paidUntil or lastChargeDate + 1 month
     * This follows the same logic as PaymasterWorker
     */
    let expectedPayDay: Date | null = null;

    if (workspace.paidUntil) {
      expectedPayDay = new Date(workspace.paidUntil);
    } else if (workspace.lastChargeDate) {
      const lastCharge = new Date(workspace.lastChargeDate);

      expectedPayDay = new Date(lastCharge.getFullYear(), lastCharge.getMonth() + 1, lastCharge.getDate());
    }

    if (!expectedPayDay) {
      return 0;
    }

    const now = new Date();
    const diffTime = now.getTime() - expectedPayDay.getTime();

    if (diffTime <= 0) {
      return 0;
    }

    // Calculate difference in days
    const diffDays = Math.floor(diffTime / MILLISECONDS_IN_DAY);

    return diffDays;
  }

  /**
   * Get user info
   *
   * @param userId - user id
   */
  private async getUser(userId: string): Promise<UserDBScheme | null> {
    const connection = await this.accountsDb.getConnection();

    return connection.collection('users').findOne({ _id: new ObjectId(userId) });
  }

  /**
   * Get all projects
   */
  private async getAllProjects(): Promise<ProjectDBScheme[]> {
    const connection = await this.accountsDb.getConnection();

    return connection.collection('projects').find(null, { limit: 10 })
      .toArray();
  }

  /**
   * Get all workspaces
   */
  private async getAllWorkspaces(): Promise<WorkspaceDBScheme[]> {
    const connection = await this.accountsDb.getConnection();

    return connection.collection('workspaces').find(null, { limit: 10 })
      .toArray();
  }

  /**
   * Get all users
   */
  private async getAllUsers(): Promise<UserDBScheme[]> {
    const connection = await this.accountsDb.getConnection();

    return connection.collection('users').find(null, { limit: 10 })
      .toArray();
  }

  /**
   * Get all projects
   *
   * @param projectId - project id
   */
  private async getEventsByProjectId(projectId: string): Promise<GroupedEventDBScheme[]> {
    const connection = await this.eventsDb.getConnection();

    return connection.collection(`events:${projectId}`).find(null, {
      limit: 30,
    })
      .toArray();
  }
}

const EMAIL_TEST_SERVER_PORT = 4444;

const server = new EmailTestServer(EMAIL_TEST_SERVER_PORT);

server.start();
