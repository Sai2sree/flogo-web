# Engine interaction

This document explains how the flogo-web server interacts with the Flogo CLI to create, inspect and run the engine.

> :warning: For a better understanding of this document you will need first to get familiar with the usage of the [Flogo CLI](https://github.com/project-flogo/cli).

> :computer: Most of the code that deals with the engine management can be found at [`apps/server/src/modules/engine`](https://github.com/project-flogo/flogo-web/tree/master/apps/server/src/modules/engine)

There's only one design time engine per Flogo Web instance. Flogo apps are not persisted into this engine, instead the Flogo Web
has a database where it stores all the applications created and imported by the user. This is because for test-running a flow
the engine doesn't read the app.json in the file system, instead it loads it dynamically from the flow service.

To compile/build an app the `flogo.json` is required to be in the filesystem, for that a second engine project is created on-demand.

The times when the Flogo Web server needs to interacto with Flogo CLI are:

1. [When the engine project doesn't exist](#when-the-engine-project-doesnt-exist)
1. [Every time the app starts](#every-time-the-app-starts)
1. [When a user wants to install a new contribution](#when-a-user-wants-to-install-a-new-contribution)
1. [When a user wants to download the binary for an app](#when-a-user-wants-to-download-the-binary-for-an-app)

### When the engine project doesn't exist

The flogo-web server will try to find and existing engine in the file system, if it cannot find an engine then it will:

1.  [Create a new design engine](#1.-create-a-new-design-engine)
1.  [Install contributions](#2.-install-contributions)

#### 1. Create a new design engine

By default the flogo-web server tries to find an engine project under `dist/local/engines/flogo-web` if not found it will
create a new one by running:

```bash
flogo create -f default-app.json flogo-web
```

- [default-app.json](https://github.com/project-flogo/flogo-web/blob/master/apps/server/src/config/default-flogo.json) is a
  flogo.json with the minimum properties required by the flogo-cli create command. It doesn't declare any activities or
  triggers to allow the next step to install all the default contributions.

By default a version for `project-flogo/core` is not specified, this is to make sure the dev environment uses the latest code from `project-flogo/core`.
The version used for `priject-flogo/core` can be controlled by setting the `FLOGO_LIB_VERSION` or the `FLOGO_WEB_LIB_VERSION` environment variable.
Note that this only applies to engine creation and the engine will need to be re-created (i.e. deleted) to take the version changes.

When the `FLOGO_LIB_VERSION` environment variable is specified the create command changes to:

```bash
flogo create -f default-app.json --cv $FLOGO_LIB_VERSION flogo-web
```

#### 2. Install contributions

Once the design engine is created the default contributions (activities, triggers, functions and actions) are installed into the engine. This is done in two steps.

First step is to create a dynamic [contribution bundle](https://github.com/project-flogo/cli/blob/master/docs/commands.md#install) out of the contribution references declared by the [Flogo Web plugins](./plugins.md). The dynamic contribution bundle is then installed into the engine by running:

```bash
flogo install --file /path/to/generated.plugin.bundle.json
```

The second step is to install the default contribution bundle. The [`default-bundle.json`](https://github.com/project-flogo/flogo-web/blob/master/apps/server/src/config/default-contrib-bundle.json) describes the contributions to be included by default in the engine and made available to be used in the UI. During engine creation the default bundle can be switched by setting the environment variable `FLOGO_WEB_DEFAULT_PALETTE` to point to the location of another bundle in the filesystem.

### Every time the app starts

When the server application starts and it can successfully find an instance of the engine in the file system the server will:

1.  Runs `flogo build` from inside the `<engine>` directory (by default `dist/server/local/engines/flogo-web`)
2.  Starts the compiled binary under `<engine>/bin-test` directory. It sets the following variables `FLOGO_LOG_LEVEL='DEBUG'`
    `TESTER_ENABLED='true'` and also sets `TESTER_PORT` and `TESTER_SR_SERVER` based on the current app configuration. Then
    with that configuration issues the command:

```bash
flogo build
```

1.  Runs `flogo list -json` and based on the activities and triggers listed by that command it find their corresponding descriptors
    under `<engine>/src/vendor/<engine>` and loads them into the UI database.

### When a user wants to install a new contribution

1.  If the contribution is already installed the server runs `flogo uninstall <ref>` where "ref" was provided by the user
2.  Runs `flogo install <ref>`
3.  Runs `flogo build` from inside the `<engine>` directory
4.  Kill previous engine process running instance, and starts the new generated binary as explained in the previous section.

### When a user wants to download the binary for an app

1. It serializes the application that the user wants to build to a [Flogo Model JSON](https://github.com/project-flogo/core/blob/master/docs/model.md) and outputs it to a `flogo.json` file in a temporal location. The serialized format is the one expected by the Flogo Engine.
2. A secondary engine project is created using the Flogo app that was exported in the previous step:

```bash
flogo create -f <path-to-temp-flogo.json> --cv <same as create step> engine-build
```

3.  From the generated directory runs: `flogo build -e -o`. Those options will embed the app.json and remove any contributions
    that are not being referenced by the app to make the binary as lightweight as possible.
4.  For the previous step, if a target OS and architecture were defined then the environment variables `GOOS` and `GOARCH` will be
    passed to the `flogo build` command to build for the specified target. `flogo build` outputs the generated binary in a different location depending on the target operating system (`GOOS`) and architecture (`GOARCH`)
    specified by the user. If no target specified then the binary is located under `<engine>/bin/<binary>` where binary has the same name as the engine.
    If a target was specified then the binary can be found at `<engine>/bin/<GOOS>_<GOARCH>/<binary>`. Additionally if `GOOS='windows'` the binary
    will have an `.exe` extension.
