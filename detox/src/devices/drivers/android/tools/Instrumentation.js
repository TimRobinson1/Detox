const { interruptProcess } = require('../../../../utils/exec');
const { prepareInstrumentationArgs } = require('./instrumentationArgs');

class Instrumentation {
  constructor(adb, logger, userTerminationFn, userLogListenFn) {
    this.adb = adb;
    this.logger = logger;
    this.userTerminationFn = userTerminationFn;
    this.userLogListenFn = userLogListenFn;
    this.instrumentationProcess = null;
    this._onTerminated = this._onTerminated.bind(this);
  }

  async launch(deviceId, bundleId, userLaunchArgs) {
    const spawnArgs = this._getSpawnArgs(userLaunchArgs);

    const testRunner = await this.adb.getInstrumentationRunner(deviceId, bundleId);

    this.instrumentationProcess = this.adb.spawnInstrumentation(deviceId, spawnArgs, testRunner);
    this.instrumentationProcess.childProcess.stdout.setEncoding('utf8');
    this.instrumentationProcess.childProcess.stdout.on('data', this.userLogListenFn);
    this.instrumentationProcess.childProcess.on('close', this._onTerminated);
  }

  /*async*/ terminate() {
    return this._onTerminated();
  }

  isRunning() {
    return !!this.instrumentationProcess;
  }

  _getSpawnArgs(userLaunchArgs) {
    const launchArgs = prepareInstrumentationArgs(userLaunchArgs);
    const additionalLaunchArgs = prepareInstrumentationArgs({ debug: false });
    this._warnReservedArgsUsedIfNeeded(launchArgs);

    return [...launchArgs.args, ...additionalLaunchArgs.args];
  }

  async _onTerminated() {
    if (this.instrumentationProcess) {
      await interruptProcess(this.instrumentationProcess);
      this.instrumentationProcess = null;
      await this.userTerminationFn();
    }
  }

  _warnReservedArgsUsedIfNeeded(preparedArgs) {
    if (preparedArgs.usedReservedArgs.length) {
      this.logger.warn([`Arguments [${preparedArgs.usedReservedArgs}] were passed in as launchArgs to device.launchApp() `,
        'but are reserved to Android\'s test-instrumentation and will not be passed into the app. ',
        'Ignore this message if this is what you meant to do. Refer to ',
        'https://developer.android.com/studio/test/command-line#AMOptionsSyntax for ',
        'further details.'].join(''));
    }
  }
}

module.exports = Instrumentation;
