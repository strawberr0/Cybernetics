import { useEffect, useMemo, useState } from 'react'
import {
  Copy, Terminal, CheckCircle, AlertCircle, BookOpen,
  ChevronDown, Key, Wrench, ExternalLink,
} from 'lucide-react'

interface CatalogAdapter {
  name: string
  description: string
  source: string
  group?: string
}

interface ClientConfig {
  id: string
  label: string
  filename: string
  language: 'json' | 'toml'
  notes: string
  config: string
}

const baseEnv = `        "BROKER_API_KEY": "your-broker-key",
        "POSTGRES_DSN": "postgresql+asyncpg://user:pass@localhost/arqon",
        "GEMINI_API_KEY": "your-gemini-key"`

const jsonStdio = (envBlock: string) => `{
  "mcpServers": {
    "arqon": {
      "command": "arqon-mcp",
      "args": [],
      "env": {
${envBlock}
      }
    }
  }
}`

const clients: ClientConfig[] = [
  {
    id: 'antigravity',
    label: 'Antigravity',
    filename: 'VS Code settings.json',
    language: 'json',
    notes: 'Google Antigravity inherits VS Code MCP wiring under "mcp.servers".',
    config: `{
  "mcp.servers": {
    "arqon": {
      "command": "arqon-mcp",
      "args": [],
      "env": {
${baseEnv}
      }
    }
  }
}`,
  },
  {
    id: 'claude',
    label: 'Claude',
    filename: 'Desktop: ~/Library/Application Support/Claude/claude_desktop_config.json  •  Code: ~/.claude.json (or `claude mcp add`)',
    language: 'json',
    notes: 'Same JSON schema across Claude Desktop and Claude Code. Desktop: Linux ~/.config/Claude/, Windows %APPDATA%\\Claude\\. Code: run `claude mcp add arqon arqon-mcp` or paste into ~/.claude.json.',
    config: jsonStdio(baseEnv),
  },
  {
    id: 'codex',
    label: 'Codex CLI',
    filename: '~/.codex/config.toml',
    language: 'toml',
    notes: 'OpenAI Codex CLI uses TOML, not JSON.',
    config: `[mcp_servers.arqon]
command = "arqon-mcp"
args = []

[mcp_servers.arqon.env]
BROKER_API_KEY  = "your-broker-key"
POSTGRES_DSN    = "postgresql+asyncpg://user:pass@localhost/arqon"
GEMINI_API_KEY  = "your-gemini-key"`,
  },
  {
    id: 'cursor',
    label: 'Cursor',
    filename: '.cursor/mcp.json  (project)  •  ~/.cursor/mcp.json  (global)',
    language: 'json',
    notes: 'Cursor reloads MCP servers on save. Restart not required.',
    config: jsonStdio(baseEnv),
  },
  {
    id: 'devin',
    label: 'Devin',
    filename: 'Devin dashboard → Settings → MCP',
    language: 'json',
    notes: 'Devin pulls config from the team dashboard; paste the JSON into the MCP server field.',
    config: jsonStdio(baseEnv),
  },
  {
    id: 'vims',
    label: 'Vims',
    filename: 'vims_mcp_add_server  (MCP tool)',
    language: 'json',
    notes: 'Vims registers MCP servers at runtime via its own tool API. Use the JSON payload below or call vims_mcp_add_server directly.',
    config: `{
  "id": "arqon",
  "name": "Arqon",
  "url": "https://mcp.arqon.ai",
  "description": "Composable MCP meta-broker"
}`,
  },
]

