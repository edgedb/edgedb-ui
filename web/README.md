Development
===========

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
env EDGEDB_DEBUG_INJECT_CORS=1 edgedb instance start --foreground <instance-name>
```

To customize the EdgeDB server address (default is `localhost:5656`):

```sh
env REACT_APP_EDGEDB_SERVER="192.168.0.123:5656" yarn start
```
