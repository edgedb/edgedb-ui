# EdgeDB UI

This monorepo is the home of EdgeDB UI and all related UI components
that it shares with the EdgeDB website and cloud.

If you are just looking to use EdgeDB UI: it already comes bundled with
the EdgeDB server, and opening it is as simple as running the command
`edgedb ui` from your project directory.

## Contributing

This repo is organised using yarn workspaces as follows:

- `/web`: This is the main workspace of EdgeDB UI that is bundled with the
  EdgeDB server. Refer to <./web/readme.md> for instructions on how to build
  and develop EdgeDB UI.

- `/shared`: This directory contains all the shared components used by EdgeDB
  UI and across the website and cloud. Each subdirectory is it's own
  workspace; the most notable being `studio`, which contains the REPL, schema
  viewer and data viewer/editor components.
