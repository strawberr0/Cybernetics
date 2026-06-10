import { useEffect, useMemo, useState } from 'react'
import { Server, Copy, Terminal, CheckCircle, AlertCircle, BookOpen, ChevronDown, Key, Wrench, ExternalLink } from 'lucide-react'

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

// ── MCP client config snippets ──────────────────────────────────────
// The Cybernetics broker is a single stdio MCP peer. Each client wires it
// in slightly differently — we render a tab per client with copy-pasteable
// boilerplate.

const baseEnv = `        "BROKER_API_KEY": "your-broker-key",
        "POSTGRES_DSN": "postgresql+asyncpg://user:pass@localhost/cybernetics",
        "GEMINI_API_KEY": "your-gemini-key"`

const jsonStdio = (envBlock: string) => `{
  "mcpServers": {
    "cybernetics": {
      "command": "cybernetics-mcp",
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
    "cybernetics": {
      "command": "cybernetics-mcp",
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
    notes: 'Same JSON schema across Claude Desktop and Claude Code. Desktop: Linux ~/.config/Claude/, Windows %APPDATA%\\Claude\\. Code: run `claude mcp add cybernetics cybernetics-mcp` or paste into ~/.claude.json.',
    config: jsonStdio(baseEnv),
  },
  {
    id: 'codex',
    label: 'Codex CLI',
    filename: '~/.codex/config.toml',
    language: 'toml',
    notes: 'OpenAI Codex CLI uses TOML, not JSON.',
    config: `[mcp_servers.cybernetics]
command = "cybernetics-mcp"
args = []

