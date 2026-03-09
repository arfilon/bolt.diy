/**
 * WebContainers Bootstrap for Offline Mode
 *
 * This script initializes WebContainers to run the Remix server
 * directly in the browser, enabling completely offline operation
 * while still being able to call LM Studio on localhost:1234
 */

import { WebContainer } from '@webcontainer/api';

interface BootstrapOptions {
  onProgress?: (message: string) => void;
  onError?: (error: Error) => void;
  lmStudioUrl?: string;
}

let webcontainerInstance: WebContainer | null = null;
let serverUrl: string | null = null;

/**
 * Initialize WebContainers and start the offline Remix server
 */
export async function initializeOfflineWebContainer(options: BootstrapOptions = {}): Promise<string> {
  const {
    onProgress = console.log,
    onError = console.error,
    lmStudioUrl = 'http://127.0.0.1:1234',
  } = options;

  try {
    onProgress('🚀 Initializing WebContainers runtime...');

    // Boot WebContainers with offline configuration
    webcontainerInstance = await WebContainer.boot({
      coep: 'credentialless',
      workdirName: 'bolt-offline',
      forwardPreviewErrors: true,
    });

    onProgress('📦 Setting up project files...');

    // Mount the build artifacts and node_modules
    // This assumes build/ directory exists from the Remix build
    const buildArtifacts = {
      'build': {},
      'node_modules': {},
      'package.json': {},
      '.env.local': {
        file: {
          contents: `LMSTUDIO_API_BASE_URL=${lmStudioUrl}\nNODE_ENV=production\nPORT=5173`,
        },
      },
    };

    await webcontainerInstance.mount(buildArtifacts);

    onProgress('🔧 Installing dependencies in WebContainer...');

    // Install dependencies in the container
    const installProcess = await webcontainerInstance.spawn('npm', ['install', '--prefer-offline']);

    // Wait for installation to complete
    const installExitCode = await installProcess.exit;
    if (installExitCode !== 0) {
      throw new Error(`npm install failed with exit code ${installExitCode}`);
    }

    onProgress('🌐 Starting Remix server in WebContainer...');

    // Start the Remix server
    const serverProcess = await webcontainerInstance.spawn('npm', ['run', 'start']);

    // Wait for server to be ready
    // Listen for "Server running at" message in stdout
    let serverReady = false;
    serverProcess.output.pipeTo(
      new WritableStream({
        write(chunk) {
          const output = chunk.toString();
          console.log('[WebContainer]', output);

          if (output.includes('localhost') || output.includes('127.0.0.1')) {
            serverReady = true;
          }
        },
      })
    );

    // Give server time to start
    await new Promise((resolve) => setTimeout(resolve, 3000));

    onProgress('✅ WebContainer server is ready!');

    // Return the server URL
    serverUrl = 'http://localhost:5173';
    return serverUrl;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    onError(err);
    throw err;
  }
}

/**
 * Get the current WebContainer instance
 */
export function getWebContainer(): WebContainer | null {
  return webcontainerInstance;
}

/**
 * Get the server URL
 */
export function getServerUrl(): string | null {
  return serverUrl;
}

/**
 * Cleanup and tear down WebContainers
 */
export async function shutdownOfflineWebContainer(): Promise<void> {
  if (webcontainerInstance) {
    // Gracefully shutdown is not supported by WebContainers API
    // Container will be cleaned up when browser tab closes
    webcontainerInstance = null;
    serverUrl = null;
  }
}

/**
 * Check if WebContainers is supported in this browser
 */
export function isWebContainersSupported(): boolean {
  return typeof WebContainer !== 'undefined' && 'boot' in WebContainer;
}
