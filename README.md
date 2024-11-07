# Gel UI

This monorepo is the home of Gel UI and all related UI components
that it shares with the Gel website and cloud.

If you are just looking to use Gel UI: it already comes bundled with
the Gel server, and opening it is as simple as running the command
`gel ui` from your project directory.

## Contributing

This repo is organised using yarn workspaces as follows:

- `/web`: This is the main workspace of Gel UI that is bundled with the
  Gel server. Refer to <./web/readme.md> for instructions on how to build
  and develop Gel UI.

- `/shared`: This directory contains all the shared components used by Gel
  UI and across the website and cloud. Each subdirectory is it's own
  workspace; the most notable being `studio`, which contains the REPL, schema
  viewer and data viewer/editor components.