[mcp_servers.cybernetics.env]
BROKER_API_KEY  = "your-broker-key"
POSTGRES_DSN    = "postgresql+asyncpg://user:pass@localhost/cybernetics"
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
  "id": "cybernetics",
  "name": "Cybernetics",
  "url": "http://localhost:4001",
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
    <div className="retro-window h-[calc(100vh-76px)] min-h-[680px] overflow-hidden">
      <div className="composer-toolbar flex min-h-[72px] items-center gap-4 border-b-2 border-[#676057] bg-[#09217f] px-6 text-white">
        <Server className="w-8 h-8 text-[#58ff3e]" />
        <span className="composer-title text-2xl font-black tracking-wide">MCP Control Plane</span>
        <div className="composer-toolbar-actions ml-auto flex items-center gap-2">
          <a href="#quick-start" className="retro-button toolbar-button"><Terminal className="w-6 h-6 text-[#071a7a]" />Quick Start</a>
          <a href="#adapter-catalog" className="retro-button toolbar-button"><Wrench className="w-6 h-6 text-[#071a7a]" />Adapters</a>
        </div>
      </div>

      <div className="blueprint-grid h-[calc(100%-72px)] overflow-y-auto overflow-x-hidden scrollbar-thin">
        <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6 lg:px-8">
          <div className="grid gap-6 xl:grid-cols-[1fr_320px]">

            {/* ── Intro ── */}
            <section className="border-2 border-[#5d5850] bg-[#dedad3] p-6 text-[#080b12] shadow-[5px_5px_0_rgba(0,0,0,0.35)]">
              <div className="flex items-start gap-4">
                <BookOpen className="mt-1 h-10 w-10 shrink-0 text-[#071a7a]" />
                <div className="min-w-0">
                  <h2 className="text-2xl font-black sm:text-3xl">Cybernetics MCP Server</h2>
                  <p className="mt-2 text-base font-bold sm:text-lg">Connect your AI agents to the Cybernetics meta-broker.</p>
                </div>
              </div>
              <div className="my-6 border-t-2 border-dashed border-[#55504a]" />
              <p className="text-sm font-semibold leading-relaxed sm:text-base">
                The Cybernetics MCP server is a single stdio-based MCP peer that aggregates every configured adapter into one unified tool namespace.
                Instead of wiring 50+ MCP servers, you wire <strong>one</strong>. Your client sees all tools from enabled adapters as a flat list.
              </p>
              <div className="mt-5 overflow-x-auto border-2 border-[#5d5850] bg-[#071122] p-4 font-mono text-xs text-[#d9e3f8] sm:text-sm">
                <div className="flex min-w-max items-center gap-3">
                  <span className="text-[#58ff3e]">MCP client</span>
                  <span className="text-[#7f8ba5]">— stdio —</span>
                  <span className="text-[#91b4ff]">cybernetics-mcp</span>
                  <span className="text-[#7f8ba5]">— tools —</span>
                  <span className="text-[#ffd43b]">datadog · github · slack · postgres · …</span>
                </div>
              </div>
            </section>

            {/* ── Status ── */}
            <aside className="border-2 border-[#5d5850] bg-[#dedad3] p-5 text-[#080b12] shadow-[5px_5px_0_rgba(0,0,0,0.35)]">
              <h3 className="text-lg font-black">SYSTEM STATUS</h3>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {[
                  ['Adapters', adapterError ? '!' : `${adapters.length}`],
                  ['Protocol', 'MCP'],
                  ['Transport', 'stdio'],
                  ['Source', 'live'],
                ].map(([label, value]) => (
                  <div key={label} className="border-2 border-[#8d877e] bg-[#eeeae4] p-3">
                    <div className="text-[10px] font-black uppercase tracking-wide text-[#071a7a]">{label}</div>
                    <div className="mt-1 text-xl font-black">{value}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 border-t-2 border-[#8d877e] pt-4 text-xs font-bold leading-relaxed">
                Adapters appear in client tool lists only when their required env vars are present.
              </div>
              {adapterError && (
                <div className="mt-3 border-2 border-[#5d5850] bg-[#ffd31f] p-3 text-xs font-black">
                  Could not reach /api/templates: {adapterError}
                </div>
              )}
            </aside>

            {/* ── Quick start ── */}
            <section id="quick-start" className="space-y-5 border-2 border-[#5d5850] bg-[#dedad3] p-6 text-[#080b12] shadow-[5px_5px_0_rgba(0,0,0,0.35)] xl:col-span-2">
              <h3 className="flex items-center gap-3 text-xl font-black sm:text-2xl">
                <Terminal className="w-7 h-7 text-[#071a7a]" />
                Quick Start
              </h3>

              <div className="grid gap-4 lg:grid-cols-[0.6fr_1fr]">
                <div className="space-y-3">
                  <p className="text-sm font-black">1. Install the broker</p>
                  <div className="retro-code">
                    <div className="retro-code-head">
                      <span>bash</span>
                      <button onClick={() => copy('pip install cybernetics-mcp', 'pip')} title="Copy install command">
                        {copied === 'pip' ? <CheckCircle className="w-4 h-4 text-[#58ff3e]" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                    <pre>pip install cybernetics-mcp</pre>
                  </div>
                  <p className="text-xs font-bold opacity-70">Requires Python 3.11+. The wheel ships the broker binary on PATH.</p>
                </div>

                <div className="space-y-3 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-black">2. Wire it into your client</p>
                    <span className="text-xs font-bold opacity-70">{clients.length} clients supported</span>
                  </div>

                  {/* Client picker tabs */}
                  <div className="flex flex-wrap gap-1">
                    {clients.map(c => (
                      <button
                        key={c.id}
                        onClick={() => setActiveClient(c.id)}
                        className={`px-3 py-1.5 text-xs font-black border-2 transition-colors ${
                          activeClient === c.id
                            ? 'border-[#06124f] bg-[#09217f] text-white'
                            : 'border-[#8d877e] bg-[#eeeae4] hover:bg-[#e5e0d8]'
                        }`}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>

                  <div className="retro-code">
                    <div className="retro-code-head">
                      <span className="truncate">{activeConfig.filename}</span>
                      <button onClick={() => copy(activeConfig.config, activeConfig.id)} title="Copy config">
                        {copied === activeConfig.id ? <CheckCircle className="w-4 h-4 text-[#58ff3e]" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                    <pre>{activeConfig.config}</pre>
                  </div>
                  <p className="text-xs font-bold opacity-80">{activeConfig.notes}</p>
                </div>
              </div>
            </section>

            {/* ── Adapter catalog (live from /api/templates) ── */}
            <section id="adapter-catalog" className="space-y-4 border-2 border-[#5d5850] bg-[#dedad3] p-6 text-[#080b12] shadow-[5px_5px_0_rgba(0,0,0,0.35)] xl:col-span-2">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="flex items-center gap-3 text-xl font-black sm:text-2xl">
                    <Wrench className="w-7 h-7 text-[#071a7a]" />
                    Adapter Catalog
                  </h3>
                  <p className="mt-1 text-sm font-bold text-[#3c3934]">
                    Live from <code className="font-mono">/api/templates</code>. Each adapter links to its official upstream MCP server.
                  </p>
                </div>
                <div className="border-2 border-[#8d877e] bg-[#eeeae4] px-3 py-2 text-sm font-black whitespace-nowrap">
                  {filteredAdapters.length} / {adapters.length} adapters
                </div>
              </div>

              <input
                type="text"
                placeholder="Filter adapters…"
                value={adapterFilter}
                onChange={e => setAdapterFilter(e.target.value)}
                className="retro-input w-full px-3 py-2 text-sm font-bold"
              />

              <div className="grid gap-2">
                {filteredAdapters.map(a => (
                  <div key={a.name} className="border-2 border-[#5d5850] bg-[#eeeae4]">
                    <button
                      onClick={() => toggleExpand(a.name)}
                      className="grid w-full grid-cols-[auto_minmax(120px,0.35fr)_1fr_auto] items-center gap-3 px-3 py-2.5 text-left hover:bg-[#e5e0d8] sm:px-4 sm:py-3"
                    >
                      <ChevronDown className={`w-5 h-5 text-[#071a7a] transition-transform ${expanded.has(a.name) ? 'rotate-180' : ''}`} />
                      <span className="text-sm font-black capitalize text-[#071a7a] truncate sm:text-base">{a.name}</span>
                      <span className="text-xs font-bold text-[#3c3934] truncate sm:text-sm">{a.description}</span>
                      {a.group && (
                        <span className="border border-[#8d877e] bg-[#d7e4ff] px-2 py-0.5 text-[10px] font-black whitespace-nowrap">{a.group}</span>
                      )}
                    </button>
                    {expanded.has(a.name) && (
                      <div className="space-y-3 border-t-2 border-[#8d877e] p-3 sm:p-4">
                        <a
                          href={a.source}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 border-2 border-[#8d877e] bg-[#d7e4ff] px-3 py-2 text-xs font-black text-[#071a7a] underline decoration-2 underline-offset-4"
                        >
                          <ExternalLink className="w-3.5 h-3.5" /> Official upstream MCP
                        </a>
                        <p className="font-mono text-xs break-all opacity-80">{a.source}</p>
                      </div>
                    )}
                  </div>
                ))}
                {adapters.length === 0 && !adapterError && (
                  <p className="text-sm font-bold opacity-70">Loading adapters…</p>
                )}
                {filteredAdapters.length === 0 && adapters.length > 0 && (
                  <p className="text-sm font-bold opacity-70">No adapters match "{adapterFilter}".</p>
                )}
              </div>
            </section>

            {/* ── Required env vars ── */}
            <section className="space-y-4 border-2 border-[#5d5850] bg-[#dedad3] p-6 text-[#080b12] shadow-[5px_5px_0_rgba(0,0,0,0.35)] xl:col-span-2">
              <h3 className="flex items-center gap-3 text-xl font-black sm:text-2xl">
                <Key className="w-7 h-7 text-[#071a7a]" />
                Broker env vars
              </h3>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <h4 className="mb-2 text-xs font-black uppercase tracking-wider">Always required</h4>
                  <div className="grid gap-1.5">
                    {[
                      ['BROKER_API_KEY', 'Shared secret between MCP client and broker'],
                      ['POSTGRES_DSN', 'Postgres URL for state/memory'],
                      ['GEMINI_API_KEY', 'Google AI key for compose/chat endpoints'],
                    ].map(([k, desc]) => (
                      <div key={k} className="border-2 border-[#8d877e] bg-[#eeeae4] px-3 py-2">
                        <div className="font-mono text-xs font-black text-[#071a7a]">{k}</div>
                        <div className="text-xs font-bold opacity-80">{desc}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="mb-2 text-xs font-black uppercase tracking-wider">Per-adapter (selected)</h4>
                  <div className="grid gap-1.5">
                    {[
                      'DYNATRACE_API_TOKEN', 'DATADOG_API_KEY', 'GITHUB_TOKEN',
                      'SLACK_BOT_TOKEN', 'STRIPE_API_KEY', 'NOTION_TOKEN',
                      'AWS_ACCESS_KEY_ID', 'GOOGLE_SERVICE_ACCOUNT_KEY',
                    ].map(k => (
                      <div key={k} className="border-2 border-[#8d877e] bg-[#eeeae4] px-3 py-2">
                        <div className="font-mono text-xs font-black text-[#071a7a]">{k}</div>
                      </div>
                    ))}
                    <p className="mt-1 text-xs font-bold opacity-70">
                      Full list under each adapter in the Composer view → Keys tab.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* ── Troubleshooting ── */}
            <section className="border-2 border-[#5d5850] bg-[#dedad3] p-6 text-[#080b12] shadow-[5px_5px_0_rgba(0,0,0,0.35)] xl:col-span-2">
              <h3 className="mb-4 flex items-center gap-3 text-xl font-black sm:text-2xl">
                <AlertCircle className="w-7 h-7 text-[#071a7a]" />
                Troubleshooting
              </h3>
              <div className="grid gap-2 text-sm font-bold md:grid-cols-2">
                <p className="border-2 border-[#8d877e] bg-[#eeeae4] p-3"><strong>tools/list is empty?</strong> Check that the adapter env vars are set in the client config — adapters only register when their secrets are present.</p>
                <p className="border-2 border-[#8d877e] bg-[#eeeae4] p-3"><strong>Connection refused?</strong> Ensure <code className="font-mono">cybernetics-mcp</code> is on PATH and reachable by the client process.</p>
                <p className="border-2 border-[#8d877e] bg-[#eeeae4] p-3"><strong>401 from broker?</strong> Verify <code className="font-mono">BROKER_API_KEY</code> matches the broker's expected value.</p>
                <p className="border-2 border-[#8d877e] bg-[#eeeae4] p-3"><strong>Adapter missing?</strong> Open <code className="font-mono">/api/templates</code> — if the catalog has it but the client doesn't, the client may need a restart after editing config.</p>
              </div>
            </section>

          </div>
        </div>
      </div>
    </div>
  )
}
