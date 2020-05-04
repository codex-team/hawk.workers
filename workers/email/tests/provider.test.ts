/* eslint-disable */
import { EventsTemplateVariables } from 'hawk-worker-sender/types/template-variables';

const nodemailerMock = jest.genMockFromModule('nodemailer') as any;
const sendMailMock = jest.fn();

nodemailerMock.createTransport = jest.fn(() => ({
  sendMail: sendMailMock,
}));

jest.mock('nodemailer', () => nodemailerMock);

import { GroupedEvent } from 'hawk-worker-grouper/types/grouped-event';
import '../src/env';
import EmailProvider from '../src/provider';
import Templates from '../src/templates/names';
import { Project } from 'hawk-worker-sender/types/project';

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

      await provider.send(to, {events: [{event: {}}], project: {}} as any);

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
    it('should successfully render a new-event template', async () => {
      const vars: EventsTemplateVariables = {
        events: [{
          event: {
            totalCount: 10,
            payload: {
              title: 'New event',
              timestamp: Date.now(),
              backtrace: [{
                file: 'file',
                line: 1,
                sourceCode: [{
                  line: 1,
                  content: 'code',
                }],
              }],
            },
          } as GroupedEvent,
          daysRepeated: 1,
          newCount: 1,
        }],
        period: 60,
        host: process.env.GARAGE_URL!,
        hostOfStatic: process.env.API_STATIC_URL!,
        project: {
          _id: 'projectId',
          name: 'Project',
          notifications: [],
        } as Project,
      };

      const provider = new EmailProvider();
      let template;

      // @ts-ignore
      const render = () => provider.render(Templates.NewEvent, vars);

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
        events: [ {
          event: {
            totalCount: 10,
            payload: {
              title: 'New event',
              timestamp: Date.now(),
              backtrace: [ {
                file: 'file',
                line: 1,
                sourceCode: [ {
                  line: 1,
                  content: 'code',
                } ],
              } ],
            },
          } as GroupedEvent,
          daysRepeated: 1,
          newCount: 1,
        } ],
        host: process.env.GARAGE_URL!,
        hostOfStatic: process.env.API_STATIC_URL!,
        project: {
          _id: 'projectId',
          name: 'Project',
          notifications: [],
        } as Project,
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
  });
});