export function MCPPage() {
  const [copied, setCopied] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [adapters, setAdapters] = useState<CatalogAdapter[]>([])
  const [adapterError, setAdapterError] = useState<string | null>(null)
  const [activeClient, setActiveClient] = useState<string>(clients[0].id)
  const [adapterFilter, setAdapterFilter] = useState('')

  useEffect(() => {
    fetch('/api/templates')
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then((data: { adapters: CatalogAdapter[] }) => setAdapters(data.adapters || []))
      .catch(err => setAdapterError(String(err)))
  }, [])

  const activeConfig = useMemo(
    () => clients.find(c => c.id === activeClient) || clients[0],
    [activeClient],
  )

  const filteredAdapters = useMemo(() => {
    const q = adapterFilter.trim().toLowerCase()
    if (!q) return adapters
    return adapters.filter(a =>
      a.name.toLowerCase().includes(q) ||
      a.description.toLowerCase().includes(q) ||
      (a.group || '').toLowerCase().includes(q),
    )
  }, [adapters, adapterFilter])

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(null), 1800)
  }

  function toggleExpand(name: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  return (
    <div className="h-[calc(100vh-56px)] overflow-y-auto bg-gray-50 dark:bg-[#0a0a0a]">
      <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid gap-6 xl:grid-cols-[1fr_320px]">

          {/* Intro */}
          <section className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] p-6">
            <div className="flex items-start gap-4">
              <BookOpen className="mt-1 h-8 w-8 shrink-0 text-cyan-500" />
              <div className="min-w-0">
                <h2 className="text-xl font-semibold sm:text-2xl text-gray-900 dark:text-white">Arqon MCP Server</h2>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 sm:text-base">Connect your AI agents to the Arqon meta-broker at <a href="https://mcp.arqon.ai" target="_blank" rel="noopener noreferrer" className="text-cyan-500 hover:text-cyan-600 underline">mcp.arqon.ai</a>.</p>
              </div>
            </div>
            <div className="my-6 border-t border-gray-100 dark:border-gray-800" />
            <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">
              The Arqon MCP server is a single stdio-based MCP peer that aggregates every configured adapter into one unified tool namespace.
              Instead of wiring 50+ MCP servers, you wire <strong className="text-gray-900 dark:text-white">one</strong>. Your client sees all tools from enabled adapters as a flat list.
            </p>
            <div className="mt-5 overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-[#0d1117] p-4 font-mono text-xs text-[#e6edf3] sm:text-sm">
              <div className="flex min-w-max items-center gap-3">
                <span className="text-[#58ff3e]">MCP client</span>
                <span className="text-[#7f8ba5]">— stdio —</span>
                <span className="text-[#91b4ff]">arqon-mcp</span>
                <span className="text-[#7f8ba5]">— tools —</span>
                <span className="text-[#ffd43b]">datadog · github · slack · postgres · …</span>
              </div>
            </div>
          </section>

          {/* Status */}
          <aside className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] p-5">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">System Status</h3>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {[
                ['Adapters', adapterError ? '!' : `${adapters.length}`],
                ['Protocol', 'MCP'],
                ['Transport', 'stdio'],
                ['Source', 'live'],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-3">
                  <div className="text-[10px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">{label}</div>
                  <div className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">{value}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 border-t border-gray-100 dark:border-gray-800 pt-4 text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              Adapters appear in client tool lists only when their required env vars are present.
            </div>
            {adapterError && (
              <div className="mt-3 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-3 text-xs text-amber-700 dark:text-amber-400">
                Could not reach /api/templates: {adapterError}
              </div>
            )}
          </aside>

          {/* Quick start */}
          <section id="quick-start" className="space-y-5 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] p-6 xl:col-span-2">
            <h3 className="flex items-center gap-3 text-lg font-semibold sm:text-xl text-gray-900 dark:text-white">
              <Terminal className="w-5 h-5 text-cyan-500" />
              Quick Start
            </h3>

            <div className="grid gap-4 lg:grid-cols-[0.6fr_1fr]">
              <div className="space-y-3">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">1. Install the broker</p>
                <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between px-4 py-2 bg-gray-100 dark:bg-[#1f2937] border-b border-gray-200 dark:border-gray-700">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">bash</span>
                    <button onClick={() => copy('pip install arqon-mcp', 'pip')} title="Copy install command" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                      {copied === 'pip' ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  <pre className="bg-[#0d1117] text-[#e6edf3] p-4 text-xs">pip install arqon-mcp</pre>
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500">Requires Python 3.11+. The wheel ships the broker binary on PATH.</p>
              </div>

              <div className="space-y-3 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">2. Wire it into your client</p>
                  <span className="text-xs text-gray-400 dark:text-gray-500">{clients.length} clients supported</span>
                </div>

                <div className="flex flex-wrap gap-1">
                  {clients.map(c => (
                    <button
                      key={c.id}
                      onClick={() => setActiveClient(c.id)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                        activeClient === c.id
                          ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                          : 'border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>

                <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between px-4 py-2 bg-gray-100 dark:bg-[#1f2937] border-b border-gray-200 dark:border-gray-700">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 truncate">{activeConfig.filename}</span>
                    <button onClick={() => copy(activeConfig.config, activeConfig.id)} title="Copy config" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex-shrink-0 ml-2">
                      {copied === activeConfig.id ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  <pre className="bg-[#0d1117] text-[#e6edf3] p-4 text-xs overflow-auto max-h-96">{activeConfig.config}</pre>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">{activeConfig.notes}</p>
              </div>
            </div>
          </section>

          {/* Adapter catalog */}
          <section id="adapter-catalog" className="space-y-4 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] p-6 xl:col-span-2">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="min-w-0">
                <h3 className="flex items-center gap-3 text-lg font-semibold sm:text-xl text-gray-900 dark:text-white">
                  <Wrench className="w-5 h-5 text-cyan-500" />
                  Adapter Catalog
                </h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Live from <code className="font-mono text-cyan-600 dark:text-cyan-400">/api/templates</code>. Each adapter links to its official upstream MCP server.
                </p>
              </div>
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">
                {filteredAdapters.length} / {adapters.length} adapters
              </div>
            </div>

            <input
              type="text"
              placeholder="Filter adapters…"
              value={adapterFilter}
              onChange={e => setAdapterFilter(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#0a0a0a] text-gray-900 dark:text-white focus:outline-none focus:border-cyan-400"
            />

            <div className="grid gap-2">
              {filteredAdapters.map(a => (
                <div key={a.name} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 overflow-hidden">
                  <button
                    onClick={() => toggleExpand(a.name)}
                    className="grid w-full grid-cols-[auto_minmax(120px,0.35fr)_1fr_auto] items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors sm:px-4 sm:py-3"
                  >
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${expanded.has(a.name) ? 'rotate-180' : ''}`} />
                    <span className="text-sm font-medium capitalize text-gray-900 dark:text-white truncate sm:text-base">{a.name}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 truncate sm:text-sm">{a.description}</span>
                    {a.group && (
                      <span className="rounded-full bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400 px-2 py-0.5 text-[10px] font-medium whitespace-nowrap">{a.group}</span>
                    )}
                  </button>
                  {expanded.has(a.name) && (
                    <div className="space-y-3 border-t border-gray-200 dark:border-gray-700 p-3 sm:p-4 bg-white dark:bg-[#1a1a1a]">
                      <a
                        href={a.source}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-lg bg-cyan-50 dark:bg-cyan-900/20 px-3 py-2 text-xs font-medium text-cyan-700 dark:text-cyan-400 hover:bg-cyan-100 dark:hover:bg-cyan-900/30 transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> Official upstream MCP
                      </a>
                      <p className="font-mono text-xs break-all text-gray-400 dark:text-gray-500">{a.source}</p>
                    </div>
                  )}
                </div>
              ))}
              {adapters.length === 0 && !adapterError && (
                <p className="text-sm text-gray-400 dark:text-gray-500">Loading adapters…</p>
              )}
              {filteredAdapters.length === 0 && adapters.length > 0 && (
                <p className="text-sm text-gray-400 dark:text-gray-500">No adapters match "{adapterFilter}".</p>
              )}
            </div>
          </section>

          {/* Required env vars */}
          <section className="space-y-4 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] p-6 xl:col-span-2">
            <h3 className="flex items-center gap-3 text-lg font-semibold sm:text-xl text-gray-900 dark:text-white">
              <Key className="w-5 h-5 text-cyan-500" />
              Broker env vars
            </h3>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Always required</h4>
                <div className="grid gap-1.5">
                  {[
                    ['BROKER_API_KEY', 'Shared secret between MCP client and broker'],
                    ['POSTGRES_DSN', 'Postgres URL for state/memory'],
                    ['GEMINI_API_KEY', 'Google AI key for compose/chat endpoints'],
                  ].map(([k, desc]) => (
                    <div key={k} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2">
                      <div className="font-mono text-xs font-medium text-cyan-600 dark:text-cyan-400">{k}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{desc}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Per-adapter (selected)</h4>
                <div className="grid gap-1.5">
                  {[
                    'DYNATRACE_API_TOKEN', 'DATADOG_API_KEY', 'GITHUB_TOKEN',
                    'SLACK_BOT_TOKEN', 'STRIPE_API_KEY', 'NOTION_TOKEN',
                    'AWS_ACCESS_KEY_ID', 'GOOGLE_SERVICE_ACCOUNT_KEY',
                  ].map(k => (
                    <div key={k} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2">
                      <div className="font-mono text-xs font-medium text-cyan-600 dark:text-cyan-400">{k}</div>
                    </div>
                  ))}
                  <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                    Full list under each adapter in the Composer view → Keys tab.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Troubleshooting */}
          <section className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] p-6 xl:col-span-2">
            <h3 className="mb-4 flex items-center gap-3 text-lg font-semibold sm:text-xl text-gray-900 dark:text-white">
              <AlertCircle className="w-5 h-5 text-cyan-500" />
              Troubleshooting
            </h3>
            <div className="grid gap-2 text-sm md:grid-cols-2">
              <p className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-3 text-gray-600 dark:text-gray-400"><strong className="text-gray-900 dark:text-white">tools/list is empty?</strong> Check that the adapter env vars are set in the client config — adapters only register when their secrets are present.</p>
              <p className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-3 text-gray-600 dark:text-gray-400"><strong className="text-gray-900 dark:text-white">Connection refused?</strong> Ensure <code className="font-mono text-cyan-600 dark:text-cyan-400">arqon-mcp</code> is on PATH and reachable by the client process.</p>
              <p className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-3 text-gray-600 dark:text-gray-400"><strong className="text-gray-900 dark:text-white">401 from broker?</strong> Verify <code className="font-mono text-cyan-600 dark:text-cyan-400">BROKER_API_KEY</code> matches the broker's expected value.</p>
              <p className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-3 text-gray-600 dark:text-gray-400"><strong className="text-gray-900 dark:text-white">Adapter missing?</strong> Open <code className="font-mono text-cyan-600 dark:text-cyan-400">/api/templates</code> — if the catalog has it but the client doesn't, the client may need a restart after editing config.</p>
            </div>
          </section>

        </div>
      </div>
    </div>
  )
}
