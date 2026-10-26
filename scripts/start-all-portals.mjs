import { spawn } from 'child_process';
import net from 'net';

function isPortFree(port) {
  return new Promise((resolve) => {
    const tester = net.createServer()
      .once('error', () => resolve(false))
      .once('listening', () => {
        tester.close();
        resolve(true);
      })
      .listen(port);
  });
}

async function getBasePort() {
  if (process.env.BASE_PORT) return parseInt(process.env.BASE_PORT, 10);
  const p3000Free = await isPortFree(3000);
  const p3001Free = await isPortFree(3001);
  const p3002Free = await isPortFree(3002);
  if (p3000Free && p3001Free && p3002Free) {
    return 3000;
  }
  return 4000; // Safe alternative range when 3000-3003 are occupied by other local apps
}

async function start() {
  const basePort = await getBasePort();

  const portals = [
    { name: 'Admin HQ', port: basePort, color: '\x1b[35m' },
    { name: 'Judge Portal', port: basePort + 1, color: '\x1b[33m' },
    { name: 'Team Portal', port: basePort + 2, color: '\x1b[36m' },
    { name: 'Ops Desk', port: basePort + 3, color: '\x1b[32m' },
  ];

  const reset = '\x1b[0m';
  const bold = '\x1b[1m';

  console.log(`\n${bold}====================================================${reset}`);
  console.log(`${bold}  EVENTRA MULTI-PORT PORTAL SYSTEM                  ${reset}`);
  console.log(`${bold}====================================================${reset}`);
  portals.forEach((p) => {
    console.log(`  ${p.color}● ${p.name.padEnd(14)}${reset} → ${bold}http://localhost:${p.port}${reset}`);
  });
  console.log(`${bold}====================================================${reset}\n`);

  const isWindows = process.platform === 'win32';
  const npxCmd = isWindows ? 'npx.cmd' : 'npx';
  const children = [];

  function cleanUp() {
    console.log(`\n${bold}Shutting down all portal servers...${reset}`);
    for (const child of children) {
      if (child && !child.killed) {
        if (isWindows) {
          try {
            spawn('taskkill', ['/pid', child.pid.toString(), '/f', '/t'], { stdio: 'ignore' });
          } catch {
            child.kill('SIGTERM');
          }
        } else {
          child.kill('SIGTERM');
        }
      }
    }
    process.exit(0);
  }

  process.on('SIGINT', cleanUp);
  process.on('SIGTERM', cleanUp);

  for (const portal of portals) {
    const env = { ...process.env, PORT: portal.port.toString() };
    
    const child = spawn(npxCmd, ['next', 'dev', '-p', portal.port.toString()], {
      env,
      shell: isWindows,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    children.push(child);

    child.stdout.on('data', (data) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        if (line.trim()) {
          console.log(`${portal.color}[${portal.name} :${portal.port}]${reset} ${line}`);
        }
      }
    });

    child.stderr.on('data', (data) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        if (line.trim()) {
          console.error(`${portal.color}[${portal.name} :${portal.port}]${reset} ${line}`);
        }
      }
    });

    child.on('exit', (code) => {
      if (code !== null && code !== 0) {
        console.log(`${portal.color}[${portal.name} :${portal.port}]${reset} exited with code ${code}`);
      }
    });

    // Stagger start by 1.2s to prevent simultaneous tsconfig write locks
    await new Promise((r) => setTimeout(r, 1200));
  }
}

start();
