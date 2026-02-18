/* eslint-disable */
import type {EventsTemplateVariables, AssigneeTemplateVariables, Notification} from 'hawk-worker-sender/types/template-variables';

const nodemailerMock = jest.genMockFromModule('nodemailer') as any;
const sendMailMock = jest.fn();

nodemailerMock.createTransport = jest.fn(() => ({
  sendMail: sendMailMock,
}));

jest.mock('nodemailer', () => nodemailerMock);

import { DecodedGroupedEvent, ProjectDBScheme, UserDBScheme } from '@hawk.so/types';
import '../src/env';
import EmailProvider from '../src/provider';
import Templates from '../src/templates/names';
import { ObjectId } from 'mongodb';

describe('EmailProvider', () => {
  describe('SMTP Transport', () => {
    it('should create nodemailer transporter with config on construct', () => {
      const provider = new EmailProvider();

      // @ts-ignore
      expect(nodemailerMock.createTransport).toBeCalledWith(provider.smtpConfig);
    });

    it('should send email on send call', async () => {
      const provider = new EmailProvider();
      const to = 'test@test';

      // @ts-ignore
      provider.render = jest.fn(() => ({
        subject: '',
        html: '',
        text: '',
      }));

      await provider.send(to, {
        type: 'event',
        payload: {
          events: [{ event: {} }],
          project: {}
        }
      } as Notification);

      const options = {
        from: `"${process.env.SMTP_SENDER_NAME}" <${process.env.SMTP_SENDER_ADDRESS}>`,
        to,
        subject: expect.any(String),
        text: expect.any(String),
        html: expect.any(String),
      };

      expect(sendMailMock).toBeCalledWith(options);
    });
  });

  describe('templates', () => {
    it('should successfully render a event template', async () => {
      const vars: EventsTemplateVariables = {
        events: [{
          event: {
            totalCount: 10,
            timestamp: Date.now(),
            payload: {
              title: 'New event',
              backtrace: [{
                file: 'file',
                line: 1,
                sourceCode: [{
                  line: 1,
                  content: 'code',
                }],
              }],
            },
          } as DecodedGroupedEvent,
          daysRepeated: 1,
          newCount: 1,
        }],
        period: 60,
        host: process.env.GARAGE_URL!,
        hostOfStatic: process.env.API_STATIC_URL!,
        notificationRuleId: '5d206f7f9aaf7c0071d64596',
        project: {
          _id: new ObjectId('5d206f7f9aaf7c0071d64596'),
          token: 'project-token',
          name: 'Project',
          workspaceId: new ObjectId('5d206f7f9aaf7c0071d64596'),
          uidAdded: new ObjectId('5d206f7f9aaf7c0071d64596'),
          notifications: [],
        } as ProjectDBScheme,
      };

      const provider = new EmailProvider();
      let template;

      // @ts-ignore
      const render = () => provider.render(Templates.Event, vars);

      expect(render).not.toThrowError();

      template = await render();

      expect(template).toEqual({
        subject: expect.any(String),
        html: expect.any(String),
        text: expect.any(String),
      });
    });

    it('should successfully render a several-events template', async () => {
      const vars: EventsTemplateVariables = {
        events: [{
          event: {
            totalCount: 10,
            timestamp: Date.now(),
            payload: {
              title: 'New event',
              backtrace: [{
                file: 'file',
                line: 1,
                sourceCode: [{
                  line: 1,
                  content: 'code',
                }],
              }],
            },
          } as DecodedGroupedEvent,
          daysRepeated: 1,
          newCount: 1,
        }],
        host: process.env.GARAGE_URL!,
        hostOfStatic: process.env.API_STATIC_URL!,
        notificationRuleId: '5d206f7f9aaf7c0071d64596',
        project: {
          _id: new ObjectId('5d206f7f9aaf7c0071d64596'),
          token: 'project-token',
          name: 'Project',
          workspaceId: new ObjectId('5d206f7f9aaf7c0071d64596'),
          uidAdded: new ObjectId('5d206f7f9aaf7c0071d64596'),
          notifications: [],
        } as ProjectDBScheme,
        period: 60,
      };

      const provider = new EmailProvider();
      let template;

      // @ts-ignore
      const render = () => provider.render(Templates.SeveralEvents, vars);

      expect(render).not.toThrowError();

      template = await render();

      expect(template).toEqual({
        subject: expect.any(String),
        html: expect.any(String),
        text: expect.any(String),
      });
    });

    it('should successfully render an assignee template', async () => {
      const vars: AssigneeTemplateVariables = {
        event: {
          totalCount: 10,
          timestamp: Date.now(),
          payload: {
            title: 'New event',
            backtrace: [{
              file: 'file',
              line: 1,
              sourceCode: [{
                line: 1,
                content: 'code',
              }],
            }],
          },
        } as DecodedGroupedEvent,
        daysRepeated: 1,
        host: process.env.GARAGE_URL!,
        hostOfStatic: process.env.API_STATIC_URL!,
        whoAssigned: {
          _id: new ObjectId('5ec3ffe769c0030022f88f24'),
          email: 'user@email.ru',
          password: '$argon2i$v=19$m=4096,t=3,p=1$QOo3u8uEor0t+nqCLpEW3g$aTCDEaHht9ro9VZDD1yZGpaTi+g1OWsfHbYd5TQBRPs',
          name: 'Hahahawk',
        },
        assignee: {
          _id: new ObjectId('5ec3ffe769c0030022f88f25'),
          email: 'assignee@email.ru',
          name: 'Assignee User',
        } as UserDBScheme,
        project: {
          _id: new ObjectId('5d206f7f9aaf7c0071d64596'),
          token: 'project-token',
          name: 'Project',
          workspaceId: new ObjectId('5d206f7f9aaf7c0071d64596'),
          uidAdded: new ObjectId('5d206f7f9aaf7c0071d64596'),
          notifications: [],
        } as ProjectDBScheme,
      };

      const provider = new EmailProvider();
      let template;

      // @ts-ignore
      const render = () => provider.render(Templates.Assignee, vars);

      expect(render).not.toThrowError();

      template = await render();

      expect(template).toEqual({
        subject: expect.any(String),
        html: expect.any(String),
        text: expect.any(String),
      });
    });
  });
});
