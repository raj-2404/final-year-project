import { Command } from 'commander';
import fs from 'fs';
import { AgentServer } from '../server/WebSocketServer.js';
import { ConfigManager } from '../config/ConfigManager.js';
import { ShellResolver } from '../platform/ShellResolver.js';
import { Paths } from '../platform/Paths.js';
import { AuthManager } from '../server/AuthManager.js';

const packageJson = JSON.parse(
  fs.readFileSync(new URL('../../package.json', import.meta.url), 'utf8')
);

export function createCli(): Command {
  const program = new Command();

  program
    .name('codex-agent')
    .description('Secure local CLI terminal agent for CodeX collaborative code editor')
    .version(packageJson.version);

  // START command (also default if no command specified)
  program
    .command('start', { isDefault: true })
    .description('Start the local CodeX terminal agent')
    .option('-H, --host <host>', 'Host interface to bind (default: 127.0.0.1)')
    .option('-p, --port <port>', 'Port to listen on (default: 7777)', (val) => parseInt(val, 10))
    .action(async (options) => {
      const configManager = new ConfigManager();
      const host = options.host || configManager.getHost();
      const port = options.port || configManager.getPort();

      // Check if already running
      const pidFile = Paths.getPidFile();
      if (fs.existsSync(pidFile)) {
        try {
          const pid = parseInt(fs.readFileSync(pidFile, 'utf8').trim(), 10);
          if (pid && isProcessRunning(pid)) {
            console.log(`\x1b[33mCodeX Agent is already running with PID ${pid}.\x1b[0m`);
            console.log(`Run 'codex-agent status' or 'codex-agent stop' to manage it.`);
            return;
          }
        } catch {
          // stale pid file, continue
        }
      }

      const authManager = new AuthManager(configManager.getConfig().auth.tokenFile);
      const server = new AgentServer({
        host,
        port,
        authManager,
        disconnectGracePeriod: configManager.getDisconnectGracePeriod(),
      });

      const defaultShell = ShellResolver.resolveDefaultShell();

      try {
        await server.start();

        console.log('');
        console.log('\x1b[1;36mCodeX Local Agent\x1b[0m');
        console.log('\x1b[90m────────────────────────────\x1b[0m');
        console.log('');
        console.log(`Status: \x1b[32mrunning\x1b[0m`);
        console.log(`Host:   ${host}`);
        console.log(`Port:   ${port}`);
        console.log('');
        console.log(`Shell:  ${defaultShell.executable}`);
        console.log('');
        console.log('Authentication:');
        console.log(`Token stored securely in local configuration`);
        console.log(`Config: ${Paths.getConfigFile()}`);
        console.log('');
        console.log('\x1b[35mWaiting for CodeX...\x1b[0m');
        console.log('');

        const shutdown = async () => {
          console.log('\nShutting down CodeX Agent...');
          await server.stop();
          process.exit(0);
        };

        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);
      } catch (err: any) {
        console.error(`\x1b[31mFailed to start CodeX Agent:\x1b[0m`, err.message || err);
        process.exit(1);
      }
    });

  // STATUS command
  program
    .command('status')
    .description('Check the status of the local CodeX terminal agent')
    .action(() => {
      const pidFile = Paths.getPidFile();
      const configManager = new ConfigManager();
      const config = configManager.getConfig();

      if (fs.existsSync(pidFile)) {
        try {
          const pid = parseInt(fs.readFileSync(pidFile, 'utf8').trim(), 10);
          if (pid && isProcessRunning(pid)) {
            console.log('\x1b[1;36mCodeX Local Agent Status\x1b[0m');
            console.log('\x1b[90m────────────────────────────\x1b[0m');
            console.log(`Status: \x1b[32mRUNNING\x1b[0m (PID: ${pid})`);
            console.log(`Host:   ${config.host}`);
            console.log(`Port:   ${config.port}`);
            console.log(`Config: ${Paths.getConfigFile()}`);
            console.log(`Token:  ${Paths.getTokenFile()}`);
            return;
          }
        } catch {}
      }

      console.log('\x1b[1;36mCodeX Local Agent Status\x1b[0m');
      console.log('\x1b[90m────────────────────────────\x1b[0m');
      console.log(`Status: \x1b[31mSTOPPED\x1b[0m`);
      console.log(`Config: ${Paths.getConfigFile()}`);
    });

  // STOP command
  program
    .command('stop')
    .description('Stop a running background CodeX terminal agent')
    .action(() => {
      const pidFile = Paths.getPidFile();
      if (!fs.existsSync(pidFile)) {
        console.log('No running CodeX Agent found (PID file does not exist).');
        return;
      }

      try {
        const pid = parseInt(fs.readFileSync(pidFile, 'utf8').trim(), 10);
        if (!pid || !isProcessRunning(pid)) {
          console.log(`Process with PID ${pid} is not running. Cleaning up PID file.`);
          fs.unlinkSync(pidFile);
          return;
        }

        console.log(`Stopping CodeX Agent (PID ${pid})...`);
        process.kill(pid, 'SIGTERM');

        // Check if stopped
        let attempts = 0;
        const interval = setInterval(() => {
          attempts++;
          if (!isProcessRunning(pid) || attempts > 20) {
            clearInterval(interval);
            if (fs.existsSync(pidFile)) {
              try {
                fs.unlinkSync(pidFile);
              } catch {}
            }
            if (!isProcessRunning(pid)) {
              console.log('\x1b[32mCodeX Agent stopped successfully.\x1b[0m');
            } else {
              console.log('\x1b[33mForce stopping process...\x1b[0m');
              try {
                process.kill(pid, 'SIGKILL');
              } catch {}
            }
          }
        }, 100);
      } catch (err: any) {
        console.error('Error stopping agent:', err.message);
      }
    });

  // CONFIG command
  program
    .command('config')
    .description('View or edit agent configuration')
    .option('--show-token', 'Print the active authentication token (local terminal only)')
    .option('--regenerate-token', 'Generate a new secure authentication token')
    .option('--set-port <port>', 'Set the default port', (val) => parseInt(val, 10))
    .option('--set-host <host>', 'Set the default host')
    .action((options) => {
      const configManager = new ConfigManager();
      const authManager = new AuthManager(configManager.getConfig().auth.tokenFile);

      if (options.regenerateToken) {
        const newToken = authManager.regenerateToken();
        console.log('\x1b[32mAuthentication token regenerated successfully.\x1b[0m');
        console.log(`Saved to: ${authManager.getTokenFilePath()}`);
        return;
      }

      if (options.setPort) {
        configManager.updateConfig({ port: options.setPort });
        console.log(`\x1b[32mDefault port updated to ${options.setPort}\x1b[0m`);
      }

      if (options.setHost) {
        configManager.updateConfig({ host: options.setHost });
        console.log(`\x1b[32mDefault host updated to ${options.setHost}\x1b[0m`);
      }

      console.log('\x1b[1;36mCodeX Agent Configuration\x1b[0m');
      console.log('\x1b[90m────────────────────────────\x1b[0m');
      console.log(`Config File: ${Paths.getConfigFile()}`);
      console.log(`Token File:  ${Paths.getTokenFile()}`);
      console.log(JSON.stringify(configManager.getConfig(), null, 2));

      if (options.showToken) {
        console.log('');
        console.log('\x1b[33mLocal Authentication Token:\x1b[0m');
        console.log(authManager.getToken());
      }
    });

  return program;
}

function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err: any) {
    return err.code === 'EPERM';
  }
}

export function runCli(argv: string[] = process.argv): void {
  createCli().parse(argv);
}

// Direct invocation only if entrypoint is cli/index itself
const isDirectCli = process.argv[1] && (
  process.argv[1].endsWith('cli/index.ts') || process.argv[1].endsWith('cli/index.js')
);
if (isDirectCli) {
  runCli();
}
