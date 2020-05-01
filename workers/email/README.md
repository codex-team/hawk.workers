# Worker / Sender/Email

Handle tasks from Notifier worker and send email letters with data about received events.

## How to run  

1. Make sure you are in Workers root directory
3. `yarn install`
4. `yarn run-email`

## When you will add new email template

Don't forget to rebuild auto-generated ENUM with available templates:

1. Go to `workers/email` directory
2. `yarn run generate-tpl-names`

## How to debug email templates

There is a special util allows to debug the email templates.

1. Go to `workers/email` directory
2. `yarn run email-overview`
3. Open http://localhost:4444/
