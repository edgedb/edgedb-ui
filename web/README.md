# EdgeDB UI web app

Note: If you are just looking to use EdgeDB UI, then you don't need to do any of
these steps, just run the `edgedb ui` command from your project directory.

## Development

> Prerequisites: You will need to have Yarn 2+ installed, and have run the
> `yarn` command to install the workspace's dependencies.

To start the UI dev server:

```sh
yarn start
```

The app is served at `http://localhost:3000/ui`.

The EdgeDB server needs to be run separately with CORS and
admin UI enabled, e.g.:

```sh
# Using dev server:
env EDGEDB_DEBUG_HTTP_INJECT_CORS=1 edb server --admin-ui=enabled

# or with a nightly instance:
env EDGEDB_DEBUG_HTTP_INJECT_CORS=1 edgedb instance start --foreground <instance-name>
```

To customize the EdgeDB server address (if it's not running at the
default of `localhost:5656`):

```sh
env REACT_APP_EDGEDB_SERVER="192.168.0.123:5656" yarn start
```
