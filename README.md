# registry

Workers system task manager

## Getting started

Required software:

- Node.js >= 10 (tested on 10 and 11)
- Redis >= 3 (tested on 3.2.12 and 5.0.1)
- Systemd if you want to have a service

You can choose to either run it in screen or as a systemd service.

In first, screen keeps server opened and nodemon reloads on all changes. Logs are written to file in folder.

In second, systemd is responsible for restarting on failure and on reboot. Easy control commands are also available, e.g. `service registry stop/restart/stop/status`. Logs are written to linux's `syslog`.

##### Start

- Rename `.env.sample` to `.env` and edit vartiables
- Install dependencies
  ```bash
  yarn install
  ```
- Start server
  ```bash
  yarn start # or `yarn dev` for development mode
  ```

Alternatively you can use `bin/run.sh` script which keeps server in screen.

##### Systemd service

Easy way:

- Run `bin/install-service.sh` (It will automatically create new user if not exists and write node path to service)
- Fix permissions for new user `chown -R registry:registry .`

Manual way:

- Copy `bin/registry.service` to `/lib/systemd/system/`
- Create user `registry`
- Make sure new user have permissions to files/node binary (`git clone` to `/home/registry`)
- Edit `registry.service` for your node and index.js paths
- Run. `systemctl start registry`

We recommend using [nvm](https://github.com/creationix/nvm) to install latest node for new user.

## API

##### `GET /api/popTask/:workerName` - Pop task for `workerName`. Returns json-formatted task.

Example request:

```http
> GET /api/popTask/zoneCheck HTTP/1.1
> Host: localhost:3000
> User-Agent: insomnia/6.2.0
> Accept: */*

< HTTP/1.1 200 OK
< X-Powered-By: Express
< Content-Type: application/json; charset=utf-8
< Content-Length: 69
< ETag: W/"45-b4xIf816YhSshIXzI/lZb/OCLhg"
< Date: Sat, 17 Nov 2018 18:15:59 GMT
< Connection: keep-alive
| {"task":{"domain":"kek","id":"31d2f6f2-bad6-4459-9f18-eb88802edd56"}}
```

Return codes:

- 200 if OK
- 202 if no tasks available at this moment
- 500 if server error occured

---

##### `PUT /api/pushTask/:workerName` - Push task for `workerName`.

Body should contain task payload in json format.
Example request:

```http
> PUT /api/pushTask/zoneCheck HTTP/1.1
> Host: localhost:3000
> User-Agent: insomnia/6.2.0
> Content-Type: application/json
> Accept: _/_
> Content-Length: 25
| {
| "args": [
| "kek"
|   ]
| }

< HTTP/1.1 200 OK
```

Return codes:

- 200 if pushed to worker
- 500 if server error occured
