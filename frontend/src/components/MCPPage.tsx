import { useState } from 'react'
import { Server, Copy, Terminal, CheckCircle, AlertCircle, BookOpen, ChevronDown, Key, Settings, Wrench } from 'lucide-react'

interface AdapterInfo {
  name: string
  description: string
  protocol: string
  preset: string[]
  secrets: string[]
  tools: string[]
}

const adapters: AdapterInfo[] = [
  {
    name: 'dynatrace', description: 'Observability platform for monitoring and AIOps',
    protocol: 'REST', preset: ['DYNATRACE_BASE_URL'], secrets: ['DYNATRACE_API_TOKEN'],
    tools: ['dynatrace_get_problems', 'dynatrace_get_traces', 'dynatrace_run_dql'],
  },
  {
    name: 'elastic', description: 'Search and analytics engine',
    protocol: 'REST', preset: ['ELASTIC_CLOUD_ID'], secrets: ['ELASTIC_API_KEY'],
    tools: ['elastic_search_incidents', 'elastic_search_runbooks', 'elastic_write_insight'],
  },
  {
    name: 'postgres', description: 'PostgreSQL database for pattern storage',
    protocol: 'TCP', preset: ['POSTGRES_DSN'], secrets: [],
    tools: ['postgres_recall_pattern', 'postgres_store_pattern', 'postgres_log_incident'],
  },
  {
    name: 'gitlab', description: 'Git repository and CI/CD platform',
    protocol: 'REST', preset: ['GITLAB_URL'], secrets: ['GITLAB_TOKEN'],
    tools: ['gitlab_create_issue', 'gitlab_create_mr', 'gitlab_get_file', 'gitlab_trigger_pipeline'],
  },
  {
    name: 'arize', description: 'LLM observability and evaluation platform',
    protocol: 'REST', preset: ['ARIZE_ENDPOINT'], secrets: ['ARIZE_API_KEY'],
    tools: ['arize_run_judge', 'arize_log_eval'],
  },
  {
    name: 'fivetran', description: 'Data pipeline orchestration',
    protocol: 'REST', preset: [], secrets: ['FIVETRAN_API_KEY', 'FIVETRAN_API_SECRET'],
    tools: ['fivetran_list_connectors', 'fivetran_get_status', 'fivetran_sync', 'fivetran_create_pipeline'],
  },
  {
    name: 'github', description: 'GitHub repositories, issues, actions',
    protocol: 'REST', preset: [], secrets: ['GITHUB_TOKEN'],
    tools: ['github_create_issue', 'github_create_pr', 'github_list_repos', 'github_trigger_workflow', 'github_search_code'],
  },
  {
    name: 'stripe', description: 'Payment processing and billing',
    protocol: 'REST', preset: [], secrets: ['STRIPE_API_KEY'],
    tools: ['stripe_create_customer', 'stripe_get_customer', 'stripe_create_charge', 'stripe_list_invoices', 'stripe_create_subscription'],
  },
  {
    name: 'aws', description: 'AWS cloud services',
    protocol: 'boto3', preset: ['AWS_REGION'], secrets: ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'],
    tools: ['aws_s3_list_buckets', 'aws_ec2_describe', 'aws_lambda_invoke', 'aws_cloudwatch_metrics'],
  },
  {
    name: 'vercel', description: 'Frontend deployment platform',
    protocol: 'REST', preset: [], secrets: ['VERCEL_TOKEN'],
    tools: ['vercel_list_projects', 'vercel_get_deployment', 'vercel_list_deployments', 'vercel_add_env_var'],
  },
  {
    name: 'supabase', description: 'Postgres backend-as-a-service',
    protocol: 'REST', preset: ['SUPABASE_URL'], secrets: ['SUPABASE_KEY'],
    tools: ['supabase_select', 'supabase_insert', 'supabase_update', 'supabase_delete', 'supabase_rpc'],
  },
  {
    name: 'cloudflare', description: 'CDN, DNS, and edge workers',
    protocol: 'REST', preset: ['CLOUDFLARE_ACCOUNT_ID'], secrets: ['CLOUDFLARE_API_TOKEN'],
    tools: ['cloudflare_list_zones', 'cloudflare_list_dns', 'cloudflare_create_dns', 'cloudflare_list_workers', 'cloudflare_deploy_worker'],
  },
  {
    name: 'browser', description: 'Browser automation via Chrome DevTools',
    protocol: 'WebSocket CDP', preset: ['BROWSER_CDP_HOST', 'BROWSER_CDP_PORT'], secrets: [],
    tools: ['browser_navigate', 'browser_evaluate', 'browser_screenshot', 'browser_get_network', 'browser_get_console', 'browser_clear_cache'],
  },
  {
    name: 'chrome', description: 'Chrome CDP automation',
    protocol: 'WebSocket CDP', preset: ['BROWSER_CDP_HOST', 'BROWSER_CDP_PORT'], secrets: [],
    tools: ['chrome_navigate', 'chrome_evaluate', 'chrome_screenshot', 'chrome_get_network', 'chrome_get_console', 'chrome_clear_cache', 'chrome_set_viewport', 'chrome_click', 'chrome_type', 'chrome_pdf'],
  },
  {
    name: 'firefox', description: 'Firefox automation via Playwright',
    protocol: 'Playwright', preset: [], secrets: [],
    tools: ['firefox_navigate', 'firefox_evaluate', 'firefox_screenshot', 'firefox_get_console', 'firefox_click', 'firefox_type', 'firefox_set_viewport', 'firefox_pdf'],
  },
  {
    name: 'brave', description: 'Brave browser automation with shields',
    protocol: 'Playwright', preset: [], secrets: [],
    tools: ['brave_navigate', 'brave_evaluate', 'brave_screenshot', 'brave_click', 'brave_type', 'brave_set_viewport', 'brave_pdf', 'brave_check_shields'],
  },
  {
    name: 'slack', description: 'Slack workspace integration',
    protocol: 'REST', preset: [], secrets: ['SLACK_BOT_TOKEN'],
    tools: ['slack_post_message', 'slack_get_channel_history', 'slack_list_channels', 'slack_search_messages', 'slack_upload_file', 'slack_get_user_info'],
  },
  {
    name: 'kubernetes', description: 'K8s cluster operations',
    protocol: 'HTTP / kubeconfig', preset: ['KUBERNETES_NAMESPACE'], secrets: [],
    tools: ['k8s_list_pods', 'k8s_get_pod_logs', 'k8s_describe_pod', 'k8s_scale_deployment', 'k8s_restart_deployment', 'k8s_list_deployments', 'k8s_list_services', 'k8s_exec_command'],
  },
  {
    name: 'datadog', description: 'Observability and monitoring platform',
    protocol: 'REST', preset: ['DATADOG_SITE'], secrets: ['DATADOG_API_KEY', 'DATADOG_APP_KEY'],
    tools: ['datadog_query_metrics', 'datadog_list_monitors', 'datadog_get_monitor', 'datadog_mute_monitor', 'datadog_list_incidents', 'datadog_search_logs', 'datadog_post_event'],
  },
  {
    name: 'notion', description: 'Notion workspace and databases',
    protocol: 'REST', preset: [], secrets: ['NOTION_TOKEN'],
    tools: ['notion_search', 'notion_get_page', 'notion_create_page', 'notion_query_database', 'notion_update_page', 'notion_get_database'],
  },
  {
    name: 'linear', description: 'Issue tracking via GraphQL',
    protocol: 'GraphQL', preset: [], secrets: ['LINEAR_API_KEY'],
    tools: ['linear_create_issue', 'linear_list_issues', 'linear_update_issue', 'linear_get_teams', 'linear_search_issues', 'linear_create_comment'],
  },
]

