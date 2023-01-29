# uyem

Selective Forwarding Unit (SFU) is a WebRTC web application library, the server part of which is written in Node, and the client part is a ReactJS/Next.js shared component.

![https://kolserdav-portfolio.s3.eu-central-1.amazonaws.com/uyem2.gif](https://kolserdav-portfolio.s3.eu-central-1.amazonaws.com/uyem2.gif)

## Homepage (demo)

https://uyem.ru/en

## Know-how

<details>
  <summary>WebRTC SFU Server</summary>

![docs/images/sfu1.png](./docs/images/sfu1.png)

## </details>

## Dependencies,

---

- NodeJS v^16.\*
- MariaDB v^10.\*
- Coturn @latest

---

## ... or

- NodeJS v^16.\*
- docker-compose @latest

<details>
  <summary>Docker Environment</summary>
  
 ```sh
docker-compose up -d
```

- [docker-compose.ci.yml](./docker-compose.ci.yml) + [Coturn](https://github.com/coturn/coturn) + [Mariadb](https://mariadb.org/)
- [docker-compose.yml](./docker-compose.yml) + [PhpMyAdmin](https://www.phpmyadmin.net/)

![docs/images/DockerContainersDBTurn.png](./docs/images/DockerContainersDBTurn.png)

## </details>

---

## Installation

- Install source:

```sh
npm i uyem
```

## Settings

- To be able to create connections on a host other than localhost, you need to connect SSL certificates.

Sample setup SSL certificates from Let's Encrypt for client and for server together with `nginx` see [docs/SSL.md](./docs.SSL.md)

---

- To remote access between units using valid `iceServers` is required:

---

```javascript
const iceServers = [
  {
    urls: ['stun:127.0.0.1:3478'],
  },
  {
    urls: ['turn:127.0.0.2:3478'],
    username: 'username',
    credential: 'password',
  },
];
```

See [docs/COTURN.md](docs/COTURN.md) for more details.

---

## Server preparation

- Add property `migrate` to the `scripts` block of `package.json`:

```json
"migrate": "uyem --db mysql://root:root@127.0.0.1:3306/uyem_db --migrate"
```

- Conducting migrations:

```sh
npm run migrate
```

## Usage on client

- Import module styles:

```javascript
import 'uyem/packages/client/dist/styles.css';
```

- Import component:

```javascript
import Uyem from 'uyem';
```

## Usage on sever

```javascript
const { createServer } = require('uyem/server');

createServer({ port: 3233 });
```

## Client examples

- [ReactJS](examples/hello-world/src)
- [Next.js](examples/ssr-client/pages)
- [Without JSX](examples/without-jsx)

## Server examples

- [Include server](examples/server)
- [WS listener, database access](examples/server-ws)
- [Event handlers](examples/server-handlers)

## Contributing

See [docs/CONTRIBUTING.md](./docs/CONTRIBUTING.md)
