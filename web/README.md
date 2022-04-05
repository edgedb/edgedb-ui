Development
===========

To start the UI dev server:

`yarn start`

To customize the EdgeDB server address:

`env REACT_APP_EDGEDB_SERVER="192.168.0.123:5656" yarn start`

The EdgeDB development server can be run separately with CORS and
admin UI enabled, e.g.:

`env EDGEDB_DEBUG_HTTP_INJECT_CORS=1 edb server --admin-ui=enabled`