const claudeConfig = `{
  "mcpServers": {
    "cybernetics": {
      "command": "cybernetics-mcp",
      "env": {
        "BROKER_API_KEY": "your-broker-key",
        "POSTGRES_DSN": "postgresql+asyncpg://user:pass@localhost/sentinel",
        "DYNATRACE_BASE_URL": "https://xyz.live.dynatrace.com",
        "DYNATRACE_API_TOKEN": "dt0c01.xxx"
      }
    }
  }
}`

const cursorConfig = `{
  "mcpServers": {
    "cybernetics": {
      "command": "cybernetics-mcp",
      "env": {
        "BROKER_API_KEY": "your-broker-key",
        "POSTGRES_DSN": "postgresql+asyncpg://user:pass@localhost/sentinel"
      }
    }
  }
}`

export function MCPPage() {
  const [copied, setCopied] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(null), 2000)
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
    <div className="max-w-5xl mx-auto w-full space-y-8">
      {/* Hero */}
      <div className="flex items-center gap-3">
        <Server className="w-8 h-8 text-emerald-400" />
        <div>
          <h2 className="text-2xl font-bold text-white">Cybernetics MCP Server</h2>
          <p className="text-sm text-slate-400">Connect your AI agents to the Cybernetics meta-broker</p>
        </div>
      </div>

      {/* What is it */}
      <section className="p-6 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-emerald-400" />
          What Is the Cybernetics MCP Server?
        </h3>
        <p className="text-sm text-slate-300 leading-relaxed">
          The Cybernetics MCP server is a single stdio-based MCP peer that aggregates all configured adapters into one unified tool namespace.
          Instead of installing 20 separate MCP servers, you install <strong>one</strong>. Your MCP client sees all tools from all enabled adapters as a flat list.
        </p>
        <div className="rounded-lg bg-slate-950 border border-slate-800 p-4 font-mono text-xs text-slate-400">
          <div className="flex gap-2">
            <span className="text-emerald-400">Claude Desktop</span>
            <span className="text-slate-600">◄──stdio──►</span>
            <span className="text-blue-400">Cybernetics MCP Server</span>
            <span className="text-slate-600">──►</span>
            <span className="text-amber-400">Dynatrace · GitHub · Slack · Browser...</span>
          </div>
        </div>
      </section>

      {/* Quick Start */}
      <section className="p-6 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Terminal className="w-5 h-5 text-emerald-400" />
          Quick Start
        </h3>
        <div className="space-y-2">
          <p className="text-sm text-slate-300"><strong className="text-white">1.</strong> Install the Cybernetics MCP package:</p>
          <div className="rounded-lg bg-slate-950 border border-slate-800 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 bg-slate-800 border-b border-slate-700">
              <span className="text-xs text-slate-400">bash</span>
              <button onClick={() => copy('pip install cybernetics-mcp', 'pip')} className="text-slate-500 hover:text-emerald-400">
                {copied === 'pip' ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <pre className="p-3 text-xs text-slate-300">pip install cybernetics-mcp</pre>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm text-slate-300"><strong className="text-white">2.</strong> Add to your MCP client config:</p>
          <div className="rounded-lg bg-slate-950 border border-slate-800 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 bg-slate-800 border-b border-slate-700">
              <span className="text-xs text-slate-400">claude_desktop_config.json</span>
              <button onClick={() => copy(claudeConfig, 'claude')} className="text-slate-500 hover:text-emerald-400">
                {copied === 'claude' ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <pre className="p-3 text-[11px] text-slate-300 overflow-x-auto">{claudeConfig}</pre>
          </div>
          <div className="rounded-lg bg-slate-950 border border-slate-800 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 bg-slate-800 border-b border-slate-700">
              <span className="text-xs text-slate-400">.cursor/mcp.json</span>
              <button onClick={() => copy(cursorConfig, 'cursor')} className="text-slate-500 hover:text-emerald-400">
                {copied === 'cursor' ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <pre className="p-3 text-[11px] text-slate-300 overflow-x-auto">{cursorConfig}</pre>
          </div>
        </div>
      </section>

      {/* Adapter Catalog — Full Detail */}
      <section className="p-6 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex items-center gap-2">
          <Wrench className="w-5 h-5 text-emerald-400" />
          <h3 className="text-lg font-semibold text-white">Adapter Catalog — 55+ Adapters, 150+ Tools</h3>
        </div>
        <p className="text-sm text-slate-400">
          Each adapter shows: preset connection config (ops-managed), secret keys you must provide, and every tool exposed over MCP.
        </p>
        <div className="space-y-2">
          {adapters.map((a) => (
            <div key={a.name} className="rounded-lg border border-slate-800 bg-slate-950 overflow-hidden">
              <button
                onClick={() => toggleExpand(a.name)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-900 transition-colors"
              >
                <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${expanded.has(a.name) ? 'rotate-180' : ''}`} />
                <span className="text-sm font-semibold text-white capitalize w-24">{a.name}</span>
                <span className="text-xs text-slate-500 flex-1">{a.description}</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400">{a.tools.length} tools</span>
                {a.secrets.length > 0 && (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-400">{a.secrets.length} keys</span>
                )}
              </button>
              {expanded.has(a.name) && (
                <div className="px-4 pb-4 space-y-3 border-t border-slate-800">
                  {/* Preset Config */}
                  {a.preset.length > 0 && (
                    <div className="pt-3">
                      <h4 className="text-xs font-semibold text-slate-500 mb-1 flex items-center gap-1">
                        <Settings className="w-3 h-3" /> Preset Connection Config (ops-managed)
                      </h4>
                      <div className="flex flex-wrap gap-1">
                        {a.preset.map(p => (
                          <span key={p} className="px-2 py-0.5 text-[10px] rounded bg-slate-800 text-slate-400 font-mono">{p}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Secret Keys */}
                  {a.secrets.length > 0 ? (
                    <div>
                      <h4 className="text-xs font-semibold text-amber-500 mb-1 flex items-center gap-1">
                        <Key className="w-3 h-3" /> Secret Keys Required
                      </h4>
                      <div className="flex flex-wrap gap-1">
                        {a.secrets.map(s => (
                          <span key={s} className="px-2 py-0.5 text-[10px] rounded bg-amber-500/10 text-amber-400 font-mono">{s}</span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="pt-3">
                      <h4 className="text-xs font-semibold text-slate-500 mb-1 flex items-center gap-1">
                        <Key className="w-3 h-3" /> Secret Keys — None required
                      </h4>
                      <span className="text-[10px] text-slate-500">No secrets needed (local connection or no auth)</span>
                    </div>
                  )}
                  {/* Tools */}
                  <div>
                    <h4 className="text-xs font-semibold text-emerald-400 mb-1 flex items-center gap-1">
                      <Wrench className="w-3 h-3" /> Tools ({a.tools.length})
                    </h4>
                    <div className="flex flex-wrap gap-1">
                      {a.tools.map(t => (
                        <span key={t} className="px-2 py-0.5 text-[10px] rounded bg-emerald-500/10 text-emerald-400 font-mono">{t}</span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Global Env Summary */}
      <section className="p-6 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-blue-400" />
          Environment Variables Reference
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h4 className="text-sm font-semibold text-white mb-2 flex items-center gap-1"><Settings className="w-3.5 h-3.5 text-slate-500" /> Preset Config (ops-managed)</h4>
            <div className="space-y-1 max-h-64 overflow-y-auto scrollbar-thin pr-1">
              {['POSTGRES_DSN', 'DYNATRACE_BASE_URL', 'ELASTIC_CLOUD_ID', 'GITLAB_URL', 'ARIZE_ENDPOINT', 'DATADOG_SITE', 'BROWSER_CDP_HOST', 'BROWSER_CDP_PORT', 'SUPABASE_URL', 'CLOUDFLARE_ACCOUNT_ID', 'AWS_REGION', 'KUBERNETES_NAMESPACE'].map(v => (
                <div key={v} className="flex items-center gap-2 px-2 py-1 rounded bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-slate-500">URL</span>
                  <span className="text-xs text-slate-300 font-mono">{v}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white mb-2 flex items-center gap-1"><Key className="w-3.5 h-3.5 text-amber-400" /> Secret Keys (user-provided)</h4>
            <div className="space-y-1 max-h-64 overflow-y-auto scrollbar-thin pr-1">
              {['BROKER_API_KEY', 'DYNATRACE_API_TOKEN', 'ELASTIC_API_KEY', 'GITLAB_TOKEN', 'GITHUB_TOKEN', 'SLACK_BOT_TOKEN', 'DATADOG_API_KEY', 'DATADOG_APP_KEY', 'NOTION_TOKEN', 'LINEAR_API_KEY', 'STRIPE_API_KEY', 'FIVETRAN_API_KEY', 'FIVETRAN_API_SECRET', 'VERCEL_TOKEN', 'CLOUDFLARE_API_TOKEN', 'SUPABASE_KEY', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'].map(v => (
                <div key={v} className="flex items-center gap-2 px-2 py-1 rounded bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-amber-500">KEY</span>
                  <span className="text-xs text-slate-300 font-mono">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Troubleshooting */}
      <section className="p-6 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-rose-400" />
          Troubleshooting
        </h3>
        <div className="space-y-2 text-sm text-slate-300">
          <p><strong className="text-white">tools/list is empty?</strong> Check that the adapter env vars are set. Adapters only register if their required config is present.</p>
          <p><strong className="text-white">Connection refused?</strong> Ensure the Cybernetics broker is running. For local dev, start with <code className="text-emerald-400">python -m cybernetics.broker</code>.</p>
          <p><strong className="text-white">Auth errors?</strong> Verify <code className="text-emerald-400">BROKER_API_KEY</code> matches the broker's expected key.</p>
          <p><strong className="text-white">Missing adapter?</strong> The MCP server only loads adapters with their preset config present. If <code className="text-emerald-400">DYNATRACE_BASE_URL</code> is not set, the Dynatrace adapter won't appear in tools/list.</p>
        </div>
      </section>
    </div>
  )
}
