/**
 * Offline Client Entry Point
 *
 * This entry point is specifically for offline HTML bundle mode.
 * It bootstraps WebContainers to run the Remix server in the browser
 * and then loads the Bolt.diy UI.
 */

import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

interface BootStatus {
  status: 'initializing' | 'booting' | 'mounting' | 'starting' | 'ready' | 'error';
  message: string;
  progress: number;
  error?: string;
}

function OfflineBootLoader() {
  const [bootStatus, setBootStatus] = useState<BootStatus>({
    status: 'initializing',
    message: '🚀 Initializing WebContainers...',
    progress: 0,
  });

  const [webcontainerReady, setWebcontainerReady] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function bootWebContainer() {
      try {
        // Check WebContainers support
        if (typeof window === 'undefined' || !('WebContainer' in window)) {
          throw new Error(
            'WebContainers API not supported in this browser. ' +
            'Please use Chrome, Edge, or Firefox (version 121+).'
          );
        }

        if (!isMounted) return;
        setBootStatus({
          status: 'booting',
          message: '⚙️  Booting WebContainers runtime...',
          progress: 25,
        });

        // Boot WebContainers instance
        const { WebContainer } = window;
        const webcontainer = await WebContainer.boot({
          coep: 'credentialless',
          workdirName: 'bolt-offline',
        });

        if (!isMounted) return;
        setBootStatus({
          status: 'mounting',
          message: '📦 Mounting project files...',
          progress: 50,
        });

        // Mount necessary files (in a real implementation, these would be pre-packaged)
        // For now, we'll use a placeholder setup
        await webcontainer.mount({
          'app': { directory: {} },
          'public': { directory: {} },
          'package.json': {
            file: {
              contents: JSON.stringify({
                name: 'bolt-offline',
                type: 'module',
                scripts: {
                  start: 'node server.mjs',
                  dev: 'node server.mjs',
                },
              }),
            },
          },
          'server.mjs': {
            file: {
              contents: `
// Simple HTTP server that proxies to LM Studio
import http from 'http';

const LM_STUDIO_URL = 'http://127.0.0.1:1234';

const server = http.createServer(async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Health check endpoint
  if (req.url === '/' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', message: 'Bolt.diy Offline Server' }));
    return;
  }

  // Forward API requests to LM Studio
  if (req.url?.startsWith('/api/') || req.url?.startsWith('/v1/')) {
    try {
      const targetUrl = LM_STUDIO_URL + req.url;
      const proxyReq = http.request(targetUrl, {
        method: req.method,
        headers: req.headers,
      }, (proxyRes) => {
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res);
      });

      req.pipe(proxyReq);
      proxyReq.on('error', (err) => {
        console.error('LM Studio request failed:', err);
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'LM Studio not reachable',
          details: 'Make sure LM Studio is running on http://127.0.0.1:1234',
        }));
      });
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: String(error) }));
    }
    return;
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(5173, () => {
  console.log('Bolt.diy server running on http://localhost:5173');
  console.log('LM Studio proxy configured for http://127.0.0.1:1234');
});
              `,
            },
          },
        });

        if (!isMounted) return;
        setBootStatus({
          status: 'starting',
          message: '🚀 Starting offline server...',
          progress: 75,
        });

        // Start the server
        const process = await webcontainer.spawn('node', ['server.mjs']);

        // Monitor output
        process.output.pipeTo(
          new WritableStream({
            write(chunk) {
              const output = chunk.toString();
              console.log('[WebContainer]', output);
            },
          })
        );

        // Give server time to start
        await new Promise((resolve) => setTimeout(resolve, 2000));

        if (!isMounted) return;
        setBootStatus({
          status: 'ready',
          message: '✅ Offline server ready!',
          progress: 100,
        });

        setWebcontainerReady(true);
      } catch (error) {
        console.error('Boot error:', error);
        if (isMounted) {
          setBootStatus({
            status: 'error',
            message: '❌ Failed to initialize',
            progress: 0,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    bootWebContainer();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div
      style={{
        fontFamily: 'system-ui, -apple-system, sans-serif',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        style={{
          background: 'white',
          borderRadius: '12px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
          padding: '40px',
          maxWidth: '500px',
          width: '100%',
          textAlign: 'center',
        }}
      >
        <h1 style={{ color: '#667eea', marginBottom: '10px' }}>🚀 Bolt.diy</h1>
        <p style={{ color: '#666', marginBottom: '30px', fontSize: '14px' }}>
          Offline AI Development with LM Studio
        </p>

        <div
          style={{
            width: '50px',
            height: '50px',
            margin: '30px auto',
            border: '4px solid #f3f3f3',
            borderTop: '4px solid #667eea',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }}
        />

        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>

        <div style={{ background: '#f5f5f5', padding: '15px', borderRadius: '8px', margin: '20px 0' }}>
          <div style={{ color: '#555', fontSize: '13px', fontFamily: 'monospace', marginBottom: '10px' }}>
            {bootStatus.message}
          </div>
          <div
            style={{
              width: '100%',
              height: '8px',
              background: '#eee',
              borderRadius: '4px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${bootStatus.progress}%`,
                background: '#667eea',
                transition: 'width 0.3s ease',
              }}
            />
          </div>
        </div>

        {bootStatus.error && (
          <div style={{ background: '#fee', border: '1px solid #fcc', borderRadius: '8px', padding: '15px', marginTop: '20px', color: '#c33', fontSize: '13px' }}>
            <strong>Error:</strong>
            <div style={{ marginTop: '8px', textAlign: 'left' }}>{bootStatus.error}</div>
          </div>
        )}

        <div style={{ background: '#e8f4f8', borderLeft: '4px solid #667eea', padding: '15px', marginTop: '20px', borderRadius: '4px', fontSize: '12px', color: '#333', textAlign: 'left' }}>
          <strong style={{ color: '#667eea' }}>💡 Tip:</strong> Make sure LM Studio is running on your computer at{' '}
          <code style={{ background: '#fff', padding: '2px 6px', borderRadius: '3px' }}>http://127.0.0.1:1234</code>
        </div>
      </div>
    </div>
  );
}

// Mount the app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const root = createRoot(document.getElementById('root')!);
  root.render(<OfflineBootLoader />);
});
